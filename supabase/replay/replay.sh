#!/usr/bin/env bash
# Reproduz TODA a cadeia de migrations do zero num PostgreSQL local descartavel e compara a "impressao digital" do schema public com a do
# banco vivo (ESPERADO.txt, medida em 02/11/2026). Requer PostgreSQL instalado (initdb, pg_ctl, psql); a producao e Postgres 17, aqui vale qualquer >= 15.
# Uso:  bash supabase/replay/replay.sh        (PGBIN=/caminho/bin se o Postgres nao estiver em /usr/lib/postgresql/*/bin)
# Se voce acrescentou uma migration: rode fingerprint.sql no banco vivo e atualize ESPERADO.txt.
set -euo pipefail
AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIG="$AQUI/../migrations"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
[ -x "$PGBIN/initdb" ] || { echo "PostgreSQL nao encontrado (defina PGBIN=/caminho/bin)"; exit 2; }
D="$(mktemp -d /tmp/forja_replay.XXXXXX)"
if [ "$(id -u)" = 0 ]; then RUN=(runuser -u postgres --); chown postgres:postgres "$D"; else RUN=(); fi
cleanup() { "${RUN[@]}" "$PGBIN/pg_ctl" -D "$D/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$D"; }
trap cleanup EXIT
"${RUN[@]}" "$PGBIN/initdb" -D "$D/data" -U postgres -A trust -E UTF8 --locale=C.UTF-8 >/dev/null
"${RUN[@]}" "$PGBIN/pg_ctl" -D "$D/data" -o "-p 5499 -k $D -c listen_addresses=''" -l "$D/pg.log" -w start >/dev/null
PSQL=(psql -h "$D" -p 5499 -U postgres -X -q -v ON_ERROR_STOP=1)
"${PSQL[@]}" -d postgres -c "create database forja_replay"
"${PSQL[@]}" -d forja_replay -f "$AQUI/bootstrap_supabase.sql"
# ordem = ordem do nome do arquivo, menos a PROPOSTA nao aplicada de backup (ver migrations/README.md)
for f in $(ls "$MIG"/*.sql | sort | grep -v backup_payload); do
  echo "aplicando $(basename "$f")"
  "${PSQL[@]}" -d forja_replay -f "$f"
done
"${PSQL[@]}" -d forja_replay -A -t -F '|' -f "$AQUI/fingerprint.sql" > "$D/obtido.txt"
echo; echo "=== impressao digital: replay x banco vivo (ESPERADO.txt) ==="
ruim=0
while IFS= read -r linha; do
  if grep -qxF "$linha" "$AQUI/ESPERADO.txt"; then echo "OK     $linha"; else echo "DIFERE $linha"; ruim=1; fi
done < "$D/obtido.txt"
[ "$ruim" = 0 ] && echo "=> a cadeia do repositorio reproduz o schema vivo" || echo "=> DIVERGENCIA: veja README.md (supabase/migrations)"
exit "$ruim"
