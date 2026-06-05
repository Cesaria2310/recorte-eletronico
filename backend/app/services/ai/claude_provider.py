"""Provedor de IA usando a API da Anthropic (Claude).

Requer ANTHROPIC_API_KEY. Em qualquer falha (sem chave, erro de rede, JSON
inválido), cai graciosamente para o MockAIProvider para não quebrar o fluxo.
"""
import json

from ...config import get_settings
from .base import AIProvider, ProfileAnalysis, Competitor, Topic, GeneratedPost
from .mock_provider import MockAIProvider

settings = get_settings()


def _extract_json(text: str):
    """Extrai o primeiro bloco JSON de uma resposta do modelo."""
    text = text.strip()
    start = text.find("{")
    start_arr = text.find("[")
    if start_arr != -1 and (start == -1 or start_arr < start):
        start = start_arr
    end = max(text.rfind("}"), text.rfind("]"))
    if start == -1 or end == -1:
        raise ValueError("sem JSON na resposta")
    return json.loads(text[start : end + 1])


class ClaudeAIProvider(AIProvider):
    def __init__(self, api_key: str | None = None):
        # Chave vem do cofre do cliente; cai para o default global se ausente.
        self._fallback = MockAIProvider()
        self._client = None
        key = api_key or settings.anthropic_api_key
        if key:
            try:
                from anthropic import Anthropic
                self._client = Anthropic(api_key=key)
            except Exception:
                self._client = None

    def _complete(self, system: str, prompt: str) -> str:
        if not self._client:
            raise RuntimeError("Claude indisponível")
        msg = self._client.messages.create(
            model=settings.anthropic_model,
            max_tokens=1500,
            system=system,
            messages=[{"role": "user", "content": prompt}],
        )
        # telemetria de uso (para o widget de consumo do Claude)
        try:
            from ..usage import record_usage
            record_usage("claude", settings.anthropic_model,
                         msg.usage.input_tokens, msg.usage.output_tokens)
        except Exception:  # noqa: BLE001
            pass
        return "".join(block.text for block in msg.content if getattr(block, "type", None) == "text")

    def analyze_profile(self, handle: str, bio: str, themes: list[str]) -> ProfileAnalysis:
        try:
            system = "Você é um estrategista de redes sociais. Responda SOMENTE com JSON."
            prompt = (
                f"Analise o perfil de Instagram @{handle}. Bio: '{bio or ''}'. "
                f"Temas informados: {themes}. Retorne JSON: "
                '{"summary": "resumo do perfil e do público", "themes": ["tema1","tema2"]}'
            )
            data = _extract_json(self._complete(system, prompt))
            return ProfileAnalysis(summary=data["summary"], themes=data.get("themes", themes))
        except Exception:
            return self._fallback.analyze_profile(handle, bio, themes)

    def find_competitors(self, analysis: ProfileAnalysis, themes: list[str]) -> list[Competitor]:
        try:
            system = "Você é analista de concorrência no Instagram. Responda SOMENTE com JSON."
            prompt = (
                f"Com base nesta análise: '{analysis.summary}' e temas {analysis.themes or themes}, "
                "liste 5 perfis de Instagram reais/plausíveis com MAIS seguidores no mesmo nicho. "
                'Retorne JSON array: [{"handle":"","followers":0,"themes":[],"relevance":""}] '
                "ordenado do maior para o menor número de seguidores."
            )
            data = _extract_json(self._complete(system, prompt))
            return [
                Competitor(
                    handle=c["handle"].lstrip("@"),
                    followers=int(c.get("followers", 0)),
                    themes=c.get("themes", []),
                    relevance=c.get("relevance", ""),
                )
                for c in data
            ]
        except Exception:
            return self._fallback.find_competitors(analysis, themes)

    def trending_topics(self, themes: list[str], competitors: list[Competitor]) -> list[Topic]:
        try:
            system = "Você é especialista em tendências do Instagram. Responda SOMENTE com JSON."
            handles = [c.handle for c in competitors]
            prompt = (
                f"Temas: {themes}. Perfis de referência: {handles}. "
                "Liste os 5 assuntos MAIS COMENTADOS na internet e no Instagram para esse nicho. "
                'Retorne JSON array: [{"title":"","description":"","source":"internet|instagram",'
                '"engagement_score":0,"related_handles":[]}] ordenado por engagement_score desc.'
            )
            data = _extract_json(self._complete(system, prompt))
            return [
                Topic(
                    title=t["title"],
                    description=t.get("description", ""),
                    source=t.get("source", "instagram"),
                    engagement_score=float(t.get("engagement_score", 0)),
                    related_handles=t.get("related_handles", []),
                )
                for t in data
            ]
        except Exception:
            return self._fallback.trending_topics(themes, competitors)

    def generate_post(self, topic_title: str, topic_desc: str, media_desc: str, themes: list[str]) -> GeneratedPost:
        try:
            system = (
                "Você é redator de social media especialista em engajamento no Instagram. "
                "Escreva em português do Brasil. Responda SOMENTE com JSON."
            )
            prompt = (
                f"Crie um post sobre '{topic_title}' ({topic_desc}). "
                f"Mídia selecionada: {media_desc}. Temas: {themes}. "
                "A legenda deve usar as melhores tendências do Instagram, ter bons comentários sobre o tema, "
                "e SEMPRE pedir para seguir nas redes e mandar um direct para mais informações. "
                'Retorne JSON: {"caption":"","hashtags":["#..."],"first_comment":"","call_to_action":""}'
            )
            data = _extract_json(self._complete(system, prompt))
            return GeneratedPost(
                caption=data["caption"],
                hashtags=data.get("hashtags", []),
                first_comment=data.get("first_comment", ""),
                call_to_action=data.get("call_to_action", ""),
            )
        except Exception:
            return self._fallback.generate_post(topic_title, topic_desc, media_desc, themes)
