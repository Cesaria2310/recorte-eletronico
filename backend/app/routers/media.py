"""Upload e gestão da biblioteca de mídia (vídeos e fotos) por cliente."""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session

from .. import models, schemas, storage
from ..auth import get_current_user
from ..config import get_settings
from ..database import get_db

settings = get_settings()
router = APIRouter(prefix="/api/clients/{client_id}/media", tags=["media"],
                   dependencies=[Depends(get_current_user)])


@router.post("", response_model=schemas.MediaOut)
async def upload_media(
    client_id: int,
    file: UploadFile = File(...),
    description: str = Form(""),
    tags: str = Form(""),  # csv
    db: Session = Depends(get_db),
):
    client = db.query(models.Client).get(client_id)
    if not client:
        raise HTTPException(404, "Cliente não encontrado.")

    media_type = storage.detect_type(file.filename)
    if not media_type:
        raise HTTPException(400, "Tipo de arquivo não suportado (use imagem ou vídeo).")

    data = await file.read()
    if len(data) > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(413, f"Arquivo acima de {settings.max_upload_mb}MB.")

    path, url = storage.save_upload(client_id, file.filename, data)
    asset = models.MediaAsset(
        client_id=client_id,
        media_type=media_type,
        original_name=file.filename,
        stored_path=path,
        url=url,
        description=description or None,
        tags=[t.strip() for t in tags.split(",") if t.strip()],
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return asset


@router.get("", response_model=list[schemas.MediaOut])
def list_media(client_id: int, db: Session = Depends(get_db)):
    return (db.query(models.MediaAsset)
            .filter(models.MediaAsset.client_id == client_id)
            .order_by(models.MediaAsset.created_at.desc()).all())


@router.delete("/{media_id}")
def delete_media(client_id: int, media_id: int, db: Session = Depends(get_db)):
    asset = db.query(models.MediaAsset).filter(
        models.MediaAsset.id == media_id,
        models.MediaAsset.client_id == client_id,
    ).first()
    if not asset:
        raise HTTPException(404, "Mídia não encontrada.")
    db.delete(asset)
    db.commit()
    return {"ok": True}
