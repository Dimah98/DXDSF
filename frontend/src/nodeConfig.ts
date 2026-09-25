// Єдиний словник конфігурацій всіх типів нод
// Використовується в Sidebar, NodeEditor і NodeHeader (кнопка ?)
// Щоб додати нову ноду — лише тут, більше ніде нічого дублювати не треба

import {
  Play, Globe, Scan, Search, CloudDownload, Database,
  GitFork, MousePointerClick, Crosshair, Keyboard,
  Camera, Layers, Monitor, Repeat, Move,
  MessageSquare, Timer, XCircle, Calculator, Activity,
  ArrowRightLeft, Package, Clock, CalendarClock, Bell, Sprout, Flame, ChefHat, Gamepad2, Hammer, Sparkles, Egg,
  Settings, Type, Flower, PackageCheck,
  Wallet, Maximize, Puzzle, Compass,
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

export const DELI_RECIPES_DATA: Record<string, Record<string, number>> = {
  "Shroom Syrup": { "Magic Mushroom": 3, "Honey": 20 },
  "Blue Cheese": { "Cheese": 2, "Blueberry": 10 },
  "Honey Cheddar": { "Cheese": 3, "Honey": 5 },
  "Fermented Fish": { "Tuna": 6 },
  "Blueberry Jam": { "Blueberry": 5 },
  "Fancy Fries": { "Sunflower": 500, "Potato": 500 },
  "Sauerkraut": { "Cabbage": 20 },
  "Fermented Carrots": { "Carrot": 20 },
  "Cheese": { "Milk": 3 }
};

export const SMOOTHIE_SHACK_RECIPES_DATA: Record<string, Record<string, number>> = {
  "Grape Juice": { "Grape": 5, "Radish": 20 },
  "Sour Shake": { "Lemon": 20 },
  "Purple Smoothie": { "Blueberry": 5, "Cabbage": 10 },
  "Power Smoothie": { "Blueberry": 10, "Kale": 5 },
  "Orange Juice": { "Orange": 5 },
  "Apple Juice": { "Apple": 5 },
  "Bumpkin Detox": { "Apple": 5, "Orange": 5, "Carrot": 10 },
  "The Lot": { "Blueberry": 1, "Orange": 1, "Grape": 1, "Apple": 1, "Banana": 1 },
  "Banana Blast": { "Banana": 10, "Egg": 10 },
  "Slow Juice": { "Grape": 10, "Kale": 100 },
  "Carrot Juice": { "Carrot": 30 },
  "Quick Juice": { "Sunflower": 50, "Pumpkin": 40 }
};

export const BAKERY_RECIPES_DATA: Record<string, Record<string, number>> = {
  "Lemon Cheesecake": { "Lemon": 20, "Cheese": 5, "Egg": 40 },
  "Honey Cake": { "Honey": 10, "Wheat": 10, "Egg": 20 },
  "Orange Cake": { "Orange": 5, "Egg": 30, "Wheat": 10 },
  "Apple Pie": { "Apple": 5, "Wheat": 10, "Egg": 20 },
  "Kale & Mushroom Pie": { "Wild Mushroom": 10, "Kale": 5, "Wheat": 5 },
  "Sunflower Cake": { "Sunflower": 1000, "Wheat": 10, "Egg": 30 },
  "Potato Cake": { "Potato": 500, "Wheat": 10, "Egg": 30 },
  "Pumpkin Cake": { "Pumpkin": 130, "Wheat": 10, "Egg": 30 },
  "Eggplant Cake": { "Eggplant": 30, "Wheat": 10, "Egg": 30 },
  "Carrot Cake": { "Carrot": 120, "Wheat": 10, "Egg": 30 },
  "Cabbage Cake": { "Cabbage": 90, "Wheat": 10, "Egg": 30 },
  "Beetroot Cake": { "Beetroot": 100, "Wheat": 10, "Egg": 30 },
  "Parsnip Cake": { "Parsnip": 45, "Wheat": 10, "Egg": 30 },
  "Cauliflower Cake": { "Cauliflower": 60, "Wheat": 10, "Egg": 30 },
  "Cornbread": { "Corn": 15, "Wheat": 5, "Egg": 10 },
  "Radish Cake": { "Radish": 25, "Wheat": 10, "Egg": 30 },
  "Wheat Cake": { "Wheat": 35, "Egg": 30 }
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
    hint: 'Навігація та дії браузера: перехід за URL, оновлення сторінки, Натиснути F5, Рандом ПТ (випадкова ферма), натискання "Назад", очікування завантаження.',
    defaultColor: '#a855f7',
  },
  browserResizeNode: {
    label: 'Розмір та масштаб',
    icon: Maximize,
    desc: 'Розмір вікна та зум',
    hint: 'Змінює розмір вікна браузера (W × H, повноекранний, розгорнутий) та збільшення/масштаб сторінки (як у меню браузера: 75%, 50%, 100% тощо) прямо на ходу під час виконання сценарію.',
    defaultColor: '#4f46e5',
    defaults: {
      sizePreset: '1280x720',
      width: 1280,
      height: 720,
      windowState: 'normal',
      zoomPercent: 75,
      zoomMode: 'both',
      waitDelay: 500,
    },
  },
  infoNode: {
    label: 'Зчитування даних',
    icon: Scan,
    desc: 'Отримати текст/атрибут',
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
    label: 'Каскад умов (IF/ELSE)',
    icon: GitFork,
    desc: 'Умови змінних (Пріоритет)',
    hint: 'Перевіряє список умов над змінними згори донизу (наприклад {gold} > 100 або time_is_today). Виконує гілку першої умови, що виявилася істинною.',
    defaultColor: '#f43f5e',
  },
  searchInNode: {
    label: 'Пошук картинки в блоці',
    icon: Layers,
    desc: 'Знайти зображення в контейнері',
    hint: 'Шукає батьківський контейнер за селектором, а всередині нього знаходить картинку за її назвою та повертає координати для кліку.',
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
    label: 'Лічильник проходів',
    icon: ArrowRightLeft,
    desc: 'Обмежувач повторень (Шлюз)',
    hint: 'Пропускає сигнал перші N разів через зелений порт "Прохід", а після вичерпання ліміту блокує і скеровує через червоний порт "Блок". Порт setLimit скидає лічильник та задає новий ліміт.',
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
    label: 'Вибір варіанту на екрані',
    icon: GitFork,
    desc: 'Клік по знайденому (DOM)',
    hint: 'Шукає на сторінці браузера варіанти (селектор кнопки, текст або картинку, наприклад: модалка з кнопками «Прийняти» / «Відхилити») і клікає по першому знайденому варіанту.',
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
      configId: null,                                  // ID конфігурації для умовного запуску
    },
  },
  cooldownNode: {
    label: 'Кулдаун (Періодичність)',
    icon: Clock, // або Timer, але Timer вже є вище
    desc: 'Обмеження частоти запуску',
    hint: 'Пропускає сигнал не частіше ніж раз на вказаний проміжок часу. Всі повторні спроби протягом кулдауну йдуть по червоній гілці.',
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
  roninWalletNode: {
    label: 'Ronin Wallet',
    icon: Wallet,
    desc: 'Взаємодія з гаманцем',
    hint: 'Відкриває Ronin Wallet і автоматично виконує дії (розблокування, підтвердження транзакцій, підписання тощо).',
    defaultColor: '#2563eb',
    defaults: {
      password: 'Ronin123!@#',
      maxAttempts: 3
    }
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
  deliNode: {
    label: 'Шеф Deli',
    icon: ChefHat,
    desc: 'Готування в Deli',
    hint: 'Перевіряє всі страви Deli згори донизу. Якщо страва увімкнена, її кількість менша за ліміт і вистачає інгредієнтів — клікає по її селектору.',
    defaultColor: '#f43f5e',
    defaults: {
      rules: Object.keys(DELI_RECIPES_DATA || {}).map(recipeName => ({
        recipeName, enabled: false, maxDish: 10, ingMultipliers: Object.keys(DELI_RECIPES_DATA?.[recipeName] || {}).reduce((acc, ing) => ({...acc, [ing]: 1}), {}), selector: ''
      }))
    }
  },
  smoothieShackNode: {
    label: 'Шеф Smoothie Shack',
    icon: ChefHat,
    desc: 'Готування в Smoothie Shack',
    hint: 'Перевіряє всі напої Smoothie Shack згори донизу. Якщо напій увімкнений, кількість менша за ліміт і вистачає інгредієнтів — клікає по його селектору.',
    defaultColor: '#ec4899',
    defaults: {
      rules: Object.keys(SMOOTHIE_SHACK_RECIPES_DATA || {}).map(recipeName => ({
        recipeName, enabled: false, maxDish: 10, ingMultipliers: Object.keys(SMOOTHIE_SHACK_RECIPES_DATA?.[recipeName] || {}).reduce((acc, ing) => ({...acc, [ing]: 1}), {}), selector: ''
      }))
    }
  },
  bakeryNode: {
    label: 'Шеф Bakery',
    icon: ChefHat,
    desc: 'Готування в Bakery',
    hint: 'Перевіряє всю випічку Bakery згори донизу. Якщо випічка увімкнена, її кількість менша за ліміт і вистачає інгредієнтів — клікає по її селектору.',
    defaultColor: '#f59e0b',
    defaults: {
      rules: Object.keys(BAKERY_RECIPES_DATA || {}).map(recipeName => ({
        recipeName, enabled: false, maxDish: 10, ingMultipliers: Object.keys(BAKERY_RECIPES_DATA?.[recipeName] || {}).reduce((acc, ing) => ({...acc, [ing]: 1}), {}), selector: ''
      }))
    }
  },
  foodNode: {
    label: 'Їжа',
    icon: PackageCheck,
    desc: 'Їсти предмети їжі',
    hint: 'Нода їжі: для кожного увімкненого предмету їжі (налаштування у Глобальних Налаштуваннях → Їжа) клікає по зображенню предмету, потім по кнопці "з\'їсти".',
    defaultColor: '#f59e0b',
    defaults: {
      eatButtonSelector: ''
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
  },
  memoryGameNode: {
    label: 'Гра Пам\'ять',
    icon: Gamepad2,
    desc: 'Міні-гра memory',
    hint: 'Автоматично проходить міні-гру на пам\'ять (перевертання карток). Підтримує миттєвий режим Phaser Hook безпосередньо через стан рушія гри або класичний комп\'ютерний зір.',
    defaultColor: '#7c3aed',
    defaults: {
      engineMode: 'auto',
      phaserFlipDelay: 250,
      phaserPairDelay: 380,
      flipDelay: 800,
      mismatchDelay: 1500,
    }
  },
  whackAMoleNode: {
    label: 'Вдарь Крота',
    icon: Hammer,
    desc: 'Міні-гра Whack-a-Mole',
    hint: 'Автоматично проходить міні-гру «Вдарь Крота» (3×3). Підтримує надшвидкий режим Phaser Hook (зчитування 9 лунок безпосередньо з рушія Phaser, захист від зайців і пустих лунок) з авто-фолбеком на комп\'ютерний зір (NCC-шаблони).',
    defaultColor: '#d97706',
    defaults: {
      engineMode: 'auto',
      reactionDelay: 50,
      targetScore: 0,
      autoStart: true,
      checkInterval: 400,
      clickDelay: 150,
      matchThreshold: 0.72,
      maxDuration: 60000,
    }
  },
  sequenceMemoryNode: {
    label: 'Гра Послідовність',
    icon: Sparkles,
    desc: 'Міні-гра Simon Says / Спалахи',
    hint: 'Автоматично проходить міні-гру на запам\'ятовування послідовності спалахів (9 предметів). Фіксує порядок загоряння, відстежує індикатор помилки та індикатор перемоги, а після завершення демонстрації автоматично клікає збережену чергу.',
    defaultColor: '#6366f1',
    defaults: {
      engineMode: 'auto',
      targetScore: 5,
      reactionDelay: 100,
      pressDuration: 60,
      stepDelay: 120,
      autoStart: true,
      flashThreshold: 0.25,
      flashSilenceTimeout: 1200,
      clickDelay: 200,
      maxDuration: 120000,
      onErrorAction: 'reset',
    }
  },
  chickenRescueNode: {
    label: 'Порятунок Кур',
    icon: Egg,
    desc: 'Міні-гра Chicken Rescue / Змійка',
    hint: 'Автоматично проходить міні-гру «Порятунок Кур» (збір сплячих курчат у конга-хвіст, ухиляння від гоблінів та перешкод). Працює у надшвидкому 60 FPS режимі Phaser Hook з BFS-пошуком та захистом від глухих кутів (Flood Fill).',
    defaultColor: '#eab308',
    defaults: {
      engineMode: 'phaser',
      targetScore: 40,
      autoStart: true,
      maxDuration: 120000,
      retryOnDeath: true,
      maxRetries: 3
    }
  },
  captchaSolverNode: {
    label: 'Капча (Quick Check)',
    icon: Puzzle,
    desc: 'Проходження капчі (Drag Puzzle & Rotate)',
    hint: 'Автоматично виявляє та проходить обидва типи захисної капчі Sunflower Land: 1) Пазл перетягування («Drag the crop into the empty slot»); 2) Обертання предмета («Rotate the item until it is upright»). Зчитує точні кути або координати, виконує плавний поворот чи перетягування, підтверджує та натискає «Continue». Якщо капчі немає — передає керування далі (режим пропуску).',
    defaultColor: '#f97316',
    defaults: {
      skipIfNotFound: true,
      timeout: 5000,
      dragDurationMs: 400,
      dragSteps: 30,
      autoClickContinue: true,
      maxRetries: 2
    }
  },
  fruitRunnerNode: {
    label: 'Фруктовий Ранер',
    icon: Gamepad2,
    desc: 'Міні-гра ухиляння та збору фруктів',
    hint: 'Автоматично проходить міні-гру Fruit Dash (Sunflower Land). Адаптивний комп\'ютерний зір з калібруванням кольорів дороги, lane-based ухиляння від перешкод (ями, камені, могили), збір фруктів та пауер-апів (мухомор, кирка, годинник). Динамічний горизонт захисту, що зростає зі швидкістю гри.',
    defaultColor: '#10b981',
    defaults: {
      targetScore: 2500,
      maxDuration: 120000,
      dangerLookahead: 400,
      safetyMargin: 30,
      snapshotInterval: 500,
      numLanes: 5,
      gameAreaSelector: 'canvas',
      manualRoadLeft: 0,
      manualRoadRight: 0,
      playerFrameTop: 0,
      playerFrameBottom: 0,
      detectionTopY: 0,
      detectionBottomY: 0,
      enableDebugSnapshot: true,
    }
  },
  worldNavigatorNode: {
    label: 'Навігатор до NPC',
    icon: Compass,
    desc: 'Рух до NPC у відкритому світі',
    hint: 'Автоматично визначає положення персонажа у відкритому світі (Плаза, Пляж, Притулок тощо), знаходить цільового NPC або координати, розраховує оптимальний шлях за алгоритмом A* в обхід усіх стін та перешкод карти. Плавно веде персонажа через нативний джойстик та відкриває діалог чи магазин (клік / Space).',
    defaultColor: '#4f46e5',
    defaults: {
      targetLocation: 'current',
      customLocationUrl: '',
      targetNpc: 'stella',
      customNpcName: '',
      customCoords: { x: 0, y: 0 },
      autoInteract: true,
      interactionDistance: 35,
      timeoutSeconds: 35
    }
  },
  // Конфігурація для нової ноди "Введення та Клік"
  searchAndClickNode: {
    // Візуальна назва ноди
    label: 'Введення та Клік',
    // Іконка для ноди
    icon: MousePointerClick,
    // Короткий опис
    desc: 'Ввести текст та клікнути',
    // Докладна підказка щодо принципу роботи ноди
    hint: 'Вводить вказаний текст в інпут, очікує оновлення інтерфейсу, після чого знаходить елемент із цим текстом і клікає на нього.',
    // Колір ноди за замовчуванням (фіолетовий)
    defaultColor: '#9333ea',
    // Початкові значення полів при створенні ноди
    defaults: {
      // Початковий порожній селектор для поля введення
      inputSelector: '',
      // Початковий порожній текст для введення
      textToEnter: '',
      // Початковий порожній селектор елемента для кліку
      clickSelector: '',
      // Дефолтна затримка перед кліком у мілісекундах (500 мс)
      clickDelay: 500
    }
  },
  // Нода конфігурації — перевіряє умови з JSON-файлів проекту
  configNode: {
    label: 'Конфігурація',
    icon: Settings,
    desc: 'Перевірки з JSON',
    hint: 'Завантажує збережену конфігурацію правил і перевіряє їх по JSON-файлах проекту (наприклад _save.json). Підтримує порівняння чисел, перевірку наявності, читання та видалення значень.',
    defaultColor: '#06b6d4',
    defaults: {
      configId: '',
    }
  },
  islandArrangerNode: {
    label: 'Дизайнер Острова',
    icon: Move,
    desc: 'Перестановка будівель',
    hint: 'Звіряє поточну карту острова з тою, яку ви налаштували у візуальному редакторі (Карта Острова), і автоматично переміщує будівлі/грядки на їх нові місця.',
    defaultColor: '#facc15',
    defaults: {
      filterType: 'all', // all, crops, buildings, collectibles
      step1Selector: '',
      step3Selector: '',
      step6Selector: '',
      step7Selector: '',
      step8Selector: '',
      step9Selector: '',
      step10Selector: ''
    }
  },
  buildingPlacerNode: {
    label: 'Розміщення Будівлі',
    icon: Hammer,
    desc: 'Купівля і розміщення будівлі',
    hint: 'Автоматично відкриває магазин, вибирає категорію, будівлю, натискає Craft, розміщує на карті острова по координатах, підтверджує (2 кліки) та зберігає.',
    defaultColor: '#f59e0b',
    defaults: {
      shopImage: '',
      categoryImage: '',
      buildingImage: '',
      craftButtonSelector: 'button:has-text("Craft")',
      craftButtonImage: '',
      buildingName: '',
      confirmImage1: '',
      confirmImage2: '',
      saveButtonSelector: 'button:has-text("Save")',
      saveButtonImage: '',
      stepDelayMs: 1000,
    }
  },
  deliveryNode: {
    label: 'Доставки',
    icon: PackageCheck,
    desc: 'Обробка відмічених доставок',
    hint: 'Перевіряє відмічені доставки з проекту і для кожної виконує: 1) клік на зображення 2) клік по селектору 3) клік по селектору і зняття відмітки. Виходи: success (є доставки), no_deliveries (нема доставок), error (помилка).',
    defaultColor: '#0ea5e9',
    defaults: {
      deliveries: [
        { name: 'betty', image: '', enabled: true },
        { name: 'blacksmith', image: '', enabled: true },
        { name: 'bert', image: '', enabled: true },
        { name: 'corale', image: '', enabled: true },
        { name: 'cornwell', image: '', enabled: true },
        { name: 'finley', image: '', enabled: true },
        { name: 'finn', image: '', enabled: true },
        { name: 'gambit', image: '', enabled: true },
        { name: 'gordo', image: '', enabled: true },
        { name: 'grimbly', image: '', enabled: true },
        { name: 'grimtooth', image: '', enabled: true },
        { name: 'grubnuk', image: '', enabled: true },
        { name: 'jester', image: '', enabled: true },
        { name: 'miranda', image: '', enabled: true },
        { name: 'old salty', image: '', enabled: true },
        { name: 'peggy', image: '', enabled: true },
        { name: 'pharaoh', image: '', enabled: true },
        { name: "pumpkin' pete", image: '', enabled: true },
        { name: 'raven', image: '', enabled: true },
        { name: 'tango', image: '', enabled: true },
        { name: 'timmy', image: '', enabled: true },
        { name: 'tywin', image: '', enabled: true },
        { name: 'victoria', image: '', enabled: true }
      ],
      step2Selector: '',
      step3Selector: ''
    }
  },
  textInputNode: {
    label: 'Введення Тексту',
    icon: Type,
    desc: 'Вставка тексту в поле',
    hint: 'Знаходить поле введення (input, textarea тощо) за CSS-селектором та вставляє в нього текст. Підтримує динамічне отримання тексту через вхідний порт "Вхід тексту" (зліва) або з іншої ноди/змінної.',
    defaultColor: '#2563eb',
    defaults: {
      selector: '',
      text: '',
      clearFirst: true,
      pressEnter: false,
      delayBetweenKeys: 0
    }
  },
  flowerPlanterNode: {
    label: 'Посадник Квіток',
    icon: Flower,
    desc: 'Вибір квітки для посадки',
    hint: 'Читає інвентар з _save.json. Перевіряє наявність насіння та ресурсів для кожної увімкненої квітки. Вибирає квітку якої найменше в інвентарі. Виконує 2 кліки: насіння → ресурс. Виходи: plant (кліки виконано) та skip (нічого не підійшло).',
    defaultColor: '#10b981',
    defaults: {
      rules: Object.entries(
        (()=>{
          const data: Record<string,{seed:string,resources:string[]}> = {
            "Red Pansy":    {seed:"Sunpetal Seed",resources:["Radish","Banana","Red Cosmos","Purple Daffodil","Red Balloon Flower","Red Lotus","Primula Enigma"]},
            "Yellow Pansy": {seed:"Sunpetal Seed",resources:["Sunflower","Apple","Red Pansy","Red Daffodil","Yellow Balloon Flower","Yellow Carnation"]},
            "Purple Pansy": {seed:"Sunpetal Seed",resources:["Blue Pansy","Purple Balloon Flower","Purple Carnation"]},
            "White Pansy":  {seed:"Sunpetal Seed",resources:["Yellow Cosmos"]},
            "Blue Pansy":   {seed:"Sunpetal Seed",resources:["Purple Cosmos","White Pansy","White Cosmos","White Daffodil","Blue Daffodil","White Carnation"]},
            "Red Cosmos":   {seed:"Sunpetal Seed",resources:["Yellow Daffodil","Purple Lotus"]},
            "Yellow Cosmos":{seed:"Sunpetal Seed",resources:["Yellow Pansy","White Balloon Flower","Red Carnation"]},
            "Purple Cosmos":{seed:"Sunpetal Seed",resources:["Beetroot","Eggplant","Kale","Blue Cosmos","Blue Balloon Flower","Celestial Frostbloom"]},
            "White Cosmos": {seed:"Sunpetal Seed",resources:["Prism Petal","Yellow Lotus"]},
            "Blue Cosmos":  {seed:"Sunpetal Seed",resources:["Cauliflower","Parsnip","Blueberry","Purple Pansy","White Lotus","Blue Carnation"]},
            "Prism Petal":  {seed:"Sunpetal Seed",resources:["Blue Lotus"]},
            "Red Balloon Flower":    {seed:"Bloom Seed",resources:["Sunflower","Beetroot","Apple","Banana","Purple Pansy","Red Pansy","Red Daffodil","Yellow Daffodil","Purple Daffodil","Yellow Carnation"]},
            "Yellow Balloon Flower": {seed:"Bloom Seed",resources:["Yellow Lotus"]},
            "Purple Balloon Flower": {seed:"Bloom Seed",resources:["Blue Carnation"]},
            "White Balloon Flower":  {seed:"Bloom Seed",resources:["White Cosmos","Blue Daffodil","White Daffodil","White Balloon Flower"]},
            "Blue Balloon Flower":   {seed:"Bloom Seed",resources:["Cauliflower","Parsnip","Eggplant","Kale","Blue Pansy","Blue Cosmos","Purple Cosmos","Blue Balloon Flower","Celestial Frostbloom"]},
            "Red Daffodil":    {seed:"Bloom Seed",resources:["Yellow Pansy","Yellow Balloon Flower","Red Carnation","Primula Enigma"]},
            "Yellow Daffodil": {seed:"Bloom Seed",resources:["Red Cosmos","White Carnation","White Lotus"]},
            "Purple Daffodil": {seed:"Bloom Seed",resources:["Radish","Blueberry","Red Balloon Flower","Red Lotus","Blue Lotus"]},
            "White Daffodil":  {seed:"Bloom Seed",resources:["Yellow Cosmos","Prism Petal"]},
            "Blue Daffodil":   {seed:"Bloom Seed",resources:["Purple Balloon Flower","Purple Carnation","Purple Lotus"]},
            "Celestial Frostbloom": {seed:"Bloom Seed",resources:["White Pansy"]},
            "Red Carnation":    {seed:"Sprout Mix",resources:["Yellow Cosmos","Red Balloon Flower","Yellow Lotus"]},
            "Yellow Carnation": {seed:"Sprout Mix",resources:["Yellow Pansy","Red Balloon Flower","Yellow Carnation"]},
            "Purple Carnation": {seed:"Sprout Mix",resources:["Blue Pansy","Purple Balloon Flower"]},
            "White Carnation":  {seed:"Sprout Mix",resources:["Blue Pansy","White Balloon Flower","White Lotus","White Daffodil"]},
            "Blue Carnation":   {seed:"Sprout Mix",resources:["Purple Cosmos","Purple Balloon Flower","Blue Carnation"]},
            "Red Lotus":    {seed:"Sprout Mix",resources:["Red Pansy","Red Daffodil","Red Lotus"]},
            "Yellow Lotus": {seed:"Sprout Mix",resources:["Red Pansy","Yellow Lotus"]},
            "Purple Lotus": {seed:"Sprout Mix",resources:["Red Cosmos","Purple Daffodil","Purple Lotus"]},
            "White Lotus":  {seed:"Sprout Mix",resources:["Yellow Daffodil","White Lotus"]},
            "Blue Lotus":   {seed:"Sprout Mix",resources:["Blue Pansy","Blue Cosmos","Blue Lotus","Prism Petal"]},
            "Primula Enigma": {seed:"Sprout Mix",resources:["Red Pansy","Red Daffodil"]},
          };
          return data;
        })()
      ).map(([flowerName, recipe]) => ({
        flowerName,
        seed: recipe.seed,
        enabled: false,
        seedMultiplier: 1,
        resources: recipe.resources.map(resourceName => ({ resourceName, enabled: true, multiplier: 1 }))
      })),
      selectors: {}
    }
  }
};

// Список типів нод що відображаються у сайдбарі (в порядку)
export const SIDEBAR_NODE_TYPES = Object.keys(NODE_CONFIG);

