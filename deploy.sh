#!/bin/bash
set -e

echo "====================================================="
echo "?? Sunflower Land Bot Builder — Деплой на сервер"
echo "====================================================="

# 1. Перевірка наявності Docker та Docker Compose
if ! command -v docker &> /dev/null; then
    echo "? Помилка: Docker не встановлено на цьому сервері."
    echo "Встановіть Docker: curl -fsSL https://get.docker.com | sh"
    exit 1
fi

if ! docker compose version &> /dev/null; then
    echo "? Помилка: Docker Compose не знайдено."
    exit 1
fi

# 2. Завантаження збережених Docker-образів (якщо є архів)
if [ -f "sf_docker_images.tar" ]; then
    echo "?? Завантаження Docker-образів із sf_docker_images.tar..."
    docker load -i sf_docker_images.tar
    echo "? Образи успішно завантажено в Docker!"
fi

# 3. Створення необхідних директорій та налаштування прав
echo "?? Налаштування прав доступу до томів даних..."
mkdir -p data backend/data backend/projects profiles
chmod -R 777 data backend/data backend/projects profiles

# 4. Перевірка файлу .env
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        echo "?? Створення .env із .env.example..."
        cp .env.example .env
    fi
fi

# 5. Запуск контейнерів
echo "?? Запуск контейнерів через Docker Compose..."
docker compose up -d

echo ""
echo "====================================================="
echo "?? Проєкт успішно запущено!"
echo "====================================================="
echo "?? Веб-інтерфейс (Frontend): http://\$(curl -s ifconfig.me || echo 'IP_СЕРВЕРА'):5173"
echo "?? Backend API:             http://\$(curl -s ifconfig.me || echo 'IP_СЕРВЕРА'):3001"
echo ""
echo "?? Корисні команди:"
echo "  - Переглянути логи:         docker compose logs -f"
echo "  - Логи бекенду:             docker compose logs -f backend"
echo "  - Статус контейнерів:       docker compose ps"
echo "  - Зупинити проєкт:          ./stop.sh (або docker compose down)"
echo "====================================================="