# 📦 @sf/shared-types — Спільні TypeScript Контракти

Пакет спільних типізованих контрактів для всієї екосистеми **Sunflower Land Bot**. Використовується для синхронізації структур даних між:
- **Backend:** Серверне ядро Node.js / Express / WebSocket
- **Frontend:** Веб-панель React Flow / Vite
- **Android Remote:** Мобільний додаток `sl-bot-remote`

---

## 🎯 Навіщо потрібен цей пакет?

У великих проектах із розділеним клієнтом та сервером часто виникає розсинхронізація форматів даних (payloads):
- Бекенд очікує одне поле, а фронтенд надсилає інше.
- Зміна структури WebSocket повідомлень ламає клієнт непомітно для компілятора.
- Android-клієнт повинен гарантовано розуміти структуру проектів та поточні статуси виконання.

`@sf/shared-types` забезпечує **єдине джерело правди (Single Source of Truth)**. Будь-які зміни в контрактах виявляються TypeScript компілятором ще на етапі білду (`tsc`).

---

## 📂 Структура типів

### 1. WebSocket Протокол (`WSMessage`, `WSResponse`)
Визначає всі типи двосторонньої комунікації через WebSocket:

```typescript
// Сервер ➡️ Клієнт
export type WSResponse =
  | { type: 'BOT_RUNNING_STATE'; isRunning: boolean }
  | { type: 'BOT_FINISHED' }
  | { type: 'NODE_EXECUTING'; nodeId: string; nodeTitle?: string; parentGroupId?: string }
  | { type: 'NODE_DATA_UPDATE'; nodeId: string; data: unknown }
  | { type: 'GLOBAL_VARIABLES_UPDATE'; variables: Record<string, unknown> }
  | { type: 'CONSOLE_LOG'; message: string; logType: 'info' | 'error' | 'success' | 'debug' }
  | { type: 'STREAM_FRAME'; frame: string } // Base64 JPEG кадр
  | { type: 'SELECTOR_INFO_PICKED'; nodeId: string; selector: string }
  | { type: 'CSRF_TOKEN'; token: string };

// Клієнт ➡️ Сервер
export type WSMessage =
  | { type: 'RUN_BOT'; node: unknown; nodes: unknown[]; edges: unknown[] }
  | { type: 'STOP_BOT' }
  | { type: 'RUN_SINGLE_NODE'; nodeId: string; nodes: unknown[]; edges: unknown[] }
  | { type: 'UPDATE_VARIABLE'; name: string; value: unknown }
  | { type: 'START_STREAM' }
  | { type: 'STOP_STREAM' }
  | { type: 'PICK_SELECTOR'; nodeId: string; pickType?: string }
  | { type: 'CANCEL_PICKER' };
```

Пакет також надає функцію-typeguard `isWSMessage(msg: unknown): msg is WSMessage` для безпечної валідації вхідних WebSocket payload на бекенді.

---

### 2. Типи Нод та Графів (`NodeType`, `BaseNode`, `BaseEdge`)
Описують структуру візуального графа сценаріїв, сумісну з React Flow:

```typescript
export interface BaseNode {
  id: string;
  type: NodeType;
  data: Record<string, unknown>;
  position: { x: number; y: number };
}

export interface BaseEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  data?: Record<string, unknown>;
}
```

Підтримуються понад 50 типів вузлів: від базових дій кліку (`coordClickNode`, `searchAndClickNode`) до складних інтерактивних міні-ігор (`memoryGameNode`, `whackAMoleNode`, `fruitRunnerNode`).

---

### 3. Результати виконання дій (`NodeData`, `NodeResult`)
Контракт передачі даних між послідовними кроками виконання в `BotEngine`:

```typescript
export interface NodeResult {
  /** Ідентифікатор вихідного порту для переходу до наступного вузла ('success', 'error', 'true', 'false') */
  nextHandle?: string | (string | null | undefined)[] | null;
  /** Дані, збережені після виконання для подальшого використання */
  data?: NodeData;
  /** Оновлення стану вузла для синхронізації з UI */
  updateNodeData?: Record<string, unknown>;
  /** Прапорець для переривання або пропуску наступного кроку */
  skipNext?: boolean;
}
```

---

### 4. Інвентар та Сканер сторінки (`ScanResult`, `InventoryFile`)
Формати збереження та аналізу ігрових предметів:

```typescript
export interface ScanResult {
  image: string;       // URL або Base64 іконка предмета
  number: number;      // Кількість предметів на складі
  selector?: string;   // Селектор елемента
  coords?: { x: number; y: number };
}

export interface InventoryFile {
  projectName: string;
  data: ScanResult[];
  timestamp: number;
  version: string;
}
```

---

## 💻 Приклади використання

### На Бекенді:
```typescript
import { WSResponse, NodeResult } from '@sf/shared-types';

function sendStatus(ws: WebSocket, running: boolean): void {
  const message: WSResponse = {
    type: 'BOT_RUNNING_STATE',
    isRunning: running
  };
  ws.send(JSON.stringify(message));
}
```

### На Фронтенді:
```typescript
import { WSResponse, BaseNode } from '@sf/shared-types';

ws.onmessage = (event) => {
  const data: WSResponse = JSON.parse(event.data);
  if (data.type === 'NODE_EXECUTING') {
    highlightNode(data.nodeId);
  }
};
```

---

## 🔨 Збірка пакету

Оскільки пакет використовується іншими модулями як локальна залежність у монорепозиторії (`pnpm workspace`), перед запуском бекенду чи фронтенду необхідно зібрати TypeScript опис (`dist/index.d.ts`):

```bash
# У корені репозиторію:
pnpm --filter @sf/shared-types build

# Або у папці packages/shared-types:
cd packages/shared-types
npm run build
```

---

## ⚠️ Регламент запобігання Breaking Changes

Оскільки типізація є спільною для клієнта, сервера та Android додатку, дотримуйтесь таких правил:
1. **Зворотна сумісність:** Не видаляйте і не перейменовуйте існуючі поля в `WSMessage`, `WSResponse` або `ProjectMetadata`. Якщо поле застаріло, позначте його `@deprecated` та зробіть необов'язковим (`?`).
2. **Розширення через Optional:** Нові поля повинні додаватися як опціональні (`newField?: string`).
3. **Версіонування схем:** При кардинальній зміні структур збереження (наприклад, `InventoryFile`) завжди оновлюйте поле `version: string` та передбачайте функцію міграції на бекенді.
