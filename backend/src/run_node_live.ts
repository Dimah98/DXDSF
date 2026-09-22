import { chromium } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';
import { buildingPlacerNodeHandler } from './nodes/BuildingPlacerNode';
import { PROJECTS_DIR } from './constants';

(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const context = browser.contexts()[0];
  const page = context.pages().find(p => p.url().includes('sunflower-land.com'));
  if (!page) {
    console.error('Page not found!');
    await browser.close();
    return;
  }

  console.log('Connected to page:', page.url());

  const projectPath = path.join(PROJECTS_DIR, 'SF11.json');
  const proj = JSON.parse(fs.readFileSync(projectPath, 'utf-8'));
  const node = proj.nodes.find((n: any) => n.type === 'buildingPlacerNode');
  console.log('Node config:', node.data);

  const logs: string[] = [];
  const logToClient = (msg: string, type?: 'info' | 'error' | 'success' | 'debug') => {
    const entry = `[${type || 'info'}] ${msg}`;
    console.log(entry);
    logs.push(entry);
  };

  const smartSleep = (ms: number) => new Promise(res => setTimeout(res, ms));

  const params: any = {
    currentNode: node,
    context: {},
    projectName: 'SF11',
    logToClient,
    activePage: page,
    smartSleep,
    ws: null
  };

  try {
    const result = await buildingPlacerNodeHandler(params);
    console.log('Result:', result);
  } catch (err) {
    console.error('Execution failed:', err);
  }

  await page.screenshot({ path: 'd:/SF/scratch/run_node_result.png' });
  console.log('Screenshot saved to d:/SF/scratch/run_node_result.png');

  await browser.close();
})();
