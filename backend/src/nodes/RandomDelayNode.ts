// Обробник ноди випадкової затримки — антидетект пауза між кроками
import { NodeHandlerParams } from './types';

export const randomDelayNodeHandler = async ({
  currentNode,
  ws,
  smartSleep,
  logToClient,
  context,
}: NodeHandlerParams): Promise<{ data: any }> => {
  // Читаємо мінімальне і максимальне значення затримки з налаштувань ноди
  const minMs: number = currentNode.data.minDelay ?? 500;
  const maxMs: number = currentNode.data.maxDelay ?? 2000;

  // Генеруємо випадкову затримку у вказаному діапазоні
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;

  logToClient(`⏳ Рандомна пауза: ${ms}ms (між ${minMs}–${maxMs})`, 'debug');

  // Надсилаємо поточну затримку на фронтенд для відображення
  ws.send(JSON.stringify({
    type: 'NODE_DATA_UPDATE',
    nodeId: currentNode.id,
    data: { lastDelay: `${ms}ms` },
  }));

  await smartSleep(ms, ws);
  return { data: context };
};
