"""Provedor Instagram mock — simula a publicação sem chamar API real."""
import uuid

from .base import InstagramProvider, PublishResult


class MockInstagramProvider(InstagramProvider):
    def publish(self, media_url: str, media_type: str, caption: str, first_comment: str | None) -> PublishResult:
        fake_id = f"mock_{uuid.uuid4().hex[:12]}"
        return PublishResult(
            ok=True,
            external_post_id=fake_id,
            detail=f"[MOCK] Publicado {media_type} com legenda ({len(caption)} chars). Comentário fixado: {bool(first_comment)}.",
        )

    def publish_carousel(self, image_urls: list[str], caption: str, first_comment: str | None) -> PublishResult:
        fake_id = f"mock_carousel_{uuid.uuid4().hex[:10]}"
        return PublishResult(
            ok=True,
            external_post_id=fake_id,
            detail=f"[MOCK] Carrossel publicado com {len(image_urls)} imagens.",
        )
