# ?? Sunflower Land Bot Builder — Інструкція з розгортання на сервері

Цей архів містить повністю готовий до запуску проєкт разом із попередньо зібраними **Docker-образами** (backend на базі Camoufox/Firefox та frontend на базі Nginx).

---

## ?? Швидкий старт (всього 3 кроки)

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
1. Завантажить готові Docker-образи (`sf_docker_images.tar`) в локальний Docker реєстр.
2. Створить папки для бази даних, проєктів та профілів і виставить коректні права доступу (`chmod 777`).
3. Запустить обидва контейнери (`sf_backend` та `sf_frontend`) у фоновому режимі.

---

## ?? Доступ до інтерфейсу

Після запуску відкрийте у браузері:
- **Веб-інтерфейс (Frontend):** `http://IP_ВАШОГО_СЕРВЕРА:5173`
- **Backend API:** `http://IP_ВАШОГО_СЕРВЕРА:3001`

> [!IMPORTANT]
> Переконайтеся, що у фаєрволі вашого хостинг-провайдера (AWS, DigitalOcean, Hetzner, VPS тощо) або в UFW відкриті порти:
> ```bash
> ufw allow 5173/tcp
> ufw allow 3001/tcp
> ```

---

## ?? Корисні команди для керування

- **Перегляд живих логів:**
  ```bash
  docker compose logs -f
  ```
- **Перегляд логів лише бекенду (дії бота, запуск Camoufox):**
  ```bash
  docker compose logs -f backend
  ```
- **Статус контейнерів:**
  ```bash
  docker compose ps
  ```
- **Перезапуск проєкту:**
  ```bash
  docker compose restart
  ```
- **Зупинка проєкту:**
  ```bash
  ./stop.sh
  # або
  docker compose down
  ```

---

## ?? Де зберігаються дані

Завдяки системі Docker Volumes усі важливі дані зберігаються на файловій системі сервера:
- `backend/projects/` — ваші схеми ботів та налаштовані ноди
- `backend/data/sf.db` — основна база даних SQLite
- `data/` — логи, історія запусків, `proxies.txt`
- `profiles/` — збережені сесії браузера Camoufox (кукі, акаунти)

Будь-які зміни не зникають після перезапуску чи оновлення контейнерів.