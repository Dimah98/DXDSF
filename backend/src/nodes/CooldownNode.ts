import { NodeHandlerParams } from './types';

export const cooldownNodeHandler = async ({ currentNode, context, globalVariables, logToClient }: NodeHandlerParams) => {
  const duration = currentNode.data.duration !== undefined ? Number(currentNode.data.duration) : 20;
  const unit = currentNode.data.unit || 'minutes';

  let durationMs = duration;
  if (unit === 'seconds') durationMs *= 1000;
  else if (unit === 'minutes') durationMs *= 60 * 1000;
  else if (unit === 'hours') durationMs *= 60 * 60 * 1000;

  const timerKey = `_cooldown_${currentNode.id}`;
  const lastTriggered = globalVariables[timerKey] || 0;
  const now = Date.now();

  if (now - lastTriggered >= durationMs) {
    // Час вийшов, пропускаємо сигнал
    globalVariables[timerKey] = now;
    logToClient(`⏳ Таймаут пройдено. Наступний сигнал буде заблоковано на ${duration} ${unit}.`, 'success');
    return { nextHandle: ['success'], data: context };
  } else {
    // Ще діє таймаут
    const remainingMs = durationMs - (now - lastTriggered);
    const remainingMin = Math.ceil(remainingMs / 60000);
    logToClient(`⏳ Сигнал заблоковано. Залишилось ${remainingMin} хв.`, 'error');
    return { nextHandle: ['blocked'], data: context };
  }
};
