"""Cofre de chaves — criptografia simétrica para segredos por cliente.

As chaves de API (Anthropic, token/Business ID do Instagram) NUNCA ficam no
código nem em texto puro no banco: são guardadas **criptografadas** (Fernet/AES)
e só retornam **mascaradas** ao dashboard. Podem ser trocadas ou deletadas.

A chave-mestra vem de VAULT_KEY (env). Se ausente, é derivada da SECRET_KEY
(apenas para desenvolvimento — em produção defina VAULT_KEY).
"""
import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken

from .config import get_settings

settings = get_settings()

# Nomes de segredos permitidos no cofre (whitelist).
ALLOWED_SECRETS = {
    "anthropic_api_key": "Chave de API da Anthropic (Claude)",
    "instagram_access_token": "Access Token do Instagram (Graph API)",
    "instagram_business_id": "ID da conta Business do Instagram",
}


def _fernet() -> Fernet:
    if settings.vault_key:
        key = settings.vault_key.encode()
    else:
        # Deriva uma chave Fernet válida a partir da SECRET_KEY (dev only).
        digest = hashlib.sha256(settings.secret_key.encode()).digest()
        key = base64.urlsafe_b64encode(digest)
    return Fernet(key)


def encrypt(value: str) -> str:
    return _fernet().encrypt(value.encode()).decode()


def decrypt(token: str) -> str | None:
    try:
        return _fernet().decrypt(token.encode()).decode()
    except (InvalidToken, Exception):  # noqa: BLE001
        return None


def mask(value: str) -> str:
    """Mascara o valor, revelando apenas os últimos 4 caracteres."""
    if not value:
        return ""
    if len(value) <= 4:
        return "•" * len(value)
    return "••••" + value[-4:]


def last4(value: str) -> str:
    return value[-4:] if value and len(value) >= 4 else ""
