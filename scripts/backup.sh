#!/usr/bin/env bash
# Gera um backup compactado do projeto + dump do banco e regenera o CLAUDE.md.
# Mantém apenas os últimos N backups (default 16 = ~2 dias a cada 3h).
set -e
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

KEEP="${BACKUP_KEEP:-16}"
STAMP="$(date +%Y%m%d_%H%M%S)"
DEST="$ROOT/backups"
mkdir -p "$DEST"

# 1) Regenera o resumo do sistema (CLAUDE.md)
python3 "$ROOT/scripts/generate_claude_md.py" || echo "(aviso: falha ao gerar CLAUDE.md)"

# 2) Dump do banco SQLite (se existir e o sqlite3 estiver disponível)
DB="$ROOT/backend/recorte.db"
if [ -f "$DB" ]; then
  if command -v sqlite3 >/dev/null 2>&1; then
    sqlite3 "$DB" ".dump" > "$DEST/db_dump_$STAMP.sql" || cp "$DB" "$DEST/db_copy_$STAMP.db"
  else
    cp "$DB" "$DEST/db_copy_$STAMP.db"
  fi
fi

# 3) Tarball do código + uploads (exclui pesos/efêmeros)
ARCHIVE="$DEST/recorte_$STAMP.tar.gz"
tar --exclude='./.git' \
    --exclude='./backups' \
    --exclude='*/node_modules' \
    --exclude='*/.venv' \
    --exclude='*/__pycache__' \
    --exclude='*/dist' \
    -czf "$ARCHIVE" -C "$ROOT" . 2>/dev/null

echo "Backup criado: $ARCHIVE ($(du -h "$ARCHIVE" | cut -f1))"

# 4) Rotação: mantém só os últimos N de cada tipo
ls -1t "$DEST"/recorte_*.tar.gz 2>/dev/null | tail -n +$((KEEP+1)) | xargs -r rm -f
ls -1t "$DEST"/db_dump_*.sql    2>/dev/null | tail -n +$((KEEP+1)) | xargs -r rm -f
ls -1t "$DEST"/db_copy_*.db     2>/dev/null | tail -n +$((KEEP+1)) | xargs -r rm -f

echo "Backups mantidos (últimos $KEEP):"
ls -1t "$DEST"/recorte_*.tar.gz 2>/dev/null | head -n "$KEEP" | sed 's#.*/#  #'
