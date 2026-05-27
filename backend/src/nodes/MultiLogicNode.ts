import { NodeHandlerParams } from './types';
export const multiLogicNodeHandler = async ({ currentNode, globalVariables, logToClient, context, targetHandle, ws }: NodeHandlerParams) => {
  const conds = currentNode.data.conditions || [];

  // Якщо сигнал прийшов на порт запису значення (val_0, val_1 тощо)
  if (targetHandle && targetHandle.startsWith('val_')) {
    const idx = parseInt(targetHandle.split('_')[1], 10);
    const newValue = context?.num !== undefined && !isNaN(context.num) ? context.num : (context?.value || 0);
    
    if (conds[idx] && conds[idx].rules && conds[idx].rules.length > 0) {
      conds[idx].rules[0].value = String(newValue);
      
      // Перебудовуємо expression (так само як на фронтенді)
      const rules = conds[idx].rules;
      const logicOp = conds[idx].logicOp || '&&';
      conds[idx].expression = rules
        .filter((r: any) => r.varName)
        .map((r: any) => `${r.varName} ${r.op} ${r.value}`)
        .join(` ${logicOp} `);

      currentNode.data.conditions = conds;
      
      // Оновлюємо UI фронтенду
      if (ws) {
        ws.send(JSON.stringify({ 
          type: 'NODE_DATA_UPDATE', 
          nodeId: currentNode.id, 
          data: { conditions: conds } 
        }));
      }
      
      logToClient(`📥 Записано значення ${newValue} у рядок умов #${idx + 1}`, 'debug');
    }
    
    // Зупиняємо виконання (не передаємо сигнал далі)
    return { nextHandle: undefined, data: context };
  }

  // ─── Безпечний парсер умов (без eval) ──────────────────────────────────────
  // Підтримує: varName op value, наприклад: "gold > 100" або "energy <= 50"
  // Логічні оператори: && (AND), || (OR)
  const safeEvalExpression = (expr: string): boolean => {
    try {
      // Підставляємо значення змінних у вираз
      let substituted = expr;
      // Сортуємо ключі за довжиною (від довших до коротших) щоб уникнути часткових замін
      const sortedKeys = Object.keys(globalVariables).sort((a, b) => b.length - a.length);
      for (const key of sortedKeys) {
        // Замінюємо ім'я змінної на її числове/рядкове значення
        const val = globalVariables[key];
        const numVal = parseFloat(String(val).replace(/\s/g, '').replace(',', '.'));
        const replacement = isNaN(numVal) ? `"${String(val)}"` : String(numVal);
        // Замінюємо ім'я змінної з підтримкою кирилиці (стандартний \b не працює з українськими літерами)
        const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const boundaryRegex = new RegExp(`(^|[^a-zA-Z0-9_а-яА-ЯіІїЇєЄґҐ])${escapedKey}(?=[^a-zA-Z0-9_а-яА-ЯіІїЇєЄґҐ]|$)`, 'g');
        substituted = substituted.replace(boundaryRegex, `$1${replacement}`);
      }

      // Розбиваємо на AND/OR секції та обчислюємо без eval
      const evalSingleCondition = (part: string): boolean => {
        part = part.trim();
        // Підтримувані оператори порівняння (від довших до коротших — важливо!)
        const operators = ['>=', '<=', '!=', '==', '>', '<'];
        for (const op of operators) {
          const idx = part.indexOf(op);
          if (idx === -1) continue;
          const left  = part.slice(0, idx).trim();
          const right = part.slice(idx + op.length).trim();
          // Очищуємо лапки для рядкового порівняння
          const leftClean  = left.replace(/^"|"$/g, '');
          const rightClean = right.replace(/^"|"$/g, '');
          const leftNum  = parseFloat(leftClean);
          const rightNum = parseFloat(rightClean);
          const useNum = !isNaN(leftNum) && !isNaN(rightNum);

          logToClient(`🔍 Порівняння: [${leftClean}] ${op} [${rightClean}]`, 'debug');

          if (op === '>')  return useNum ? leftNum > rightNum  : leftClean > rightClean;
          if (op === '<')  return useNum ? leftNum < rightNum  : leftClean < rightClean;
          if (op === '>=') return useNum ? leftNum >= rightNum : leftClean >= rightClean;
          if (op === '<=') return useNum ? leftNum <= rightNum : leftClean <= rightClean;
          if (op === '==') return useNum ? leftNum === rightNum : leftClean === rightClean;
          if (op === '!=') return useNum ? leftNum !== rightNum : leftClean !== rightClean;
        }
        // Якщо оператора немає — перевіряємо truthy значення
        const num = parseFloat(part);
        return isNaN(num) ? part.length > 0 && part !== 'false' && part !== '""' : num !== 0;
      };

      // Обробляємо OR-групи (розбиваємо || першим, потім && всередині кожної групи)
      const orGroups = substituted.split('||');
      return orGroups.some(orGroup => {
        const andParts = orGroup.split('&&');
        return andParts.every(part => evalSingleCondition(part));
      });
    } catch (err) {
      logToClient(`⚠️ Помилка парсингу умови: "${expr}" → ${err}`, 'error');
      return false;
    }
  };
  // ──────────────────────────────────────────────────────────────────────────

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

