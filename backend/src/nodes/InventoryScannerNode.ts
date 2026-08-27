import { Logger } from '../logger';
import { upsertInventoryItem } from '../db/schema';
import { NodeHandlerParams, NodeResult, InventoryScannerNodeData, ScanResult, InventoryFile } from './types';
import { inputValidator } from '../validation/InputValidator';
import { PROJECTS_DIR } from '../constants';
import * as fs from 'fs';
import * as path from 'path';

const logger = new Logger('InventoryScannerNode');

/**
 * InventoryScannerNode handler
 * 
 * Scans web page elements using CSS selectors and extracts image + numeric data pairs.
 * Results are saved to {projectName}_inventory.json for persistence.
 * 
 * Requirements: 1.1, 1.8
 * 
 * Handles:
 * - success: Scanning completed (items found or empty array)
 * - error: Scanning failed due to invalid selector or browser error
 */
export const inventoryScannerNodeHandler = async ({
  currentNode,
  activePage,
  ws,
  context,
  projectName,
  nodeTitle,
  logToClient,
  takeDebugSnapshot
}: NodeHandlerParams): Promise<NodeResult> => {
  const nodeData = currentNode.data as unknown as InventoryScannerNodeData;
  const { selector, containerSelector, mode = 'all', imageSource = 'auto', numberRegex } = nodeData;
  
  // Requirement 1.8: Validate CSS selector before Playwright operations
  if (!selector || typeof selector !== 'string') {
    logger.warn(`InventoryScanner node ${currentNode.id}: missing or invalid selector`, { selector });
    logToClient(`❌ Селектор не вказано або невалідний`, 'error');
    
    // Requirement 1.8: Send WebSocket error message
    try {
      ws.send(JSON.stringify({
        type: 'NODE_DATA_UPDATE',
        nodeId: currentNode.id,
        data: { status: 'Невалідний селектор' }
      }));
    } catch (sendErr) {
      logger.warn(`Failed to send NODE_DATA_UPDATE for node ${currentNode.id}`, { error: String(sendErr) });
    }
    
    // Requirement 1.8: Continue execution through error handle path
    return { nextHandle: 'error', data: context };
  }
  
  const selectorValidation = inputValidator.validateSelector(selector);
  if (!selectorValidation.isValid) {
    logger.warn(`InventoryScanner node ${currentNode.id}: selector validation failed`, { 
      selector, 
      error: selectorValidation.error 
    });
    logToClient(`❌ Невалідний селектор: ${selectorValidation.error}`, 'error');
    
    try {
      ws.send(JSON.stringify({
        type: 'NODE_DATA_UPDATE',
        nodeId: currentNode.id,
        data: { status: `Помилка: ${selectorValidation.error}` }
      }));
    } catch (sendErr) {
      logger.warn(`Failed to send NODE_DATA_UPDATE for node ${currentNode.id}`, { error: String(sendErr) });
    }
    
    return { nextHandle: 'error', data: context };
  }
  
  logToClient(`🔍 Сканування інвентаря: ${selector}`, 'info');
  if (containerSelector) {
    logToClient(`📦 Обмеження пошуку: ${containerSelector}`, 'info');
  }
  
  const scanStartTime = Date.now();
  let scanResults: ScanResult[] = [];
  
  try {
    // Requirement 1.1: Scan all elements matching the selector (or first if mode='first')
    const regexPattern = numberRegex || '(\\d+(?:\\.\\d+)?)';
    
    // Requirement 1.1-1.3: Execute browser query to extract image and number data
    const results = await activePage.evaluate(({ sel, containerSel, scanMode, imgSource, numPattern }) => {
      // First find the container if specified
      let searchRoot: Element | Document = document;
      if (containerSel) {
        const container = document.querySelector(containerSel);
        if (!container) {
          // Container not found - return empty array
          return [];
        }
        searchRoot = container;
      }
      
      // Find elements within the container (or document)
      const elements = Array.from(searchRoot.querySelectorAll(sel));
      const elementsToScan = scanMode === 'first' ? elements.slice(0, 1) : elements;
      
      const items = elementsToScan.map((el) => {
        // Requirement 1.2: Extract image from src or backgroundImage
        let imageUrl = '';
        
        if (imgSource === 'src' || imgSource === 'auto') {
          // Check if element itself is IMG
          if (el.tagName === 'IMG' && (el as HTMLImageElement).src) {
            imageUrl = (el as HTMLImageElement).src;
          }
          // If not, search for IMG inside element
          else {
            const imgElement = el.querySelector('img');
            if (imgElement && imgElement.src) {
              imageUrl = imgElement.src;
            }
          }
        }
        
        if (!imageUrl && (imgSource === 'background' || imgSource === 'auto')) {
          const bg = window.getComputedStyle(el).backgroundImage;
          const match = bg.match(/url\(["']?([^"']*)["']?\)/);
          if (match && match[1]) {
            imageUrl = match[1];
          }
        }
        
        // Requirement 1.3: Extract numeric value from text content
        const text = (el as HTMLElement).innerText || (el as HTMLElement).textContent || '';
        const numMatch = text.match(new RegExp(numPattern));
        const number = numMatch ? parseFloat(numMatch[1]) : 0;
        
        // Get element coordinates for debugging
        const rect = el.getBoundingClientRect();
        const coords = {
          x: Math.round(rect.left + window.scrollX + rect.width / 2),
          y: Math.round(rect.top + window.scrollY + rect.height / 2)
        };
        
        return {
          image: imageUrl,
          number: number,
          selector: sel,
          coords: coords
        };
      })
      .filter(item => item.image && item.number > 0); // Only include items with valid images AND number > 0
      
      // Remove duplicates based on image URL
      const uniqueItems = Array.from(
        new Map(items.map(item => [item.image, item])).values()
      );
      
      return uniqueItems;
    }, { 
      sel: selector,
      containerSel: containerSelector || null,
      scanMode: mode, 
      imgSource: imageSource, 
      numPattern: regexPattern 
    });
    
    scanResults = results;
    
    // Save all images as PNG files and replace URLs with local paths
    logToClient(`🔄 Збереження зображень як PNG файли...`, 'info');
    const SCALE_FACTOR = 4; // Збільшуємо маленькі зображення
    const MIN_SIZE = 32; // Мінімальний розмір для масштабування
    
    // Create a single shared images directory for all projects
    const imagesDir = path.join(__dirname, '../../images');
    try {
      await fs.promises.mkdir(imagesDir, { recursive: true });
    } catch (mkdirErr) {
      logger.error('Failed to create images directory', mkdirErr instanceof Error ? mkdirErr : new Error(String(mkdirErr)));
    }
    
    for (let i = 0; i < scanResults.length; i++) {
      const item = scanResults[i];
      
      if (item.image) {
        try {
          // Get PNG buffer from browser
          const pngBuffer = await activePage.evaluate((args) => {
            return new Promise<string>((resolve, reject) => {
              const img = new Image();
              img.crossOrigin = 'anonymous';
              
              img.onload = () => {
                // Determine if we need to scale
                const needsScaling = img.width < args.minSize || img.height < args.minSize;
                const actualScale = needsScaling ? args.scale : 1;
                
                const canvas = document.createElement('canvas');
                canvas.width = img.width * actualScale;
                canvas.height = img.height * actualScale;
                
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                  reject(new Error('Cannot get canvas context'));
                  return;
                }
                
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                
                try {
                  // Return as base64 for transfer
                  const dataUrl = canvas.toDataURL('image/png');
                  resolve(dataUrl);
                } catch (err) {
                  reject(err);
                }
              };
              
              img.onerror = () => reject(new Error('Failed to load image'));
              img.src = args.imageUrl;
            });
          }, { imageUrl: item.image, scale: SCALE_FACTOR, minSize: MIN_SIZE });
          
          // Convert base64 to buffer
          const base64Data = pngBuffer.replace(/^data:image\/png;base64,/, '');
          const buffer = Buffer.from(base64Data, 'base64');
          
          // Формуємо назву файлу з двох останніх сегментів URL
          // Наприклад: /crops/rhubarb/seed.png → rhubarb_seed.png
          let filename: string;
          try {
            const url = new URL(item.image);
            // Розбиваємо pathname на сегменти та фільтруємо порожні
            const segments = url.pathname.split('/').filter(Boolean);
            if (segments.length >= 2) {
              // Беремо передостанній (папка) та останній (файл) сегменти
              const folderName = segments[segments.length - 2];
              const baseName = path.basename(segments[segments.length - 1]);
              const nameWithoutExt = baseName.replace(/\.[^/.]+$/, '');
              filename = `${folderName}_${nameWithoutExt}.png`;
            } else {
              // Якщо сегментів мало — просто беремо ім'я файлу
              const baseName = path.basename(url.pathname);
              const nameWithoutExt = baseName.replace(/\.[^/.]+$/, '');
              filename = `${nameWithoutExt}.png`;
            }
          } catch (urlErr) {
            // Якщо парсинг URL не вдався — формуємо запасну назву
            filename = `item_${i + 1}.png`;
          }
          
          const filepath = path.join(imagesDir, filename);
          
          // Save PNG file
          await fs.promises.writeFile(filepath, buffer);
          
          // Replace image URL with local path (relative to images directory)
          scanResults[i].image = `/api/images/${filename}`;
          
          logger.debug(`Saved image as PNG file`, { 
            filename,
            originalUrl: item.image,
            size: buffer.length
          });
        } catch (convErr) {
          logger.warn(`Failed to save image ${i + 1} as PNG`, {
            error: convErr instanceof Error ? convErr.message : String(convErr)
          });
          // Keep original URL if save fails
        }
      }
    }
    logToClient(`✅ Збережено ${scanResults.length} зображень як PNG`, 'success');
    
    const scanDuration = Date.now() - scanStartTime;
    
    // Requirement 1.5: Log warning when no elements found
    if (scanResults.length === 0) {
      logger.info(`InventoryScanner node ${currentNode.id}: no elements found`, { selector, containerSelector, mode });
      if (containerSelector) {
        logToClient(`⚠️ Елементи не знайдено. Перевірте контейнер: ${containerSelector}`, 'debug');
      } else {
        logToClient(`⚠️ Елементи не знайдено для селектора: ${selector}`, 'debug');
      }
    } else {
      logger.info(`InventoryScanner node ${currentNode.id}: found ${scanResults.length} items`, { 
        selector, 
        count: scanResults.length,
        duration: scanDuration 
      });
      logToClient(`✅ Знайдено ${scanResults.length} елементів інвентаря`, 'success');
      
      // Take debug snapshot with first element highlighted
      if (scanResults.length > 0 && scanResults[0].coords) {
        await takeDebugSnapshot(currentNode.id, nodeTitle, { selector });
      }
    }
    
    // Requirement 1.4: Save results to file system for persistence
    const inventoryFilePath = path.join(PROJECTS_DIR, `${projectName}_inventory.json`);
    
    const inventoryData: InventoryFile = {
      projectName,
      data: scanResults,
      timestamp: Date.now(),
      version: '1.0',
      metadata: {
        selector,
        itemCount: scanResults.length,
        scanDuration
      }
    };
    
    try {
      await fs.promises.writeFile(
        inventoryFilePath, 
        JSON.stringify(inventoryData, null, 2), 
        'utf-8'
      );
      logger.info(`Inventory data saved successfully`, { 
        projectName, 
        path: inventoryFilePath, 
        itemCount: scanResults.length 
      });
    // SQLite: sync inventory items
    try {
      for (const item of scanResults) {
        const itemName = item.image ? (item.image.split('/').pop() || '').replace(/.[^/.]+$/, '') : 'unknown';
        upsertInventoryItem(projectName, itemName, item.number, item.image);
      }
    } catch (dbErr) {
      logger.warn('Failed to sync inventory to SQLite', { error: String(dbErr) });
    }

    } catch (saveErr) {
      logger.error(`Failed to save inventory file`, saveErr instanceof Error ? saveErr : new Error(String(saveErr)), {
        projectName,
        path: inventoryFilePath
      });
      logToClient(`⚠️ Не вдалося зберегти дані інвентаря`, 'error');
      // Continue execution - data loss is not critical for node flow
    }
    
    // Requirement 1.7: Send WebSocket notification with scan results
    try {
      ws.send(JSON.stringify({
        type: 'NODE_DATA_UPDATE',
        nodeId: currentNode.id,
        data: { 
          status: `✅ Знайдено: ${scanResults.length}`,
          lastScanCount: scanResults.length,
          lastScanTime: Date.now()
        }
      }));
    } catch (sendErr) {
      logger.warn(`Failed to send NODE_DATA_UPDATE for node ${currentNode.id}`, { error: String(sendErr) });
    }
    
    // Requirement 1.4: Return results in context for next nodes
    return {
      nextHandle: 'success',
      data: {
        ...context,
        inventoryResults: scanResults,
        count: scanResults.length
      }
    };
    
  } catch (err) {
    // Requirement 1.8: Error handling with logging and WebSocket notification
    logger.error(`InventoryScanner node ${currentNode.id} failed`, err instanceof Error ? err : new Error(String(err)), {
      selector,
      projectName
    });
    logToClient(`❌ Помилка сканування: ${err instanceof Error ? err.message : String(err)}`, 'error');
    
    try {
      ws.send(JSON.stringify({
        type: 'NODE_DATA_UPDATE',
        nodeId: currentNode.id,
        data: { status: 'Помилка сканування' }
      }));
    } catch (sendErr) {
      logger.warn(`Failed to send NODE_DATA_UPDATE for node ${currentNode.id}`, { error: String(sendErr) });
    }
    
    // Requirement 1.8: Continue execution through error handle path
    return { nextHandle: 'error', data: context };
  }
};
