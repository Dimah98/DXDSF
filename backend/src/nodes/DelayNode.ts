import { NodeHandlerParams } from './types';
export const delayNodeHandler = async ({ currentNode, ws, smartSleep, logToClient, context }: NodeHandlerParams) => {
  const ms = currentNode.data.delay || 1000;
  logToClient(`⏳ Пауза: ${ms}ms`, 'debug');
  await smartSleep(ms, ws);
  return { data: context };
};
