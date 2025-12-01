#!/bin/bash
set -euo pipefail

LOGFILE="$HOME/fullstack-project/deploy.log"
exec > >(tee -a "$LOGFILE") 2>&1

echo "===== Deployment started at $(date) ====="

cd $HOME/fullstack-project

git pull --rebase

cd $HOME/fullstack-project/game

echo "[$(date)] Running npm install..."
npm install

echo "[$(date)] Running npm run build..."
npm run build

cd $HOME/fullstack-project

echo "[$(date)] Running tests and go build..."
gotestsum --format testname --  ./... && go build ./cmd/web

echo "[$(date)] Restarting systemd service..."
sudo systemctl restart game-jonnevuorela-web.service

echo "===== Deployment completed successfully at $(date) ====="


echo "===== Restarting database container $(date) ====="

cd $HOME/fullstack-project/mariadb-docker
docker-compose down
docker-compose up -d

echo "===== Database container restarted successfully at $(date) ====="
