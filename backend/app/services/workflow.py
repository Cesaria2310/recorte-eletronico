"""Orquestração do fluxo (máquina de estados).

Etapas do atendimento, conforme descrito pelo cliente:
  1. Analisar o perfil do usuário cadastrado
  2. Encontrar perfis com mais seguidores no mesmo tema
  3. Levantar os assuntos mais comentados (internet + instagram)
  4. Enviar assuntos para o usuário -> usuário seleciona
  5. App seleciona o melhor vídeo/foto e monta o post com legenda + tendências
  6. Gera post com bons comentários + CTA (seguir / direct)
  7. Envia ao usuário para avaliação/autorização
  8. Autorizado -> publica
  9. Reprovado -> refazer post OU outro tema OU pausar (retorna no dia seguinte)
"""
from datetime import date, datetime, timedelta

from sqlalchemy.orm import Session

from .. import models
from ..routers.secrets import get_secret_value
from .ai.factory import get_ai_provider
from .instagram.factory import get_instagram_provider


def _provider_for(db: Session, client: models.Client):
    contract = client.contract
    api_key = get_secret_value(db, client.id, "anthropic_api_key")
    return get_ai_provider(contract.ai_provider if contract else "mock", api_key=api_key)


# ---------- Etapa 1-3: análise + concorrentes + assuntos ----------
def run_analysis(db: Session, campaign: models.Campaign) -> models.Campaign:
    client = campaign.client
    ai = _provider_for(db, client)

    analysis = ai.analyze_profile(client.instagram_handle, client.bio or "", client.themes or [])
    campaign.analysis_summary = analysis.summary
    campaign.detected_themes = analysis.themes
    campaign.status = "analyzed"

    # concorrentes (limpa anteriores)
    campaign.competitors.clear()
    for c in ai.find_competitors(analysis, client.themes or []):
        campaign.competitors.append(
            models.CompetitorProfile(
                handle=c.handle, followers=c.followers, themes=c.themes, relevance=c.relevance
            )
        )

    # assuntos mais comentados
    campaign.topics.clear()
    competitors = ai.find_competitors(analysis, client.themes or [])
    for t in ai.trending_topics(analysis.themes, competitors):
        campaign.topics.append(
            models.TopicSuggestion(
                title=t.title,
                description=t.description,
                source=t.source,
                engagement_score=t.engagement_score,
                related_handles=t.related_handles,
            )
        )
    campaign.status = "topics_ready"
    campaign.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(campaign)
    return campaign


# ---------- Seleção da melhor mídia ----------
def _pick_best_media(db: Session, client: models.Client, topic: models.TopicSuggestion):
    """Escolhe a mídia mais adequada ao tema.

    Heurística: pontua por palavras do tema presentes em descrição/tags; vídeo
    ganha leve preferência (melhor alcance em tendências/reels). Empate -> mais
    recente.
    """
    media = db.query(models.MediaAsset).filter(models.MediaAsset.client_id == client.id).all()
    if not media:
        return None
    topic_words = {w.lower() for w in (topic.title + " " + (topic.description or "")).split() if len(w) > 3}

    def score(m: models.MediaAsset) -> tuple:
        text = (m.description or "") + " " + " ".join(m.tags or [])
        words = {w.lower() for w in text.split()}
        overlap = len(topic_words & words)
        type_bonus = 1 if m.media_type == "video" else 0
        return (overlap, type_bonus, m.id)

    return max(media, key=score)


# ---------- Etapa 4-7: selecionar tema, montar e gerar draft ----------
def select_topic_and_build(db: Session, campaign: models.Campaign, topic_id: int, media_asset_id=None) -> models.PostDraft:
    client = campaign.client
    topic = db.query(models.TopicSuggestion).filter(
        models.TopicSuggestion.id == topic_id,
        models.TopicSuggestion.campaign_id == campaign.id,
    ).first()
    if not topic:
        raise ValueError("Tema não encontrado nesta campanha.")

    # marca seleção
    for t in campaign.topics:
        t.selected = t.id == topic_id
    campaign.selected_topic_id = topic_id
    campaign.status = "topic_selected"

    # escolhe mídia (manual ou automática)
    if media_asset_id:
        media = db.query(models.MediaAsset).filter(
            models.MediaAsset.id == media_asset_id,
            models.MediaAsset.client_id == client.id,
        ).first()
    else:
        media = _pick_best_media(db, client, topic)

    return _generate_draft(db, campaign, topic, media, version=1)


def _generate_draft(db, campaign, topic, media, version) -> models.PostDraft:
    ai = _provider_for(db, campaign.client)
    media_desc = (media.description or media.original_name) if media else "sem mídia"
    post = ai.generate_post(topic.title, topic.description or "", media_desc, campaign.detected_themes or [])

    draft = models.PostDraft(
        campaign_id=campaign.id,
        media_asset_id=media.id if media else None,
        topic_id=topic.id,
        version=version,
        caption=post.caption,
        hashtags=post.hashtags,
        first_comment=post.first_comment,
        call_to_action=post.call_to_action,
        status="pending_approval",
    )
    campaign.drafts.append(draft)
    campaign.status = "pending_approval"
    campaign.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(draft)
    return draft


# ---------- Etapa 8-9: aprovação / reprovação ----------
def approve_draft(db: Session, draft: models.PostDraft) -> models.PostDraft:
    campaign = draft.campaign
    client = campaign.client
    contract = client.contract

    draft.status = "approved"
    campaign.status = "approved"
    db.commit()

    # publica automaticamente se o contrato permitir
    if contract and contract.auto_post_when_approved:
        return publish_draft(db, draft)
    db.refresh(draft)
    return draft


def publish_draft(db: Session, draft: models.PostDraft) -> models.PostDraft:
    campaign = draft.campaign
    client = campaign.client
    contract = client.contract
    provider = get_instagram_provider(
        contract.integration_mode if contract else "mock",
        get_secret_value(db, client.id, "instagram_access_token"),
        get_secret_value(db, client.id, "instagram_business_id"),
    )
    media = draft.media_asset
    full_caption = draft.caption + ("\n\n" + " ".join(draft.hashtags) if draft.hashtags else "")
    # No modo Graph a mídia precisa de URL pública (a Meta baixa o arquivo).
    if media and contract and contract.integration_mode == "instagram_graph":
        from .instagram.graph_api import public_media_url
        media_url = public_media_url(media)
    else:
        media_url = media.url if media else ""
    result = provider.publish(
        media_url=media_url,
        media_type=media.media_type if media else "photo",
        caption=full_caption,
        first_comment=draft.first_comment,
    )
    if result.ok:
        draft.status = "posted"
        draft.external_post_id = result.external_post_id
        draft.posted_at = datetime.utcnow()
        campaign.status = "posted"
    else:
        draft.feedback = result.detail
        campaign.status = "approved"  # aprovado mas falhou ao publicar
    db.commit()
    db.refresh(draft)
    return draft


def reject_draft(db: Session, draft: models.PostDraft, decision: str, feedback=None, new_topic_id=None) -> dict:
    """Trata a reprovação conforme a decisão do usuário.

    decision:
      - redo_post: refaz o post com o MESMO tema (nova versão)
      - select_other_topic: monta com OUTRO tema
      - pause: encerra o atendimento e retorna no dia seguinte
    """
    campaign = draft.campaign
    draft.status = "rejected"
    draft.feedback = feedback
    db.commit()

    if decision == "redo_post":
        topic = db.query(models.TopicSuggestion).get(draft.topic_id)
        media = draft.media_asset
        next_version = (db.query(models.PostDraft)
                        .filter(models.PostDraft.campaign_id == campaign.id).count()) + 1
        new_draft = _generate_draft(db, campaign, topic, media, version=next_version)
        return {"action": "redo_post", "draft_id": new_draft.id, "campaign_status": campaign.status}

    if decision == "select_other_topic":
        if not new_topic_id:
            campaign.status = "topics_ready"
            db.commit()
            return {"action": "awaiting_topic", "campaign_status": campaign.status}
        new_draft = select_topic_and_build(db, campaign, new_topic_id)
        return {"action": "select_other_topic", "draft_id": new_draft.id, "campaign_status": campaign.status}

    # pause -> retorna no dia seguinte
    campaign.status = "paused"
    campaign.next_resume_date = date.today() + timedelta(days=1)
    db.commit()
    return {"action": "paused", "resume_on": campaign.next_resume_date.isoformat(),
            "campaign_status": campaign.status}
