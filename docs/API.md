# 📡 Довідник API та WebSocket Протоколу

Цей документ містить опис REST API ендпоінтів та протоколу обміну повідомленнями через WebSocket для платформи **Sunflower Land Bot**.

---

## ⚡ Швидкі ресурси для розробників

- 🖥️ **Інтерактивна документація Swagger UI:** доступна на живому сервері за адресою [`http://localhost:3001/api-docs`](http://localhost:3001/api-docs)
- 📄 **OpenAPI 3.0 Специфікація:** [`docs/openapi.yaml`](file:///d:/SF%20k/docs/openapi.yaml) або [`docs/openapi.json`](file:///d:/SF%20k/docs/openapi.json)
- 📮 **Postman Колекція v2.1:** [`docs/postman_collection.json`](file:///d:/SF%20k/docs/postman_collection.json) (готова до імпорту в Postman/Insomnia)
- 🤖 **Генерація клієнтських SDK (TypeScript, Kotlin, Python):** [`docs/CLIENT_GENERATION.md`](file:///d:/SF%20k/docs/CLIENT_GENERATION.md)
- 🔌 **Повна специфікація WebSocket протоколу:** [`docs/websocket-protocol.md`](file:///d:/SF%20k/docs/websocket-protocol.md)

---

## 🔐 Аутентифікація та Заголовки

Більшість ендпоінтів `/api/*` захищені middleware автентифікації та перевірки безпеки:

- **JWT Токен:** Передається в заголовку `Authorization`:
  ```http
  Authorization: Bearer <jwt_token>
  ```
- **CSRF Захист:** Для мутуючих методів (`POST`, `PUT`, `DELETE`) вимагається заголовок:
  ```http
  x-csrf-token: <csrf_token>
  ```
- **Формат тіла запитів та відповідей:** `application/json`

Усі успішні відповіді повертаються у форматі:
```json
{
  "success": true,
  "data": { ... }
}
```
У разі помилки повертається уніфікована відповідь з відповідним HTTP статус-кодом (400, 401, 403, 404, 500):
```json
{
  "success": false,
  "error": "Текст опису помилки"
}
```

---

## 📋 REST API Ендпоінти

### 1. Системні ендпоінти та Метрики

| Метод | Шлях | Опис |
| :--- | :--- | :--- |
| `GET` | `/health` | Публічний health-check для балансувальників або Docker. Повертає `{ status: 'ok', uptime }`. |
| `GET` | `/api/system/status` | Отримання статусу сервера, споживання пам'яті (RSS, Heap) та активних сесій. |
| `GET` | `/api/system/error-metrics` | Статистика збоїв: загальна кількість, розподіл за типами (`ValidationError`, `BrowserError` тощо) та останні помилки. |
| `GET` | `/api/system/cache-metrics` | Метрики LRU кешу: кількість елементів, попадань (`hits`), промахів (`misses`), hit-rate. |
| `POST`| `/api/system/restart` | Ініціація плавного перезавантаження бекенду (Graceful restart). |

---

### 2. Керування Проєктами та Графами (`/api/projects`)

| Метод | Шлях | Опис |
| :--- | :--- | :--- |
| `GET` | `/api/projects` | Отримання списку всіх наявних проектів (кешується на 60 сек). |
| `GET` | `/api/projects/overview` | Розширений огляд усіх проектів з датами модифікації та статусами. |
| `GET` | `/api/projects/status` | Поточний статус виконання кожного проекту (`idle`, `running`, `error`). |
| `GET` | `/api/projects/:name` | Отримання повної структури проекту (вузли, зв'язки, глобальні змінні). |
| `GET` | `/api/projects/:name/runs` | Історія запусків конкретного проекту (час старту, тривалість, статус). |
| `GET` | `/api/projects/:name/runs/:runId/logs` | Детальні логи конкретного запуску сценарію. |
| `GET` | `/api/projects/:name/settings` | Налаштування проекту (роздільна здатність Camoufox, тайм-аути, проксі). |
| `POST`| `/api/projects/:name/settings` | Збереження налаштувань запуску та браузера для проекту. |
| `GET` | `/api/load?name=<projectName>` | Завантаження структури графа для редактора React Flow. |
| `POST`| `/api/save` | Збереження структури графа у базу даних та JSON-файл проекту. |
| `DELETE`| `/api/projects/:name` | Видалення проекту та пов'язаних збережень. |

#### Пакетні операції:
- `POST /api/projects/run-multiple` — пакетний запуск вибраного списку проектів.
- `POST /api/projects/stop-multiple` — пакетна зупинка виконання.
- `POST /api/projects/copy-nodes` — копіювання виділених нод між різними проектами.
- `POST /api/projects/run-sequential` — черга послідовного виконання проектів один за одним.

---

### 3. Керування Браузером та Сесіями (`/api/browser`)

| Метод | Шлях | Опис |
| :--- | :--- | :--- |
| `GET` | `/api/browser-env` | Перевірка стану середовища Camoufox, шляху до бінарника та версії. |
| `POST`| `/api/browser/open/:projectName` | Ручний запуск сесії браузера з профілем проекту без запуску сценарію. |
| `POST`| `/api/browser/close/:projectName` | Закриття активного вікна браузера для зазначеного проекту. |
| `GET` | `/api/browser/status/:projectName` | Перевірка, чи відкритий браузер для проекту та чи підключено CDP. |
| `GET` | `/api/browser/page-source/:projectName` | Отримання поточного HTML-коду сторінки гри (для відладки селекторів). |
| `GET` | `/api/browser/profiles` | Список збережених каталогів профілів у `/profiles`. |
| `GET` | `/api/browser/proxies` | Список доступних проксі-серверів з файлу `proxies.txt`. |

---

### 4. Інвентар та Аналітика (`/api/inventory`, `/api/stats`)

| Метод | Шлях | Опис |
| :--- | :--- | :--- |
| `GET` | `/api/all-inventories` | Зведений інвентар по всіх проектах ферм одночасно. |
| `GET` | `/api/inventory/overview` | Згрупований огляд предметів за категоріями (культури, насіння, ресурси). |
| `GET` | `/api/inventory/:projectName` | Останній відсканований інвентар конкретної ферми. |
| `GET` | `/api/global-stats` | Глобальна статистика фермерства: загальний прибуток, час роботи, кількість циклів. |
| `GET` | `/api/stats/:name` | Статистика по окремому проекту. |
| `GET` | `/api/stats/errors` | Системні логи помилок та винятків. |

---

## ⚡ WebSocket Протокол (`/ws`)

WebSocket сервер доступний за адресою:
```text
ws://<server_host>:3001/ws
```

### 1. Повідомлення від Клієнта до Сервера (Client ➡️ Server)

#### Запуск сценарію (`RUN_BOT`):
```json
{
  "type": "RUN_BOT",
  "node": { "id": "start-1" },
  "nodes": [
    { "id": "start-1", "type": "startNode", "position": { "x": 100, "y": 100 }, "data": {} },
    { "id": "action-1", "type": "actionNode", "position": { "x": 300, "y": 100 }, "data": { "action": "click" } }
  ],
  "edges": [
    { "id": "e1", "source": "start-1", "target": "action-1", "sourceHandle": "out", "targetHandle": "in" }
  ]
}
```

#### Зупинка бота (`STOP_BOT`):
```json
{
  "type": "STOP_BOT"
}
```

#### Керування стрімінгом екрану (`START_STREAM`, `STOP_STREAM`):
```json
{
  "type": "START_STREAM"
}
```

#### Інтерактивний вибір селектора (`PICK_SELECTOR`):
```json
{
  "type": "PICK_SELECTOR",
  "nodeId": "selector-node-123"
}
```

---

### 2. Повідомлення від Сервера до Клієнта (Server ➡️ Client)

#### Зміна статусу роботи (`BOT_RUNNING_STATE`):
```json
{
  "type": "BOT_RUNNING_STATE",
  "isRunning": true
}
```

#### Поточний виконуваний вузол (`NODE_EXECUTING`):
```json
{
  "type": "NODE_EXECUTING",
  "nodeId": "action-1",
  "nodeTitle": "Посадка соняшників",
  "parentGroupId": "group-crops-1"
}
```

#### Кадр відеостріму гри (`STREAM_FRAME`):
```json
{
  "type": "STREAM_FRAME",
  "frame": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD..."
}
```

#### Лог виконання (`CONSOLE_LOG`):
```json
{
  "type": "CONSOLE_LOG",
  "message": "[Farm_1] Успішно посаджено 22 насінини соняшника",
  "logType": "success"
}
```

#### Обраний селектор (`SELECTOR_INFO_PICKED`):
```json
{
  "type": "SELECTOR_INFO_PICKED",
  "nodeId": "selector-node-123",
  "selector": "button[data-testid=\"harvest-button\"]"
}
```
