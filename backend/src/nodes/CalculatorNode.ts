import { NodeHandlerParams } from './types';
// Обробник ноди Калькулятор
export const calculatorNodeHandler = async ({
  currentNode,
  globalVariables,
  broadcastVariables,
  logToClient,
  targetHandle,
  context // Значення, яке прийшло з попередньої ноди
}: NodeHandlerParams) => {
  const { examples = [] } = currentNode.data as Record<string, unknown>;

  // Функція для безпечного отримання числа з рядка (розуміє коми та пробіли)
  const parseHumanNumber = (val: unknown): number => {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    // Якщо прийшов об'єкт (наприклад від Сканера) — пробуємо витягти числове поле
    if (typeof val === 'object' && val !== null) {
      const candidate = (val as Record<string, unknown>).value ?? (val as Record<string, unknown>).text ?? (val as Record<string, unknown>).number ?? 0;
      return parseHumanNumber(candidate);
    }
    // Очищаємо рядок від пробілів і міняємо кому на крапку
    const cleaned = String(val).replace(/\s/g, '').replace(',', '.');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  };

  // 1. ЗАПИС ЗНАЧЕННЯ (val_)
  if (targetHandle?.startsWith('val_')) {
    const parts = targetHandle.split('_');
    const exIdx = parseInt(parts[1]); // Індекс блоку розрахунку
    const rowIdx = parseInt(parts[2]); // Індекс рядка всередині блоку

    const examplesArray = Array.isArray(examples) ? examples : [];
    const exampleBlock = examplesArray[exIdx] as Record<string, unknown> | undefined;
    if (exampleBlock && exampleBlock.rows && Array.isArray(exampleBlock.rows) && exampleBlock.rows[rowIdx]) {
      // Витягуємо чисте значення з контексту (щоб не було [object Object])
      let valueToStore = '0';
      if (typeof context === 'object' && context !== null) {
        // Якщо це результат сканера — беремо поле value або text
        valueToStore = String(context.value ?? context.text ?? '0');
      } else {
        valueToStore = String(context ?? '0');
      }

      exampleBlock.rows[rowIdx].value = valueToStore;
      logToClient(`📥 Записано в полі: ${valueToStore}`, 'info');

      // Перевіряємо прапорець авто-запуску для цього блоку
      if (exampleBlock && exampleBlock.triggerOnInput) {
        // Якщо увімкнено — виконуємо розрахунок одразу після запису значення
        logToClient(`⚡ Авто-запуск розрахунку #${exIdx + 1}...`, 'info');

        let result = 0; // Початковий результат
        const getValue = (valStr: string) => {
          const trimmed = valStr.trim(); // Прибираємо пробіли
          // Якщо це назва змінної — беремо її з глобальних
          if (globalVariables.hasOwnProperty(trimmed)) {
            return parseHumanNumber(globalVariables[trimmed]);
          }
          // Інакше парсимо як звичайне число
          return parseHumanNumber(trimmed);
        };

        // Виконуємо послідовне обчислення рядків блоку
        for (let i = 0; i < exampleBlock.rows.length; i++) {
          const row = exampleBlock.rows[i]; // Поточний рядок
          const val = getValue(row.value); // Значення рядка

          if (i === 0) {
            result = val; // Перший рядок — початкове значення
            logToClient(`  └─ Початкове значення: ${val} (${row.value})`, 'info');
          } else {
            const prevOp = exampleBlock.rows[i - 1].op; // Оператор попереднього рядка
            const oldResult = result; // Зберігаємо попередній результат для логу
            switch (prevOp) {
              case '+': result += val; break; // Додавання
              case '-': result -= val; break; // Віднімання
              case '*': result *= val; break; // Множення
              case '/': result = val !== 0 ? result / val : 0; break; // Ділення (захист від нуля)
            }
            logToClient(`  └─ Операція: ${oldResult} ${prevOp} ${val} (${row.value}) = ${result}`, 'info');
          }
        }

        logToClient(`✅ Авто-результат: ${result}`, 'success');

        // Зберігаємо результат у глобальну змінну якщо вона вказана
        if (exampleBlock && exampleBlock.resultVar) {
          globalVariables[String(exampleBlock.resultVar).trim()] = result; // Записуємо в змінну
          broadcastVariables(); // Оновлюємо UI зі змінними
        }

        // Передаємо результат далі через вихідний порт цього блоку
        return {
          updateNodeData: { examples: examplesArray }, // Оновлюємо дані ноди
          nextHandle: `out_${exIdx}`,   // Активуємо відповідний вихідний порт
          data: { value: result, num: result } // Передаємо числове значення наступній ноді
        };
      }

      // Якщо авто-запуск вимкнено — просто зберігаємо значення і зупиняємо виконання
      return {
        updateNodeData: { examples: examplesArray }, // Оновлюємо дані ноди
        nextHandle: null // ЗУПИНЯЄМО виконання (не активуємо ноду)
      };
    }
  }

  // 2. ЗАПУСК РОЗРАХУНКУ (run_)
  const examplesArray = Array.isArray(examples) ? examples : [];
  if (targetHandle?.startsWith('run_')) {
    const exIdx = parseInt(targetHandle.split('_')[1]);
    const example = examplesArray[exIdx];

    if (!example) return { nextHandle: null };

    logToClient(`🧮 Виконання розрахунку #${exIdx + 1}...`, 'info');

    let result = 0;
    const getValue = (valStr: string) => {
      const trimmed = valStr.trim();
      // Якщо це назва змінної — беремо її з глобальних
      if (globalVariables.hasOwnProperty(trimmed)) {
        return parseHumanNumber(globalVariables[trimmed]);
      }
      // Інакше парсимо як звичайне число
      return parseHumanNumber(trimmed);
    };

    for (let i = 0; i < example.rows.length; i++) {
      const row = example.rows[i];
      const val = getValue(row.value);
      
      if (i === 0) {
        result = val;
        logToClient(`  └─ Початкове значення: ${val} (${row.value})`, 'info');
      } else {
        const prevOp = example.rows[i - 1].op;
        const oldResult = result;
        switch (prevOp) {
          case '+': result += val; break;
          case '-': result -= val; break;
          case '*': result *= val; break;
          case '/': result = val !== 0 ? result / val : 0; break;
        }
        logToClient(`  └─ Операція: ${oldResult} ${prevOp} ${val} (${row.value}) = ${result}`, 'info');
      }
    }

    logToClient(`✅ Результат: ${result}`, 'success');

    if (example.resultVar) {
      globalVariables[example.resultVar.trim()] = result;
      broadcastVariables();
    }

    return { nextHandle: `out_${exIdx}`, data: { value: result, num: result } };
  }

  // 3. ЯКЩО СИГНАЛ ПРИЙШОВ НЕ НА СПЕЦІАЛЬНИЙ ПОРТ — НІЧОГО НЕ РОБИМО
  // Це відключає автозапуск ноди при старті або через загальний вхід
  return { nextHandle: null };
};
