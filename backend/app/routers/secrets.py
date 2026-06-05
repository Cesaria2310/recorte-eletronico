"""Cofre de chaves por cliente — dentro do dashboard.

Segurança:
  - valores guardados **criptografados** (Fernet/AES), nunca em texto puro;
  - a API **nunca retorna** o valor — só `configured` + máscara (••••1234);
  - chaves podem ser **trocadas** (PUT) ou **canceladas/deletadas** (DELETE);
  - acesso somente autenticado (e, para gravar/apagar, restrito a admin).
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas, vault
from ..auth import get_current_user
from ..database import get_db

router = APIRouter(prefix="/api/clients/{client_id}/secrets", tags=["vault"],
                   dependencies=[Depends(get_current_user)])


def _require_admin(user: models.User):
    if user.role != "admin":
        raise HTTPException(403, "Apenas administradores podem alterar o cofre.")


def _get_client(db: Session, client_id: int) -> models.Client:
    client = db.query(models.Client).get(client_id)
    if not client:
        raise HTTPException(404, "Cliente não encontrado.")
    return client


def get_secret_value(db: Session, client_id: int, name: str) -> str | None:
    """Uso interno: retorna o valor descriptografado (ou None)."""
    row = db.query(models.ClientSecret).filter(
        models.ClientSecret.client_id == client_id,
        models.ClientSecret.name == name,
    ).first()
    if not row:
        return None
    return vault.decrypt(row.encrypted_value)


@router.get("", response_model=list[schemas.SecretOut])
def list_secrets(client_id: int, db: Session = Depends(get_db)):
    """Lista todos os slots do cofre com estado (configurado/máscara)."""
    _get_client(db, client_id)
    rows = {s.name: s for s in db.query(models.ClientSecret)
            .filter(models.ClientSecret.client_id == client_id).all()}
    out = []
    for name, label in vault.ALLOWED_SECRETS.items():
        row = rows.get(name)
        out.append(schemas.SecretOut(
            name=name,
            label=label,
            configured=row is not None,
            masked=("••••" + row.last4) if (row and row.last4) else ("••••" if row else None),
            updated_at=row.updated_at if row else None,
        ))
    return out


@router.put("/{name}", response_model=schemas.SecretOut)
def set_secret(client_id: int, name: str, payload: schemas.SecretIn,
               db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    """Cria ou troca o valor de uma chave (criptografada)."""
    _require_admin(user)
    _get_client(db, client_id)
    if name not in vault.ALLOWED_SECRETS:
        raise HTTPException(400, "Chave não permitida no cofre.")
    value = payload.value.strip()
    if not value:
        raise HTTPException(400, "Valor vazio.")

    row = db.query(models.ClientSecret).filter(
        models.ClientSecret.client_id == client_id,
        models.ClientSecret.name == name,
    ).first()
    if not row:
        row = models.ClientSecret(client_id=client_id, name=name)
        db.add(row)
    row.encrypted_value = vault.encrypt(value)
    row.last4 = vault.last4(value)
    db.commit()
    db.refresh(row)
    return schemas.SecretOut(
        name=name, label=vault.ALLOWED_SECRETS[name], configured=True,
        masked="••••" + (row.last4 or ""), updated_at=row.updated_at,
    )


@router.delete("/{name}")
def delete_secret(client_id: int, name: str,
                  db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    """Cancela/deleta uma chave do cofre."""
    _require_admin(user)
    _get_client(db, client_id)
    row = db.query(models.ClientSecret).filter(
        models.ClientSecret.client_id == client_id,
        models.ClientSecret.name == name,
    ).first()
    if not row:
        raise HTTPException(404, "Chave não configurada.")
    db.delete(row)
    db.commit()
    return {"ok": True, "deleted": name}
