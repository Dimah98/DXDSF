import { NodeHandlerParams } from './types';

// Обробник ноди "Диспетчер подій" (Event Variations)
export const eventVariationsHandler = async ({
  currentNode,
  activePage,
  context,
  logToClient,
}: NodeHandlerParams) => {
  const { rules = [] } = currentNode.data; // Отримуємо масив правил з даних ноди

  logToClient(`🎯 Диспетчер: аналіз ${rules.length} варіантів...`, 'debug');

  // Виконуємо перевірку безпосередньо в браузері одним швидким скриптом
  const matchIndex = await activePage.evaluate((rulesArr: any[]) => {
    for (let i = 0; i < rulesArr.length; i++) {
      const { type, value } = rulesArr[i]; // Отримуємо тип (text/selector/image) та значення
      if (!value || value.trim() === "") continue; // Пропускаємо порожні або пробільні значення

      try {
        if (type === 'selector') {
          // Шукаємо елемент за CSS-селектором (try/catch захищає від помилок синтаксису)
          if (document.querySelector(value)) return i;
        } else if (type === 'text') {
          // Шукаємо текст на сторінці (без врахування регістру)
          const textToFind = value.toLowerCase();
          const pageText = document.body.innerText.toLowerCase();
          if (pageText.includes(textToFind)) return i;
        } else if (type === 'image') {
          // Шукаємо картинку в тегах img за частиною назви у src
          const imgs = Array.from(document.querySelectorAll('img'));
          if (imgs.some(img => img.src && img.src.includes(value))) return i;
        }
      } catch (e) {
        // У разі помилки в правилі (наприклад, кривий селектор) — йдемо до наступного
        continue;
      }
    }
    return -1; // Повертаємо -1, якщо жодна умова не виконалася
  }, rules);

  // Перевіряємо результат пошуку
  if (matchIndex !== -1) {
    const matched = rules[matchIndex]; // Отримуємо дані правила, що спрацювало
    logToClient(`✅ Спрацював варіант #${matchIndex + 1}: ${matched.type} [${matched.value}]`, 'success');
    
    return { nextHandle: `port_${matchIndex}`, data: { ...context, value: matched.value } };
  }

  logToClient(`ℹ️ Жодна з умов не знайдена`, 'debug');
  return { nextHandle: 'fail', data: context }; // Виходимо в порт "fail" (Нічого не знайдено)
};
