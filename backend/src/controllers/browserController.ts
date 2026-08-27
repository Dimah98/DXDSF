import { Request, Response } from 'express';
import { Logger } from '../logger';
import {
  sessions,
  getOrCreateSession,
  isSessionBrowserAlive,
  connectToBrowser,
  closeSessionBrowser
} from '../browserManager';
import { ensureBrowserSettings } from '../runner/ProjectRunner';

const logger = new Logger('BrowserController');

export function getBrowserEnv(_req: Request, res: Response): void {
  try {
    res.json({
      defaultProfile: process.env.ITBROWSER_PROFILE || 'Default',
      defaultProfileDir: process.env.ITBROWSER_PROFILE_DIR || 'Default'
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function openBrowser(req: Request, res: Response): Promise<void> {
  const projectName = req.params.projectName;
  try {
    let session = sessions.get(projectName);
    if (!session) {
      session = getOrCreateSession(projectName);
    }
    
    if (isSessionBrowserAlive(session)) {
      res.json({ success: true, message: 'Browser is already running' });
      return;
    }

    await ensureBrowserSettings(projectName, session);

    await connectToBrowser(
      session,
      session.botSettings?.width || session.botSettings?.browserWidth || 1280,
      session.botSettings?.height || session.botSettings?.browserHeight || 720,
      session.botSettings?.profile,
      session.botSettings?.profileDir,
      session.botSettings?.proxy
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
