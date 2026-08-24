import { NodeHandlerParams } from './types';

// Обробник ноди "Диспетчер подій" (Event Variations)
export const eventVariationsHandler = async ({
  currentNode, // Поточна нода
  activePage, // Активна сторінка браузера
  context, // Поточний контекст виконання
  logToClient, // Функція для виведення повідомлень користувачу
  targetHandle, // Назва вхідного порту, через який надійшов сигнал
}: NodeHandlerParams) => {
  const { rules = [] } = currentNode.data as Record<string, unknown>;
  const rulesArray = Array.isArray(rules) ? rules : []; // Отримуємо масив правил з даних ноди

  // Отримуємо останній успішний індекс, або -1 якщо ще не було
  const lastMatchIndex = typeof currentNode.data.lastMatchIndex === 'number' ? currentNode.data.lastMatchIndex : -1;

  // Допоміжна функція для виконання перевірки варіантів
  const runMatch = async (rulesToUse: Record<string, unknown>[]) => {
    logToClient(`🎯 Диспетчер: аналіз ${rulesToUse.length} варіантів...`, 'debug'); // Логуємо старт аналізу

    if (!activePage) {
      logToClient(`❌ Диспетчер: браузер не запущено`, 'error'); // Виводимо помилку якщо браузер закритий
      return { nextHandle: 'fail', data: context }; // Повертаємо вихід у гілку "fail"
    }

    // Визначаємо з якого індексу починати (наступний після попереднього успішного)
    const startIndex = rulesToUse.length > 0 ? (lastMatchIndex + 1) % rulesToUse.length : 0;

    // Виконуємо перевірку умов безпосередньо в браузері одним швидким скриптом
    const matchIndex = await activePage.evaluate(({ rulesArr, startIdx }) => {
      const len = rulesArr.length;
      // Цикл по всіх переданих правилах по колу (починаючи з startIdx)
      for (let count = 0; count < len; count++) {
        const i = (startIdx + count) % len;
        const { type, value } = rulesArr[i]; // Отримуємо тип умови та значення для перевірки
        if (!value || (typeof value === 'string' && value.trim() === "")) continue; // Пропускаємо порожні правила

        try {
          if (type === 'selector' && typeof value === 'string') {
            // Перевіряємо наявність елемента за CSS-селектором
            if (document.querySelector(value)) return i; // Повертаємо індекс правила при успіху
          } else if (type === 'text' && typeof value === 'string') {
            // Шукаємо текст на сторінці без врахування регістру
            const textToFind = value.toLowerCase(); // Приводимо до нижнього регістру
            const pageText = document.body.innerText.toLowerCase(); // Беремо текст сторінки
            if (pageText.includes(textToFind)) return i; // Повертаємо індекс при знаходженні тексту
          } else if (type === 'image' && typeof value === 'string') {
            // Шукаємо зображення за частиною src
            const imgs = Array.from(document.querySelectorAll('img')); // Отримуємо список усіх картинок
            if (imgs.some(img => img.src && img.src.includes(value))) return i; // Перевіряємо чи є збіг у src
          }
        } catch (e) {
          continue; // При будь-якій помилці в селекторі переходимо до наступного правила
        }
      }
      return -1; // Повертаємо -1 якщо жодна з умов не виконалася
    }, { rulesArr: rulesToUse, startIdx: startIndex });

    // Аналізуємо результат пошуку
    if (matchIndex !== -1) {
      const matched = rulesToUse[matchIndex]; // Отримуємо правило, яке спрацювало
      logToClient(`✅ Спрацював варіант #${matchIndex + 1}: ${matched.type} [${matched.value}]`, 'success'); // Логуємо успіх
      
      // Повертаємо вихідний порт для знайденого варіанту та додаємо його значення в контекст
      const typedValue = matched.value as string | number | null;
      return { 
        nextHandle: `port_${matchIndex}`, 
        data: { ...context, value: typedValue },
        updateNodeData: { lastMatchIndex: matchIndex } // Зберігаємо індекс цього спрацювання для наступного разу
      };
    }

    logToClient(`ℹ️ Жодна з умов не знайдена`, 'debug'); // Логуємо якщо нічого не знайдено
    return { nextHandle: 'fail', data: context }; // Спрямовуємо сценарій у вихідний порт "fail"
  };

  // 1. Обробка надходження значення через додаткові входи (in_)
  if (targetHandle?.startsWith('in_')) {
    const ruleIdx = parseInt(targetHandle.split('_')[1]); // Отримуємо індекс правила з імені порту
    if (rulesArray[ruleIdx]) {
      let valueToStore = ''; // Змінна для нового значення
      if (typeof context === 'object' && context !== null) {
        // Витягуємо текст, число або значення з об'єкта контексту
        valueToStore = String(context.value ?? context.text ?? context.number ?? '0');
      } else {
        // Або приводимо контекст до рядка
        valueToStore = String(context ?? '');
      }

      rulesArray[ruleIdx].value = valueToStore; // Записуємо нове значення у відповідне правило
      logToClient(`📥 Диспетчер: записано значення в правило #${ruleIdx + 1}: ${valueToStore}`, 'info'); // Повідомляємо користувача

      // Перевіряємо прапорець автоматичного запуску після запису для цього правила
      if (rulesArray[ruleIdx].triggerOnInput) {
        logToClient(`⚡ Авто-запуск диспетчера подій...`, 'info'); // Логуємо авто-запуск
        const matchResult = await runMatch(rulesArray); // Запускаємо перевірку оновлених правил
        return {
          ...matchResult, // Передаємо результат виконання
          updateNodeData: { 
            rules: rulesArray, 
            ...(matchResult.updateNodeData || {}) // Об'єднуємо об'єкти
          }
        };
      } else {
        // Якщо авто-запуск вимкнено — просто зберігаємо значення в ноду та зупиняємо виконання
        return {
          updateNodeData: { rules: rulesArray }, // Передаємо оновлені правила на фронтенд
          nextHandle: null // Зупиняємо виконання сценарію на цьому кроці
        };
      }
    }
  }

  // 2. Звичайний запуск диспетчера при надходженні сигналу на основний вхід
  return runMatch(rulesArray);
};
