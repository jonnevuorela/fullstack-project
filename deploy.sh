#!/bin/bash
set -euo pipefail

LOGFILE="/home/jonne/fullstack-project/deploy.log"
exec > >(tee -a "$LOGFILE") 2>&1

echo "===== Deployment started at $(date) ====="

cd /home/jonne/fullstack-project/game

echo "[$(date)] Running npm install..."
npm install

echo "[$(date)] Running npm run build..."
npm run build

cd /home/jonne/fullstack-project

echo "[$(date)] Running go build..."
go build ./cmd/web

echo "[$(date)] Restarting systemd service..."
sudo systemctl restart game.jonnevuorela-web.service

echo "===== Deployment completed successfully at $(date) ====="
