"""Schemas Pydantic (entrada/saída da API)."""
from datetime import datetime, date
from typing import Optional
from pydantic import BaseModel, EmailStr, ConfigDict


# ---------- Auth ----------
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserCreate(BaseModel):
    email: EmailStr
    name: str
    password: str
    role: str = "admin"


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    email: str
    name: str
    role: str


# ---------- Contrato ----------
# Observação: tokens/chaves NÃO ficam no contrato — vão para o Cofre (vault),
# criptografados. Aqui só configurações não-sensíveis.
class ContractIn(BaseModel):
    integration_mode: str = "mock"            # mock | instagram_graph
    ai_provider: str = "claude"               # claude | mock
    auto_post_when_approved: bool = True
    posts_per_day_limit: int = 1


class ContractOut(ContractIn):
    model_config = ConfigDict(from_attributes=True)
    id: int
    client_id: int
    updated_at: datetime


# ---------- Cofre de chaves ----------
class SecretIn(BaseModel):
    value: str


class SecretOut(BaseModel):
    """Nunca expõe o valor — apenas se está configurado e a máscara."""
    name: str
    label: str
    configured: bool
    masked: Optional[str] = None
    updated_at: Optional[datetime] = None


# ---------- Cliente ----------
class ClientCreate(BaseModel):
    name: str
    instagram_handle: str
    email: Optional[EmailStr] = None
    bio: Optional[str] = None
    themes: list[str] = []
    contract: ContractIn = ContractIn()


class ClientUpdate(BaseModel):
    name: Optional[str] = None
    instagram_handle: Optional[str] = None
    email: Optional[EmailStr] = None
    bio: Optional[str] = None
    themes: Optional[list[str]] = None
    status: Optional[str] = None


class ClientOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    instagram_handle: str
    email: Optional[str]
    bio: Optional[str]
    themes: list[str]
    status: str
    created_at: datetime
    contract: Optional[ContractOut] = None


# ---------- Mídia ----------
class MediaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    client_id: int
    media_type: str
    original_name: str
    url: str
    description: Optional[str]
    tags: list[str]
    created_at: datetime


# ---------- Campanha / fluxo ----------
class CompetitorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    handle: str
    followers: int
    themes: list[str]
    relevance: Optional[str]


class TopicOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    title: str
    description: Optional[str]
    source: str
    engagement_score: float
    related_handles: list[str]
    selected: bool


class DraftOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    campaign_id: int
    media_asset_id: Optional[int]
    topic_id: Optional[int]
    version: int
    caption: str
    hashtags: list[str]
    first_comment: Optional[str]
    call_to_action: Optional[str]
    status: str
    feedback: Optional[str]
    rendered_video_url: Optional[str] = None
    external_post_id: Optional[str]
    posted_at: Optional[datetime]


class CampaignOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    client_id: int
    status: str
    analysis_summary: Optional[str]
    detected_themes: list[str]
    selected_topic_id: Optional[int]
    next_resume_date: Optional[date]
    created_at: datetime
    updated_at: datetime
    competitors: list[CompetitorOut] = []
    topics: list[TopicOut] = []
    drafts: list[DraftOut] = []


# ---------- Ações do fluxo ----------
class SelectTopicIn(BaseModel):
    topic_id: int
    media_asset_id: Optional[int] = None  # opcional; se omitido o app escolhe a melhor mídia


class ApprovalIn(BaseModel):
    approved: bool
    feedback: Optional[str] = None


class RejectDecisionIn(BaseModel):
    # quando reprovado, o que fazer:
    decision: str  # redo_post | select_other_topic | pause
    topic_id: Optional[int] = None  # usado em select_other_topic
    feedback: Optional[str] = None
