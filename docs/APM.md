# ⏱️ Моніторинг продуктивності та профілювання (APM & Tracing)

Цей документ описує підсистему **APM (Application Performance Monitoring)**, розподіленого трасування (Distributed Tracing), профілювання пам'яті, моніторингу бази даних та клієнтського моніторингу реальних користувачів (**RUM**) для платформи **Sunflower Land Bot**.

---

## 🎯 Навіщо потрібен APM у проєкті?

Робота бота поєднує веб-інтерфейс, запуск важких браузерних процесів Camoufox (Firefox), комп'ютерний зір, базу даних SQLite та сотні асинхронних подій WebSocket. За таких умов виявлення вузьких місць "на око" неможливе.

**APM підсистема забезпечує:**
- **Розподілене трасування (Distributed Tracing):** відстеження шляху запиту від кліка у фронтенді через Express middleware, базу даних SQLite, до закриття браузера.
- **Детекція повільних запитів (Slow Query Detection):** автоматична фіксація будь-яких SQL-запитів до SQLite, що виконуються довше **20 мс**.
- **Профілювання пам'яті та Event Loop:** виявлення витоків пам'яті (Memory Leaks), аналіз росту Heap та вимірювання затримок черги подій Node.js.
- **Кореляція помилок (Error Correlation):** прив'язка кожної помилки чи падіння браузера до унікального `traceId` транзакції.
- **Real User Monitoring (RUM):** збір метрик завантаження інтерфейсу (TTFB, FCP, LCP) та помилок JavaScript з реальних браузерів користувачів.
- **OpenTelemetry & Vendor Ready:** експорт трас у стандартному форматі OTLP для підключення до **Jaeger**, **Grafana Tempo**, **Datadog** або **New Relic**.

---

## 📐 Архітектура APM підсистеми

```mermaid
flowchart TD
    subgraph Client["Клієнтський рівень (Frontend / RUM)"]
        BrowserUI["Web UI / Dashboard"]
        RUMCollector["RUM Collector (Navigation, FCP, LCP)"]
        BrowserUI --> RUMCollector
    end

    subgraph Gateway["Express HTTP & WebSocket"]
        APMMiddleware["APM Middleware (X-Trace-Id)"]
        Router["API Routes & Error Middleware"]
    end

    subgraph Core["Сервісне ядро APM (APMService)"]
        TxManager["Менеджер транзакцій (p50, p95, p99)"]
        DBMonitor["DB Monitor (Запити > 20мс)"]
        ResourceMonitor["Memory & Event Loop Profiler"]
        RUMAggregator["RUM Aggregator"]
    end

    subgraph Targets["Цільові системи & Сховище"]
        SQLite[(SQLite sf.db)]
        Camoufox["Camoufox Browser"]
        OTLPExport["OpenTelemetry OTLP (Jaeger/Tempo)"]
    end

    RUMCollector -->|POST /api/system/rum| Router
    BrowserUI -->|HTTP Запит + traceparent| APMMiddleware
    APMMiddleware --> Router
    APMMiddleware --> TxManager

    Router --> DBMonitor
    DBMonitor -->|Instrumented prepare()| SQLite
    Router --> Camoufox

    ResourceMonitor -->|process.memoryUsage() + cpuUsage()| Core
    TxManager --> OTLPExport
```

---

## 🔍 1. Розподілене трасування (Distributed Tracing)

### 1.1 Генерація та передача `traceId`
Кожен вхідний запит отримує унікальний ідентифікатор траси:
- Якщо клієнт передає заголовок **W3C TraceContext** (`traceparent: 00-<trace_id>-<span_id>-01`), сервер використовує цей `trace_id`.
- Якщо заголовок відсутній, сервер генерує новий 128-бітний ідентифікатор.
- Сервер повертає заголовок відповіді:
  ```http
  X-Trace-Id: 4f8b91c2e0a34b21d5a76e9f1c308210
  ```

### 1.2 Структура спанів (Spans Breakdown)
Транзакція розбивається на окремі спани з мікросекундною точністю (`performance.now()`):
- `middleware`: час проходження через Express CORS, RateLimiter та Auth.
- `db`: час виконання SQL-запитів до SQLite.
- `browser`: час старту або взаємодії з процесом Camoufox.
- `websocket`: час обробки команд `RUN_BOT`, `START_STREAM` тощо.

### 1.3 Розрахунок процентилів затримок
APM обчислює статистику затримок на ковзному вікні:
- **p50 (Медіана):** типовий час відповіді системи (зазвичай < 5 мс).
- **p90 / p95:** час відповіді для 90–95% запитів (норма: < 50 мс).
- **p99:** найгірші 1% запитів, що вказують на блокуючі операції чи черги.
- **Error Rate:** відсоток транзакцій, що завершилися зі статусом `error`.

---

## 🗄️ 2. Моніторинг бази даних (Database Performance)

Усі операції з базою даних SQLite автоматично перехоплюються через обгортку `db.prepare()` у [`src/db/schema.ts`](file:///d:/SF%20k/backend/src/db/schema.ts):

- **Поріг повільного запиту:** **20 мс** (`SLOW_QUERY_THRESHOLD_MS`).
- Будь-який запит, що перевищує цей поріг:
  1. Логується логером як попередження `[WARN] [APM] Повільний запит до БД (X мс)`.
  2. Записується у кільцевий буфер повільних запитів (`slowQueries`).
  3. Зберігає нормалізований SQL, точний час виконання, параметри та `traceId`.

---

## 🧠 3. Профілювання ресурсів та Event Loop

Сервіс здійснює регулярні вимірювання стану процесу:

### 3.1 Пам'ять (Memory Profiling):
- Знімаються показники `heapUsed`, `heapTotal`, `rss`, `external`.
- **Детектор витоків пам'яті:** якщо протягом останніх 6 знімків (3 хвилини) спостерігається постійний ріст купи (`heapUsed`) без зниження після збирання сміття, прапорець `memoryLeakSuspected` переходить у стан `true`.

### 3.2 Лаги Event Loop (Event Loop Lag):
- За допомогою таймера з високою точністю вимірюється відхилення між запланованим і реальним часом виконання колбеку.
- Якщо затримка перевищує **50 мс**, це сигналізує про важкі синхронні операції в коді (наприклад, блокуючий парсинг зображень або JSON).

---

## 🌐 4. Real User Monitoring (RUM)

Фронтенд-модуль [`frontend/src/utils/rum.ts`](file:///d:/SF%20k/frontend/src/utils/rum.ts) автоматично збирає показники реальних користувачів:

- **TTFB (Time To First Byte):** час до отримання першого байта відповіді від сервера.
- **FCP (First Contentful Paint):** час до першого відтворення вмісту (норма: < 1.8с).
- **LCP (Largest Contentful Paint):** час рендерингу найбільшого видимого блоку (норма: < 2.5с).
- **DOMContentLoaded та Page Load Time:** загальний час ініціалізації веб-інтерфейсу.
- **Клієнтські помилки JS:** автоматичне перехоплення `window.onerror` та `unhandledrejection`.

Дані передаються на бекенд у фоновому режимі через `navigator.sendBeacon('/api/system/rum')`, не блокуючи інтерфейс користувача.

---

## 🔌 5. REST API Ендпоінти APM

| Метод | Шлях | Опис |
| :--- | :--- | :--- |
| `GET` | `/api/system/apm-metrics` | Зведений звіт продуктивності: p50/p95/p99 затримки, активні запити, використання RAM/CPU, лаг Event Loop, стан RUM. |
| `GET` | `/api/system/traces` | Список останніх транзакцій із вкладеними спанами для візуалізації Waterfall / Flamegraph. |
| `GET` | `/api/system/slow-queries` | Список усіх зафіксованих повільних SQL-запитів із тривалістю та SQL-текстом. |
| `GET` | `/api/system/traces/otlp` | Експорт трас у стандартному форматі OpenTelemetry OTLP JSON. |
| `POST`| `/api/system/rum` | Прийом метрик Web Vitals та помилок клієнта з браузера. |
| `GET` | `/api/system/rum` | Агрегована статистика клієнтської продуктивності та рейтинги Google Web Vitals. |

---

## 📊 6. Інтеграція з зовнішніми системами (OpenTelemetry, Datadog)

### 6.1 Експорт в Jaeger / Grafana Tempo
Ендпоінт `GET /api/system/traces/otlp` формує потік трас відповідно до специфікації **OpenTelemetry ResourceSpans v1**. Ви можете налаштувати **OpenTelemetry Collector** для періодичного опитування або пересилання даних у Grafana чи Jaeger:

```yaml
# Приклад конфігурації otel-collector.yaml
receivers:
  otlp:
    protocols:
      http:
        endpoint: 0.0.0.0:4318

exporters:
  otlp/tempo:
    endpoint: tempo:4317
    tls:
      insecure: true

service:
  pipelines:
    traces:
      receivers: [otlp]
      exporters: [otlp/tempo]
```

### 6.2 Підключення Datadog або New Relic
Якщо ви використовуєте Datadog APM, достатньо встановити `dd-trace` та додати прапорець запуску:
```bash
NODE_OPTIONS="--require dd-trace/init" pnpm start
```
