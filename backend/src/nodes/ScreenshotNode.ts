import { Logger } from '../logger';
import { NodeHandlerParams } from './types';
import { inputValidator } from '../validation/InputValidator';
import fs from 'fs';
import path from 'path';

const logger = new Logger('ScreenshotNode');

export const screenshotNodeHandler = async ({
  currentNode,
  activePage,
  ws,
  projectName,
  context,
  logToClient
}: NodeHandlerParams) => {
  const { mode = 'fullPage', selector = '', imageName = '' } = currentNode.data;

  try {
    // Validate selector if provided
    if (mode === 'selector' && selector) {
      const selectorValidation = inputValidator.validateSelector(selector);
      if (!selectorValidation.isValid) {
        logger.warn(`Screenshot node ${currentNode.id}: selector validation failed`, { selector, error: selectorValidation.error });
        logToClient(`❌ Скріншот: Невалідний селектор: ${selectorValidation.error}`, 'error');
        return { data: context, nextHandle: ['error'] };
      }
    }

    // Generate filename if not provided
    const filename = imageName || `screenshot_${Date.now()}.png`;
    
    // Ensure filename has .png extension
    const finalFilename = filename.endsWith('.png') ? filename : `${filename}.png`;
    
    // Create project-specific screenshots directory
    const projectsDir = path.join(__dirname, '../../projects');
    const screenshotsDir = path.join(projectsDir, `${projectName}_screenshots`);
    
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
    
    const screenshotPath = path.join(screenshotsDir, finalFilename);

    // Take screenshot based on mode
    if (mode === 'selector' && selector) {
      // Screenshot specific element
      const elementHandle = await activePage.$(selector);
      if (!elementHandle) {
        logToClient(`❌ Скріншот: Елемент не знайдено (${selector})`, 'error');
        return { data: context, nextHandle: ['error'] };
      }

      try {
        // Try to scroll element into view and take screenshot with timeout
        await elementHandle.scrollIntoViewIfNeeded();
        await elementHandle.screenshot({ 
          path: screenshotPath,
          timeout: 10000 // 10 second timeout
        });
        logToClient(`📸 Скріншот елемента збережено: ${finalFilename}`, 'success');
      } catch (screenshotErr: any) {
        // If element screenshot fails, fall back to full page screenshot
        logger.warn(`Element screenshot failed, falling back to full page`, { error: String(screenshotErr) });
        logToClient(`⚠️ Скріншот елемента не вдалося (елемент невидимий), робимо скріншот сторінки`, 'info');
        await activePage.screenshot({ path: screenshotPath, fullPage: true });
        logToClient(`📸 Скріншот сторінки збережено: ${finalFilename}`, 'success');
      }
    } else {
      // Full page screenshot
      await activePage.screenshot({ path: screenshotPath, fullPage: true });
      logToClient(`📸 Скріншот сторінки збережено: ${finalFilename}`, 'success');
    }

    // Send WebSocket message to frontend
    try {
      ws.send(JSON.stringify({
        type: 'SCREENSHOT_SAVED',
        projectName,
        filename: finalFilename,
        path: screenshotPath
      }));
    } catch (sendErr) {
      logger.warn(`Failed to send SCREENSHOT_SAVED for node ${currentNode.id}`, { error: String(sendErr) });
    }

    return {
      data: {
        ...context,
        imageNames: [...(context.imageNames || []), finalFilename],
        screenshotPath: `/api/screenshots/${projectName}/${finalFilename}`
      },
      nextHandle: 'next'
    };
  } catch (e: any) {
    logger.error(`ScreenshotNode error for node ${currentNode.id}`, e instanceof Error ? e : new Error(String(e)));
    logToClient(`❌ Скріншот помилка: ${e.message}`, 'error');
    return { data: context, nextHandle: ['error'] };
  }
};
