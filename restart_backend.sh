#!/bin/bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$DIR"

echo "Restarting sf_backend and sf_frontend containers to apply updates..."
docker restart sf_backend sf_frontend || docker compose restart backend frontend

echo "Backend and Frontend successfully restarted!"
