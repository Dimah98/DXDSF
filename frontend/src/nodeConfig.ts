// Єдиний словник конфігурацій всіх типів нод
// Використовується в Sidebar, NodeEditor і NodeHeader (кнопка ?)
// Щоб додати нову ноду — лише тут, більше ніде нічого дублювати не треба

import {
  Play, Globe, Scan, Search, CloudDownload, Database,
  GitFork, MousePointerClick, Crosshair, Keyboard,
  Camera, Layers, Monitor, Repeat, Move,
  MessageSquare, Timer, XCircle, Calculator, Activity,
  ArrowRightLeft, Package, Clock, // Clock — іконка для delayNode
} from 'lucide-react';

// Тип одного запису конфігурації ноди
export interface NodeConfig {
  label: string;          // Назва в сайдбарі та за замовчуванням на ноді
  icon: React.ComponentType<{ size?: number }>;
  desc: string;           // Короткий опис у сайдбарі
  hint: string;           // Розгорнутий опис для кнопки "?"
  defaultColor: string;   // Hex-колір за замовчуванням
  defaults?: Record<string, any>; // Початкові дані ноди при створенні
}

// Реєстр усіх типів нод проекту
export const NODE_CONFIG: Record<string, NodeConfig> = {
  startNode: {
    label: 'Початок',
    icon: Play,
    desc: 'Точка входу',
    hint: 'Стартова нода — звідси починається виконання сценарію. Кожен проект повинен мати рівно одну таку ноду.',
    defaultColor: '#64748b',
  },
  browserNode: {
    label: 'Браузер',
    icon: Globe,
    desc: 'Керування сторінкою',
    hint: 'Навігація та дії браузера: перехід за URL, оновлення сторінки, натискання "Назад", очікування завантаження.',
    defaultColor: '#a855f7',
  },
  infoNode: {
    label: 'Сканер',
    icon: Scan,
    desc: 'Аналіз елемента',
    hint: 'Зчитує дані елемента з браузера: координати, текст, число, кількість дочірніх елементів і картинок. Результати доступні через вихідні порти.',
    defaultColor: '#14b8a6',
  },
  imageSearchNode: {
    label: 'Пошук картинки',
    icon: Search,
    desc: 'Знайти за файлом',
    hint: 'Шукає еталонне зображення (з папки images/) на екрані або в межах CSS-селектора. Повертає координати і кількість збігів.',
    defaultColor: '#6366f1',
  },
  searchInNode: {
    label: 'Пошук у блоці',
    icon: Search,
    desc: 'Шукати в селекторі',
    hint: 'Шукає дочірній елемент всередині батьківського блоку. Повертає "Знайдено" або "Немає". Корисно для перевірки стану конкретних частин UI.',
    defaultColor: '#6366f1',
  },
  apiNode: {
    label: 'API Запит',
    icon: CloudDownload,
    desc: 'Дані з сервера SFL',
    hint: 'Отримує дані з API Sunflower Land. Результат зберігається у змінну і може передаватись у ноди порівняння або змінних.',
    defaultColor: '#6366f1',
    defaults: {
      url: 'https://api.sunflower-land.com/farm/status',
      apiKey: '',
    },
  },
  variableNode: {
    label: 'Змінні',
    icon: Database,
    desc: "Глобальна пам'ять",
    hint: "Зберігає значення з контексту (наприклад, дані API) у глобальні змінні. Ці змінні доступні в логічних нодах і зберігаються між запусками.",
    defaultColor: '#f59e0b',
    defaults: {
      variables: [{ name: 'wood', path: 'inventory.Wood', value: '0' }],
    },
  },
  multiLogicNode: {
    label: 'Логічний ХАБ',
    icon: GitFork,
    desc: 'Багато умов',
    hint: 'Перевіряє кілька умов над глобальними змінними (AND/OR). Кожна гілка — окремий вихідний порт. Підтримує вирази типу "gold > 100 && energy < 50".',
    defaultColor: '#8b5cf6',
    defaults: {
      conditions: [{ rules: [{ varName: '', op: '>', value: '0' }], logicOp: '&&', expression: '' }],
    },
  },
  compareNode: {
    label: 'Порівняння',
    icon: GitFork,
    desc: 'Число або текст',
    hint: 'Порівнює два значення (числа або рядки). Результат — "True" (зелений порт) або "False" (червоний порт). Значення можна вводити вручну або передавати через порти A/B.',
    defaultColor: '#6366f1',
  },
  selectorCheckNode: {
    label: 'Перевірка',
    icon: Search,
    desc: 'Чи є на екрані?',
    hint: 'Перевіряє наявність CSS-елемента на сторінці. "Є" (зелений) — якщо елемент знайдено, "Немає" (червоний) — якщо відсутній.',
    defaultColor: '#fb923c',
  },
  nestedCheckNode: {
    label: 'Вкладена перевірка',
    icon: Layers,
    desc: 'Пошук всередині',
    hint: 'Шукає дочірній елемент всередині батьківського. Обидва селектори задаються окремо. Корисно для перевірки стану компонента.',
    defaultColor: '#ec4899',
  },
  valueLoopNode: {
    label: 'Цикл Кліків',
    icon: Repeat,
    desc: 'Клік за умовою',
    hint: 'Знаходить всі дочірні елементи батьківського блоку і кліка по кожному по черзі. Фільтрує за мінімальним числом поруч. Видає прогрес у реальному часі.',
    defaultColor: '#d946ef',
  },
  actionNode: {
    label: 'Дія',
    icon: MousePointerClick,
    desc: 'Клік / Наведення',
    hint: 'Виконує дію над CSS-елементом: одинарний клік, подвійний клік, наведення (hover) або прокрутку до нього. Підтримує режим "Клікнути всі копії".',
    defaultColor: '#3b82f6',
  },
  coordClickNode: {
    label: 'Клік (X,Y)',
    icon: Crosshair,
    desc: 'Точний клік',
    hint: 'Клікає по абсолютних координатах екрану. Координати можна встановити вручну або отримати через порт "update_coords" від ноди Сканер.',
    defaultColor: '#06b6d4',
  },
  coordOffsetNode: {
    label: 'Зсув координат',
    icon: Move,
    desc: 'Додати X, Y',
    hint: 'Зміщує вхідні координати на вказану кількість пікселів по X та Y. Повертає нові координати через порт "coords".',
    defaultColor: '#4f46e5',
  },
  keyboardNode: {
    label: 'Макрос',
    icon: Keyboard,
    desc: 'Клавіші',
    hint: 'Натискає задану послідовність клавіш з паузами між ними. Підтримує: Enter, Escape, Tab, F1–F12, літери тощо.',
    defaultColor: '#64748b',
    defaults: {
      keys: [{ key: 'Enter', delay: 100 }],
    },
  },
  escNode: {
    label: 'Натиснути ESC',
    icon: XCircle,
    desc: 'Закрити меню',
    hint: 'Надсилає клавішу Escape в браузер. Корисно для закриття модальних вікон, меню або скасування дій.',
    defaultColor: '#475569',
  },
  multiScanNode: {
    label: 'Мульти-Сканер',
    icon: Layers,
    desc: 'Список цілей',
    hint: 'Перевіряє список CSS-селекторів по черзі і зупиняється на першому збігу. Повертає координати знайденого елемента.',
    defaultColor: '#0891b2',
  },
  gateNode: {
    label: 'Шлюз-Лічильник',
    icon: Repeat,
    desc: 'Ліміт проходів',
    hint: 'Пропускає сигнал до досягнення ліміту. Після — перемикається на порт "Ліміт". Лічильник зберігається між ітераціями сценарію.',
    defaultColor: '#d97706',
  },
  visualSearchNode: {
    label: 'Візуальний зір',
    icon: Camera,
    desc: 'Пошук скріншотом',
    hint: 'Порівнює еталонне зображення з поточним скріншотом браузера. Налаштовується точність збігу (0–100%). Повертає координати знайденого.',
    defaultColor: '#10b981',
  },
  eventVariationsNode: {
    label: 'Диспетчер подій',
    icon: GitFork,
    desc: 'Варіації (Пріоритет)',
    hint: 'Перевіряє список умов по черзі (текст, селектор, картинка). Переходить у перший порт, де умова спрацювала. Якщо нічого не знайдено — у порт "Нічого".',
    defaultColor: '#f43f5e',
    defaults: {
      rules: [{ type: 'text', value: '' }],
    },
  },
  randomDelayNode: {
    label: 'Рандом-Пауза',
    icon: Timer,
    desc: 'Затримка X–Y мс',
    hint: 'Зупиняє виконання на випадковий час у діапазоні від "мін" до "макс" мілісекунд. Антидетект — імітує людську поведінку.',
    defaultColor: '#6366f1',
    defaults: {
      minDelay: 500,
      maxDelay: 2000,
    },
  },
  delayNode: {
    label: 'Пауза',                      // Назва в сайдбарі
    icon: Clock,                          // Іконка годинника
    desc: 'Фіксована затримка',           // Підпис в сайдбарі
    hint: 'Зупиняє виконання на фіксовану кількість мілісекунд. Для змінної затримки використовуй "Рандом-Паузу".', // Пояснення ?
    defaultColor: '#6366f1',
    defaults: {
      delay: 1000,                        // 1 секунда за замовчуванням
    },
  },
  commentNode: {
    label: 'Коментар',
    icon: MessageSquare,
    desc: 'Нотатка на полотні',
    hint: 'Текстова нотатка — не виконується ботом. Використовується для документування схеми та пояснень для інших розробників.',
    defaultColor: '#64748b',
  },
  displayNode: {
    label: 'Вивід',
    icon: Monitor,
    desc: 'Результат',
    hint: 'Відображає значення з контексту попередньої ноди. Корисно для налагодження — показує що передається між нодами.',
    defaultColor: '#64748b',
  },
  calculatorNode: {
    label: 'Калькулятор',
    icon: Calculator,
    desc: 'Математичні вирази',
    hint: 'Виконує розрахунки з числами та глобальними змінними. Можна додавати кілька незалежних блоків розрахунку, кожен з яких має свій вхід та вихід.',
    defaultColor: '#0891b2',
    defaults: {
      examples: [{ id: 'ex_0', rows: [{ value: '0', op: '+' }], resultVar: '' }]
    },
  },
  variablesMonitorNode: {
    label: 'Монітор Змінних',
    icon: Activity,
    desc: 'Список усіх значень',
    hint: 'Показує всі глобальні змінні проекту та їхні значення в реальному часі. Ідеально підходить для моніторингу ресурсів ферми.',
    defaultColor: '#10b981',
  },
  rotatorNode: {
    label: 'Чергувач',                                 // Назва в сайдбарі
    icon: ArrowRightLeft,                              // Іконка (Sequential mode)
    desc: 'По черзі або рандом',                  // Підпис в сайдбарі
    hint: 'Щоразу приходить сигнал, направляє його на наступний вихід по черзі. Режим "Рандом" — вибирає вихід випадково. Кількість виходів 2–8 — налаштовується.', // Пояснення для ?
    defaultColor: '#7c3aed',                           // Фіолетовий
    defaults: {
      outputCount: 3, // Початкова кількість виходів
      mode: 'sequence', // Режим: 'sequence' або 'random'
    },
  },
  groupNode: {
    label: 'Контейнер',                                // Назва в сайдбарі
    icon: Package,                                     // Іконка
    desc: 'Підпрограма / вкладений граф',              // Підпис в сайдбарі
    hint: 'Міні-підпрограма: вміщує власний граф нод всередині. Вхідний сигнал проходить через внутрішні ноди і виходить через вихідний порт. Відкрийте контейнер щоб редагувати вміст.',
    defaultColor: '#1d4ed8',                           // Синій
    defaults: {
      subNodes: [],                                    // Буде ініціалізовано при першому відкритті
      subEdges: [],
    },
  },
  cooldownNode: {
    label: 'Таймаут (Кулдаун)',
    icon: Timer,
    desc: 'Один сигнал за час',
    hint: 'Пропускає сигнал 1 раз в заданий час. Якщо протягом цього часу надходять інші сигнали, вони направляються у порт блокування (червоний). Таймер зберігається між перезапусками.',
    defaultColor: '#0d9488',
    defaults: {
      duration: 20,
      unit: 'minutes'
    }
  }
};

// Список типів нод що відображаються у сайдбарі (в порядку)
export const SIDEBAR_NODE_TYPES = Object.keys(NODE_CONFIG);
