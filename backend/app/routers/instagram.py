"""Conexão guiada com o Instagram (Meta Graph API) — dentro do dashboard.

Incorpora o fluxo da skill setup-instagram, mas integrado ao nosso projeto:
  - valida o token e DESCOBRE automaticamente o Instagram Business ID;
  - salva token + Business ID no Cofre criptografado (não em .env);
  - opcionalmente troca por token de longa duração;
  - testa a conexão ao vivo (retorna @username);
  - publica carrossel (2 a 10 imagens).

Tudo restrito a administradores (assim como o Cofre).
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import models, vault
from ..auth import get_current_user
from ..database import get_db
from .secrets import get_secret_value
from ..services.instagram import graph_api
from ..services.instagram.factory import get_instagram_provider

router = APIRouter(prefix="/api/clients/{client_id}/instagram", tags=["instagram"],
                   dependencies=[Depends(get_current_user)])


def _admin(user: models.User):
    if user.role != "admin":
        raise HTTPException(403, "Apenas administradores podem configurar o Instagram.")


def _client(db: Session, client_id: int) -> models.Client:
    c = db.query(models.Client).get(client_id)
    if not c:
        raise HTTPException(404, "Cliente não encontrado.")
    return c


def _save_secret(db: Session, client_id: int, name: str, value: str):
    row = db.query(models.ClientSecret).filter(
        models.ClientSecret.client_id == client_id, models.ClientSecret.name == name).first()
    if not row:
        row = models.ClientSecret(client_id=client_id, name=name)
        db.add(row)
    row.encrypted_value = vault.encrypt(value)
    row.last4 = vault.last4(value)


class TokenIn(BaseModel):
    access_token: str


class ConnectIn(BaseModel):
    access_token: str
    instagram_business_id: str
    exchange_long_lived: bool = False


class CarouselIn(BaseModel):
    media_asset_ids: list[int]
    caption: str
    first_comment: str | None = None


@router.post("/validate-token")
def validate_token(client_id: int, payload: TokenIn,
                   db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    """Valida o token e lista as Páginas + Instagram Business IDs (auto-descoberta)."""
    _admin(user)
    _client(db, client_id)
    result = graph_api.validate_and_list_accounts(payload.access_token.strip())
    if not result["ok"]:
        raise HTTPException(400, f"Token inválido: {result['error']}")
    return result


@router.post("/connect")
def connect(client_id: int, payload: ConnectIn,
            db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    """Salva token + Business ID no Cofre e ativa o modo Graph no contrato."""
    _admin(user)
    client = _client(db, client_id)
    token = payload.access_token.strip()

    if payload.exchange_long_lived:
        ex = graph_api.exchange_long_lived_token(token)
        if ex["ok"] and ex.get("access_token"):
            token = ex["access_token"]
        else:
            raise HTTPException(400, f"Falha ao gerar token de longa duração: {ex.get('error')}")

    # confirma a conexão antes de salvar
    test = graph_api.test_connection(token, payload.instagram_business_id)
    if not test["ok"]:
        raise HTTPException(400, f"Não foi possível conectar: {test.get('error')}")

    _save_secret(db, client_id, "instagram_access_token", token)
    _save_secret(db, client_id, "instagram_business_id", payload.instagram_business_id)
    if client.contract:
        client.contract.integration_mode = "instagram_graph"
    db.commit()
    return {"ok": True, "connected_as": test.get("username"), "name": test.get("name"),
            "long_lived": payload.exchange_long_lived}


@router.get("/test")
def test(client_id: int, db: Session = Depends(get_db)):
    """Testa a conexão usando as credenciais salvas no Cofre."""
    _client(db, client_id)
    token = get_secret_value(db, client_id, "instagram_access_token")
    ig_id = get_secret_value(db, client_id, "instagram_business_id")
    if not token or not ig_id:
        return {"ok": False, "error": "Instagram não conectado (configure o token e o Business ID)."}
    return graph_api.test_connection(token, ig_id)


@router.post("/publish-carousel")
def publish_carousel(client_id: int, payload: CarouselIn,
                     db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    """Publica um carrossel (2 a 10 imagens) com as mídias selecionadas."""
    _admin(user)
    client = _client(db, client_id)
    if not (2 <= len(payload.media_asset_ids) <= 10):
        raise HTTPException(400, "Selecione de 2 a 10 imagens.")

    assets = db.query(models.MediaAsset).filter(
        models.MediaAsset.client_id == client_id,
        models.MediaAsset.id.in_(payload.media_asset_ids),
        models.MediaAsset.media_type == "photo",
    ).all()
    if len(assets) < 2:
        raise HTTPException(400, "Carrossel precisa de pelo menos 2 fotos válidas.")

    # mantém a ordem escolhida
    by_id = {a.id: a for a in assets}
    ordered = [by_id[i] for i in payload.media_asset_ids if i in by_id]
    image_urls = [graph_api.public_media_url(a) for a in ordered]

    contract = client.contract
    provider = get_instagram_provider(
        contract.integration_mode if contract else "mock",
        get_secret_value(db, client_id, "instagram_access_token"),
        get_secret_value(db, client_id, "instagram_business_id"),
    )
    result = provider.publish_carousel(image_urls, payload.caption, payload.first_comment)
    return {"ok": result.ok, "external_post_id": result.external_post_id, "detail": result.detail}
