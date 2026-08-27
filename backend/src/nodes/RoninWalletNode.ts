import { NodeHandlerParams } from "./types";
import { RONIN_EXTENSION_ID } from "../constants";
import { Page } from "playwright";

export const roninWalletNodeHandler = async ({
  currentNode, activePage, context, logToClient
}: NodeHandlerParams) => {
  const { password = "Ronin123!@#", maxAttempts = 3 } = currentNode.data as Record<string, any>;
  
  if (!activePage || !(activePage as Page).context()) {
    logToClient(`❌ RoninWallet: Браузер не знайдено`, "error");
    return { data: { ...(context || {}), error: "Browser context not found" }, nextHandle: ["error"] };
  }

  const browserContext = (activePage as Page).context();
  logToClient(`🦊 RoninWallet: Пошук або відкриття вікна гаманця...`, "info");
  
  let popupPage: Page | undefined;
  let isNewlyCreated = false;

  try {
    // 1. Шукаємо вже відкрите вікно розширення Ronin
    popupPage = browserContext.pages().find(p => p.url().includes(RONIN_EXTENSION_ID));
    
    if (!popupPage) {
      popupPage = await browserContext.newPage();
      isNewlyCreated = true;
      const popupUrl = `chrome-extension://${RONIN_EXTENSION_ID}/src/pages/popup/popup.html`;
      await popupPage.goto(popupUrl, { waitUntil: "domcontentloaded", timeout: 10000 });
    } else {
      await popupPage.bringToFront().catch(() => {});
    }
    
    let attempts = 0;
    let handled = false;

    while (attempts < maxAttempts && !handled) {
      attempts++;
      
      // Перевірка наявності поля розблокування
      const passwordInput = popupPage.locator('input[type="password"]');
      const isLocked = (await passwordInput.count() > 0) && (await passwordInput.first().isVisible().catch(() => false));

      if (isLocked) {
        logToClient(`🦊 RoninWallet: Знайдено поле пароля. Розблоковуємо...`, "info");
        await passwordInput.first().fill(password);
        const unlockBtn = popupPage.locator('button:has-text("Unlock"), button:has-text("Розблокувати")');
        if (await unlockBtn.count() > 0) {
          await unlockBtn.first().click();
        }
        await popupPage.waitForTimeout(600);
        continue;
      }

      // Перевірка кнопок підтвердження/підпису дій
      const actionLocators = popupPage.locator(
        'button:has-text("Confirm"), button:has-text("Approve"), button:has-text("Sign"), button:has-text("Next"), button:has-text("Connect"), button:has-text("Підтвердити")'
      );

      try {
        await actionLocators.first().waitFor({ state: 'visible', timeout: 2000 });
        const count = await actionLocators.count();
        if (count > 0) {
          const btn = actionLocators.first();
          const actionText = (await btn.innerText().catch(() => 'Confirm')).trim();
          await btn.click();
          logToClient(`🦊 RoninWallet: Натиснуто кнопку "${actionText}"`, "success");
          handled = true;
          await popupPage.waitForTimeout(500);
          break;
        }
      } catch (_) {
        // Кнопка дії не з'явилась за таймаут
      }

      if (attempts >= maxAttempts) {
        logToClient(`🦊 RoninWallet: Активних запитів не знайдено.`, "info");
        handled = true;
      }
    }

    if (isNewlyCreated && popupPage && !popupPage.isClosed()) {
      await popupPage.close().catch(() => {});
    }

    return { data: context, nextHandle: ["success"] };
  } catch (error) {
    if (isNewlyCreated && popupPage && !popupPage.isClosed()) {
      await popupPage.close().catch(() => {});
    }
    logToClient(`❌ RoninWallet: Помилка взаємодії: ${error}`, "error");
    return { data: { ...(context || {}), error: String(error) }, nextHandle: ["error"] };
  }
};

