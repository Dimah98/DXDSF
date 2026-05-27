export type PortDescription = {
  title: string;
  type: string;
  desc: string;
  color?: string;
};

export const PORT_TOOLTIPS: Record<string, Record<string, PortDescription>> = {
  // Загальні порти (fallback)
  default: {
    target: { title: 'Вхід', type: 'Сигнал', desc: 'Приймає сигнал для активації ноди.', color: '#94a3b8' },
    next: { title: 'Вихід (Далі)', type: 'Сигнал', desc: 'Передає сигнал далі після успішного виконання.', color: '#64748b' },
  },
  startNode: {
    next: { title: 'Старт', type: 'Сигнал', desc: 'Запускає весь сценарій.', color: '#22c55e' }
  },
  groupNode: {
    // Вхідний порт зовнішньої ноди (зелений)
    in: { title: 'Вхід у підпрограму', type: 'Сигнал', desc: 'Запускає виконання всіх внутрішніх нод контейнера. Дані з контексту передаються у підпрограму.', color: '#22c55e' },
    // Вихідний порт зовнішньої ноди (червоний)
    out: { title: 'Вихід з підпрограми', type: 'Сигнал', desc: 'Сигнал передається далі після того, як внутрішній граф повністю виконав усі ноди і досяг вихідної точки.', color: '#ef4444' },
  },
  actionNode: {
    target: { title: 'Вхід', type: 'Сигнал', desc: 'Активує виконання дії.' },
    next: { title: 'Далі', type: 'Сигнал', desc: 'Передає сигнал після завершення дії.' }
  },
  coordClickNode: {
    target: { title: 'Вхід (Клік)', type: 'Сигнал', desc: 'Активує клік по збережених координатах.' },
    update_coords: { title: 'Оновити координати', type: 'Дані (X,Y)', desc: 'Отримує нові координати з іншої ноди (напр. Сканер) і оновлює внутрішній стан перед кліком.', color: '#0ea5e9' },
    next: { title: 'Далі', type: 'Сигнал', desc: 'Передає сигнал після кліку.' }
  },
  coordOffsetNode: {
    target: { title: 'Вхід', type: 'Дані (X,Y)', desc: 'Отримує координати для зміщення.' },
    coords: { title: 'Зміщені координати', type: 'Дані (X,Y)', desc: 'Видає нові координати (X + offset, Y + offset).', color: '#0ea5e9' },
    next: { title: 'Далі', type: 'Сигнал', desc: 'Передає сигнал далі.' }
  },
  compareNode: {
    execute: { title: 'Вхід', type: 'Сигнал', desc: 'Запускає перевірку умови.' },
    valA: { title: 'Значення A', type: 'Дані (Число/Текст)', desc: 'Отримує значення для лівої частини порівняння з контексту.', color: '#6366f1' },
    valB: { title: 'Значення B', type: 'Дані (Число/Текст)', desc: 'Отримує значення для правої частини порівняння з контексту.', color: '#818cf8' },
    true: { title: 'Умова виконана (Так)', type: 'Сигнал', desc: 'Спрацьовує, якщо результат порівняння True.', color: '#22c55e' },
    false: { title: 'Умова не виконана (Ні)', type: 'Сигнал', desc: 'Спрацьовує, якщо результат порівняння False.', color: '#ef4444' }
  },
  selectorCheckNode: {
    target: { title: 'Вхід', type: 'Сигнал', desc: 'Запускає пошук елемента в DOM.' },
    exists: { title: 'Знайдено', type: 'Сигнал', desc: 'Спрацьовує, якщо елемент присутній на сторінці.', color: '#22c55e' },
    not_exists: { title: 'Не знайдено', type: 'Сигнал', desc: 'Спрацьовує, якщо елемента немає.', color: '#ef4444' }
  },
  gateNode: {
    target: { title: 'Вхід', type: 'Сигнал', desc: 'Спроба пройти через шлюз. Збільшує лічильник.' },
    setLimit: { title: 'Встановити ліміт', type: 'Дані (Число)', desc: 'Приймає число з контексту для оновлення ліміту та скидає лічильник до нуля.', color: '#f59e0b' },
    pass: { title: 'Прохід', type: 'Сигнал', desc: 'Спрацьовує, поки лічильник не перевищив ліміт.', color: '#22c55e' },
    limit: { title: 'Ліміт', type: 'Сигнал', desc: 'Спрацьовує, якщо ліміт вже вичерпано.', color: '#ef4444' }
  },
  multiLogicNode: {
    target: { title: 'Вхід', type: 'Сигнал', desc: 'Запускає перевірку всіх умов зверху вниз.' },
    default: { title: 'За замовчуванням', type: 'Сигнал', desc: 'Спрацьовує, якщо жодна умова не виконалася.', color: '#64748b' }
    // out_0, out_1 оброблятимуться динамічно в компоненті
  },
  rotatorNode: {
    target: { title: 'Вхід', type: 'Сигнал', desc: 'Передає сигнал на наступний по черзі або випадковий вихід.' }
    // out_0, out_1 оброблятимуться динамічно
  },
  calculatorNode: {
    target: { title: 'Вхід', type: 'Сигнал', desc: 'Загальний вхід (наразі ігнорується, потрібні специфічні порти).' }
    // val_0_0, run_0 оброблятимуться динамічно
  },
  eventVariationsNode: {
    target: { title: 'Вхід', type: 'Сигнал', desc: 'Запускає перевірку всіх налаштованих подій (текст/селектор/зображення).' },
    fail: { title: 'Нічого не знайдено', type: 'Сигнал', desc: 'Спрацьовує, якщо жодна умова на сторінці не знайдена.', color: '#ef4444' }
    // port_0, port_1 оброблятимуться динамічно
  },
  infoNode: {
    target: { title: 'Вхід', type: 'Сигнал', desc: 'Запускає сканування елемента на сторінці.' },
    next: { title: 'Далі', type: 'Сигнал', desc: 'Сигнал про завершення сканування.' },
    coords: { title: 'Координати', type: 'Дані (X,Y)', desc: 'Координати центру знайденого елемента.', color: '#3b82f6' },
    text: { title: 'Текст', type: 'Дані (Текст)', desc: 'Внутрішній текст елемента.', color: '#14b8a6' },
    num: { title: 'Число', type: 'Дані (Число)', desc: 'Перше знайдене число у тексті елемента.', color: '#f59e0b' },
    children: { title: 'Кількість дочірніх', type: 'Дані (Число)', desc: 'Кількість внутрішніх тегів.', color: '#a855f7' },
    images: { title: 'Кількість фото', type: 'Дані (Число)', desc: 'Кількість тегів <img> всередині елемента.', color: '#ec4899' }
  },
  visualSearchNode: {
    target: { title: 'Вхід', type: 'Сигнал', desc: 'Запускає візуальний пошук зображення.' },
    found: { title: 'Знайдено', type: 'Сигнал', desc: 'Спрацьовує, якщо знайдено хоча б 1 збіг.', color: '#22c55e' },
    not_found: { title: 'Не знайдено', type: 'Сигнал', desc: 'Спрацьовує, якщо збігів не виявлено.', color: '#ef4444' },
    coords: { title: 'Координати', type: 'Дані (X,Y)', desc: 'Координати першого знайденого збігу.', color: '#3b82f6' },
    count: { title: 'Кількість', type: 'Дані (Число)', desc: 'Скільки разів картинка зустрічається на екрані.', color: '#f59e0b' }
  },
  imageSearchNode: {
    target: { title: 'Вхід', type: 'Сигнал', desc: 'Запускає візуальний пошук зображення.' },
    found: { title: 'Знайдено', type: 'Сигнал', desc: 'Спрацьовує, якщо знайдено хоча б 1 збіг.', color: '#22c55e' },
    not_found: { title: 'Не знайдено', type: 'Сигнал', desc: 'Спрацьовує, якщо збігів не виявлено.', color: '#ef4444' },
    coords: { title: 'Координати', type: 'Дані (X,Y)', desc: 'Координати першого знайденого збігу.', color: '#3b82f6' },
    count: { title: 'Кількість', type: 'Дані (Число)', desc: 'Скільки разів картинка зустрічається на екрані.', color: '#f59e0b' }
  },
  multiScanNode: {
    target: { title: 'Вхід', type: 'Сигнал', desc: 'Запускає почергову перевірку масиву цілей.' },
    success: { title: 'Знайдено ціль', type: 'Сигнал', desc: 'Спрацьовує, коли знайдено першу ціль, що відповідає умовам.', color: '#22c55e' },
    fail: { title: 'Нічого не знайдено', type: 'Сигнал', desc: 'Спрацьовує, якщо жодна ціль не підійшла.', color: '#ef4444' },
    coords: { title: 'Координати', type: 'Дані (X,Y)', desc: 'Координати знайденої цілі.', color: '#06b6d4' }
  },
  valueLoopNode: {
    target: { title: 'Вхід', type: 'Сигнал', desc: 'Запускає цикл перебору елементів.' },
    done: { title: 'Цикл завершено', type: 'Сигнал', desc: 'Спрацьовує після успішного проходження по всіх елементах.', color: '#22c55e' },
    fail: { title: 'Немає елементів', type: 'Сигнал', desc: 'Спрацьовує, якщо список елементів порожній.', color: '#ef4444' }
  },
  searchInNode: {
    target: { title: 'Вхід', type: 'Сигнал', desc: 'Запускає пошук всередині іншого елемента.' },
    found: { title: 'Знайдено', type: 'Сигнал', desc: 'Спрацьовує, якщо елемент знайдено.', color: '#10b981' },
    not_found: { title: 'Не знайдено', type: 'Сигнал', desc: 'Спрацьовує, якщо дочірній елемент відсутній.', color: '#ef4444' },
    coords: { title: 'Координати', type: 'Дані (X,Y)', desc: 'Координати знайденого дочірнього елемента.', color: '#3b82f6' }
  },
  apiNode: {
    target: { title: 'Вхід', type: 'Сигнал', desc: 'Виконує HTTP-запит до API.' },
    next: { title: 'Далі', type: 'Дані (JSON)', desc: 'Передає отримані JSON-дані у загальний контекст.', color: '#6366f1' }
  },
  variableNode: {
    target: { title: 'Вхід', type: 'Дані', desc: 'Отримує дані (напр. від API або Сканера) і зберігає їх у глобальні змінні.' },
    next: { title: 'Далі', type: 'Сигнал', desc: 'Передає початковий контекст далі без змін.' }
  },
  displayNode: {
    target: { title: 'Вхід', type: 'Дані', desc: 'Приймає будь-які дані з контексту для візуалізації в редакторі.' }
  }
};

// Допоміжна функція для визначення динамічних портів (наприклад, out_0, val_0_0)
export const getDynamicPortTooltip = (nodeType: string, handleId: string): PortDescription | null => {
  if (handleId === 'target' || handleId === 'next') return null; // Якщо стандартний, буде взятий з об'єкта

  if (nodeType === 'multiLogicNode') {
    if (handleId.startsWith('out_')) {
      const idx = handleId.split('_')[1];
      return { title: `Вихід #${parseInt(idx) + 1}`, type: 'Сигнал', desc: 'Спрацьовує, якщо виконалась відповідна умова зі списку.', color: '#8b5cf6' };
    }
    if (handleId.startsWith('val_')) {
      const idx = handleId.split('_')[1];
      return { title: `Записати умову #${parseInt(idx) + 1}`, type: 'Дані (Число)', desc: 'Приймає число з контексту та записує його у правило порівняння цієї гілки (не запускає логіку).', color: '#f59e0b' };
    }
  }
  
  if (nodeType === 'rotatorNode' && handleId.startsWith('out_')) {
    const idx = handleId.split('_')[1];
    return { title: `Вихід #${parseInt(idx) + 1}`, type: 'Сигнал', desc: 'Спрацьовує, коли настає черга цього порту (або випадково).', color: '#6366f1' };
  }
  
  if (nodeType === 'eventVariationsNode' && handleId.startsWith('port_')) {
    const idx = handleId.split('_')[1];
    return { title: `Подія #${parseInt(idx) + 1}`, type: 'Сигнал', desc: 'Спрацьовує, якщо знайдено об\'єкт, що відповідає цьому правилу.', color: '#f43f5e' };
  }
  
  if (nodeType === 'calculatorNode') {
    if (handleId.startsWith('val_')) {
      return { title: 'Встановити значення', type: 'Дані (Число)', desc: 'Приймає числове значення з контексту і записує його в рядок калькулятора.', color: '#f59e0b' };
    }
    if (handleId.startsWith('run_')) {
      return { title: 'Порахувати', type: 'Сигнал', desc: 'Запускає математичні розрахунки для цього прикладу.', color: '#22c55e' };
    }
    if (handleId.startsWith('out_')) {
      return { title: 'Результат', type: 'Дані (Число)', desc: 'Передає отриманий результат обчислень далі.', color: '#3b82f6' };
    }
  }

  return null;
};
