import fs from 'fs';
import path from 'path';
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
  const { url, browser_action } = currentNode.data as Record<string, unknown>;
  
  try {
    // Допоміжна функція: перезавантажити сторінку через CDP напряму
    // (єдиний надійний спосіб для ITBrowser / Chromium — ігнорує SPA-обробники та WS-з'єднання)
    const reloadViaCDP = async (ignoreCache: boolean = false) => {
       const session = getOrCreateSession(projectName);
       if (session.context) {
         const cdp = await session.context.newCDPSession(activePage);
         try {
           await cdp.send('Page.reload', { ignoreCache });
           // Чекаємо 3 секунди щоб сторінка встигла почати перезавантаження
           await new Promise(r => setTimeout(r, 3000));
         } finally {
           await cdp.detach().catch(() => {});
         }
       } else {
         // Фолбек: якщо context недоступний — через goto
         const currentUrl = activePage.url();
         await activePage.goto(currentUrl, { waitUntil: 'domcontentloaded' }).catch(() => {});
         await new Promise(r => setTimeout(r, 1000));
       }
    };

    // 1. Оновлення сторінки (через CDP Page.reload)
    if (browser_action === 'refresh') {
       logToClient(`🔄 Оновлення сторінки (CDP)...`, 'info');
       await reloadViaCDP(false);
    }
    // 2. Натискання F5 (через CDP Page.reload з ignoreCache = true)
    else if (browser_action === 'f5' || browser_action === 'press_f5') {
       logToClient(`⌨️ F5 — оновлення з очищенням кешу (CDP)...`, 'info');
       await reloadViaCDP(true);
    }
    // 3. Повернення назад
    else if (browser_action === 'back') {
       logToClient(`⬅️ Перехід назад у історії...`, 'debug');
       await activePage.goBack();
    }
    // 3. Очікування завантаження
    else if (browser_action === 'wait_load') {
       logToClient(`⏳ Очікування завантаження сторінки...`, 'debug');
       await activePage.waitForLoadState('domcontentloaded');
    }
    // 4. Закриття браузера
    else if (browser_action === 'close') {
       logToClient(`🛑 Закриття браузера...`, 'debug');
       const session = getOrCreateSession(projectName);
       await closeSessionBrowser(session);
    }
    // 5. Віддалення камери
    else if (browser_action === 'zoom_out') {
       logToClient(`🔍 Віддалення камери (Ctrl + Колесо вниз)...`, 'debug');
       await activePage.keyboard.down('Control');
       await activePage.mouse.wheel(0, 1000);
       await new Promise(r => setTimeout(r, 200));
       await activePage.keyboard.up('Control');
    }
    // 6. Рандом ПТ
    else if (browser_action === 'random_pt') {
       logToClient(`🎲 Пошук випадкового Bumpkin ID з файлів збережень...`, 'debug');
       const projectsDir = path.join(__dirname, '../../projects');
       const candidates: { projectName: string; bumpkinId: string | number }[] = [];

       try {
         if (fs.existsSync(projectsDir)) {
           const files = fs.readdirSync(projectsDir).filter(f => f.endsWith('_save.json'));
           for (const file of files) {
             try {
               const filePath = path.join(projectsDir, file);
               const content = fs.readFileSync(filePath, 'utf-8');
               const saveData = JSON.parse(content);

               const bumpkinId = saveData?.visitedFarmState?.bumpkin?.id ??
                                 saveData?.visitorFarmState?.bumpkin?.id ??
                                 saveData?.bumpkin?.id ??
                                 saveData?.farmState?.bumpkin?.id;

               if (bumpkinId !== undefined && bumpkinId !== null && String(bumpkinId).trim() !== '') {
                 const name = file.replace('_save.json', '');
                 candidates.push({ projectName: name, bumpkinId });
               }
             } catch {
               // пропускаємо пошкоджені файли збережень
             }
           }
         }
       } catch (err: any) {
         logger.error(`Error reading projects directory for random_pt`, err instanceof Error ? err : new Error(String(err)));
       }

       if (candidates.length === 0) {
         logToClient(`⚠️ Рандом ПТ: не знайдено жодного bumpkin.id у збережених проектах`, 'error');
         return { data: context, nextHandle: ['error'] };
       }

       const chosen = candidates[Math.floor(Math.random() * candidates.length)];
       const targetUrl = `https://sunflower-land.com/play/#/visit/${chosen.bumpkinId}`;

       logToClient(`🎲 Рандом ПТ: Обрано проект "${chosen.projectName}" (Bumpkin ID: ${chosen.bumpkinId}). Перехід на: ${targetUrl}`, 'info');
       await activePage.goto(targetUrl, { waitUntil: 'load' });
    }
    // 7. Якщо задано URL і не вибрано жодної іншої спеціальної дії (або дія — перехід)
    else if (url && typeof url === 'string' && url.startsWith('http')) {
       const urlValidation = inputValidator.validateURL(url);
       if (!urlValidation.isValid) {
         logger.warn(`Browser node ${currentNode.id}: URL validation failed`, { url, error: urlValidation.error });
         logToClient(`❌ Невалідний URL: ${urlValidation.error}`, 'error');
         return { data: context, nextHandle: ['error'] };
       }
       
       logToClient(`🌐 Перехід на: ${url}`, 'debug');
       await activePage.goto(url, { waitUntil: 'load' });
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
