import { NodeHandlerParams } from './types';
// Обробник ноди Чергувач
// По черзі або рандомно направляє сигнал у один з N виходів
// Зберігає поточний індекс між ітераціями через nodeRuntimeState (Map)

export const rotatorNodeHandler = async ({
  currentNode,      // Дані ноди (outputCount, mode)
  context,          // Контекст від попередньої ноди
  logToClient,      // Лог у консоль інтерфейсу
  nodeRuntimeState, // Map<string, Record<string,unknown>> — персистентний стан між запусками
}: NodeHandlerParams) => {
  // Кількість виходів і режим з налаштувань ноди
  const nodeData = currentNode.data as Record<string, unknown>;
  const outputCount: number = Math.max(2, Math.min(8, (nodeData.outputCount as number) || 2));
  const mode: string = (nodeData.mode as string) || 'sequence';
  const nodeId: string = currentNode.id;

  let outIndex: number;

  if (mode === 'random') {
    // Рандомний режим — просто беремо випадковий вихід
    outIndex = Math.floor(Math.random() * outputCount);
    logToClient(`🎲 Рандом → Вихід ${outIndex + 1} з ${outputCount}`, 'info');
  } else {
    // Послідовний режим — читаємо збережений індекс з Map та просуваємо вперед
    // Отримуємо або створюємо запис стану для цієї ноди
    if (!nodeRuntimeState.has(nodeId)) {
      nodeRuntimeState.set(nodeId, { index: 0 });
    }
    const state = nodeRuntimeState.get(nodeId) as Record<string, unknown> | undefined;
    outIndex = ((state?.index as number) || 0) % outputCount;
    // Зберігаємо наступний індекс для наступного виклику
    if (state) state.index = ((outIndex + 1) % outputCount);
    logToClient(`🔄 По черзі → Вихід ${outIndex + 1} / ${outputCount}`, 'info');
  }

  const nextHandle = `out_${outIndex}`;

  return {
    nextHandle,
    data: context,
  };
};
