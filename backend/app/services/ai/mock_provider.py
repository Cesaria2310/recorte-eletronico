"""Provedor de IA mock — gera resultados plausíveis sem chamadas externas.

Útil para desenvolvimento, demonstração e contratos sem chave de IA configurada.
Determinístico o suficiente para o fluxo funcionar de ponta a ponta.
"""
import random

from .base import AIProvider, ProfileAnalysis, Competitor, Topic, GeneratedPost


class MockAIProvider(AIProvider):
    def analyze_profile(self, handle: str, bio: str, themes: list[str]) -> ProfileAnalysis:
        base_themes = themes or ["lifestyle", "motivação", "negócios"]
        summary = (
            f"O perfil @{handle} comunica de forma autêntica em torno de {', '.join(base_themes)}. "
            f"Tom de voz próximo e inspirador. Público engajado em conteúdo prático e tendências. "
            f"Bio analisada: {bio or 'não informada'}."
        )
        return ProfileAnalysis(summary=summary, themes=base_themes)

    def find_competitors(self, analysis: ProfileAnalysis, themes: list[str]) -> list[Competitor]:
        themes = analysis.themes or themes or ["lifestyle"]
        names = ["top", "pro", "oficial", "br", "hub", "daily", "mentor", "lab"]
        competitors = []
        for i in range(5):
            t = random.choice(themes)
            competitors.append(
                Competitor(
                    handle=f"{t.replace(' ', '')}.{random.choice(names)}",
                    followers=random.randint(80_000, 2_500_000),
                    themes=themes,
                    relevance=f"Referência em {t}, alto engajamento e crescimento consistente.",
                )
            )
        competitors.sort(key=lambda c: c.followers, reverse=True)
        return competitors

    def trending_topics(self, themes: list[str], competitors: list[Competitor]) -> list[Topic]:
        themes = themes or ["lifestyle"]
        handles = [c.handle for c in competitors]
        templates = [
            ("5 erros que travam seu crescimento em {t}", "internet"),
            ("O que ninguém te conta sobre {t}", "instagram"),
            ("Tendência de {t} que está bombando esta semana", "instagram"),
            ("Passo a passo de {t} para iniciantes", "internet"),
            ("Bastidores: como aplicamos {t} na prática", "instagram"),
        ]
        topics = []
        for tpl, source in templates:
            t = random.choice(themes)
            topics.append(
                Topic(
                    title=tpl.format(t=t),
                    description=f"Assunto muito comentado sobre {t}, com forte apelo de engajamento.",
                    source=source,
                    engagement_score=round(random.uniform(60, 99), 1),
                    related_handles=random.sample(handles, min(2, len(handles))) if handles else [],
                )
            )
        topics.sort(key=lambda x: x.engagement_score, reverse=True)
        return topics

    def generate_post(self, topic_title: str, topic_desc: str, media_desc: str, themes: list[str]) -> GeneratedPost:
        tags = themes or ["lifestyle", "tendencia", "dicas"]
        hashtags = [f"#{t.replace(' ', '')}" for t in tags] + ["#tendencias", "#instabrasil", "#reels", "#viral"]
        caption = (
            f"✨ {topic_title}\n\n"
            f"{topic_desc} Salve este post e compartilhe com quem precisa ver! 👇\n\n"
            f"💬 Comenta aqui o que você achou."
        )
        cta = "Siga para mais conteúdos como este e, para mais informações, manda um direct! 📩"
        first_comment = (
            f"Curtiu? 🙌 {cta} "
            f"Quem aplicar essa dica de {topic_title.lower()} vai sair na frente!"
        )
        return GeneratedPost(
            caption=caption + "\n\n" + cta,
            hashtags=hashtags[:12],
            first_comment=first_comment,
            call_to_action=cta,
        )
