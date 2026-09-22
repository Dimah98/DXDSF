import { NodeHandlerParams } from "./types";
import { RONIN_EXTENSION_ID } from "../constants";
import { Page } from "playwright";
import { sessions, FIXED_RONIN_UUID } from "../browserManager";
import { Logger } from "../logger";
import { getProjectWallet, getRoninInjectionScript, DEFAULT_WALLET_PASSWORD } from "../web3Signer";

const logger = new Logger("RoninWalletNode");

export const roninWalletNodeHandler = async ({
  currentNode, activePage, context, logToClient, projectName
}: NodeHandlerParams) => {
  const session = projectName ? sessions.get(projectName) : undefined;
  const projectSettings = session?.botSettings as Record<string, any> | undefined;
  const projectVariables = session?.globalVariables as Record<string, any> | undefined;

  // Пріоритет пароля
  const nodePassword = currentNode.data?.password;
  const password = (nodePassword && nodePassword !== "Ronin123!@#")
    ? nodePassword
    : ((context as any)?.walletPassword 
      || projectVariables?.walletPassword
      || projectSettings?.walletPassword 
      || DEFAULT_WALLET_PASSWORD);

  // 1. НАЙВИЩИЙ ПРІОРИТЕТ: Гаманець поточного проекту (запобігає підміні ключа при копіюванні нод між проектами)
  let rawPrivateKey: string | null = null;
  if (projectName) {
    const pWallet = getProjectWallet(projectName);
    if (pWallet?.privateKey) {
      rawPrivateKey = pWallet.privateKey;
    }
  }

  // 2. Якщо проект не має вбудованого ключа, перевіряємо налаштування сесії цього проекту
  if (!rawPrivateKey) {
    rawPrivateKey = projectSettings?.walletPrivateKey 
      || projectVariables?.walletPrivateKey
      || (context as any)?.walletPrivateKey;
  }

  const privateKey = rawPrivateKey ? String(rawPrivateKey).trim() : null;

  if (!activePage || !(activePage as Page).context()) {
    logToClient(`❌ RoninWallet: Браузер не знайдено`, "error");
    return { data: { ...(context || {}), error: "Browser context not found" }, nextHandle: ["error"] };
  }

  const browserContext = (activePage as Page).context();
  logToClient(`🦊 RoninWallet: Перевірка стану гаманця для ${projectName || "проєкту"}...`, "info");

  // ─── 1. ПЕРЕВІРКА СТОРІНКИ SUNFLOWER LAND (АВТОМАТИЧНИЙ ВХІД) ───
  let gamePage: Page | undefined;
  const allPages = browserContext.pages();
  for (const p of allPages) {
    if (p.url().includes("sunflower-land.com")) {
      gamePage = p;
      break;
    }
  }
  if (!gamePage && (activePage as Page).url().includes("sunflower-land.com")) {
    gamePage = activePage as Page;
  }

  // Якщо активна вкладка порожня (about:blank), автоматично відкриваємо Sunflower Land
  if (!gamePage && activePage) {
    const activeUrl = (activePage as Page).url();
    if (activeUrl === 'about:blank' || !activeUrl.startsWith('http')) {
      logToClient(`🌐 RoninWallet: Браузер знаходиться на ${activeUrl}. Відкриваємо Sunflower Land...`, "info");
      try {
        await (activePage as Page).goto('https://sunflower-land.com/play/#/', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await (activePage as Page).waitForTimeout(2000);
        if ((activePage as Page).url().includes('sunflower-land.com')) {
          gamePage = activePage as Page;
        }
      } catch (navErr: any) {
        logToClient(`⚠️ RoninWallet: Не вдалося автоматично відкрити Sunflower Land: ${navErr.message}`, "info");
      }
    }
  }

  if (gamePage) {
    try {
      await gamePage.bringToFront().catch(() => {});

      // Гарантуємо інжекцію Ronin Bridge у DOM поточної сторінки гри
      try {
        const roninBridge = getRoninInjectionScript(projectName || 'SF');
        await gamePage.evaluate(roninBridge).catch(() => {});
      } catch (_) {}

      logToClient(`🌻 RoninWallet: Виявлено сторінку гри Sunflower Land. Перевіряємо статус сесії...`, "info");

      // 1.1 Перевірка, чи гра вже завантажена (наявність canvas)
      const isAlreadyLoggedIn = await gamePage.evaluate(() => {
        const canvas = document.querySelector('canvas');
        const hasGameRoot = !!document.querySelector('#root, #game-container');
        const isNotOnLoginScreen = !document.body.innerText.includes('Welcome') && 
                                   !document.body.innerText.includes('Login') && 
                                   !document.body.innerText.includes('Terms of Service') &&
                                   !document.body.innerText.includes('Sign Message');
        return !!canvas && hasGameRoot && isNotOnLoginScreen;
      }).catch(() => false);

      if (isAlreadyLoggedIn) {
        logToClient(`✅ RoninWallet: Акаунт вже успішно увійшов у Sunflower Land!`, "success");
        return { 
          data: { ...(context || {}), walletPassword: password, walletPrivateKey: privateKey }, 
          nextHandle: ["success"] 
        };
      }

      // 1.2 Якщо є кнопка "Sign Message"
      let hasSignBtn = await gamePage.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Sign Message'));
        return !!btn;
      }).catch(() => false);

      if (hasSignBtn) {
        logToClient(`✍️ RoninWallet: Виявлено запит на підпис повідомлення. Підписуємо автоматично...`, "info");
        await gamePage.evaluate(() => {
          const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Sign Message'));
          if (btn) btn.click();
        });
        await gamePage.waitForTimeout(3000);
      } else {
        // 1.3 Якщо ми на стартовому екрані, проходимо ланцюжок: Login -> Ronin -> Ronin Browser Extension
        const buttons = await gamePage.evaluate(() => {
          return Array.from(document.querySelectorAll('button')).map(b => b.innerText.trim()).filter(Boolean);
        }).catch(() => [] as string[]);

        if (buttons.some(b => b.includes('Login'))) {
          logToClient(`🔘 RoninWallet: Натискаємо кнопку "Login"...`, "info");
          await gamePage.evaluate(() => {
            const b = Array.from(document.querySelectorAll('button')).find(x => x.innerText.includes('Login'));
            if (b) b.click();
          });
          await gamePage.waitForTimeout(1000);
        }

        const afterLoginButtons = await gamePage.evaluate(() => {
          return Array.from(document.querySelectorAll('button')).map(b => b.innerText.trim()).filter(Boolean);
        }).catch(() => [] as string[]);

        if (afterLoginButtons.some(b => b.includes('Ronin') && !b.includes('Extension'))) {
          logToClient(`🔘 RoninWallet: Обираємо гаманець "Ronin"...`, "info");
          await gamePage.evaluate(() => {
            const b = Array.from(document.querySelectorAll('button')).find(x => x.innerText.includes('Ronin') && !x.innerText.includes('Extension'));
            if (b) b.click();
          });
          await gamePage.waitForTimeout(1000);
        }

        const afterRoninButtons = await gamePage.evaluate(() => {
          return Array.from(document.querySelectorAll('button')).map(b => b.innerText.trim()).filter(Boolean);
        }).catch(() => [] as string[]);

        if (afterRoninButtons.some(b => b.includes('Ronin Browser Extension') || b.includes('Ronin Wallet'))) {
          logToClient(`🦊 RoninWallet: Обираємо "Ronin Browser Extension"...`, "info");
          await gamePage.evaluate(() => {
            const b = Array.from(document.querySelectorAll('button')).find(x => x.innerText.includes('Ronin Browser Extension') || (x.innerText.includes('Ronin') && x.innerText.includes('Wallet')));
            if (b) b.click();
          });
          await gamePage.waitForTimeout(2000);
        }

        // Тепер перевіряємо, чи з'явилася кнопка "Sign Message"
        hasSignBtn = await gamePage.evaluate(() => {
          const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Sign Message'));
          return !!btn;
        }).catch(() => false);

        if (hasSignBtn) {
          logToClient(`✍️ RoninWallet: Натискаємо кнопку "Sign Message" для завершення входу...`, "info");
          await gamePage.evaluate(() => {
            const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Sign Message'));
            if (btn) btn.click();
          });
          await gamePage.waitForTimeout(3000);
        }
      }

      // 1.4 Очікуємо завершення авторизації та появи гри
      logToClient(`⏳ RoninWallet: Очікуємо завантаження ферми...`, "info");
      let loginSuccessful = false;
      for (let i = 0; i < 20; i++) {
        await gamePage.waitForTimeout(1000);
        const state = await gamePage.evaluate(() => {
          const canvas = document.querySelector('canvas');
          const text = document.body.innerText || '';
          const hasError = text.includes('Oops! Something went wrong!') || text.includes('Error: LO-');
          const isPlaying = !!canvas && !text.includes('Sign Message') && !text.includes('Welcome');
          return { isPlaying, hasError, textSnippet: text.slice(0, 100) };
        }).catch(() => ({ isPlaying: false, hasError: false, textSnippet: '' }));

        if (state.isPlaying) {
          loginSuccessful = true;
          break;
        }

        if (state.hasError) {
          logToClient(`⚠️ RoninWallet: Помилка сервера гри (${state.textSnippet.replace(/\\n/g, ' ')}), оновлюємо сесію...`, "info");
          const refreshBtn = await gamePage.evaluate(() => {
            const b = Array.from(document.querySelectorAll('button')).find(x => x.innerText.includes('Refresh') || x.innerText.includes('Try again'));
            if (b) { b.click(); return true; }
            return false;
          }).catch(() => false);
          if (refreshBtn) {
            await gamePage.waitForTimeout(3000);
          }
          break;
        }
      }

      if (loginSuccessful) {
        logToClient(`🎉 RoninWallet: Авторизація успішна! Гра завантажена.`, "success");
        return { 
          data: { ...(context || {}), walletPassword: password, walletPrivateKey: privateKey }, 
          nextHandle: ["success"] 
        };
      }
    } catch (gameErr: any) {
      logger.warn(`Failed during game login sequence: ${gameErr.message}`);
    }
  }

  // ─── 2. ПЕРЕВІРКА ОКРЕМОГО ПОПАПУ РОЗШИРЕННЯ (ЯКЩО ВІДКРИТИЙ) ───
  let popupPage: Page | undefined;
  popupPage = browserContext.pages().find(p => 
    p.url().includes("ronin-wallet") || 
    p.url().includes(RONIN_EXTENSION_ID) || 
    p.url().includes(FIXED_RONIN_UUID)
  );

  if (popupPage) {
    try {
      await popupPage.bringToFront().catch(() => {});
      const passwordInput = popupPage.locator('input[type="password"]');
      if (await passwordInput.count() === 1 && await passwordInput.first().isVisible().catch(() => false)) {
        logToClient(`🔐 RoninWallet: Розблоковуємо гаманець паролем...`, "info");
        await passwordInput.first().fill(password);
        const unlockBtn = popupPage.locator('button:has-text("Unlock"), button:has-text("Розблокувати")');
        if (await unlockBtn.count() > 0) {
          await unlockBtn.first().click();
        }
        await popupPage.waitForTimeout(1000);
      }

      const actionBtn = popupPage.locator('button:has-text("Confirm"), button:has-text("Approve"), button:has-text("Sign"), button:has-text("Connect")');
      if (await actionBtn.count() > 0 && await actionBtn.first().isVisible().catch(() => false)) {
        await actionBtn.first().click();
        logToClient(`🦊 RoninWallet: Підтверджено дію в попапі розширення`, "success");
        await popupPage.waitForTimeout(600);
      }
    } catch (_) {}
  }

  logToClient(`🦊 RoninWallet: Гаманець готовий до роботи.`, "info");
  return { 
    data: { 
      ...(context || {}), 
      walletPassword: password,
      walletPrivateKey: privateKey 
    }, 
    nextHandle: ["success"] 
  };
};
