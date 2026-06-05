"""Interface abstrata de integração com Instagram.

Dois modos plugáveis por contrato:
  - mock: simula publicação e leitura de perfil (dev/demo)
  - instagram_graph: usa a API oficial (Graph API) — apenas o que ela permite:
    publicar em conta Business/Creator e ler métricas próprias.

IMPORTANTE (limitações reais): a API oficial NÃO permite login por senha do
usuário nem extrair dados de perfis de concorrentes. A descoberta de
concorrentes/assuntos é feita pela camada de IA, não por scraping.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class PublishResult:
    ok: bool
    external_post_id: str | None
    detail: str


class InstagramProvider(ABC):
    @abstractmethod
    def publish(self, media_url: str, media_type: str, caption: str, first_comment: str | None) -> PublishResult:
        ...

    @abstractmethod
    def publish_carousel(self, image_urls: list[str], caption: str, first_comment: str | None) -> PublishResult:
        """Publica um carrossel (2 a 10 imagens)."""
        ...
