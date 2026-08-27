import { NodeHandlerParams } from './types'; // Імпортуємо інтерфейс параметрів обробника ноди
import { getDayStart3AM, parseTimestampMs } from '../configs/ConfigEvaluator';

export const multiLogicNodeHandler = async ({ currentNode, globalVariables, logToClient, context, targetHandle, ws }: NodeHandlerParams) => {
  const nodeData = currentNode.data as Record<string, unknown>;
  const conds = Array.isArray(nodeData.conditions) ? nodeData.conditions : []; // Отримуємо масив умов з даних ноди

  // ─── Безпечний парсер умов (без eval) ──────────────────────────────────────
  // Підтримує: varName op value, наприклад: "gold > 100" або "energy <= 50"
  // Логічні оператори: && (AND), || (OR)
  const safeEvalExpression = (expr: string): boolean => {
    try {
      // Підставляємо значення змінних у вираз
      let substituted = expr; // Копіюємо вираз для замін
      // Сортуємо ключі за довжиною (від довших до коротших) щоб уникнути часткових замін
      const sortedKeys = Object.keys(globalVariables).sort((a, b) => b.length - a.length);
      for (const key of sortedKeys) {
        // Замінюємо ім'я змінної на її числове/рядкове значення
        const val = globalVariables[key]; // Отримуємо поточне значення змінної
        const numVal = parseFloat(String(val).replace(/\s/g, '').replace(',', '.')); // Пробуємо розпарсити як число
        const replacement = isNaN(numVal) ? `"${String(val)}"` : String(numVal); // Отримуємо рядок для заміни
        // Замінюємо ім'я змінної з підтримкою кирилиці
        const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // Екрануємо символи регулярок
        const boundaryRegex = new RegExp(`(^|[^a-zA-Z0-9_а-яА-ЯіІїЇєЄґҐ])${escapedKey}(?=[^a-zA-Z0-9_а-яА-ЯіІїЇєЄґҐ]|$)`, 'g'); // Створюємо регулярний вираз меж
        substituted = substituted.replace(boundaryRegex, `$1${replacement}`); // Виконуємо заміну
      }

      // Розбиваємо на AND/OR секції та обчислюємо без eval
      const evalSingleCondition = (part: string): boolean => {
        part = part.trim(); // Прибираємо зайві пробіли
        // Підтримувані оператори порівняння (від довших до коротших — важливо!)
        const operators = ['time_is_today', 'time_not_today', '>=', '<=', '!=', '==', '>', '<'];
        for (const op of operators) {
          const idx = part.indexOf(op); // Шукаємо оператор у виразі
          if (idx === -1) continue; // Продовжуємо пошук якщо не знайдено
          const left  = part.slice(0, idx).trim(); // Отримуємо ліву частину
          const right = part.slice(idx + op.length).trim(); // Отримуємо праву частину
          // Очищуємо лапки для рядкового порівняння
          const leftClean  = left.replace(/^"|"$/g, ''); // Чистимо лапки зліва
          const rightClean = right.replace(/^"|"$/g, ''); // Чистимо лапки справа
          const leftNum  = parseFloat(leftClean); // Парсимо число зліва
          const rightNum = parseFloat(rightClean); // Парсимо число справа
          const useNum = !isNaN(leftNum) && !isNaN(rightNum); // Перевіряємо чи обидва значення числові

          logToClient(`🔍 Порівняння: [${leftClean}] ${op} [${rightClean}]`, 'debug'); // Логуємо хід порівняння

          if (op === 'time_is_today') {
            const ts = parseTimestampMs(leftClean);
            const pass = ts > 0 && getDayStart3AM(ts) === getDayStart3AM(Date.now());
            logToClient(`📅 ${ts > 0 ? new Date(ts).toLocaleString('uk-UA') : leftClean} є сьогодні (з 03:00) → ${pass}`, pass ? 'success' : 'error');
            return pass;
          }
          if (op === 'time_not_today') {
            const ts = parseTimestampMs(leftClean);
            const pass = ts === 0 || getDayStart3AM(ts) !== getDayStart3AM(Date.now());
            logToClient(`📅 ${ts > 0 ? new Date(ts).toLocaleString('uk-UA') : leftClean} не сьогодні (з 03:00) → ${pass}`, pass ? 'success' : 'error');
            return pass;
          }
          if (op === '>')  return useNum ? leftNum > rightNum  : leftClean > rightClean; // Більше
          if (op === '<')  return useNum ? leftNum < rightNum  : leftClean < rightClean; // Менше
          if (op === '>=') return useNum ? leftNum >= rightNum : leftClean >= rightClean; // Більше або дорівнює
          if (op === '<=') return useNum ? leftNum <= rightNum : leftClean <= rightClean; // Менше або дорівнює
          if (op === '==') return useNum ? leftNum === rightNum : leftClean === rightClean; // Дорівнює
          if (op === '!=') return useNum ? leftNum !== rightNum : leftClean !== rightClean; // Не дорівнює
        }
        // Якщо оператора немає — перевіряємо truthy значення
        const num = parseFloat(part); // Пробуємо перетворити в число
        return isNaN(num) ? part.length > 0 && part !== 'false' && part !== '""' : num !== 0; // Повертаємо логічний результат
      };

      // Обробляємо OR-групи (розбиваємо || першим, потім && всередині кожної групи)
      const orGroups = substituted.split('||'); // Розбиваємо вираз за АБО
      return orGroups.some(orGroup => {
        const andParts = orGroup.split('&&'); // Розбиваємо за І
        return andParts.every(part => evalSingleCondition(part)); // Повертаємо чи всі AND секції виконуються
      });
    } catch (err) {
      logToClient(`⚠️ Помилка парсингу умови: "${expr}" → ${err}`, 'error'); // Логуємо помилку обчислення
      return false; // Повертаємо хибний результат при помилці
    }
  };

  // Якщо сигнал прийшов на порт запису значення (val_0, val_1 тощо)
  if (targetHandle && targetHandle.startsWith('val_')) {
    const idx = parseInt(targetHandle.split('_')[1], 10); // Витягуємо індекс умов
    const newValue = context?.num !== undefined && !isNaN(context.num) ? context.num : (context?.value || 0); // Отримуємо нове значення з контексту
    
    if (conds[idx] && conds[idx].rules && conds[idx].rules.length > 0) {
      conds[idx].rules[0].value = String(newValue); // Записуємо нове значення в перше правило цієї умови
      
      // Перебудовуємо expression (так само як на фронтенді)
      const rules = conds[idx].rules; // Беремо список правил умови
      const logicOp = conds[idx].logicOp || '&&'; // Отримуємо логічний оператор
      conds[idx].expression = rules // Формуємо вираз
        .filter((r: any) => r.varName) // Залишаємо правила з іменами змінних
        .map((r: any) => `${r.varName} ${r.op} ${r.value}`) // Складаємо частину виразу
        .join(` ${logicOp} `); // Об'єднуємо через AND/OR

      currentNode.data.conditions = conds; // Оновлюємо дані в ноді
      
      // Оновлюємо UI фронтенду
      if (ws) {
        ws.send(JSON.stringify({ 
          type: 'NODE_DATA_UPDATE', 
          nodeId: currentNode.id, 
          data: { conditions: conds } 
        }));
      }
      
      logToClient(`📥 Записано значення ${newValue} у рядок умов #${idx + 1}`, 'debug'); // Логуємо отримання значення

      // Якщо увімкнено авто-запуск для цієї умови
      if (conds[idx].triggerOnInput) {
        logToClient(`⚡ Авто-запуск диспетчера подій (логічного хабу)...`, 'info'); // Логуємо автоматичний старт
        let matchedIdx = -1; // Індекс умови, яка виконується
        for (let i = 0; i < conds.length; i++) {
          try {
            const expr = conds[i].expression; // Отримуємо вираз умови
            if (!expr || !expr.trim()) continue; // Пропускаємо порожні
            if (safeEvalExpression(expr)) { matchedIdx = i; break; } // Шукаємо першу робочу умову
          } catch {}
        }
        const nextHandle = matchedIdx >= 0 ? `out_${matchedIdx}` : 'default'; // Визначаємо наступний порт
        logToClient(`⚙️ ЛОГІКА: Авто-вихід -> ${nextHandle}`, 'success'); // Логуємо авто-вихід
        return { 
          nextHandle, // Повертаємо порт виходу
          data: context // Передаємо контекст далі
        };
      }
    }
    // Перериваємо поширення сигналу далі (це технічний вхід лише для оновлення значення умови)
    return { skipNext: true };
  }

  // Звичайне виконання логіки
  const nodeResults: Record<string, any> = {};
  let idx = -1;
  for (let i = 0; i < conds.length; i++) {
    try {
      const expr = conds[i].expression;
      if (!expr || !expr.trim()) continue; // Пропускаємо порожні умови
      // Використовуємо безпечний парсер замість eval
      if (safeEvalExpression(expr)) { idx = i; break; }
    } catch {}
  }
  nodeResults.nextHandle = idx >= 0 ? `out_${idx}` : 'default';
  logToClient(`⚙️ ЛОГІКА: Вихід -> ${nodeResults.nextHandle}`, 'success');
  nodeResults.data = context;
  return nodeResults;
};

