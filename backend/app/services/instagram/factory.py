"""Factory de integração Instagram — resolve conforme o contrato do cliente."""
from .base import InstagramProvider
from .mock_provider import MockInstagramProvider
from .graph_provider import GraphInstagramProvider


def get_instagram_provider(mode: str, access_token=None, business_id=None) -> InstagramProvider:
    if mode == "instagram_graph":
        return GraphInstagramProvider(access_token, business_id)
    return MockInstagramProvider()
