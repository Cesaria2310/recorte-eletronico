"""Aplicação FastAPI — Recorte Eletrônico.

Sobe a API, serve a mídia estática e cria as tabelas. Na primeira execução,
cria um usuário admin a partir de ADMIN_EMAIL/ADMIN_PASSWORD (se definidos).
"""
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from . import models, auth
from .config import get_settings
from .database import Base, engine, SessionLocal
from .routers import auth as auth_router, clients, media, campaigns, secrets, usage, instagram
from .storage import ensure_dir

settings = get_settings()
Base.metadata.create_all(bind=engine)
ensure_dir()

app = FastAPI(title=settings.app_name, version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router)
app.include_router(clients.router)
app.include_router(media.router)
app.include_router(campaigns.router)
app.include_router(secrets.router)
app.include_router(usage.router)
app.include_router(instagram.router)

# serve os arquivos de mídia enviados
app.mount("/media", StaticFiles(directory=settings.upload_dir), name="media")


@app.on_event("startup")
def seed_admin():
    email = os.getenv("ADMIN_EMAIL")
    password = os.getenv("ADMIN_PASSWORD")
    if not email or not password:
        return
    db = SessionLocal()
    try:
        if not db.query(models.User).filter(models.User.email == email).first():
            db.add(models.User(
                email=email, name="Administrador", role="admin",
                hashed_password=auth.hash_password(password),
            ))
            db.commit()
    finally:
        db.close()


@app.get("/api/health")
def health():
    return {"status": "ok", "app": settings.app_name}
