import { NodeHandlerParams } from './types';
export const nestedCheckNodeHandler = async ({ currentNode, activePage, logToClient, context }: NodeHandlerParams) => {
  const { parentSelector, childSelector } = currentNode.data;
  logToClient(`⚙️ ПЕРЕВІРКА: ${childSelector} всередині ${parentSelector}`, 'debug');
  const parent = await activePage.$(parentSelector).catch(() => null);
  const child = parent ? await parent.$(childSelector).catch(() => null) : null;
  return { nextHandle: child ? 'found' : 'not_found', data: context };
};
