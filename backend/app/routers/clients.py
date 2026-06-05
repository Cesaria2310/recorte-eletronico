"""Cadastro e gestão de clientes (perfis gerenciados) e seus contratos."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import get_current_user
from ..database import get_db

router = APIRouter(prefix="/api/clients", tags=["clients"], dependencies=[Depends(get_current_user)])


@router.post("", response_model=schemas.ClientOut)
def create_client(payload: schemas.ClientCreate, db: Session = Depends(get_db)):
    client = models.Client(
        name=payload.name,
        instagram_handle=payload.instagram_handle.lstrip("@"),
        email=payload.email,
        bio=payload.bio,
        themes=payload.themes,
    )
    db.add(client)
    db.flush()
    c = payload.contract
    contract = models.Contract(
        client_id=client.id,
        integration_mode=c.integration_mode,
        ai_provider=c.ai_provider,
        auto_post_when_approved=c.auto_post_when_approved,
        posts_per_day_limit=c.posts_per_day_limit,
    )
    db.add(contract)
    db.commit()
    db.refresh(client)
    return client


@router.get("", response_model=list[schemas.ClientOut])
def list_clients(db: Session = Depends(get_db)):
    return db.query(models.Client).order_by(models.Client.created_at.desc()).all()


@router.get("/{client_id}", response_model=schemas.ClientOut)
def get_client(client_id: int, db: Session = Depends(get_db)):
    client = db.query(models.Client).get(client_id)
    if not client:
        raise HTTPException(404, "Cliente não encontrado.")
    return client


@router.patch("/{client_id}", response_model=schemas.ClientOut)
def update_client(client_id: int, payload: schemas.ClientUpdate, db: Session = Depends(get_db)):
    client = db.query(models.Client).get(client_id)
    if not client:
        raise HTTPException(404, "Cliente não encontrado.")
    for field, value in payload.model_dump(exclude_unset=True).items():
        if field == "instagram_handle" and value:
            value = value.lstrip("@")
        setattr(client, field, value)
    db.commit()
    db.refresh(client)
    return client


@router.put("/{client_id}/contract", response_model=schemas.ContractOut)
def update_contract(client_id: int, payload: schemas.ContractIn, db: Session = Depends(get_db)):
    """O administrador pode mudar modo de integração e provedor de IA por contrato."""
    client = db.query(models.Client).get(client_id)
    if not client:
        raise HTTPException(404, "Cliente não encontrado.")
    contract = client.contract
    if not contract:
        contract = models.Contract(client_id=client_id)
        db.add(contract)
    for field, value in payload.model_dump().items():
        setattr(contract, field, value)
    db.commit()
    db.refresh(contract)
    return contract


@router.delete("/{client_id}")
def delete_client(client_id: int, db: Session = Depends(get_db)):
    client = db.query(models.Client).get(client_id)
    if not client:
        raise HTTPException(404, "Cliente não encontrado.")
    db.delete(client)
    db.commit()
    return {"ok": True}
