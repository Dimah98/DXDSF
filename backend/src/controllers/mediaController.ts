import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { Logger } from '../logger';
import { PROJECTS_DIR } from '../constants';
import { inputValidator } from '../validation/InputValidator';

const logger = new Logger('MediaController');
const IMAGES_DIR = path.join(__dirname, '../../images');

export async function getImages(_req: Request, res: Response): Promise<void> {
  try {
    try {
      if (!fs.existsSync(IMAGES_DIR)) {
        await fs.promises.mkdir(IMAGES_DIR, { recursive: true });
        logger.info('Created images directory', { path: IMAGES_DIR });
      }
    } catch (mkdirErr) {
      logger.error('Failed to create images directory', mkdirErr instanceof Error ? mkdirErr : new Error(String(mkdirErr)), { path: IMAGES_DIR });
      res.status(500).json({ success: false, error: 'Failed to access images directory.' });
      return;
    }
    
    try {
      const files = await fs.promises.readdir(IMAGES_DIR);
      const imageFiles = files.filter(f => /\.(png|jpg|jpeg)$/i.test(f));
      res.json(imageFiles);
    } catch (readErr) {
      logger.error('Failed to read images directory', readErr instanceof Error ? readErr : new Error(String(readErr)), { path: IMAGES_DIR });
      res.status(500).json({ success: false, error: 'Failed to load images list.' });
    }
  } catch (err: any) { 
    logger.error('Images endpoint error', err instanceof Error ? err : new Error(String(err)));
    res.status(500).json({ success: false, error: 'Failed to process images request.' }); 
  }
}

export async function getScreenshots(req: Request, res: Response): Promise<void> {
  try {
    const { projectName } = req.params;
    
    const validation = inputValidator.validateProjectName(projectName);
    if (!validation.isValid) {
      logger.warn('Screenshots list failed: invalid project name', { projectName });
      res.status(400).json({ success: false, error: validation.error });
      return;
    }
    
    const screenshotsDir = path.join(PROJECTS_DIR, `${projectName}_screenshots`);
    
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
    
    const files = await fs.promises.readdir(screenshotsDir);
    const screenshotFiles = files.filter(f => f.endsWith('.png'));
    
    res.json(screenshotFiles);
  } catch (err: any) {
    logger.error('Screenshots list endpoint error', err instanceof Error ? err : new Error(String(err)));
    res.status(500).json({ success: false, error: 'Failed to load screenshots list.' });
  }
}

export async function deleteScreenshot(req: Request, res: Response): Promise<void> {
  try {
    const { projectName, filename } = req.params;
    
    const validation = inputValidator.validateProjectName(projectName);
    if (!validation.isValid) {
      logger.warn('Screenshot delete failed: invalid project name', { projectName });
      res.status(400).json({ success: false, error: validation.error });
      return;
    }
    
    if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      logger.warn('Screenshot delete failed: invalid filename', { filename });
      res.status(400).json({ success: false, error: 'Invalid filename' });
      return;
    }
    
    const screenshotsDir = path.join(PROJECTS_DIR, `${projectName}_screenshots`);
    const filePath = path.join(screenshotsDir, filename);
    
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ success: false, error: 'Screenshot not found' });
      return;
    }
    
    await fs.promises.unlink(filePath);
    logger.info('Screenshot deleted', { projectName, filename });
    
    res.json({ success: true });
  } catch (err: any) {
    logger.error('Screenshot delete endpoint error', err instanceof Error ? err : new Error(String(err)));
    res.status(500).json({ success: false, error: 'Failed to delete screenshot.' });
  }
}
