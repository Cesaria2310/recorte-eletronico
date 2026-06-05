"""Modelos do banco de dados.

Entidades principais:
  - User: usuário de acesso ao dashboard (admin ou operador/cliente)
  - Client: o perfil/cliente contratado cujo Instagram será gerenciado
  - Contract: configurações por contrato (modo de integração, provedor de IA, tokens)
  - MediaAsset: vídeos e fotos armazenados para o cliente
  - Campaign: uma sessão/atendimento que passa pela máquina de estados
  - CompetitorProfile: perfis concorrentes com mais seguidores no mesmo tema
  - TopicSuggestion: assuntos mais comentados sugeridos ao cliente
  - PostDraft: post montado (mídia + legenda + hashtags + comentário) p/ aprovação
"""
from datetime import datetime, date

from sqlalchemy import (
    Column, Integer, String, Text, DateTime, Date, Boolean, ForeignKey, Float, JSON,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from .database import Base


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    email = Column(String, unique=True, nullable=False, index=True)
    name = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="admin")  # admin | operator
    created_at = Column(DateTime, default=datetime.utcnow)


class Client(Base):
    __tablename__ = "clients"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    instagram_handle = Column(String, nullable=False)
    email = Column(String, nullable=True)
    bio = Column(Text, nullable=True)
    # temas/nichos do cliente (lista de strings)
    themes = Column(JSON, default=list)
    status = Column(String, default="active")  # active | paused | inactive
    created_at = Column(DateTime, default=datetime.utcnow)

    contract = relationship("Contract", back_populates="client", uselist=False, cascade="all, delete-orphan")
    media = relationship("MediaAsset", back_populates="client", cascade="all, delete-orphan")
    campaigns = relationship("Campaign", back_populates="client", cascade="all, delete-orphan")
    secrets = relationship("ClientSecret", back_populates="client", cascade="all, delete-orphan")


class ClientSecret(Base):
    """Segredo criptografado do cofre (uma chave por nome, por cliente)."""
    __tablename__ = "client_secrets"
    __table_args__ = (UniqueConstraint("client_id", "name", name="uq_client_secret"),)
    id = Column(Integer, primary_key=True)
    client_id = Column(Integer, ForeignKey("clients.id"))
    name = Column(String, nullable=False)            # ex.: anthropic_api_key
    encrypted_value = Column(Text, nullable=False)   # valor cifrado (nunca em texto puro)
    last4 = Column(String, nullable=True)            # últimos 4 chars para exibição mascarada
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    client = relationship("Client", back_populates="secrets")


class Contract(Base):
    """Configuração por contrato — o admin escolhe e pode mudar a qualquer momento."""
    __tablename__ = "contracts"
    id = Column(Integer, primary_key=True)
    client_id = Column(Integer, ForeignKey("clients.id"), unique=True)

    # Integração Instagram: mock | instagram_graph
    integration_mode = Column(String, default="mock")
    instagram_access_token = Column(String, nullable=True)
    instagram_business_id = Column(String, nullable=True)

    # IA: claude | mock
    ai_provider = Column(String, default="claude")

    # Regras do contrato
    auto_post_when_approved = Column(Boolean, default=True)
    posts_per_day_limit = Column(Integer, default=1)

    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    client = relationship("Client", back_populates="contract")


class MediaAsset(Base):
    __tablename__ = "media_assets"
    id = Column(Integer, primary_key=True)
    client_id = Column(Integer, ForeignKey("clients.id"))
    media_type = Column(String, nullable=False)  # photo | video
    original_name = Column(String, nullable=False)
    stored_path = Column(String, nullable=False)
    url = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    tags = Column(JSON, default=list)
    created_at = Column(DateTime, default=datetime.utcnow)

    client = relationship("Client", back_populates="media")


class Campaign(Base):
    """Um atendimento/sessão que percorre a máquina de estados do fluxo."""
    __tablename__ = "campaigns"
    id = Column(Integer, primary_key=True)
    client_id = Column(Integer, ForeignKey("clients.id"))
    # Estados:
    # created -> analyzed -> topics_ready -> topic_selected -> draft_ready
    #   -> pending_approval -> approved -> posted
    #   (rejeição volta para topics_ready/draft_ready ou vai para paused)
    status = Column(String, default="created")
    analysis_summary = Column(Text, nullable=True)
    detected_themes = Column(JSON, default=list)
    selected_topic_id = Column(Integer, nullable=True)
    next_resume_date = Column(Date, nullable=True)  # quando pausado, retorna no dia seguinte
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    client = relationship("Client", back_populates="campaigns")
    competitors = relationship("CompetitorProfile", back_populates="campaign", cascade="all, delete-orphan")
    topics = relationship("TopicSuggestion", back_populates="campaign", cascade="all, delete-orphan")
    drafts = relationship("PostDraft", back_populates="campaign", cascade="all, delete-orphan")


class CompetitorProfile(Base):
    """Perfil concorrente com mais seguidores no mesmo tema."""
    __tablename__ = "competitor_profiles"
    id = Column(Integer, primary_key=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"))
    handle = Column(String, nullable=False)
    followers = Column(Integer, default=0)
    themes = Column(JSON, default=list)
    relevance = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    campaign = relationship("Campaign", back_populates="competitors")


class TopicSuggestion(Base):
    """Assunto mais comentado (internet + instagram) sugerido ao cliente."""
    __tablename__ = "topic_suggestions"
    id = Column(Integer, primary_key=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"))
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    source = Column(String, default="instagram")  # internet | instagram
    engagement_score = Column(Float, default=0.0)
    related_handles = Column(JSON, default=list)
    selected = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    campaign = relationship("Campaign", back_populates="topics")


class PostDraft(Base):
    """Post montado para aprovação do cliente."""
    __tablename__ = "post_drafts"
    id = Column(Integer, primary_key=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"))
    media_asset_id = Column(Integer, ForeignKey("media_assets.id"), nullable=True)
    topic_id = Column(Integer, nullable=True)
    version = Column(Integer, default=1)
    caption = Column(Text, nullable=False)
    hashtags = Column(JSON, default=list)
    first_comment = Column(Text, nullable=True)  # "bons comentários" + CTA seguir/direct
    call_to_action = Column(Text, nullable=True)
    status = Column(String, default="pending_approval")  # pending_approval | approved | rejected | posted
    feedback = Column(Text, nullable=True)
    rendered_video_url = Column(String, nullable=True)  # mp4 montado pelo Remotion
    external_post_id = Column(String, nullable=True)
    posted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    campaign = relationship("Campaign", back_populates="drafts")
    media_asset = relationship("MediaAsset")


class UsageEvent(Base):
    """Registro de consumo de IA (para o widget de uso do Claude)."""
    __tablename__ = "usage_events"
    id = Column(Integer, primary_key=True)
    provider = Column(String, default="claude")
    model = Column(String, nullable=True)
    input_tokens = Column(Integer, default=0)
    output_tokens = Column(Integer, default=0)
    cost_usd = Column(Float, default=0.0)
    client_id = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
