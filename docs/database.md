# База даних та персистентність

## Загальний огляд

Проєкт **не використовує традиційні бази даних** (SQL чи NoSQL). Замість цього, вся персистентність реалізована через **JSON файли** у файловій системі.

## Архітектура зберігання

### Структура файлів

```
backend/projects/
├── {projectName}.json           # Дані проєкту
├── {projectName}_stats.json     # Статистика виконань
├── {projectName}_logs.json      # Логи виконань
├── {projectName}_inventory.json # Інвентар (domain-specific)
├── schedule.json                # Глобальний розклад
└── notifications.json           # Налаштування сповіщень
```

### Резервні копії

```
backend/
├── save.json      # Автоматична резервна копія останнього збереженого проєкту
└── save.json.bak  # Backup попередньої версії (потребує уточнення)
```

## Схеми даних

### 1. Project File ({projectName}.json)

**Призначення**: Головний файл проєкту з повним станом

```typescript
interface ProjectData {
  nodes: Node[]                    // Масив нод графу
  edges: Edge[]                    // Масив зв'язків між нодами
  variables: Record<string, any>   // Глобальні змінні проєкту
  launchSettings: LaunchSettings   // Налаштування запуску
  browserSettings: BrowserSettings // Налаштування браузера
  updatedAt: number                // Timestamp останнього оновлення
}
```

**Node Structure**:
```typescript
interface Node {
  id: string                       // Унікальний ID ноди (напр. "node_123")
  type: string                     // Тип ноди (напр. "action", "compare", "delay")
  position: { x: number, y: number } // Позиція на canvas
  data: Record<string, any>        // Специфічні дані ноди
}
```

**Edge Structure**:
```typescript
interface Edge {
  id: string                       // Унікальний ID зв'язку
  source: string                   // ID вихідної ноди
  target: string                   // ID цільової ноди
  sourceHandle?: string            // ID порту виходу (напр. "success", "error")
  targetHandle?: string            // ID порту входу
}
```

**LaunchSettings**:
```typescript
interface LaunchSettings {
  mode: 'manual' | 'interval' | 'schedule'  // Режим запуску
  intervalValue?: number                     // Значення інтервалу
  intervalUnit?: 'minutes' | 'hours' | 'days' // Одиниця виміру
  scheduleDays?: number[]                    // Дні тижня (0-6)
  scheduleTime?: string                      // Час запуску (HH:MM)
}
```

**BrowserSettings**:
```typescript
interface BrowserSettings {
  profile?: string                 // Назва профілю браузера
  profileDir?: string              // Шлях до профілю
  proxy?: string                   // Proxy URL (http://host:port)
  width?: number                   // Ширина вікна (default 1280)
  height?: number                  // Висота вікна (default 720)
  photoDebug?: boolean             // Debug скріншоти
}
```

**Приклад**:
```json
{
  "nodes": [
    {
      "id": "node_start",
      "type": "start",
      "position": { "x": 100, "y": 100 },
      "data": { "label": "Start" }
    },
    {
      "id": "node_browser",
      "type": "browser",
      "position": { "x": 300, "y": 100 },
      "data": {
        "url": "https://example.com",
        "waitFor": "networkidle"
      }
    }
  ],
  "edges": [
    {
      "id": "edge_1",
      "source": "node_start",
      "target": "node_browser"
    }
  ],
  "variables": {
    "counter": 0,
    "lastUrl": "https://example.com"
  },
  "launchSettings": {
    "mode": "interval",
    "intervalValue": 30,
    "intervalUnit": "minutes"
  },
  "browserSettings": {
    "profile": "Default",
    "width": 1920,
    "height": 1080,
    "photoDebug": true
  },
  "updatedAt": 1717862400000
}
```

### 2. Stats File ({projectName}_stats.json)

**Призначення**: Історія виконань проєкту для аналітики

```typescript
interface StatsEntry {
  timestamp: number                // Unix timestamp початку виконання
  duration: number                 // Тривалість в мілісекундах
  success: boolean                 // Чи успішно завершилось виконання
  nodesExecuted: number            // Кількість виконаних нод
  errors: string[]                 // Масив помилок (якщо були)
  variableSnapshots: Array<{       // Зрізи змінних по часу
    timestamp: number
    variables: Record<string, any>
  }>
}

type StatsFile = StatsEntry[]
```

**Приклад**:
```json
[
  {
    "timestamp": 1717862400000,
    "duration": 45230,
    "success": true,
    "nodesExecuted": 15,
    "errors": [],
    "variableSnapshots": [
      {
        "timestamp": 1717862410000,
        "variables": { "counter": 1, "lastUrl": "https://example.com" }
      },
      {
        "timestamp": 1717862420000,
        "variables": { "counter": 2, "lastUrl": "https://example.com/page2" }
      }
    ]
  }
]
```

### 3. Logs File ({projectName}_logs.json)

**Призначення**: Детальні логи виконань для debugging

```typescript
interface LogEntry {
  timestamp: number                // Unix timestamp
  message: string                  // Текст повідомлення
  logType: 'success' | 'error' | 'info' | 'debug'
  nodeId?: string                  // ID ноди (якщо лог з ноди)
  metadata?: Record<string, any>   // Додаткові дані
}

type LogsFile = LogEntry[]
```

**Приклад**:
```json
[
  {
    "timestamp": 1717862400000,
    "message": "Bot started for project: myProject",
    "logType": "info"
  },
  {
    "timestamp": 1717862405000,
    "message": "Browser launched successfully",
    "logType": "success",
    "nodeId": "node_browser"
  },
  {
    "timestamp": 1717862410000,
    "message": "Clicked element: #submit-button",
    "logType": "success",
    "nodeId": "node_action_1",
    "metadata": { "selector": "#submit-button" }
  },
  {
    "timestamp": 1717862415000,
    "message": "Element not found: #missing-element",
    "logType": "error",
    "nodeId": "node_action_2",
    "metadata": { "selector": "#missing-element" }
  }
]
```

### 4. Inventory File ({projectName}_inventory.json)

**Призначення**: Domain-specific дані інвентаря (для Sunflower Land)

```typescript
interface InventoryItem {
  id: string | number              // Унікальний ID предмета
  name: string                     // Назва предмета
  quantity: number                 // Кількість
  category?: string                // Категорія (crops, tools, etc.)
  metadata?: Record<string, any>   // Додаткові дані
}

interface InventoryData {
  lastUpdated: number              // Timestamp останнього оновлення
  items: InventoryItem[]           // Масив предметів
}
```

**Приклад**:
```json
{
  "lastUpdated": 1717862400000,
  "items": [
    {
      "id": "sunflower",
      "name": "Sunflower",
      "quantity": 150,
      "category": "crops"
    },
    {
      "id": "axe",
      "name": "Axe",
      "quantity": 1,
      "category": "tools"
    }
  ]
}
```

### 5. Schedule File (schedule.json)

**Призначення**: Глобальний розклад автоматичних запусків

```typescript
interface ScheduleEntry {
  projectName: string              // Назва проєкту
  enabled: boolean                 // Чи активний розклад
  mode: 'interval' | 'time'        // Тип розкладу
  intervalValue?: number           // Інтервал (хвилини)
  timeValue?: string               // Час (HH:MM)
  days?: number[]                  // Дні тижня (0-6)
  lastRun?: number                 // Timestamp останнього запуску
  nextRun?: number                 // Timestamp наступного запуску
}

type ScheduleFile = ScheduleEntry[]
```

**Приклад**:
```json
[
  {
    "projectName": "daily-scraper",
    "enabled": true,
    "mode": "time",
    "timeValue": "09:00",
    "days": [1, 2, 3, 4, 5],
    "lastRun": 1717826400000,
    "nextRun": 1717912800000
  },
  {
    "projectName": "monitoring-bot",
    "enabled": true,
    "mode": "interval",
    "intervalValue": 15,
    "lastRun": 1717862400000,
    "nextRun": 1717863300000
  }
]
```

### 6. Notifications File (notifications.json)

**Призначення**: Налаштування сповіщень для проєктів

```typescript
interface NotificationSettings {
  projectName: string              // Назва проєкту
  enabled: boolean                 // Чи увімкнені сповіщення
  telegram?: {
    chatId: string                 // Telegram chat ID
    token: string                  // Bot token
  }
  events: {
    onStart?: boolean              // Сповіщення при старті
    onFinish?: boolean             // Сповіщення при завершенні
    onError?: boolean              // Сповіщення при помилці
  }
}

type NotificationsFile = NotificationSettings[]
```

**Приклад**:
```json
[
  {
    "projectName": "critical-bot",
    "enabled": true,
    "telegram": {
      "chatId": "123456789",
      "token": "bot_token_here"
    },
    "events": {
      "onStart": false,
      "onFinish": true,
      "onError": true
    }
  }
]
```

## Операції з даними

### Читання (Read)

**Синхронний підхід (ЗАБОРОНЕНО)**:
```typescript
// ❌ НЕ РОБИТИ
const data = fs.readFileSync(filePath, 'utf-8')
```

**Асинхронний підхід (ПРАВИЛЬНО)**:
```typescript
// ✅ РОБИТИ
const fileContent = await fs.promises.readFile(filePath, 'utf-8')
const data = JSON.parse(fileContent)
```

**З обробкою помилок**:
```typescript
let projectData: ProjectData | null = null

try {
  const fileContent = await fs.promises.readFile(projectPath, 'utf-8')
  projectData = JSON.parse(fileContent)
} catch (err) {
  if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
    // Файл не знайдено - повертаємо default
    projectData = { nodes: [], edges: [], variables: {} }
  } else {
    // Інша помилка - логуємо та кидаємо
    logger.error('Failed to read project', err as Error)
    throw err
  }
}
```

### Запис (Write)

**З форматуванням**:
```typescript
const projectData = {
  nodes,
  edges,
  variables,
  launchSettings,
  browserSettings,
  updatedAt: Date.now()
}

await fs.promises.writeFile(
  filePath,
  JSON.stringify(projectData, null, 2), // Pretty print з 2 пробілами
  'utf-8'
)
```

**Атомарний запис (через temp file)**:
```typescript
const tempPath = `${filePath}.tmp`

try {
  // Пишемо в тимчасовий файл
  await fs.promises.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf-8')
  
  // Атомарно переміщуємо (rename є атомарним на більшості FS)
  await fs.promises.rename(tempPath, filePath)
} catch (err) {
  // Видаляємо temp file у разі помилки
  await fs.promises.unlink(tempPath).catch(() => {})
  throw err
}
```

### Оновлення (Update)

**Merge approach**:
```typescript
// Читаємо поточні дані
const current = JSON.parse(await fs.promises.readFile(filePath, 'utf-8'))

// Мержимо з новими даними
const updated = {
  ...current,
  nodes: newNodes,
  edges: newEdges,
  variables: { ...current.variables, ...newVariables },
  updatedAt: Date.now()
}

// Записуємо назад
await fs.promises.writeFile(filePath, JSON.stringify(updated, null, 2), 'utf-8')
```

### Видалення (Delete)

**З cleanup супутніх файлів**:
```typescript
const projectName = 'myProject'

// Видаляємо основний файл
await fs.promises.unlink(path.join(PROJECTS_DIR, `${projectName}.json`))

// Видаляємо статистику
await fs.promises.unlink(path.join(PROJECTS_DIR, `${projectName}_stats.json`))
  .catch(() => {}) // Ігноруємо якщо не існує

// Видаляємо логи
await fs.promises.unlink(path.join(PROJECTS_DIR, `${projectName}_logs.json`))
  .catch(() => {})

// Видаляємо інвентар
await fs.promises.unlink(path.join(PROJECTS_DIR, `${projectName}_inventory.json`))
  .catch(() => {})

// Видаляємо папку зображень
const imagesDir = path.join(__dirname, '../images', projectName)
await fs.promises.rm(imagesDir, { recursive: true, force: true })
  .catch(() => {})

// Видаляємо сесію з пам'яті
sessions.delete(projectName)
```

## Міграції

**Поточний стан**: Немає формальних міграцій

**Підхід до зворотної сумісності**:
```typescript
// При читанні перевіряємо старий формат
if (rawVars && typeof rawVars === 'object') {
  // Старий формат: { lastProject: '...', variables: {...} }
  if ('lastProject' in rawVars && 'variables' in rawVars) {
    session.globalVariables = rawVars.variables || {}
  } else {
    // Новий формат: { key: value, ... }
    session.globalVariables = rawVars
  }
}
```

**Рекомендації для майбутніх міграцій**:
1. Додати поле `version` до кожного файлу
2. Створити папку `migrations/` з міграційними скриптами
3. Запускати міграції при старті сервера або при читанні файлу

## Репозиторії

### ProjectRepository (концептуально)

Хоч немає явного Repository pattern, логіка розподілена по index.ts:

**Operations**:
- `GET /api/projects` → List all projects
- `GET /api/load?name={name}` → Load project
- `POST /api/save` → Save project
- `DELETE /api/projects/:name` → Delete project

**File paths**:
```typescript
const PROJECTS_DIR = path.join(__dirname, '../projects')
const projectPath = path.join(PROJECTS_DIR, `${name}.json`)
const statsPath = path.join(PROJECTS_DIR, `${name}_stats.json`)
const logsPath = path.join(PROJECTS_DIR, `${name}_logs.json`)
const inventoryPath = path.join(PROJECTS_DIR, `${name}_inventory.json`)
```

## Індексація та пошук

**Поточний стан**: Немає індексації (всі операції - лінійний пошук по файлах)

**Проблема**: При великій кількості проєктів (>1000) може бути повільно

**Потенційне рішення**:
1. In-memory Map для метаданих проєктів
2. SQLite для індексування
3. Elastic Search для full-text search

## Backup та відновлення

### Автоматичний backup

**save.json**:
```typescript
// При кожному збереженні
await fs.promises.writeFile(SAVE_PATH, JSON.stringify(projectData, null, 2), 'utf-8')
```

### Manual backup

**Рекомендована стратегія**:
```bash
# Backup всієї папки projects
tar -czf projects_backup_$(date +%Y%m%d_%H%M%S).tar.gz backend/projects/

# Відновлення
tar -xzf projects_backup_20260608_120000.tar.gz
```

## Обмеження та рекомендації

### Поточні обмеження
1. **Немає ACID** - Можливі race conditions при паралельному запису
2. **Немає транзакцій** - Часткові записи при збої
3. **Лінійний пошук** - O(n) для списку проєктів
4. **Немає compression** - JSON файли можуть бути великими
5. **Немає encryption** - Дані зберігаються у відкритому вигляді

### Рекомендації
1. **Для production** - Розглянути PostgreSQL/MongoDB
2. **Для великих даних** - Використовувати compression (gzip)
3. **Для sensitive data** - Encryption at rest
4. **Для high concurrency** - Додати file locking
5. **Для backups** - Automated daily backups

---

**Дата створення**: 2026-06-08  
**Версія**: 1.0
