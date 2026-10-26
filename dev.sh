#!/usr/bin/env sh
# Inicia todo el proyecto en Linux/macOS. Solo revisa que exista Node; lo demás lo hace dev.mjs.
if ! command -v node >/dev/null 2>&1; then
  echo "Falta instalar Node.js (versión LTS):"
  echo "  - Descarga: https://nodejs.org/"
  echo "  - Con mise: mise use -g node@lts"
  echo "Después abre una terminal nueva y vuelve a ejecutar ./dev.sh"
  exit 1
fi
exec node "$(dirname "$0")/dev.mjs" "$@"
