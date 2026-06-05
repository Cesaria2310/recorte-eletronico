"""Interface abstrata de provedor de IA.

Cada contrato escolhe um provedor (claude | mock). A factory resolve a
implementação. Assim novos provedores (OpenAI, etc.) podem ser plugados sem
mexer no restante do código.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class ProfileAnalysis:
    summary: str
    themes: list[str] = field(default_factory=list)


@dataclass
class Competitor:
    handle: str
    followers: int
    themes: list[str] = field(default_factory=list)
    relevance: str = ""


@dataclass
class Topic:
    title: str
    description: str
    source: str  # internet | instagram
    engagement_score: float
    related_handles: list[str] = field(default_factory=list)


@dataclass
class GeneratedPost:
    caption: str
    hashtags: list[str]
    first_comment: str
    call_to_action: str


class AIProvider(ABC):
    """Contrato que todo provedor de IA deve cumprir."""

    @abstractmethod
    def analyze_profile(self, handle: str, bio: str, themes: list[str]) -> ProfileAnalysis:
        ...

    @abstractmethod
    def find_competitors(self, analysis: ProfileAnalysis, themes: list[str]) -> list[Competitor]:
        ...

    @abstractmethod
    def trending_topics(self, themes: list[str], competitors: list[Competitor]) -> list[Topic]:
        ...

    @abstractmethod
    def generate_post(self, topic_title: str, topic_desc: str, media_desc: str, themes: list[str]) -> GeneratedPost:
        ...
