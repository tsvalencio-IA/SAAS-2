#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="$ROOT_DIR/web-dist"

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"

find "$ROOT_DIR" -maxdepth 1 -type f \( -name "*.html" -o -name "manifest.json" -o -name "checklist.webmanifest" -o -name "service-worker.js" -o -name "elm327-service.js" -o -name "elm-bridge.js" -o -name "favicon.ico" \) -exec cp {} "$OUT_DIR/" \;

for directory in js css assets data; do
  if [ -d "$ROOT_DIR/$directory" ]; then
    cp -R "$ROOT_DIR/$directory" "$OUT_DIR/$directory"
  fi
done

echo "Pacote web preparado em web-dist"
