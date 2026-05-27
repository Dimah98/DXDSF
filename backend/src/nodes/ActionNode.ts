import { NodeHandlerParams } from './types';
import { inputValidator } from '../validation/InputValidator';
import { Logger } from '../logger';

const logger = new Logger('ActionNode');

export const actionNodeHandler = async ({
  currentNode,
  activePage,
  ws,
  context,
  nodeTitle,
  takeDebugSnapshot,
  logToClient,
  smartSleep
}: NodeHandlerParams) => {
  const nodeResults: Record<string, any> = {};
  const { selector, actionType = 'click', clickAll = false } = currentNode.data;

  logToClient(`⚙️ ДІЯ: ${actionType} ${selector ? `на ${selector}` : 'по координатах'}`, 'debug');

  // ── Клік по координатах (якщо контекст містить coords від InfoNode) ────────
  if (context.coords && (actionType === 'click' || actionType === 'double_click')) {
    let { x, y } = context.coords;
    let wheelY = 0;

    if (y < 0) { wheelY = y; y = 0; }

    const currentScroll = await activePage.evaluate(() => ({ x: window.scrollX, y: window.scrollY }));
    const vSize = activePage.viewportSize() || { width: 960, height: 540 };

    let finalX = x - currentScroll.x;
    let finalY = y - currentScroll.y;

    // Якщо координати поза viewport — перетягуємо карту (окрім статичних UI елементів)
    if (!currentNode.data.isUIElement && (finalX < 50 || finalX > (vSize.width - 50) || finalY < 50 || finalY > (vSize.height - 50))) {
      const centerX = vSize.width / 2;
      const centerY = vSize.height / 2;
      const deltaX = centerX - finalX;
      const deltaY = centerY - finalY;

      logToClient(`🚜 Тягну карту: (${centerX}, ${centerY}) -> (${centerX + deltaX}, ${centerY + deltaY})`, 'debug');

      await activePage.mouse.move(centerX, centerY);
      await activePage.mouse.down();
      await activePage.mouse.move(centerX + deltaX, centerY + deltaY, { steps: 25 });
      await activePage.mouse.up();
      await smartSleep(400, ws);
      await activePage.keyboard.press('Escape');

      finalX = centerX;
      finalY = centerY;
      await smartSleep(400, ws);
    }

    try {
      await takeDebugSnapshot(currentNode.id, nodeTitle, { x: finalX, y: finalY });
      await activePage.mouse.click(finalX, finalY);
      logToClient(`✅ Клік виконано в (${finalX}, ${finalY})`, 'success');
    } catch (err: any) {
      logToClient(`❌ Помилка кліку по координатах: ${err.message}`, 'error');
      return { data: context, nextHandle: ['error'] };
    }

  } else if (selector) {
    // ── Дії по CSS-селектору ─────────────────────────────────────────────────
    
    // Requirement 4: Validate CSS selector before Playwright operations
    const selectorValidation = inputValidator.validateSelector(selector);
    if (!selectorValidation.isValid) {
      logger.warn(`Action node ${currentNode.id}: selector validation failed`, { selector, error: selectorValidation.error });
      logToClient(`❌ Невалідний селектор: ${selectorValidation.error}`, 'error');
      return { data: context, nextHandle: ['error'] };
    }

    // ── js_click: обхід антибот через element.click() у JS-контексті ────────
    if (actionType === 'js_click') {
      try {
        const clicked = await activePage.evaluate((sel: string) => {
          const all = Array.from(document.querySelectorAll(sel));
          if (all.length === 0) return 0;
          (all[0] as HTMLElement).click();
          return all.length;
        }, selector);
        logToClient(`✅ JS Click виконано (знайдено ${clicked} елементів)`, 'success');
      } catch (err: any) {
        logToClient(`❌ js_click провалився: ${err.message}`, 'error');
        return { data: context, nextHandle: ['error'] };
      }
      // Повертаємо контекст далі — без цього наступні ноди не отримають дані
      return { data: context, nextHandle: [null, undefined, 'success'] };
    }

    // ── force_click: Playwright клік з force:true, без waitForSelector ───────
    if (actionType === 'force_click') {
      try {
        await takeDebugSnapshot(currentNode.id, nodeTitle, { selector });
        if (clickAll) {
          // Клікаємо по всіх знайдених елементах
          const els = await activePage.$$(selector);
          for (const el of els) {
            await el.click({ force: true }).catch(() => {});
          }
          logToClient(`✅ Force Click на всіх (${els.length}) елементах`, 'success');
        } else {
          // Чекаємо появи (не visible — може бути приховано transform-ом)
          await activePage.waitForSelector(selector, { timeout: 8000, state: 'attached' });
          await activePage.click(selector, { force: true });
          logToClient(`✅ Force Click виконано: ${selector}`, 'success');
        }
      } catch (err: any) {
        logToClient(`❌ force_click провалився (${selector}): ${err.message}`, 'error');
        return { data: context, nextHandle: ['error'] };
      }
      // Повертаємо контекст далі — без цього наступні ноди не отримають дані
      return { data: context, nextHandle: [null, undefined, 'success'] };
    }

    // ── Стандартні дії ───────────────────────────────────────────────────────
    if (clickAll) {
      try {
        const els = await activePage.$$(selector);
        for (const el of els) if (await el.isVisible()) await el.click({ force: true });
        logToClient(`✅ Клікнуто на всі (${els.length}) елементи`, 'success');
      } catch (err: any) {
        logToClient(`❌ Помилка при кліку на всі елементи (${selector}): ${err.message}`, 'error');
        return { data: context, nextHandle: ['error'] };
      }
    } else {
      try {
        await takeDebugSnapshot(currentNode.id, nodeTitle, { selector });
        await activePage.waitForSelector(selector, { timeout: 5000, state: 'visible' });

        if (actionType === 'click')        await activePage.click(selector, { force: true });
        else if (actionType === 'double_click') await activePage.dblclick(selector, { force: true });
        else if (actionType === 'hover')   await activePage.hover(selector);
        else if (actionType === 'scroll')  await activePage.$eval(selector, (el: any) => el.scrollIntoView());

        logToClient(`✅ Дія ${actionType} виконана`, 'success');
      } catch (err: any) {
        if (err.name === 'TimeoutError') {
          logToClient(`❌ Елемент не знайдено за 5 сек: ${selector}`, 'error');
        } else {
          logToClient(`❌ Помилка дії ${actionType} (${selector}): ${err.message}`, 'error');
        }
        return { data: context, nextHandle: ['error'] };
      }
    }
  }

  return { data: context, nextHandle: [null, undefined, 'success'] };
};
