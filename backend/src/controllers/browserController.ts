import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { Logger } from '../logger';
import {
  sessions,
  getOrCreateSession,
  isSessionBrowserAlive,
  connectToBrowser,
  closeSessionBrowser
} from '../browserManager';
import { ensureBrowserSettings } from '../runner/ProjectRunner';
import { getRoninInjectionScript } from '../web3Signer';

const logger = new Logger('BrowserController');

export function getBrowserEnv(_req: Request, res: Response): void {
  try {
    res.json({
      defaultProfile: process.env.CAMOUFOX_DEFAULT_PROFILE || process.env.ITBROWSER_PROFILE || 'default',
      defaultProfileDir: process.env.CAMOUFOX_DEFAULT_PROFILE || process.env.ITBROWSER_PROFILE_DIR || 'default'
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function openBrowser(req: Request, res: Response): Promise<void> {
  const projectName = req.params.projectName;
  const forceHeaded = req.query.forceHeaded === 'true' || req.query.visible === 'true' || req.body?.forceHeaded === true || req.body?.visible === true;
  try {
    let session = sessions.get(projectName);
    if (!session) {
      session = getOrCreateSession(projectName);
    }
    
    if (isSessionBrowserAlive(session)) {
      if (forceHeaded && session.currentlyRunningHeadless) {
        logger.info(`Browser for ${projectName} is currently running headless, restarting in visible mode...`);
        await closeSessionBrowser(session);
      } else {
        res.json({ success: true, message: 'Browser is already running' });
        return;
      }
    }

    await ensureBrowserSettings(projectName, session);

    await connectToBrowser(
      session,
      session.botSettings?.width || session.botSettings?.browserWidth || 1280,
      session.botSettings?.height || session.botSettings?.browserHeight || 720,
      session.botSettings?.profile,
      session.botSettings?.profileDir,
      session.botSettings?.proxy,
      forceHeaded
    );
    
    res.json({ success: true, message: 'Browser opened successfully' });
  } catch (error: any) {
    logger.error(`Failed to open browser for ${projectName}`, error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function closeBrowser(req: Request, res: Response): Promise<void> {
  const projectName = req.params.projectName;
  try {
    const session = sessions.get(projectName);
    if (session) {
      await closeSessionBrowser(session);
    }
    res.json({ success: true, message: 'Browser closed' });
  } catch (error: any) {
    logger.error(`Failed to close browser for ${projectName}`, error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({ success: false, message: error.message });
  }
}

export function getBrowserStatus(req: Request, res: Response): void {
  const projectName = req.params.projectName;
  const session = sessions.get(projectName);
  const isRunning = session ? isSessionBrowserAlive(session) : false;
  res.json({ success: true, isRunning });
}

export function getProfiles(_req: Request, res: Response): void {
  try {
    const profilesDir = process.env.CAMOUFOX_PROFILES_DIR || '/app/profiles';
    const result: { id: string; hasUserData: boolean; hasFingerprint: boolean }[] = [];
    if (fs.existsSync(profilesDir)) {
      const entries = fs.readdirSync(profilesDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          result.push({
            id: entry.name,
            hasUserData: true,
            hasFingerprint: true
          });
        }
      }
    }
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export function getProxies(_req: Request, res: Response): void {
  try {
    const proxiesFile = path.join(__dirname, '../../data/proxies.txt');
    const altFile = path.join(__dirname, '../data/proxies.txt');
    const filePath = fs.existsSync(proxiesFile) ? proxiesFile : (fs.existsSync(altFile) ? altFile : null);

    let proxies: string[] = [];
    if (filePath) {
      const content = fs.readFileSync(filePath, 'utf-8');
      proxies = content.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('#'));
    }

    const usedProxies = new Set<string>();
    const projectsDir = path.join(__dirname, '../projects');
    if (fs.existsSync(projectsDir)) {
      const files = fs.readdirSync(projectsDir).filter(f => f.endsWith('.json'));
      for (const file of files) {
        try {
          const project = JSON.parse(fs.readFileSync(path.join(projectsDir, file), 'utf-8'));
          if (project.settings?.proxy) usedProxies.add(project.settings.proxy.trim());
          if (project.botSettings?.proxy) usedProxies.add(project.botSettings.proxy.trim());
        } catch (_) {}
      }
    }

    const result = proxies.map(p => ({
      proxy: p,
      used: usedProxies.has(p)
    }));

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function getPageSource(req: Request, res: Response): Promise<void> {
  const projectName = req.params.projectName || (req.query.projectName as string) || 'SF';
  try {
    const session = sessions.get(projectName);
    if (!session || !isSessionBrowserAlive(session) || !session.page) {
      res.status(404).send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Браузер не запущено</title><style>body{background:#121827;color:#e2e8f0;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;}.box{background:#1f2937;padding:30px;border-radius:12px;border:1px solid #374151;text-align:center;max-width:450px;}h2{margin-top:0;color:#f87171;}p{color:#9ca3af;font-size:14px;}</style></head><body><div class="box"><h2>Браузер для "${projectName}" не запущено</h2><p>Будь ласка, запустіть трансляцію або відкрийте браузер у панелі керування ботом.</p></div></body></html>`);
      return;
    }

    const html = await session.page.content();
    const url = session.page.url();
    const title = await session.page.title();

    if (req.query.format === 'json') {
      res.json({ success: true, projectName, url, title, html });
      return;
    }

    if (req.query.format === 'raw') {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.send(html);
      return;
    }

    const safeHtml = html
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const pageHtml = `<!DOCTYPE html>
<html lang="uk">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Код сторінки: ${title || projectName}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      background: #0f172a;
      color: #e2e8f0;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 13px;
      line-height: 1.5;
    }
    .header {
      position: sticky;
      top: 0;
      z-index: 100;
      background: #1e293b;
      border-bottom: 1px solid #334155;
      padding: 10px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }
    .info {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .title {
      font-weight: bold;
      color: #38bdf8;
      font-size: 14px;
    }
    .url {
      color: #94a3b8;
      font-size: 12px;
      max-width: 400px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .search-input {
      background: #0f172a;
      border: 1px solid #475569;
      color: #fff;
      padding: 6px 10px;
      border-radius: 6px;
      font-size: 12px;
      width: 220px;
      outline: none;
    }
    .search-input:focus {
      border-color: #38bdf8;
    }
    .btn {
      background: #3b82f6;
      color: #fff;
      border: none;
      padding: 6px 12px;
      border-radius: 6px;
      font-weight: 600;
      font-size: 12px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: background 0.15s;
    }
    .btn:hover { background: #2563eb; }
    .btn-secondary { background: #334155; color: #cbd5e1; }
    .btn-secondary:hover { background: #475569; color: #fff; }
    pre {
      margin: 0;
      padding: 16px;
      white-space: pre-wrap;
      word-break: break-word;
      tab-size: 2;
    }
    mark {
      background: #f59e0b;
      color: #000;
      border-radius: 2px;
      padding: 0 2px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="info">
      <span class="title">&lt;/&gt; Код сторінки [${projectName}]</span>
      <span class="url" title="${url}">${url}</span>
    </div>
    <div class="actions">
      <input type="text" id="searchInput" class="search-input" placeholder="Пошук у HTML коді..." oninput="highlightSearch()" />
      <span id="matchCount" style="color:#94a3b8;font-size:11px;"></span>
      <button class="btn btn-secondary" onclick="copySource()">📋 Скопіювати все</button>
      <button class="btn" onclick="location.reload()">🔄 Оновити</button>
    </div>
  </div>
  <pre id="codeBlock">${safeHtml}</pre>

  <script>
    const originalText = document.getElementById('codeBlock').innerHTML;
    function highlightSearch() {
      const q = document.getElementById('searchInput').value.trim();
      const code = document.getElementById('codeBlock');
      const counter = document.getElementById('matchCount');
      if (!q) {
        code.innerHTML = originalText;
        counter.textContent = '';
        return;
      }
      try {
        const escaped = q.replace(/[.*+?^$\\{\\}()|[\\]\\\\]/g, '\\\\$&');
        const regex = new RegExp('(' + escaped + ')', 'gi');
        const count = (code.innerText.match(regex) || []).length;
        counter.textContent = count + ' знайдено';
        code.innerHTML = originalText.replace(regex, '<mark>$1</mark>');
      } catch (_) {}
    }

    function copySource() {
      const text = document.getElementById('codeBlock').innerText;
      navigator.clipboard.writeText(text).then(() => {
        alert('HTML код скопійовано в буфер обміну!');
      });
    }
  </script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(pageHtml);
  } catch (error: any) {
    logger.error(`Error getting page source for ${projectName}`, error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function evalPageScript(req: Request, res: Response): Promise<void> {
  const projectName = req.params.projectName || 'SF';
  try {
    const session = sessions.get(projectName);
    if (!session || !isSessionBrowserAlive(session) || !session.page) {
      res.status(404).json({ success: false, error: 'Browser not alive' });
      return;
    }
    const { script } = req.body || {};
    const result = await session.page.evaluate((s: string) => {
      try {
        const val = eval(s);
        return { success: true, value: val };
      } catch (err: any) {
        return { success: false, error: err.message || String(err) };
      }
    }, script);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function evalContextAction(req: Request, res: Response): Promise<void> {
  const projectName = req.params.projectName || 'SF';
  try {
    const session = sessions.get(projectName);
    if (!session || !isSessionBrowserAlive(session) || !session.context) {
      res.status(404).json({ success: false, error: 'Browser context not alive' });
      return;
    }
    const pages = session.context.pages();
    const pagesInfo = await Promise.all(pages.map(async (p, idx) => ({
      index: idx,
      url: p.url(),
      title: await p.title().catch(() => '')
    })));

    const { action, pageIndex, urlFilter, script } = req.body || {};
    if (action === 'listPages') {
      res.json({ success: true, pages: pagesInfo });
      return;
    }

    if (!(session as any)._logsAttached && session.page) {
      (session as any)._logsAttached = true;
      (session as any)._capturedLogs = [];
      session.page.on('console', (msg) => {
        (session as any)._capturedLogs.push({ type: msg.type(), text: msg.text(), time: Date.now() });
        if ((session as any)._capturedLogs.length > 200) (session as any)._capturedLogs.shift();
      });
      session.page.on('pageerror', (err) => {
        (session as any)._capturedLogs.push({ type: 'pageerror', text: err.message, stack: err.stack, time: Date.now() });
      });
    }

    if (action === 'getLogs') {
      res.json({ success: true, logs: (session as any)._capturedLogs || [] });
      return;
    }

    let targetPage = session.page;
    if (typeof pageIndex === 'number' && pages[pageIndex]) {
      targetPage = pages[pageIndex];
    } else if (urlFilter) {
      targetPage = pages.find(p => p.url().includes(urlFilter)) || targetPage;
    }

    if (action === 'openPopup') {
      const p = await session.context.newPage();
      try {
        const extUrl = req.body?.url || 'moz-extension://bf680106-96a8-42ec-a070-07bf11c2e399/src/pages/popup/popup.html';
        await p.goto(extUrl, { waitUntil: 'domcontentloaded', timeout: 5000 });
        const finalUrl = p.url();
        const text = await p.evaluate(() => document.body?.innerText || '').catch(() => '');
        res.json({ success: true, url: finalUrl, text: text.slice(0, 300) });
      } catch (err: any) {
        res.json({ success: false, url: p.url(), error: err.message });
      }
      return;
    }

    if (action === 'injectAndReload') {
      const initCode = getRoninInjectionScript(projectName);
      await session.context.addInitScript({ content: initCode });
      if (session.page) {
        await session.page.addInitScript({ content: initCode });
        await session.page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
      }
      res.json({ success: true, message: 'Injected real Ronin EIP-6963 Bridge via DOM script tag observer' });
      return;
    }

    if (action === 'eval' && targetPage && script) {
      const result = await targetPage.evaluate((s: string) => {
        try {
          const val = eval(s);
          return { success: true, value: val };
        } catch (err: any) {
          return { success: false, error: err.message || String(err) };
        }
      }, script);
      res.json({ success: true, pages: pagesInfo, evalResult: result });
      return;
    }

    res.json({ success: true, pages: pagesInfo });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

