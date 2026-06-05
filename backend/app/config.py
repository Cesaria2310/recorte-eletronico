"""Configuração central da aplicação.

Todas as chaves sensíveis vêm de variáveis de ambiente. Nada de segredos no
código. Veja .env.example para a lista de variáveis suportadas.
"""
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # App
    app_name: str = "Recorte Eletrônico"
    secret_key: str = "troque-isto-em-producao"
    access_token_expire_minutes: int = 60 * 24
    database_url: str = "sqlite:///./recorte.db"

    # Cofre de chaves: chave-mestra Fernet (base64 url-safe de 32 bytes).
    # Se vazia, é derivada da secret_key (apenas dev). Em produção defina VAULT_KEY.
    vault_key: str = ""

    # Armazenamento de mídia
    upload_dir: str = "uploads"
    max_upload_mb: int = 200

    # Provedores de IA (configuráveis por contrato; estes são os defaults globais)
    default_ai_provider: str = "claude"  # claude | mock
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-opus-4-8"

    # Instagram (configurável por contrato; default global)
    default_integration_mode: str = "mock"  # mock | instagram_graph
    instagram_graph_base: str = "https://graph.facebook.com/v21.0"
    instagram_api_version: str = "v21.0"
    # URL pública do backend (a Graph API precisa baixar a mídia por uma URL pública)
    public_base_url: str = "http://localhost:8000"
    # Como expor a mídia para a Meta: "backend" (public_base_url + /media) ou
    # "catbox" (sobe o arquivo para catbox.moe e usa a URL pública gerada).
    instagram_public_host: str = "backend"  # backend | catbox
    # App da Meta (para trocar por token de longa duração, opcional)
    instagram_app_id: str = ""
    instagram_app_secret: str = ""

    # Uso/custo do Claude (estimativas configuráveis, USD por 1M tokens).
    claude_input_per_mtok: float = 5.0
    claude_output_per_mtok: float = 25.0
    claude_daily_token_budget: int = 1_000_000  # usado na barra do widget

    # Edição de vídeo (Remotion). Caminho do workspace e Chromium opcional.
    video_dir: str = "../video"                 # pasta do workspace Remotion
    remotion_browser_executable: str = ""        # ex.: /tmp/chromium (Chromium já instalado)
    video_render_timeout_s: int = 600

    # Monitor de uso do Claude Code (porta da rotina "claudeusagestick"/bridge).
    # Lê os JSONL de sessões do Claude Code. Vazio => ~/.claude/projects.
    claude_projects_dir: str = ""
    claude_plan_5h_limit_usd: float = 35.0     # limite da janela de 5h do plano
    claude_monthly_budget_usd: float = 200.0   # orçamento mensal de referência


@lru_cache
def get_settings() -> Settings:
    return Settings()
