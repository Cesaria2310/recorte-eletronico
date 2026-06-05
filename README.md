# Recorte Eletrônico

Plataforma que automatiza a produção de posts de Instagram para clientes
contratados, com **aprovação humana** em cada publicação.

## Fluxo (o que o sistema faz)

1. **Cadastro** do cliente (perfil gerenciado) com um **contrato** configurável.
2. **Análise** do perfil do cliente (resumo + temas).
3. Descoberta dos **perfis concorrentes** com mais seguidores no mesmo nicho.
4. Levantamento dos **assuntos mais comentados** (internet + Instagram).
5. O usuário **seleciona** o assunto; o app **escolhe a melhor mídia** (foto/vídeo)
   da biblioteca.
6. Geração do **post**: legenda com tendências atuais + bons comentários + CTA
   pedindo para **seguir** e mandar **direct** para mais informações.
7. O usuário **avalia e autoriza**:
   - **Autorizado →** o app publica.
   - **Reprovado →** refazer o post, escolher outro tema, ou **pausar** o
     atendimento e **retornar no dia seguinte**.

## Stack

- **Backend:** Python + FastAPI + SQLAlchemy (SQLite por padrão), JWT.
- **Frontend:** React (Vite).
- **IA (configurável por contrato):** `claude` (Anthropic) ou `mock`.
- **Instagram (configurável por contrato):** `mock` ou `instagram_graph` (API oficial).

> Por contrato, o **administrador escolhe e pode trocar** o modo de integração e o
> provedor de IA a qualquer momento.

### ⚠️ Limitações reais do Instagram

A API oficial **não** permite logar com a senha do usuário nem extrair dados de
perfis concorrentes. Portanto:
- A descoberta de concorrentes e assuntos é feita pela **camada de IA**.
- A publicação real exige conta **Business/Creator** e token na **Graph API**.
- O modo **`mock`** simula tudo, ideal para testar o MVP localmente.

## Rodar localmente (MVP de teste)

```bash
bash scripts/run_dev.sh
```
- Backend: <http://localhost:8000> (Swagger em `/docs`)
- Frontend: <http://localhost:5173>
- Login admin: definido por `ADMIN_EMAIL` / `ADMIN_PASSWORD` em `backend/.env`
  (padrão do exemplo: `admin@recorte.local` / `admin123`).

### Manual (separado)

```bash
# Backend
cd backend
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # ajuste as variáveis
uvicorn app.main:app --reload --port 8000

# Frontend (outro terminal)
cd frontend
npm install
npm run dev
```

## Cofre de chaves (segurança das API keys)

As chaves de API **não ficam no código**. Cada cliente tem um **cofre** dentro do
dashboard onde o administrador cadastra, **troca** ou **cancela/deleta** as chaves
(`anthropic_api_key`, `instagram_access_token`, `instagram_business_id`):

- Valores são **criptografados** no banco (Fernet/AES) — nunca em texto puro.
- A API **nunca retorna** o valor; só `configured` + máscara (`••••1234`).
- Apenas usuários **admin** podem gravar/apagar (operadores recebem 403).
- A chave-mestra vem de `VAULT_KEY`. Gere uma para produção:
  ```bash
  python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
  ```

Endpoints: `GET /api/clients/{id}/secrets`, `PUT /api/clients/{id}/secrets/{name}`,
`DELETE /api/clients/{id}/secrets/{name}`.

## Edição de vídeo (Remotion)

A montagem do vídeo usa **Remotion** (`npx create-video`), no workspace `video/`.
A composição `PostReel` gera um reel vertical 1080x1920 com a mídia de fundo,
legenda animada, hashtags de tendência e a pílula de CTA "siga / mande um direct".

- No fluxo do post, o botão **🎬 Gerar vídeo** chama `POST /api/drafts/{id}/render-video`.
- O backend (`services/video_render.py`) invoca `video/render.mjs`
  (`@remotion/bundler` + `@remotion/renderer`), salva o `.mp4` em `uploads/`,
  registra como mídia e linka ao post (`rendered_video_url`).
- Renderizar exige Node + Chromium. Defina `REMOTION_BROWSER_EXECUTABLE` para um
  Chromium já instalado, ou deixe o Remotion baixar o próprio na 1ª renderização.
- Preview/estúdio local: `cd video && npm run studio`.

## Widget de uso do Claude

No topo do dashboard há um indicador compacto de consumo do Claude (tokens de
hoje, requisições, custo estimado e % do orçamento diário). Fonte:
`GET /api/usage/claude`. Os preços/orçamento são configuráveis no `.env`
(`CLAUDE_INPUT_PER_MTOK`, `CLAUDE_OUTPUT_PER_MTOK`, `CLAUDE_DAILY_TOKEN_BUDGET`).

## Configuração (`backend/.env`)

| Variável | Função |
|---|---|
| `SECRET_KEY` | chave do JWT (troque em produção) |
| `DATABASE_URL` | banco (SQLite por padrão; pode usar MySQL no HostGator) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | admin criado no primeiro boot |
| `DEFAULT_AI_PROVIDER` | `mock` ou `claude` |
| `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` | usados quando o contrato é `claude` |
| `DEFAULT_INTEGRATION_MODE` | `mock` ou `instagram_graph` |

Cada contrato (por cliente) pode sobrescrever provedor de IA, modo de integração
e tokens do Instagram.

## Backups + CLAUDE.md (a cada 3 horas)

Para o sistema não "ficar lento e burro", um resumo vivo do projeto é mantido em
`CLAUDE.md` e backups compactados são gerados periodicamente.

```bash
# Gera 1 backup agora (tar.gz em backups/ + dump do banco) e atualiza o CLAUDE.md
bash scripts/backup.sh

# Loop contínuo a cada 3h (primeiro plano)
bash scripts/backup_loop.sh

# Em segundo plano
nohup bash scripts/backup_loop.sh > backups/backup_loop.log 2>&1 &
```

> Em **produção (HostGator/VPS)**, prefira **cron** em vez do loop:
> ```cron
> 0 */3 * * * /home/SEU_USUARIO/recorte-eletronico/scripts/backup.sh >> /home/SEU_USUARIO/recorte-eletronico/backups/cron.log 2>&1
> ```

## Deploy no HostGator

O HostGator compartilhado é focado em PHP. Para este app Python+React, as opções:

1. **VPS HostGator (recomendado):** acesso root. Instale Python 3.11+ e Node,
   rode o backend com `uvicorn`/`gunicorn` atrás do Nginx, sirva o build do
   frontend (`frontend/dist`) como estático, configure o cron de backup e troque
   o SQLite por **MySQL** (`DATABASE_URL=mysql+pymysql://user:senha@host/db`).
2. **Hospedagem compartilhada com "Setup Python App" (Passenger):** crie a app
   Python no cPanel apontando para `backend/app/main.py` (objeto `app`), instale
   o `requirements.txt` no ambiente da app, e publique o `frontend/dist` em
   `public_html`. As mídias precisam de URL pública para a Graph API baixá-las.

> Antes de subir para produção: gere `SECRET_KEY` forte, defina as chaves reais
> (Anthropic / Instagram Graph), e configure HTTPS.

## Estrutura

- `backend/` — API FastAPI, modelos, serviços (IA e Instagram plugáveis), routers.
- `frontend/` — dashboard React (Vite).
- `scripts/` — `run_dev.sh`, `backup.sh`, `backup_loop.sh`, `generate_claude_md.py`.
- `CLAUDE.md` — resumo automático do sistema (regenerado a cada backup).
- `backups/` — artefatos de backup (ignorado pelo git).
