# 🌻 Sunflower Land Bot Constructor

Комплексна система для **візуального конструювання та управління автоматизованими ботами**. Дозволяє створювати складні бот-сценарії без написання коду через інтуїтивний drag-n-drop редактор з 30+ типів функціональних блоків.

**Основне призначення:** Автоматизація рутинних веб-операцій (веб-скрейпінг, тестування інтерфейсів, заповнення форм, моніторинг змін), управління браузером та перевірка сценаріїв.

---

## 📋 Зміст

- [Основні можливості](#основні-можливості)
- [Вимоги](#вимоги)
- [Встановлення](#встановлення)
- [Запуск](#запуск)
- [Архітектура](#архітектура)
- [Типи нод](#типи-нод)
- [API](#api)
- [Структура проекту](#структура-проекту)
- [Приклади використання](#приклади-використання)
- [Налаштування](#налаштування)
- [Troubleshooting](#troubleshooting)

---

## 🚀 Основні можливості

### Редактор сценаріїв
- **Візуальне конструювання** — drag-n-drop інтерфейс з Reactflow
- **30+ типів нод** — браузер операції, логіка, API, обчислення
- **Real-time редагування** — миттєво зберігається в JSON
- **Редактор логіки** — умовні гілки, цикли, умовні переходи

### Управління проектами
- **Збереження/завантаження** — JSON-формат для версіонування
- **Глобальні змінні** — обмін даними між нодами
- **Налаштування браузера** — профіль, проксі, розміри вікна

### Виконання та автоматизація
- **Single Node Run** — тестування окремої ноди
- **Full Scenario** — запуск повного сценарію
- **Batch Run** — одночасний запуск кількох проектів
- **Scheduler** — автоматичний запуск за розкладом (інтервал або час)

### Дебаг та моніторинг
- **Live Video Stream** — відеотрансляція браузера в реал-тайм (200мс FPS)
- **Debug Snapshots** — скріншоти окремих нод з виділенням
- **Console Logs** — повний лог виконання з кольоровими типами
- **Statistics** — графіки змін змінних за время выполнения
- **Node Inspector** — перегляд даних активної ноди

### Браузер-автоматизація
- **Playwright Integration** — контроль Chrome/Chromium через CDP
- **Element Picker** — інтерактивний вибір елементів на сторінці
- **Smart Selectors** — автоматичне генерування оптимальних селекторів
- **DevTools Access** — доступ до Chrome DevTools для дебагу

---

## 📦 Вимоги

- **Node.js** ≥ 18.0
- **npm** ≥ 9.0
- **Chrome/Chromium** браузер (для Playwright)
- **RAM** ≥ 2GB (для запуску браузера)
- **Disk Space** ≥ 1GB (для браузер-кеша та проектів)

---

## 🔧 Встановлення

### 1. Клонування репозиторію
```bash
git clone <repo-url>
cd SF
```

### 2. Встановлення залежностей

**Backend:**
```bash
cd backend
npm install
```

**Frontend:**
```bash
cd frontend
npm install
```

### 3. Конфігурація (optional)

Створіть файл `.env` в папці `backend/`:
```env
# HTTP сервер
HTTP_PORT=3001

# Браузер
ITBROWSER_PROFILE=Default
ITBROWSER_PROFILE_DIR=/path/to/profile

# Проксі (optional)
# HTTP_PROXY=http://proxy:8080
# HTTPS_PROXY=http://proxy:8080
```

---

## ▶️ Запуск

### Development режим

**Terminal 1 — Backend:**
```bash
cd backend
npm run dev
# або
npm run start
```

Backend запуститься на `http://localhost:3001`

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```

Frontend запуститься на `http://localhost:5173`

### Production режим

**Backend:**
```bash
cd backend
npm run start
```

**Frontend:**
```bash
cd frontend
npm run build
npm run preview
```

---

## 🏗️ Архітектура

### Загальна схема

```
┌─────────────────────────────────────────────────────────┐
│                   Frontend (React 19)                   │
│  ┌─────────────────────────────────────────────────┐   │
│  │  NodeEditor (Reactflow)                        │   │
│  │  - Drag-n-drop конструктор                     │   │
│  │  - Real-time відеотрансляція браузера          │   │
│  │  - Консоль логів                               │   │
│  │  - Графіки статистики                          │   │
│  └─────────────────────────────────────────────────┘   │
│                         ↕ WebSocket                      │
└─────────────────────────────────────────────────────────┘
                                                            
┌─────────────────────────────────────────────────────────┐
│               Backend (Node.js + TypeScript)            │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Express Server (порт 3001)                    │   │
│  │  - REST API для управління проектами           │   │
│  │  - WebSocket сервер для комунікації            │   │
│  │  - Scheduler для автоматичного запуску         │   │
│  └─────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────┐   │
│  │  BotEngine                                      │   │
│  │  - Обробка графу нод (DAG)                     │   │
│  │  - Виконання сценаріїв                         │   │
│  │  - Управління контекстом та змінними           │   │
│  └─────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────┐   │
│  │  BrowserManager                                 │   │
│  │  - Управління Playwright браузерами             │   │
│  │  - Управління сесіями проектів                 │   │
│  │  - Element Picker інжекція                     │   │
│  └─────────────────────────────────────────────────┘   │
│                         ↕ Playwright                     │
└─────────────────────────────────────────────────────────┘
                                                            
┌─────────────────────────────────────────────────────────┐
│              Chrome/Chromium Browser                    │
│  - Виконання дій на сторінці                          │
│  - CDP (Chrome DevTools Protocol) комунікація         │
└─────────────────────────────────────────────────────────┘
```

### Основні компоненти

#### Backend

| Компонент | Описання |
|-----------|---------|
| **index.ts** | Express сервер, REST API, WebSocket обробники |
| **BotEngine.ts** | Двигун для виконання графу нод, обхід DAG |
| **browserManager.ts** | Управління Playwright браузерами та сесіями |
| **nodes/** | Обробники для кожного типу ноди |

#### Frontend

| Компонент | Описання |
|-----------|---------|
| **App.tsx** | Головна точка входу додатку |
| **NodeEditor.tsx** | Основний редактор з Reactflow, управління побудовою |
| **CustomNodes/** | Компоненти для кожного типу ноди |
| **StreamPicker.tsx** | Компонент для interactive element picking |
| **ConsolePane.tsx** | Панель логів виконання |
| **StatisticsModal.tsx** | Модаль зі статистикою змінних |

---

## 🔲 Типи нод

### 📍 Системні ноди

| Нода | Описання |
|------|---------|
| **Start Node** | Початкова точка сценарію (обов'язково) |
| **End Node** | Завершення сценарію |
| **Comment Node** | Коментар для документування |

### 🌐 Браузер ноди

| Нода | Описання | Виходи |
|------|---------|--------|
| **Browser** | Запуск браузера, відкриття URL | success, error |
| **Action** | Клік, введення тексту, натиск клавіш | success, error |
| **Keyboard** | Клавіатурні комбінації | success, error |
| **Coordinate Click** | Клік по координатам | success, error |
| **Coordinate Offset** | Рух миші з offset | success, error |
| **Visual Search** | Пошук елементу за скрішотом | found, notFound |
| **Image Search** | Пошук по зображенню | found, notFound |
| **Selector Check** | Перевірка існування селектора | exists, notExists |
| **Search In** | Пошук тексту всередину елемента | found, notFound |
| **Multi Scan** | Сканування сторінки за шаблонами | results |

### 🔀 Логіка ноди

| Нода | Описання | Виходи |
|------|---------|--------|
| **Compare** | Порівняння двох значень | true, false |
| **Multi Logic** | AND/OR логіка кількох умов | true, false |
| **Nested Check** | Перевірка вложених умов | true, false |
| **Gate** | Лічильник проходів (limit) | pass, block |
| **Value Loop** | Цикл по масиву значень | next, finish |

### ⚙️ Утилітарні ноди

| Нода | Описання | Выходы |
|------|---------|--------|
| **Delay** | Затримка на N мс | next |
| **Random Delay** | Випадкова затримка (N±M) | next |
| **Variable** | Встановлення/оновлення змінної | next |
| **Calculator** | Математичні операції | next |
| **API** | HTTP запити (GET, POST, etc) | success, error |
| **Display** | Відображення даних в консолі | next |
| **Event Variations** | Генерування варіацій значень | next |
| **Rotator** | Циклічне обрання значень | next |
| **Cooldown** | Часова затримка для rate limiting | next |
| **Info** | Виведення інформаційного повідомлення | next |
| **Group** | Контейнер для під-сценаріїв | next |

---

## 📡 API

### REST Endpoints

#### Проекти

```http
# Отримати список всіх проектів
GET /api/projects

# Завантажити проект
GET /api/load?name=myProject

# Зберегти проект
POST /api/save
Content-Type: application/json
{
  "name": "myProject",
  "data": {
    "nodes": [...],
    "edges": [...],
    "variables": {...},
    "launchSettings": {...},
    "browserSettings": {...}
  }
}

# Видалити проект
DELETE /api/projects/myProject
```

#### Статистика

```http
# Отримати статистику проекту
GET /api/stats/myProject

# Отримати глобальну статистику всіх проектів
GET /api/global-stats
```

#### Налаштування

```http
# Отримати налаштування браузера за замовчуванням
GET /api/browser-env

# Отримати список зображень з папки images
GET /api/images
```

#### Управління

```http
# Отримати статус всіх проектів
GET /api/projects/status

# Запустити кілька проектів одночасно
POST /api/projects/run-multiple
{
  "projectNames": ["project1", "project2"],
  "projectSettings": {
    "project1": { "profile": "Default", "proxy": "..." }
  }
}

# Зупинити кілька проектів
POST /api/projects/stop-multiple
{
  "projectNames": ["project1", "project2"]
}
```

### WebSocket Повідомлення

#### Від Frontend → Backend

```javascript
// Запуск сценарію
{
  type: 'RUN_BOT',
  node: {...},
  nodes: [...],
  edges: [...],
  settings: { width: 1280, height: 720, profile: 'Default' }
}

// Запуск однієї ноди
{
  type: 'RUN_SINGLE_NODE',
  node: {...},
  nodes: [...],
  edges: [...]
}

// Зупинка бота
{ type: 'STOP_BOT' }

// Запуск браузера
{
  type: 'LAUNCH_BROWSER',
  settings: { width: 1280, height: 720, profile: 'Default' }
}

// Закриття браузера
{ type: 'CLOSE_BROWSER' }

// Взаємодія з браузером
{
  type: 'INTERACT_BROWSER',
  action: 'click' | 'scroll' | 'hover' | 'double_click',
  x: 640,
  y: 480,
  deltaX?: 0,
  deltaY?: 100
}

// Активація element picker
{
  type: 'ACTIVATE_PICKER',
  nodeId: 'node_123',
  pickType: 'selector'
}

// Оновлення змінної
{
  type: 'UPDATE_VARIABLE',
  name: 'myVar',
  value: 'newValue'
}

// Запуск відеотрансляції
{ type: 'START_STREAM' }

// Зупинка відеотрансляції
{ type: 'STOP_STREAM' }
```

#### Від Backend → Frontend

```javascript
// Оновлення глобальних змінних
{
  type: 'GLOBAL_VARIABLES_UPDATE',
  variables: { var1: 'value1', ... }
}

// Статус запуску бота
{
  type: 'BOT_RUNNING_STATE',
  isRunning: true
}

// Виконання ноди
{
  type: 'NODE_EXECUTING',
  nodeId: 'node_123',
  nodeTitle: 'Click Button'
}

// Завершення бота
{ type: 'BOT_FINISHED' }

// Логування
{
  type: 'CONSOLE_LOG',
  message: 'Click successful',
  logType: 'success' | 'error' | 'info' | 'debug'
}

// Оновлення дані ноди
{
  type: 'UPDATE_NODE_DATA',
  nodeId: 'node_123',
  newData: { resultCount: 5 }
}

// Кадр відеотрансляції
{
  type: 'STREAM_FRAME',
  frame: 'base64_encoded_jpeg'
}

// Інформація про обраний селектор
{
  type: 'SELECTOR_INFO_PICKED',
  nodeId: 'node_123',
  pickType: 'selector',
  selector: '#submit-button',
  text: 'Submit'
}
```

---

## 📁 Структура проекту

```
SF/
├── backend/
│   ├── src/
│   │   ├── index.ts                 # Express сервер, WebSocket
│   │   ├── engine/
│   │   │   └── BotEngine.ts        # Двигун для виконання сценаріїв
│   │   ├── nodes/
│   │   │   ├── types.ts            # Типи для нод
│   │   │   ├── ActionNode.ts       # Нода для браузер-дій
│   │   │   ├── CompareNode.ts      # Нода для логіки
│   │   │   ├── VariableNode.ts     # Нода для змінних
│   │   │   ├── ApiNode.ts          # HTTP запити
│   │   │   └── ... (28+ нод)
│   │   └── browserManager.ts       # Управління Playwright
│   ├── projects/                   # Папка з проектами (JSON)
│   ├── images/                     # Папка для скрішотів
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── main.tsx               # Точка входу React
│   │   ├── App.tsx                # Головний компонент
│   │   ├── index.css              # Tailwind CSS
│   │   ├── components/
│   │   │   ├── NodeEditor.tsx     # Редактор з Reactflow
│   │   │   ├── CustomNodes/       # Компоненти нод (30+)
│   │   │   ├── StreamPicker.tsx   # Element picker
│   │   │   ├── ConsolePane.tsx    # Панель логів
│   │   │   ├── StatisticsModal.tsx # Графіки
│   │   │   └── ui/                # UI компоненти (Radix)
│   │   └── lib/                   # Утиліти
│   ├── package.json
│   └── tsconfig.json
│
├── .env.example                    # Приклад конфігурації
├── README.md                       # Цей файл
└── .gitignore
```

---

## 💡 Приклади використання

### Приклад 1: Автоматизація веб-скрейпінгу

**Сценарій:** Збір даних з пошукових результатів

```
1. Start Node
   ↓
2. Browser Node (відкрити URL)
   ↓
3. Multi Scan Node (знайти всі карточки товарів)
   ↓
4. Value Loop Node (цикл по карточках)
   ├─ Action Node (клік на карточку)
   ├─ Display Node (логування даних)
   └─ Variable Node (збереження результату)
   ↓
5. API Node (відправити дані на сервер)
   ↓
6. End Node
```

### Приклад 2: Умовна логіка з перевірками

**Сценарій:** Перевірка статусу з різними галузями

```
1. Start Node
   ↓
2. Browser Node (відкрити URL)
   ↓
3. Selector Check Node (елемент існує?)
   ├─ true → Action Node (клік)
   │   ↓
   │   Compare Node (значення > 10?)
   │   ├─ true → API Node (дія A)
   │   └─ false → API Node (дія B)
   └─ false → Display Node (помилка)
   ↓
4. End Node
```

### Приклад 3: Scheduler для автоматичного запуску

**За розкладом:**
- Запуск кожне ранку в 09:00
- Запуск через кожні 30 хвилин
- Запуск в конкретні дні тижня

**Налаштування в проекті:**
```json
{
  "launchSettings": {
    "mode": "schedule",
    "scheduleDays": [1, 2, 3, 4, 5],
    "scheduleTime": "09:00"
  }
}
```

---

## ⚙️ Налаштування

### Змінні оточення (.env)

```env
# Сервер
HTTP_PORT=3001

# Браузер (Chromium/Chrome)
ITBROWSER_PROFILE=Default
ITBROWSER_PROFILE_DIR=/path/to/chrome/profile

# Проксі (optional)
HTTP_PROXY=http://proxy-server:8080
HTTPS_PROXY=http://proxy-server:8080

# Для розробки
DEBUG=bot:*
```

### Налаштування проекту (в JSON)

```json
{
  "nodes": [...],
  "edges": [...],
  "variables": {
    "myVar": "value",
    "count": 0
  },
  "launchSettings": {
    "mode": "interval",
    "intervalValue": 30,
    "intervalUnit": "minutes"
  },
  "browserSettings": {
    "profile": "Default",
    "profileDir": "/path/to/profile",
    "proxy": "http://proxy:8080",
    "width": 1280,
    "height": 720,
    "photoDebug": true
  }
}
```

### Frontend Налаштування

У `localStorage` зберігаються:
- Налаштування браузера для кожного проекту
- Розміри pannelів редактора
- Останній відкритий проект

---

## 🐛 Troubleshooting

### Браузер не запускається

**Проблема:** `Error: Chromium not found`

**Рішення:**
```bash
# Перевстановити Playwright браузери
cd backend
npx playwright install chromium

# Або встановити системний Chromium
# Ubuntu/Debian:
sudo apt install chromium-browser

# macOS:
brew install chromium
```

### WebSocket з'єднання закривається

**Проблема:** Сокет падає під час запуску

**Рішення:**
- Перевірити firewall налаштування
- Переконатися що фронтенд правильно підключається до бекенду
- Логи в консолі бекенду: `NODE_DEBUG=http`

### Селектори не знаходяться

**Проблема:** `Element not found with selector`

**Рішення:**
- Вручну активувати Element Picker через UI
- Переконатися що сторінка повністю завантажена
- Спробувати "Smart Selector" режим
- Перевірити селектор у DevTools браузера

### Статистика не зберігається

**Проблема:** Файл `project_stats.json` не оновлюється

**Рішення:**
```bash
# Перевірити дозволи папки projects/
ls -la backend/projects/

# Переконатися що папка має права на запис
chmod 755 backend/projects/
```

### Пам'ять переповнюється під час запуску

**Проблема:** Браузер використовує занадто багато RAM

**Рішення:**
- Зменшити частоту оновлення відеотрансляції (500мс замість 200мс)
- Закривати браузер після кожного запуску
- Встановити ліміт на кількість одночасних запусків
- Очистити кеш: `rm -rf backend/projects/profile/*`

---

## 📝 Логування

### Console Лог Рівні

| Рівень | Префікс | Значення |
|--------|---------|----------|
| **success** | ✅ | Успішне завершення операції |
| **error** | ❌ | Помилка під час виконання |
| **info** | ℹ️ | Інформаційне повідомлення |
| **debug** | 🔍 | Дебаг інформація |

### Включення детального логування

```bash
# Backend
export DEBUG=bot:*
npm run dev

# Frontend (в консолі браузера)
localStorage.setItem('debug', 'bot:*')
```

---

## 🔐 Безпека

### Важливо

1. **Не передавайте пароли у змінних** — всі змінні зберігаються в явному вигляді
2. **Проксі** — якщо використовуєте проксі, переконайтеся що це безпечне з'єднання
3. **Local-Only** — за замовчуванням сервер доступний на `0.0.0.0:3001`. Для продакшену встановіть firewall
4. **Браузер-профіль** — профіль містить кеші та іноді cookies — виконуйте на іскладованій машині

---

## 📊 Статистика та Логування

### Файли, що створюються

- `backend/projects/{projectName}.json` — Дані проекту
- `backend/projects/{projectName}_stats.json` — Історія запусків
- `backend/save.json` — Резервна копія
- `backend/state.json` — Стан браузера

### Аналіз статистики

```bash
# Переглянути останній запуск проекту
cat backend/projects/myProject_stats.json | jq '.[-1]'

# Кількість запусків
cat backend/projects/myProject_stats.json | jq 'length'
```

---

## 🤝 Контрибьютинг

1. Fork репозиторію
2. Створіть feature branch (`git checkout -b feature/AmazingFeature`)
3. Зафіксуйте зміни (`git commit -m 'Add AmazingFeature'`)
4. Відправте до branch (`git push origin feature/AmazingFeature`)
5. Відкрийте Pull Request

---

## 📄 Ліцензія

Цей проект ліцензований під MIT License — див. файл [LICENSE](LICENSE) для деталей.

---

## 💬 Питання та Підтримка

- 📧 **Email:** support@example.com
- 💭 **Issues:** [GitHub Issues](https://github.com/example/issues)
- 📚 **Документація:** [Wiki](https://github.com/example/wiki)

---

## 🗺️ Roadmap

### v1.1 (Q2 2025)
- [ ] Підтримка скриптів JavaScript у нодах
- [ ] Экспорт сценаріїв у Chrome Extension
- [ ] Версіонування проектів (Git integration)

### v1.2 (Q3 2025)
- [ ] Мобільне управління (PWA)
- [ ] Колаборативне редагування
- [ ] Хмарне сховище проектів

### v2.0 (Q4 2025)
- [ ] Розподілені запуски (botnet)
- [ ] Машинне навчання для smart automation
- [ ] Вбудований AI assistant для конструювання

---

**Видання:** 1.0.0  
**Остання оновлення:** 2025-05-26  
**Автор:** Sunflower Land Team

