"""Endpoint de uso do Claude — alimenta o widget /claudeusagestick do dashboard."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..services import usage
from ..services import claude_code_monitor

router = APIRouter(prefix="/api/usage", tags=["usage"], dependencies=[Depends(get_current_user)])


@router.get("/claude")
def claude_usage(db: Session = Depends(get_db)):
    """Consumo de IA gerado pelo PRÓPRIO app (chamadas Claude do backend)."""
    return usage.summary(db)


@router.get("/claude-code")
def claude_code_usage():
    """Monitor de uso do Claude Code (rotina "claudeusagestick"/bridge):
    custo, tokens, últimos 7 dias, quebra por modelo e janela móvel de 5h."""
    return claude_code_monitor.snapshot()
