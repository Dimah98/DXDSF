import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { chromium, Browser, Page, BrowserContext } from 'playwright';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Завантаження секретів
dotenv.config();

import { Telegraf, Markup } from 'telegraf';

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/images', express.static(path.join(__dirname, '../images')));

// Конфігурація Telegram Бота
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const bot = new Telegraf(BOT_TOKEN);

// Динамічний URL для Mini App
let MINI_APP_URL = 'https://bot.dxdiven.com'; 
const urlFilePath = path.join(__dirname, '../current_url.txt');

const updateUrl = () => {
  if (fs.existsSync(urlFilePath)) {
    MINI_APP_URL = fs.readFileSync(urlFilePath, 'utf8').trim();
    console.log(`📡 MINI_APP_URL оновлено: ${MINI_APP_URL}`);
  }
};

updateUrl();
fs.watchFile(urlFilePath, updateUrl);

bot.start((ctx) => {
  ctx.reply('🌻 Вітаємо у Sunflower Land Bot Constructor!', Markup.keyboard([
    [Markup.button.webApp('Відкрити Конструктор', MINI_APP_URL)]
  ]).resize());
});

bot.launch().then(() => console.log('🤖 Telegram Bot запущено!'));

const PROJECTS_DIR = path.join(__dirname, '../projects');
if (!fs.existsSync(PROJECTS_DIR)) fs.mkdirSync(PROJECTS_DIR);

const SAVE_PATH = path.join(__dirname, '../save.json');

// Отримання списку проектів
app.get('/api/projects', (req, res) => {
  try {
    const files = fs.readdirSync(PROJECTS_DIR).filter(f => f.endsWith('.json'));
    const projects = files.map(f => f.replace('.json', ''));
    res.json(projects);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Збереження проекту (за назвою або дефолт)
app.post('/api/save', (req, res) => {
  try {
    const { name = 'default', data } = req.body;
    const projectPath = path.join(PROJECTS_DIR, `${name}.json`);
    fs.writeFileSync(projectPath, JSON.stringify(data, null, 2));
    // Також оновлюємо основний save.json для сумісності
    fs.writeFileSync(SAVE_PATH, JSON.stringify(data, null, 2));
    res.json({ success: true, name });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Завантаження конкретного проекту
app.get('/api/load', (req, res) => {
  try {
    const name = req.query.name as string || 'default';
    const projectPath = path.join(PROJECTS_DIR, `${name}.json`);
    
    let pathToRead = projectPath;
    if (!fs.existsSync(projectPath)) {
      if (fs.existsSync(SAVE_PATH)) pathToRead = SAVE_PATH;
      else return res.json({ nodes: [], edges: [] });
    }

    const data = fs.readFileSync(pathToRead, 'utf-8');
    res.json(JSON.parse(data));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Видалення проекту
app.delete('/api/projects/:name', (req, res) => {
  try {
    const projectPath = path.join(PROJECTS_DIR, `${req.params.name}.json`);
    if (fs.existsSync(projectPath)) {
      fs.unlinkSync(projectPath);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Проект не знайдено' });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Отримання списку картинок
app.get('/api/images', (req, res) => {
  try {
    const imagesDir = path.join(__dirname, '../images');
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir);
      return res.json([]);
    }
    const files = fs.readdirSync(imagesDir).filter(f => f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg'));
    res.json(files);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

const HTTP_PORT = 3001;
const WS_PORT = 3002;

// Стан Playwright — всі обнуляються при закритті браузера
let browser: Browser | null = null;
let context: BrowserContext | null = null;
let page: Page | null = null;

// Глобальне посилання на активне WS з'єднання для пікера
let activeWs: WebSocket | null = null;

// Перевірка чи браузер та сторінка живі
function isBrowserAlive(): boolean {
  try {
    if (!browser || !context || !page) return false;
    if (!browser.isConnected()) return false;
    // Перевіряємо чи сторінка ще відкрита (не закрита користувачем)
    const pages = context.pages();
    return pages.length > 0;
  } catch {
    return false;
  }
}

// Скидаємо стан після закриття
function resetBrowserState() {
  browser = null;
  context = null;
  page = null;
  console.log('Стан браузера скинуто — буде перезапущено при наступному запиті.');
}

// Точні шляхи до ITBrowser та профілю Dimah
const CHROME_EXE = 'D:\\VideoM\\TelegramVideoEditor\\itbrowser\\Chrome-bin\\chrome.exe';
const USER_DATA = 'C:\\Users\\Dima\\itbrowser\\userData\\20260506212424';
const DIMAH_PROFILE = 'C:\\Users\\Dima\\itbrowser\\fingerprint\\20260506212424.json';

async function connectToBrowser(): Promise<Page> {
  // Перевіряємо, чи браузер ще живий
  if (browser) {
    try {
      await browser.version(); // Швидка перевірка зв'язку
    } catch {
      console.log('Браузер було закрито, скидаємо стан...');
      browser = null;
      context = null;
      page = null;
    }
  }

  // 1. Спочатку пробуємо підключитися до вже запущеного (CDP)
  if (!browser) {
    try {
      browser = await chromium.connectOverCDP('http://localhost:9222');
      console.log('Підключено до існуючого ITBrowser через CDP');
    } catch {
      console.log('Запуск профілю Dimah...');
      
      try {
        // Використовуємо launchPersistentContext для роботи з існуючими даними користувача
        context = await chromium.launchPersistentContext(USER_DATA, {
          executablePath: CHROME_EXE,
          headless: false,
          args: [
            `--itbrowser=${DIMAH_PROFILE}`,
            '--remote-debugging-port=9222',
            '--profile-directory=20260506212424',
            '--no-first-run',
            '--no-default-browser-check',
            '--disable-blink-features=AutomationControlled'
          ]
        });
        browser = context.browser() as any; // Отримуємо посилання на браузер
        console.log('Профіль Dimah успішно запустився!');
      } catch (err: any) {
        throw new Error(`Не вдалося запустити браузер: ${err.message}`);
      }
    }
  }

  // Налаштовуємо контекст та сторінку
  if (!context) {
    if (!browser) throw new Error("Браузер не ініціалізовано");
    const contexts = browser.contexts();
    context = contexts[0] || await browser.newContext();
  }
  
  // Додаємо Stealth-скрипт для обходу детекції ботів
  await context.addInitScript(() => {
    // Видаляємо navigator.webdriver
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    
    // Підміняємо плагіни
    Object.defineProperty(navigator, 'languages', { get: () => ['uk-UA', 'uk', 'en-US', 'en'] });
    
    // Підміняємо WebGL
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    (HTMLCanvasElement.prototype as any).getContext = function(type: string, ...args: any[]) {
      const ctx = (originalGetContext as any).apply(this, [type, ...args]);
      if (ctx && (type === 'webgl' || type === 'experimental-webgl')) {
        const origGetParameter = ctx.getParameter;
        ctx.getParameter = function(param: number) {
          if (param === 37445) return 'Intel Inc.';
          if (param === 37446) return 'Intel(R) Iris(R) Xe Graphics';
          return origGetParameter.apply(this, [param]);
        };
      }
      return ctx;
    };
  });

  // Шукаємо вже відкриту вкладку Sunflower Land
  const pages = context.pages();
  let gamePage = pages.find(p => p.url().includes('sunflower-land'));
  
  if (!gamePage) {
    // Якщо відкритих вкладок немає взагалі — створюємо нову
    if (pages.length === 0) {
      gamePage = await context.newPage();
    } else {
      gamePage = pages[0];
    }
    
    console.log('Перехід до гри у профілі...');
    await gamePage.goto('https://sunflower-land.com/play', { waitUntil: 'networkidle' }).catch(e => console.error('Goto error:', e.message));
  }
  
  page = gamePage;
  try { 
    // Встановлюємо розмір який ідеально підходить під ігрове вікно на скріншоті
    const dimensions = { width: 960, height: 540 };
    console.log(`Фіксація розміру вікна: ${dimensions.width}x${dimensions.height}`);
    
    await page.setViewportSize(dimensions);
    await page.bringToFront(); 
  } catch (e: any) {
    console.error('Помилка при визначенні розміру вікна:', e.message);
  }
  return page;
}

// Розумна пауза, яку можна перервати
async function smartSleep(ms: number, ws: WebSocket) {
  const step = 200;
  let remaining = ms;
  while (remaining > 0 && (ws as any).isBotRunning) {
    const sleepTime = Math.min(step, remaining);
    if (page) await page.waitForTimeout(sleepTime).catch(() => {});
    else await new Promise(r => setTimeout(r, sleepTime));
    remaining -= sleepTime;
  }
}

// Ін'єктуємо пікер елементів на сторінку
async function injectPicker(targetPage: Page, nodeId: string, pickType: string | undefined, wsSend: (data: string) => void) {
  console.log(`Ін'єкція пікера на: ${targetPage.url()} для ноди ${nodeId} (${pickType || 'default'})`);

  try {
    // Реєструємо функцію один раз на сторінку. 
    // Вона буде використовувати актуальний activeWs з глобальної області
    await targetPage.exposeFunction('__sendSelectorInfo', (data: any) => {
      if (activeWs && activeWs.readyState === WebSocket.OPEN) {
        activeWs.send(JSON.stringify({ 
          type: 'SELECTOR_INFO_PICKED', 
          nodeId: data.nodeId, 
          pickType: data.pickType,
          selector: data.selector,
          info: data 
        }));
      } else {
        console.warn('Спроба відправити дані пікера без активного WS');
      }
    }).catch(() => {
      // Функція вже зареєстрована на цій сторінці — це нормально
    });
  } catch (e) { }

  // Перед ін'єкцією видаляємо старий пікер якщо він був
  await targetPage.evaluate(() => {
    if ((window as any).__pickerCleanup) (window as any).__pickerCleanup();
  }).catch(() => {});

  const pickerScript = `
(function(nId, pType) {
  if (window.__pickerCleanup) window.__pickerCleanup();

  function genSel(el) {
    // 1. SMART SELECTOR
    let smart = "";
    const img = el.tagName === 'IMG' ? el : el.querySelector('img');
    if (img && img.src && !img.src.startsWith('data:')) {
      const fileName = img.src.split('/').pop().split('?')[0];
      smart = \`img[src*="\${fileName}"]\`;
      if (el.tagName !== 'IMG') smart = \`\${el.tagName.toLowerCase()}:has(\${smart})\`;
    } else if (el.innerText && el.innerText.trim().length > 0 && el.innerText.trim().length < 50) {
      // Очищаємо текст від лапок та інших символів, що ламають селектор
      const text = el.innerText.trim().replace(/["'()]/g, "").replace(/\s+/g, " ");
      smart = \`\${el.tagName.toLowerCase()}:has-text("\${text}")\`;
    }

    // 2. STANDARD SELECTOR
    const getStd = (curr) => {
      if (curr.id) return '#' + CSS.escape(curr.id);
      let path = [], d = 0;
      while (curr && curr.tagName && curr.tagName !== 'BODY' && d < 5) {
        let p = curr.tagName.toLowerCase();
        if (curr.id) { p += '#' + CSS.escape(curr.id); path.unshift(p); break; }
        if (curr.className && typeof curr.className === 'string') {
          const cls = curr.className.trim().split(/\\s+/).filter(c => c && !c.includes(':'))[0];
          if (cls) p += '.' + CSS.escape(cls);
        }
        const par = curr.parentElement;
        if (par) {
          const sib = Array.from(par.children).filter(c => c.tagName === curr.tagName);
          if (sib.length > 1) p += ':nth-of-type(' + (sib.indexOf(curr)+1) + ')';
        }
        path.unshift(p); curr = curr.parentElement; d++;
      }
      return path.join(' > ');
    };

    return { standard: getStd(el), smart };
  }

  const styles = document.createElement('style');
  styles.id = '__sf_styles';
  styles.textContent = \`
    .__sf_highlight {
      position: fixed; pointer-events: none; z-index: 2147483647;
      border: 2px solid #00ffcc; background: rgba(0, 255, 204, 0.1);
      box-shadow: 0 0 15px rgba(0, 255, 204, 0.5); transition: all 0.1s ease-out;
      border-radius: 4px;
    }
    .__sf_info {
      position: fixed; background: #1a1a1a; color: #fff; padding: 12px;
      border-radius: 8px; border: 1px solid #333; font: 12px 'Segoe UI', sans-serif;
      z-index: 2147483647; pointer-events: none; box-shadow: 0 10px 30px rgba(0,0,0,0.5);
      max-width: 400px; line-height: 1.4;
    }
    .__sf_menu {
      position: fixed; background: #2a2a2a; color: #fff; padding: 5px;
      border-radius: 8px; border: 1px solid #444; z-index: 2147483647;
      box-shadow: 0 10px 40px rgba(0,0,0,0.8); min-width: 200px;
    }
    .__sf_menu_item {
      padding: 8px 12px; cursor: pointer; border-radius: 4px;
      display: flex; justify-content: space-between; align-items: center;
      font: 11px sans-serif; transition: background 0.2s;
    }
    .__sf_menu_item:hover { background: #00ffcc; color: #000; }
  \`;
  document.head.appendChild(styles);

  const box = document.createElement('div'); box.className = '__sf_highlight';
  const info = document.createElement('div'); info.className = '__sf_info';
  const menu = document.createElement('div'); menu.className = '__sf_menu'; menu.style.display = 'none';
  document.documentElement.appendChild(box);
  document.documentElement.appendChild(info);
  document.documentElement.appendChild(menu);

  let last = null;
  let locked = false;

  function onMove(e) {
    if (locked) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || el.closest('.__sf_highlight, .__sf_info, .__sf_menu')) return;
    if (el === last) return;
    last = el;
    updateHighlight(el);
  }

  function updateHighlight(el) {
    const r = el.getBoundingClientRect();
    box.style.top = r.top + 'px';
    box.style.left = r.left + 'px';
    box.style.width = r.width + 'px';
    box.style.height = r.height + 'px';

    const selector = genSel(el);
    info.style.top = (r.bottom + 10 > window.innerHeight ? r.top - 120 : r.bottom + 10) + 'px';
    info.style.left = Math.max(10, Math.min(window.innerWidth - 310, r.left)) + 'px';
    
    info.innerHTML = \`
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
        <span class="__sf_tag">\${el.tagName.toLowerCase()}</span>
        <span style="font-size:9px; color:#00ffcc;">\${pType || 'Select'}</span>
      </div>
      <div style="color:#aaa; font-size: 10px;">\${Math.round(r.width)} x \${Math.round(r.height)}</div>
      <div style="margin-top: 8px; font-weight: bold; color: #00ffcc; border-top: 1px solid #333; padding-top: 4px;">Ctrl+Клік: Вибрати | Shift+Клік: Дерево</div>
    \`;
  }

  function onClick(e) {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    // Якщо клік всередині меню — дозволяємо йому пройти до пунктів меню
    if (el && el.closest('.__sf_menu')) return;

    if (e.ctrlKey) {
      e.preventDefault(); e.stopPropagation();
      if (el) {
        const sels = genSel(el);
        if (sels.smart) {
          showSelectorChoice(el, e.clientX, e.clientY, sels);
        } else {
          sendInfo(el, sels.standard);
        }
      }
    } else if (e.shiftKey) {
      e.preventDefault(); e.stopPropagation();
      if (el) showHierarchy(el, e.clientX, e.clientY);
    }
  }

  function showSelectorChoice(el, x, y, sels) {
    locked = true;
    menu.style.display = 'block';
    menu.style.top = y + 'px';
    menu.style.left = x + 'px';
    menu.innerHTML = \`
      <div style="padding:8px; font-weight:bold; color:#00ffcc; border-bottom:1px solid #444; font-size:11px;">Виберіть тип:</div>
      <div class="__sf_menu_item" id="__smart_btn"><span>✨ Розумний</span></div>
      <div class="__sf_menu_item" id="__std_btn"><span>⚙️ Стандартний</span></div>
    \`;
    menu.querySelector('#__smart_btn').onclick = () => sendInfo(el, sels.smart);
    menu.querySelector('#__std_btn').onclick = () => sendInfo(el, sels.standard);
  }

  function showHierarchy(el, x, y) {
    locked = true;
    menu.style.display = 'block';
    menu.style.top = Math.min(y, window.innerHeight - 400) + 'px';
    menu.style.left = Math.min(x, window.innerWidth - 220) + 'px';
    menu.style.maxHeight = '80vh';
    menu.style.overflowY = 'auto';
    menu.innerHTML = '<div style="padding:5px; font-weight:bold; border-bottom:1px solid #444; color:#00ffcc;">Ієрархія (Вгору та Вниз):</div>';
    
    function addItem(target, label, level = 0) {
      const item = document.createElement('div');
      item.className = '__sf_menu_item';
      item.style.paddingLeft = (10 + level * 15) + 'px';
      
      const sels = genSel(target);
      const classes = target.className && typeof target.className === 'string' ? '.' + target.className.split(' ')[0] : '';
      const iconSpan = document.createElement('span');
      iconSpan.innerHTML = label.split(' ')[0] + ' ';
      iconSpan.style.cursor = 'zoom-in';
      iconSpan.style.color = '#00ffcc';
      iconSpan.style.padding = '0 5px';
      iconSpan.onclick = (ev) => {
        ev.stopPropagation();
        showHierarchy(target, x, y);
      };

      const textSpan = document.createElement('span');
      textSpan.innerHTML = label.split(' ').slice(1).join(' ') + \` <small style="opacity:0.6">\${target.tagName.toLowerCase()}\${classes}</small>\`;
      textSpan.style.flex = '1';

      item.appendChild(iconSpan);
      item.appendChild(textSpan);
      
      item.onmouseenter = () => updateHighlight(target);
      item.onclick = (ev) => { 
        ev.stopPropagation(); 
        if (ev.shiftKey) sendInfo(target, sels.standard);
        else sendInfo(target, sels.smart || sels.standard); 
      };
      menu.appendChild(item);
    }

    // 1. Додаємо батьків (вгору)
    let ancestors = [];
    let cur = el.parentElement;
    while (cur && cur.tagName && cur.tagName !== 'HTML' && ancestors.length < 5) {
      ancestors.unshift(cur);
      cur = cur.parentElement;
    }
    ancestors.forEach(a => addItem(a, '↑ Батько', 0));

    // 2. Додаємо сам елемент
    addItem(el, '● Цей елемент', 0);

    // 3. Додаємо дітей та дітей дітей (вниз)
    function addChildrenRecursive(parent, level) {
      if (level > 2) return;
      const children = Array.from(parent.children);
      children.forEach(c => {
        const label = level === 1 ? '↳ Дитина' : '  ↳ Вкладений';
        addItem(c, label, level);
        if (c.children.length > 0) addChildrenRecursive(c, level + 1);
      });
    }
    addChildrenRecursive(el, 1);
  }

  function sendInfo(el, customSelector) {
    const r = el.getBoundingClientRect();
    const img = el.tagName === 'IMG' ? el : el.querySelector('img');
    const sels = genSel(el);
    const data = {
      nodeId: nId,
      pickType: pType,
      selector: customSelector || sels.smart || sels.standard,
      text: (el.innerText || '').substring(0, 100),
      num: parseInt((el.innerText || '').match(/[0-9]+/) || [0]),
      img: img ? img.src.split('/').pop() : '',
      x: Math.round(r.left + window.scrollX + r.width / 2),
      y: Math.round(r.top + window.scrollY + r.height / 2),
      w: Math.round(r.width),
      h: Math.round(r.height)
    };
    cleanup();
    if (window.__sendSelectorInfo) window.__sendSelectorInfo(data);
  }

  function onKey(e) { 
    if (e.key === 'Escape') {
      if (locked) { locked = false; menu.style.display = 'none'; }
      else cleanup(); 
    }
  }

  function cleanup() {
    document.removeEventListener('mousemove', onMove, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onKey, true);
    [box, info, menu, styles].forEach(el => el && el.parentNode && el.parentNode.removeChild(el));
    window.__pickerCleanup = null;
  }

  window.__pickerCleanup = cleanup;
  document.addEventListener('mousemove', onMove, true);
  document.addEventListener('click', onClick, true);
  document.addEventListener('keydown', onKey, true);
})( ${JSON.stringify(nodeId)}, ${JSON.stringify(pickType)} );
`;

  // Додаємо скрипт як тег — код виконується в браузері без будь-якої трансформації
  await targetPage.addScriptTag({ content: pickerScript });
}

// Запуск сервера Express (0.0.0.0 — доступний з мережі)
app.listen(HTTP_PORT, '0.0.0.0', () => {
  console.log(`Backend API працює на http://0.0.0.0:${HTTP_PORT}`);
});

// Глобальні змінні бота
let globalVariables: Record<string, any> = {};

// Запуск WebSocket сервера
const wss = new WebSocketServer({ port: WS_PORT });

// Функція для трансляції змінних на фронтенд
const broadcastVariables = () => {
  const msg = JSON.stringify({ type: 'GLOBAL_VARIABLES_UPDATE', variables: globalVariables });
  wss.clients.forEach(client => {
    if (client.readyState === 1) client.send(msg);
  });
};

// Функція для відправки логів на клієнт
const logToClient = (message: string, type: 'info' | 'error' | 'success' | 'debug' = 'info') => {
  if (activeWs && activeWs.readyState === 1) {
    activeWs.send(JSON.stringify({ type: 'CONSOLE_LOG', message, logType: type }));
  }
};

wss.on('connection', (ws: WebSocket) => {
  console.log('Клієнт підключився до WebSocket');
  activeWs = ws; // Оновлюємо посилання
  ws.on('message', async (message: string) => {
    try {
      const data = JSON.parse(message.toString());
      activeWs = ws; // Оновлюємо глобальне посилання

      if (data.type === 'START_STREAM') {
        (ws as any).isStreaming = true;
        console.log('Запуск трансляції браузера...');
        
        const sendFrame = async () => {
          if (!(ws as any).isStreaming) return;
          
          try {
            if (isBrowserAlive() && page) {
              const screenshot = await page.screenshot({ 
                type: 'jpeg', 
                quality: 50
              });
              ws.send(JSON.stringify({ 
                type: 'STREAM_FRAME', 
                frame: screenshot.toString('base64') 
              }));
            }
          } catch (e) {}
          
          if ((ws as any).isStreaming) {
            setTimeout(sendFrame, 150); // ~7 кадрів на секунду
          }
        };
        
        await connectToBrowser(); // Переконуємось що браузер запущений
        if (page) {
          console.log(`[STREAM] Чистий перегляд браузера (видалення пікера за замовчуванням)`);
          await page.evaluate(() => {
            if (typeof (window as any).__pickerCleanup === 'function') {
              (window as any).__pickerCleanup();
            }
            ['__sf_styles', '__sf_highlight', '__sf_info', '__sf_menu'].forEach(id => {
              const el = document.getElementById(id) || document.querySelector('.' + id);
              if (el) el.remove();
            });
          }).catch(() => {});
        }
        sendFrame();
      }

      if (data.type === 'ACTIVATE_PICKER') {
        const { nodeId, pickType } = data;
        if (isBrowserAlive() && page) {
          console.log(`[STREAM] Ручна активація пікера для ноди: ${nodeId}`);
          await injectPicker(page, nodeId, pickType, (d) => ws.send(d)).catch(() => {});
        }
      }

      if (data.type === 'RECORD_NODE') {
        const { x, y } = data;
        const scroll = await page?.evaluate(() => ({ x: window.scrollX, y: window.scrollY })) || { x: 0, y: 0 };
        const absX = x + scroll.x;
        const absY = y + scroll.y;
        console.log(`[REC] Автоматичний запис кліку в (${absX}, ${absY})`);
        ws.send(JSON.stringify({ 
          type: 'NODE_RECORDED', 
          nodeType: 'coordClickNode',
          data: { x: absX, y: absY, label: `Клік (${Math.round(absX)},${Math.round(absY)})` }
        }));
      }

      if (data.type === 'STOP_STREAM') {
        (ws as any).isStreaming = false;
        console.log('Трансляцію зупинено.');
      }

      if (data.type === 'INTERACT_BROWSER') {
        const { x, y, action } = data;
        if (isBrowserAlive() && page) {
          try {
            const dpr = await page.evaluate(() => window.devicePixelRatio || 1);
            const cssX = x / dpr;
            const cssY = y / dpr;

            if (action === 'hover') {
              await page.mouse.move(cssX, cssY);
            } else if (action === 'esc') {
              await page.keyboard.press('Escape');
              console.log(`[STREAM] Натиснуто Escape`);
            } else {
              const modifiers: string[] = [];
              if (action === 'ctrl_click') modifiers.push('Control');
              if (action === 'shift_click') modifiers.push('Shift');
              
              // Надійна імітація затиснутих клавіш
              console.log(`[STREAM] Спроба кліку: ${action} в (${cssX}, ${cssY})`);
              for (const mod of modifiers) {
                await page.keyboard.down(mod);
                console.log(`[STREAM] Клавіша затиснута: ${mod}`);
              }
              await page.mouse.click(cssX, cssY);
              for (const mod of modifiers) {
                await page.keyboard.up(mod);
                console.log(`[STREAM] Клавіша відпущена: ${mod}`);
              }
              
              console.log(`[STREAM] Клік успішно виконано.`);
            }
          } catch (e) {}
        }
      }

      if (data.type === 'PICK_SELECTOR_BY_COORDS') {
        const { x, y } = data;
        if (isBrowserAlive() && page) {
          try {
            const dpr = await page.evaluate(() => window.devicePixelRatio || 1);
            const cssX = x / dpr;
            const cssY = y / dpr;
            await page.mouse.click(cssX, cssY);
            console.log(`[STREAM] Симуляція кліку для пікера в (${cssX}, ${cssY})`);
          } catch (e) {}
        }
      }
      
      if (data.type === 'STOP_BOT') {
        (ws as any).isBotRunning = false;
        console.log('Зупинка бота за запитом користувача');
        return;
      }

      // ── Вибір елемента (Pick Element) ──
      if (data.type === 'START_PICKER') {
        try {
          const targetPage = await connectToBrowser();
          await targetPage.bringToFront();
          // Передаємо nodeId та pickType (для батьків/дітей)
          await injectPicker(targetPage, data.nodeId, data.pickType, (d) => ws.send(d));
        } catch (err: any) { ws.send(JSON.stringify({ type: 'ERROR', message: err.message })); }
      }

      // ── Тест однієї ноди (▶) ──
      if (data.type === 'RUN_SINGLE_NODE') {
        const { node, nodes, edges } = data;
        try {
          const activePage = await connectToBrowser();
          ws.send(JSON.stringify({ type: 'NODE_EXECUTING', nodeId: node.id }));
          await executeNodeLogic(node, activePage, ws, {}, nodes, edges);
          ws.send(JSON.stringify({ type: 'BOT_FINISHED' }));
        } catch (e: any) { ws.send(JSON.stringify({ type: 'ERROR', message: e.message })); }
      }

      // ── Повний запуск сценарію ──
      if (data.type === 'RUN_BOT') {
        const { nodes, edges } = data;
        globalVariables = {};
        (ws as any).isBotRunning = true;
        logToClient('🚀 Запуск повного сценарію...', 'success');
        try {
          const activePage = await connectToBrowser();
          const startNode = nodes.find((n: any) => n.type === 'startNode');
          const queue: Array<{ nodeId: string, context?: any, targetHandle?: string }> = startNode ? [{ nodeId: startNode.id }] : [];

          while (queue.length > 0 && (ws as any).isBotRunning) {
            const { nodeId, targetHandle, context } = queue.shift()!;
            const node = nodes.find((n: any) => n.id === nodeId);
            if (!node) continue;

            ws.send(JSON.stringify({ type: 'NODE_EXECUTING', nodeId: node.id, context: context || {} }));

            // Виконуємо логіку ноди через єдину функцію
            let nodeResults: any = {};
            try {
              nodeResults = await executeNodeLogic(node, activePage, ws, context || {}, nodes, edges, targetHandle);
            } catch (e: any) {
              console.warn(`Помилка в ноді ${node.id}:`, e.message);
              logToClient(`Помилка в ноді ${node.data?.title || node.type}: ${e.message}`, 'error');
              try { await takeDebugSnapshot(activePage, ws, node.id); } catch {}
            }

            // Визначаємо вихідні зв'язки з урахуванням nextHandle
            const outgoingEdges = edges.filter((e: any) => e.source === nodeId);
            if (nodeResults.skipNext) {
              console.log(`Пропускаємо вихідні зв'язки для ноди ${nodeId} (тільки оновлення даних)`);
            } else {
              for (const edge of outgoingEdges) {
              // Якщо нода має nextHandle — пропускаємо всі інші виходи
              // ВИНЯТОК: 'coords' може спрацьовувати разом із 'found'
              if (nodeResults.nextHandle && edge.sourceHandle && edge.sourceHandle !== nodeResults.nextHandle) {
                if (!(nodeResults.nextHandle === 'found' && edge.sourceHandle === 'coords')) {
                  continue;
                }
              }
              // Затримка на лінії (DelayEdge)
              const delay = edge.data?.delay || 0;
              if (delay > 0) {
                console.log(`Пауза на лінії: ${delay}ms`);
                await smartSleep(delay, ws);
              }
              // Передаємо контекст наступній ноді
              let edgeContext: any = {};
              if (edge.sourceHandle === 'coords' || edge.sourceHandle === 'found') edgeContext = { coords: nodeResults.coords };
              else if (edge.sourceHandle === 'text') edgeContext = { text: nodeResults.text };
              else if (edge.sourceHandle === 'num') edgeContext = { num: nodeResults.num };
              else if (edge.sourceHandle === 'children') edgeContext = { children: nodeResults.children };
              else edgeContext = { ...nodeResults };
              queue.push({ nodeId: edge.target, targetHandle: edge.targetHandle, context: edgeContext });
              const targetNode = nodes.find((n: any) => n.id === edge.target);
              logToClient(`📤 СИГНАЛ: -> [${targetNode?.data?.title || targetNode?.type}] (Вихід: ${edge.sourceHandle || 'default'})`, 'debug');
            }
            }
            await smartSleep(200, ws);
          }

          console.log('Виконання завершено!');
          logToClient('✅ Сценарій завершено успішно', 'success');
          (ws as any).isBotRunning = false;
          ws.send(JSON.stringify({ type: 'BOT_FINISHED' }));
        } catch (err: any) {
          (ws as any).isBotRunning = false;
          console.error('Помилка бота:', err.message);
          logToClient(`❌ Критична помилка: ${err.message}`, 'error');
          ws.send(JSON.stringify({ type: 'ERROR', message: err.message }));
        }
      }

    } catch (e) {
      console.error('Помилка обробки WS повідомлення:', e);
    }
  });
});

console.log(`WebSocket сервер працює на ws://localhost:${WS_PORT}`);

async function takeDebugSnapshot(page: any, ws: any, nodeId: string, nodeTitle: string, highlight?: { x?: number, y?: number, selector?: string }) {
  const cleanTitle = (nodeTitle || 'Unnamed').replace(/[^a-z0-9а-яіїє]/gi, '_');
  console.log(`[DEBUG] Робимо скріншот для ноди "${nodeTitle}" (${nodeId})`);
  logToClient(`📸 Знімок екрана ноди: ${nodeTitle}`, 'debug');
  try {
    // 1. Малюємо маркер та підпис
    await page.evaluate(({ h, title }: any) => {
      // Маркер
      const id = '__sf_debug_marker';
      let el = document.getElementById(id);
      if (!el) {
        el = document.createElement('div');
        el.id = id;
        document.body.appendChild(el);
      }
      
      // Підпис (Label)
      const labelId = '__sf_debug_label';
      let label = document.getElementById(labelId);
      if (!label) {
        label = document.createElement('div');
        label.id = labelId;
        document.body.appendChild(label);
      }

      // Стилі плашки з назвою
      label.textContent = `НОДА: ${title}`;
      label.style.position = 'fixed';
      label.style.top = '10px';
      label.style.left = '10px';
      label.style.background = '#f43f5e';
      label.style.color = 'white';
      label.style.padding = '5px 12px';
      label.style.borderRadius = '20px';
      label.style.fontFamily = 'sans-serif';
      label.style.fontSize = '14px';
      label.style.fontWeight = 'bold';
      label.style.zIndex = '2147483647';
      label.style.boxShadow = '0 2px 10px rgba(0,0,0,0.5)';

      // Стилі маркера
      el.style.position = 'fixed';
      el.style.position = 'fixed';
      el.style.zIndex = '2147483647';
      el.style.pointerEvents = 'none';
      el.style.border = '4px solid #f43f5e';
      el.style.borderRadius = '50%';
      el.style.boxShadow = '0 0 20px #f43f5e';
      el.style.display = 'block';

      if (h.selector) {
        const target = document.querySelector(h.selector);
        if (target) {
          const r = target.getBoundingClientRect();
          el.style.borderRadius = '8px';
          el.style.left = r.left + 'px';
          el.style.top = r.top + 'px';
          el.style.width = r.width + 'px';
          el.style.height = r.height + 'px';
          el.style.boxShadow = '0 0 0 4000px rgba(0,0,0,0.3), 0 0 20px #f43f5e';
        } else { el.style.display = 'none'; }
      } else if (h.x !== undefined && h.y !== undefined) {
        el.style.borderRadius = '50%';
        el.style.width = '30px';
        el.style.height = '30px';
        el.style.left = (h.x - 15) + 'px';
        el.style.top = (h.y - 15) + 'px';
        el.style.boxShadow = '0 0 0 4000px rgba(0,0,0,0.3), 0 0 20px #f43f5e';
      } else { el.style.display = 'none'; }
    }, highlight || {}).catch(() => {});

    // 2. Робимо скріншот у файл
    const debugDir = path.join(__dirname, '../images/debug');
    if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir, { recursive: true });
    
    const fileName = `snap_${cleanTitle}_${Date.now()}.jpg`;
    const filePath = path.join(debugDir, fileName);

    await page.screenshot({ 
      path: filePath,
      type: 'jpeg', 
      quality: 60, 
      timeout: 4000 
    });

    console.log(`[DEBUG] Скріншот збережено: ${fileName}`);
    ws.send(JSON.stringify({ 
      type: 'DEBUG_SNAPSHOT', 
      nodeId, 
      image: `/api/images/debug/${fileName}` 
    }));
    logToClient(`✅ Скріншот збережено у файл`, 'debug');

    // 3. Видаляємо маркер та підпис
    await page.evaluate(() => {
      ['__sf_debug_marker', '__sf_debug_label'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.remove();
      });
    }).catch(() => {});
  } catch (e: any) {
    console.error('Snapshot error:', e.message);
    logToClient(`❌ Помилка скріншоту: ${e.message}`, 'error');
  }
}

// Глобальна функція виконання логіки ноди
async function executeNodeLogic(currentNode: any, activePage: any, ws: any, context: any, nodes: any, edges: any, targetHandle?: string): Promise<any> {
  const nodeTitle = currentNode.data?.title || currentNode.type;
  let nodeResults: Record<string, any> = {};

  logToClient(`\n💠 [НОДА: ${nodeTitle}] (${currentNode.type})`, 'info');
  if (Object.keys(context || {}).length > 0) {
    logToClient(`📥 ВХІДНІ ДАНІ: ${JSON.stringify(context)}`, 'debug');
  }

  try {
    if (currentNode.type === 'actionNode') {
      const { selector, actionType = 'click', clickAll = false } = currentNode.data;
      logToClient(`⚙️ ДІЯ: ${actionType} ${selector ? `на ${selector}` : 'по координатах'}`, 'debug');
      
      if (context.coords && (actionType === 'click' || actionType === 'double_click')) {
        let { x, y } = context.coords;
        let wheelY = 0;
        
        if (y < 0) {
          wheelY = y;
          y = 0; 
        }

        // Прокручуємо до координат (миттєво)
        console.log(`[DEBUG] Прокрутка до: X:${x}, Y:${y}`);
        
        const vSize = activePage.viewportSize() || { width: 960, height: 540 };
        // Якщо треба крутити коліщатко (для ігор)
        if (wheelY !== 0 || y > vSize.height) {
           const dy = wheelY !== 0 ? wheelY : (y - vSize.height / 2);
           console.log(`[DEBUG] Коліщатко миші: ${dy}`);
           await activePage.mouse.move(vSize.width / 2, vSize.height / 2);
           await activePage.mouse.wheel(0, dy);
           await activePage.waitForTimeout(600);
        }

        await activePage.evaluate(({ x, y }: any) => {
          window.scrollTo({
            left: x - window.innerWidth / 2,
            top: y - window.innerHeight / 2,
            behavior: 'auto'
          });
        }, { x, y });
        await activePage.waitForTimeout(200); 

        // Обчислюємо координати ВІДНОСНО ВІКНА після прокрутки
        const viewportCoords = await activePage.evaluate(({ x, y }: any) => {
          return { 
            x: x - window.scrollX, 
            y: y - window.scrollY 
          };
        }, { x, y });

        await takeDebugSnapshot(activePage, ws, currentNode.id, nodeTitle, viewportCoords);
        await activePage.mouse.click(viewportCoords.x, viewportCoords.y);
        logToClient(`✅ Клік виконано в (${viewportCoords.x}, ${viewportCoords.y})`, 'success');
      } else if (selector) {
        if (clickAll) {
          const els = await activePage.$$(selector);
          for (const el of els) if (await el.isVisible()) await el.click({ force: true });
          logToClient(`✅ Клікнуто на всі (${els.length}) елементи`, 'success');
        } else {
          await takeDebugSnapshot(activePage, ws, currentNode.id, nodeTitle, { selector });
          await activePage.waitForSelector(selector, { timeout: 5000 });
          if (actionType === 'click') await activePage.click(selector, { force: true });
          else if (actionType === 'double_click') await activePage.dblclick(selector, { force: true });
          else if (actionType === 'hover') await activePage.hover(selector);
          else if (actionType === 'scroll') await activePage.$eval(selector, (el: any) => el.scrollIntoView());
          logToClient(`✅ Дія ${actionType} виконана на селектор`, 'success');
        }
      }
    } else if (currentNode.type === 'valueLoopNode') {
      // Цикл кліків — перебирає дочірні елементи за типом, клікає на ті що мають число >= мінімуму
      const parentSel = currentNode.data.selector;
      const childType = currentNode.data.childType || 'img';
      const childCustom = currentNode.data.childCustomSelector || '';
      const minValue = currentNode.data.minValue ?? 0;
      // Визначаємо CSS-селектор для дочірніх елементів
      const childSelector = childType === 'custom' ? childCustom : childType;

      if (!parentSel) {
        nodeResults.nextHandle = 'fail';
        ws.send(JSON.stringify({ type: 'NODE_DATA_UPDATE', nodeId: currentNode.id, data: { loopResult: { clicked: 0, total: 0 } } }));
      } else {
        // Збираємо інформацію про дочірні елементи з числами
        const elements = await activePage.evaluate(({ pSel, cSel, min }: { pSel: string, cSel: string, min: number }) => {
          const parent = document.querySelector(pSel);
          if (!parent) return [];
          const children = Array.from(parent.querySelectorAll(cSel)) as HTMLElement[];
          const results: { index: number, num: number, rect: any }[] = [];

          children.forEach((el, i) => {
            const container = el.closest('[class]') || el.parentElement;
            if (!container) return;
            const text = container.textContent || '';
            const match = text.match(/(\d+(?:\.\d+)?)/);
            const num = match ? parseFloat(match[1]) : -1;
            if (num >= min) {
              const rect = el.getBoundingClientRect();
              results.push({ index: i, num, rect: { x: Math.round(rect.left + rect.width/2), y: Math.round(rect.top + rect.height/2) } });
            }
          });
          return results;
        }, { pSel: parentSel, cSel: childSelector, min: minValue });

        // Клікаємо по кожному знайденому елементу
        let clicked = 0;
        for (const el of elements) {
          if (!(ws as any).isBotRunning) break;
          // Прокручуємо до елемента
          await activePage.evaluate(({ x, y }: any) => {
            window.scrollTo({
              left: x - window.innerWidth / 2,
              top: y - window.innerHeight / 2,
              behavior: 'auto'
            });
          }, { x: el.rect.x, y: el.rect.y });
          await activePage.waitForTimeout(200);

          // Перераховуємо координати відносно вікна
          const vCoords = await activePage.evaluate(({ x, y }: any) => {
            return { x: x - window.scrollX, y: y - window.scrollY };
          }, { x: el.rect.x, y: el.rect.y });

          await takeDebugSnapshot(activePage, ws, currentNode.id, nodeTitle, vCoords);
          await activePage.mouse.click(vCoords.x, vCoords.y);
          clicked++;
          // Невелика пауза між кліками щоб гра встигла обробити
          await smartSleep(300, ws);
        }

        // Відправляємо результат на фронтенд
        ws.send(JSON.stringify({ 
          type: 'NODE_DATA_UPDATE', 
          nodeId: currentNode.id, 
          data: { loopResult: { clicked, total: elements.length } } 
        }));
        nodeResults.nextHandle = clicked > 0 ? 'done' : 'fail';
      }
    } else if (currentNode.type === 'delayNode') {
      await smartSleep(currentNode.data.delay || 1000, ws);
    } else if (currentNode.type === 'apiNode') {
       const { url, apiKey } = currentNode.data;
       const headers: Record<string, string> = {};
       
       if (apiKey) {
         if (apiKey.startsWith('eyJ')) {
           headers['Authorization'] = `Bearer ${apiKey}`;
         } else {
           headers['x-api-key'] = apiKey;
         }
       }

       const res = await fetch(url, { headers });
       const json = await res.json();
       nodeResults = json;
       ws.send(JSON.stringify({ type: 'NODE_DATA_UPDATE', nodeId: currentNode.id, data: { lastResponse: json } }));
    } else if (currentNode.type === 'variableNode') {
      const vars = currentNode.data.variables || [];
      vars.forEach((v: any) => {
        const val = v.path.split('.').reduce((o: any, i: string) => o?.[i], context);
        if (val !== undefined) globalVariables[v.name] = val;
      });
      broadcastVariables();
    } else if (currentNode.type === 'displayNode') {
       let displayVal = "";
       if (context.coords) displayVal += `📍 Координати: ${context.coords.x}, ${context.coords.y}\n`;
       if (context.text) displayVal += `📝 Текст: ${context.text}\n`;
       if (context.num !== undefined) displayVal += `🔢 Число: ${context.num}\n`;
       if (context.imageNames?.length) displayVal += `🖼️ Картинки (${context.imageNames.length}): ${context.imageNames.slice(0, 3).join(', ')}${context.imageNames.length > 3 ? '...' : ''}\n`;
       if (context.childrenNames?.length) displayVal += `🌿 Діти (${context.childrenNames.length}): ${context.childrenNames.slice(0, 3).join(', ')}${context.childrenNames.length > 3 ? '...' : ''}\n`;
       
       if (!displayVal) displayVal = JSON.stringify(context, null, 2).substring(0, 200);
       
       ws.send(JSON.stringify({ type: 'NODE_DISPLAY_DATA', nodeId: currentNode.id, value: displayVal.trim() }));
    } else if (currentNode.type === 'searchInNode') {
        const { selector, imageName } = currentNode.data;
        if (!selector || !imageName) throw new Error('Вкажіть селектор та назву картинки');
        
        const fileName = imageName.includes('.') ? imageName : `${imageName}.png`;
        const result = await activePage.evaluate(({ sel, imgName }: { sel: string, imgName: string }) => {
           const root = document.querySelector(sel);
           if (!root) return null;
           const img = root.querySelector(`img[src*="${imgName}"]`) as HTMLImageElement;
           if (img) {
              const r = img.getBoundingClientRect();
              return { 
                 x: Math.round(r.left + window.scrollX + r.width / 2), 
                 y: Math.round(r.top + window.scrollY + r.height / 2) 
              };
           }
           return null;
        }, { sel: selector, imgName: fileName });

        if (result) {
          await takeDebugSnapshot(activePage, ws, currentNode.id, nodeTitle, { x: result.x, y: result.y });
          context.coords = result;
           nodeResults.nextHandle = 'found';
           ws.send(JSON.stringify({ type: 'NODE_DATA_UPDATE', nodeId: currentNode.id, data: { status: 'Знайдено', lastCoords: `X:${result.x}, Y:${result.y}` } }));
           logToClient(`✅ Знайдено в ${selector}: (${result.x}, ${result.y})`, 'success');
        } else {
           nodeResults.nextHandle = 'not_found';
           ws.send(JSON.stringify({ type: 'NODE_DATA_UPDATE', nodeId: currentNode.id, data: { status: 'Немає' } }));
           logToClient(`❌ Не знайдено в ${selector}`, 'error');
        }
    } else if (currentNode.type === 'imageSearchNode' || currentNode.type === 'visualSearchNode') {
        let { imageName, threshold = 0.8, selector } = currentNode.data;
        if (!imageName) throw new Error('Назва картинки не вказана');

        // Додаємо .png якщо розширення немає
        const fileName = imageName.includes('.') ? imageName : `${imageName}.png`;
        
        console.log(`Пошук картинки: ${fileName} ${selector ? `в ${selector}` : ''}`);

        // СПОЧАТКУ ШУКАЄМО В DOM (КОД СТОРІНКІ) - як просив користувач
        const domResult = await activePage.evaluate(({ name, selector }: { name: string, selector: string | undefined }) => {
          const root = selector ? document.querySelector(selector) : document;
          if (!root) return null;

          const img = root.querySelector(`img[src*="${name}"]`);
          if (img) {
            const rect = img.getBoundingClientRect();
            return { x: rect.left + window.scrollX + rect.width / 2, y: rect.top + window.scrollY + rect.height / 2 };
          }
          const all = Array.from(root.querySelectorAll('*')) as HTMLElement[];
          for (const el of all) {
            const bg = window.getComputedStyle(el).backgroundImage;
            if (bg && bg.includes(name)) {
              const rect = el.getBoundingClientRect();
              return { x: rect.left + window.scrollX + rect.width / 2, y: rect.top + window.scrollY + rect.height / 2 };
            }
          }
          return null;
        }, { name: fileName, selector });

        let finalResult = domResult;

        // ЯКЩО В DOM НЕ ЗНАЙДЕНО - ШУКАЄМО ВІЗУАЛЬНО (ПО ПІКСЕЛЯХ)
        if (!finalResult) {
          console.log(`В коді не знайдено, пробуємо візуальний пошук: ${fileName}`);
          const imagesDir = path.join(__dirname, '../images');
          const imgPath = path.join(imagesDir, fileName);
          
          if (fs.existsSync(imgPath)) {
            const imgBase64 = fs.readFileSync(imgPath, { encoding: 'base64' });
            let screenshot: Buffer;
            let offset = { x: 0, y: 0 };

            const scroll = await activePage.evaluate(() => ({ x: window.scrollX, y: window.scrollY }));
            if (selector) {
              const el = await activePage.$(selector);
              if (el) {
                screenshot = await el.screenshot();
                const box = await el.boundingBox();
                if (box) offset = { x: box.x + scroll.x, y: box.y + scroll.y };
              } else {
                screenshot = await activePage.screenshot();
                offset = scroll;
              }
            } else {
              screenshot = await activePage.screenshot();
              offset = scroll;
            }

            const screenBase64 = screenshot.toString('base64');
            const visualRes = await activePage.evaluate(async ({ screenB64, tempB64, threshold }: any) => {
               const loadImg = (src: string): Promise<HTMLImageElement> => new Promise(r => { const i = new Image(); i.src = src; i.onload = () => r(i); });
               const [screen, temp] = await Promise.all([loadImg('data:image/png;base64,'+screenB64), loadImg('data:image/png;base64,'+tempB64)]);
               const sC = document.createElement('canvas'); sC.width = screen.width; sC.height = screen.height;
               const sCtx = sC.getContext('2d')!; sCtx.drawImage(screen, 0, 0);
               const sD = sCtx.getImageData(0, 0, sC.width, sC.height).data;
               const tC = document.createElement('canvas'); tC.width = temp.width; tC.height = temp.height;
               const tCtx = tC.getContext('2d')!; tCtx.drawImage(temp, 0, 0);
               const tD = tCtx.getImageData(0, 0, tC.width, tC.height).data;

               for (let y = 0; y < sC.height - tC.height; y += 4) {
                 for (let x = 0; x < sC.width - tC.width; x += 4) {
                   let m = 0, tot = 0;
                   for (let ty = 0; ty < tC.height; ty += 8) {
                     for (let tx = 0; tx < tC.width; tx += 8) {
                       const si = ((y+ty)*sC.width + (x+tx))*4, ti = (ty*tC.width+tx)*4;
                       if (Math.abs(sD[si]-tD[ti]) + Math.abs(sD[si+1]-tD[ti+1]) + Math.abs(sD[si+2]-tD[ti+2]) < 50) m++;
                       tot++;
                     }
                   }
                   if (m/tot > threshold) return { x: x + tC.width/2, y: y + tC.height/2 };
                 }
               }
               return null;
            }, { screenB64: screenBase64, tempB64: imgBase64, threshold });

            if (visualRes) {
              finalResult = { x: visualRes.x + offset.x, y: visualRes.y + offset.y };
            }
          }
        }

        if (finalResult) {
          const actualResult = finalResult;
          await takeDebugSnapshot(activePage, ws, currentNode.id, nodeTitle, { x: actualResult.x, y: actualResult.y });
          nodeResults.coords = actualResult;
          nodeResults.nextHandle = 'found';
          ws.send(JSON.stringify({ type: 'NODE_DISPLAY_DATA', nodeId: currentNode.id, value: `Знайдено: ${Math.round(actualResult.x)},${Math.round(actualResult.y)}` }));
          logToClient(`✅ Знайдено візуально: ${fileName} (${Math.round(actualResult.x)}, ${Math.round(actualResult.y)})`, 'success');
        } else {
          nodeResults.nextHandle = 'not_found';
          ws.send(JSON.stringify({ type: 'NODE_DISPLAY_DATA', nodeId: currentNode.id, value: 'Не знайдено' }));
          logToClient(`❌ Не знайдено візуально: ${fileName}`, 'error');
        }
    } else if (currentNode.type === 'browserNode') {
        const { url, browser_action } = currentNode.data;
        
        if (url && url.startsWith('http')) {
           console.log(`[BROWSER] Перехід на: ${url}`);
           await activePage.goto(url, { waitUntil: 'load' });
        } else {
           if (browser_action === 'refresh') {
              console.log(`[BROWSER] Оновлення сторінки...`);
              await activePage.reload({ waitUntil: 'load' }).catch(async () => {
                 await activePage.evaluate(() => window.location.reload());
              });
           }
           else if (browser_action === 'back') await activePage.goBack();
           else if (browser_action === 'wait_load') await activePage.waitForLoadState('networkidle');
        }
    } else if (currentNode.type === 'selectorCheckNode') {
       const { selector } = currentNode.data;
       logToClient(`⚙️ ПЕРЕВІРКА: Наявність ${selector}`, 'debug');
       const isExists = await activePage.$(selector).catch(() => null);
       if (isExists) {
         await takeDebugSnapshot(activePage, ws, currentNode.id, nodeTitle, { selector });
         logToClient(`✅ Селектор існує`, 'success');
       } else {
         logToClient(`❌ Селектор НЕ знайдено`, 'error');
       }
       nodeResults.nextHandle = isExists ? 'exists' : 'not_exists';
    } else if (currentNode.type === 'escNode') {
        console.log(`[KEYBOARD] Натискання ESC`);
        await activePage.keyboard.press('Escape');
    } else if (currentNode.type === 'keyboardNode') {
       const keys = currentNode.data.keys || [];
       for (const k of keys) {
         await activePage.keyboard.press(k.key);
         await smartSleep(k.delay || 100, ws);
       }
    } else if (currentNode.type === 'infoNode') {
       const { selector, variablePrefix = 'scanned' } = currentNode.data;
       try {
         const el = await activePage.waitForSelector(selector, { timeout: 3000 });
         const box = await el.boundingBox();
         const text = await el.textContent();
         const num = parseInt(text?.match(/\d+/)?.[0] || "0");
         
         const info = await activePage.evaluate((s: string) => {
            const e = document.querySelector(s);
            if (!e) return null;
             const imageNames = Array.from(e.querySelectorAll('img')).map(img => {
                const parts = img.src.split('/');
                return parts[parts.length - 1].split('?')[0];
             }).filter(n => n && !n.startsWith('data:'));

             const childrenNames = Array.from(e.children).map(c => ({
                name: c.textContent?.trim().substring(0, 15) || c.tagName.toLowerCase(),
                selector: c.tagName.toLowerCase() + (c.id ? '#' + c.id : '') + (c.className && typeof c.className === 'string' ? '.' + c.className.split(' ')[0] : '')
             })).filter(i => i.name);

             return {
                children: e.children.length,
                images: e.querySelectorAll('img').length,
                imageNames,
                childrenNames
             };
         }, selector);

         const coords = box ? { x: Math.round(box.x + box.width/2), y: Math.round(box.y + box.height/2) } : { x: 0, y: 0 };
         
         globalVariables[`${variablePrefix}_text`] = text || "";
         globalVariables[`${variablePrefix}_num`] = num;
         
         nodeResults = {
            coords,
            text: text || "",
            num,
            children: info?.children || 0,
            images: info?.images || 0,
            imageNames: info?.imageNames || [],
            childrenNames: info?.childrenNames || []
         };

         broadcastVariables();
         
         ws.send(JSON.stringify({ 
            type: 'NODE_DATA_UPDATE', 
            nodeId: currentNode.id, 
            data: { 
               lastCoords: `X:${coords.x}, Y:${coords.y}`,
               lastText: text?.substring(0, 15),
               lastNum: num,
               lastChildrenCount: info?.children,
               lastImagesCount: info?.images,
               imageNames: info?.imageNames || [],
               childrenNames: info?.childrenNames || []
            } 
         }));
       } catch (e) { console.error('Помилка сканування:', e); }
    } else if (currentNode.type === 'conditionNode') {
       const type = currentNode.data.conditionType || 'exists';
       let met = false;
       if (type === 'exists') {
         const el = await activePage.$(currentNode.data.selector).catch(() => null);
         met = el ? await el.isVisible() : false;
       } else if (type === 'compare') {
         const valA = globalVariables[currentNode.data.varA] || 0;
         const valB = parseInt(currentNode.data.valB) || 0;
         const op = currentNode.data.operator || '>';
         if (op === '>') met = valA > valB;
         else if (op === '<') met = valA < valB;
         else if (op === '==') met = valA == valB;
       }
       nodeResults.nextHandle = met ? 'true' : 'false';
       logToClient(`⚙️ УМОВА: ${type} -> ${met}`, met ? 'success' : 'error');
    } else if (currentNode.type === 'nestedCheckNode') {
       const parent = await activePage.$(currentNode.data.parentSelector).catch(() => null);
       const child = parent ? await parent.$(currentNode.data.childSelector).catch(() => null) : null;
       nodeResults.nextHandle = child ? 'found' : 'not_found';
    } else if (currentNode.type === 'valueLoopNode') {
       const clicked = await activePage.evaluate((sel: string) => {
         const p = document.querySelector(sel);
         if (!p) return false;
         for (const c of Array.from(p.children)) {
           if (parseInt(c.textContent?.match(/\d+/)?.[0] || '0') > 0) {
             (c as HTMLElement).click(); return true;
           }
         }
         return false;
       }, currentNode.data.selector);
       nodeResults.nextHandle = clicked ? 'done' : 'fail';
    } else if (currentNode.type === 'multiLogicNode') {
       const conds = currentNode.data.conditions || [];
       let idx = -1;
       for (let i = 0; i < conds.length; i++) {
         try {
           let expr = conds[i].expression;
           Object.keys(globalVariables).forEach(k => expr = expr.replace(new RegExp(k, 'g'), globalVariables[k]));
           if (eval(expr)) { idx = i; break; }
         } catch {}
       }
       nodeResults.nextHandle = idx >= 0 ? `out_${idx}` : 'default';
       logToClient(`⚙️ ЛОГІКА: Вихід -> ${nodeResults.nextHandle}`, 'success');
    } else if (currentNode.type === 'multiScanNode') {
       const items = currentNode.data.scanItems || [];
       let found = false;
       for (let i = 0; i < items.length; i++) {
         const item = items[i];
         if (!item.selector) continue;
         const result = await activePage.evaluate(({ sel, cond, val }: any) => {
           const el = document.querySelector(sel);
           if (!el) return null;
           const text = (el as HTMLElement).innerText || "";
           const numMatch = text.match(/(\d+(?:\.\d+)?)/);
           const num = numMatch ? parseFloat(numMatch[1]) : NaN;
           let met = false;
           if (cond === 'exists') met = true;
           else if (cond === 'contains') met = text.includes(val);
           else if (cond === 'equals') met = text.trim() === val.trim();
           else if (cond === '>') met = !isNaN(num) && num > parseFloat(val);
           else if (cond === '<') met = !isNaN(num) && num < parseFloat(val);
           if (met) {
             const r = el.getBoundingClientRect();
             return { x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2), text, num };
           }
           return null;
         }, { sel: item.selector, cond: item.condition, val: item.value });
         if (result) {
           nodeResults.coords = { x: result.x, y: result.y };
           nodeResults.text = result.text;
           nodeResults.num = result.num;
           nodeResults.nextHandle = 'success';
           found = true;
           ws.send(JSON.stringify({ type: 'NODE_DATA_UPDATE', nodeId: currentNode.id, data: { status: `✅ Знайдено #${i+1} (${result.x}, ${result.y})`, lastFound: item.selector } }));
           break;
         }
       }
       if (!found) {
         nodeResults.nextHandle = 'fail';
         ws.send(JSON.stringify({ type: 'NODE_DATA_UPDATE', nodeId: currentNode.id, data: { status: 'Не знайдено', lastFound: 'Нічого' } }));
        }
    } else if (currentNode.type === 'coordClickNode') {
        // Якщо прийшли на вхід "записати координати"
        if (targetHandle === 'update_coords' && context?.coords) {
          currentNode.data.x = context.coords.x;
          currentNode.data.y = context.coords.y;
          // Повертаємо координати далі по ланцюжку
          nodeResults.coords = context.coords;
          // Повідомляємо фронтенд про оновлення
          ws.send(JSON.stringify({ type: 'NODE_DATA_UPDATE', nodeId: currentNode.id, data: { x: context.coords.x, y: context.coords.y } }));
        } 
        // Якщо прийшли на вхід "записати кількість"
        else if (targetHandle === 'update_count' && context?.num !== undefined) {
          currentNode.data.clickCount = context.num;
          ws.send(JSON.stringify({ type: 'NODE_DATA_UPDATE', nodeId: currentNode.id, data: { clickCount: context.num } }));
        }
        // Стандартний клік (або вхід execute)
        else {
          let x = currentNode.data.x || 0;
          let y = currentNode.data.y || 0;
          let wheelY = 0;
          
          // Отримуємо поточну прокрутку
          const currentScroll = await activePage.evaluate(() => ({ x: window.scrollX, y: window.scrollY }));

          if (context?.coords) {
            x = context.coords.x;
            y = context.coords.y;
          } else {
            // Якщо Y від'ємний — це відносна прокрутка
            if (currentNode.data.y < 0) {
              wheelY = currentNode.data.y;
              y = currentScroll.y; 
            }
          }

          const vSize = activePage.viewportSize() || { width: 960, height: 540 };
          
          if (wheelY !== 0) {
             console.log(`[DEBUG] Прокрутка коліщатком на: ${wheelY}`);
             await activePage.mouse.move(vSize.width / 2, vSize.height / 2);
             await activePage.mouse.wheel(0, wheelY);
             await activePage.waitForTimeout(600);
          }

          if (y > vSize.height) {
            await activePage.evaluate(({ x, y }: any) => {
              window.scrollTo({ left: x - window.innerWidth/2, top: y - window.innerHeight/2, behavior: 'auto' });
            }, { x, y });
            await activePage.waitForTimeout(200);
          }

          const vCoords = await activePage.evaluate(({ x, y }: any) => {
            return { x: x - window.scrollX, y: Math.max(0, y - window.scrollY) };
          }, { x, y });

          const count = currentNode.data.clickCount || 1;
          for (let i = 0; i < count; i++) {
            if (i === 0) await takeDebugSnapshot(activePage, ws, currentNode.id, nodeTitle, vCoords);
            await activePage.mouse.click(vCoords.x, vCoords.y);
            if (count > 1) await activePage.waitForTimeout(100);
          }
          if (context?.coords) nodeResults.coords = context.coords;
        }
    } else if (currentNode.type === 'textCompareNode') {
        // Оновлення даних через входи
        if (targetHandle === 'textA') {
          currentNode.data.varA = String(context.text || context.value || "");
          ws.send(JSON.stringify({ type: 'NODE_DATA_UPDATE', nodeId: currentNode.id, data: { varA: currentNode.data.varA } }));
          nodeResults.skipNext = true; // НЕ запускаємо наступні ноди
        } else if (targetHandle === 'textB') {
          currentNode.data.valB = String(context.text || context.value || "");
          ws.send(JSON.stringify({ type: 'NODE_DATA_UPDATE', nodeId: currentNode.id, data: { valB: currentNode.data.valB } }));
          nodeResults.skipNext = true; // НЕ запускаємо наступні ноди
        } else {
          // Виконання порівняння
          let valA = String(currentNode.data.varA || "");
          // Якщо varA — це назва існуючої змінної, беремо її значення
          if (globalVariables[valA] !== undefined) {
             valA = String(globalVariables[valA]);
          }
          
          const valB = String(currentNode.data.valB || "");
          const op = currentNode.data.operator || 'equals';
          let met = false;

          if (op === 'equals') met = valA === valB;
          else if (op === 'not_equals') met = valA !== valB;
          else if (op === 'contains') met = valA.includes(valB);
          else if (op === 'not_contains') met = !valA.includes(valB);
          else if (op === 'starts_with') met = valA.startsWith(valB);
          else if (op === 'ends_with') met = valA.endsWith(valB);
          else if (op === 'matches') {
            try {
              const regex = new RegExp(valB, 'i');
              met = regex.test(valA);
            } catch (e) { met = false; }
          }

          nodeResults.nextHandle = met ? 'true' : 'false';
          logToClient(`⚙️ ТЕКСТ: "${valA}" ${op} "${valB}" -> ${met}`, met ? 'success' : 'error');
        }
    } else if (currentNode.type === 'compareNode') {
        if (targetHandle === 'valA') {
          currentNode.data.valA = context.num ?? context.value ?? 0;
          ws.send(JSON.stringify({ type: 'NODE_DATA_UPDATE', nodeId: currentNode.id, data: { valA: currentNode.data.valA } }));
          nodeResults.skipNext = true;
        } else if (targetHandle === 'valB') {
          currentNode.data.valB = context.num ?? context.value ?? 0;
          ws.send(JSON.stringify({ type: 'NODE_DATA_UPDATE', nodeId: currentNode.id, data: { valB: currentNode.data.valB } }));
          nodeResults.skipNext = true;
        } else {
          // Вхід execute або за замовчуванням
          const a = currentNode.data.valA || 0;
          const b = currentNode.data.valB || 0;
          const op = currentNode.data.operator || '>';
          let met = false;
          if (op === '>') met = a > b;
          else if (op === '<') met = a < b;
          else if (op === '==') met = a == b;
          else if (op === '>=') met = a >= b;
          else if (op === '<=') met = a <= b;
          else if (op === '!=') met = a != b;
          nodeResults.nextHandle = met ? 'true' : 'false';
        }
    }
  } catch (err: any) {
    console.warn(`Помилка в ноді ${currentNode.id}:`, err.message);
    throw err;
  }
  return nodeResults;
}
