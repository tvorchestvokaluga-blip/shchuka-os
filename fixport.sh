#!/usr/bin/env bash
set -euo pipefail
echo "Меняем порт Schuka OS на 8080, чтобы не конфликтовать с существующим сайтом на 80/443"
sed -i 's/listen 80;/listen 8080;/' /etc/nginx/sites-available/schuka-os
nginx -t
systemctl reload nginx
ufw allow 8080/tcp || true
echo "Готово. Проверяем:"
curl -s -o /dev/null -w "HTTP код: %{http_code}\n" http://127.0.0.1:8080/
