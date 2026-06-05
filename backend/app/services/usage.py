"""Rastreio de consumo de IA (para o widget de uso do Claude no dashboard)."""
from datetime import datetime, date

from sqlalchemy import func

from ..config import get_settings
from ..database import SessionLocal
from .. import models

settings = get_settings()


def estimate_cost(input_tokens: int, output_tokens: int) -> float:
    return round(
        input_tokens / 1_000_000 * settings.claude_input_per_mtok
        + output_tokens / 1_000_000 * settings.claude_output_per_mtok,
        6,
    )


def record_usage(provider: str, model: str, input_tokens: int, output_tokens: int, client_id=None):
    """Grava um evento de uso. Abre a própria sessão (chamado de dentro do provider)."""
    db = SessionLocal()
    try:
        db.add(models.UsageEvent(
            provider=provider, model=model,
            input_tokens=input_tokens, output_tokens=output_tokens,
            cost_usd=estimate_cost(input_tokens, output_tokens),
            client_id=client_id,
        ))
        db.commit()
    except Exception:  # noqa: BLE001 — telemetria nunca deve quebrar o fluxo
        db.rollback()
    finally:
        db.close()


def summary(db) -> dict:
    """Agrega o uso de hoje e o total (para o widget)."""
    today_start = datetime.combine(date.today(), datetime.min.time())

    def agg(query):
        row = query.with_entities(
            func.coalesce(func.sum(models.UsageEvent.input_tokens), 0),
            func.coalesce(func.sum(models.UsageEvent.output_tokens), 0),
            func.coalesce(func.sum(models.UsageEvent.cost_usd), 0.0),
            func.count(models.UsageEvent.id),
        ).one()
        return {"input_tokens": int(row[0]), "output_tokens": int(row[1]),
                "tokens": int(row[0]) + int(row[1]), "cost_usd": round(float(row[2]), 4),
                "requests": int(row[3])}

    base = db.query(models.UsageEvent).filter(models.UsageEvent.provider == "claude")
    today = agg(base.filter(models.UsageEvent.created_at >= today_start))
    total = agg(base)
    budget = settings.claude_daily_token_budget
    today["budget_tokens"] = budget
    today["budget_pct"] = round(min(100.0, today["tokens"] / budget * 100), 1) if budget else 0.0
    return {"provider": "claude", "model": settings.anthropic_model, "today": today, "total": total}
