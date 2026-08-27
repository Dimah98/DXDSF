import { NodeHandlerParams } from './types';
import { getDayStart3AM, parseTimestampMs } from '../configs/ConfigEvaluator';

export const compareNodeHandler = async ({ currentNode, context, globalVariables, ws, targetHandle, logToClient }: NodeHandlerParams) => {
  const nodeResults: Record<string, unknown> = {};
  const nodeData = currentNode.data as Record<string, unknown>;
  const mode = (nodeData.compareMode as string) || 'number';

  if (targetHandle === 'valA') {
    nodeData.valA = mode === 'number' ? (context.num ?? context.value ?? 0) : (context.text ?? context.value ?? "");
    if (ws && typeof ws.send === 'function' && (ws.readyState === undefined || ws.readyState === 1)) {
      try { ws.send(JSON.stringify({ type: 'NODE_DATA_UPDATE', nodeId: currentNode.id, data: { valA: nodeData.valA } })); } catch {}
    }
    nodeResults.skipNext = true;
  } else if (targetHandle === 'valB') {
    nodeData.valB = mode === 'number' ? (context.num ?? context.value ?? 0) : (context.text ?? context.value ?? "");
    if (ws && typeof ws.send === 'function' && (ws.readyState === undefined || ws.readyState === 1)) {
      try { ws.send(JSON.stringify({ type: 'NODE_DATA_UPDATE', nodeId: currentNode.id, data: { valB: nodeData.valB } })); } catch {}
    }
    nodeResults.skipNext = true;
  } else {
    let met = false;
    const op = (nodeData.operator as string) || (mode === 'number' ? '>' : 'equals');

    if (mode === 'number') {
      const rawA = nodeData.valA !== undefined ? nodeData.valA : 0;
      const a = Number(rawA || 0);
      const b = Number(nodeData.valB || 0);
      if (op === '>') met = a > b;
      else if (op === '<') met = a < b;
      else if (op === '==') met = a == b;
      else if (op === '>=') met = a >= b;
      else if (op === '<=') met = a <= b;
      else if (op === '!=') met = a != b;
      else if (op === 'time_is_today') {
        const ts = parseTimestampMs(rawA);
        met = ts > 0 && getDayStart3AM(ts) === getDayStart3AM(Date.now());
        logToClient(`📅 ЧАС: ${ts > 0 ? new Date(ts).toLocaleString('uk-UA') : rawA} є сьогодні (з 03:00) -> ${met}`, met ? 'success' : 'error');
      }
      else if (op === 'time_not_today') {
        const ts = parseTimestampMs(rawA);
        met = ts === 0 || getDayStart3AM(ts) !== getDayStart3AM(Date.now());
        logToClient(`📅 ЧАС: ${ts > 0 ? new Date(ts).toLocaleString('uk-UA') : rawA} не сьогодні (з 03:00) -> ${met}`, met ? 'success' : 'error');
      }
      if (op !== 'time_is_today' && op !== 'time_not_today') {
        logToClient(`⚙️ ЧИСЛА: ${a} ${op} ${b} -> ${met}`, met ? 'success' : 'error');
      }
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
