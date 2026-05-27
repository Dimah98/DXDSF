import { NodeHandlerParams } from './types';
export const compareNodeHandler = async ({ currentNode, context, globalVariables, ws, targetHandle, logToClient }: NodeHandlerParams) => {
  const nodeResults: Record<string, any> = {};
  const mode = currentNode.data.compareMode || 'number';

  if (targetHandle === 'valA') {
    currentNode.data.valA = mode === 'number' ? (context.num ?? context.value ?? 0) : (context.text ?? context.value ?? "");
    ws.send(JSON.stringify({ type: 'NODE_DATA_UPDATE', nodeId: currentNode.id, data: { valA: currentNode.data.valA } }));
    nodeResults.skipNext = true;
  } else if (targetHandle === 'valB') {
    currentNode.data.valB = mode === 'number' ? (context.num ?? context.value ?? 0) : (context.text ?? context.value ?? "");
    ws.send(JSON.stringify({ type: 'NODE_DATA_UPDATE', nodeId: currentNode.id, data: { valB: currentNode.data.valB } }));
    nodeResults.skipNext = true;
  } else {
    let met = false;
    const op = currentNode.data.operator || (mode === 'number' ? '>' : 'equals');

    if (mode === 'number') {
      const a = Number(currentNode.data.valA || 0);
      const b = Number(currentNode.data.valB || 0);
      if (op === '>') met = a > b;
      else if (op === '<') met = a < b;
      else if (op === '==') met = a == b;
      else if (op === '>=') met = a >= b;
      else if (op === '<=') met = a <= b;
      else if (op === '!=') met = a != b;
      logToClient(`⚙️ ЧИСЛА: ${a} ${op} ${b} -> ${met}`, met ? 'success' : 'error');
    } else {
      let valA = String(currentNode.data.valA || "");
      // Підтримка глобальних змінних
      if (globalVariables[valA] !== undefined) valA = String(globalVariables[valA]);
      const valB = String(currentNode.data.valB || "");

      if (op === 'equals') met = valA === valB;
      else if (op === 'not_equals') met = valA !== valB;
      else if (op === 'contains') met = valA.includes(valB);
      else if (op === 'not_contains') met = !valA.includes(valB);
      else if (op === 'starts_with') met = valA.startsWith(valB);
      else if (op === 'ends_with') met = valA.endsWith(valB);
      else if (op === 'matches') { try { const regex = new RegExp(valB, 'i'); met = regex.test(valA); } catch { met = false; } }
      logToClient(`⚙️ ТЕКСТ: "${valA}" ${op} "${valB}" -> ${met}`, met ? 'success' : 'error');
    }

    nodeResults.nextHandle = met ? 'true' : 'false';
  }
  nodeResults.data = context;
  return nodeResults;
};
