import { NodeHandlerParams } from './types';
import { notificationService } from '../index';

// Обробник ноди "Сповіщення" — відправляє текстове сповіщення від поточного проекту
export const notifyNodeHandler = async ({
  currentNode, context, logToClient, globalVariables, projectName
}: NodeHandlerParams) => {
  // Отримуємо шаблон повідомлення із налаштувань ноди (або використовуємо дефолтний)
  const messageTemplate = currentNode.data.message || '🔔 Сповіщення від проекту';

  // Розпочинаємо підстановку: замінюємо {time} на поточний час
  let message = messageTemplate
    .replace(/{time}/g, new Date().toLocaleTimeString('uk-UA')) // Підстановка поточного часу
    .replace(/{project}/g, projectName); // Підстановка назви проекту якщо зазначена

  // Підстановка глобальних змінних у форматі {varName} у текст повідомлення
  message = message.replace(/\{(\w+)\}/g, (match: string, varName: string) => {
    // Якщо змінна існує — підставляємо її значення, інакше залишаємо як є
    return globalVariables[varName] !== undefined
      ? String(globalVariables[varName])
      : match;
  });

  // Записуємо сповіщення через сервіс — воно зберігається негайно в файл
  notificationService.add(projectName, message);

  // Логуємо успішне відправлення в консоль сесії
  logToClient(`🔔 Сповіщення надіслано: ${message}`, 'success');

  // Повертаємо контекст без змін для продовження виконання сценарію
  return { data: context };
};
