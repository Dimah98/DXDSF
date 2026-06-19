// Єдиний словник конфігурацій всіх типів нод
// Використовується в Sidebar, NodeEditor і NodeHeader (кнопка ?)
// Щоб додати нову ноду — лише тут, більше ніде нічого дублювати не треба

import {
  Play, Globe, Scan, Search, CloudDownload, Database,
  GitFork, MousePointerClick, Crosshair, Keyboard,
  Camera, Layers, Monitor, Repeat, Move,
  MessageSquare, Timer, XCircle, Calculator, Activity,
  ArrowRightLeft, Package, Clock, CalendarClock, Bell, Sprout, Flame, ChefHat
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

export const RECIPES_DATA: Record<string, Record<string, number>> = {
  "Furikake Sprinkle": { "Fish Flake": 1, "Seaweed": 1 },
  "Mashed Potato": { "Potato": 8 },
  "Pumpkin Soup": { "Pumpkin": 10 },
  "Reindeer Carrot": { "Carrot": 5 },
  "Mushroom Soup": { "Wild Mushroom": 5 },
  "Popcorn": { "Sunflower": 100, "Corn": 5 },
  "Bumpkin Broth": { "Carrot": 10, "Cabbage": 5 },
  "Cabbers n Mash": { "Mashed Potato": 10, "Cabbage": 20 },
  "Boiled Eggs": { "Egg": 10 },
  "Kale Stew": { "Kale": 10 },
  "Kale Omelette": { "Egg": 40, "Kale": 5 },
  "Gumbo": { "Potato": 50, "Pumpkin": 30, "Carrot": 20, "Red Snapper": 3 },
  "Rapid Roast": { "Magic Mushroom": 1, "Pumpkin": 40 },
  "Fried Tofu": { "Soybean": 15, "Sunflower": 200 },
  "Rice Bun": { "Rice": 2, "Wheat": 50 },
  "Antipasto": { "Olive": 2, "Grape": 2 },
  "Pizza Margherita": { "Tomato": 30, "Cheese": 5, "Wheat": 20 },
  "Rhubarb Tart": { "Rhubarb": 3 }
};

export const KITCHEN_RECIPES_DATA: Record<string, Record<string, number>> = {
  "Surimi Rice Bowl": { "Fish Stick": 1, "Rice": 1, "Onion": 1 },
  "Creamy Crab Bite": { "Crab Stick": 1, "Cheese": 3 },
  "Crimstone Infused Fish Oil": { "Fish Oil": 1, "Crimstone": 1 },
  "Sunflower Crunch": { "Sunflower": 300 },
  "Mushroom Jacket Potatoes": { "Wild Mushroom": 10, "Potato": 5 },
  "Fruit Salad": { "Apple": 1, "Orange": 1, "Blueberry": 1 },
  "Pancakes": { "Wheat": 10, "Egg": 10, "Honey": 6 },
  "Roast Veggies": { "Cauliflower": 15, "Carrot": 10 },
  "Cauliflower Burger": { "Cauliflower": 15, "Wheat": 5 },
  "Club Sandwich": { "Sunflower": 100, "Carrot": 25, "Wheat": 5 },
  "Bumpkin Salad": { "Beetroot": 20, "Parsnip": 10 },
  "Bumpkin ganoush": { "Eggplant": 30, "Potato": 50, "Parsnip": 10 },
  "Goblin's Treat": { "Pumpkin": 10, "Radish": 20, "Cabbage": 10 },
  "Chowder": { "Beetroot": 10, "Wheat": 10, "Parsnip": 5, "Anchovy": 3 },
  "Bumpkin Roast": { "Mashed Potato": 20, "Roast Veggies": 5 },
  "Goblin Brunch": { "Boiled Eggs": 5, "Goblin's Treat": 1 },
  "Beetroot Blaze": { "Magic Mushroom": 2, "Beetroot": 50 },
  "Steamed Red Rice": { "Rice": 3, "Beetroot": 50 },
  "Tofu Scramble": { "Soybean": 20, "Egg": 20, "Cauliflower": 10 },
  "Fried Calamari": { "Sunflower": 200, "Wheat": 15, "Squid": 1 },
  "Fish Burger": { "Beetroot": 10, "Wheat": 10, "Horse Mackerel": 1 },
  "Fish Omelette": { "Egg": 40, "Surgeonfish": 1, "Butterflyfish": 2 },
  "Ocean's Olive": { "Olive Flounder": 1, "Olive": 2 },
  "Seafood Basket": { "Blowfish": 2, "Napoleanfish": 2, "Sunfish": 2 },
  "Fish n Chips": { "Fancy Fries": 1, "Halibut": 1 },
  "Sushi Roll": { "Angelfish": 1, "Seaweed": 1, "Rice": 2 },
  "Caprese Salad": { "Cheese": 1, "Tomato": 25, "Kale": 20 },
  "Spaghetti al Limone": { "Wheat": 10, "Lemon": 15, "Cheese": 3 }
};

const defaultFirePitRules = Object.keys(RECIPES_DATA).map(recipeName => {
  const ingMultipliers: Record<string, number> = {};
  Object.keys(RECIPES_DATA[recipeName]).forEach(ing => {
    ingMultipliers[ing] = 1; // Default multiplier is 1
  });

  return {
    recipeName,
    enabled: false,
    maxDish: 10,
    ingMultipliers,
    selector: ''
  };
});

const defaultKitchenRules = Object.keys(KITCHEN_RECIPES_DATA).map(recipeName => {
  const ingMultipliers: Record<string, number> = {};
  Object.keys(KITCHEN_RECIPES_DATA[recipeName]).forEach(ing => {
    ingMultipliers[ing] = 1; // Default multiplier is 1
  });

  return {
    recipeName,
    enabled: false,
    maxDish: 10,
    ingMultipliers,
    selector: ''
  };
});

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
    desc: 'Отримати текст/дані',
    hint: 'Витягує текст, HTML або атрибут вказаного елемента (по CSS чи XPath) та зберігає його у змінну для подальшого використання.',
    defaultColor: '#3b82f6',
  },
  displayNode: {
    label: 'Екран',
    icon: Monitor,
    desc: 'Вивід значень',
    hint: 'Зручний віджет на полотні, який дозволяє в реальному часі бачити значення вказаної змінної.',
    defaultColor: '#0ea5e9',
  },
  imageSearchNode: {
    label: 'Пошук по картинці',
    icon: Camera,
    desc: 'Шукає зображення на екрані',
    hint: 'Аналізує екран браузера та шукає заданий шаблон (картинку). Результат можна використовувати для кліків по знайденим координатам.',
    defaultColor: '#ec4899',
  },
  selectorCheckNode: {
    label: 'Перевірка елемента',
    icon: Search,
    desc: 'Перевіряє наявність',
    hint: 'Перевіряє чи існує елемент за вказаним CSS або XPath. Якщо знайдено — зелена гілка, якщо ні — синя гілка.',
    defaultColor: '#f59e0b',
  },
  coordClickNode: {
    label: 'Клік по координатах',
    icon: Crosshair,
    desc: 'Емуляція кліку мишкою',
    hint: 'Виконує справжній клік мишкою у задані координати {X, Y}. Може використовувати координати, знайдені нодою ImageSearch.',
    defaultColor: '#ef4444',
  },
  actionNode: {
    label: 'Дія (Клік)',
    icon: MousePointerClick,
    desc: 'Клік по селектору',
    hint: 'Найпопулярніша нода. Шукає елемент за селектором та виконує клік по ньому. Також може почекати поки елемент зʼявиться.',
    defaultColor: '#22c55e',
  },
  keyboardNode: {
    label: 'Клавіатура',
    icon: Keyboard,
    desc: 'Ввід тексту/клавіш',
    hint: 'Емулює натискання клавіш або друкує текст у вибране поле.',
    defaultColor: '#6366f1',
  },
  apiNode: {
    label: 'Запит до API',
    icon: CloudDownload,
    desc: 'HTTP GET/POST',
    hint: 'Виконує зовнішній веб-запит (GET, POST тощо) до вказаного URL та зберігає відповідь сервера.',
    defaultColor: '#10b981',
  },
  variableNode: {
    label: 'Змінна',
    icon: Database,
    desc: 'Створити/Змінити',
    hint: 'Створює нову змінну або перезаписує існуючу вказаним значенням. Змінні зберігаються у загальному сховищі.',
    defaultColor: '#8b5cf6',
  },
  valueLoopNode: {
    label: 'Цикл значень',
    icon: Repeat,
    desc: 'Ітерація по масиву',
    hint: 'Проходить по кожному елементу масиву (чи списку), зберігаючи його в змінну і виконуючи тіло циклу. Коли елементи закінчуються — йде по гілці "Завершено".',
    defaultColor: '#d946ef',
  },
  multiLogicNode: {
    label: 'Диспетчер подій',
    icon: GitFork,
    desc: 'Варіації (Пріоритет)',
    hint: 'Крута нода для гнучкості: перевіряє список умов згори донизу. Виконує гілку першої умови, що спрацювала.',
    defaultColor: '#f43f5e',
  },
  searchInNode: {
    label: 'Пошук в області',
    icon: Layers,
    desc: 'Знайти елемент в іншому',
    hint: 'Спочатку шукає батьківський елемент, а потім всередині нього виконує клік/перевірку за дочірнім селектором.',
    defaultColor: '#14b8a6',
  },
  compareNode: {
    label: 'Порівняння (IF)',
    icon: Calculator,
    desc: 'Математика або текст',
    hint: 'Порівнює два значення (наприклад, {myVar} > 10). Якщо правда — зелена гілка, інакше — синя.',
    defaultColor: '#fb923c',
  },
  multiScanNode: {
    label: 'Мульти-сканер',
    icon: Scan,
    desc: 'Витягти масив даних',
    hint: 'Сканує сторінку на наявність багатьох однакових елементів (наприклад, усіх товарів) і зберігає результати в масив.',
    defaultColor: '#3b82f6',
  },
  gateNode: {
    label: 'Логічний Шлюз',
    icon: ArrowRightLeft,
    desc: 'Обʼєднання сигналів',
    hint: 'Може обʼєднувати багато вхідних зʼєднань в одне (або розгалужувати сигнал). Також може працювати як "AND-вентиль" або "Перемикач".',
    defaultColor: '#8b5cf6',
  },
  escNode: {
    label: 'Закрити (ESC)',
    icon: XCircle,
    desc: 'Закрити вікна/модалки',
    hint: 'Універсальна нода для закриття вспливаючих вікон (шляхом натискання клавіші Escape або кліку поза вікном).',
    defaultColor: '#64748b',
  },
  commentNode: {
    label: 'Коментар',
    icon: MessageSquare,
    desc: 'Написи на полотні',
    hint: 'Слугує виключно для документування та залишення нотаток прямо на полотні редактора.',
    defaultColor: '#94a3b8',
  },
  randomDelayNode: {
    label: 'Рандом-Пауза',
    icon: Timer,
    desc: 'Затримка X-Y мс',
    hint: 'Витримує паузу у випадковому діапазоні між X та Y мілісекунд (наприклад 1000-3000 мс). Робить поведінку бота більш людяною.',
    defaultColor: '#6366f1',
    defaults: {
      min: 1000,
      max: 3000
    }
  },
  eventVariationsNode: {
    label: 'Диспетчер подій',
    icon: GitFork,
    desc: 'Варіації (Пріоритет)',
    hint: 'Перевіряє список умов згори донизу. Клікає по першій підходящій.',
    defaultColor: '#f43f5e',
    defaults: {
      variations: [
        { text: "Прийняти", selector: ".accept" },
        { text: "Відхилити", selector: ".reject" }
      ]
    }
  },
  calculatorNode: {
    label: 'Калькулятор',
    icon: Calculator,
    desc: 'Математичні вирази',
    hint: 'Виконує математичні операції (+, -, *, /) між змінними або числами. Результат зберігає у нову змінну.',
    defaultColor: '#0284c7',
  },
  variablesMonitorNode: {
    label: 'Монітор Змінних',
    icon: Activity,
    desc: 'Список усіх значень',
    hint: 'Зручне віконце прямо на полотні, яке відображає поточні значення всіх глобальних змінних проекту.',
    defaultColor: '#059669',
  },
  rotatorNode: {
    label: 'Чергувач',
    icon: Repeat, // Змінено з ArrowPath на Repeat
    desc: 'По черзі або рандом',
    hint: 'Кожен раз, коли сигнал приходить на цю ноду, вона передає його на НАСТУПНИЙ порт по колу (або у випадковий порт).',
    defaultColor: '#8b5cf6',
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
    label: 'Таймаут',
    icon: Clock, // або Timer, але Timer вже є вище
    desc: 'Затримка викликів',
    hint: 'Пропускає сигнал лише раз на вказаний проміжок часу. Всі інші спроби протягом таймауту йдуть по червоній гілці.',
    defaultColor: '#0d9488',
    defaults: {
      duration: 20,
      unit: 'minutes'
    }
  },
  setNextRunNode: {
    label: 'Наступний запуск',
    icon: CalendarClock,
    desc: 'Запланувати повтор',
    hint: 'Встановлює час наступного автоматичного запуску цього проекту. Два режими: "Через N годин" або "У заданий час (HH:MM)". Запуск відбудеться навіть якщо інтерфейс закритий.',
    defaultColor: '#0ea5e9',
    defaults: {
      scheduleMode: 'delay',
      delayValue: 2,
      delayUnit: 'hours',
      targetTime: '08:00',
    },
  },
  notifyNode: {
    label: 'Сповіщення',
    icon: Bell,
    desc: 'Надіслати повідомлення',
    hint: 'Надсилає сповіщення з текстом. Підтримує шаблони: {project} — назва проекту, {time} — поточний час, {varName} — значення глобальної змінної. Сповіщення видно у вкладці "Сповіщення".',
    defaultColor: '#f59e0b',
    defaults: {
      message: 'Бот {project} завершив роботу',
    },
  },
  cropAnalyzerNode: {
    label: 'Аналізатор врожаю',
    icon: Sprout,
    desc: 'Час дозрівання',
    hint: 'Аналізує JSON з API, знаходить найближчий час дозрівання рослин. Якщо є дозрілий врожай — виходить через зелений порт. Якщо рослини ростуть — планує повторний запуск за таблицею правил і виходить через синій порт.',
    defaultColor: '#16a34a',
    defaults: {
      variableName: 'nextCropHarvest',
      scheduleRules: [
        { fromMin: 0, toMin: 15, scheduleFromMin: 3, scheduleToMin: 5 },
        { fromMin: 15, toMin: 120, scheduleFromMin: 10, scheduleToMin: 15 },
        { fromMin: 120, toMin: 9999, scheduleFromMin: 60, scheduleToMin: 120 },
      ]
    }
  },
  firePitNode: {
    label: 'Шеф Fire Pit',
    icon: Flame,
    desc: 'Готування страв',
    hint: 'Перевіряє всі страви згори донизу. Якщо страва увімкнена, її кількість менша за ліміт і вистачає інгредієнтів (з урахуванням індивідуальних множників) — клікає по її селектору.',
    defaultColor: '#ea580c',
    defaults: {
      rules: defaultFirePitRules
    }
  },
  kitchenNode: {
    label: 'Шеф Kitchen',
    icon: ChefHat,
    desc: 'Готування в Kitchen',
    hint: 'Перевіряє всі страви Kitchen згори донизу. Якщо страва увімкнена, її кількість менша за ліміт і вистачає інгредієнтів — клікає по її селектору.',
    defaultColor: '#a855f7',
    defaults: {
      rules: defaultKitchenRules
    }
  },
  inventoryScannerNode: {
    label: 'Сканер Інвентаря',
    icon: Package,
    desc: 'Зображення + числа',
    hint: 'Сканує елементи на сторінці за CSS селектором, витягує зображення та числові значення. Можна обмежити пошук контейнером. Результати зберігаються у файл і доступні через кнопку "Інвентар".',
    defaultColor: '#6366f1',
    defaults: {
      selector: '.inventory-item',
      containerSelector: '',
      mode: 'all',
      imageSource: 'auto',
      numberRegex: '(\\d+(?:\\.\\d+)?)'
    }
  },
  screenshotNode: {
    label: 'Скріншот',
    icon: Camera,
    desc: 'Збереження екрану',
    hint: 'Зберігає скріншот всієї сторінки або вказаного елемента. Зображення зберігаються окремо для кожного проекту.',
    defaultColor: '#ec4899',
    defaults: {
      mode: 'fullPage',
      selector: '',
      imageName: ''
    }
  }
};

// Список типів нод що відображаються у сайдбарі (в порядку)
export const SIDEBAR_NODE_TYPES = Object.keys(NODE_CONFIG);
