import { NodeHandlerParams } from './types';
// Обробник ноди-шлюзу: пропускає перші N сигналів, потім блокує
// Зберігає стан лічильника у nodeRuntimeState Map (не мутує currentNode.data)
export const gateNodeHandler = async ({
  currentNode,
  context,
  ws,
  logToClient,
  targetHandle,
  nodeRuntimeState,
}: NodeHandlerParams) => {
  const nodeResults: Record<string, any> = {};

  // Отримуємо або ініціалізуємо стан для цього шлюзу
  if (!nodeRuntimeState.has(currentNode.id)) {
    nodeRuntimeState.set(currentNode.id, { currentCount: 0 });
  }
  const state = nodeRuntimeState.get(currentNode.id)!;

  // Якщо сигнал прийшов на порт встановлення ліміту
  if (targetHandle === 'setLimit') {
    const newLimit = parseInt(String(context.count ?? context.value ?? context.num ?? 0), 10);
    // Оновлюємо ліміт і скидаємо лічильник
    nodeRuntimeState.set(currentNode.id, { currentCount: 0, limit: newLimit });
    ws.send(JSON.stringify({
      type: 'NODE_DATA_UPDATE',
      nodeId: currentNode.id,
      data: { limit: newLimit, currentCount: 0 },
    }));
    logToClient(`⚙️ Шлюз: Встановлено новий ліміт = ${newLimit} (лічильник скинуто)`, 'info');
    return { skipNext: true }; // Не продовжуємо виконання, просто оновили дані
  }

  // Збільшуємо лічильник при кожному вході
  state.currentCount = (state.currentCount || 0) + 1;
  const current = state.currentCount;
  const limit = state.limit ?? currentNode.data.limit ?? 1;

  // Оновлюємо дані на фронтенді (лише для відображення)
  ws.send(JSON.stringify({
    type: 'NODE_DATA_UPDATE',
    nodeId: currentNode.id,
    data: { currentCount: current },
  }));

  if (current <= limit) {
    nodeResults.nextHandle = 'pass';
    logToClient(`🔢 Лічильник: ${current}/${limit} (Прохід дозволено)`, 'success');
  } else {
    nodeResults.nextHandle = 'limit';
    logToClient(`🛑 Лічильник: ${current}/${limit} (Ліміт вичерпано)`, 'error');
  }

  nodeResults.data = context;
  return nodeResults;
};
