# AI Context: Sunflower Land Bot Constructor

## Назва проєкту
**Sunflower Land Bot Constructor** (SF)

## Короткий опис
Комплексна система для візуального конструювання та управління автоматизованими ботами. Дозволяє створювати складні бот-сценарії без написання коду через інтуїтивний drag-n-drop редактор з 30+ типів функціональних блоків. Основне призначення: автоматизація рутинних веб-операцій (веб-скрейпінг, тестування інтерфейсів, заповнення форм, моніторинг змін), управління браузером та перевірка сценаріїв.

## Технологічний стек

### Backend
- **Runtime**: Node.js ≥ 18.0
- **Мова програмування**: TypeScript 5.4.5
- **Фреймворк**: Express 4.19.2
- **WebSocket**: ws 8.17.0
- **Автоматизація браузера**: Playwright 1.44.0
- **Тестування**: Vitest 4.1.7, Fast-check 4.8.0 (property-based testing)
- **Build tool**: tsx 4.10.5 (TypeScript execution)
- **Target**: ES2022, CommonJS modules

### Frontend
- **UI Framework**: React 19.2.5 + React DOM 19.2.5
- **Мова програмування**: TypeScript 5.4.5
- **Build tool**: Vite 8.0.10
- **UI Components**: Radix UI (Dialog, Dropdown Menu, Icons, Label, Select, Slot, Tooltip)
- **Flow Editor**: @xyflow/react 12.10.2
- **Styling**: Tailwind CSS 3.4.19 + tailwindcss-animate 1.0.7
- **Icons**: Lucide React 1.14.0
- **Charts**: Recharts 3.8.1
- **Utilities**: class-variance-authority, clsx, tailwind-merge
- **Linting**: ESLint 10.2.1 + TypeScript ESLint
- **Development**: Vite Plugin React 6.0.1

### Інші інструменти
- **Package Manager**: npm ≥ 9.0
- **Monorepo**: Workspace-based (root + backend + frontend)
- **Environment**: dotenv 17.4.2
- **Security**: 
  - JWT authentication (jsonwebtoken 9.0.3)
  - CORS (cors 2.8.5)
  - Rate limiting (express-rate-limit 7.5.0)
  - CSRF protection (custom middleware)
- **Телеграм бот**: Telegraf 4.16.3
- **Тунелювання**: ngrok (через ngrok_manager.js)
- **Browser automation**: Chrome/Chromium через Chrome DevTools Protocol

## Версії основних бібліотек

### Backend
| Бібліотека | Версія |
|------------|---------|
| express | 4.19.2 |
| playwright | 1.44.0 |
| ws | 8.17.0 |
| typescript | 5.4.5 |
| vitest | 4.1.7 |
| tsx | 4.10.5 |
| dotenv | 17.4.2 |
| cors | 2.8.5 |
| jsonwebtoken | 9.0.3 |
| express-rate-limit | 7.5.0 |
| telegraf | 4.16.3 |
| fast-check | 4.8.0 |

### Frontend
| Бібліотека | Версія |
|------------|---------|
| react | 19.2.5 |
| react-dom | 19.2.5 |
| vite | 8.0.10 |
| typescript | 5.4.5 |
| @xyflow/react | 12.10.2 |
| tailwindcss | 3.4.19 |
| recharts | 3.8.1 |
| lucide-react | 1.14.0 |
| @radix-ui/* | 1.x-2.x (різні версії) |

## Менеджер пакетів
npm (використовується в обох частинах проєкту)

## Команди запуску

### Development режим

**Backend:**
```bash
cd backend
npm run dev      # Запуск з автоперезавантаженням (tsx watch)
npm run start    # Звичайний запуск (tsx)
npm run telegram # Запуск Telegram бота
npm run ngrok    # Запуск ngrok тунелю
```

**Frontend:**
```bash
cd frontend
npm run dev      # Vite dev server (порт 5173)
```

**Швидкий запуск усього:**
```bash
start_all.bat    # Windows batch для одночасного запуску
```

### Production режим

**Backend:**
```bash
cd backend
npm run start    # Production запуск
```

**Frontend:**
```bash
cd frontend
npm run build    # TypeScript compile + Vite build
npm run preview  # Preview production build
```

## Команди тестування

**Backend:**
```bash
cd backend
npm run test        # Одноразовий запуск тестів (vitest run)
npm run test:watch  # Watch режим (vitest)
```

**Frontend:**
```bash
cd frontend
npm run lint        # ESLint перевірка
```

## Структура проєкту

```
SF/
├── backend/                    # Backend Node.js + TypeScript
│   ├── src/
│   │   ├── index.ts           # Express сервер, WebSocket, REST API
│   │   ├── browserManager.ts  # Управління Playwright браузерами
│   │   ├── types.ts           # Глобальні TypeScript типи
│   │   ├── logger.ts          # Структурований логер
│   │   ├── auth/              # Middleware для безпеки
│   │   │   ├── AuthMiddleware.ts       # JWT authentication
│   │   │   ├── CORSMiddleware.ts       # CORS налаштування
│   │   │   ├── CSRFMiddleware.ts       # CSRF захист
│   │   │   ├── RateLimiter.ts          # Rate limiting
│   │   │   └── SecurityHeadersMiddleware.ts
│   │   ├── concurrency/       # Управління конкурентністю
│   │   │   └── Semaphore.ts   # Semaphore для обмеження паралельних операцій
│   │   ├── config/            # Конфігурація
│   │   │   └── ConfigManager.ts
│   │   ├── engine/            # Ядро виконання сценаріїв
│   │   │   └── BotEngine.ts   # Обхід графу нод (DAG), виконання
│   │   ├── inventory-overview/ # Інвентар та аналітика ресурсів
│   │   │   ├── InventoryReader.ts
│   │   │   ├── ResourceAggregator.ts
│   │   │   └── types.ts
│   │   ├── lifecycle/         # Управління життєвим циклом
│   │   │   ├── BrowserLifecycle.ts
│   │   │   ├── MemoryMonitor.ts
│   │   │   ├── SessionPersister.ts
│   │   │   ├── ShutdownManager.ts
│   │   │   ├── TimerManager.ts
│   │   │   └── WebSocketLifecycle.ts
│   │   ├── nodes/             # 30+ типів нод для сценаріїв
│   │   │   ├── index.ts
│   │   │   ├── types.ts
│   │   │   ├── ActionNode.ts         # Браузерні дії (клік, текст)
│   │   │   ├── ApiNode.ts            # HTTP запити
│   │   │   ├── BrowserNode.ts        # Запуск браузера
│   │   │   ├── CalculatorNode.ts     # Математичні операції
│   │   │   ├── CompareNode.ts        # Порівняння значень
│   │   │   ├── CooldownNode.ts       # Rate limiting затримка
│   │   │   ├── CoordClickNode.ts     # Клік по координатам
│   │   │   ├── CoordOffsetNode.ts    # Рух миші
│   │   │   ├── CropAnalyzerNode.ts   # Аналіз врожаю
│   │   │   ├── DelayNode.ts          # Затримка
│   │   │   ├── DisplayNode.ts        # Відображення в консолі
│   │   │   ├── EventVariationsNode.ts
│   │   │   ├── FirePitNode.ts
│   │   │   ├── GateNode.ts           # Лічильник проходів
│   │   │   ├── GroupNode.ts          # Контейнер під-сценаріїв
│   │   │   ├── InfoNode.ts
│   │   │   ├── InventoryScannerNode.ts
│   │   │   ├── KeyboardNode.ts       # Клавіатурні комбінації
│   │   │   ├── KitchenNode.ts
│   │   │   ├── MultiLogicNode.ts     # AND/OR логіка
│   │   │   ├── MultiScanNode.ts      # Сканування сторінки
│   │   │   ├── NestedCheckNode.ts
│   │   │   ├── NotifyNode.ts
│   │   │   ├── RandomDelayNode.ts
│   │   │   ├── RotatorNode.ts
│   │   │   ├── SearchInNode.ts
│   │   │   ├── SelectorCheckNode.ts  # Перевірка селектора
│   │   │   ├── SetNextRunNode.ts
│   │   │   ├── ValueLoopNode.ts      # Цикл по масиву
│   │   │   ├── VariableNode.ts       # Робота зі змінними
│   │   │   └── VisualSearchNode.ts   # Пошук візуальних елементів
│   │   ├── notifications/
│   │   │   └── NotificationService.ts
│   │   ├── scheduler/
│   │   │   └── SchedulerService.ts   # Автоматичний запуск за розкладом
│   │   ├── secrets/
│   │   │   └── SecretsManager.ts
│   │   └── validation/
│   │       └── InputValidator.ts     # Валідація вхідних даних
│   ├── projects/              # Збережені проєкти (JSON)
│   ├── images/                # Скріншоти для візуального пошуку
│   ├── node_modules/
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env                   # Конфігурація (не в git)
│   └── .env.example
│
├── frontend/                  # Frontend React + TypeScript
│   ├── src/
│   │   ├── main.tsx          # Точка входу React
│   │   ├── App.tsx           # Головний компонент
│   │   ├── App.css
│   │   ├── index.css         # Tailwind CSS
│   │   ├── nodeConfig.ts     # Конфігурація нод
│   │   ├── portTooltips.ts   # Підказки для портів
│   │   ├── components/
│   │   │   ├── NodeEditor.tsx          # Головний редактор (Reactflow)
│   │   │   ├── ConsolePane.tsx         # Панель логів
│   │   │   ├── StreamPicker.tsx        # Element picker
│   │   │   ├── StatisticsModal.tsx     # Графіки статистики
│   │   │   ├── GlobalStatisticsModal.tsx
│   │   │   ├── InventoryModal.tsx
│   │   │   ├── InventoryOverview.tsx
│   │   │   ├── ProjectManagerModal.tsx # Управління проєктами
│   │   │   ├── ScheduleManager.tsx     # Планувальник
│   │   │   ├── NotificationsPanel.tsx
│   │   │   ├── GlobalSettings.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── DelayEdge.tsx
│   │   │   ├── PortTooltipManager.tsx
│   │   │   ├── CustomNodes/            # 30+ React компонентів нод
│   │   │   └── ui/                     # Radix UI компоненти
│   │   ├── hooks/
│   │   │   ├── useAutoSave.ts
│   │   │   ├── useCanvasActions.ts
│   │   │   ├── useClipboard.ts
│   │   │   ├── useHistory.ts           # Undo/Redo
│   │   │   ├── useLaunchSettings.ts
│   │   │   ├── useProjectManager.ts
│   │   │   └── useWebSocket.ts         # WebSocket комунікація
│   │   ├── lib/
│   │   │   └── utils.ts                # Утиліти
│   │   ├── utils/
│   │   │   └── flowUtils.ts            # Утиліти для Reactflow
│   │   └── assets/
│   ├── node_modules/
│   ├── package.json
│   ├── tsconfig.json
│   ├── tsconfig.app.json
│   ├── tsconfig.node.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── eslint.config.js
│
├── .kiro/                     # Kiro AI спеки
│   ├── specs/
│   │   ├── inventory-overview/
│   │   ├── inventory-scanner/
│   │   ├── project-improvements/
│   │   └── sf-fixes/
│   └── hooks/
│
├── itbrowser/                 # Потребує уточнення
├── obsidian/                  # Потребує уточнення
├── scratch/                   # Тимчасові файли
├── sl-bot-remote/             # Remote bot (потребує уточнення)
│
├── .git/
├── .gitignore
├── package.json               # Root package.json
├── README.md                  # Головна документація
├── start_all.bat              # Windows launcher
└── [різні .md файли]          # Документація сесій та статусів
```

## Використовувані бази даних
**JSON файли** (файлова система):
- Проєкти: `backend/projects/{name}.json`
- Статистика: `backend/projects/{name}_stats.json`
- Логи: `backend/projects/{name}_logs.json`
- Інвентар: `backend/projects/{name}_inventory.json`
- Розклад: `backend/projects/schedule.json`
- Сповіщення: `backend/projects/notifications.json`

Немає традиційних SQL/NoSQL баз даних. Вся персистентність через JSON файли.

## Використовувані API

### REST API Endpoints (Backend)

#### Проєкти
- `GET /api/projects` - Список проєктів
- `GET /api/load?name={name}` - Завантаження проєкту
- `POST /api/save` - Збереження проєкту
- `DELETE /api/projects/:name` - Видалення проєкту
- `GET /api/projects/status` - Статус всіх проєктів
- `POST /api/projects/run-multiple` - Запуск кількох проєктів
- `POST /api/projects/stop-multiple` - Зупинка кількох проєктів

#### Статистика та логи
- `GET /api/stats/:name` - Статистика проєкту
- `GET /api/global-stats` - Глобальна статистика
- `GET /api/logs/:name` - Логи проєкту

#### Налаштування
- `GET /api/browser-env` - Дефолтні налаштування браузера
- `GET /api/images` - Список зображень

#### Інвентар
- `GET /api/inventory/:projectName` - Отримання інвентарю проєкту
- `GET /api/inventory/:projectName/overview` - Aggregated overview

#### Health
- `GET /health` - Health check endpoint

### WebSocket API (Порт 3001, шлях /ws)

#### Frontend → Backend
- `RUN_BOT` - Запуск сценарію
- `RUN_SINGLE_NODE` - Запуск однієї ноди
- `STOP_BOT` - Зупинка бота
- `LAUNCH_BROWSER` - Запуск браузера
- `CLOSE_BROWSER` - Закриття браузера
- `INTERACT_BROWSER` - Взаємодія з браузером (клік, scroll)
- `ACTIVATE_PICKER` - Активація element picker
- `UPDATE_VARIABLE` - Оновлення змінної
- `START_STREAM` - Запуск відеотрансляції
- `STOP_STREAM` - Зупинка відеотрансляції

#### Backend → Frontend
- `GLOBAL_VARIABLES_UPDATE` - Оновлення глобальних змінних
- `BOT_RUNNING_STATE` - Статус запуску
- `NODE_EXECUTING` - Виконання ноди
- `BOT_FINISHED` - Завершення бота
- `CONSOLE_LOG` - Логування
- `UPDATE_NODE_DATA` - Оновлення даних ноди
- `STREAM_FRAME` - Кадр відеотрансляції (base64 JPEG)
- `SELECTOR_INFO_PICKED` - Інформація про обраний селектор

### Зовнішні API
- **Chrome DevTools Protocol** (CDP) - Управління браузером через порт 9222
- **Telegram Bot API** - Через бібліотеку Telegraf
- **ngrok API** - Для створення тунелів (через ngrok_manager.js)

## Стан менеджери
**Локальний стан (React)**: useState, useReducer в компонентах
**Глобальний стан**: 
- WebSocket для синхронізації між frontend та backend
- localStorage для персистентності налаштувань UI
- Session state в backend (Map<projectName, ProjectSession>)

Немає Redux, MobX чи інших state management бібліотек.

## UI бібліотеки
- **Radix UI** - Accessible компоненти (Dialog, Dropdown, Select, Tooltip, etc.)
- **Lucide React** - SVG іконки
- **Recharts** - Графіки та візуалізація даних
- **@xyflow/react** (React Flow) - Візуальний редактор графів/нод
- **Tailwind CSS** - Utility-first CSS framework
- **tailwindcss-animate** - Анімації для Tailwind

## Правила архітектури

### Backend
1. **Separation of Concerns**: Чіткий поділ на модулі (auth, lifecycle, nodes, validation)
2. **Node Handler Pattern**: Кожна нода має власний handler з методом `execute()`
3. **Session-based Architecture**: Кожен проєкт має власну сесію з браузером
4. **DAG Execution**: BotEngine обходить направлений ациклічний граф нод
5. **Structured Logging**: Використання Logger класу для всіх логів
6. **Security First**: JWT auth, CSRF protection, rate limiting, input validation
7. **Lifecycle Management**: Explicit управління життєвим циклом браузерів, WebSocket, таймерів
8. **Concurrency Control**: Semaphore для обмеження паралельних операцій
9. **Error Handling**: Global handlers для unhandledRejection та uncaughtException
10. **File-based Persistence**: JSON файли для збереження станів

### Frontend
1. **Component-based Architecture**: React functional components
2. **Custom Hooks**: Виділення логіки в переіспользуваний hooks
3. **Controlled Components**: Форми та інпути через контрольований стан
4. **Real-time Updates**: WebSocket для синхронізації з бекендом
5. **Accessibility**: Radix UI для accessible компонентів
6. **Type Safety**: TypeScript для type checking
7. **Declarative UI**: React декларативний підхід
8. **Visual Editor Pattern**: React Flow для node-based редактора

### Загальні принципи
- **TypeScript Strict Mode**: Всі файли використовують strict type checking
- **Async/Await**: Асинхронність через async/await (не callbacks)
- **ES2022 Target**: Використання сучасного JavaScript
- **Testing**: Property-based testing (fast-check) + Unit tests (Vitest)
- **Code Organization**: Feature-based структура папок

## Заборонені підходи та бібліотеки
- ❌ **Synchronous File Operations** - Використовувати fs.promises замість fs.sync*
- ❌ **eval() та Function()** - Security ризики
- ❌ **Directly exposed secrets** - Використовувати SecretsManager
- ❌ **Unvalidated user input** - Завжди валідувати через InputValidator
- ❌ **console.log в production** - Використовувати Logger
- ❌ **Blocking operations** - Не блокувати event loop
- ❌ **SQL injection** - Немає SQL, але загальний принцип безпеки
- ❌ **Global state mutations** - Іммутабельність де можливо

## Важливі патерни та домовленості

### Backend Patterns
1. **Handler Pattern для нод**:
```typescript
export const ActionNodeHandler = {
  execute: async (node, context, page) => {
    // Implementation
    return { nextNodeIds, logs }
  }
}
```

2. **Session Management**:
```typescript
const session = getOrCreateSession(projectName)
session.page // Playwright page
session.browser // Playwright browser
session.globalVariables // Project variables
```

3. **Logging Pattern**:
```typescript
const logger = new Logger('ModuleName')
logger.info('Message', { metadata })
logger.error('Error', errorObject, { metadata })
```

4. **WebSocket Communication**:
```typescript
ws.send(JSON.stringify({ 
  type: 'MESSAGE_TYPE', 
  data: {...} 
}))
```

### Frontend Patterns
1. **Custom Node Component**:
```typescript
export const CustomNode = ({ data, id }: NodeProps) => {
  return <div className="node">...</div>
}
```

2. **WebSocket Hook**:
```typescript
const { sendMessage, lastMessage } = useWebSocket()
```

3. **Tailwind Utility Classes**:
```typescript
<div className="flex items-center gap-2 p-4">
```

### Naming Conventions
- **Файли**: PascalCase для класів/компонентів, camelCase для утиліт
- **Компоненти**: PascalCase (NodeEditor.tsx)
- **Hooks**: camelCase з префіксом "use" (useWebSocket.ts)
- **Типи**: PascalCase з суфіксом Type/Interface (ProjectSession, ExtendedWebSocket)
- **Константи**: UPPER_SNAKE_CASE (HTTP_PORT, PROJECTS_DIR)
- **Змінні**: camelCase (projectName, isRunning)

## Опис основних модулів

### Backend Modules

#### index.ts (Express Server)
Головний серверний файл, що об'єднує:
- REST API endpoints
- WebSocket server
- Middleware stack (CORS, auth, rate limiting, CSRF)
- Project management (CRUD operations)
- Session orchestration
- Lifecycle management

#### BotEngine.ts
Ядро виконання сценаріїв:
- Обхід DAG графу нод
- Виконання node handlers
- Управління контекстом виконання
- Error handling та recovery
- Підтримка умовних переходів та циклів

#### browserManager.ts
Управління Playwright браузерами:
- Створення та закриття браузерів
- Session pool management
- Element picker injection
- Debug snapshots
- CDP (Chrome DevTools Protocol) інтеграція

#### nodes/
Бібліотека з 30+ типами нод:
- **Браузерні дії**: ActionNode, BrowserNode, KeyboardNode, CoordClickNode
- **Логіка**: CompareNode, MultiLogicNode, NestedCheckNode, GateNode
- **Пошук**: VisualSearchNode, SelectorCheckNode, SearchInNode, MultiScanNode
- **Утиліти**: DelayNode, VariableNode, DisplayNode, ApiNode, CalculatorNode
- **Цикли**: ValueLoopNode, RotatorNode
- **Спеціалізовані**: InventoryScannerNode, CropAnalyzerNode, FirePitNode, KitchenNode

#### auth/
Модуль безпеки:
- **AuthMiddleware**: JWT authentication
- **CSRFMiddleware**: CSRF token validation
- **RateLimiter**: Rate limiting для API та WebSocket
- **CORSMiddleware**: CORS налаштування
- **SecurityHeadersMiddleware**: Security headers (CSP, HSTS, etc.)

#### lifecycle/
Управління життєвим циклом:
- **BrowserLifecycle**: Створення/закриття браузерів, cleanup
- **WebSocketLifecycle**: WebSocket connection lifecycle
- **TimerManager**: Управління таймерами та інтервалами
- **MemoryMonitor**: Моніторинг пам'яті
- **SessionPersister**: Збереження стану сесій
- **ShutdownManager**: Graceful shutdown

#### validation/InputValidator.ts
Валідація вхідних даних:
- Project names (whitelist pattern)
- Селектори (XSS prevention)
- URLs (безпечні протоколи)
- File paths (path traversal prevention)

#### logger.ts
Структурований логер:
- Різні рівні логування (info, warn, error, debug)
- Metadata підтримка
- Кольорове форматування
- Timestamp tracking

### Frontend Modules

#### NodeEditor.tsx
Головний компонент редактора:
- React Flow інтеграція
- Drag-n-drop функціональність
- Node/Edge manipulation
- Sidebar з доступними нодами
- Auto-save
- Undo/Redo

#### CustomNodes/
React компоненти для кожного типу ноди:
- Візуальне представлення ноди
- Input/Output ports
- Inline редагування параметрів
- Validation та error states

#### ConsolePane.tsx
Панель логів:
- Real-time лог виведення через WebSocket
- Кольорове форматування
- Фільтрація по типу (success, error, info, debug)
- Auto-scroll
- Export логів

#### StreamPicker.tsx
Element picker:
- Відео стрім браузера
- Interactive елемент вибір
- Selector generation
- Visual feedback

#### hooks/
Custom React hooks:
- **useWebSocket**: WebSocket комунікація
- **useAutoSave**: Автоматичне збереження проєкту
- **useHistory**: Undo/Redo функціональність
- **useProjectManager**: Управління проєктами
- **useLaunchSettings**: Налаштування запуску
- **useClipboard**: Copy/Paste нод
- **useCanvasActions**: Zoom, pan, fit view

## Порти та URL

### Development
- **Backend HTTP**: http://localhost:3001
- **Backend WebSocket**: ws://localhost:3001/ws
- **Frontend**: http://localhost:5173
- **Chrome DevTools Protocol**: http://localhost:9222

### Production
- **Unified Backend+Frontend**: http://localhost:3001 (backend serve frontend build)

## Environment Variables

```bash
# Backend (.env)
HTTP_PORT=3001                           # HTTP server port
ITBROWSER_PROFILE=Default                # Browser profile name
ITBROWSER_PROFILE_DIR=/path/to/profile  # Browser profile directory
HTTP_PROXY=http://proxy:8080            # Optional proxy
HTTPS_PROXY=http://proxy:8080           # Optional proxy
DEBUG=bot:*                              # Debug logging

# Frontend (через process.env)
VITE_BACKEND_PORT=3001                   # Backend port
VITE_CDP_PORT=9222                       # CDP port
```

## Особливості проєкту

1. **Visual Bot Builder** - Node-based редактор для створення автоматизації без коду
2. **Real-time Browser Streaming** - Відеотрансляція браузера в реал-тайм (200мс FPS)
3. **Scheduler** - Автоматичний запуск проєктів за розкладом
4. **Batch Execution** - Одночасний запуск кількох проєктів
5. **Property-based Testing** - Використання fast-check для тестування
6. **Session Isolation** - Кожен проєкт має власну ізольовану сесію
7. **Security-first Approach** - Багаторівнева система безпеки
8. **File-based Persistence** - JSON файли замість БД для простоти
9. **Playwright Automation** - Повноцінна автоматизація браузера
10. **Telegram Integration** - Підтримка Telegram bot для нотифікацій

---

**Версія документу**: 1.0  
**Дата створення**: 2026-06-08  
**Призначення**: AI контекст для розуміння архітектури проєкту
