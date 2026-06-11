# Project Map: Sunflower Land Bot Constructor

Повна карта проєкту з описом кожної директорії та основних файлів.

---

## Root Directory (d:\SF)

**Призначення**: Кореневе середовище monorepo з backend та frontend

**Основні файли**:
- `package.json` - Root package definition
- `README.md` - Головна документація проєкту
- `start_all.bat` - Windows batch для запуску всього проєкту
- `AI_CONTEXT.md` - AI контекст для розуміння архітектури
- `PROJECT_MAP.md` - Цей файл
- `.gitignore` - Git ignore rules

**Структура**:
```
d:\SF/
├── backend/          # Node.js + TypeScript backend
├── frontend/         # React + TypeScript frontend
├── docs/             # Документація
├── .kiro/            # Kiro AI спеки
├── itbrowser/        # Потребує уточнення
├── obsidian/         # Потребує уточнення
├── scratch/          # Тимчасові файли
└── sl-bot-remote/    # Remote bot (потребує уточнення)
```

---

## backend/ (d:\SF\backend)

**Призначення**: Backend сервер - Express + WebSocket + Playwright

**Технології**: Node.js, TypeScript, Express, Playwright, Vitest

**Основні файли**:
- `package.json` - Backend dependencies та scripts
- `tsconfig.json` - TypeScript configuration
- `.env` - Environment variables (not in git)
- `.env.example` - Environment variables template
- `save.json` - Backup останнього збереженого проєкту
- `save.json.bak` - Backup попередньої версії
- `ngrok_manager.js` - ngrok tunnel management
- `telegram_bot.js` - Telegram bot integration
- `check_frontend.mjs` - Frontend build check script

**Залежності**:
- express, cors, ws
- playwright (browser automation)
- dotenv, jsonwebtoken
- vitest, fast-check (testing)

---

### backend/src/ (d:\SF\backend\src)

**Призначення**: Вихідний код backend

**Основні файли**:
- `index.ts` - Express сервер, REST API, WebSocket server
- `browserManager.ts` - Playwright browser lifecycle management
- `types.ts` - Глобальні TypeScript типи
- `logger.ts` - Structured logger

---

### backend/src/auth/ (d:\SF\backend\src\auth)

**Призначення**: Middleware для безпеки та автентифікації

**Файли**:
- `AuthMiddleware.ts` - JWT token перевірка
- `CORSMiddleware.ts` - CORS налаштування
- `CSRFMiddleware.ts` - CSRF token validation
- `RateLimiter.ts` - Rate limiting для API та WebSocket
- `SecurityHeadersMiddleware.ts` - Security headers (CSP, HSTS, etc.)

**Тести**:
- `*.test.ts` - Unit tests для кожного middleware

---

### backend/src/concurrency/ (d:\SF\backend\src\concurrency)

**Призначення**: Управління конкурентністю

**Файли**:
- `Semaphore.ts` - Semaphore для обмеження паралельних операцій (max 5 браузерів)
- `Semaphore.test.ts` - Unit tests

---

### backend/src/config/ (d:\SF\backend\src\config)

**Призначення**: Configuration management

**Файли**:
- `ConfigManager.ts` - Завантаження та валідація конфігурації
- `ConfigManager.test.ts` - Unit tests

---

### backend/src/engine/ (d:\SF\backend\src\engine)

**Призначення**: Ядро виконання сценаріїв

**Файли**:
- `BotEngine.ts` - DAG traversal, node execution orchestration

**Відповідальність**:
- Обхід графу нод (Directed Acyclic Graph)
- Виконання node handlers
- Управління контекстом виконання
- Error handling та recovery
- Підтримка умовних переходів та циклів

---

### backend/src/inventory-overview/ (d:\SF\backend\src\inventory-overview)

**Призначення**: Inventory overview functionality (domain-specific)

**Файли**:
- `InventoryReader.ts` - Читання інвентарів з файлів
- `ResourceAggregator.ts` - Агрегація ресурсів по акаунтах
- `types.ts` - TypeScript типи для інвентаря
- `api.test.ts` - API integration tests
- `api-integration.test.ts` - End-to-end tests
- `README.md` - Документація модуля

**Залежності**:
- Читає файли `{projectName}_inventory.json`

---

### backend/src/lifecycle/ (d:\SF\backend\src\lifecycle)

**Призначення**: Lifecycle management для різних компонентів

**Файли**:
- `BrowserLifecycle.ts` - Створення/закриття браузерів, cleanup
- `WebSocketLifecycle.ts` - WebSocket connection lifecycle, heartbeat
- `TimerManager.ts` - Управління setTimeout/setInterval
- `MemoryMonitor.ts` - Heap usage monitoring, warnings
- `SessionPersister.ts` - Періодичне збереження стану сесій
- `ShutdownManager.ts` - Graceful shutdown (SIGTERM, SIGINT)

**Тести**:
- `*.test.ts` - Unit tests для кожного manager

---

### backend/src/nodes/ (d:\SF\backend\src\nodes)

**Призначення**: Обробники для 30+ типів нод

**Архітектура**: Кожна нода має handler з методом `execute()`

**Основні файли**:
- `index.ts` - Експорт всіх handlers
- `types.ts` - TypeScript типи для нод

**Категорії нод**:

#### Браузерні ноди:
- `BrowserNode.ts` - Запуск браузера, відкриття URL
- `ActionNode.ts` - Клік, введення тексту, натиск клавіш
- `KeyboardNode.ts` - Клавіатурні комбінації
- `CoordClickNode.ts` - Клік по координатам
- `CoordOffsetNode.ts` - Рух миші з offset
- `VisualSearchNode.ts` - Пошук елементу за скрішотом
- `SelectorCheckNode.ts` - Перевірка існування селектора
- `SearchInNode.ts` - Пошук тексту всередині елемента
- `MultiScanNode.ts` - Сканування сторінки за шаблонами

#### Логічні ноди:
- `CompareNode.ts` - Порівняння значень (==, !=, >, <, >=, <=)
- `MultiLogicNode.ts` - AND/OR логіка кількох умов
- `NestedCheckNode.ts` - Перевірка вложених умов
- `GateNode.ts` - Лічильник проходів (limit)

#### Утилітарні ноди:
- `DelayNode.ts` - Затримка на N мс
- `RandomDelayNode.ts` - Випадкова затримка (N±M)
- `VariableNode.ts` - Встановлення/оновлення змінної
- `CalculatorNode.ts` - Математичні операції
- `ApiNode.ts` - HTTP запити (GET, POST, etc)
- `DisplayNode.ts` - Відображення даних в консолі
- `EventVariationsNode.ts` - Генерування варіацій значень
- `RotatorNode.ts` - Циклічне обрання значень
- `CooldownNode.ts` - Часова затримка для rate limiting
- `InfoNode.ts` - Виведення інформаційного повідомлення
- `GroupNode.ts` - Контейнер для під-сценаріїв

#### Циклічні ноди:
- `ValueLoopNode.ts` - Цикл по масиву значень

#### Спеціалізовані ноди (domain-specific):
- `InventoryScannerNode.ts` - Сканування інвентаря (Sunflower Land)
- `CropAnalyzerNode.ts` - Аналіз врожаю
- `FirePitNode.ts` - Управління firepit
- `KitchenNode.ts` - Управління кухнею

#### Системні ноди:
- `CommentNode.ts` - Коментар для документування
- `NotifyNode.ts` - Telegram сповіщення
- `SetNextRunNode.ts` - Встановлення часу наступного запуску

**Тести**:
- `types.test.ts` - Type validation tests
- `InventoryScannerNode.test.ts` - Integration tests для InventoryScanner

---

### backend/src/notifications/ (d:\SF\backend\src\notifications)

**Призначення**: Notification service (Telegram)

**Файли**:
- `NotificationService.ts` - Відправка сповіщень через Telegram Bot API

**Залежності**:
- Читає `projects/notifications.json`

---

### backend/src/scheduler/ (d:\SF\backend\src\scheduler)

**Призначення**: Scheduler для автоматичного запуску проєктів

**Файли**:
- `SchedulerService.ts` - Interval-based та time-based scheduling

**Залежності**:
- Читає `projects/schedule.json`

**Режими**:
- Interval: кожні N хвилин/годин
- Time: конкретний час щодня
- Days: конкретні дні тижня + час

---

### backend/src/secrets/ (d:\SF\backend\src\secrets)

**Призначення**: Secrets management

**Файли**:
- `SecretsManager.ts` - Encryption/decryption для sensitive data
- `SecretsManager.test.ts` - Unit tests

---

### backend/src/validation/ (d:\SF\backend\src\validation)

**Призначення**: Input validation

**Файли**:
- `InputValidator.ts` - Валідація project names, selectors, URLs, paths
- `InputValidator.test.ts` - Unit tests

**Методи**:
- `validateProjectName()` - Alphanumeric + дефіси + underscores
- `validateSelector()` - XSS prevention
- `validateUrl()` - Безпечні протоколи
- `validatePath()` - Path traversal prevention

---

### backend/projects/ (d:\SF\backend\projects)

**Призначення**: Зберігання проєктів та даних (JSON files)

**Структура**:
```
projects/
├── {projectName}.json           # Дані проєкту
├── {projectName}_stats.json     # Статистика виконань
├── {projectName}_logs.json      # Логи виконань
├── {projectName}_inventory.json # Інвентар
├── schedule.json                # Глобальний розклад
├── notifications.json           # Налаштування сповіщень
├── default.json                 # Default project
├── default_logs.json
├── default_stats.json
└── [SF1.json, SF2.json, ...]    # User projects
```

**Формати**: Див. docs/database.md

---

### backend/images/ (d:\SF\backend\images)

**Призначення**: Зберігання скріншотів для візуального пошуку

**Структура**:
```
images/
├── {imageHash}.png              # Скріншоти для VisualSearchNode
├── debug_node_{nodeId}_{timestamp}.png  # Debug snapshots
└── debug/                       # Debug screenshots directory
```

**Формати**: PNG, JPG, JPEG

---

## frontend/ (d:\SF\frontend)

**Призначення**: Frontend React application

**Технології**: React 19, TypeScript, Vite, Tailwind CSS, React Flow

**Основні файли**:
- `package.json` - Frontend dependencies та scripts
- `tsconfig.json` - TypeScript configuration (references)
- `tsconfig.app.json` - App TypeScript config
- `tsconfig.node.json` - Node (Vite) TypeScript config
- `vite.config.ts` - Vite build configuration
- `tailwind.config.js` - Tailwind CSS configuration
- `postcss.config.js` - PostCSS configuration
- `eslint.config.js` - ESLint rules

---

### frontend/src/ (d:\SF\frontend\src)

**Призначення**: Вихідний код frontend

**Основні файли**:
- `main.tsx` - Entry point (React root render)
- `App.tsx` - Root component
- `App.css` - Global styles
- `index.css` - Tailwind CSS imports
- `nodeConfig.ts` - Конфігурація типів нод
- `portTooltips.ts` - Tooltips для портів нод

---

### frontend/src/components/ (d:\SF\frontend\src\components)

**Призначення**: React компоненти

**Основні файли**:
- `NodeEditor.tsx` - Головний редактор (React Flow)
- `ConsolePane.tsx` - Панель логів виконання
- `StreamPicker.tsx` - Element picker з відеопотоком
- `StatisticsModal.tsx` - Графіки статистики проєкту
- `GlobalStatisticsModal.tsx` - Глобальна статистика всіх проєктів
- `InventoryModal.tsx` - Модаль інвентаря
- `InventoryOverview.tsx` - Зведена таблиця інвентарів
- `InventoryOverview.css` - Styles для inventory таблиці
- `ProjectManagerModal.tsx` - Управління проєктами (CRUD)
- `ScheduleManager.tsx` - Планувальник автоматичних запусків
- `NotificationsPanel.tsx` - Панель сповіщень
- `GlobalSettings.tsx` - Глобальні налаштування
- `Sidebar.tsx` - Sidebar з доступними нодами (drag-n-drop)
- `DelayEdge.tsx` - Custom edge component для React Flow
- `PortTooltipManager.tsx` - Tooltips для портів нод

---

### frontend/src/components/CustomNodes/ (d:\SF\frontend\src\components\CustomNodes)

**Призначення**: React компоненти для 40+ типів нод

**Базові компоненти**:
- `BaseNode.tsx` - Базовий компонент для всіх нод
- `NodeHeader.tsx` - Загальний header для нод
- `subNodeTypes.ts` - Типи для під-нод (Group node)

**Системні ноди**:
- `StartNode.tsx` - Початкова точка
- `CommentNode.tsx` - Коментар

**Браузерні ноди**:
- `BrowserNode.tsx` - Запуск браузера
- `ActionNode.tsx` - Клік, введення тексту
- `KeyboardNode.tsx` - Клавіатурні комбінації
- `CoordClickNode.tsx` - Клік по координатам
- `CoordOffsetNode.tsx` - Offset клік
- `VisualSearchNode.tsx` - Візуальний пошук
- `ImageSearchNode.tsx` - Пошук зображення
- `SelectorCheckNode.tsx` - Перевірка селектора
- `SearchInNode.tsx` - Пошук всередині елемента
- `MultiScanNode.tsx` - Множинне сканування
- `EscNode.tsx` - ESC key

**Логічні ноди**:
- `CompareNode.tsx` - Порівняння
- `MultiLogicNode.tsx` - AND/OR логіка
- `NestedCheckNode.tsx` - Вложені умови
- `GateNode.tsx` - Лічильник

**Утилітарні ноди**:
- `DelayNode.tsx` - Затримка
- `RandomDelayNode.tsx` - Випадкова затримка
- `VariableNode.tsx` - Змінні
- `VariablesMonitorNode.tsx` - Моніторинг змінних
- `CalculatorNode.tsx` - Калькулятор
- `ApiNode.tsx` - HTTP запити
- `DisplayNode.tsx` - Відображення
- `EventVariationsNode.tsx` - Варіації подій
- `RotatorNode.tsx` - Ротація значень
- `CooldownNode.tsx` - Cooldown
- `InfoNode.tsx` - Інфо повідомлення
- `GroupNode.tsx` - Група нод
- `SubEntryNode.tsx` - Вхід у групу
- `SubExitNode.tsx` - Вихід з групи

**Циклічні ноди**:
- `ValueLoopNode.tsx` - Цикл по значеннях

**Спеціалізовані ноди**:
- `InventoryScannerNode.tsx` - Сканер інвентаря
- `CropAnalyzerNode.tsx` - Аналіз врожаю
- `FirePitNode.tsx` - Fire pit
- `KitchenNode.tsx` - Кухня

**Notification ноди**:
- `NotifyNode.tsx` - Сповіщення
- `SetNextRunNode.tsx` - Встановлення наступного запуску

---

### frontend/src/components/ui/ (d:\SF\frontend\src\components\ui)

**Призначення**: Reusable UI primitives (Radix UI wrappers)

**Компоненти** (потребує уточнення - список не повний):
- Button
- Dialog
- DropdownMenu
- Input
- Label
- Select
- Tooltip

---

### frontend/src/hooks/ (d:\SF\frontend\src\hooks)

**Призначення**: Custom React hooks

**Файли**:
- `useWebSocket.ts` - WebSocket communication з backend
- `useAutoSave.ts` - Автоматичне збереження проєкту (debounce)
- `useHistory.ts` - Undo/Redo functionality
- `useProjectManager.ts` - Управління проєктами (load/save/delete)
- `useLaunchSettings.ts` - Launch settings management
- `useClipboard.ts` - Copy/Paste нод
- `useCanvasActions.ts` - Zoom, pan, fit view для React Flow

---

### frontend/src/lib/ (d:\SF\frontend\src\lib)

**Призначення**: Утиліти

**Файли**:
- `utils.ts` - Загальні утиліти (cn для className merging, etc.)

---

### frontend/src/utils/ (d:\SF\frontend\src\utils)

**Призначення**: Утиліти для React Flow

**Файли**:
- `flowUtils.ts` - Helpers для роботи з нодами та edges

---

### frontend/src/assets/ (d:\SF\frontend\src\assets)

**Призначення**: Статичні assets

**Файли**:
- `hero.png` - Hero зображення
- `logo.png` - Логотип проєкту
- `react.svg` - React logo
- `vite.svg` - Vite logo

---

## docs/ (d:\SF\docs)

**Призначення**: Документація проєкту

**Файли**:
- `architecture.md` - Архітектура та патерни
- `database.md` - Схеми даних та персистентність
- `api.md` - REST та WebSocket API документація
- `ui.md` - UI компоненти та дизайн-система
- `roadmap.md` - Roadmap та технічний борг

---

## .kiro/ (d:\SF\.kiro)

**Призначення**: Kiro AI спеки та налаштування

**Структура**:
```
.kiro/
├── specs/
│   ├── inventory-overview/
│   ├── inventory-scanner/
│   ├── project-improvements/
│   └── sf-fixes/
└── hooks/
```

---

## .vscode/ (d:\SF\.vscode)

**Призначення**: VS Code налаштування workspace

**Файли** (потребує уточнення):
- `settings.json` - Workspace settings
- `launch.json` - Debug configurations
- `extensions.json` - Recommended extensions

---

## .overlay/ (d:\SF\.overlay)

**Призначення**: Потребує уточнення (можливо overlay для UI)

**Файли**:
- `config.jsonc` - Configuration

---

## itbrowser/ (d:\SF\itbrowser)

**Призначення**: Потребує уточнення (можливо пов'язано з браузером)

---

## obsidian/ (d:\SF\obsidian)

**Призначення**: Потребує уточнення (можливо Obsidian notes)

---

## scratch/ (d:\SF\scratch)

**Призначення**: Тимчасові файли, експерименти

---

## sl-bot-remote/ (d:\SF\sl-bot-remote)

**Призначення**: Потребує уточнення (remote bot component?)

---

## Root Level Files

### Configuration Files
- `.gitignore` - Git ignore rules
- `.postman.json` - Postman collection configuration
- `api.json` - API configuration (потребує уточнення)

### Documentation Files
- `README.md` - Головна документація
- `AI_CONTEXT.md` - AI контекст для агентів
- `PROJECT_MAP.md` - Ця карта проєкту

### Status/Session Files
- `FINAL_FIX.md`
- `FINAL_STATUS.md`
- `FIXED_PLAYWRIGHT_ARGS.md`
- `IMAGE_URL_FIX.md`
- `INVENTORY_FIXES.md`
- `PNG_CONVERSION_STATUS.md`
- `PNG_FILES_STORAGE.md`
- `READY_TO_TEST.md`
- `SESSION_SUMMARY.md`
- `SUMMARY.md`
- `TESTING_INSTRUCTIONS.md`
- `WEBP_BASE64_FIX.md`
- `WEBP_TO_PNG_CONVERSION.md`
- `CONVERT_ALL_TO_PNG.md`
- `API_TEST_RESULTS.md`

### Utility Scripts
- `start_all.bat` - Windows launcher
- `getCrops.js` - Utility script (потребує уточнення)
- `parse_firepit.js` - Firepit parsing utility
- `test.js` - Test script
- `test-png-conversion.js` - PNG conversion test

### Domain-specific Data
- `consumables.ts` - Consumables data (Sunflower Land)
- `crops.ts` - Crops data
- `crops2.ts` - Crops data v2
- `plant.ts` - Plant data
- `plant2.ts` - Plant data v2
- `SF.json` - Sunflower Land project data

### Mobile Build
- `BotRemote_2026-06-08_19-34.apk` - Android APK build

### Sensitive Data
- `ngrok_tokens.txt` - ngrok authentication tokens (not in git)

### Images
- `logo.png` - Project logo

---

## Залежності між директоріями

```
backend/
├── Depends on:
│   ├── backend/projects/ (read/write JSON files)
│   ├── backend/images/ (read screenshots)
│   └── .env (configuration)
└── Provides:
    ├── HTTP API на порт 3001
    └── WebSocket на порт 3001/ws

frontend/
├── Depends on:
│   └── backend/ (HTTP + WebSocket)
└── Provides:
    └── UI на порт 5173 (dev) або served by backend (prod)

docs/
└── Describes: backend/, frontend/, architecture

.kiro/
└── Contains: AI-generated specs для features
```

---

## Шляхи важливих файлів

### Backend Entry Points
- `d:\SF\backend\src\index.ts` - Main server
- `d:\SF\backend\src\engine\BotEngine.ts` - Bot execution engine
- `d:\SF\backend\src\browserManager.ts` - Browser management

### Frontend Entry Points
- `d:\SF\frontend\src\main.tsx` - React entry point
- `d:\SF\frontend\src\App.tsx` - Root component
- `d:\SF\frontend\src\components\NodeEditor.tsx` - Main editor

### Configuration
- `d:\SF\backend\.env` - Backend environment variables
- `d:\SF\backend\package.json` - Backend dependencies
- `d:\SF\frontend\package.json` - Frontend dependencies
- `d:\SF\frontend\vite.config.ts` - Vite configuration
- `d:\SF\frontend\tailwind.config.js` - Tailwind configuration

### Data Storage
- `d:\SF\backend\projects\` - Проєкти та дані (JSON)
- `d:\SF\backend\images\` - Скріншоти
- `d:\SF\backend\save.json` - Backup файл

---

**Дата створення**: 2026-06-08  
**Версія**: 1.0  
**Загальна кількість файлів**: ~300+  
**Загальна кількість директорій**: ~50+
