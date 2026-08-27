import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  RONIN_EXTENSION_ID,
  PROJECTS_DIR,
  SAVE_PATH,
  DEFAULT_HTTP_PORT
} from '../constants';
import {
  schedulerService,
  notificationService,
  wsLifecycle,
  browserLifecycle,
  timerManager,
  memoryMonitor,
  browserSemaphore
} from './index';

describe('Centralized Services & Constants', () => {
  it('should export all required constants from constants.ts', () => {
    expect(RONIN_EXTENSION_ID).toBe('fnjhmkhhmkbjkkabndcnnogagogbneec');
    expect(PROJECTS_DIR).toBeDefined();
    expect(SAVE_PATH).toBeDefined();
    expect(DEFAULT_HTTP_PORT).toBe(3001);
  });

  it('should initialize and export all singleton services', () => {
    expect(schedulerService).toBeDefined();
    expect(notificationService).toBeDefined();
    expect(wsLifecycle).toBeDefined();
    expect(browserLifecycle).toBeDefined();
    expect(timerManager).toBeDefined();
    expect(memoryMonitor).toBeDefined();
    expect(browserSemaphore).toBeDefined();
  });

  it('should ensure no files in nodes/ or lifecycle/ import from root index.ts', () => {
    const nodesDir = path.join(__dirname, '../nodes');
    const lifecycleDir = path.join(__dirname, '../lifecycle');

    const checkDir = (dir: string) => {
      const files = fs.readdirSync(dir).filter(f => f.endsWith('.ts'));
      for (const file of files) {
        const content = fs.readFileSync(path.join(dir, file), 'utf-8');
        // Match `from '../index'` or `from '../../index'`
        const hasRootIndexImport = /from\s+['"]\.\.\/index['"]/.test(content) || /from\s+['"]\.\.\/\.\.\/index['"]/.test(content);
        expect(hasRootIndexImport, `File ${file} should not import from root index.ts`).toBe(false);
      }
    };

    checkDir(nodesDir);
    checkDir(lifecycleDir);
  });
});
