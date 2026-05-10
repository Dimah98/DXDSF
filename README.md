# 🌻 Sunflower Land Bot Constructor (DXDSF)

Професійний конструктор візуальних скриптів для автоматизації Sunflower Land. Створюйте складні сценарії за допомогою зручного інтерфейсу "нод" (вузлів), тестуйте їх у реальному часі та керуйте ботом прямо через Telegram.

## 🚀 Основні можливості

- **Visual Scripting**: Створення логіки без написання коду (Drag-and-Drop).
- **Scanner & OCR**: Розпізнавання елементів гри, тексту та чисел на екрані.
- **Smart Clicker**: Автоматичні кліки з урахуванням координат та прокрутки.
- **Telegram Mini App**: Керування ботом та візуальний редактор прямо в Telegram.
- **Ngrok Rotation**: Автоматичний обхід лімітів Ngrok для постійного доступу.
- **Debug Logs**: Детальні логи виконання з підписами на скріншотах.

## 🛠 Технологічний стек

- **Frontend**: React, TypeScript, ReactFlow, Tailwind CSS, Lucide Icons.
- **Backend**: Node.js, Express, Playwright (Automation), Telegraf (Telegram Bot), WebSocket.
- **Tools**: Ngrok (Tunneling), Dotenv (Security).

## 📦 Встановлення та запуск

1. **Клонуйте репозиторій**:
   ```bash
   git clone https://github.com/Dimah98/DXDSF.git
   cd DXDSF
   ```

2. **Встановіть залежності**:
   ```bash
   # Для фронтенду
   cd frontend && npm install
   # Для бекенду
   cd ../backend && npm install
   ```

3. **Налаштуйте секрети**:
   Створіть файл `backend/.env` та додайте ваш `TELEGRAM_BOT_TOKEN`. Також створіть `ngrok_tokens.txt` у корені.

4. **Запуск одним файлом**:
   Просто запустіть `start_all.bat` у кореневій папці.

## 📸 Відладка
Усі скріншоти відладки зберігаються в `backend/images/debug/` з підписами нод, які їх створили.

---
Розроблено з ❤️ для Sunflower Land.
