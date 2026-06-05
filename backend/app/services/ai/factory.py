"""Factory de provedor de IA — resolve a implementação conforme o contrato."""
from .base import AIProvider
from .mock_provider import MockAIProvider
from .claude_provider import ClaudeAIProvider


def get_ai_provider(provider: str, api_key: str | None = None) -> AIProvider:
    if provider == "claude":
        return ClaudeAIProvider(api_key=api_key)
    return MockAIProvider()
