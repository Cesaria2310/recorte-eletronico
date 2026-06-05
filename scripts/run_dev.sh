#!/usr/bin/env bash
# Sobe o MVP localmente para teste: backend (FastAPI) + frontend (Vite).
# Uso:  bash scripts/run_dev.sh
set -e
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "==> Recorte Eletrônico — ambiente local de testes"

# --- Backend ---
cd "$ROOT/backend"
if [ ! -d .venv ]; then
  echo "==> Criando venv e instalando dependências do backend..."
  python3 -m venv .venv
  .venv/bin/pip install -q --upgrade pip
  .venv/bin/pip install -q -r requirements.txt
fi
if [ ! -f .env ]; then
  echo "==> Criando backend/.env a partir do exemplo (modo mock)..."
  cp .env.example .env
fi

echo "==> Iniciando backend em http://localhost:8000 ..."
set -a; . ./.env; set +a
.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
BACK_PID=$!

# --- Frontend ---
cd "$ROOT/frontend"
if [ -f package.json ]; then
  if [ ! -d node_modules ]; then
    echo "==> Instalando dependências do frontend..."
    npm install
  fi
  echo "==> Iniciando frontend em http://localhost:5173 ..."
  npm run dev &
  FRONT_PID=$!
fi

echo ""
echo "================================================================"
echo " Backend:  http://localhost:8000  (docs: /docs)"
echo " Frontend: http://localhost:5173"
echo " Admin:    veja ADMIN_EMAIL/ADMIN_PASSWORD em backend/.env"
echo " Ctrl+C para encerrar."
echo "================================================================"

trap "kill $BACK_PID $FRONT_PID 2>/dev/null" EXIT
wait
