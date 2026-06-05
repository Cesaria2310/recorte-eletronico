"""Provedor Instagram via Graph API oficial (conta Business/Creator).

Fluxo de publicação da Graph API:
  1) POST /{ig-user-id}/media          -> cria container (image_url ou video_url)
  2) (vídeo) aguardar status do container ficar FINISHED
  3) POST /{ig-user-id}/media_publish  -> publica o container
  4) (opcional) POST /{media-id}/comments -> fixa o primeiro comentário/CTA

Requer instagram_access_token e instagram_business_id no contrato. A media_url
precisa ser publicamente acessível pela Meta (em produção, sirva /media por uma
URL pública ou um bucket).
"""
import time

import httpx

from ...config import get_settings
from .base import InstagramProvider, PublishResult

settings = get_settings()


class GraphInstagramProvider(InstagramProvider):
    def __init__(self, access_token: str | None, business_id: str | None):
        self.token = access_token
        self.business_id = business_id
        self.base = settings.instagram_graph_base

    def publish(self, media_url: str, media_type: str, caption: str, first_comment: str | None) -> PublishResult:
        if not self.token or not self.business_id:
            return PublishResult(False, None, "Token/Business ID do Instagram ausentes no contrato.")
        try:
            with httpx.Client(timeout=60) as client:
                # 1) cria container
                create_params = {"caption": caption, "access_token": self.token}
                if media_type == "video":
                    create_params["media_type"] = "REELS"
                    create_params["video_url"] = media_url
                else:
                    create_params["image_url"] = media_url
                r = client.post(f"{self.base}/{self.business_id}/media", data=create_params)
                r.raise_for_status()
                container_id = r.json()["id"]

                # 2) vídeo precisa terminar o processamento
                if media_type == "video":
                    for _ in range(20):
                        s = client.get(
                            f"{self.base}/{container_id}",
                            params={"fields": "status_code", "access_token": self.token},
                        )
                        if s.json().get("status_code") == "FINISHED":
                            break
                        time.sleep(3)

                # 3) publica
                p = client.post(
                    f"{self.base}/{self.business_id}/media_publish",
                    data={"creation_id": container_id, "access_token": self.token},
                )
                p.raise_for_status()
                media_id = p.json()["id"]

                # 4) primeiro comentário (CTA)
                if first_comment:
                    client.post(
                        f"{self.base}/{media_id}/comments",
                        data={"message": first_comment, "access_token": self.token},
                    )
                return PublishResult(True, media_id, "Publicado via Instagram Graph API.")
        except httpx.HTTPStatusError as e:
            return PublishResult(False, None, f"Erro da Graph API: {e.response.text}")
        except Exception as e:  # noqa: BLE001
            return PublishResult(False, None, f"Falha ao publicar: {e}")

    def publish_carousel(self, image_urls: list[str], caption: str, first_comment: str | None) -> PublishResult:
        if not self.token or not self.business_id:
            return PublishResult(False, None, "Token/Business ID do Instagram ausentes no contrato.")
        if not (2 <= len(image_urls) <= 10):
            return PublishResult(False, None, "Carrossel exige de 2 a 10 imagens.")
        try:
            with httpx.Client(timeout=120) as client:
                # 1) cria um container por imagem (is_carousel_item)
                child_ids = []
                for url in image_urls:
                    r = client.post(f"{self.base}/{self.business_id}/media", data={
                        "image_url": url, "is_carousel_item": "true", "access_token": self.token,
                    })
                    r.raise_for_status()
                    child_ids.append(r.json()["id"])

                # 2) cria o container do carrossel
                p = client.post(f"{self.base}/{self.business_id}/media", data={
                    "media_type": "CAROUSEL", "children": ",".join(child_ids),
                    "caption": caption, "access_token": self.token,
                })
                p.raise_for_status()
                creation_id = p.json()["id"]

                # 3) aguarda processamento e publica
                for _ in range(12):
                    s = client.get(f"{self.base}/{creation_id}",
                                   params={"fields": "status_code", "access_token": self.token})
                    if s.json().get("status_code") == "FINISHED":
                        break
                    time.sleep(5)
                pub = client.post(f"{self.base}/{self.business_id}/media_publish",
                                  data={"creation_id": creation_id, "access_token": self.token})
                pub.raise_for_status()
                media_id = pub.json()["id"]

                if first_comment:
                    client.post(f"{self.base}/{media_id}/comments",
                                data={"message": first_comment, "access_token": self.token})
                return PublishResult(True, media_id, f"Carrossel ({len(child_ids)} imagens) publicado.")
        except httpx.HTTPStatusError as e:
            return PublishResult(False, None, f"Erro da Graph API: {e.response.text}")
        except Exception as e:  # noqa: BLE001
            return PublishResult(False, None, f"Falha ao publicar carrossel: {e}")
