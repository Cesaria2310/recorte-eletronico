"""Monitor de uso do Claude Code — porta da rotina do projeto "claudeusagestick".

Equivalente ao `bridge/bridge.py` do monitor de hardware (M5StickC/ESP32):
percorre `~/.claude/projects/**/*.jsonl`, deduplica mensagens do assistente por
`message.id`, calcula custo por preço-por-modelo (input/output/cache), agrega
hoje/mês/últimos 7 dias, quebra por modelo e monta a **janela móvel de 5h**
(limite de uso) ancorada na primeira mensagem da janela.

Snapshot exposto em `GET /api/usage/claude-code` (mesmo formato do bridge),
consumido pelo widget no topo do dashboard.

Observação: em ambientes onde o JSONL não traz `message.usage` (ex.: execução
remota/web), os totais saem zerados — a rotina degrada graciosamente.
"""
import os
import glob
import json
import datetime as dt
from pathlib import Path

from ..config import get_settings

settings = get_settings()

WINDOW_HOURS = 5

# USD por 1 milhão de tokens (tabela do bridge + opus-4-8).
DEFAULT_PRICING = {
    "claude-opus-4-8":   {"input": 15.00, "output": 75.00, "cache_write": 18.75, "cache_read": 1.50},
    "claude-opus-4-7":   {"input": 15.00, "output": 75.00, "cache_write": 18.75, "cache_read": 1.50},
    "claude-opus-4-6":   {"input": 15.00, "output": 75.00, "cache_write": 18.75, "cache_read": 1.50},
    "claude-opus-4":     {"input": 15.00, "output": 75.00, "cache_write": 18.75, "cache_read": 1.50},
    "claude-sonnet-4-6": {"input":  3.00, "output": 15.00, "cache_write":  3.75, "cache_read": 0.30},
    "claude-sonnet-4-5": {"input":  3.00, "output": 15.00, "cache_write":  3.75, "cache_read": 0.30},
    "claude-sonnet-4":   {"input":  3.00, "output": 15.00, "cache_write":  3.75, "cache_read": 0.30},
    "claude-haiku-4-5":  {"input":  0.80, "output":  4.00, "cache_write":  1.00, "cache_read": 0.08},
    "claude-haiku-4":    {"input":  0.80, "output":  4.00, "cache_write":  1.00, "cache_read": 0.08},
    "_default":          {"input":  3.00, "output": 15.00, "cache_write":  3.75, "cache_read": 0.30},
}
# prefixos do mais específico para o menos específico
_PREFIXES = sorted((k for k in DEFAULT_PRICING if k != "_default"), key=len, reverse=True)


def _projects_dir() -> Path:
    return Path(settings.claude_projects_dir or (Path.home() / ".claude" / "projects"))


def price_for(model: str, pricing=DEFAULT_PRICING) -> dict:
    for prefix in _PREFIXES:
        if model.startswith(prefix):
            return pricing[prefix]
    return pricing["_default"]


def parse_ts(value: str):
    if not value:
        return None
    try:
        return dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def compute_cost(inp, out, cw, cr, model) -> float:
    p = price_for(model)
    return (inp * p["input"] + out * p["output"] + cw * p["cache_write"] + cr * p["cache_read"]) / 1_000_000


def _read_events():
    """Lê todos os JSONL e retorna (assistant_events, all_timestamps).

    assistant_events: lista de (ts, cost, inp, out, cr, model)
    all_timestamps: timestamps de user+assistant (para ancorar a janela de 5h)
    """
    base = _projects_dir()
    seen_msg_ids: set[str] = set()
    events = []
    anchors = []
    if not base.exists():
        return events, anchors
    for path in glob.glob(str(base / "**" / "*.jsonl"), recursive=True):
        try:
            with open(path, encoding="utf-8", errors="ignore") as fh:
                for line in fh:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        obj = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    ev_type = obj.get("type")
                    ts = parse_ts(obj.get("timestamp", ""))
                    if ts is None:
                        continue
                    if ev_type in ("user", "assistant"):
                        anchors.append(ts)
                    if ev_type != "assistant":
                        continue
                    msg = obj.get("message") or {}
                    usage = msg.get("usage")
                    if not usage:
                        continue
                    mid = msg.get("id")
                    if mid:
                        if mid in seen_msg_ids:
                            continue
                        seen_msg_ids.add(mid)
                    model = msg.get("model") or "_default"
                    inp = usage.get("input_tokens", 0) or 0
                    out = usage.get("output_tokens", 0) or 0
                    cw = usage.get("cache_creation_input_tokens", 0) or 0
                    cr = usage.get("cache_read_input_tokens", 0) or 0
                    events.append((ts, compute_cost(inp, out, cw, cr, model), inp, out, cr, model))
        except OSError:
            continue
    return events, anchors


def _compute_window5h(anchors, events, now, plan_limit_5h, window_hours=WINDOW_HOURS):
    """Janela móvel de 5h: ancora na 1ª mensagem da janela atual."""
    if not anchors:
        return {"active": False, "messages": 0, "cost_usd": 0.0, "tokens_in": 0, "tokens_out": 0,
                "elapsed_min": 0, "remaining_min": 0, "limit_usd": plan_limit_5h, "limit_pct": 0,
                "start": None, "reset_at": None}
    ts_sorted = sorted(anchors)
    window_start = ts_sorted[0]
    for ts in ts_sorted[1:]:
        if (ts - window_start) >= dt.timedelta(hours=window_hours):
            window_start = ts
    reset_at = window_start + dt.timedelta(hours=window_hours)
    active = reset_at > now
    cost = tin = tout = msgs = 0
    cost = 0.0
    for ts, c, inp, out, cr, model in events:
        if window_start <= ts <= reset_at:
            cost += c
            tin += inp
            tout += out
            msgs += 1
    limit_pct = int(round(cost / plan_limit_5h * 100)) if plan_limit_5h else 0
    limit_pct = max(0, min(999, limit_pct))
    elapsed_min = max(0, int((now - window_start).total_seconds() / 60))
    remaining_min = max(0, int((reset_at - now).total_seconds() / 60))
    return {
        "active": active, "messages": msgs, "cost_usd": round(cost, 4),
        "tokens_in": tin, "tokens_out": tout,
        "elapsed_min": elapsed_min, "remaining_min": remaining_min,
        "limit_usd": plan_limit_5h, "limit_pct": limit_pct,
        "start": window_start.isoformat(), "reset_at": reset_at.isoformat(),
    }


def snapshot() -> dict:
    """Retorna o snapshot de uso (mesmo formato do GET /usage do bridge)."""
    now = dt.datetime.now(dt.timezone.utc)
    events, anchors = _read_events()

    today = {"cost_usd": 0.0, "tokens_in": 0, "tokens_out": 0, "cache_read": 0}
    month = {"cost_usd": 0.0, "tokens_in": 0, "tokens_out": 0, "cache_read": 0}
    by_model: dict[str, dict] = {}
    last7_map = {(now.date() - dt.timedelta(days=i)): 0.0 for i in range(7)}

    for ts, cost, inp, out, cr, model in events:
        d = ts.date()
        if d == now.date():
            today["cost_usd"] += cost; today["tokens_in"] += inp
            today["tokens_out"] += out; today["cache_read"] += cr
        if ts.year == now.year and ts.month == now.month:
            month["cost_usd"] += cost; month["tokens_in"] += inp
            month["tokens_out"] += out; month["cache_read"] += cr
        if d in last7_map:
            last7_map[d] += cost
        m = by_model.setdefault(model, {"name": model, "cost_usd": 0.0, "tokens_in": 0, "tokens_out": 0})
        m["cost_usd"] += cost; m["tokens_in"] += inp; m["tokens_out"] += out

    for agg in (today, month):
        agg["cost_usd"] = round(agg["cost_usd"], 4)
    last7 = [{"date": d.isoformat(), "cost_usd": round(last7_map[d], 4)}
             for d in sorted(last7_map)]
    by_model_list = sorted(
        ({**m, "cost_usd": round(m["cost_usd"], 4)} for m in by_model.values()),
        key=lambda x: x["cost_usd"], reverse=True,
    )
    window5h = _compute_window5h(anchors, events, now, settings.claude_plan_5h_limit_usd)

    return {
        "ts": now.replace(microsecond=0).isoformat(),
        "today": today,
        "month": month,
        "last7": last7,
        "by_model": by_model_list,
        "budget_monthly_usd": settings.claude_monthly_budget_usd,
        "window5h": window5h,
        "source_available": bool(events),
    }
