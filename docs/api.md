# API Документація

## Загальний огляд

Проєкт надає два типи API:
1. **REST API** - HTTP endpoints для CRUD операцій
2. **WebSocket API** - Real-time двостороння комунікація

## Base URL

### Development
- REST API: `http://localhost:3001/api`
- WebSocket: `ws://localhost:3001/ws`

### Production
- REST API: `https://your-domain.com/api`
- WebSocket: `wss://your-domain.com/ws`

## Автентифікація

### JWT Authentication

Більшість REST endpoints вимагають JWT токен в Authorization header:

```http
Authorization: Bearer <jwt_token>
```

**Отримання токену**: (Потребує уточнення - endpoint не знайдено в коді)

### CSRF Protection

POST, PUT, DELETE запити вимагають CSRF токен:

```http
X-CSRF-Token: <csrf_token>
```

**Отримання CSRF токену**: (Потребує уточнення - endpoint не знайдено в коді)

### Rate Limiting

**API Endpoints**:
- 10 запитів на хвилину per IP
- Header: `X-RateLimit-Limit: 10`

**WebSocket**:
- 10 підключень на хвилину per IP

## REST API Endpoints

### Health Check

#### GET /health

Перевірка стану сервера (не вимагає автентифікації)

**Request**:
```http
GET /health
```

**Response** (200 OK):
```json
{
  "status": "ok",
  "timestamp": "2026-06-08T12:00:00.000Z",
  "uptime": 3600,
  "memory": {
    "heapUsed": 150,
    "heapTotal": 200,
    "rss": 250,
    "external": 10
  },
  "activeSessionCount": 5,
  "activeBrowserCount": 3
}
```

---

### Projects

#### GET /api/projects

Отримання списку всіх проєктів

**Authentication**: Required (JWT)

**Request**:
```http
GET /api/projects
Authorization: Bearer <token>
```

**Response** (200 OK):
```json
[
  "project1",
  "project2",
  "daily-scraper"
]
```

**Response** (401 Unauthorized):
```json
{
  "success": false,
  "error": "Unauthorized"
}
```

**Response** (429 Too Many Requests):
```json
{
  "success": false,
  "error": "Too many requests, please try again later"
}
```

---

#### GET /api/load

Завантаження проєкту за назвою

**Authentication**: Required (JWT)

**Query Parameters**:
- `name` (string, optional) - Назва проєкту (default: "default")

**Request**:
```http
GET /api/load?name=myProject
Authorization: Bearer <token>
```

**Response** (200 OK):
```json
{
  "nodes": [
    {
      "id": "node_1",
      "type": "start",
      "position": { "x": 100, "y": 100 },
      "data": { "label": "Start" }
    }
  ],
  "edges": [
    {
      "id": "edge_1",
      "source": "node_1",
      "target": "node_2"
    }
  ],
  "variables": {
    "counter": 0,
    "lastUrl": ""
  },
  "launchSettings": {
    "mode": "manual"
  },
  "browserSettings": {
    "width": 1280,
    "height": 720
  }
}
```

**Response** (400 Bad Request):
```json
{
  "success": false,
  "error": "Invalid project name. Only alphanumeric, dashes, and underscores allowed."
}
```

**Response** (500 Internal Server Error):
```json
{
  "success": false,
  "error": "Failed to load project. Please try again later."
}
```

---

#### POST /api/save

Збереження проєкту

**Authentication**: Required (JWT)  
**CSRF Protection**: Required

**Request**:
```http
POST /api/save
Authorization: Bearer <token>
X-CSRF-Token: <csrf_token>
Content-Type: application/json

{
  "name": "myProject",
  "data": {
    "nodes": [...],
    "edges": [...],
    "variables": { "counter": 5 },
    "launchSettings": { "mode": "interval", "intervalValue": 30 },
    "browserSettings": { "width": 1920, "height": 1080 }
  }
}
```

**Response** (200 OK):
```json
{
  "success": true
}
```

**Response** (400 Bad Request):
```json
{
  "success": false,
  "error": "Name is required"
}
```

**Response** (400 Bad Request - Invalid Structure):
```json
{
  "success": false,
  "error": "Project must contain nodes and edges arrays"
}
```

---

#### DELETE /api/projects/:name

Видалення проєкту

**Authentication**: Required (JWT)  
**CSRF Protection**: Required

**Request**:
```http
DELETE /api/projects/myProject
Authorization: Bearer <token>
X-CSRF-Token: <csrf_token>
```

**Response** (200 OK):
```json
{
  "success": true
}
```

**Response** (404 Not Found):
```json
{
  "success": false,
  "error": "Project not found"
}
```

---

#### GET /api/projects/status

Статус всіх активних проєктів

**Authentication**: Required (JWT)

**Request**:
```http
GET /api/projects/status
Authorization: Bearer <token>
```

**Response** (200 OK):
```json
{
  "project1": {
    "isRunning": true,
    "browserAlive": true,
    "lastExecutionTime": 1717862400000
  },
  "project2": {
    "isRunning": false,
    "browserAlive": false,
    "lastExecutionTime": null
  }
}
```

---

#### POST /api/projects/run-multiple

Запуск кількох проєктів одночасно

**Authentication**: Required (JWT)  
**CSRF Protection**: Required  
**Rate Limiting**: Special (5 req/min)

**Request**:
```http
POST /api/projects/run-multiple
Authorization: Bearer <token>
X-CSRF-Token: <csrf_token>
Content-Type: application/json

{
  "projectNames": ["project1", "project2"],
  "projectSettings": {
    "project1": {
      "profile": "Profile1",
      "width": 1920,
      "height": 1080
    },
    "project2": {
      "profile": "Profile2"
    }
  }
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "started": ["project1", "project2"]
}
```

---

#### POST /api/projects/stop-multiple

Зупинка кількох проєктів

**Authentication**: Required (JWT)  
**CSRF Protection**: Required

**Request**:
```http
POST /api/projects/stop-multiple
Authorization: Bearer <token>
X-CSRF-Token: <csrf_token>
Content-Type: application/json

{
  "projectNames": ["project1", "project2"]
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "stopped": ["project1", "project2"]
}
```

---

### Statistics

#### GET /api/stats/:name

Статистика виконань проєкту

**Authentication**: Required (JWT)

**Request**:
```http
GET /api/stats/myProject
Authorization: Bearer <token>
```

**Response** (200 OK):
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
        "variables": { "counter": 1 }
      }
    ]
  }
]
```

**Response** (200 OK - Empty):
```json
[]
```

---

#### GET /api/global-stats

Глобальна статистика всіх проєктів

**Authentication**: Required (JWT)

**Request**:
```http
GET /api/global-stats
Authorization: Bearer <token>
```

**Response** (200 OK):
```json
[
  {
    "projectName": "project1",
    "stats": [
      {
        "timestamp": 1717862400000,
        "duration": 30000,
        "success": true
      }
    ]
  },
  {
    "projectName": "project2",
    "stats": []
  }
]
```

---

### Logs

#### GET /api/logs/:name

Логи виконань проєкту

**Authentication**: Required (JWT)

**Request**:
```http
GET /api/logs/myProject
Authorization: Bearer <token>
```

**Response** (200 OK):
```json
[
  {
    "timestamp": 1717862400000,
    "message": "Bot started",
    "logType": "info"
  },
  {
    "timestamp": 1717862405000,
    "message": "Browser launched",
    "logType": "success",
    "nodeId": "node_browser"
  }
]
```

---

### Browser Settings

#### GET /api/browser-env

Дефолтні налаштування браузера з .env

**Authentication**: Required (JWT)

**Request**:
```http
GET /api/browser-env
Authorization: Bearer <token>
```

**Response** (200 OK):
```json
{
  "defaultProfile": "Default",
  "defaultProfileDir": "C:\\Users\\User\\AppData\\Local\\Chrome\\User Data"
}
```

---

### Images

#### GET /api/images

Список зображень у папці images/

**Authentication**: Required (JWT)

**Request**:
```http
GET /api/images
Authorization: Bearer <token>
```

**Response** (200 OK):
```json
[
  "screenshot1.png",
  "element_picker.jpg",
  "debug_node_123.png"
]
```

---

### Inventory

#### GET /api/inventory/:projectName

Інвентар конкретного проєкту

**Authentication**: Required (JWT)

**Request**:
```http
GET /api/inventory/myProject
Authorization: Bearer <token>
```

**Response** (200 OK):
```json
{
  "lastUpdated": 1717862400000,
  "items": [
    {
      "id": "sunflower",
      "name": "Sunflower",
      "quantity": 150,
      "category": "crops"
    }
  ]
}
```

---

#### GET /api/inventory/overview

Зведена таблиця інвентарів всіх проєктів

**Authentication**: (Потребує уточнення - в коді відключена для тестування)

**Request**:
```http
GET /api/inventory/overview
```

**Response** (200 OK):
```json
{
  "accounts": [
    {
      "name": "Account1",
      "resources": {
        "sunflower": 150,
        "axe": 1
      }
    }
  ],
  "totals": {
    "sunflower": 150,
    "axe": 1
  }
}
```

---

## WebSocket API

### Connection

**URL**: `ws://localhost:3001/ws?project=myProject`

**Query Parameters**:
- `project` (string, required) - Назва проєкту

**Example (JavaScript)**:
```javascript
const ws = new WebSocket('ws://localhost:3001/ws?project=myProject')

ws.onopen = () => {
  console.log('Connected to WebSocket')
}

ws.onmessage = (event) => {
  const message = JSON.parse(event.data)
  console.log('Received:', message)
}

ws.onerror = (error) => {
  console.error('WebSocket error:', error)
}

ws.onclose = () => {
  console.log('Disconnected from WebSocket')
}
```

---

### Messages: Frontend → Backend

#### RUN_BOT

Запуск повного сценарію

**Message**:
```json
{
  "type": "RUN_BOT",
  "node": {
    "id": "node_start",
    "type": "start"
  },
  "nodes": [...],
  "edges": [...],
  "settings": {
    "width": 1280,
    "height": 720,
    "profile": "Default",
    "proxy": "http://proxy:8080"
  }
}
```

---

#### RUN_SINGLE_NODE

Запуск однієї ноди (для тестування)

**Message**:
```json
{
  "type": "RUN_SINGLE_NODE",
  "node": {
    "id": "node_action",
    "type": "action",
    "data": {
      "action": "click",
      "selector": "#submit-button"
    }
  },
  "nodes": [...],
  "edges": [...]
}
```

---

#### STOP_BOT

Зупинка виконання бота

**Message**:
```json
{
  "type": "STOP_BOT"
}
```

---

#### LAUNCH_BROWSER

Запуск браузера без виконання сценарію

**Message**:
```json
{
  "type": "LAUNCH_BROWSER",
  "settings": {
    "width": 1920,
    "height": 1080,
    "profile": "Default",
    "profileDir": "/path/to/profile",
    "proxy": "http://proxy:8080"
  }
}
```

---

#### CLOSE_BROWSER

Закриття браузера

**Message**:
```json
{
  "type": "CLOSE_BROWSER"
}
```

---

#### INTERACT_BROWSER

Взаємодія з браузером (клік, scroll, hover)

**Message (Click)**:
```json
{
  "type": "INTERACT_BROWSER",
  "action": "click",
  "x": 640,
  "y": 480
}
```

**Message (Scroll)**:
```json
{
  "type": "INTERACT_BROWSER",
  "action": "scroll",
  "deltaY": 100
}
```

**Message (Hover)**:
```json
{
  "type": "INTERACT_BROWSER",
  "action": "hover",
  "x": 640,
  "y": 480
}
```

**Message (Double Click)**:
```json
{
  "type": "INTERACT_BROWSER",
  "action": "double_click",
  "x": 640,
  "y": 480
}
```

---

#### ACTIVATE_PICKER

Активація element picker

**Message**:
```json
{
  "type": "ACTIVATE_PICKER",
  "nodeId": "node_123",
  "pickType": "selector"
}
```

---

#### UPDATE_VARIABLE

Оновлення глобальної змінної

**Message**:
```json
{
  "type": "UPDATE_VARIABLE",
  "name": "counter",
  "value": 10
}
```

---

#### START_STREAM

Запуск відеотрансляції браузера

**Message**:
```json
{
  "type": "START_STREAM"
}
```

---

#### STOP_STREAM

Зупинка відеотрансляції

**Message**:
```json
{
  "type": "STOP_STREAM"
}
```

---

### Messages: Backend → Frontend

#### GLOBAL_VARIABLES_UPDATE

Оновлення глобальних змінних

**Message**:
```json
{
  "type": "GLOBAL_VARIABLES_UPDATE",
  "variables": {
    "counter": 5,
    "lastUrl": "https://example.com"
  }
}
```

---

#### BOT_RUNNING_STATE

Статус запуску бота

**Message**:
```json
{
  "type": "BOT_RUNNING_STATE",
  "isRunning": true
}
```

---

#### NODE_EXECUTING

Виконання конкретної ноди

**Message**:
```json
{
  "type": "NODE_EXECUTING",
  "nodeId": "node_action_1",
  "nodeTitle": "Click Submit Button"
}
```

---

#### BOT_FINISHED

Завершення виконання бота

**Message**:
```json
{
  "type": "BOT_FINISHED"
}
```

---

#### CONSOLE_LOG

Лог повідомлення

**Message**:
```json
{
  "type": "CONSOLE_LOG",
  "message": "Browser launched successfully",
  "logType": "success"
}
```

**Log Types**:
- `success` - ✅ Успішна операція
- `error` - ❌ Помилка
- `info` - ℹ️ Інформаційне повідомлення
- `debug` - 🔍 Debug інформація

---

#### UPDATE_NODE_DATA

Оновлення даних ноди

**Message**:
```json
{
  "type": "UPDATE_NODE_DATA",
  "nodeId": "node_123",
  "newData": {
    "resultCount": 5,
    "lastValue": "test"
  }
}
```

---

#### STREAM_FRAME

Кадр відеотрансляції

**Message**:
```json
{
  "type": "STREAM_FRAME",
  "frame": "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
}
```

**Frequency**: ~200ms (5 FPS)

---

#### SELECTOR_INFO_PICKED

Інформація про обраний селектор

**Message**:
```json
{
  "type": "SELECTOR_INFO_PICKED",
  "nodeId": "node_action_1",
  "pickType": "selector",
  "selector": "#submit-button",
  "text": "Submit",
  "attributes": {
    "class": "btn btn-primary",
    "id": "submit-button"
  }
}
```

---

## Chrome DevTools Protocol (CDP)

### Base URL
`http://localhost:9222`

### Endpoints

#### GET /json

Список активних targets (tabs, pages)

**Response**:
```json
[
  {
    "description": "",
    "devtoolsFrontendUrl": "/devtools/inspector.html?ws=localhost:9222/devtools/page/...",
    "id": "page_1",
    "title": "Example Page",
    "type": "page",
    "url": "https://example.com",
    "webSocketDebuggerUrl": "ws://localhost:9222/devtools/page/..."
  }
]
```

#### GET /devtools/page/{id}

WebSocket підключення до конкретної сторінки для CDP commands

---

## Error Handling

### Standard Error Response

```json
{
  "success": false,
  "error": "Error message here"
}
```

### HTTP Status Codes

- `200 OK` - Успішна операція
- `400 Bad Request` - Невалідні вхідні дані
- `401 Unauthorized` - Відсутній або невалідний JWT токен
- `403 Forbidden` - CSRF токен відсутній або невалідний
- `404 Not Found` - Ресурс не знайдено
- `429 Too Many Requests` - Rate limit перевищено
- `500 Internal Server Error` - Внутрішня помилка сервера

---

## Rate Limiting Headers

```http
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1717862460000
```

---

## CORS

**Allowed Origins**: `*` (всі домени)  
**Allowed Methods**: `GET, POST, PUT, DELETE, OPTIONS`  
**Allowed Headers**: `Authorization, Content-Type, X-CSRF-Token`

---

## Security Best Practices

1. **Завжди використовувати HTTPS** в production
2. **Зберігати JWT токен** в httpOnly cookies або secure storage
3. **Не передавати sensitive data** в URL query параметрах
4. **Валідувати вхідні дані** на клієнті перед відправкою
5. **Обробляти помилки** без розкриття внутрішніх деталей

---

**Дата створення**: 2026-06-08  
**Версія**: 1.0
