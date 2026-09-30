# ⚙️ Sunflower Land Bot Backend Engine

Серверна частина платформи Sunflower Land Bot Constructor. Побудована на базі Node.js, Express, Playwright з антидетект-рушієм Camoufox, високопродуктивної бази даних SQLite (WAL mode) та модульної системи графів автоматизації.

---

## 🛠️ Технологічний стек

- **Runtime & Мова:** [Node.js](https://nodejs.org/) (v20+) + [TypeScript](https://www.typescriptlang.org/) (v5.4+)
- **Веб-фреймворк:** [Express](https://expressjs.com/) (REST API, Error Middleware, CORS, Static Serving)
- **Real-time Комунікація:** [ws](https://github.com/websockets/ws) (WebSocket сервер для стрімінгу CDP, подій виконання та логів)
- **Автоматизація браузера:** [Playwright](https://playwright.dev/) + [Camoufox](https://camoufox.com/) (Firefox антидетект-браузер з підміною апаратних відбитків)
- **База даних:** [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) (SQLite у режимі Write-Ahead Logging `WAL` з індексацією)
- **Кешування:** Власний швидкий `CacheService` (in-memory LRU з TTL та інвалідацією за шаблонами)
- **Обробка зображень:** `canvas`, `pngjs`, `sharp` (комп'ютерний зір для розпізнавання міні-ігор)
- **Безпека та токени:** `jsonwebtoken`, `bcryptjs`, валідація схем через `zod`

---

## 📂 Структура директорій

```text
backend/
├── data/                       # Локальне сховище бази даних SQLite (sf.db, sf.db-wal)
├── projects/                   # Збережені сценарії та графи у форматі JSON
├── profiles/                   # Профілі користувачів Camoufox (кукі, сесії гри)
└── src/
    ├── auth/                   # Генерація та валідація JWT токенів, паролі
    ├── cache/                  # CacheService — In-Memory кеш з підтримкою TTL та LRU
    ├── concurrency/            # Семафори та обмеження кількості паралельних браузерів
    ├── config/                 # Завантаження змінних середовища та конфігурація
    ├── controllers/            # Обробники маршрутів Express (REST API)
    ├── db/                     # Ініціалізація SQLite, міграції та запити до БД
    ├── engine/                 # BotEngine — рушій виконання вузлових графів сценаріїв
    ├── errors/                 # Типізовані класи помилок (AppError, ValidationError тощо)
    ├── nodes/                  # Реєстр та код виконання всіх доступних нод автоматизації
    ├── routes/                 # Маршрутизація Express (эндпоінти /api/*)
    ├── runner/                 # MassLaunchRunner та фоновий планувальник за розкладом
    ├── services/               # Бізнес-логіка (інвентар, проекти, системні звіти)
    ├── utils/                  # Утиліти: retry з backoff, errorMetrics, logger
    ├── websocket/              # Обробка WebSocket підключень та трансляція CDP
    ├── browserManager.ts       # Управління життєвим циклом Camoufox сесій
    ├── index.ts                # Головна точка входу додатку, graceful shutdown
    └── logger.ts               # Централізована система логування (безпечна до циклів)
```

---

## 🧠 Ключові концепції архітектури

### 1. BotEngine (`src/engine/BotEngine.ts`)
Рушій виконання графів сценаріїв. Отримує масив вузлів (`nodes`) та з'єднань (`edges`) з фронтенду:
- Визначає початкову ноду (`startNode`) та обходить граф за з'єднаннями (`handles`).
- Підтримує галуження умов (`conditionNode`), цикли (`loopNode`) та групи (`groupNode`).
- Зберігає локальний стан контексту виконання та глобальні змінні.
- Відправляє повідомлення в режимі реального часу через WebSocket (`NODE_EXECUTING`, `NODE_DATA_UPDATE`, `CONSOLE_LOG`).

### 2. BrowserManager (`src/browserManager.ts`)
Центральний менеджер браузерних сесій:
- Створює та керує екземплярами **Camoufox** із збереженням постійного профілю (`/profiles/<projectName>`).
- Запобігає виявленню автоматизації через глибоке маскування фінгерпринтів браузера.
- Підключається до сторінки гри через **Chrome DevTools Protocol (CDP)** та запускає трансляцію скрінкасту (`Page.startScreencast`).
- Підтримує інтерактивний вибір селекторів кліком прямо у браузері.
- Використовує семафори (`Semaphore`) для обмеження максимальної кількості активних браузерів у системі.

### 3. Система нод (`src/nodes/`)
Кожна нода є автономним модулем, що реалізує інтерфейс обробника:
```typescript
export interface NodeHandler {
  (context: NodeExecutionContext, data: NodeData): Promise<NodeResult>;
}
```
- **`NodeExecutionContext`:** Надає доступ до поточної сторінки Playwright `page`, браузера, глобальних змінних, логера та сесії.
- **`NodeData`:** Дані, налаштовані користувачем у UI або передані з попередньої ноди.
- **`NodeResult`:** Результат виконання: наступний вихідний порт (`nextHandle`), оновлені дані ноди (`updateNodeData`) або прапорець переривання.

Всі ноди реєструються у єдиному реєстрі `src/nodes/index.ts`.

### 4. Кешування (`src/cache/CacheService.ts`)
Для зниження навантаження на SQLite реалізовано кеш у пам'яті:
- Проекти та огляди кешуються з TTL 60–300 секунд.
- При операціях запису (створення, оновлення, видалення) кеш автоматично інвалідується за шаблоном (`projects:*`).
- Забезпечує миттєву відповідь для списків та глобальної статистики (< 1 мс замість 50-100 мс звернення до диска).

### 5. Обробка помилок та Надійність
- **Типізовані помилки:** `AppError`, `ValidationError`, `DatabaseError`, `BrowserError`, `AuthenticationError`, `NotFoundError` (знаходяться в `src/errors/AppError.ts`).
- **Централізований Middleware:** Єдиний обробник помилок Express у `src/index.ts`, який повертає уніфіковану відповідь `{ success: false, error: '...' }` та статус код.
- **Метрики збоїв:** Сервіс `ErrorMetrics` відстежує кількість помилок за категоріями, частоту та останні повідомлення (`/api/system/error-metrics`).
- **Стійкий Retry:** Утиліта `withRetry` у `src/utils/retry.ts` забезпечує повторення критичних операцій з експоненційним backoff та jitter.
- **Graceful Shutdown:** При отриманні сигналів `SIGINT` або `SIGTERM` викликається `flushPendingLogs()`, коректно зупиняються активні браузери Camoufox та закривається з'єднання з SQLite.

---

## 🚀 Як створити нову ноду (Покроковий гайд)

Щоб додати новий функціональний блок автоматизації в систему:

### Крок 1. Створіть файл обробника в `src/nodes/`
Створіть, наприклад, `src/nodes/WaterCropsNode.ts`:

```typescript
import { NodeExecutionContext } from '../types';
import { NodeResult, NodeData } from '@sf/shared-types';
import { logger } from '../logger';

export interface WaterCropsNodeConfig {
  maxPlots?: number;
  waterDelayMs?: number;
}

export async function executeWaterCropsNode(
  context: NodeExecutionContext,
  config: WaterCropsNodeConfig
): Promise<NodeResult> {
  const { page, projectName } = context;
  const maxPlots = config.maxPlots || 10;
  const delay = config.waterDelayMs || 500;

  logger.info(`[${projectName}] Полив рослин: початок обробки (макс ${maxPlots} грядок)`);

  try {
    // 1. Пошук грядок, що потребують поливу
    const unwateredPlots = await page.$$('div[data-testid="plot-unwatered"]');
    let wateredCount = 0;

    for (const plot of unwateredPlots) {
      if (wateredCount >= maxPlots) break;
      await plot.click();
      await page.waitForTimeout(delay);
      wateredCount++;
    }

    logger.info(`[${projectName}] Успішно полито ${wateredCount} рослин`);

    // 2. Повернення результату для наступних нод графа
    return {
      nextHandle: 'success',
      data: {
        count: wateredCount,
        text: `Полито ${wateredCount} рослин`
      }
    };
  } catch (error) {
    logger.error(`[${projectName}] Помилка під час поливу рослин`, { error });
    return {
      nextHandle: 'error',
      data: {
        error: String(error)
      }
    };
  }
}
```

### Крок 2. Зареєструйте ноду в `src/nodes/index.ts`
Відкрийте `src/nodes/index.ts`, імпортуйте нову функцію та додайте її до об'єкта `NODE_HANDLERS`:

```typescript
import { executeWaterCropsNode } from './WaterCropsNode';

export const NODE_HANDLERS: Record<string, NodeHandler> = {
  // ... інші ноди
  waterCropsNode: executeWaterCropsNode,
};
```

### Крок 3. Додайте конфігурацію ноди у фронтенд
Для відображення ноди в панелі редактора додайте її опис у `frontend/src/nodeConfig.ts` та зареєструйте тип у `@sf/shared-types`.

---

## 🧪 Тестування та збірка

```bash
# Перевірка типів TypeScript без виводу бінарників
pnpm run check:types
# або
npx tsc --noEmit

# Запуск юніт-тестів на базі Jest/Vitest
npm test

# Запуск тестів з покриттям коду
npm run test:coverage

# Збірка продакшн версії
npm run build
```

---

## 🔧 Змінні оточення (`.env`)

| Змінна | Дефолтне значення | Опис |
| :--- | :--- | :--- |
| `HTTP_PORT` | `3001` | Порт для REST API та WebSocket сервера |
| `NODE_ENV` | `development` | Режим запуску (`development` / `production`) |
| `JWT_SECRET` | `sf_secret_key...` | Секретний ключ для підпису JWT токенів авторизації |
| `ENCRYPTION_KEY` | `sf_encryption...` | Ключ шифрування (32 символи) для приватних даних |
| `MAX_PARALLEL_BROWSERS`| `2` | Максимальна кількість одночасно відкритих браузерів |
| `LOG_LEVEL` | `1` | Рівень логування (0 - debug, 1 - info, 2 - warn, 3 - error) |
| `CAMOUFOX_PROFILES_DIR`| `./profiles` | Шлях до каталогу збереження сесій браузера |
| `ALLOWED_ORIGINS` | `*` | Дозволені CORS origins для підключення клієнтів |
