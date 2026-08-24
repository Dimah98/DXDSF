// Обробник ноди випадкової затримки — антидетект пауза між кроками
import { NodeHandlerParams } from './types';
import { NodeData } from '@sf/shared-types';

export const randomDelayNodeHandler = async ({
  currentNode,
  ws,
  smartSleep,
  logToClient,
  context,
}: NodeHandlerParams): Promise<{ data: NodeData }> => {
  // Читаємо мінімальне і максимальне значення затримки з налаштувань ноди
  const nodeData = currentNode.data as Record<string, unknown>;
  const minMs: number = (nodeData.minDelay as number) ?? 500;
  const maxMs: number = (nodeData.maxDelay as number) ?? 2000;

  // Генеруємо випадкову затримку у вказаному діапазоні
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;

  logToClient(`⏳ Рандомна пауза: ${ms}ms (між ${minMs}–${maxMs})`, 'debug');

  // Надсилаємо поточну затримку на фронтенд для відображення
  try {
    ws.send(JSON.stringify({
      type: 'NODE_DATA_UPDATE',
      nodeId: currentNode.id,
      data: { lastDelay: `${ms}ms` },
    }));
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logToClient(`⚠️ Помилка відправки WebSocket повідомлення: ${errorMessage}`, 'error');
  }

  await smartSleep(ms, ws);
  return { data: context };
};
