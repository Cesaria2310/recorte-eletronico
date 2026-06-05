"""Rotas de autenticação e gestão de usuários do dashboard."""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from .. import models, schemas, auth
from ..database import get_db

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=schemas.UserOut)
def register(payload: schemas.UserCreate, db: Session = Depends(get_db)):
    if db.query(models.User).filter(models.User.email == payload.email).first():
        raise HTTPException(400, "E-mail já cadastrado.")
    user = models.User(
        email=payload.email,
        name=payload.name,
        role=payload.role,
        hashed_password=auth.hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=schemas.Token)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == form.username).first()
    if not user or not auth.verify_password(form.password, user.hashed_password):
        raise HTTPException(401, "E-mail ou senha inválidos.")
    return schemas.Token(access_token=auth.create_access_token(user.email))


@router.get("/me", response_model=schemas.UserOut)
def me(current: models.User = Depends(auth.get_current_user)):
    return current
