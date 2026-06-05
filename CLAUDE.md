# CLAUDE.md — Recorte Eletrônico

> Resumo automático do sistema. Gerado em 2026-06-05 12:15:37 pelo
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
- **Frontend:** React (Vite). Presente.
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
- Clientes: `POST/GET /api/clients`, `GET/PATCH/DELETE /api/clients/{id}`,
  `PUT /api/clients/{id}/contract`
- Mídia: `POST/GET /api/clients/{id}/media`, `DELETE .../media/{mid}`
- Fluxo: `POST /api/clients/{id}/campaigns`, `POST /api/campaigns/{id}/analyze`,
  `POST /api/campaigns/{id}/select-topic`, `POST /api/drafts/{id}/review`,
  `POST /api/drafts/{id}/reject`, `POST /api/drafts/{id}/publish`

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
- Backend: **33** arquivos .py, ~**2440** linhas.
- Último commit: c1c9276 Wizard de conexao Instagram + carrossel (ideias da skill setup-instagram) (4 minutes ago)

## Estrutura
```
backend/
  app/
    routers/
      __init__.py
      auth.py
      campaigns.py
      clients.py
      instagram.py
      media.py
      secrets.py
      usage.py
    services/
      ai/
      instagram/
      __init__.py
      claude_code_monitor.py
      usage.py
      video_render.py
      workflow.py
    __init__.py
    auth.py
    config.py
    database.py
    main.py
    models.py
    schemas.py
    storage.py
    vault.py
  demo.db
  recorte.db
  requirements.txt
frontend/
  public/
    favicon.svg
    icons.svg
  src/
    assets/
      react.svg
      vite.svg
    components/
      ClientForm.jsx
      Header.jsx
      Modal.jsx
      Spinner.jsx
      StatusBadge.jsx
    pages/
      Campaign.jsx
      ClientDetail.jsx
      Clients.jsx
      Login.jsx
      Register.jsx
    App.jsx
    api.js
    main.jsx
    styles.css
  README.md
  eslint.config.js
  index.html
  package-lock.json
  package.json
  vite.config.js
screenshots/
  01-login.png
  02-clientes.png
  03-cliente-cofre.png
  04-cliente-midia.png
  05-campanha.png
  06-mobile-clientes.png
scripts/
  backup.sh
  backup_loop.sh
  generate_claude_md.py
  run_dev.sh
video/
  public/
    media/
      1_1f8d3bf9e6c44164a474491fedf7f1b4.png
      test_media.png
  src/
    PostReel.jsx
    Root.jsx
    index.jsx
  README.md
  package-lock.json
  package.json
  props.example.json
  props.local.json
  remotion.config.mjs
  render.mjs
  test_media.png
CLAUDE.md
README.md
```
