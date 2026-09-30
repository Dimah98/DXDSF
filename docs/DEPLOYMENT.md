# 🚀 Посібник з розгортання (Deployment Guide)

Цей посібник містить вичерпні інструкції з розгортання платформи **Sunflower Land Bot** на різних цільових середовищах: від локального Docker Compose до CasaOS та виділеного VPS сервера.

---

## 📋 Системні вимоги

- **Операційна система:** Linux (Ubuntu 22.04/24.04 LTS, Debian 12) або CasaOS / TrueNAS SCALE
- **Процесор (CPU):** Мінімум 2 ядра (рекомендовано 4+ ядра для запуску декількох браузерів)
- **Оперативна пам'ять (RAM):**
  - Мінімум: 4 GB
  - Рекомендовано: 8–16 GB (кожна активна сесія Camoufox/Firefox споживає ~400–700 MB)
- **Дисковий простір:** 15–20 GB SSD
- **Docker & Compose:** Docker Engine 24+ та Docker Compose v2+

---

## 🐳 Варіант 1. Розгортання через Docker Compose

### 1. Підготовка сервера:
Встановіть Docker та утиліти (якщо розгортаєте на новому сервері):
```bash
sudo apt update && sudo apt install -y curl git ufw
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

### 2. Клонування репозиторію та налаштування оточення:
```bash
git clone https://github.com/Dimah98/DXDSF.git /opt/sf_bot
cd /opt/sf_bot

# Створення файлу оточення
cp .env.example .env
```

Відредагуйте змінні в `.env` (особливо `JWT_SECRET`, `ENCRYPTION_KEY` та `ALLOWED_ORIGINS`):
```bash
nano .env
```

### 3. Створення необхідних директорій та права доступу:
Браузер Camoufox та база даних SQLite вимагають прав на запис у монтовані каталоги:
```bash
mkdir -p data backend/data backend/projects profiles logs/nginx
chmod -R 777 data backend/data backend/projects profiles logs
```

### 4. Збірка та запуск контейнерів:
```bash
docker compose up -d --build
```

### 5. Перевірка статусу:
```bash
docker compose ps
docker compose logs -f backend
```

---

## 🏠 Варіант 2. Розгортання в CasaOS / ZimaOS

У корені репозиторію підготовлено спеціальний файл `docker-compose.casaos.yml` із метаданими CasaOS App Store:

1. Відкрийте веб-панель **CasaOS** (`http://<IP_вашого_пристрою>`).
2. Перейдіть до **App Store** ➡️ **Custom Install** (у правому верхньому куті).
3. Натисніть кнопку **Import** і вставте вміст файлу [`docker-compose.casaos.yml`](file:///d:/SF%20k/docker-compose.casaos.yml).
4. Переконайтеся, що шляхи для томів (Volumes) вказують на ваш реальний диск (наприклад `/DATA/AppData/SF/sf_server_deploy/...`).
5. Натисніть **Install**. CasaOS автоматично завантажить образи та запустить контейнери.
6. На робочому столі CasaOS з'явиться іконка **Sunflower Bot**.

---

## 🌐 Варіант 3. Розгортання на чистому VPS (Ubuntu / Debian) з доступом через Домен та SSL

Якщо ви бажаєте мати доступ до бота за захищеним протоколом `https://your-domain.com`:

### 1. Налаштування файрволу (UFW):
```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### 2. Налаштування Reverse Proxy (Nginx або Caddy):
Приклад конфігурації зовнішнього Nginx (`/etc/nginx/sites-available/sf_bot`):

```nginx
server {
    server_name sf.yourdomain.com;

    # Веб-інтерфейс (Frontend)
    location / {
        proxy_pass http://127.0.0.1:5173;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # REST API
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket сервер для стрімінгу та подій
    location /ws {
        proxy_pass http://127.0.0.1:3001/ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
```

Отримання безкоштовного SSL сертифіката Let's Encrypt:
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d sf.yourdomain.com
```

---

## 💾 Резервне копіювання (Backup & Restore)

Усі цінні дані зберігаються у монтованих директоріях (Volumes) і не втрачаються при оновленні контейнерів:

### Що потрібно бекапити:
1. `backend/data/sf.db` — База даних історії запусків, інвентарю та налаштувань.
2. `backend/projects/` — Створені вами візуальні графи сценаріїв (.json).
3. `profiles/` — Сесії браузера Camoufox (авторизація у грі, кукі, гаманці).
4. `data/proxies.txt` — Список ваших проксі-серверів.

### Команда для швидкого створення архіву:
```bash
tar -czvf sf_backup_$(date +%F).tar.gz backend/data backend/projects profiles data/proxies.txt
```

---

## 🛠️ Траблшутинг та типові проблеми

### 1. Camoufox падає або вилітає з помилкою `Target closed` чи `Out of memory`
- **Причина:** Firefox вимагає достатнього розміру спільної пам'яті (`/dev/shm`). За замовчуванням у Docker виділяється лише 64 MB.
- **Вирішення:** Переконайтеся, що в `docker-compose.yml` вказано:
  ```yaml
  shm_size: '2gb'
  ```

### 2. Помилка доступу до бази даних: `SQLITE_CANTOPEN` або `Permission denied`
- **Причина:** Користувач усередині Docker-контейнера не має прав запису в хост-директорію.
- **Вирішення:**
  ```bash
  chmod -R 777 backend/data backend/projects profiles data
  ```

### 3. Не відображається стрім екрану у веб-інтерфейсі
- **Причина:** Nginx або проксі блокує WebSocket оновлення або таймаут з'єднання занадто малий.
- **Вирішення:** Перевірте директиви `Upgrade` та `Connection "Upgrade"` у конфігурації Nginx, а також перевірте консоль браузера (F12) на наявність блокувань змішаного контенту (Mixed Content HTTP/HTTPS).

### 4. Як переглянути логи контейнерів:
```bash
# Всі логи в реальному часі
docker compose logs -f

# Логи виключно бекенду
docker compose logs -f backend

# Останні 100 рядків логів бекенду
docker compose logs --tail=100 backend
```
