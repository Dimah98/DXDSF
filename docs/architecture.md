# Архітектура проєкту

## Загальна архітектура

Sunflower Land Bot Constructor побудований на клієнт-серверній архітектурі з використанням WebSocket для real-time комунікації.

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
│                         ↕ WebSocket + REST API           │
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
│                         ↕ Playwright (CDP)               │
└─────────────────────────────────────────────────────────┘
                                                            
┌─────────────────────────────────────────────────────────┐
│              Chrome/Chromium Browser                    │
│  - Виконання дій на сторінці                          │
│  - CDP (Chrome DevTools Protocol) комунікація         │
└─────────────────────────────────────────────────────────┘
```

## Основні модулі

### Backend Architecture

#### 1. HTTP Server Layer (index.ts)
**Відповідальність**: Express сервер, REST API, WebSocket orchestration

**Ключові компоненти**:
- Express app з middleware stack
- WebSocket Server (ws)
- REST API endpoints
- Static file serving (frontend build)
- Health check endpoint

**Middleware Stack**:
1. CORS middleware
2. Body parser (JSON, urlencoded)
3. Rate limiter (API + WebSocket)
4. JWT Authentication
5. CSRF Protection
6. Input Validation

#### 2. BotEngine (engine/BotEngine.ts)
**Відповідальність**: Виконання графу нод, DAG обхід

**Алгоритм виконання**:
```
1. Знайти Start Node
2. Побудувати adjacency list з edges
3. Пройтись по графу:
   - Виконати node handler
   - Обробити результати (success, error, custom ports)
   - Визначити наступні ноди
   - Продовжити рекурсію
4. Завершити виконання
```

**Ключові методи**:
- `execute(node, nodes, edges, settings)` - Запуск сценарію
- `executeNode(node, context, page)` - Виконання окремої ноди
- `handleNodeResult(result)` - Обробка результатів ноди

#### 3. BrowserManager (browserManager.ts)
**Відповідальність**: Управління Playwright браузерами та сесіями

**Архітектурна модель**:
```typescript
Map<projectName, ProjectSession> {
  projectName: string
  browser: Browser | null
  context: BrowserContext | null
  page: Page | null
  globalVariables: Record<string, any>
  activeWs: ExtendedWebSocket | null
  isBotRunning: boolean
}
```

**Ключові функції**:
- `getOrCreateSession(projectName)` - Отримання/створення сесії
- `connectToBrowser(settings)` - Підключення до браузера
- `closeSessionBrowser(projectName)` - Закриття браузера
- `injectPicker(page, nodeId, pickType)` - Інжекція element picker
- `takeDebugSnapshot(page, nodeId)` - Debug скріншоти

#### 4. Node Handlers (nodes/)
**Відповідальність**: Реалізація логіки для кожного типу ноди

**Node Handler Interface**:
```typescript
interface NodeHandler {
  execute: (
    node: any,
    context: ExecutionContext,
    page: Page | null
  ) => Promise<{
    nextNodeIds: string[]
    logs: string[]
    newVariables?: Record<string, any>
  }>
}
```

**Категорії нод**:
- **Браузерні** (BrowserNode, ActionNode, KeyboardNode) - Взаємодія з браузером
- **Логічні** (CompareNode, MultiLogicNode, GateNode) - Умовна логіка
- **Пошукові** (VisualSearchNode, SelectorCheckNode) - Пошук елементів
- **Утилітарні** (DelayNode, VariableNode, ApiNode) - Загальні операції
- **Циклічні** (ValueLoopNode, RotatorNode) - Цикли та ітерації
- **Спеціалізовані** (InventoryScannerNode, CropAnalyzerNode) - Domain-specific

#### 5. Authentication & Security (auth/)
**Відповідальність**: Багаторівнева система безпеки

**Компоненти**:
- **AuthMiddleware**: JWT token перевірка (Authorization header)
- **CSRFMiddleware**: CSRF token validation (X-CSRF-Token header)
- **RateLimiter**: Rate limiting (10 req/min для API, 10 connections/min для WS)
- **CORSMiddleware**: Cross-Origin Resource Sharing
- **SecurityHeadersMiddleware**: Helmet-style security headers

**Middleware Pipeline**:
```
Request → CORS → Rate Limiter → Auth → CSRF → Route Handler
```

#### 6. Lifecycle Management (lifecycle/)
**Відповідальність**: Управління життєвим циклом компонентів

**Менеджери**:
- **BrowserLifecycle**: Створення/закриття браузерів, cleanup на завершення
- **WebSocketLifecycle**: WebSocket підключення, heartbeat, reconnection
- **TimerManager**: Управління setTimeout/setInterval, очищення
- **MemoryMonitor**: Моніторинг heap usage, warning threshold
- **SessionPersister**: Периодичне збереження стану сесій
- **ShutdownManager**: Graceful shutdown (SIGTERM, SIGINT)

#### 7. Concurrency Control (concurrency/Semaphore.ts)
**Відповідальність**: Обмеження паралельних операцій

**Semaphore Pattern**:
```typescript
const browserSemaphore = new Semaphore(5) // Max 5 паралельних браузерів

await browserSemaphore.acquire()
try {
  // Робота з браузером
} finally {
  browserSemaphore.release()
}
```

#### 8. Scheduler & Notifications
**Відповідальність**: Автоматизація запуску та сповіщення

**SchedulerService**:
- Читання schedule.json
- Interval-based scheduling (кожні N хвилин/годин)
- Time-based scheduling (конкретний час)
- Day-based scheduling (дні тижня)

**NotificationService**:
- Telegram bot notifications
- Project-specific notification settings
- Event-driven notifications (start, finish, error)

### Frontend Architecture

#### 1. Application Layer (App.tsx)
**Відповідальність**: Головний компонент, routing (якщо є)

**Структура**:
- Global state initialization
- WebSocket connection setup
- Theme provider (якщо є)
- Main layout rendering

#### 2. Node Editor (NodeEditor.tsx)
**Відповідальність**: Візуальний редактор графів

**React Flow Integration**:
```typescript
<ReactFlow
  nodes={nodes}
  edges={edges}
  onNodesChange={onNodesChange}
  onEdgesChange={onEdgesChange}
  onConnect={onConnect}
  nodeTypes={nodeTypes}
  edgeTypes={edgeTypes}
/>
```

**Ключові фічі**:
- Drag-n-drop нод з sidebar
- Connection validation
- Auto-layout (потребує уточнення)
- Zoom/Pan controls
- Mini-map (потребує уточнення)
- Undo/Redo через useHistory

#### 3. Custom Nodes (components/CustomNodes/)
**Відповідальність**: React компоненти для візуалізації нод

**Component Pattern**:
```typescript
export const ActionNode = ({ data, id }: NodeProps) => {
  const [isEditing, setIsEditing] = useState(false)
  
  return (
    <div className="custom-node">
      <Handle type="target" position={Position.Left} />
      <div className="node-content">
        {/* Node UI */}
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  )
}
```

#### 4. WebSocket Communication (hooks/useWebSocket.ts)
**Відповідальність**: Двостороння комунікація з бекендом

**Hook API**:
```typescript
const {
  sendMessage,
  lastMessage,
  connectionStatus,
  reconnect
} = useWebSocket('ws://localhost:3001/ws')
```

**Message Flow**:
```
Frontend Action → sendMessage() → Backend Handler → Response → lastMessage
```

#### 5. Console & Statistics
**Відповідальність**: Моніторинг та візуалізація

**ConsolePane**:
- Real-time лог потік через WebSocket
- Кольорове форматування по типу
- Фільтрація (success, error, info, debug)
- Auto-scroll до останнього повідомлення

**StatisticsModal**:
- Recharts для візуалізації
- Графіки змін змінних по часу
- Export до CSV/JSON

#### 6. Stream Picker (StreamPicker.tsx)
**Відповідальність**: Interactive element selection

**Механізм**:
1. Backend відправляє STREAM_FRAME (base64 JPEG)
2. Frontend рендерить в canvas
3. User клікає на елемент
4. Frontend надсилає координати
5. Backend інжектує picker script в page
6. Picker script повертає selector
7. Frontend оновлює node data

## Залежності між модулями

### Backend Dependencies

```
index.ts
├── BotEngine
│   └── nodes/* (всі handler-и)
├── browserManager
│   └── Playwright
├── auth/*
│   ├── AuthMiddleware
│   ├── CSRFMiddleware
│   └── RateLimiter
├── lifecycle/*
│   ├── BrowserLifecycle
│   ├── WebSocketLifecycle
│   ├── TimerManager
│   ├── MemoryMonitor
│   └── ShutdownManager
├── scheduler/SchedulerService
├── notifications/NotificationService
├── validation/InputValidator
└── logger
```

### Frontend Dependencies

```
App.tsx
└── NodeEditor
    ├── CustomNodes/*
    ├── ConsolePane
    ├── StreamPicker
    ├── StatisticsModal
    ├── ProjectManagerModal
    ├── ScheduleManager
    ├── Sidebar
    └── hooks/*
        ├── useWebSocket
        ├── useAutoSave
        ├── useHistory
        ├── useProjectManager
        └── useLaunchSettings
```

## Потоки даних

### 1. Project Load Flow
```
User Click "Load Project"
  ↓
Frontend: GET /api/load?name={name}
  ↓
Backend: Read {name}.json from projects/
  ↓
Backend: getOrCreateSession(name)
  ↓
Backend: Initialize session.globalVariables
  ↓
Backend: Return { nodes, edges, variables, settings }
  ↓
Frontend: Update React state
  ↓
Frontend: Render nodes in ReactFlow
```

### 2. Bot Execution Flow
```
User Click "Run"
  ↓
Frontend: WS → RUN_BOT { node, nodes, edges, settings }
  ↓
Backend: BotEngine.execute()
  ↓
Backend: Launch browser через browserManager
  ↓
Backend: Traverse DAG:
  ├── Execute node handler
  ├── Update variables
  ├── Send NODE_EXECUTING via WS
  ├── Send CONSOLE_LOG via WS
  └── Move to next nodes
  ↓
Backend: WS → BOT_FINISHED
  ↓
Frontend: Update UI state
```

### 3. Variable Update Flow
```
Node Handler: Update variable
  ↓
Backend: session.globalVariables[key] = value
  ↓
Backend: WS → GLOBAL_VARIABLES_UPDATE { variables }
  ↓
Frontend: Update local state
  ↓
Frontend: Re-render nodes with new variable values
```

### 4. Element Picker Flow
```
User Click "Pick Element"
  ↓
Frontend: WS → ACTIVATE_PICKER { nodeId, pickType }
  ↓
Backend: injectPicker(page, nodeId, pickType)
  ↓
Browser: Picker script highlights elements on hover
  ↓
User: Click element
  ↓
Browser: Generate selector (id → class → data-* → XPath)
  ↓
Backend: WS → SELECTOR_INFO_PICKED { nodeId, selector, text }
  ↓
Frontend: Update node data with selector
```

### 5. Video Stream Flow
```
Frontend: WS → START_STREAM
  ↓
Backend: Start interval (200ms):
  ├── page.screenshot({ type: 'jpeg', quality: 60 })
  ├── Convert to base64
  └── WS → STREAM_FRAME { frame: base64 }
  ↓
Frontend: Render frame in <img> or <canvas>
  ↓
Frontend: WS → STOP_STREAM
  ↓
Backend: Clear interval
```

## Патерни проєктування

### 1. Handler Pattern (Nodes)
Кожна нода має окремий handler з методом `execute()`. Це дозволяє легко додавати нові типи нод без зміни BotEngine.

### 2. Session-Per-Project Pattern
Кожен проєкт має власну ізольовану сесію з браузером та змінними. Це дозволяє запускати кілька проєктів паралельно.

### 3. DAG Traversal Pattern
BotEngine обходить граф нод як направлений ациклічний граф (DAG), підтримуючи умовні гілки та цикли.

### 4. Middleware Chain Pattern
Express middleware стек обробляє запити послідовно: CORS → Rate Limit → Auth → CSRF → Handler.

### 5. Pub/Sub Pattern (WebSocket)
Backend публікує події (NODE_EXECUTING, CONSOLE_LOG), Frontend підписується та реагує.

### 6. Lifecycle Management Pattern
Explicit управління створенням та знищенням ресурсів (браузери, WebSocket, таймери).

### 7. Semaphore Pattern
Обмеження паралельних операцій для запобігання перевантаження системи.

### 8. Repository Pattern (File-based)
JSON файли виступають як "репозиторії" для персистентності даних.

### 9. Custom Hooks Pattern (React)
Виділення логіки в reusable hooks (useWebSocket, useAutoSave, useHistory).

### 10. Controlled Components Pattern (React)
Всі форми та інпути контролюються через React state.

## Масштабування та продуктивність

### Поточні обмеження
- **Браузери**: Semaphore обмежує до 5 паралельних браузерів
- **WebSocket**: 10 підключень за хвилину per IP
- **API**: 10 запитів за хвилину per IP
- **Memory**: MemoryMonitor попереджає при > 1GB heap usage
- **File size**: JSON body limit 50MB

### Потенційні вузькі місця
1. **File I/O**: Всі операції з файлами - async, але може бути bottleneck при великій кількості проєктів
2. **Browser memory**: Кожен браузер споживає ~100-300MB RAM
3. **WebSocket broadcasting**: Надсилання video frames всім підключеним клієнтам
4. **DAG complexity**: Великі графи (>1000 нод) можуть уповільнити виконання

### Рекомендації для масштабування
1. **Database**: Перехід з JSON файлів на PostgreSQL/MongoDB
2. **Message Queue**: Redis/RabbitMQ для асинхронних задач
3. **Distributed Browsers**: Selenium Grid або Playwright Grid
4. **Load Balancer**: Nginx для розподілу навантаження
5. **Caching**: Redis для session state та часто використовуваних даних
6. **Horizontal Scaling**: Кілька інстансів бекенду з shared state

---

**Дата створення**: 2026-06-08  
**Версія**: 1.0
