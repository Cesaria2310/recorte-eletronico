"""Helpers da Meta Graph API — descoberta de conta, teste e hospedagem de mídia.

Incorpora as boas ideias da skill setup-instagram, porém guardando as
credenciais no Cofre criptografado (não em .env solto):
  - validate_and_list_accounts: dado um token, lista as Páginas e seus
    Instagram Business accounts (auto-descoberta do Business ID);
  - test_connection: confirma a conexão e retorna o @username;
  - exchange_long_lived_token: troca por token de longa duração (~60 dias);
  - public_media_url / upload_to_catbox: garante uma URL pública da mídia,
    necessária para a Graph API conseguir baixá-la.
"""
import os

import httpx

from ...config import get_settings

settings = get_settings()


def _base() -> str:
    return f"https://graph.facebook.com/{settings.instagram_api_version}"


def validate_and_list_accounts(access_token: str) -> dict:
    """Valida o token e lista Páginas + Instagram Business accounts vinculados.

    Retorna {"ok": bool, "accounts": [...], "error": str|None}.
    Cada account: {page_id, page_name, instagram_business_id, username}.
    """
    try:
        with httpx.Client(timeout=30) as client:
            r = client.get(
                f"{_base()}/me/accounts",
                params={
                    "fields": "id,name,instagram_business_account",
                    "access_token": access_token,
                },
            )
            data = r.json()
            if "error" in data:
                return {"ok": False, "accounts": [], "error": data["error"].get("message", "erro")}

            accounts = []
            for page in data.get("data", []):
                iba = page.get("instagram_business_account") or {}
                ig_id = iba.get("id")
                username = None
                if ig_id:
                    ur = client.get(
                        f"{_base()}/{ig_id}",
                        params={"fields": "username,name", "access_token": access_token},
                    )
                    username = ur.json().get("username")
                accounts.append({
                    "page_id": page.get("id"),
                    "page_name": page.get("name"),
                    "instagram_business_id": ig_id,
                    "username": username,
                })
            return {"ok": True, "accounts": accounts, "error": None}
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "accounts": [], "error": str(e)}


def test_connection(access_token: str, instagram_business_id: str) -> dict:
    """Confirma a conexão com a conta e retorna id/username/name."""
    if not access_token or not instagram_business_id:
        return {"ok": False, "error": "Token ou Business ID ausentes."}
    try:
        with httpx.Client(timeout=20) as client:
            r = client.get(
                f"{_base()}/{instagram_business_id}",
                params={"fields": "id,username,name", "access_token": access_token},
            )
            data = r.json()
            if "error" in data:
                return {"ok": False, "error": data["error"].get("message", "erro")}
            return {"ok": True, "id": data.get("id"), "username": data.get("username"),
                    "name": data.get("name")}
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "error": str(e)}


def exchange_long_lived_token(access_token: str) -> dict:
    """Troca o token curto por um de longa duração (~60 dias).

    Requer instagram_app_id e instagram_app_secret configurados.
    """
    if not settings.instagram_app_id or not settings.instagram_app_secret:
        return {"ok": False, "error": "App ID/Secret da Meta não configurados."}
    try:
        with httpx.Client(timeout=20) as client:
            r = client.get(
                f"{_base()}/oauth/access_token",
                params={
                    "grant_type": "fb_exchange_token",
                    "client_id": settings.instagram_app_id,
                    "client_secret": settings.instagram_app_secret,
                    "fb_exchange_token": access_token,
                },
            )
            data = r.json()
            if "error" in data:
                return {"ok": False, "error": data["error"].get("message", "erro")}
            return {"ok": True, "access_token": data.get("access_token"),
                    "expires_in": data.get("expires_in")}
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "error": str(e)}


def upload_to_catbox(file_path: str) -> str | None:
    """Hospeda um arquivo no catbox.moe e retorna a URL pública (ou None)."""
    try:
        with open(file_path, "rb") as f:
            with httpx.Client(timeout=120) as client:
                r = client.post(
                    "https://catbox.moe/user/api.php",
                    data={"reqtype": "fileupload"},
                    files={"fileToUpload": (os.path.basename(file_path), f)},
                )
        url = r.text.strip()
        return url if url.startswith("https://") else None
    except Exception:  # noqa: BLE001
        return None


def public_media_url(media) -> str:
    """Garante uma URL pública para a mídia (a Graph API precisa baixá-la)."""
    if settings.instagram_public_host == "catbox" and media and media.stored_path \
            and os.path.exists(media.stored_path):
        url = upload_to_catbox(media.stored_path)
        if url:
            return url
    # fallback: servir pelo próprio backend (precisa ser acessível pela Meta)
    rel = media.url if media else ""
    return settings.public_base_url.rstrip("/") + rel
