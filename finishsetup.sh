#!/usr/bin/env bash
set -euo pipefail

log() { echo; echo "== $1 =="; }

log "Nginx"
cat > /etc/nginx/sites-available/schuka-os <<'EOF'
server {
    listen 80;
    server_name _;

    client_max_body_size 20m;

    location /api/ {
        proxy_pass http://127.0.0.1:4000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF
ln -sf /etc/nginx/sites-available/schuka-os /etc/nginx/sites-enabled/schuka-os
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

log "Запуск через pm2"
cd /var/www/schuka-os/backend
pm2 delete schuka-api >/dev/null 2>&1 || true
pm2 start dist/main.js --name schuka-api

cd /var/www/schuka-os/frontend
pm2 delete schuka-web >/dev/null 2>&1 || true
pm2 start npm --name schuka-web -- start

pm2 save
env PATH=$PATH:/usr/bin pm2 startup systemd -u root --hp /root || true

log "ГОТОВО"
echo "Сайт должен быть доступен по адресу: http://135.106.152.109"
pm2 list
