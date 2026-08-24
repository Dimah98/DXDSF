import { NodeHandlerParams } from './types';
// Обробник ноди Змінні
// Зчитує значення з контексту за шляхом (path) і зберігає їх як глобальні змінні
export const variableNodeHandler = async ({ 
  currentNode, context, globalVariables, broadcastVariables, logToClient 
}: NodeHandlerParams) => {
  const nodeData = currentNode.data as Record<string, unknown>;
  const vars = Array.isArray(nodeData.variables) ? nodeData.variables : [];
  
  // Безпечне перетворення будь-якого значення на число або рядок
  const parseHumanValue = (val: unknown): unknown => {
    if (val === undefined || val === null) return undefined;
    if (typeof val === 'number') return val;
    if (typeof val === 'object') return val; // Залишаємо об'єкт як є, нехай path вирішує
    // Очищаємо числові рядки (1 004,17 -> 1004.17)
    const cleaned = String(val).replace(/\s/g, '').replace(',', '.');
    const asNum = parseFloat(cleaned);
    return isNaN(asNum) ? val : asNum; // Якщо не число — повертаємо як рядок
  };

  vars.forEach((v: Record<string, unknown>) => {
    if (!v.name) return; // Пропускаємо рядки без назви
    
    let newValue: unknown = undefined;
    
    if (v.path && typeof v.path === 'string' && v.path.trim()) {
      // Нормалізуємо шлях: замінюємо [0] на .0. для зручного розбиття
      const normalizedPath = v.path.replace(/\[(\w+)\]/g, '.$1').replace(/^\./, '');
      const keys = normalizedPath.split('.');
      
      // Шукаємо спочатку в raw/value (для API), потім в самому context
      const searchBases = [context?.raw, context?.value, context].filter(base => base !== null && typeof base === 'object');
      
      for (const base of searchBases) {
        newValue = keys.reduce((obj: unknown, key: string) => (obj as Record<string, unknown>)?.[key], base);
        if (newValue !== undefined) break;
      }
    }
    
    if (v.path && typeof v.path === 'string' && v.path.trim()) {
      if (newValue !== undefined) {
        // Значення знайшли через шлях — записуємо
        globalVariables[String(v.name)] = parseHumanValue(newValue);
        logToClient(`📦 [${v.name}] = ${globalVariables[String(v.name)]} (з шляху: ${v.path})`, 'debug');
      } else {
        // Шлях заданий, але в контексті нічого не знайдено
        if (v.resetIfMissing !== false) {
          // Скидаємо значення (до дефолтного або 0), бо стоїть галочка
          globalVariables[String(v.name)] = parseHumanValue(v.value);
          if (globalVariables[String(v.name)] === undefined || Number.isNaN(globalVariables[String(v.name)] as number) || globalVariables[String(v.name)] === '') {
             globalVariables[String(v.name)] = 0;
          }
          logToClient(`📦 [${v.name}] = ${globalVariables[String(v.name)]} (не знайдено за шляхом, скинуто)`, 'debug');
        } else {
          // Галочка знята — зберігаємо старе значення без змін
          logToClient(`📦 [${v.name}] збережено без змін (не знайдено за шляхом)`, 'debug');
        }
      }
    } else {
      // Шляху немає, маємо тільки v.value
      if (v.value !== undefined && v.value !== '') {
         // Перезаписуємо статичним значенням щоразу
         globalVariables[String(v.name)] = parseHumanValue(v.value);
         logToClient(`📦 [${v.name}] = ${globalVariables[String(v.name)]} (статичне значення)`, 'debug');
      } else if (globalVariables[String(v.name)] === undefined) {
         // Якщо значення немає взагалі в базі і v.value порожнє - ставимо 0
         globalVariables[String(v.name)] = 0;
         logToClient(`📦 [${v.name}] = 0 (дефолт)`, 'debug');
      }
      // Якщо v.value порожнє, а змінна вже існує в глобальній базі — просто залишаємо як є
    }
  });
  
  // Зберігаємо в глобальну базу і надсилаємо всім клієнтам
  broadcastVariables();
  
  // Повертаємо undefined щоб нода передала сигнал далі (звичайний вихід)
  return { data: context };
};
