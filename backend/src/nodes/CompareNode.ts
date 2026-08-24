import { NodeHandlerParams } from './types';
export const compareNodeHandler = async ({ currentNode, context, globalVariables, ws, targetHandle, logToClient }: NodeHandlerParams) => {
  const nodeResults: Record<string, unknown> = {};
  const nodeData = currentNode.data as Record<string, unknown>;
  const mode = (nodeData.compareMode as string) || 'number';

  if (targetHandle === 'valA') {
    nodeData.valA = mode === 'number' ? (context.num ?? context.value ?? 0) : (context.text ?? context.value ?? "");
    ws.send(JSON.stringify({ type: 'NODE_DATA_UPDATE', nodeId: currentNode.id, data: { valA: nodeData.valA } }));
    nodeResults.skipNext = true;
  } else if (targetHandle === 'valB') {
    nodeData.valB = mode === 'number' ? (context.num ?? context.value ?? 0) : (context.text ?? context.value ?? "");
    ws.send(JSON.stringify({ type: 'NODE_DATA_UPDATE', nodeId: currentNode.id, data: { valB: nodeData.valB } }));
    nodeResults.skipNext = true;
  } else {
    let met = false;
    const op = (nodeData.operator as string) || (mode === 'number' ? '>' : 'equals');

    if (mode === 'number') {
      const a = Number(nodeData.valA || 0);
      const b = Number(nodeData.valB || 0);
      if (op === '>') met = a > b;
      else if (op === '<') met = a < b;
      else if (op === '==') met = a == b;
      else if (op === '>=') met = a >= b;
      else if (op === '<=') met = a <= b;
      else if (op === '!=') met = a != b;
      logToClient(`⚙️ ЧИСЛА: ${a} ${op} ${b} -> ${met}`, met ? 'success' : 'error');
    } else {
      let valA = String(nodeData.valA || "");
      // Підтримка глобальних змінних
      if (globalVariables[valA] !== undefined) valA = String(globalVariables[valA]);
      const valB = String(nodeData.valB || "");

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
