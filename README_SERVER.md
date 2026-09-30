# 🖥️ Sunflower Land Bot Builder — Інструкція з розгортання на сервері

Цей гайд описує швидкий процес запуску проєкту на чистому сервері через **Docker-контейнери** (backend на базі Camoufox/Firefox та frontend на базі Nginx).

---

## ⚡ Швидкий старт (Всього 3 кроки)

### Крок 1. Завантажте архів на сервер
Використовуйте SCP, rsync або будь-який SFTP-клієнт (наприклад, FileZilla чи WinSCP):

```bash
scp sf_server_deploy.tar.gz root@IP_ВАШОГО_СЕРВЕРА:/opt/
```

### Крок 2. Підключіться до сервера та розпакуйте архів

```bash
ssh root@IP_ВАШОГО_СЕРВЕРА
cd /opt
tar -xzf sf_server_deploy.tar.gz
cd sf_server_deploy
```

### Крок 3. Запустіть скрипт деплою

```bash
chmod +x deploy.sh stop.sh
./deploy.sh
```

Скрипт автоматично:
1. Завантажить готові Docker-образи (`sf_docker_images.tar`) в локальний Docker daemon.
2. Створить папки для бази даних, логів та профілів і встановить коректні права доступу (`chmod 777`).
3. Запустить сервіси контейнерів (`sf_backend` та `sf_frontend`) у фоновому режимі.

---

## 🌐 Доступ до веб-панелі

Після запуску відкрийте у браузері:
- **Веб-інтерфейс (Frontend):** `http://IP_ВАШОГО_СЕРВЕРА:5173`
- **Backend API:** `http://IP_ВАШОГО_СЕРВЕРА:3001`
- **Аналітика GoAccess:** `http://IP_ВАШОГО_СЕРВЕРА:7880`

> [!IMPORTANT]
> Переконайтеся, що в панелі вашого хостинг-провайдера (AWS, DigitalOcean, Hetzner, VPS тощо) або в UFW відкриті порти:
> ```bash
> ufw allow 5173/tcp
> ufw allow 3001/tcp
> ufw allow 7880/tcp
> ```

---

## 📋 Корисні команди для керування

- **Переглянути статус контейнерів:**
  ```bash
  docker compose ps
  ```
- **Переглянути логи всіх служб:**
  ```bash
  docker compose logs -f
  ```
- **Переглянути логи тільки бекенду (в т.ч. помилки Camoufox):**
  ```bash
  docker compose logs -f backend
  ```
- **Перезапустити сервіси:**
  ```bash
  docker compose restart
  ```
- **Зупинити сервіси:**
  ```bash
  ./stop.sh
  # або
  docker compose down
  ```

---

## 💾 Де зберігаються дані

Завдяки монтуванню Docker Volumes всі критичні дані зберігаються на самому сервері:
- `backend/projects/` — ваші створені графи та налаштування ферм
- `backend/data/sf.db` — головна база даних SQLite
- `data/` — логи, системні звіти, `proxies.txt`
- `profiles/` — каталоги профілів браузера Camoufox (кукі, авторизації)

Будь-які зміни не зникають після перезапуску чи оновлення контейнерів.
