import { NodeHandlerParams } from './types';
export const coordOffsetNodeHandler = async ({ currentNode, context, logToClient }: NodeHandlerParams) => {
  const nodeData = currentNode.data as Record<string, unknown>;
  const { offsetX = 0, offsetY = 0 } = nodeData;
  const coords = context.coords;

  if (!coords) {
    logToClient('⚠️ Зсув координат: вхідні координати порожні', 'error');
    return { nextHandle: 'fail', data: context };
  }

  const newCoords = {
    x: Math.round(coords.x + Number(offsetX)),
    y: Math.round(coords.y + Number(offsetY))
  };

  logToClient(`📐 Зсув: (${coords.x}, ${coords.y}) -> (${newCoords.x}, ${newCoords.y})`, 'debug');

  return { 
    nextHandle: 'pass',
    data: { ...context, coords: newCoords, value: `X:${newCoords.x}, Y:${newCoords.y}` }
  };
};
