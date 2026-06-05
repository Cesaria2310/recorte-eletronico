"""Rotas do fluxo/atendimento (máquina de estados).

Cobre: criar campanha, rodar análise (perfil + concorrentes + assuntos),
selecionar tema e montar o post, aprovar/publicar, e tratar reprovação
(refazer, outro tema ou pausar até o dia seguinte).
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import get_current_user
from ..database import get_db
from ..services import workflow
from ..services import video_render

router = APIRouter(prefix="/api", tags=["campaigns"], dependencies=[Depends(get_current_user)])


def _get_campaign(db: Session, campaign_id: int) -> models.Campaign:
    c = db.query(models.Campaign).get(campaign_id)
    if not c:
        raise HTTPException(404, "Campanha não encontrada.")
    return c


@router.post("/clients/{client_id}/campaigns", response_model=schemas.CampaignOut)
def create_campaign(client_id: int, db: Session = Depends(get_db)):
    client = db.query(models.Client).get(client_id)
    if not client:
        raise HTTPException(404, "Cliente não encontrado.")
    campaign = models.Campaign(client_id=client_id, status="created")
    db.add(campaign)
    db.commit()
    db.refresh(campaign)
    return campaign


@router.get("/clients/{client_id}/campaigns", response_model=list[schemas.CampaignOut])
def list_campaigns(client_id: int, db: Session = Depends(get_db)):
    return (db.query(models.Campaign)
            .filter(models.Campaign.client_id == client_id)
            .order_by(models.Campaign.created_at.desc()).all())


@router.get("/campaigns/{campaign_id}", response_model=schemas.CampaignOut)
def get_campaign(campaign_id: int, db: Session = Depends(get_db)):
    return _get_campaign(db, campaign_id)


@router.post("/campaigns/{campaign_id}/analyze", response_model=schemas.CampaignOut)
def analyze(campaign_id: int, db: Session = Depends(get_db)):
    """Etapas 1-3: analisa o perfil, busca concorrentes e levanta os assuntos."""
    campaign = _get_campaign(db, campaign_id)
    return workflow.run_analysis(db, campaign)


@router.post("/campaigns/{campaign_id}/select-topic", response_model=schemas.DraftOut)
def select_topic(campaign_id: int, payload: schemas.SelectTopicIn, db: Session = Depends(get_db)):
    """Etapas 4-7: usuário seleciona o tema -> app escolhe mídia e monta o post."""
    campaign = _get_campaign(db, campaign_id)
    try:
        return workflow.select_topic_and_build(db, campaign, payload.topic_id, payload.media_asset_id)
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.post("/drafts/{draft_id}/review", response_model=schemas.DraftOut)
def review_draft(draft_id: int, payload: schemas.ApprovalIn, db: Session = Depends(get_db)):
    """Etapa 8: usuário avalia. Aprovado -> publica (se contrato permitir)."""
    draft = db.query(models.PostDraft).get(draft_id)
    if not draft:
        raise HTTPException(404, "Post não encontrado.")
    if payload.approved:
        return workflow.approve_draft(db, draft)
    draft.feedback = payload.feedback
    db.commit()
    db.refresh(draft)
    raise HTTPException(409, "Reprovado: use /drafts/{id}/reject para decidir o próximo passo.")


@router.post("/drafts/{draft_id}/reject")
def reject_draft(draft_id: int, payload: schemas.RejectDecisionIn, db: Session = Depends(get_db)):
    """Etapa 9: refazer post, escolher outro tema ou pausar (retorna amanhã)."""
    draft = db.query(models.PostDraft).get(draft_id)
    if not draft:
        raise HTTPException(404, "Post não encontrado.")
    if payload.decision not in {"redo_post", "select_other_topic", "pause"}:
        raise HTTPException(400, "Decisão inválida.")
    return workflow.reject_draft(db, draft, payload.decision, payload.feedback, payload.topic_id)


@router.post("/drafts/{draft_id}/render-video")
def render_video(draft_id: int, db: Session = Depends(get_db)):
    """Monta o vídeo (reel) do post com legendas/tendências via Remotion."""
    draft = db.query(models.PostDraft).get(draft_id)
    if not draft:
        raise HTTPException(404, "Post não encontrado.")
    result = video_render.render_draft_video(db, draft)
    return {"ok": result.ok, "url": result.url, "detail": result.detail}


@router.post("/drafts/{draft_id}/publish", response_model=schemas.DraftOut)
def publish_now(draft_id: int, db: Session = Depends(get_db)):
    """Publica manualmente um post aprovado (quando auto-post está desligado)."""
    draft = db.query(models.PostDraft).get(draft_id)
    if not draft:
        raise HTTPException(404, "Post não encontrado.")
    return workflow.publish_draft(db, draft)
