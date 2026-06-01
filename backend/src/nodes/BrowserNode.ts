// Імпортуємо вбудований клас логера для діагностики роботи
import { Logger } from '../logger';
// Імпортуємо інтерфейс параметрів обробника ноди
import { NodeHandlerParams } from './types';
// Імпортуємо валідатор вхідних даних для перевірки URL-адрес
import { inputValidator } from '../validation/InputValidator';
// Імпортуємо функції для отримання сесії та закриття браузера
import { getOrCreateSession, closeSessionBrowser } from '../browserManager';

// Створюємо екземпляр логера спеціально для ноди браузера
const logger = new Logger('BrowserNode');

// Експортуємо асинхронну функцію-обробник для ноди керування браузером
export const browserNodeHandler = async ({ currentNode, activePage, logToClient, context, projectName }: NodeHandlerParams) => {
  // Деструктуруємо URL та конкретну дію браузера з даних ноди сценарію
  const { url, browser_action } = currentNode.data;
  
  // Додаємо блок відловлювання помилок для безпечного виконання асинхронних операцій
  try {
    // Перевіряємо, чи вказано URL і чи починається він з префіксу http
    if (url && url.startsWith('http')) {
       // Валідуємо введений URL на коректність за допомогою спеціального валідатора
       const urlValidation = inputValidator.validateURL(url);
       // Якщо URL не пройшов валідацію, повертаємо помилку сценарію
       if (!urlValidation.isValid) {
         // Логуємо інформацію про неуспішну перевірку URL на сервері
         logger.warn(`Browser node ${currentNode.id}: URL validation failed`, { url, error: urlValidation.error });
         // Повідомляємо користувача в інтерфейсі про недійсний URL
         logToClient(`❌ Невалідний URL: ${urlValidation.error}`, 'error');
         // Направляємо сценарій по гілці обробки помилок
         return { data: context, nextHandle: ['error'] };
       }
       
       // Повідомляємо клієнта про спробу переходу за адресою
       logToClient(`🌐 Перехід на: ${url}`, 'debug');
       // Здійснюємо перехід на вказаний URL та очікуємо завантаження сторінки
       await activePage.goto(url, { waitUntil: 'load' });
    } else {
       // Якщо вказана дія оновлення поточної сторінки
       if (browser_action === 'refresh') {
          // Відправляємо повідомлення про перезавантаження сторінки клієнту
          logToClient(`🔄 Оновлення сторінки...`, 'debug');
          // Виконуємо стандартне оновлення сторінки в контексті Playwright
          await activePage.reload({ waitUntil: 'load' }).catch(async () => {
             // У разі збою використовуємо резервне оновлення через JavaScript у вкладці
             await activePage.evaluate(() => window.location.reload());
          });
       }
       // Якщо вибрана дія переходу назад в історії браузера
       else if (browser_action === 'back') {
          // Викликаємо вбудований метод Playwright для кроку назад
          await activePage.goBack();
       }
       // Якщо вибрана дія очікування завершення завантаження мережі
       else if (browser_action === 'wait_load') {
          // Очікуємо стан спокою мережі (networkidle) для стабілізації сторінки
          await activePage.waitForLoadState('networkidle');
       }
       // Якщо вибрана нова дія закриття браузера проекту
       else if (browser_action === 'close') {
          // Повідомляємо про початок закриття браузера
          logToClient(`🛑 Закриття браузера...`, 'debug');
          // Отримуємо або створюємо поточну сесію проекту за його назвою
          const session = getOrCreateSession(projectName);
          // Викликаємо функцію для коректного закриття браузера сесії
          await closeSessionBrowser(session);
       }
       // Якщо вибрана нова дія віддалення масштабу камери (Ctrl + Scroll Down)
       else if (browser_action === 'zoom_out') {
          // Повідомляємо про початок процесу віддалення камери
          logToClient(`🔍 Віддалення камери (Ctrl + Колесо вниз)...`, 'debug');
          // Емулюємо натискання та утримання клавіші Control на клавіатурі
          await activePage.keyboard.down('Control');
          // Прокручуємо колесо миші вертикально вниз на 1000 одиниць
          await activePage.mouse.wheel(0, 1000);
          // Даємо невелику затримку у 200 мілісекунд для обробки браузером
          await new Promise(r => setTimeout(r, 200));
          // Емулюємо відпускання клавіші Control після прокрутки
          await activePage.keyboard.up('Control');
       }
    }
  } catch (err: any) {
    // Фіксуємо виникнення винятку в логері сервера з детальним стеком помилки
    logger.error(`Browser action failed for node ${currentNode.id}`, err instanceof Error ? err : new Error(String(err)), { url, browser_action });
    // Відправляємо детальне повідомлення про помилку клієнту
    logToClient(`❌ Помилка браузера: ${err.message || String(err)}`, 'error');
    // Повертаємо об'єкт помилки для спрямування потоку по аварійній гілці
    return { data: context, nextHandle: ['error'] };
  }
  
  // У разі успіху повертаємо початковий контекст даних без додаткових виходів
  return { data: context };
};
