import * as path from 'path';
import * as fs from 'fs';
import { getOrCreateSession, connectToBrowser } from './browserManager';
import { ensureBrowserSettings } from './runner/ProjectRunner';
import { buildingPlacerNodeHandler } from './nodes/BuildingPlacerNode';
import { PROJECTS_DIR } from './constants';

(async () => {
  const projectName = 'SF11';
  const session = getOrCreateSession(projectName);
  await ensureBrowserSettings(projectName, session);

  const width = session.botSettings?.width || session.botSettings?.browserWidth || 1280;
  const height = session.botSettings?.height || session.botSettings?.browserHeight || 720;

  console.log(`Connecting to browser for ${projectName}...`);
  const activePage = await connectToBrowser(
    session,
    width,
    height,
    session.botSettings?.profile,
    session.botSettings?.profileDir,
    session.botSettings?.proxy,
    true // forceHeaded
  );

  console.log('Connected to page:', activePage.url());

  const projectPath = path.join(PROJECTS_DIR, `${projectName}.json`);
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
    projectName,
    logToClient,
    activePage,
    smartSleep,
    ws: null
  };

  try {
    const result = await buildingPlacerNodeHandler(params);
    console.log('Result:', result);
  } catch (err) {
    console.error('Execution failed:', err);
  }

  await activePage.screenshot({ path: 'd:/SF/scratch/run_node_result.png' });
  console.log('Screenshot saved to d:/SF/scratch/run_node_result.png');

  // DO NOT close browser so user keeps their session!
  process.exit(0);
})();
