#!/bin/bash
# scripts/deploy.sh — Deploy hospodaracice.cz to VPS
set -e

APP_DIR="/opt/hospodaracice/app"

echo "=== Deploying hospodaracice.cz ==="

cd "$APP_DIR"

echo "Pulling latest code..."
git pull

echo "Installing dependencies..."
npm ci

echo "Running database migrations..."
npm run db:migrate

echo "Building application..."
npm run build

echo "Restarting application..."
pm2 restart hospodaracice 2>/dev/null || PORT=3002 pm2 start .next/standalone/server.js \
  --name hospodaracice

echo "=== Deploy complete ==="
