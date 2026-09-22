#!/bin/bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$DIR"

echo "Recreating sf_frontend container with updated dist volume..."
docker compose up -d --force-recreate frontend

echo "Frontend successfully updated!"
