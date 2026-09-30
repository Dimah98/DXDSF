# 🎨 Sunflower Land Bot Frontend Dashboard & Node Editor

Сучасна клієнтська веб-панель керування та інтерактивний візуальний редактор графів сценаріїв для Sunflower Land Bot Constructor. Побудована на базі React 19, TypeScript, React Flow, TailwindCSS та Vite.

---

## 🛠️ Технологічний стек

- **Фреймворк:** [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Збірка та Dev-сервер:** [Vite 8](https://vitejs.dev/) з оптимізованим чанкуванням
- **Візуальний редактор:** [React Flow](https://reactflow.dev/) (вузли, кастомні порти, drag-and-drop з'єднання)
- **Стилізація:** [TailwindCSS](https://tailwindcss.com/) + [Lucide Icons](https://lucide.dev/)
- **State Management:** [Zustand](https://github.com/pmndrs/zustand) (модульні та швидкі сховища стану)
- **Real-time зв'язок:** WebSocket клієнт для прийому CDP відеострімів та статусів виконання

---

## 📂 Структура директорій

```text
frontend/
├── dist/                       # Зібраний продакшн-бандл (роздається Nginx)
├── nginx.conf                  # Конфігурація веб-сервера з Gzip та кешуванням
├── src/
│   ├── components/             # React-компоненти інтерфейсу
│   │   ├── CustomNodes/        # Візуальні представлення конкретних нод у графі
│   │   ├── Modals/             # Модальні вікна (інвентар, доставки, налаштування)
│   │   ├── Map/                # Інтерактивна мапа острова Sunflower Land
│   │   ├── ui/                 # Базові UI елементи (кнопки, інпути, дропдауни)
│   │   ├── NodeEditor.tsx      # Головне полотно редактора React Flow
│   │   ├── Sidebar.tsx         # Бічна панель інструментів та палітра нод
│   │   ├── StreamPicker.tsx    # Вікно живого стріму гри з CDP пікером елементів
│   │   ├── ConsolePane.tsx     # Панель живих логів виконання бота
│   │   └── ProjectManagerModal.tsx # Менеджер проектів, збережень та імпорту/експорту
│   ├── hooks/                  # Кастомні хуки (useWebSocket, useCanvasActions тощо)
│   ├── store/                  # Сховища Zustand
│   │   ├── useUIStore.ts       # Керування відкриттям модалок, бічних панелей
│   │   ├── useExecutionStore.ts# Стан запуску бота, поточна нода, логи, стрім
│   │   └── useGlobalSettingsStore.ts # Глобальні налаштування системи
│   ├── utils/                  # Допоміжні утиліти роботи з графами та буфером
│   ├── nodeConfig.ts           # Декларація конфігурацій, портів та кольорів нод
│   ├── portTooltips.ts         # Підказки для портів входу та виходу нод
│   ├── App.tsx                 # Головний компонент додатку та роутинг
│   └── main.tsx                # Точка входу клієнтського додатку
├── package.json
└── vite.config.ts              # Конфігурація Vite (Manual Chunks, Alias)
```

---

## 🧩 Архітектура React Flow Редактора

Головний робочий простір реалізовано в компоненті `src/components/NodeEditor.tsx`:
- **Полотно графа:** Підтримує панорамування, зум, мульти-вибір, групування та міні-карту.
- **Вузли (Nodes):** Кожен вузол має визначений тип (`NodeType`), назву, іконку, форму редагування параметрів та набір портів (`Handles`).
- **З'єднання (Edges):** Направлені зв'язки між вихідним портом одного вузла та вхідним портом наступного. Спеціальний компонент `DelayEdge.tsx` дозволяє налаштовувати затримку між діями прямо на лінії зв'язку.
- **Вкладені групи:** Можливість об'єднувати ноди в логічні групи (`groupNode`) для структуризації великих алгоритмів.

---

## ⚡ WebSocket Протокол для Real-Time Оновлень

Клієнт взаємодіє з сервером через постійне WebSocket-з'єднання (`ws://backend:3001/ws`).

### Типи вхідних повідомлень (Server ➡️ Frontend):

| Тип події | Payload | Опис |
| :--- | :--- | :--- |
| `BOT_RUNNING_STATE` | `{ isRunning: boolean }` | Зміна статусу активності бота (запущений / зупинений). |
| `NODE_EXECUTING` | `{ nodeId, nodeTitle, parentGroupId }` | Підсвічування вузла, який виконується прямо зараз. |
| `STREAM_FRAME` | `{ frame: string }` (Base64 JPEG) | Новий кадр трансляції гри з Chrome DevTools Protocol. |
| `CONSOLE_LOG` | `{ message, logType: 'info'|'error'|... }` | Лог для відображення в панелі `ConsolePane`. |
| `NODE_DATA_UPDATE` | `{ nodeId, data }` | Оновлення внутрішніх даних або лічильників вузла. |
| `SELECTOR_INFO_PICKED` | `{ nodeId, selector }` | Результат інтерактивного кліку на елемент гри. |

### Типи вихідних повідомлень (Frontend ➡️ Server):

| Тип команди | Опис |
| :--- | :--- |
| `RUN_BOT` | Запуск повного виконання графа із передачею масиву `nodes` та `edges`. |
| `STOP_BOT` | Негайне переривання виконання активного бота. |
| `RUN_SINGLE_NODE` | Тестове виконання лише одного виділеного вузла. |
| `START_STREAM` / `STOP_STREAM` | Увімкнення або вимкнення трансляції відеопотоку гри. |
| `PICK_SELECTOR` | Переведення стріму в режим інтерактивного вибору селектора. |

---

## 🛠️ Як створити новий тип ноди у фронтенді

### Крок 1. Зареєструйте конфігурацію в `src/nodeConfig.ts`
Додайте опис ноди, кольори, категорію та порти:

```typescript
export const NODE_CONFIGS: Record<string, NodeConfigDefinition> = {
  // ...
  waterCropsNode: {
    type: 'waterCropsNode',
    title: 'Полив рослин',
    category: 'actions',
    color: '#0284c7', // Синій колір
    icon: 'Droplets',
    inputs: [{ id: 'in', label: 'Вхід', type: 'target' }],
    outputs: [
      { id: 'success', label: 'Успіх', type: 'source' },
      { id: 'error', label: 'Помилка', type: 'source' }
    ],
    defaultData: {
      maxPlots: 10,
      waterDelayMs: 500
    }
  }
};
```

### Крок 2. Створіть компонент форми у `src/components/CustomNodes/`
Створіть файл `src/components/CustomNodes/WaterCropsNodeComponent.tsx`, де користувач зможе змінювати параметри `maxPlots` та `waterDelayMs`.

### Крок 3. Додайте тултіпи в `src/portTooltips.ts`
Опишіть призначення вхідних та вихідних портів для підказок користувачеві при наведенні курсору на порт у редакторі.

---

## 🗃️ State Management (Zustand)

Додаток використовує модульну архітектуру сторів:
- **`useExecutionStore`:** Відповідає за виконання сценаріїв, список активних логів, статус з'єднання WebSocket, збережені кадри відеопотоку та поточну виконувану ноду.
- **`useUIStore`:** Керує станом видимості модальних вікон (`isProjectManagerOpen`, `isInventoryOpen`, `isGlobalStatsOpen` тощо) та перемиканням вкладок.
- **`useGlobalSettingsStore`:** Зберігає налаштування швидкості виконання дій, розширення вікна Camoufox, тайм-аути пошуку елементів та налаштування проксі.

---

## 📦 Оптимізація та збірка продукту

У `vite.config.ts` налаштовано оптимізоване розділення великих вендорних пакетів (`manualChunks`):
- `vendor-react`: бібліотеки ядра React, React-DOM, React Flow
- `vendor-icons`: набір іконок Lucide React
- Агресивне Gzip-стиснення та кешування статичних ресурсів у `nginx.conf` із заголовками `Cache-Control: max-age=31536000, immutable`.

### Команди:

```bash
# Запуск dev-сервера з гарячою заміною модулів (HMR)
pnpm dev

# Перевірка типів та компіляція продакшн бандлу у /dist
pnpm run build

# Локальний попередній перегляд зібраного проекту
pnpm run preview
```
