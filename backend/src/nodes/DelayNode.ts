import { NodeHandlerParams } from './types';
export const delayNodeHandler = async ({ currentNode, ws, smartSleep, logToClient, context }: NodeHandlerParams) => {
  const nodeData = currentNode.data as Record<string, unknown>;
  const ms = (nodeData.delay as number) || 1000;
  logToClient(`⏳ Пауза: ${ms}ms`, 'debug');
  await smartSleep(ms, ws);
  return { data: context };
};
