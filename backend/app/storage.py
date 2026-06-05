"""Armazenamento de arquivos de mídia (vídeos e fotos) em disco local.

Em produção, troque por um bucket (S3/GCS) e gere URLs públicas — necessário
para a Graph API conseguir baixar a mídia.
"""
import os
import uuid

from .config import get_settings

settings = get_settings()

IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
VIDEO_EXT = {".mp4", ".mov", ".m4v", ".webm"}


def ensure_dir():
    os.makedirs(settings.upload_dir, exist_ok=True)


def detect_type(filename: str) -> str | None:
    ext = os.path.splitext(filename)[1].lower()
    if ext in IMAGE_EXT:
        return "photo"
    if ext in VIDEO_EXT:
        return "video"
    return None


def save_upload(client_id: int, filename: str, data: bytes) -> tuple[str, str]:
    """Salva o arquivo e retorna (caminho_no_disco, url_relativa)."""
    ensure_dir()
    ext = os.path.splitext(filename)[1].lower()
    stored_name = f"{client_id}_{uuid.uuid4().hex}{ext}"
    path = os.path.join(settings.upload_dir, stored_name)
    with open(path, "wb") as f:
        f.write(data)
    url = f"/media/{stored_name}"
    return path, url
