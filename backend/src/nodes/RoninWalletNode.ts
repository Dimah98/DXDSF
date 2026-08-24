import { NodeHandlerParams } from "./types";
import { RONIN_EXTENSION_ID } from "../index";
import { Page } from "playwright";

export const roninWalletNodeHandler = async ({
  currentNode, activePage, context, logToClient
}: NodeHandlerParams) => {
  const { password = "Ronin123!@#", maxAttempts = 3 } = currentNode.data as Record<string, any>;
  
  if (!activePage || !(activePage as Page).context()) {
    logToClient(`❌ RoninWallet: Браузер не знайдено`, "error");
    return { data: { ...(context || {}), error: "Browser context not found" }, nextHandle: ["error"] };
  }

  logToClient(`🦊 RoninWallet: Відкриваємо вікно гаманця...`, "info");
  let popupPage;
  try {
    popupPage = await (activePage as Page).context().newPage();
    const popupUrl = `chrome-extension://${RONIN_EXTENSION_ID}/src/pages/popup/popup.html`;
    await popupPage.goto(popupUrl, { waitUntil: "networkidle" });
    
    let attempts = 0;
    let handled = false;

    while (attempts < maxAttempts && !handled) {
      await popupPage.waitForTimeout(2000);
      attempts++;
      
      const isLocked = await popupPage.evaluate(() => {
        return !!document.querySelector("input[type=\"password\"]");
      });

      if (isLocked) {
        logToClient(`🦊 RoninWallet: Знайдено поле пароля. Розблоковуємо...`, "info");
        await popupPage.fill("input[type=\"password\"]", password);
        await popupPage.click("text=\"Unlock\"");
        await popupPage.waitForTimeout(3000);
        continue;
      }

      const actionText = await popupPage.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll("button"));
        for (const btn of buttons) {
          const text = btn.innerText.trim().toLowerCase();
          if (text === "confirm" || text === "approve" || text === "sign" || text === "next" || text === "connect") {
            btn.click();
            return text;
          }
        }
        return null;
      });

      if (actionText) {
        logToClient(`🦊 RoninWallet: Натиснуто кнопку "${actionText}"`, "success");
        handled = true;
        await popupPage.waitForTimeout(3000);
        break;
      }

      logToClient(`🦊 RoninWallet: Активних запитів не знайдено.`, "info");
      handled = true;
    }

    await popupPage.close();
    return { data: context, nextHandle: ["success"] };
  } catch (error) {
    if (popupPage && !popupPage.isClosed()) {
      await popupPage.close().catch(() => {});
    }
    logToClient(`❌ RoninWallet: Помилка взаємодії: ${error}`, "error");
    return { data: { ...(context || {}), error: String(error) }, nextHandle: ["error"] };
  }
};

