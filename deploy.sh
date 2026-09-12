#!/bin/bash
set -e

echo "=== [1/4] Sauvegarde des donnees ==="
mkdir -p /usr/share/nginx/html/data_backup
cp -u /usr/share/nginx/html/data/*.json /usr/share/nginx/html/data_backup/ 2>/dev/null || true

echo "=== [2/4] Recuperation du code (git pull) ==="
cd /usr/share/nginx/html
git checkout -f main
git pull origin main

echo "=== [3/4] Installation des dependances ==="
npm install --omit=dev

echo "=== [4/4] Redemarrage du service VRedPlay ==="
systemctl restart vredplay.service
sleep 1
if systemctl is-active --quiet vredplay.service; then
  echo ">>> Succes : Le service VRedPlay est actif et en ligne !"
else
  echo ">>> Erreur : Le service VRedPlay n'a pas pu redemarrer."
  systemctl status vredplay.service --no-pager
  exit 1
fi
