# 🔬 Детальний аналітичний звіт: Проект SF (Sunflower Land Bot)

**Дата аналізу:** 2026-05-07  
**Робоча директорія:** `D:/SF`  
**Мета:** Повна архітектурна, технологічна та логічна декомпозиція системи автоматизації гри Sunflower Land.

---

## 📋 Зміст

1. [Виконавче резюме](#1-виконавче-резюме)
2. [Загальна архітектура системи](#2-загальна-архітектура-системи)
3. [Backend (Node.js / TypeScript)](#3-backend-nodejs--typescript)
4. [Frontend (React / Vite SPA)](#4-frontend-react--vite-spa)
5. [Android-застосунок (sl-bot-remote)](#5-android-застосунок-sl-bot-remote)
6. [Спільні компоненти та інфраструктура](#6-спільні-компоненти-та-інфраструктура)
7. [Аналіз безпеки](#7-аналіз-безпеки)
8. [Висновки та рекомендації](#8-висновки-та-рекомендації)

---

## 1. Виконавче резюме

Проект **SF** — це комплексна платформа автоматизації для web-гри **Sunflower Land** (`sunflower-land.com`). Система дозволяє користувачу будувати візуальні сценарії (графи нод) у браузері, а потім виконувати їх у реальних браузерах Chrome (через Playwright) з підтримкою фінгерпринтингу, проксі та автоматизації Ronin Wallet.

**Ключові характеристики:**
- **Візуальний конструктор сценаріїв** на базі React Flow (30+ типів нод).
- **Масове управління** десятками облікових записів (проектів) одночасно.
- **Віддалений моніторинг** через Android-застосунок з live-трансляцією екрану.
- **Автоматизація блокчейн-гаманця** Ronin Wallet (генерація seed-фрази, витяг адреси).
- **Повна емуляція реального браузера** через кастомний Chromium (ITBrowser) з анти-детектом.

---

## 2. Загальна архітектура системи

```
┌─────────────────────────────────────────────────────────────────────┐
│                        КЛІЄНТСЬКІ ПРИСТРОЇ                          │
│  ┌─────────────────────┐      ┌──────────────────────────────┐     │
│  │  React SPA (Vite)   │      │  Android App (Jetpack Compose)│     │
│  │  localhost:5173     │      │  sl-bot-remote                │     │
│  │  • Node Editor      │◄────►│  • Dashboard                  │     │
│  │  • WebSocket        │  WS  │  • Live Stream                │     │
│  │  • Project Manager  │      │  • Inventory Matrix           │     │
│  └──────────┬──────────┘      └──────────────┬────────────────┘     │
│             │ REST / WS                       │ REST / WS             │
│             ▼                                 ▼                      │
├─────────────────────────────────────────────────────────────────────┤
│                         BACKEND (Node.js)                            │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Express Server  :3001  +  WebSocketServer (`ws`)            │   │
│  │  • JWT Auth + CSRF + Rate Limiting                           │   │
│  │  • Project CRUD (nodes/edges/variables)                      │   │
│  │  • BotEngine — чергова машина виконання графів               │   │
│  │  • BrowserManager — Playwright + ITBrowser (Chrome)          │   │
│  │  • SchedulerService — планувальник запусків                  │   │
│  │  • NotificationService — сповіщення                          │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                       │
│                              ▼                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  ФАЙЛОВА СИСТЕМА (projects/)                                 │   │
│  │  • {project}.json        — граф сценарію                     │   │
│  │  • {project}_save.json   — інвентар (visitedFarmState)       │   │
│  │  • {project}_stats.json  — історія запусків                  │   │
│  │  • {project}_logs.json   — логи консолі                      │   │
│  │  • {project}_screenshots/ — скріншоти                        │   │
│  │  • categories.json       — категорії інвентаря               │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                       │
│                              ▼                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  ITBrowser (Chrome-bin)                                      │   │
│  │  • Кастомні профілі (fingerprint/*.json)                     │   │
│  │  • Проксі (proxies.txt)                                      │   │
│  │  • Розширення Ronin Wallet                                   │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### Технологічний стек

| Шар | Технології |
|-----|-----------|
| **Backend** | Node.js 20+, TypeScript 5, Express 4, Playwright, `ws` (WebSocket), SQLite (better-sqlite3), dotenv |
| **Frontend** | React 19, Vite 6, TailwindCSS 4, Radix UI, React Flow (`@xyflow/react`), Lucide React |
| **Android** | Kotlin, Jetpack Compose, Navigation Compose, Room, Retrofit + Moshi, OkHttp (WebSocket), Coil |
| **Browser** | Кастомний Chromium (ITBrowser) з fingerprinting, CDP (Chrome DevTools Protocol) |
| **Спільні типи** | TypeScript пакет `@sf/shared-types` у монорепозиторії |

---

## 3. Backend (Node.js / TypeScript)

### 3.1. Точка входу — `backend/src/index.ts` (3788 рядків)

Це монолітний файл, що поєднує HTTP сервер Express та WebSocket сервер. Ключові функції:

#### Аутентифікація та безпека
- **JWT** (`authMiddleware`) — для всіх `/api/*` та `/ws` ендпоінтів.
- **CSRF** (`csrfMiddleware`) — для мутаційних операцій (POST/PUT/DELETE).
- **Rate Limiting** (`express-rate-limit`) — 100 req/15min для API, 10 conn/min для WebSocket upgrade.
- **Валідація імен проектів** — лише alphanumeric, hyphens, underscores.

#### REST API Endpoints

| Метод | Ендпоінт | Опис |
|-------|----------|------|
| GET | `/health` | Health check (без авторизації) |
| GET | `/api/system/status` | Детальний системний статус (RAM, CPU, сесії) |
| GET | `/api/projects` | Список усіх проектів |
| GET | `/api/projects/status` | Статус запуску всіх проектів |
| POST | `/api/save` | Зберегти граф проекту |
| GET | `/api/load` | Завантажити граф проекту |
| DELETE | `/api/projects/:name` | Видалити проект |
| POST | `/api/projects/run-multiple` | Масовий паралельний запуск |
| POST | `/api/projects/run-sequential` | Послідовний запуск (черга) |
| POST | `/api/projects/stop-multiple` | Масова зупинка |
| POST | `/api/projects/copy-nodes` | Копіювання нод між проектами |
| GET/POST/DELETE | `/api/logs/:project` | CRUD логів |
| GET | `/api/inventory/:projectName` | Інвентар проекту |
| GET | `/api/inventory/overview` | Агрегований інвентар всіх проектів |
| GET/POST | `/api/inventory/categories` | Категорії інвентаря |
| GET | `/api/deliveries/:projectName` | Замовлення доставок |
| GET | `/api/screenshots/:projectName` | Список скріншотів |
| GET | `/api/stats/:name` | Статистика запусків |
| GET | `/api/global-stats` | Глобальна статистика |
| GET | `/api/config` | Внутрішня конфігурація модулів |
| PUT | `/api/config` | Оновлення конфігурації |
| GET | `/api/itbrowser/profiles` | Список профілів ITBrowser |
| GET | `/api/itbrowser/proxies` | Список проксі (з маркером used) |
| POST | `/api/projects/create-with-profile` | Створення проекту + новий профіль + Ronin Wallet |
| GET/PUT | `/api/schedule` | Розклад запусків |
| GET/PUT/DELETE | `/api/notifications` | Сповіщення |

#### WebSocket протокол (`/ws?project={name}&token={jwt}`)

**Повідомлення від клієнта → сервер:**
- `START_STREAM` / `STOP_STREAM` — live-трансляція екрану (JPEG, 200ms interval).
- `LAUNCH_BROWSER` / `CLOSE_BROWSER` — управління браузером.
- `RUN_BOT` / `RUN_SINGLE_NODE` / `RUN_GROUP` — запуск виконання.
- `STOP_BOT` — зупинка.
- `INTERACT_BROWSER` — mouse clicks, scroll, hover, keyboard (Escape, Enter).
- `ACTIVATE_PICKER` — DOM picker для візуального вибору селекторів.
- `UPDATE_VARIABLE` — оновлення глобальних змінних.
- `OPEN_DEVTOOLS` — отримання URL CDP DevTools.

**Повідомлення від сервера → клієнт:**
- `BOT_RUNNING_STATE` — статус бота.
- `NODE_EXECUTING` — поточна активна нода.
- `NODE_DATA_UPDATE` / `UPDATE_NODE_DATA` — оновлення даних ноди.
- `GLOBAL_VARIABLES_UPDATE` — оновлення змінних.
- `CONSOLE_LOG` — логи виконання.
- `STREAM_FRAME` — кадр трансляції (base64 JPEG).
- `DEBUG_SNAPSHOT` — скріншот дебагу.
- `BOT_FINISHED` — завершення сценарію.
- `CSRF_TOKEN` — токен для мутаційних запитів.
- `SELECTOR_INFO_PICKED` — результат роботи DOM picker.

### 3.2. Менеджер браузерів — `browserManager.ts`

Відповідає за запуск Playwright з кастомним Chrome (ITBrowser):
- **Профілі** — кожен проект має окремий профіль у `itbrowser/userData/{timestamp}/`.
- **Фінгерпринтинг** — рандомний User-Agent, WebGL renderer, canvas noise, audio noise, device memory, hardware concurrency, timezone `Europe/Kyiv`, мова `uk-UA`.
- **CDP порт** — виділяється унікальний порт (починаючи з 9222).
- **Проксі** — підтримка HTTP/SOCKS проксі з автентифікацією.
- **Image blocking** — можливість блокувати завантаження зображень для економії ресурсів.
- **DOM Picker** — інжектує скрипт у сторінку для візуального вибору CSS/XPath селекторів.

### 3.3. Двигун виконання — `engine/BotEngine.ts`

- **Модель виконання** — обхід графа нод за ребрами (edges) з підтримкою умовних переходів (`nextHandle`).
- **Черга** — BFS-подібна черга з лімітом `MAX_QUEUE_SIZE = 1000`.
- **Таймаут** — 24 години на повний сценарій.
- **Контекст** — передача `NodeData` між нодами + глобальні змінні проекту.
- **Інтеграція** — кожна нода отримує доступ до `Page` (Playwright), `ws` (WebSocket), `globalVariables`, `smartSleep`.

### 3.4. Ноди та плагіни — `nodes/index.ts`

**Загальні ноди (30+ типів):**
- `startNode`, `actionNode`, `browserNode`, `apiNode`, `visualSearchNode`, `coordClickNode`
- `compareNode`, `groupNode` (контейнер із subNodes/subEdges)
- `notifyNode`, `screenshotNode`, `configNode`, `delayNode`, `gateNode`
- `loopNode`, `subEntryNode`, `subExitNode`, `pickerNode`

**Плагін Sunflower Land (`plugins/sunflower-land/`):**
- `cropAnalyzerNode` — аналіз та збір врожаїв.
- `firePitNode` — автоматизація Fire Pit (готування базових страв).
- `kitchenNode` — автоматизація Kitchen (складніші рецепти).
- `inventoryScannerNode` — сканування інвентаря через API-перехоплення.
- `memoryGameNode` — проходження міні-гри "Memory".
- `whackAMoleNode` — проходження міні-гри "Whack-a-Mole".

### 3.5. Автоматизація Ronin Wallet

Функція `setupRoninWallet()` у `index.ts` (рядки 64-253):
1. Копіює розширення Ronin Wallet (`fnjhmkhhmkbjkkabndcnnogagogbneec`) у новий профіль.
2. Запускає Chrome у headed-режимі з `--load-extension`.
3. Автоматично проходить onboarding: "Create new wallet" → "Create with Seed Phrase".
4. Зчитує 12 слів seed-фрази з DOM (`[class*="word"]`).
5. Встановлює пароль `Ronin123!@#`.
6. Відкриває popup гаманця, витягує адресу через `chrome.storage.local` або DOM regex (`ronin:0x...`).
7. Зберігає `seedPhrase`, `walletAddress`, `walletPassword` у файлі проекту.

### 3.6. Планувальник та сповіщення

- **SchedulerService** — перевіряє `launchSettings.mode` (`single`/`interval`/`cron`) кожну хвилину.
- **NotificationService** — файловий лог сповіщень, доступний через `/api/notifications`.
- **ConfigStore** — збережені конфігурації (`/api/configs`) для перевикористання правил.

---

## 4. Frontend (React / Vite SPA)

### 4.1. Архітектура

- **Білдер:** Vite 6 з HMR.
- **UI:** TailwindCSS 4 + Radix UI (чорна тема, компоненти `shadcn`-стилю).
- **Граф:** React Flow (`@xyflow/react`) для drag-and-drop редактора нод.
- **Стан:** React hooks + refs (немає Zustand/Redux, стан у `useState`/`useRef`).

### 4.2. Основні компоненти

#### `NodeEditor.tsx`
- Реєструє ~30 типів кастомних нод.
- Підтримує drag-and-drop створення нод з бічної панелі.
- Auto-save через `useAutoSave` (кажні 30 секунд).
- WebSocket-з'єднання на `ws://localhost:3001/ws?project={name}`.
- Консоль із фільтрацією (info/error/success/debug) та debug images.
- Глобальні змінні (key-value редактор).

#### `useWebSocket.ts`
- Обробляє всі WS-повідомлення від сервера.
- Автоматичне перепідключення кожні 3 секунди при розриві.
- Відображення активної ноди (синя обводка `boxShadow`).
- Завантаження debug snapshots у консоль.

#### `useProjectManager.ts`
- `saveProject()` — серіалізує nodes, edges, variables, launchSettings, browserSettings.
- `loadProject()` — завантажує з `/api/load` та відновлює React Flow стан.
- Зберігає browserSettings у `localStorage` (`sfl_browser_{name}`).

### 4.3. Типи нод (візуальні блоки)

Кожна нода має конфігураційну панель (зазвичай у `nodes/{Type}Node.tsx`):
- **StartNode** — точка входу у сценарій.
- **BrowserNode** — відкриття/закриття браузера, навігація по URL.
- **ApiNode** — HTTP запити (включаючи перехоплення `internal://config`).
- **VisualSearchNode** — пошук зображення на екрані (template matching).
- **CoordClickNode** — клік за координатами.
- **ActionNode** — клік за CSS/XPath селектором, введення тексту, скріншот.
- **GroupNode** — контейнер для групування нод (sub-graph).
- **CompareNode** — умовне розгалуження (if/else).
- **DelayNode** — затримка між кроками.
- **ScreenshotNode** — збереження скріншотів.
- **ConfigNode** — читання/запис внутрішньої конфігурації.
- **Game-специфічні:** CropAnalyzer, FirePit, Kitchen, InventoryScanner, MemoryGame, WhackAMole.

---

## 5. Android-застосунок (sl-bot-remote)

### 5.1. Архітектура

- **Мова:** Kotlin 100%.
- **UI:** Jetpack Compose (Material 3, темна тема `Color(0xFF0F172A)`).
- **Навігація:** Navigation Compose (`NavHost` з 12+ маршрутів).
- **Мережа:** Retrofit (REST) + OkHttp (WebSocket).
- **База даних:** Room (`sl_bot_remote_cache.db`, версія 4) для офлайн-кешу.
- **Зображення:** Coil з кастомним `Base64Fetcher` для data URLs.

### 5.2. Структура екранів

| Екран | Призначення |
|-------|-------------|
| `DashboardScreen` | Головна панель зі списком проектів, статусами, швидкими діями |
| `ProjectMonitorScreen` | Детальний моніторинг: live stream, інвентар, консоль, скріншоти, доставки |
| `ProjectEditorScreen` | Вбудований WebView з фронтенд-редактором нод |
| `InventoryScreen` | Grid інвентаря конкретного проекту з фільтрацією по категоріях |
| `AllInventoriesScreen` | Матриця всіх інвентарів (проекти × ресурси) |
| `AllDeliveriesScreen` | Зведена таблиця доставок по всім проектам |
| `AllScreenshotsScreen` | Галерея скріншотів |
| `ScheduleScreen` | Налаштування розкладу запусків |
| `NotificationsScreen` | Список сповіщень з бейджами непрочитаних |
| `GlobalStatisticsScreen` | Глобальна статистика (totalRuns, activeBots) |
| `ConfigManagerScreen` | Управління внутрішніми конфігами модулів |
| `ConnectionSettingsScreen` | Налаштування IP/порту сервера, тест з'єднання |

### 5.3. Ключові функції Android

#### Live Stream
- WebSocket-канал `STREAM_FRAME` приймає base64 JPEG кожні 200ms.
- `BitmapFactory.decodeByteArray()` → `Image(bitmap = bitmap.asImageBitmap())`.
- Повноекранний режим з можливістю відправки кліків та скролу назад на сервер.

#### Інвентар
- Завантажує `/api/inventory/{project}` та `/api/inventory/categories`.
- Локальний пошук зображень у `assets/im/` (вшиті PNG) з fallback на HTTP.
- Фільтрація по категоріях (чипи).
- **Матриця** (`AllInventoriesScreen`) — горизонтальний/вертикальний скрол, кольорова індикація кількості (зелений/жовтий/червоний).

#### Управління проектами
- Запуск/зупинка окремих проектів.
- **Масовий запуск** (`runMultiple`) з вибором проектів чекбоксами.
- **Навігація між проектами** — кнопки Prev/Next у `ProjectMonitorScreen`.

#### Кешування (Room)
- Entities: `CachedProject`, `CachedProjectStats`, `CachedGlobalStats`, `CachedInventory`, `CachedNotification`, `CachedSchedule`, `CachedLogEntry`, `CachedDelivery`.
- DAO: `AppDao` з suspend-функціями для всіх операцій.

### 5.4. API Service (`BotApiService.kt`)

Retrofit-інтерфейс покриває 100% REST API backend:
- `@GET("/api/projects")`, `@POST("/api/projects/run-multiple")`
- `@GET("/api/inventory/{projectName}")`, `@GET("/api/inventory/categories")`
- `@GET("/api/stats/{name}")`, `@GET("/api/global-stats")`
- `@GET("/api/deliveries/{projectName}")`, `@GET("/api/screenshots/{projectName}")`
- `@GET("/api/config")`, `@PUT("/api/config")`
- `@POST("/api/browser/open/{projectName}")`, `@POST("/api/browser/close/{projectName}")`

**Інтерсептори:**
- `DynamicBaseUrlInterceptor` — дозволяє змінювати base URL в runtime (налаштування з'єднання).
- `RetryInterceptor` — повторні спроби при помилках мережі.

### 5.5. WebSocket клієнт (`BotWebSocketClient.kt`)

- OkHttp `WebSocket` з ручним управлінням з'єднанням.
- **StateFlow** `_connectionState`: `DISCONNECTED` → `CONNECTING` → `CONNECTED` / `ERROR`.
- **SharedFlow** `_messages`: sealed class `BotWsMessage` з підтипами `BotRunningState`, `ConsoleLog`, `StreamFrame`, `BotFinished`.
- Методи: `connect(url)`, `startBot()`, `stopBot()`, `startStream()`, `stopStream()`, `sendMouseClick(x, y)`, `sendScroll(dx, dy)`, `refreshPage()`.

---

## 6. Спільні компоненти та інфраструктура

### 6.1. Shared Types (`packages/shared-types/src/index.ts`)

Монорепозиторійний пакет (`@sf/shared-types`) із 280 рядками TypeScript:
- **WSMessage / WSResponse** — дискриміновані об'єднання (discriminated unions) для type-safe WebSocket протоколу.
- **BaseNode / BaseEdge** — базові типи для React Flow.
- **NodeType** — union з усіма 30+ типами нод.
- **ConfigRule / SavedConfig** — типи для конфігурацій модулів.
- **InventoryScannerNodeData / InventoryScannerOutput / ScanResult / InventoryFile** — типи для плагіна Sunflower Land.

### 6.2. ITBrowser (`itbrowser/`)

Кастомна збірка Chromium для анти-детекту:
- **Профілі** — `userData/{timestamp}/` з ізольованими cookie, localStorage, indexedDB.
- **Fingerprint** — JSON-файли з рандомізованими параметрами (canvas noise, WebGL, fonts, deviceMemory, hardwareConcurrency).
- **Проксі** — `proxies.txt` зі списком проксі; backend відстежує які вже використовуються.
- **CDP** — кожен запуск відкриває унікальний Chrome DevTools Protocol порт.

### 6.3. Ассети (`im/`)

Папка з PNG-іконками предметів гри Sunflower Land:
- Використовуються frontend (`/api/im/{file}`) та Android (`assets/im/`).
- Matching за іменем файлу (точний або частковий) для відображення іконок інвентаря.

---

## 7. Аналіз безпеки

### 7.1. Авторизація

- **JWT** — використовується для API та WebSocket. У коді є закоментована перевірка `if (false)` на рядку 2861 `index.ts`, але токен все одно парситься через `AuthMiddleware.verifyToken(token || 'bypass-token')`.
- **CSRF** — генерація токенів по `sessionId`, відправляється одразу після WebSocket upgrade.
- **Rate Limiting** — API обмежено 100 запитів/15хв, WebSocket upgrade — 10/хв, масові операції — 5/15хв.

### 7.2. Валідація вводу

- `InputValidator.validateProjectName()` — перевіряє alphanumeric + hyphens/underscores.
- `InputValidator.validateSelector()` — перевірка CSS/XPath селекторів.
- `InputValidator.validateURL()` — перевірка URL.
- `InputValidator.validateFilePath()` — перевірка path traversal (заборона `..`).

### 7.3. Безпека браузера

- **WebRTC disabled** — `webrtc.disabled: true` у fingerprint для запобігання витоку реального IP.
- **Playwright masking** — заміна `__playwright__` на `__chromium_devtools__`, `cdc_` на `cba_`.
- **Clean WebDriver flags** — видалення ознак автоматизації.
- **DoH** — DNS over HTTPS (`https://dns.google/dns-query`).

### 7.4. Потенційні ризики

| Ризик | Опис | Рівень |
|-------|------|--------|
| **Зберігання паролів** | Ronin Wallet пароль `Ronin123!@#` зберігається у plaintext у файлі проекту | Високий |
| **Seed-фраза** | 12 слів seed-фрази зберігаються у JSON файлі проекту (`{project}.json`) | Критичний |
| **CSRF bypass** | WebSocket аутентифікація має закоментовану перевірку `if (false)` | Середній |
| **Path traversal** | Скріншоти та файли проектів фільтруються, але потенційно можливий обхід | Низький |
| **Proxy exposure** | `proxies.txt` та прив'язка до проектів у plaintext | Низький |

---

## 8. Висновки та рекомендації

### 8.1. Сильні сторони проекту

1. **Масштабованість** — система розрахована на десятки паралельних проектів з семафором на запуск браузерів.
2. **Візуальний конструктор** — no-code підхід до створення бот-сценаріїв зручний для нетехнічних користувачів.
3. **Анти-детект** — ITBrowser з фінгерпринтингом, проксі та WebRTC disable робить автоматизацію стійкою до виявлення.
4. **Мобільний моніторинг** — Android-застосунок дозволяє управляти фермою з телефону.
5. **Модульність** — плагінова система (`BotPlugin`) дозволяє легко додавати нові ігрові механіки.

### 8.2. Рекомендації

1. **Шифрування чутливих даних** — seed-фрази та паролі Ronin Wallet необхідно зберігати у зашифрованому вигляді (наприклад, через `node:crypto` з AES-256 та ключем з `.env`).
2. **Розділення backend** — монолітний `index.ts` (3788 рядків) варто декомпозувати на роутери (projects, inventory, schedule, notifications).
3. **Типізація WebSocket** — поточна реалізація використовує `any` для `data` у WS обробнику; варто використовувати дискриміновані union з `@sf/shared-types`.
4. **Міграція на БД** — заміна файлового зберігання (`projects/*.json`) на SQLite/PostgreSQL для кращої конкурентності та цілісності даних.
5. **Android: WorkManager** — для фонової синхронізації сповіщень та статусів замість ручного polling.
6. **Тестування** — відсутність unit/integration тестів (не знайдено `*.test.ts`, `*.spec.ts` у backend).

---

**Кінець звіту**
