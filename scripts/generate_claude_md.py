#!/usr/bin/env python3
"""Gera/atualiza o CLAUDE.md com um resumo conciso do que foi produzido.

Objetivo: manter um "mapa do sistema" sempre atualizado para que assistentes e
desenvolvedores entendam o projeto rapidamente, sem precisar reler tudo (evita
lentidão e perda de contexto). Roda sozinho a cada backup (a cada 3h).
"""
import os
import subprocess
from datetime import datetime

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
IGNORE_DIRS = {".git", "node_modules", ".venv", "__pycache__", "dist", ".vite", "backups", "uploads"}


def tree(start: str, prefix: str = "", depth: int = 0, max_depth: int = 3) -> list[str]:
    if depth > max_depth:
        return []
    lines = []
    try:
        entries = sorted(os.listdir(start))
    except OSError:
        return []
    entries = [e for e in entries if e not in IGNORE_DIRS and not e.startswith(".")]
    dirs = [e for e in entries if os.path.isdir(os.path.join(start, e))]
    files = [e for e in entries if os.path.isfile(os.path.join(start, e))]
    for d in dirs:
        lines.append(f"{prefix}{d}/")
        lines += tree(os.path.join(start, d), prefix + "  ", depth + 1, max_depth)
    for f in files:
        lines.append(f"{prefix}{f}")
    return lines


def count_lines(path: str) -> int:
    try:
        with open(path, encoding="utf-8", errors="ignore") as fh:
            return sum(1 for _ in fh)
    except OSError:
        return 0


def py_stats() -> tuple[int, int]:
    files = lines = 0
    for base, dirs, fnames in os.walk(os.path.join(ROOT, "backend")):
        dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]
        for f in fnames:
            if f.endswith(".py"):
                files += 1
                lines += count_lines(os.path.join(base, f))
    return files, lines


def git_last_commit() -> str:
    try:
        return subprocess.check_output(
            ["git", "-C", ROOT, "log", "-1", "--pretty=%h %s (%cr)"], text=True
        ).strip()
    except Exception:
        return "—"


def main():
    py_files, py_lines = py_stats()
    has_frontend = os.path.exists(os.path.join(ROOT, "frontend", "package.json"))
    tree_lines = "\n".join(tree(ROOT))

    content = f"""# CLAUDE.md — Recorte Eletrônico

> Resumo automático do sistema. Gerado em {datetime.now():%Y-%m-%d %H:%M:%S} pelo
> script `scripts/generate_claude_md.py` (executado a cada backup / 3h).
> Mantenha este arquivo como "mapa" do projeto — leia-o antes de mexer no código.

## O que é
Plataforma que automatiza a produção de posts de Instagram para clientes
contratados. Fluxo ponta a ponta com **aprovação humana**:

1. Cadastro do cliente (perfil gerenciado) + **contrato** configurável.
2. Análise do perfil do cliente (resumo + temas).
3. Descoberta de **perfis concorrentes** com mais seguidores no mesmo nicho.
4. Levantamento dos **assuntos mais comentados** (internet + Instagram).
5. Usuário **seleciona** o assunto; o app escolhe a melhor mídia (foto/vídeo).
6. Geração do **post** (legenda com tendências + bons comentários + CTA "seguir/
   mandar direct").
7. Usuário **avalia e autoriza**. Autorizado → publica. Reprovado → refazer,
   trocar tema ou **pausar e retornar no dia seguinte**.

## Stack
- **Backend:** Python + FastAPI + SQLAlchemy (SQLite por padrão). JWT para auth.
- **Frontend:** React (Vite). {'Presente.' if has_frontend else 'Em construção.'}
- **IA (por contrato):** `claude` (Anthropic) ou `mock`. Camada abstrata em
  `backend/app/services/ai/` (base + factory + provedores).
- **Instagram (por contrato):** `mock` ou `instagram_graph` (Graph API oficial).
  Camada em `backend/app/services/instagram/`.

> Por contrato o **administrador escolhe e pode trocar** o modo de integração e o
> provedor de IA a qualquer momento (tabela `contracts`).

## Limitações reais (importante)
A API oficial do Instagram **não** permite login por senha do usuário nem
scraping de concorrentes. Por isso: a descoberta de concorrentes/assuntos é feita
pela **camada de IA**, e a publicação real exige conta **Business/Creator** com
token na Graph API. O modo `mock` simula tudo para testes locais.

## Arquitetura do backend
- `app/main.py` — cria app, tabelas, serve `/media`, semeia admin.
- `app/models.py` — User, Client, Contract, MediaAsset, Campaign,
  CompetitorProfile, TopicSuggestion, PostDraft.
- `app/services/workflow.py` — **máquina de estados** do fluxo (coração).
- `app/services/ai/` — `base.py`, `mock_provider.py`, `claude_provider.py`, `factory.py`.
- `app/services/instagram/` — `base.py`, `mock_provider.py`, `graph_provider.py`, `factory.py`.
- `app/routers/` — `auth.py`, `clients.py`, `media.py`, `campaigns.py`.

### Estados da campanha
`created → analyzed → topics_ready → topic_selected → pending_approval →
approved → posted`. Reprovação: `redo_post` (nova versão), `select_other_topic`,
ou `pause` (define `next_resume_date` = amanhã).

## Endpoints principais
- Auth: `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/register`
- Clientes: `POST/GET /api/clients`, `GET/PATCH/DELETE /api/clients/{{id}}`,
  `PUT /api/clients/{{id}}/contract`
- Mídia: `POST/GET /api/clients/{{id}}/media`, `DELETE .../media/{{mid}}`
- Fluxo: `POST /api/clients/{{id}}/campaigns`, `POST /api/campaigns/{{id}}/analyze`,
  `POST /api/campaigns/{{id}}/select-topic`, `POST /api/drafts/{{id}}/review`,
  `POST /api/drafts/{{id}}/reject`, `POST /api/drafts/{{id}}/publish`

## Como rodar localmente
```bash
bash scripts/run_dev.sh
# Backend:  http://localhost:8000  (Swagger em /docs)
# Frontend: http://localhost:5173
```
Credenciais admin: `ADMIN_EMAIL` / `ADMIN_PASSWORD` em `backend/.env`.

## Backups e este arquivo
`scripts/backup.sh` gera um `.tar.gz` em `backups/` e regenera este CLAUDE.md.
Agende a cada 3h com `scripts/backup_loop.sh` (ou cron). Veja README.

## Estatísticas
- Backend: **{py_files}** arquivos .py, ~**{py_lines}** linhas.
- Último commit: {git_last_commit()}

## Estrutura
```
{tree_lines}
```
"""
    out = os.path.join(ROOT, "CLAUDE.md")
    with open(out, "w", encoding="utf-8") as fh:
        fh.write(content)
    print(f"CLAUDE.md atualizado ({py_files} arquivos .py, {py_lines} linhas).")


if __name__ == "__main__":
    main()
