import { chromium, Page } from 'playwright';
import path from 'path';
import fs from 'fs';
import net from 'net';
import { exec } from 'child_process';
import { promisify } from 'util';
import 'dotenv/config';
import { Logger } from './logger';
import { RONIN_EXTENSION_ID } from './constants';
import { ProjectSession, ExtendedWebSocket } from './types';
import { internalConfig } from './internalConfig';

const execAsync = promisify(exec);

// Логер для browserManager
const logger = new Logger('BrowserManager');

/**
 * Асинхронне та неблокуюче завершення процесу браузера за портом (без execSync)
 */
export async function killProcessTreeOnPort(port: number, projectName: string): Promise<void> {
  if (process.platform !== 'win32' || !port) return;
  try {
    const { stdout: netstat } = await execAsync(`netstat -ano | findstr :${port}`);
    const lines = netstat.split('\n');
    for (const line of lines) {
      if (line.includes('LISTENING')) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && pid !== '0' && !isNaN(Number(pid))) {
          try {
            await execAsync(`taskkill /F /PID ${pid} /T`);
            logger.info(`Killed old browser process`, { pid, port, projectName });
          } catch (killErr) {
            logger.warn(`Failed to kill old browser process`, { pid, port, projectName, error: String(killErr) });
          }
          break;
        }
      }
    }
  } catch (e) {
    logger.debug(`No listening process found on port ${port} for project ${projectName}`);
  }
}

/**
 * Приховує вікно процесу з панелі завдань та екрану Windows за допомогою cdpPort
 */
export function hideProcessWindowByPort(cdpPort: number) {
  if (process.platform !== 'win32' || !cdpPort) return;
  // Якщо активний modern headless (--headless=new), нативне вікно взагалі не створюється
  const isHeadless = internalConfig.get('headless') === 1;
  if (isHeadless) return;

  const psScript = `$proc = Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*remote-debugging-port=${cdpPort}*' } | Select-Object -First 1; if ($proc) { (Get-Process -Id $proc.ProcessId).MainWindowHandle }`;
  exec(`powershell -NoProfile -NonInteractive -Command "${psScript}"`, (err) => {
    if (err) logger.debug(`Failed to hide window for cdpPort ${cdpPort}: ${err.message}`);
  });
}

// Створюємо карту для зберігання активних сесій за назвою проекту
export const sessions = new Map<string, ProjectSession>();

// Лічильник та черга для запобігання Race Condition при виділенні портів
let nextCdpPort = 9222;
const allocatedPorts = new Set<number>();
let portMutex = Promise.resolve();

/**
 * Безпечне атомарне виділення вільного CDP порту без стану гонки
 */
export async function allocatePort(preferredPort?: number): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    portMutex = portMutex.then(async () => {
      try {
        let candidate = preferredPort && preferredPort >= 9222 ? preferredPort : nextCdpPort;
        while (allocatedPorts.has(candidate)) {
          candidate++;
        }
        let freePort = await findFreePort(candidate);
        while (allocatedPorts.has(freePort)) {
          freePort = await findFreePort(freePort + 1);
        }
        allocatedPorts.add(freePort);
        nextCdpPort = Math.max(nextCdpPort, freePort + 1);
        resolve(freePort);
      } catch (e) {
        reject(e);
      }
    });
  });
}

/**
 * Звільнення CDP порту для повторного використання
 */
export function releasePort(port?: number) {
  if (port) {
    allocatedPorts.delete(port);
  }
}

// Функція для отримання існуючої або створення нової сесії проекту
export function getOrCreateSession(projectName: string): ProjectSession {
  // Пробуємо отримати сесію з карти
  let session = sessions.get(projectName);
  // Якщо сесії немає, створюємо її з початковими значеннями
  if (!session) {
    session = {
      projectName,
      browser: null,
      context: null,
      page: null,
      activeWs: null,
      isBotRunning: false,
      botSettings: { photoDebug: true },
      globalVariables: {},
      nodeRuntimeState: new Map(),
      lastActiveNodeId: null,
      lastActiveNodeTitle: null, // Початково заголовок активної ноди відсутній
      isStreaming: false,
      photoDebugEnabled: true,
      currentlyRunningProfileDir: null,
      cdpPort: nextCdpPort++, // Призначаємо початковий порт
      createdAt: Date.now(),
      lastActivity: Date.now(),
      safetyTimeout: null,
    };
    // Зберігаємо нову сесію в карту
    sessions.set(projectName, session);
  }
  // Повертаємо сесію
  return session;
}

// Фоновий перехоплювач мережевих запитів та відповідей для отримання токена та Farm ID (ApiNode)
export function attachNetworkInterception(session: ProjectSession) {
  if (!session.context) return;

  const handleAuthAndFarmId = (url: string, headers: Record<string, string>, responseJson?: any) => {
    try {
      const authHeader = headers['authorization'] || headers['Authorization'] || null;
      const token = authHeader ? authHeader.replace(/^Bearer\s+/i, '').trim() : null;

      if (token) {
        session.latestApiToken = token;
        try {
          const parts = token.split('.');
          if (parts.length >= 2) {
            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
            const extractedFarmId = payload.farmId || payload.sub || payload.user?.farmId || payload.userId || payload.id;
            if (extractedFarmId) {
              session.latestFarmId = String(extractedFarmId);
            }
          }
        } catch (_) {}
      }

      // Перевіряємо числовий farm ID у URL (наприклад /visit/123456, /farm/123456, /farms/123456)
      const farmIdMatch = url.match(/\/(?:visit|farm|farms|community|game)\/(\d+)/i) || url.match(/\/(\d{5,})/);
      if (farmIdMatch && farmIdMatch[1]) {
        session.latestFarmId = farmIdMatch[1];
      }

      if (responseJson) {
        const possibleFarmId = responseJson.farmId || responseJson.farm?.id || responseJson.visitedFarmState?.farmId || responseJson.id;
        if (possibleFarmId && !session.latestFarmId) {
          session.latestFarmId = String(possibleFarmId);
        }
        if (responseJson.token && !session.latestApiToken) {
          session.latestApiToken = responseJson.token;
        }
      }
    } catch (_) {}
  };

  try {
    session.context.on('request', (request) => {
      try {
        const url = request.url();
        if (url.includes('sunflower-land.com')) {
          handleAuthAndFarmId(url, request.headers());
        }
      } catch (_) {}
    });

    session.context.on('response', async (response) => {
      try {
        const url = response.url();
        if (url.includes('sunflower-land.com')) {
          let json: any = undefined;
          if (url.includes('api.sunflower-land.com') && response.status() === 200) {
            try {
              json = await response.json();
            } catch (_) {}
          }
          handleAuthAndFarmId(url, response.request().headers(), json);
        }
      } catch (_) {}
    });
  } catch (err) {
    logger.warn(`Failed to attach context network interception for project ${session.projectName}`, { error: String(err) });
  }
}

// Шляхи та дефолтні налаштування профілю IT Browser — зчитуються з .env
// Шлях до userData дефолтного профілю
const USER_DATA = process.env.ITBROWSER_USER_DATA || '';
// Шлях до chrome.exe IT Browser
const ITBROWSER_EXE = process.env.ITBROWSER_EXE || '';
// Дефолтна папка профілю з .env
const ITBROWSER_PROFILE_DIR = process.env.ITBROWSER_PROFILE_DIR || '20260506212424';
// Базова директорія userData (папка, яка містить всі профілі)
const ITBROWSER_BASE_USERDATA = USER_DATA ? path.dirname(USER_DATA) : '';

// Допоміжна функція для пошуку першого вільного TCP порту починаючи з заданого
export async function findFreePort(startPort: number): Promise<number> {
  // Повертаємо проміс з номером вільного порту
  return new Promise((resolve) => {
    // Внутрішня функція для рекурсивної перевірки портів
    const checkPort = (port: number) => {
      // Створюємо тимчасовий TCP сервер
      const server = net.createServer();
      // Пробуємо слухати вибраний порт
      server.listen(port, () => {
        // Якщо порт вільний і сервер запустився, закриваємо його та повертаємо порт
        server.once('close', () => {
          resolve(port);
        });
        server.close();
      });
      // Якщо виникає помилка (порт зайнятий), перевіряємо наступний порт
      server.on('error', () => {
        checkPort(port + 1);
      });
    };
    // Починаємо перевірку зі стартового порту
    checkPort(startPort);
  });
}

// Функція для встановлення активного WebSocket з'єднання для сесії
export function setSessionActiveWs(projectName: string, ws: ExtendedWebSocket) {
  // Отримуємо або створюємо сесію
  const session = getOrCreateSession(projectName);
  // Записуємо WebSocket у сесію
  session.activeWs = ws;
}

// Функція для перевірки чи активний браузер у сесії
export function isSessionBrowserAlive(session: ProjectSession): boolean {
  // Перевіряємо чи об'єкт браузера існує та чи має активне підключення
  if (session.browser && session.browser.isConnected()) {
    return true;
  }
  // Перевіряємо через context (для persistent context Playwright)
  if (session.context) {
    try {
      const pages = session.context.pages();
      if (pages.length > 0 && !pages[0].isClosed()) {
        return true;
      }
    } catch {
      return false;
    }
  }
  // Перевіряємо через page
  if (session.page && !session.page.isClosed()) {
    return true;
  }
  return false;
}

// Функція для закриття браузера конкретної сесії
export async function closeSessionBrowser(session: ProjectSession) {
  // Звільняємо виділений CDP порт
  releasePort(session.cdpPort);

  // Якщо об'єкт браузера існує у сесії
  if (session.browser) {
    try {
      // Пробуємо закрити браузер
      await session.browser.close();
    } catch (e) {
      // Логуємо помилку закриття браузера (не критична — ресурси все одно скидаємо)
      logger.warn(`Error closing browser for project ${session.projectName}`, { error: String(e) });
    }
  } else if (session.context) {
    try {
      await session.context.close();
    } catch (e) {
      logger.warn(`Error closing browser context for project ${session.projectName}`, { error: String(e) });
    }
  }
  // Скидаємо посилання в сесії на null
  session.browser = null;
  session.context = null;
  session.page = null;
}

// Функція для підключення Playwright до запущеного браузера через CDP
// proxyUser та proxyPass — необов'язкові облікові дані проксі для авто-авторизації у вже запущеному браузері
async function connectOverCDP(session: ProjectSession, port: number, proxyUser?: string, proxyPass?: string) {
  try {
    // Пробуємо підключитися до вказаного порту
    const browserCDP = await chromium.connectOverCDP(`http://localhost:${port}`);
    // Отримуємо список контекстів
    const contexts = browserCDP.contexts();
    // Якщо контексти знайдені
    if (contexts.length > 0) {
      // Зберігаємо перший контекст у сесію
      session.context = contexts[0];
      // Отримуємо сторінки контексту
      const pages = session.context.pages();
      // Шукаємо сторінку з грою або беремо першу ліпшу сторінку
      session.page = pages.find(p => p.url().includes('sunflower-land')) || pages[0];
      // Зберігаємо об'єкт браузера в сесію
      session.browser = browserCDP;

      // Якщо передані облікові дані проксі — налаштовуємо авто-авторизацію через CDP Fetch API
      // Це необхідно для вже запущених браузерів, де launchPersistentContext вже не допоможе
      if (proxyUser && proxyPass && session.page) {
        try {
          // Відкриваємо CDP-сесію для активної сторінки
          const cdpSession = await session.context.newCDPSession(session.page);
          // Вмикаємо перехоплення Fetch-запитів разом із обробкою запитів авторизації
          await cdpSession.send('Fetch.enable', { handleAuthRequests: true });

          // Обробляємо всі звичайні зупинені запити — просто продовжуємо їх без змін
          cdpSession.on('Fetch.requestPaused', async (event: any) => {
            try {
              // Продовжуємо запит без будь-яких модифікацій щоб не порушити роботу сторінки
              await cdpSession.send('Fetch.continueRequest', { requestId: event.requestId });
            } catch (err) {
              logger.debug(`Failed to continue request for project ${session.projectName}`, { error: String(err), requestId: event.requestId });
            }
          });

          // Обробляємо запити авторизації — якщо проксі вимагає логін/пароль, надаємо їх автоматично
          cdpSession.on('Fetch.authRequired', async (event: any) => {
            try {
              // Перевіряємо чи запит авторизації надходить від проксі-сервера
              if (event.authChallenge && event.authChallenge.source === 'Proxy') {
                // Надаємо облікові дані проксі автоматично без показу діалогу користувачу
                await cdpSession.send('Fetch.continueWithAuth', {
                  requestId: event.requestId, // Ідентифікатор запиту
                  authChallengeResponse: {
                    response: 'ProvideCredentials', // Відповідь: надаємо облікові дані
                    username: proxyUser, // Логін проксі з налаштувань проекту
                    password: proxyPass  // Пароль проксі з налаштувань проекту
                  }
                });
              } else {
                // Для інших видів авторизації (HTTP-авторизація сайту) — не втручаємося
                await cdpSession.send('Fetch.continueWithAuth', {
                  requestId: event.requestId, // Ідентифікатор запиту
                  authChallengeResponse: { response: 'Default' } // Стандартна відповідь (без облікових даних)
                });
              }
            } catch (err) {
              logger.debug(`Failed to handle auth request for project ${session.projectName}`, { error: String(err), requestId: event.requestId });
            }
          });

          // Логуємо успішне налаштування авто-авторизації через CDP
          logger.info(`Proxy CDP auto-auth activated for project ${session.projectName}`);
        } catch (cdpErr) {
          // Якщо не вдалося налаштувати CDP авторизацію — виводимо попередження але продовжуємо
          logger.warn(`Failed to set up CDP proxy auth for project ${session.projectName}`, { error: String(cdpErr) });
        }
      }

      // Повертаємо знайдену сторінку
      return session.page;
    }
  } catch (e) {
    // CDP підключення не вдалося — це очікувана ситуація (браузер ще не запущений)
    logger.debug(`CDP connection failed for project ${session.projectName} on port ${port}`, { error: String(e) });
    return null;
  }
  // Повертаємо null, якщо не вдалося підключитися
  return null;
}

// Функція для зміни розміру вікна браузера конкретної сторінки
async function resizeBrowserWindow(session: ProjectSession, targetPage: Page, width: number, height: number) {
  try {
    if (session.context) {
      // Створюємо CDP сесію для керування вікном на низькому рівні
      const CDPsession = await session.context.newCDPSession(targetPage);
      try {
        // Отримуємо ID вікна сторінки
        const { windowId } = await CDPsession.send('Browser.getWindowForTarget');
        // Відновлюємо вікно зі стану максимізації (інакше setWindowBounds не спрацює)
        await CDPsession.send('Browser.setWindowBounds', {
          windowId,
          bounds: { windowState: 'normal' }
        });
        // Отримуємо поточні розміри вікна
        const { bounds: currentBounds } = await CDPsession.send('Browser.getWindowBounds', { windowId });
        // Отримуємо реальний viewport через JS (бо viewportSize() повертає null при viewport: null)
        const innerSize = await targetPage.evaluate(() => ({
          w: window.innerWidth,
          h: window.innerHeight
        }));
        // Обчислюємо висоту хрому браузера (вкладки, адресний рядок тощо)
        const chromeWidth = (currentBounds.width || 0) - innerSize.w;
        const chromeHeight = (currentBounds.height || 0) - innerSize.h;
        // Встановлюємо розміри вікна з урахуванням хрому, щоб viewport був ТОЧНО width × height
        await CDPsession.send('Browser.setWindowBounds', {
          windowId,
          bounds: { width: width + chromeWidth, height: height + chromeHeight, windowState: 'normal' }
        });
      } finally {
        // Відключаємо CDP сесію в будь-якому випадку
        try {
          await CDPsession.detach();
        } catch (detachErr) {
          logger.debug(`Failed to detach CDP session for project ${session.projectName}`, { error: String(detachErr) });
        }
      }
    }
  } catch (e) {
    logger.warn(`Failed to resize browser window for project ${session.projectName}`, { error: String(e) });
  }
}

// Головна функція для підключення або запуску браузера конкретної сесії проекту
export async function connectToBrowser(session: ProjectSession, width = 1280, height = 720, _profileName?: string, profileDir?: string, proxyServer?: string) {
  // Визначаємо директорію профілю: вказану користувачем або дефолтну
  const requestedProfileDir = profileDir && profileDir.trim() !== '' ? profileDir : ITBROWSER_PROFILE_DIR;

  // Якщо профіль змінився в межах цієї ж сесії, закриваємо старий браузер та вбиваємо його процес
  if (session.currentlyRunningProfileDir && session.currentlyRunningProfileDir !== requestedProfileDir) {
    logger.info(`Profile change for project ${session.projectName}: ${session.currentlyRunningProfileDir} → ${requestedProfileDir}. Closing old browser...`);
    // Закриваємо браузер сесії
    try {
      await closeSessionBrowser(session);
    } catch (closeErr) {
      logger.warn(`Failed to close old browser for project ${session.projectName}`, { error: String(closeErr) });
    }
    
    // Асинхронно та неблокуюче вбиваємо старий процес браузера
    await killProcessTreeOnPort(session.cdpPort, session.projectName);
  }

  // Якщо браузер сесії вже активний і сторінка існує, змінюємо розмір вікна та повертаємо сторінку
  if (isSessionBrowserAlive(session) && session.page) {
    try {
      await resizeBrowserWindow(session, session.page, width, height);
    } catch (resizeErr) {
      logger.warn(`Failed to resize existing browser window for project ${session.projectName}`, { error: String(resizeErr) });
    }
    return session.page;
  }

  // Розбираємо облікові дані проксі заздалегідь — вони потрібні як для нових браузерів, так і для CDP-підключення до вже запущених
  let parsedProxyUser: string | undefined; // Логін проксі після парсингу рядка налаштувань
  let parsedProxyPass: string | undefined; // Пароль проксі після парсингу рядка налаштувань

  // Якщо рядок проксі не порожній — парсимо його для витягання облікових даних
  if (proxyServer && proxyServer.trim() !== '') {
    const rawProxy = proxyServer.trim(); // Очищаємо від зайвих пробілів

    // Спочатку перевіряємо: чи містить рядок протокол (http://, socks5://, тощо)
    // або символ @ (ознака URL-формату user:pass@host:port)
    // Якщо так — парсимо як URL, а НЕ через split(':')
    if (rawProxy.match(/^[a-zA-Z0-9]+:\/\//) || rawProxy.includes('@')) {
      // Формат URL: http://user:pass@ip:port або socks5://user:pass@ip:port
      try {
        // Якщо є @ але немає протоколу — додаємо http:// для коректного парсингу
        const urlStr = rawProxy.match(/^[a-zA-Z0-9]+:\/\//) ? rawProxy : `http://${rawProxy}`;
        const parsedUrl = new URL(urlStr); // Стандартний парсинг URL
        if (parsedUrl.username) parsedProxyUser = decodeURIComponent(parsedUrl.username); // Декодуємо логін
        if (parsedUrl.password) parsedProxyPass = decodeURIComponent(parsedUrl.password); // Декодуємо пароль
      } catch {
        // Якщо парсинг не вдався — залишаємо без облікових даних
      }
    } else {
      // Формат ip:port:user:pass — лише коли немає протоколу і символу @
      const parts = rawProxy.split(':'); // Розбиваємо за двокрапкою
      if (parts.length === 4) { // Рівно 4 частини: ip, port, user, pass
        parsedProxyUser = parts[2]; // Третя частина — логін
        parsedProxyPass = parts[3]; // Четверта частина — пароль
      }
      // Якщо лише 2 частини (ip:port) — проксі без авторизації, облікові дані не потрібні
    }
  }

  logger.debug(`Attempting CDP connection for project ${session.projectName} on port ${session.cdpPort}...`);
  // Пробуємо підключитися по CDP до поточного виділеного порту сесії
  // Передаємо облікові дані проксі щоб вже запущений браузер теж не питав пароль
  let cdpPage: Page | null = null;
  try {
    cdpPage = await connectOverCDP(session, session.cdpPort, parsedProxyUser, parsedProxyPass);
  } catch (cdpErr) {
    logger.debug(`CDP connection attempt failed for project ${session.projectName}`, { error: String(cdpErr) });
  }
  
  // Якщо підключились успішно
  if (cdpPage) {
    // Запам'ятовуємо запущений профіль
    session.currentlyRunningProfileDir = requestedProfileDir;
    // Змінюємо розмір вікна
    try {
      await resizeBrowserWindow(session, cdpPage, width, height);
    } catch (resizeErr) {
      logger.warn(`Failed to resize CDP-connected browser window for project ${session.projectName}`, { error: String(resizeErr) });
    }
    // Повертаємо сторінку
    return cdpPage;
  }

  logger.debug(`IT Browser not found for project ${session.projectName}. Attempting manual launch...`);
  
  // Перевіряємо наявність шляхів в .env
  if (!ITBROWSER_EXE || !USER_DATA) {
    throw new Error('❌ Шлях до ITBrowser або UserData не вказано в .env');
  }

  // Визначаємо унікальний вільний порт для віддаленого налагодження цього проекту через атомарний allocatePort
  let freePort: number;
  try {
    freePort = await allocatePort(session.cdpPort);
  } catch (portErr) {
    logger.error(`Failed to allocate port for project ${session.projectName}`, portErr instanceof Error ? portErr : new Error(String(portErr)));
    throw new Error(`Cannot allocate CDP port: ${portErr instanceof Error ? portErr.message : String(portErr)}`);
  }
  
  session.cdpPort = freePort;
  logger.info(`Allocated CDP port for project ${session.projectName}`, { port: session.cdpPort });

  // Функція для безпосереднього запуску контексту браузера через Playwright
  const launch = async () => {
    // Визначаємо активну директорію профілю
    const activeProfileDir = profileDir && profileDir.trim() !== '' ? profileDir : ITBROWSER_PROFILE_DIR;
    // Формуємо повний шлях до userData профілю
    const activeUserData = path.join(ITBROWSER_BASE_USERDATA, activeProfileDir);
    
    const extensionBaseDir = path.join(activeUserData, 'Default', 'Extensions', RONIN_EXTENSION_ID);
    let loadExtensionPath = '';
    if (fs.existsSync(extensionBaseDir)) {
      try {
        const versionDirs = fs.readdirSync(extensionBaseDir).filter(d => fs.statSync(path.join(extensionBaseDir, d)).isDirectory());
        if (versionDirs.length > 0) {
          loadExtensionPath = path.join(extensionBaseDir, versionDirs[0]);
        }
      } catch (e) {
        logger.error(`Failed to read extension directory for project ${session.projectName}`, e instanceof Error ? e : new Error(String(e)));
      }
    }

    // Формуємо масив аргументів для запуску Chromium
    const args = [
      // Вказуємо шлях до файлу фінгерпринту IT Browser
      `--itbrowser=${path.join(path.dirname(ITBROWSER_BASE_USERDATA), 'fingerprint', activeProfileDir + '.json')}`,
      // Передаємо виділений динамічний порт віддаленого налагодження
      `--remote-debugging-port=${session.cdpPort}`,
      // Дозволяємо підключення з будь-яких IP (щоб DevTools працював з інших пристроїв)
      '--remote-debugging-address=0.0.0.0',
      // Директорія профілю за замовчуванням
      '--profile-directory=Default',
      // Вимикаємо вікно першого запуску
      '--no-first-run',
      // Вимикаємо перевірку браузера за замовчуванням
      '--no-default-browser-check',
      // Вимикаємо прапорці автоматизації Blink
      '--disable-blink-features=AutomationControlled',
      // Задаємо розмір вікна
      `--window-size=${width},${height}`,
      // Примусово встановлюємо масштаб 100%, щоб ігнорувати масштабування Windows (125%, 150% тощо)
      '--force-device-scale-factor=1',
      // Дозволяємо підключення з будь-яких хостів для CDP
      '--remote-allow-origins=*',
      // Оптимізація пам'яті та фонових процесів Chromium
      '--mute-audio',
      '--disable-background-networking',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-ipc-flooding-protection',
      '--js-flags=--max-old-space-size=256'
    ];

    // Якщо увімкнено вимкнення картинок, вимикаємо Service Worker-и, 
    // щоб вони не віддавали закешовані картинки і всі запити йшли через наш route перехоплювач
    if (session.botSettings?.disableImages) {
      args.push('--disable-service-workers');
    }

    // Перевіряємо чи увімкнено невидимий режим в глобальному конфігу або в налаштуваннях бота
    const isHeadless = internalConfig.get('headless') === 1 || session.botSettings?.headless === true;
    if (isHeadless) {
      // Сучасний нативний безголовий режим Chromium (Chrome 109+), який підтримує всі антидетект-функції ITBrowser без відкриття вікон
      args.push('--headless=new');
    }

    // Якщо вимкнено завантаження картинок — блокуємо на рівні рушія Blink для максимальної економії пам'яті та CPU
    const disableImages = internalConfig.get('disableImages') === 1 || session.botSettings?.disableImages === true;
    if (disableImages) {
      args.push('--blink-settings=imagesEnabled=false');
    }

    // Об'єкт конфігурації проксі для Playwright, який дозволить автоматично авторизуватися без спливаючих вікон
    let proxyConfig: { server: string; username?: string; password?: string } | undefined = undefined; // За замовчуванням проксі немає

    // Якщо налаштовано проксі-сервер для проекту та рядок не є порожнім
    if (proxyServer && proxyServer.trim() !== '') { // Перевіряємо наявність проксі
      const trimmedProxy = proxyServer.trim(); // Очищаємо проксі від зайвих пробілів

      // Спочатку перевіряємо: чи є протокол або @ — ознаки URL-формату
      // Якщо так, парсимо як URL (щоб уникнути помилки split(':') для http://user:pass@host:port)
      if (trimmedProxy.match(/^[a-zA-Z0-9]+:\/\//) || trimmedProxy.includes('@')) {
        // Формат URL: http://user:pass@ip:port або socks5://user:pass@ip:port
        try { // Спроба розпарсити як URL
          // Якщо є @ але немає протоколу — додаємо http:// для коректного парсингу
          const urlStr = trimmedProxy.match(/^[a-zA-Z0-9]+:\/\//) ? trimmedProxy : `http://${trimmedProxy}`;
          const url = new URL(urlStr); // Парсимо за допомогою стандартного класу URL
          proxyConfig = { // Створюємо об'єкт конфігурації Playwright
            server: `${url.protocol}//${url.host}` // Сервер: протокол + хост:порт
          };
          if (url.username) { // Якщо знайдено логін у URL
            proxyConfig.username = decodeURIComponent(url.username); // Декодуємо та записуємо
          }
          if (url.password) { // Якщо знайдено пароль у URL
            proxyConfig.password = decodeURIComponent(url.password); // Декодуємо та записуємо
          }
        } catch (e) { // Якщо URL некоректний
          proxyConfig = { // Простий об'єкт без авторизації
            server: trimmedProxy.startsWith('http') ? trimmedProxy : `http://${trimmedProxy}`
          };
        }
      } else {
        // Формат ip:port:user:pass — лише коли немає протоколу і символу @
        const proxyParts = trimmedProxy.split(':'); // Розділяємо рядок за двокрапкою
        if (proxyParts.length === 4) { // Рівно 4 частини: ip, port, user, pass
          const [ip, port, user, pass] = proxyParts; // Розпаковуємо значення
          proxyConfig = { // Формуємо об'єкт проксі для Playwright
            server: `http://${ip}:${port}`, // Сервер проксі
            username: user, // Логін
            password: pass // Пароль
          };
        } else if (proxyParts.length === 2) { // Формат ip:port (без авторизації)
          proxyConfig = {
            server: `http://${trimmedProxy}` // Проксі без авторизації
          };
        }
        // Інакше — ігноруємо невалідний формат
      } // Кінець розгалуження форматів
      
      logger.debug(`Project ${session.projectName} using proxy`, { server: proxyConfig?.server || 'unknown', hasAuth: !!proxyConfig?.username });
    } // Кінець перевірки проксі

    if (loadExtensionPath) {
      args.push(`--disable-extensions-except=${loadExtensionPath}`);
      args.push(`--load-extension=${loadExtensionPath}`);
    }

    // Запускаємо стійкий контекст Playwright з усіма налаштуваннями
    return await chromium.launchPersistentContext(activeUserData, { // Запускаємо браузер із профілем
      executablePath: ITBROWSER_EXE, // Шлях до виконуваного файлу IT Browser
      headless: false, // ITBrowser антидетект крашиться від нативного Playwright --headless, невидимість забезпечується через --window-position=-32000,-32000
      viewport: null, // Дозволяємо браузеру самостійно визначати розмір вікна
      ignoreDefaultArgs: ['--enable-automation', '--disable-extensions'], // Видаляємо повідомлення про автоматизацію і дозволяємо розширення
      args, // Передаємо додаткові аргументи Chromium (включаючи зміщення вікна за екран для невидимого режиму)
      proxy: proxyConfig // Передаємо об'єкт проксі для авто-авторизації без спливаючих вікон
    }); // Повертаємо запущений контекст
  };

  // Визначаємо активну директорію профілю для формування шляху блокування
  const activeProfileDir = profileDir && profileDir.trim() !== '' ? profileDir : ITBROWSER_PROFILE_DIR;
  const activeUserData = path.join(ITBROWSER_BASE_USERDATA, activeProfileDir);

  try {
    // Спроба запустити браузер
    session.context = await launch();
    
    // Підключаємо фоновий перехоплювач мережі на рівні контексту (для API ноди)
    attachNetworkInterception(session);
    
    // Якщо увімкнено економію трафіку (вимкнення картинок)
    if (session.botSettings?.disableImages) {
      // 1. Приховуємо картинки, які вшиті прямо в код сайту (data:image)
      // Вони не витрачають трафік, але щоб візуально їх теж не було і розмір був 25x25
      try {
        await session.context.addInitScript(() => {
          document.addEventListener('DOMContentLoaded', () => {
            const style = document.createElement('style');
            // Використовуємо CSS content для підміни вбудованих картинок на прозорий SVG 25x25
            style.textContent = `img[src^="data:image"] { content: url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2225%22%20height%3D%2225%22%3E%3C%2Fsvg%3E') !important; }`;
            document.head.appendChild(style);
          });
        });
      } catch (initScriptErr) {
        logger.warn(`Failed to add init script for image hiding for project ${session.projectName}`, { error: String(initScriptErr) });
      }

      // 2. Використовуємо перехоплення мережевих запитів для зовнішніх картинок
      // Це дозволяє подіям onload спрацьовувати і не ламає DOM селектори
      try {
        await session.context.route('**/*', (route) => {
          try {
            const req = route.request();
            const url = req.url().toLowerCase();
            // Перевіряємо, чи це зображення за типом ресурсу АБО за розширенням файлу
            // Оскільки ігри (PixiJS/Phaser) часто вантажать картинки через fetch/xhr
            const isImage = req.resourceType() === 'image' || url.match(/\.(png|jpe?g|gif|webp|svg|bmp)(\?.*)?$/i);

            if (isImage) {
              // Віддаємо браузеру прозорий SVG фіксованого розміру 25x25
              route.fulfill({
                status: 200,
                contentType: 'image/svg+xml',
                body: '<svg xmlns="http://www.w3.org/2000/svg" width="25" height="25"></svg>'
              }).catch(fulfillErr => {
                logger.debug(`Failed to fulfill image route for project ${session.projectName}`, { error: String(fulfillErr) });
              });
            } else {
              route.continue().catch(continueErr => {
                logger.debug(`Failed to continue route for project ${session.projectName}`, { error: String(continueErr) });
              });
            }
          } catch (routeErr) {
            logger.debug(`Error in route handler for project ${session.projectName}`, { error: String(routeErr) });
            // Спробуємо продовжити запит навіть при помилці
            route.continue().catch(() => {});
          }
        });
      } catch (routeErr) {
        logger.warn(`Failed to set up image blocking route for project ${session.projectName}`, { error: String(routeErr) });
      }
    }

    // Отримуємо об'єкт браузера
    session.browser = session.context.browser() as any;

    const isHeadless = internalConfig.get('headless') === 1 || session.botSettings?.headless === true;
    if (isHeadless) {
      logger.info(`Hiding taskbar window for project ${session.projectName} (CDP Port ${session.cdpPort})`);
      hideProcessWindowByPort(session.cdpPort);
    }

    logger.info(`Profile ${activeProfileDir} launched successfully for project ${session.projectName}`, { port: session.cdpPort });
    // Зберігаємо поточний запущений профіль
    session.currentlyRunningProfileDir = requestedProfileDir;
  } catch (err: any) {
    // Якщо виникла помилка блокування профілю
    if (err.message.includes('user-data-dir') || err.message.includes('locked')) {
      // Намагаємось видалити файл блокування SingletonLock
      const lockFile = path.join(activeUserData, 'SingletonLock');
      try {
         if (fs.existsSync(lockFile)) {
           fs.unlinkSync(lockFile);
           logger.info(`Removed SingletonLock for profile ${activeProfileDir}`);
         }
      } catch (lockErr) {
        logger.warn(`Failed to remove SingletonLock for profile ${activeProfileDir}`, { error: String(lockErr) });
      }
    }
    // Логуємо помилку запуску браузера
    logger.error(`Failed to launch browser for project ${session.projectName}`, err instanceof Error ? err : new Error(String(err)));
    // Прокидаємо помилку далі
    throw err;
  }

  // Отримуємо всі відкриті сторінки контексту
  const pages = session.context.pages();
  // Шукаємо сторінку гри
  let gamePage = pages.find(p => p.url().includes('sunflower-land'));
  
  // Якщо сторінку гри не знайдено
  if (!gamePage) {
    // Створюємо нову сторінку або беремо першу відкриту
    try {
      gamePage = pages.length > 0 ? pages[0] : await session.context.newPage();
    } catch (pageErr) {
      logger.error(`Failed to create new page for project ${session.projectName}`, pageErr instanceof Error ? pageErr : new Error(String(pageErr)));
      throw pageErr;
    }
    // Якщо сторінка порожня, переходимо на офіційний сайт гри Sunflower Land
    if (gamePage.url() === 'about:blank') {
      try {
        await gamePage.goto('https://sunflower-land.com/play/#/', { waitUntil: 'networkidle' });
      } catch (gotoErr) {
        logger.warn(`Failed to navigate to Sunflower Land for project ${session.projectName}`, { error: String(gotoErr) });
        // Продовжуємо роботу навіть якщо навігація не вдалася
      }
    }
  }
  
  // Зберігаємо сторінку гри у сесії
  session.page = gamePage;
  // Змінюємо розмір вікна сторінки
  try {
    await resizeBrowserWindow(session, session.page, width, height);
  } catch (resizeErr) {
    logger.warn(`Failed to resize browser window for project ${session.projectName}`, { error: String(resizeErr) });
    // Продовжуємо роботу навіть якщо зміна розміру не вдалася
  }
  
  // Додаємо обробники для виводу логів браузера в консоль сервера
  try {
    session.page.on('console', msg => logger.debug(`[BROWSER-${session.projectName}] ${msg.text()}`));
    session.page.on('pageerror', err => logger.error(`[BROWSER-${session.projectName}] Page error`, err instanceof Error ? err : new Error(String(err))));
  } catch (handlerErr) {
    logger.warn(`Failed to attach page event handlers for project ${session.projectName}`, { error: String(handlerErr) });
  }

  // Виводимо сторінку на передній план
  try {
    await session.page.bringToFront();
  } catch (bringErr) {
    logger.debug(`Failed to bring page to front for project ${session.projectName}`, { error: String(bringErr) });
    // Не критична помилка, продовжуємо
  }
  
  // Повертаємо активну сторінку
  return session.page;
}

// Функція для ін'єкції скрипту вибору елементів (пікера) на сторінку
export async function injectPicker(session: ProjectSession, targetPage: Page, nodeId: string, pickType: string | undefined) {
  logger.debug(`Injecting picker for project ${session.projectName}, node ${nodeId}`);
  
  // Перевіряємо чи функція надсилання результату вже зареєстрована
  let alreadyExposed = false;
  try {
    alreadyExposed = await targetPage.evaluate(() => typeof (window as any).__sendSelectorInfo === 'function');
  } catch (evalErr) {
    logger.error(`Failed to check if selector function is exposed for project ${session.projectName}`, evalErr instanceof Error ? evalErr : new Error(String(evalErr)));
    return; // Не можемо продовжити без можливості перевірки
  }
  
  // Якщо не зареєстрована, реєструємо її
  if (!alreadyExposed) {
    try {
      await targetPage.exposeFunction('__sendSelectorInfo', (data: any) => {
        // Надсилаємо дані селектора через WebSocket сесії проекту
        if (session.activeWs && session.activeWs.readyState === 1) {
          try {
            session.activeWs.send(JSON.stringify({ type: 'SELECTOR_INFO_PICKED', ...data }));
          } catch (sendErr) {
            logger.error(`Failed to send selector info via WebSocket for project ${session.projectName}`, sendErr instanceof Error ? sendErr : new Error(String(sendErr)));
          }
        }
      });
    } catch (exposeErr) {
      logger.error(`Failed to expose selector info function for project ${session.projectName}`, exposeErr instanceof Error ? exposeErr : new Error(String(exposeErr)));
      return; // Не можемо продовжити без експонованої функції
    }
  }

  // Текст скрипту пікера
  const pickerScript = `
    (function(nId, pType) {
      console.log('🚀 [BROWSER]: Пікер стартував у фреймі:', window.location.href);
      if (window.__pickerCleanup) window.__pickerCleanup();

      function genSel(el) {
        let smart = "";
        const img = el.tagName === 'IMG' ? el : el.querySelector('img');
        if (img && img.src && !img.src.startsWith('data:')) {
          const fileName = img.src.split('/').pop().split('?')[0];
          if (fileName && fileName.length > 3) {
            smart = 'img[src*="' + fileName + '"]';
            if (el.tagName !== 'IMG') {
              const directParent = img.parentElement;
              if (directParent && directParent.tagName !== 'BODY') {
                smart = directParent.tagName.toLowerCase() + ':has(> ' + smart + ')';
              }
            }
          }
        }
        if (!smart && el.innerText && el.innerText.trim().length > 0 && el.innerText.trim().length < 40) {
          smart = el.tagName.toLowerCase() + ':has-text("' + el.innerText.trim().replace(/["']/g, "") + '")';
        }
        
        const getStd = (curr) => {
          if (curr.id) return '#' + curr.id;
          let path = [], d = 0;
          while (curr && curr.tagName && curr.tagName !== 'BODY' && d < 5) {
            let p = curr.tagName.toLowerCase();
            if (curr.id) { p += '#' + curr.id; path.unshift(p); break; }
            const par = curr.parentElement;
            if (par) {
              const sib = Array.from(par.children).filter(c => c.tagName === curr.tagName);
              if (sib.length > 1) p += ':nth-of-type(' + (sib.indexOf(curr) + 1) + ')';
            }
            path.unshift(p); curr = curr.parentElement; d++;
          }
          return path.join(' > ');
        };
        return { standard: getStd(el), smart: smart };
      }

      const styles = document.createElement('style');
      styles.id = '__sf_styles';
      styles.textContent = \`
        .__sf_highlight { position: fixed; pointer-events: none; z-index: 2147483647; border: 2px solid #00ffcc; background: rgba(0, 255, 204, 0.1); border-radius: 4px; box-shadow: 0 0 15px #00ffcc; transition: all 0.1s; }
        .__sf_info { position: fixed; background: #1a1a1a; color: #fff; padding: 12px; border-radius: 8px; border: 1px solid #333; z-index: 2147483647; pointer-events: none; font: 12px sans-serif; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
        .__sf_menu { position: fixed; background: #2a2a2a; color: #fff; padding: 8px; border-radius: 8px; border: 1px solid #444; z-index: 2147483647; box-shadow: 0 10px 40px rgba(0,0,0,0.8); min-width: 220px; max-height: 400px; overflow-y: auto; scrollbar-width: thin; scrollbar-color: #444 #2a2a2a; }
        .__sf_menu::-webkit-scrollbar { width: 6px; }
        .__sf_menu::-webkit-scrollbar-thumb { background: #444; border-radius: 3px; }
        .__sf_menu_item { padding: 8px 12px; cursor: pointer; border-radius: 4px; display: flex; justify-content: space-between; font: 11px sans-serif; transition: background 0.2s; }
        .__sf_menu_item:hover { background: #00ffcc; color: #000; }
      \`;
      document.head.appendChild(styles);

      const box = document.createElement('div'); box.className = '__sf_highlight';
      const info = document.createElement('div'); info.className = '__sf_info';
      const menu = document.createElement('div'); menu.className = '__sf_menu'; menu.style.display = 'none';
      document.body.appendChild(box); document.body.appendChild(info); document.body.appendChild(menu);

      let last = null; let locked = false;

      function onMove(e) {
        if (locked) return;
        const el = document.elementFromPoint(e.clientX, e.clientY);
        if (!el || el.closest('.__sf_highlight, .__sf_info, .__sf_menu')) return;
        if (el === last) return;
        last = el;
        const r = el.getBoundingClientRect();
        box.style.display = 'block'; box.style.top = r.top + 'px'; box.style.left = r.left + 'px'; box.style.width = r.width + 'px'; box.style.height = r.height + 'px';
        info.style.display = 'block';
        info.style.top = (r.bottom + 10 > window.innerHeight ? r.top - 100 : r.bottom + 10) + 'px';
        info.style.left = r.left + 'px';
        info.innerHTML = '<b>' + el.tagName.toLowerCase() + '</b><br><span style="color:#00ffcc;font-size:10px;">Ctrl+Click: Pick | Shift+Click: Hierarchy</span>';
      }

      function onClick(e) {
        const el = document.elementFromPoint(e.clientX, e.clientY);
        if (el && el.closest('.__sf_menu')) return;
        if (e.ctrlKey || e.shiftKey) {
          e.preventDefault(); e.stopPropagation();
          if (!el) return;
          const sels = genSel(el);
          if (e.ctrlKey) {
            if (sels.smart) {
              locked = true; menu.style.display = 'block'; menu.style.top = e.clientY + 'px'; menu.style.left = e.clientX + 'px';
              menu.innerHTML = '<div class="__sf_menu_item" id="s">✨ Smart</div><div class="__sf_menu_item" id="t">⚙️ Standard</div>';
              menu.querySelector('#s').onclick = () => send(el, sels.smart);
              menu.querySelector('#t').onclick = () => send(el, sels.standard);
            } else send(el, sels.standard);
          } else {
            showHierarchy(el, e.clientX, e.clientY);
          }
        }
      }

      function showHierarchy(targetEl, x, y) {
        locked = true; menu.style.display = 'block';
        menu.style.top = Math.min(y, window.innerHeight - 450) + 'px';
        menu.style.left = Math.min(x, window.innerWidth - 280) + 'px';
        
        function render(curr) {
          menu.innerHTML = '<div style="padding:8px;font-weight:bold;color:#00ffcc;border-bottom:1px solid #444;margin-bottom:6px;font-size:11px;background:#1a1a1a;display:flex;justify-content:space-between;align-items:center;">' +
            '<span>Інспектор: ' + curr.tagName.toLowerCase() + '</span>' +
            '<button id="__close" style="background:none;border:none;color:#ff4444;cursor:pointer;font-weight:bold;">✕</button>' +
            '</div>';
          
          menu.querySelector('#__close').onclick = cleanup;

          const parents = [];
          let p = curr.parentElement;
          while(p && p.tagName !== "HTML" && parents.length < 3) {
            parents.unshift(p); p = p.parentElement;
          }

          const children = Array.from(curr.children);

          const list = [
            ...parents.map(it => ({el: it, type: 'parent'})),
            {el: curr, type: 'target'},
            ...children.map(it => ({el: it, type: 'child'}))
          ];

          list.forEach(item => {
            const t = item.el;
            const row = document.createElement('div');
            row.className = '__sf_menu_item';
            row.style.display = 'flex'; row.style.justifyContent = 'space-between'; row.style.alignItems = 'center';
            
            if (item.type === 'target') {
              row.style.background = 'rgba(0, 255, 204, 0.1)';
              row.style.borderLeft = '4px solid #00ffcc';
            }
            
            const icon = item.type === 'target' ? '🎯 ' : (item.type === 'parent' ? '↑ ' : '↳ ');
            const info = t.id ? '#' + t.id : (t.className && typeof t.className === 'string' ? '.' + t.className.split(' ')[0].substring(0,8) : '');
            
            row.innerHTML = '<div class="__nav" style="flex:1;cursor:pointer;">' + icon + t.tagName.toLowerCase() + ' <small style="opacity:0.5">' + info + '</small></div>' +
                            '<button class="__pick" style="background:#00ffcc;border:none;border-radius:3px;color:#000;padding:2px 6px;font-size:9px;font-weight:bold;cursor:pointer;margin-left:8px;">OK</button>';
            
            row.onmouseenter = () => {
              const r = t.getBoundingClientRect();
              box.style.display = 'block';
              box.style.top = r.top + 'px'; box.style.left = r.left + 'px';
              box.style.width = r.width + 'px'; box.style.height = r.height + 'px';
              box.style.border = (item.type === 'target' ? '2px solid #00ffcc' : '2px dashed #00ffcc');
            };

            row.querySelector('.__nav').onclick = (ev) => {
              ev.stopPropagation();
              render(t);
            };

            row.querySelector('.__pick').onclick = (ev) => {
              ev.stopPropagation();
              const sels = genSel(t);
              if (sels.smart) {
                menu.innerHTML =
                  '<div style="padding:8px;font-weight:bold;color:#00ffcc;border-bottom:1px solid #444;margin-bottom:6px;font-size:11px;background:#1a1a1a;">' +
                    'Тип селектора' +
                  '</div>' +
                  '<div class="__sf_menu_item" id="__ms">✨ Smart</div>' +
                  '<div class="__sf_menu_item" id="__mt">⚙️ Standard</div>';
                menu.querySelector('#__ms').onclick = () => send(t, sels.smart);
                menu.querySelector('#__mt').onclick = () => send(t, sels.standard);
              } else {
                send(t, sels.standard);
              }
            };
            
            menu.appendChild(row);
          });
        }
        render(targetEl);
      }

      function onKey(e) {
        if (e.key === 'Escape') cleanup();
      }

      function send(el, sel) {
        const r = el.getBoundingClientRect();
        const data = { nodeId: nId, pickType: pType, selector: sel, text: el.innerText?.substring(0,50), x: Math.round(r.left + window.scrollX + r.width/2), y: Math.round(r.top + window.scrollY + r.height/2) };
        cleanup();
        if (window.__sendSelectorInfo) window.__sendSelectorInfo(data);
      }

      function cleanup() {
        document.removeEventListener('mousemove', onMove, true);
        document.removeEventListener('click', onClick, true);
        document.removeEventListener('keydown', onKey, true);
        [box, info, menu, styles].forEach(it => it && it.remove());
        window.__pickerCleanup = null;
      }
      window.__pickerCleanup = cleanup;
      document.addEventListener('mousemove', onMove, true);
      document.addEventListener('click', onClick, true);
      document.addEventListener('keydown', onKey, true);
    })(${JSON.stringify(nodeId)}, ${JSON.stringify(pickType)});
  `;

  // Запускаємо скрипт пікера у всіх фреймах сторінки
  for (const frame of targetPage.frames()) {
    try {
      await frame.evaluate(pickerScript).catch((err) => {
        logger.debug(`Picker script evaluation failed in frame for project ${session.projectName}`, { error: String(err) });
      });
    } catch (err) {
      logger.debug(`Failed to inject picker in frame for project ${session.projectName}`, { error: String(err) });
    }
  }
}

// Функція для створення дебаг-скріншоту конкретної сесії проекту
export async function takeDebugSnapshot(session: ProjectSession, nodeId: string, nodeTitle: string, highlight?: any) {
  // Якщо браузер не живий або фотодебаг вимкнений, виходимо
  if (!isSessionBrowserAlive(session) || !session.page || !session.photoDebugEnabled) return;
  try {
    // Створюємо папку для скріншотів, якщо вона не існує
    const imagesDir = path.join(__dirname, '../images/debug');
    try {
      if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir, { recursive: true });
      }
    } catch (mkdirErr) {
      logger.error(`Failed to create images directory for project ${session.projectName}`, mkdirErr instanceof Error ? mkdirErr : new Error(String(mkdirErr)));
      return; // Не можемо продовжити без папки
    }

    // Автоочистка старих debug-файлів
    const oneHourAgo = Date.now() - 3_600_000;
    try {
      const files = fs.readdirSync(imagesDir);
      files
        .filter(f => f.startsWith('debug_') && f.endsWith('.png'))
        .forEach(f => {
          try {
            const filePath = path.join(imagesDir, f);
            const stats = fs.statSync(filePath);
            if (stats.mtimeMs < oneHourAgo) {
              fs.unlinkSync(filePath);
            }
          } catch (fileErr) {
            logger.debug(`Failed to clean up debug image ${f}`, { error: String(fileErr) });
          }
        });
    } catch (cleanupErr) {
      logger.warn(`Failed to clean up old debug images for project ${session.projectName}`, { error: String(cleanupErr) });
    }

    // Формуємо назву файлу (додано projectName для фільтрації)
    const sanitizedProjectName = session.projectName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `debug_${sanitizedProjectName}_node_${nodeId}_${Date.now()}.png`;
    const filePath = path.join(imagesDir, fileName);

    // Додаємо підсвітку та лейбл на сторінку
    try {
      await session.page.evaluate(({ h, title }) => {
        document.getElementById('__debug_highlight')?.remove();
        document.getElementById('__debug_label')?.remove();

        const container = document.createElement('div');
        container.id = '__debug_highlight';
        const s = container.style;
        s.setProperty('position', 'fixed', 'important');
        s.setProperty('z-index', '2147483647', 'important');
        s.setProperty('pointer-events', 'none', 'important');
        s.setProperty('display', 'block', 'important');

        let foundRect: DOMRect | null = null;
        let foundEl: Element | null = null;

        if (h) {
          if (h.selector) {
            // 1. Спробуємо стандартний querySelector
            try {
              foundEl = document.querySelector(h.selector);
            } catch {
              foundEl = null;
            }

            // 2. Якщо це img[src*="..."], шукаємо серед усіх <img> за підрядком
            if (!foundEl && typeof h.selector === 'string' && h.selector.includes('img[')) {
              const srcMatch = h.selector.match(/src\*=["']?([^"']+)["']?/);
              if (srcMatch && srcMatch[1]) {
                const searchStr = srcMatch[1].toLowerCase();
                const allImgs = Array.from(document.querySelectorAll('img'));
                foundEl = allImgs.find(img => img.src && img.src.toLowerCase().includes(searchStr)) || null;
              }
            }

            // 3. Якщо селектор містить просто зображення або частину імені
            if (!foundEl && typeof h.selector === 'string') {
              const searchStr = h.selector.replace(/['"[\]]/g, '').toLowerCase();
              const allImgs = Array.from(document.querySelectorAll('img'));
              foundEl = allImgs.find(img => img.src && img.src.toLowerCase().includes(searchStr)) || null;
            }

            // 4. Отримуємо rect і якщо розмір 0, беремо батьківський елемент
            if (foundEl) {
              let r = foundEl.getBoundingClientRect();
              if ((r.width === 0 || r.height === 0) && foundEl.parentElement) {
                r = foundEl.parentElement.getBoundingClientRect();
              }
              foundRect = r;
            }
          }

          if (foundRect && (foundRect.width > 0 || foundRect.height > 0)) {
            s.setProperty('border', '4px solid #ef4444', 'important');
            s.setProperty('background', 'rgba(239, 68, 68, 0.45)', 'important');
            s.setProperty('box-shadow', '0 0 25px rgba(239, 68, 68, 0.95), inset 0 0 15px rgba(239, 68, 68, 0.5)', 'important');
            s.setProperty('left', (foundRect.left - 3) + 'px', 'important');
            s.setProperty('top', (foundRect.top - 3) + 'px', 'important');
            s.setProperty('width', (foundRect.width + 6) + 'px', 'important');
            s.setProperty('height', (foundRect.height + 6) + 'px', 'important');
            s.setProperty('border-radius', '6px', 'important');
            document.body.appendChild(container);
          } else if (h.x !== undefined && h.y !== undefined) {
            const vX = h.x - window.scrollX;
            const vY = h.y - window.scrollY;
            s.setProperty('width', '30px', 'important');
            s.setProperty('height', '30px', 'important');
            s.setProperty('background', 'rgba(239, 68, 68, 0.85)', 'important');
            s.setProperty('border', '3px solid white', 'important');
            s.setProperty('border-radius', '50%', 'important');
            s.setProperty('left', (vX - 15) + 'px', 'important');
            s.setProperty('top', (vY - 15) + 'px', 'important');
            s.setProperty('box-shadow', '0 0 20px #ef4444, 0 0 10px rgba(0,0,0,0.8)', 'important');
            document.body.appendChild(container);
          }
        }

        const label = document.createElement('div');
        label.id = '__debug_label';
        label.innerText = `🤖 [${title || 'Нода'}]${h?.selector ? ` 🎯 ${h.selector}` : ''}`;
        const ls = label.style;
        ls.setProperty('position', 'fixed', 'important');
        ls.setProperty('z-index', '2147483647', 'important');
        ls.setProperty('left', '10px', 'important');
        ls.setProperty('top', '10px', 'important');
        ls.setProperty('background', '#ef4444', 'important');
        ls.setProperty('color', 'white', 'important');
        ls.setProperty('padding', '6px 14px', 'important');
        ls.setProperty('font-size', '16px', 'important');
        ls.setProperty('font-weight', '900', 'important');
        ls.setProperty('border-radius', '8px', 'important');
        ls.setProperty('white-space', 'nowrap', 'important');
        ls.setProperty('box-shadow', '0 4px 20px rgba(0,0,0,0.6)', 'important');
        ls.setProperty('border', '2px solid white', 'important');
        ls.setProperty('pointer-events', 'none', 'important');
        ls.setProperty('font-family', 'system-ui, -apple-system, sans-serif', 'important');
        
        document.body.appendChild(label);
      }, { h: highlight, title: nodeTitle });
    } catch (evalErr) {
      logger.warn(`Failed to inject debug highlight for project ${session.projectName}`, { error: String(evalErr) });
      // Продовжуємо зі скріншотом навіть без підсвітки
    }

    // Робимо знімок сторінки
    try {
      await session.page.screenshot({ path: filePath });
    } catch (screenshotErr) {
      logger.error(`Failed to take screenshot for project ${session.projectName}`, screenshotErr instanceof Error ? screenshotErr : new Error(String(screenshotErr)));
      return; // Не можемо продовжити без скріншоту
    }

    // Очищаємо підсвітку та лейбл
    try {
      await session.page.evaluate(() => {
        document.getElementById('__debug_highlight')?.remove();
        document.getElementById('__debug_label')?.remove();
      });
    } catch (cleanupEvalErr) {
      logger.debug(`Failed to cleanup debug elements for project ${session.projectName}`, { error: String(cleanupEvalErr) });
    }

    logger.info(`Debug screenshot saved for project ${session.projectName}`, { fileName, nodeId, nodeTitle });

    // Відправляємо скріншот на клієнт через WebSocket цієї сесії
    if (session.activeWs && session.activeWs.readyState === 1) {
      try {
        session.activeWs.send(JSON.stringify({ // Відправка JSON-повідомлення через WebSocket
          type: 'DEBUG_SNAPSHOT', // Встановлення типу повідомлення DEBUG_SNAPSHOT
          nodeId, // Передача ідентифікатора поточної ноди
          nodeTitle, // Передача назви поточної ноди
          // Встановлюємо шлях з підпапкою debug, оскільки Express обслуговує всю папку images
          image: `/api/images/debug/${fileName}`, // Формування шляху до зображення з урахуванням підкаталогу debug
          timestamp: Date.now() // Передача мітки часу створення скріншоту
        })); // Кінець відправки повідомлення
      } catch (sendErr) {
        logger.warn(`Failed to send debug snapshot via WebSocket for project ${session.projectName}`, { error: String(sendErr) });
      }
    }
  } catch (e) {
    logger.error(`Debug snapshot error for project ${session.projectName}`, e instanceof Error ? e : new Error(String(e)), { nodeId, nodeTitle });
  }
}
