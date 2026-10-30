#!/usr/bin/env bash
# Schuka OS — полная установка на чистый/почти чистый сервер Ubuntu 22.04.
# Запускать один раз от root: curl -L -o setup.sh raw.githubusercontent.com/tvorchestvokaluga-blip/shchuka-os/main/deploysetup.sh && bash setup.sh
set -euo pipefail

log() { echo; echo "== $1 =="; }

log "Обновление списка пакетов"
apt-get update -y

log "Базовые утилиты (пропускаем уже установленные)"
apt-get install -y curl git ufw nginx postgresql postgresql-contrib

if ! command -v node >/dev/null 2>&1; then
  log "Node.js 20 LTS"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

if ! command -v pm2 >/dev/null 2>&1; then
  log "pm2"
  npm install -g pm2
fi

log "Файрвол: SSH, 80, 443"
ufw allow OpenSSH || true
ufw allow 80/tcp || true
ufw allow 443/tcp || true
ufw --force enable || true

log "Скачиваем код приложения"
cd /root
curl -L -o deploy.tar.gz raw.githubusercontent.com/tvorchestvokaluga-blip/shchuka-os/main/schuka-deploy-v2.tar.gz
mkdir -p /var/www/schuka-os
tar xzf deploy.tar.gz -C /var/www/schuka-os
rm -f deploy.tar.gz

log "База данных"
DB_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='schuka'" || true)
if [ "$DB_EXISTS" != "1" ]; then
  DB_PASSWORD=$(openssl rand -base64 24 | tr -dc 'A-Za-z0-9' | head -c 24)
  sudo -u postgres psql -c "CREATE USER schuka WITH PASSWORD '${DB_PASSWORD}';"
  sudo -u postgres psql -c "CREATE DATABASE schuka OWNER schuka;" || true
  echo "$DB_PASSWORD" > /root/.schuka_db_password
else
  DB_PASSWORD=$(cat /root/.schuka_db_password)
  echo "Пользователь БД уже существовал, пароль переиспользован."
fi

if [ ! -f /root/.schuka_jwt_secret ]; then
  openssl rand -base64 48 | tr -dc 'A-Za-z0-9' > /root/.schuka_jwt_secret
fi
JWT_SECRET=$(cat /root/.schuka_jwt_secret)

log "Файл окружения backend"
cat > /var/www/schuka-os/backend/.env <<EOF
NODE_ENV=production
PORT=4000
DATABASE_URL="postgresql://schuka:${DB_PASSWORD}@localhost:5432/schuka?schema=public"
JWT_SECRET="${JWT_SECRET}"
FRONTEND_URL="http://135.106.152.109"
EOF
chmod 600 /var/www/schuka-os/backend/.env

log "Установка backend"
cd /var/www/schuka-os/backend
npm install
npx prisma generate
npx prisma migrate deploy
npm run build

log "Установка frontend"
cd /var/www/schuka-os/frontend
npm install
npm run build

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
echo "Пароль БД сохранён в /root/.schuka_db_password, JWT secret в /root/.schuka_jwt_secret"
pm2 list
