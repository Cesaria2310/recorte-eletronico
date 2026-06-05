#!/usr/bin/env bash
# Roda o backup a cada 3 horas continuamente (laço simples).
# Uso em primeiro plano:   bash scripts/backup_loop.sh
# Em segundo plano:        nohup bash scripts/backup_loop.sh > backups/backup_loop.log 2>&1 &
#
# Observação: neste container remoto/efêmero o processo não sobrevive ao
# encerramento da sessão. Em produção (HostGator/VPS), prefira cron:
#   0 */3 * * * /caminho/recorte-eletronico/scripts/backup.sh >> /caminho/backups/cron.log 2>&1
set -e
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INTERVAL="${BACKUP_INTERVAL_SECONDS:-10800}"  # 3h
echo "Loop de backup iniciado (intervalo: ${INTERVAL}s). $(date)"
while true; do
  bash "$ROOT/scripts/backup.sh" || echo "(aviso: backup falhou em $(date))"
  echo "Próximo backup em $((INTERVAL/3600))h. $(date)"
  sleep "$INTERVAL"
done
