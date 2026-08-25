#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
WWW_DIR="$ROOT_DIR/capacitor-android/www"
rm -rf "$WWW_DIR"
mkdir -p "$WWW_DIR"
find "$ROOT_DIR" -maxdepth 1 -type f \( -name "*.html" -o -name "manifest.json" -o -name "checklist.webmanifest" -o -name "service-worker.js" -o -name "favicon.ico" -o -name "elm327-service.js" -o -name "elm-bridge.js" \) -exec cp {} "$WWW_DIR/" \;
if [ -f "$ROOT_DIR/index.html" ]; then cp "$ROOT_DIR/index.html" "$WWW_DIR/login.html"; fi
cat > "$WWW_DIR/index.html" <<'HTML_EOF'
<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>thIAguinho</title><script>location.replace('selecionar-perfil.html');</script></head><body></body></html>
HTML_EOF
for d in js css assets data firebase; do
  if [ -d "$ROOT_DIR/$d" ]; then cp -R "$ROOT_DIR/$d" "$WWW_DIR/$d"; fi
done
if [ -f "$WWW_DIR/selecionar-perfil.html" ]; then
  python3 - <<'PY_EOF'
from pathlib import Path
p=Path('capacitor-android/www/selecionar-perfil.html')
s=p.read_text(encoding='utf-8')
s=s.replace("entrar('index.html')","entrar('login.html')")
p.write_text(s,encoding='utf-8')
PY_EOF
fi
