// Обробник ноди "Скріншот" — робить знімок сторінки або окремого елемента
import { Logger } from '../logger';
import { NodeHandlerParams } from './types';
import { inputValidator } from '../validation/InputValidator';
import fs from 'fs';
import path from 'path';

// Створюємо логер для цього модуля
const logger = new Logger('ScreenshotNode');

export const screenshotNodeHandler = async ({
  currentNode,
  activePage,
  ws,
  projectName,
  context,
  logToClient
}: NodeHandlerParams) => {
  // Зчитуємо параметри ноди: режим, селектор, назву файлу
  const nodeData = currentNode.data as Record<string, unknown>;
  const mode = (nodeData.mode as string) || 'fullPage';
  const selector = (nodeData.selector as string) || '';
  const imageName = (nodeData.imageName as string) || '';

  try {
    // Валідація селектора якщо передано
    if (mode === 'selector' && selector) {
      const selectorValidation = inputValidator.validateSelector(selector);
      if (!selectorValidation.isValid) {
        logger.warn(`Screenshot node ${currentNode.id}: selector validation failed`, { selector, error: selectorValidation.error });
        logToClient(`❌ Скріншот: Невалідний селектор: ${selectorValidation.error}`, 'error');
        return { data: context, nextHandle: ['error'] };
      }
    }

    // Формуємо назву файлу — якщо не задана, генеруємо за timestamp
    const filename = imageName || `screenshot_${Date.now()}.png`;
    // Гарантуємо розширення .png у кінці назви файлу
    const finalFilename = filename.endsWith('.png') ? filename : `${filename}.png`;

    // Визначаємо директорію для збереження скріншотів проекту
    const projectsDir = path.join(__dirname, '../../projects');
    const screenshotsDir = path.join(projectsDir, `${projectName}_screenshots`);

    // Якщо директорія не існує — створюємо її рекурсивно
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }

    // Формуємо повний шлях збереження скріншоту
    const screenshotPath = path.join(screenshotsDir, finalFilename);

    // Зчитуємо прапорець додавання дати/часу з налаштувань ноди
    const addTimestamp = (nodeData.addTimestamp as boolean) || false;
    // Змінна для збереження оригінального position елемента (використовується у режимі selector)
    let origPosition = '';

    // --- КРОК 1: Додаємо оверлей дати/часу до скріншоту (якщо увімкнено) ---
    // Форматуємо дату на рівні Node.js, щоб уникнути помилок з транслятором tsx (__name is not defined) в браузері
    if (addTimestamp && activePage) {
      try {
        const now = new Date(); // Отримуємо поточну системну дату
        const pad = (n: number) => String(n).padStart(2, '0'); // Допоміжна функція форматування чисел
        const dateStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`; // Формуємо рядок часу (тільки години та хвилини HH:MM)

        if (mode === 'selector' && selector) {
          // Режим елемента: додаємо absolute-плашку всередину цільового елемента
          origPosition = await activePage.evaluate(({ sel, text }: { sel: string; text: string }) => {
            const el = document.querySelector(sel) as HTMLElement; // Шукаємо елемент на сторінці за CSS-селектором
            if (!el) return ''; // Якщо елемент не знайдено — повертаємо порожній рядок
            const orig = el.style.position; // Запам'ятовуємо поточне позиціонування для відновлення
            const computed = window.getComputedStyle(el); // Отримуємо обчислені стилі браузером
            if (computed.position === 'static') {
              // Якщо елемент статичний — тимчасово змінюємо на relative для коректного absolute-дітей
              el.style.position = 'relative';
            }
            // Видаляємо попередній оверлей якщо він є
            document.getElementById('screenshot-timestamp-overlay')?.remove();
            const overlay = document.createElement('div'); // Створюємо елемент плашки дати/часу
            overlay.id = 'screenshot-timestamp-overlay'; // Задаємо id для подальшого видалення
            overlay.style.cssText = [
              'position: absolute', // Absolute відносно батьківського елемента
              'bottom: 5px', // Відступ 5px від нижнього краю батьківського елемента
              'right: 5px', // Відступ 5px від правого краю батьківського елемента
              'background: transparent', // Прозорий фон (без плашки)
              'color: #000000', // Чорний колір тексту
              '-webkit-text-stroke: 1.5px #ffffff', // Біла обводка товщиною 1.5px
              'padding: 0', // Прибираємо відступи
              'font-family: monospace', // Моноширинний шрифт
              'font-size: 24px', // Збільшений розмір шрифту (24px замість 18px)
              'font-weight: bold', // Жирний шрифт
              'z-index: 2147483647', // Максимальний z-index — поверх усього
              'pointer-events: none', // Не заважаємо кліком
              'line-height: 1.2', // Висота рядка
            ].join(';'); // Об'єднуємо стилі
            overlay.innerText = text; // Встановлюємо pre-formatted текст
            el.appendChild(overlay); // Вставляємо плашку всередину цільового елемента
            return orig; // Повертаємо оригінальне значення position
          }, { sel: selector, text: dateStr });
        } else {
          // Режим всієї сторінки: додаємо fixed-плашку через HTML5 Canvas
          // Це гарантує її рендеринг поверх WebGL/Canvas гри
          await activePage.evaluate((text: string) => {
            // Видаляємо попередній оверлей якщо він є (уникаємо дублювання)
            document.getElementById('__ts_stamp_canvas__')?.remove();
            const fontSize = 32; // Збільшений шрифт для fullPage (32px замість 24px)
            const paddingX = 4; // Залишаємо невеликі відступи під білу обводку
            const paddingY = 4;
            const margin = 12;

            const canvas = document.createElement('canvas');
            canvas.id = '__ts_stamp_canvas__';
            canvas.style.cssText = 'position:fixed;top:0;left:0;pointer-events:none;visibility:hidden;';
            (document.body || document.documentElement).appendChild(canvas);

            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            ctx.font = `bold ${fontSize}px monospace`;
            const textMetrics = ctx.measureText(text);
            const textW = Math.ceil(textMetrics.width);
            // Додаємо запас (+8px) під обводку, яка виступає за контури тексту
            const boxW = textW + paddingX * 2 + 8;
            const boxH = fontSize + paddingY * 2 + 8;

            canvas.width = boxW;
            canvas.height = boxH;

            canvas.style.cssText = [
              'position: fixed', // Фіксоване позиціонування
              `bottom: ${margin}px`, // Зсув від нижнього краю екрану
              `right: ${margin}px`, // Зсув з правого боку
              'pointer-events: none',
              'z-index: 2147483647', // Максимальний z-index
              'visibility: visible',
              'border: none',
              'outline: none',
              'margin: 0',
              'padding: 0',
              'display: block',
            ].join(';');

            const ctx2 = canvas.getContext('2d');
            if (!ctx2) return;

            // Очищуємо canvas під прозорий фон
            ctx2.clearRect(0, 0, boxW, boxH);

            // Малюємо спочатку білу обводку
            ctx2.strokeStyle = '#ffffff'; // Колір обводки - білий
            ctx2.lineWidth = 5; // Товщина обводки 5px
            ctx2.lineJoin = 'round';
            ctx2.font = `bold ${fontSize}px monospace`;
            ctx2.textBaseline = 'middle';
            ctx2.strokeText(text, paddingX + 4, boxH / 2);

            // Потім поверх малюємо чорний текст
            ctx2.fillStyle = '#000000'; // Колір заливки тексту - чорний
            ctx2.fillText(text, paddingX + 4, boxH / 2);
          }, dateStr);
        }
        // Чекаємо 300 мс щоб браузер відмалював оверлей перед зйомкою
        await activePage.waitForTimeout(300);
      } catch (err) {
        logger.warn('Failed to inject timestamp overlay', { error: String(err) });
      }
    }

    // --- КРОК 2: Робимо скріншот ---
    if (mode === 'selector' && selector) {
      // Режим: скріншот конкретного CSS-елемента
      const elementHandle = await activePage.$(selector); // Шукаємо елемент на сторінці
      if (!elementHandle) {
        logToClient(`❌ Скріншот: Елемент не знайдено (${selector})`, 'error');
        return { data: context, nextHandle: ['error'] };
      }
      try {
        await elementHandle.scrollIntoViewIfNeeded(); // Прокручуємо елемент у видиму область
        await elementHandle.screenshot({
          path: screenshotPath, // Шлях збереження файлу
          timeout: 10000 // Таймаут 10 секунд
        });
        logToClient(`📸 Скріншот елемента збережено: ${finalFilename}`, 'success');
      } catch (screenshotErr: any) {
        // Якщо елемент не вдалося зняти — робимо резервний скріншот сторінки
        logger.warn(`Element screenshot failed, falling back to page viewport`, { error: String(screenshotErr) });
        logToClient(`⚠️ Скріншот елемента не вдалося (елемент невидимий), робимо скріншот сторінки`, 'info');
        await activePage.screenshot({ path: screenshotPath, fullPage: !addTimestamp });
        logToClient(`📸 Скріншот сторінки збережено: ${finalFilename}`, 'success');
      }
    } else {
      // Режим: скріншот всієї сторінки
      // Якщо увімкнено водяний знак (timestamp), знімаємо тільки поточний viewport (fullPage: false)
      // Оскільки position: fixed елементи (canvas штамп) не відображаються коректно при зйомці fullPage
      await activePage.screenshot({ path: screenshotPath, fullPage: !addTimestamp });
      logToClient(`📸 Скріншот сторінки збережено: ${finalFilename}`, 'success');
    }

    // --- КРОК 3: Видаляємо оверлей після зйомки (прибираємо за собою) ---
    if (addTimestamp && activePage) {
      try {
        await activePage.evaluate(({ sel, origPos }: { sel: string; origPos: string }) => {
          document.getElementById('__ts_stamp_canvas__')?.remove(); // Видаляємо canvas оверлей
          const overlay = document.getElementById('screenshot-timestamp-overlay'); // Шукаємо DOM оверлей за ID
          if (overlay) overlay.remove(); // Видаляємо плашку з DOM
          if (sel) {
            const el = document.querySelector(sel) as HTMLElement; // Шукаємо цільовий елемент
            if (el) el.style.position = origPos; // Повертаємо оригінальне позиціонування
          }
        }, { sel: mode === 'selector' ? selector : '', origPos: origPosition });
      } catch (err) {
        logger.warn('Failed to clean up timestamp overlay', { error: String(err) }); // Логуємо помилку очищення
      }
    }

    // --- КРОК 4: Відправляємо повідомлення на фронтенд через WebSocket ---
    try {
      ws.send(JSON.stringify({
        type: 'SCREENSHOT_SAVED', // Тип повідомлення
        projectName, // Назва проекту
        filename: finalFilename, // Назва файлу скріншоту
        path: screenshotPath // Повний шлях збереження
      }));
    } catch (sendErr) {
      logger.warn(`Failed to send SCREENSHOT_SAVED for node ${currentNode.id}`, { error: String(sendErr) });
    }

    // Повертаємо результат із збереженими даними скріншоту у контекст
    return {
      data: {
        ...context,
        imageNames: [...(Array.isArray(context.imageNames) ? context.imageNames : []), finalFilename],
        screenshotPath: `/api/screenshots/${projectName}/${finalFilename}`
      },
      nextHandle: 'next'
    };
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    logger.error(`ScreenshotNode error for node ${currentNode.id}`, e instanceof Error ? e : new Error(String(e)));
    logToClient(`❌ Скріншот помилка: ${errorMessage}`, 'error');
    return { data: context, nextHandle: ['error'] };
  }
};
