// Нода «Гра на Пам'ять» — автоматичне проходження міні-гри memory-match
// Використовує комп'ютерний зір (аналіз скріншотів) для знаходження карток,
// ідентифікації зображень та стратегічного перевертання пар.
// Весь аналіз пікселів виконується В NODE.JS без page.evaluate (щоб уникнути
// помилки "Execution context was destroyed" при навігації/рендерингу гри).

import fs from 'fs';
import path from 'path';
import { NodeHandlerParams } from './types'; // Імпорт типів параметрів обробника ноди
import { Logger } from '../logger'; // Імпорт логера
import { Page } from 'playwright'; // Імпорт типу сторінки Playwright
import type WebSocket from 'ws'; // Імпорт типу WebSocket для анотацій
import { parsePng, encodePng } from '../utils/pngParser';
import { MEMORY_INVALID_TEMPLATES_DIR } from '../constants';

const logger = new Logger('MemoryGameNode'); // Ініціалізація логера

// ─── Шаблони некоректних / порожніх карток ──────────────────────────────────

interface InvalidTemplate {
  name: string;
  fingerprint: string;
}

let cachedInvalidTemplates: InvalidTemplate[] | null = null;

// Завантажує шаблони некоректних карток (напівповернуті, порожні місця, зниклі карти)
async function loadInvalidTemplates(): Promise<InvalidTemplate[]> {
  if (cachedInvalidTemplates && cachedInvalidTemplates.length > 0) {
    return cachedInvalidTemplates;
  }

  const templates: InvalidTemplate[] = [];
  try {
    if (fs.existsSync(MEMORY_INVALID_TEMPLATES_DIR)) {
      const files = fs.readdirSync(MEMORY_INVALID_TEMPLATES_DIR).filter(f => f.endsWith('.png'));
      for (const file of files) {
        const filePath = path.join(MEMORY_INVALID_TEMPLATES_DIR, file);
        const buf = fs.readFileSync(filePath);
        const pngData = await parsePng(buf);
        if (pngData) {
          const fp = await extractFingerprintFromPng(pngData);
          if (fp) {
            templates.push({ name: file, fingerprint: fp });
          }
        }
      }
      logger.info(`Завантажено ${templates.length} шаблонів некоректних карток`);
    }
  } catch (err) {
    logger.warn('Помилка завантаження шаблонів некоректних карток', { error: String(err) });
  }

  cachedInvalidTemplates = templates;
  return templates;
}

// Перевіряє чи відбиток картки схожий на один із шаблонів некоректних карток
function checkInvalidCard(
  fp: string,
  invalidTemplates: InvalidTemplate[],
  threshold = 0.70
): { isInvalid: boolean; templateName?: string; similarity: number } {
  if (!fp || invalidTemplates.length === 0) return { isInvalid: false, similarity: 0 };
  for (const t of invalidTemplates) {
    const sim = fingerprintSimilarity(fp, t.fingerprint);
    if (sim >= threshold) {
      return { isInvalid: true, templateName: t.name, similarity: sim };
    }
  }
  return { isInvalid: false, similarity: 0 };
}

// ─── Допоміжні функції малювання для Фотодебагу ─────────────────────────────

// Малює прямокутну рамку на RGBA пікселях
function drawRect(pixels: Buffer, W: number, H: number, x0: number, y0: number, x1: number, y1: number, r: number, g: number, b: number, thickness = 2) {
  const minX = Math.max(0, Math.min(x0, x1));
  const maxX = Math.min(W - 1, Math.max(x0, x1));
  const minY = Math.max(0, Math.min(y0, y1));
  const maxY = Math.min(H - 1, Math.max(y0, y1));

  for (let t = 0; t < thickness; t++) {
    for (let x = minX; x <= maxX; x++) {
      if (minY + t < H) {
        const i1 = ((minY + t) * W + x) * 4;
        pixels[i1] = r; pixels[i1 + 1] = g; pixels[i1 + 2] = b; pixels[i1 + 3] = 255;
      }
      if (maxY - t >= 0) {
        const i2 = ((maxY - t) * W + x) * 4;
        pixels[i2] = r; pixels[i2 + 1] = g; pixels[i2 + 2] = b; pixels[i2 + 3] = 255;
      }
    }
    for (let y = minY; y <= maxY; y++) {
      if (minX + t < W) {
        const i1 = (y * W + (minX + t)) * 4;
        pixels[i1] = r; pixels[i1 + 1] = g; pixels[i1 + 2] = b; pixels[i1 + 3] = 255;
      }
      if (maxX - t >= 0) {
        const i2 = (y * W + (maxX - t)) * 4;
        pixels[i2] = r; pixels[i2 + 1] = g; pixels[i2 + 2] = b; pixels[i2 + 3] = 255;
      }
    }
  }
}

// Малює заповнену точку на RGBA пікселях
function drawDot(pixels: Buffer, W: number, H: number, cx: number, cy: number, radius: number, r: number, g: number, b: number) {
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const x = cx + dx;
      const y = cy + dy;
      if (x >= 0 && x < W && y >= 0 && y < H) {
        const i = (y * W + x) * 4;
        pixels[i] = r; pixels[i + 1] = g; pixels[i + 2] = b; pixels[i + 3] = 255;
      }
    }
  }
}

// ─── Типи ───────────────────────────────────────────────────────────────────

// Інформація про одну картку в сітці гри з урахуванням розмірів у viewport
interface GameCard { // Опис структури об'єкта картки
  row: number;       // Рядок у сітці карток (починаючи з 0)
  col: number;       // Стовпець у сітці карток (починаючи з 0)
  sx: number;        // Координата X центру карти на скріншоті
  sy: number;        // Координата Y центру карти на скріншоті
  vpX: number;       // Координата X центру карти у вікні перегляду (viewport)
  vpY: number;       // Координата Y центру карти у вікні перегляду (viewport)
  vpW: number;       // Ширина карти у координатах вікна перегляду
  vpH: number;       // Висота карти у координатах вікна перегляду
  cardW: number;     // Ширина карти у пікселях оригінального скріншоту
  cardH: number;     // Висота карти у пікселях оригінального скріншоту
  fingerprint: string | null;  // Унікальний відбиток зображення карти (null якщо не відкривали)
  matched: boolean;  // Прапорець, який вказує чи знайдено пару для цієї карти
} // Кінець опису структури картки

// ─── Допоміжні функції ──────────────────────────────────────────────────────

// Функція для скріншоту з повторними спробами при падінні сторінки
async function screenshotWithRetry( // Функція знімку екрана з ретраями
  page: Page, // Об'єкт сторінки Playwright
  options: any, // Параметри скріншоту
  retries = 3, // Кількість спроб
  delay = 800 // Затримка між спробами (мс)
): Promise<Buffer> { // Повертає бінарний буфер
  for (let i = 0; i < retries; i++) { // Цикл спроб
    try { // Спроба скріншоту
      return await page.screenshot(options); // Знімаємо екран
    } catch (err: any) { // Обробка помилки
      if (i < retries - 1) { // Якщо ще є спроби
        logger.warn(`Screenshot failed (спроба ${i + 1}/${retries}): ${err.message}`); // Попередження
        await new Promise(r => setTimeout(r, delay)); // Очікуємо перед повтором
      } else { // Спроби вичерпані
        throw err; // Прокидаємо помилку
      } // Кінець умови
    } // Кінець catch
  } // Кінець циклу
  throw new Error('screenshotWithRetry: спроби вичерпані'); // Фінальна помилка
} // Кінець screenshotWithRetry

// Надсилає скріншот напряму у вкладку фотодебагу без збереження в файл
async function sendDebugPhoto( // Функція надсилання дебаг-фото через WebSocket
  ws: WebSocket, // WebSocket з'єднання
  label: string, // Підпис фото
  nodeId: string, // ID ноди
  buf: Buffer // PNG буфер
): Promise<void> { // Без повернення значення
  if (!ws || ws.readyState !== 1) return; // Перевіряємо активність з'єднання
  try { // Спроба надсилання
    const base64 = `data:image/png;base64,${buf.toString('base64')}`; // Формуємо data URL
    ws.send(JSON.stringify({ // Надсилаємо WebSocket повідомлення
      type: 'DEBUG_SNAPSHOT', // Тип повідомлення для вкладки фотодебагу
      nodeId, // Ідентифікатор поточної ноди
      nodeTitle: label, // Підпис (назва) для відображення
      image: base64, // Зображення у форматі base64 data URL
      timestamp: Date.now() // Мітка часу
    })); // Кінець send
  } catch (e) { // Обробка помилки надсилання
    logger.warn('sendDebugPhoto failed', { error: String(e) }); // Логування
  } // Кінець catch
} // Кінець sendDebugPhoto

// Порівнює два відбитки карток — повертає коефіцієнт схожості (0.0 - 1.0)
function fingerprintSimilarity(fp1: string, fp2: string): number { // Функція порівняння відбитків
  const a = fp1.split(',').map(Number); // Парсинг першого відбитку
  const b = fp2.split(',').map(Number); // Парсинг другого відбитку
  if (a.length !== b.length || a.length === 0) return 0; // Перевірка сумісності розмірів

  let matches = 0; // Лічильник співпадань
  for (let i = 0; i < a.length; i++) { // Цикл по значеннях
    if (Math.abs(a[i] - b[i]) <= 1) matches++; // Збіг з допуском ±1
  } // Кінець циклу
  return matches / a.length; // Повертаємо коефіцієнт схожості
} // Кінець fingerprintSimilarity

// Знаходить сітку карток на скріншоті шляхом аналізу фіолетових пікселів у Node.js
async function detectGrid( // Функція пошуку сітки карток
  activePage: Page, // Сторінка Playwright
  dpr: number, // devicePixelRatio браузера
  useCropZone: boolean, // Чи використовувати зону обрізки
  cropX: number, // Початок зони X
  cropY: number, // Початок зони Y
  cropW: number, // Ширина зони
  cropH: number, // Висота зони
  ws: WebSocket, // WebSocket для надсилання дебаг-фото
  nodeId: string // ID ноди
): Promise<GameCard[] | null> { // Повертає масив карток або null
  // Параметри скріншоту — з обрізкою або весь viewport
  const screenshotOptions: any = { type: 'png' }; // Базові опції
  if (useCropZone && cropW > 0 && cropH > 0) { // Якщо зона обрізки задана
    screenshotOptions.clip = { x: cropX, y: cropY, width: cropW, height: cropH }; // Встановлюємо clip
  } // Кінець умови

  // Знімаємо скріншот з повторними спробами
  const buf = await screenshotWithRetry(activePage, screenshotOptions); // Отримуємо PNG буфер

  // Розпарсуємо PNG буфер повністю в Node.js — без page.evaluate
  const pngData = await parsePng(buf); // Розпарсування PNG
  if (!pngData) return null; // Якщо парсинг не вдався

  const { width: W, height: H, pixels: px } = pngData; // Деструктуризація даних

  // Перевірка чи піксель є фіолетовою карткою (закрита картка гри Пам'ять)
  const isPurple = (idx: number): boolean => { // Функція перевірки кольору пікселя
    const r = px[idx];     // Червоний канал
    const g = px[idx + 1]; // Зелений канал
    const b = px[idx + 2]; // Синій канал
    // Фіолетові картки мають: помірний червоний, малий зелений, великий синій
    return r > 30 && r < 190 && g < 120 && b > 55 && (b - g) > 10; // Результат фільтру
  }; // Кінець isPurple

  // Обчислюємо щільність фіолетових пікселів по стовпцях та рядках
  const colDensity = new Float32Array(W); // Горизонтальна гістограма
  const rowDensity = new Float32Array(H); // Вертикальна гістограма

  for (let y = 0; y < H; y++) { // Цикл по рядках зображення
    for (let x = 0; x < W; x++) { // Цикл по стовпцях
      if (isPurple((y * W + x) * 4)) { // Якщо піксель фіолетовий
        colDensity[x]++; // Збільшуємо щільність стовпця
        rowDensity[y]++; // Збільшуємо щільність рядка
      } // Кінець умови
    } // Кінець стовпців
  } // Кінець рядків

  // Функція пошуку піків у гістограмі щільності
  const findPeaks = (density: Float32Array, len: number, minGap: number) => { // Пошук піків
    let maxVal = 0; // Максимальне значення
    for (let i = 0; i < len; i++) if (density[i] > maxVal) maxVal = density[i]; // Пошук максимуму
    const threshold = maxVal * 0.2; // Поріг = 20% від максимуму
    const peaks: { start: number; end: number; center: number }[] = []; // Масив піків
    let inPeak = false; // Чи знаходимося в піку
    let start = 0; // Початок піку

    for (let i = 0; i < len; i++) { // Цикл по гістограмі
      if (density[i] > threshold && !inPeak) { // Початок піку
        inPeak = true; start = i; // Запам'ятовуємо початок
      } else if ((density[i] <= threshold || i === len - 1) && inPeak) { // Кінець піку
        inPeak = false; // Вийшли з піку
        const end = i; // Кінець піку
        const center = Math.round((start + end) / 2); // Центр піку
        // Об'єднуємо близькі піки
        if (peaks.length > 0 && center - peaks[peaks.length - 1].center < minGap) { // Якщо близько
          peaks[peaks.length - 1].end = end; // Розширюємо попередній пік
          peaks[peaks.length - 1].center = Math.round((peaks[peaks.length - 1].start + end) / 2); // Новий центр
        } else { // Якщо далеко
          peaks.push({ start, end, center }); // Додаємо новий пік
        } // Кінець умови злиття
      } // Кінець умови піку
    } // Кінець циклу
    return peaks; // Повертаємо піки
  }; // Кінець findPeaks

  const colPeaks = findPeaks(colDensity, W, Math.floor(W * 0.04)); // Піки стовпців
  const rowPeaks = findPeaks(rowDensity, H, Math.floor(H * 0.04)); // Піки рядків

  const minCardWidth = 50; // Мінімальна ширина картки 50 пікселів
  const minCardHeight = 50; // Мінімальна висота картки 50 пікселів
  const filteredCols = colPeaks.filter(p => (p.end - p.start) >= minCardWidth); // Відфільтровані стовпці (>= 50px)
  const filteredRows = rowPeaks.filter(p => (p.end - p.start) >= minCardHeight); // Відфільтровані рядки (>= 50px)

  const rawCards: any[] = []; // Масив знайдених карток
  for (let r = 0; r < filteredRows.length; r++) { // Цикл по рядках
    for (let c = 0; c < filteredCols.length; c++) { // Цикл по стовпцях
      const cx = filteredCols[c].center; // X центру картки
      const cy = filteredRows[r].center; // Y центру картки
      const w = filteredCols[c].end - filteredCols[c].start; // Ширина картки
      const h = filteredRows[r].end - filteredRows[r].start; // Висота картки

      if (w < minCardWidth || h < minCardHeight) continue; // Мінімальний розмір карти 50x50 пікселів

      let purpleCount = 0; // Лічильник фіолетових пікселів
      const sR = 5; // Радіус перевірки
      let totalSamples = 0; // Загальна кількість зразків
      for (let dy = -sR; dy <= sR; dy++) { // Вертикальний зсув
        for (let dx = -sR; dx <= sR; dx++) { // Горизонтальний зсув
          const sx = cx + dx * 3; // X точки зразка
          const sy = cy + dy * 3; // Y точки зразка
          if (sx >= 0 && sx < W && sy >= 0 && sy < H) { // Перевірка меж
            totalSamples++; // Збільшуємо лічильник
            if (isPurple((sy * W + sx) * 4)) purpleCount++; // Фіолетовий?
          } // Кінець перевірки меж
        } // Кінець горизонтального циклу
      } // Кінець вертикального циклу
      if (totalSamples > 0 && purpleCount / totalSamples > 0.25) { // Якщо більше 25% фіолетових
        rawCards.push({ row: r, col: c, cx, cy, w, h }); // Додаємо картку
      } // Кінець перевірки
    } // Кінець стовпців
  } // Кінець рядків

  if (rawCards.length === 0) return null; // Карток не знайдено

  // ── Візуальна розмітка знайденої сітки для Фотодебагу ────────────────────
  try {
    const annotatedPx = Buffer.from(px); // Клонуємо пікселі
    for (const c of rawCards) {
      const halfW = Math.floor(c.w / 2);
      const halfH = Math.floor(c.h / 2);
      // Малюємо яскраву зелену рамку навколо кожної знайденої картки
      drawRect(annotatedPx, W, H, c.cx - halfW, c.cy - halfH, c.cx + halfW, c.cy + halfH, 0, 255, 128, 3);
      // Малюємо центральну точку картки
      drawDot(annotatedPx, W, H, c.cx, c.cy, 3, 255, 255, 0);
    }
    const annotatedBuf = encodePng({ width: W, height: H, pixels: annotatedPx });
    await sendDebugPhoto(ws, `🎯 Виявлена сітка (${rawCards.length} карток [${filteredRows.length}×${filteredCols.length}])`, nodeId, annotatedBuf);
  } catch (annotErr) {
    logger.warn('Failed to generate annotated grid debug photo', { error: String(annotErr) });
    await sendDebugPhoto(ws, '📸 Поле карток (аналіз сітки)', nodeId, buf);
  }

  const offsetX = useCropZone ? cropX : 0; // Зсув X для crop-зони
  const offsetY = useCropZone ? cropY : 0; // Зсув Y для crop-зони

  // Конвертуємо координати знімку у координати viewport
  return rawCards.map((c: any): GameCard => { // Маппінг карток
    const vpX = offsetX + Math.round(c.cx / dpr); // Абсолютна X у viewport
    const vpY = offsetY + Math.round(c.cy / dpr); // Абсолютна Y у viewport
    const vpW = Math.round(c.w / dpr); // Ширина у viewport
    const vpH = Math.round(c.h / dpr); // Висота у viewport
    return { // Об'єкт GameCard
      row: c.row, col: c.col, // Позиція в сітці
      sx: c.cx, sy: c.cy, // Координати на скріншоті
      vpX, vpY, vpW, vpH, // Координати у viewport
      cardW: c.w, cardH: c.h, // Розміри у пікселях скріншоту
      fingerprint: null, // Відбиток буде знятий пізніше
      matched: false // Ще не зібрана
    }; // Кінець об'єкту
  }); // Кінець маппінгу
} // Кінець detectGrid

// Повторно сканує всі збережені позиції початкової сітки карток (masterGrid)
async function rescanMasterGrid(
  activePage: Page,
  masterGrid: GameCard[],
  _dpr: number,
  useCropZone: boolean,
  cropX: number,
  cropY: number,
  cropW: number,
  cropH: number,
  ws?: WebSocket,
  nodeId?: string
): Promise<GameCard[]> {
  const screenshotOptions: any = { type: 'png' };
  if (useCropZone && cropW > 0 && cropH > 0) {
    screenshotOptions.clip = { x: cropX, y: cropY, width: cropW, height: cropH };
  }

  const buf = await screenshotWithRetry(activePage, screenshotOptions);
  const pngData = await parsePng(buf);
  if (!pngData) return [];

  const { width: W, height: H, pixels: px } = pngData;
  const activeRemainingCards: GameCard[] = [];

  const isPurple = (idx: number): boolean => {
    const r = px[idx];
    const g = px[idx + 1];
    const b = px[idx + 2];
    return r > 30 && r < 190 && g < 120 && b > 55 && (b - g) > 10;
  };

  const debugAnnotatedPx = Buffer.from(px);

  for (const masterCard of masterGrid) {
    const cx = masterCard.sx;
    const cy = masterCard.sy;
    const halfW = Math.floor(masterCard.cardW / 2);
    const halfH = Math.floor(masterCard.cardH / 2);

    let purpleCount = 0;
    let totalSamples = 0;
    const step = 2;
    for (let dy = -Math.floor(halfH * 0.5); dy <= Math.floor(halfH * 0.5); dy += step) {
      for (let dx = -Math.floor(halfW * 0.5); dx <= Math.floor(halfW * 0.5); dx += step) {
        const sx = cx + dx;
        const sy = cy + dy;
        if (sx >= 0 && sx < W && sy >= 0 && sy < H) {
          totalSamples++;
          if (isPurple((sy * W + sx) * 4)) purpleCount++;
        }
      }
    }

    const purpleRatio = totalSamples > 0 ? (purpleCount / totalSamples) : 0;

    // Якщо частка фіолетових пікселів > 20% — картка все ще присутня і закрита!
    if (purpleRatio > 0.20) {
      const remainingCard: GameCard = {
        ...masterCard,
        fingerprint: null,
        matched: false
      };
      activeRemainingCards.push(remainingCard);

      // Малюємо зелену рамку навколо знайденої активної картки
      drawRect(debugAnnotatedPx, W, H, cx - halfW, cy - halfH, cx + halfW, cy + halfH, 0, 255, 128, 3);
      drawDot(debugAnnotatedPx, W, H, cx, cy, 3, 255, 255, 0);
    } else {
      // Малюємо сіру рамку на вже зібраних/відкритих позиціях
      drawRect(debugAnnotatedPx, W, H, cx - halfW, cy - halfH, cx + halfW, cy + halfH, 120, 120, 120, 1);
    }
  }

  if (ws && nodeId) {
    try {
      const debugBuf = encodePng({ width: W, height: H, pixels: debugAnnotatedPx });
      await sendDebugPhoto(ws, `🎯 Повторне сканування (${activeRemainingCards.length}/${masterGrid.length} закритих карток)`, nodeId, debugBuf);
    } catch {}
  }

  return activeRemainingCards;
}

// Обчислює частку фіолетових пікселів на картці (високий відсоток = закрита сорочка, низький = відкрита картка)
function calculatePurpleRatio(pngData: { width: number; height: number; pixels: Buffer }): number {
  const { width: W, height: H, pixels: px } = pngData;
  let purpleCount = 0;
  let total = 0;
  // Перевіряємо центральні 60% площі картки
  const startX = Math.floor(W * 0.2);
  const endX = Math.floor(W * 0.8);
  const startY = Math.floor(H * 0.2);
  const endY = Math.floor(H * 0.8);

  for (let y = startY; y < endY; y += 2) {
    for (let x = startX; x < endX; x += 2) {
      const idx = (y * W + x) * 4;
      const r = px[idx], g = px[idx + 1], b = px[idx + 2];
      if (r > 30 && r < 190 && g < 120 && b > 55 && (b - g) > 10) {
        purpleCount++;
      }
      total++;
    }
  }
  return total > 0 ? purpleCount / total : 1.0;
}

// Витягує цифровий відбиток з розпарсованого знімку картки та надсилає анотований знімок
async function extractFingerprintFromPng(
  pngData: { width: number; height: number; pixels: Buffer },
  ws?: WebSocket,
  nodeId?: string,
  label?: string
): Promise<string> {
  const { width: W, height: H, pixels: px } = pngData;

  const sampleSize = 6;
  const rW = Math.floor(W * 0.5);
  const rH = Math.floor(H * 0.5);
  const startX = Math.floor(W / 2 - rW / 2);
  const startY = Math.floor(H / 2 - rH / 2);
  const samples: number[] = [];
  const samplePoints: { x: number; y: number }[] = [];

  for (let sy = 0; sy < sampleSize; sy++) {
    for (let sx = 0; sx < sampleSize; sx++) {
      const ppx = startX + Math.floor(sx * rW / (sampleSize - 1));
      const ppy = startY + Math.floor(sy * rH / (sampleSize - 1));
      if (ppx >= 0 && ppx < W && ppy >= 0 && ppy < H) {
        samplePoints.push({ x: ppx, y: ppy });
        const i = (ppy * W + ppx) * 4;
        samples.push(
          Math.floor(px[i] / 32),
          Math.floor(px[i + 1] / 32),
          Math.floor(px[i + 2] / 32)
        );
      }
    }
  }

  if (ws && nodeId && label) {
    try {
      const cardDebugBuf = encodePng({ width: W, height: H, pixels: px });
      await sendDebugPhoto(ws, label, nodeId, cardDebugBuf);
    } catch {}
  }

  return samples.join(',');
}

interface OpenCardResult {
  fingerprint: string;
  isInvalid: boolean;
  invalidTemplate?: string;
  similarityToInvalid?: number;
}

// Адаптивне відкриття картки: клікає та опитує стан кожні 80-100мс доки картка не повернеться обличчям
async function openCardAndCaptureFingerprint(
  activePage: Page,
  card: GameCard,
  ws: WebSocket | undefined,
  nodeId: string,
  label: string,
  logToClient: (msg: string, level?: 'info' | 'error' | 'success' | 'debug') => void,
  invalidTemplates: InvalidTemplate[] = [],
  maxWaitMs = 1200
): Promise<OpenCardResult> {
  const clip = {
    x: Math.max(0, card.vpX - Math.floor(card.vpW / 2)),
    y: Math.max(0, card.vpY - Math.floor(card.vpH / 2)),
    width: card.vpW,
    height: card.vpH
  };

  // Клікаємо по картці
  await activePage.mouse.click(card.vpX, card.vpY);

  const startTime = Date.now();
  let lastPngData: { width: number; height: number; pixels: Buffer } | null = null;
  let attempts = 0;

  // Адаптивне очікування відкриття
  while (Date.now() - startTime < maxWaitMs) {
    attempts++;
    // Коротка пауза перед наступною перевіркою
    await new Promise(r => setTimeout(r, attempts === 1 ? 180 : 80));

    try {
      const buf = await screenshotWithRetry(activePage, { type: 'png', clip }, 2, 100);
      const pngData = await parsePng(buf);
      if (pngData) {
        lastPngData = pngData;
        const purpleRatio = calculatePurpleRatio(pngData);

        // Якщо частка фіолетових пікселів впала нижче 35% — картка відкривається або відкрита!
        if (purpleRatio < 0.35) {
          const fp = await extractFingerprintFromPng(pngData, ws, nodeId, label);
          const invalidCheck = checkInvalidCard(fp, invalidTemplates, 0.72);

          // Якщо відбиток збігається з шаблоном напівперевернутої карти і ще є час — чекаємо повного розвороту
          if (invalidCheck.isInvalid && Date.now() - startTime < 600) {
            logToClient(`⏳ Картка (${card.row},${card.col}) у процесі анімації (${invalidCheck.templateName}), очікую...`, 'debug');
            continue;
          }

          const elapsed = Date.now() - startTime;
          if (invalidCheck.isInvalid) {
            logToClient(`🚫 Картка (${card.row},${card.col}) збігається з некоректним/порожнім шаблоном (${invalidCheck.templateName}, ${Math.round(invalidCheck.similarity * 100)}%)`, 'info');
            return {
              fingerprint: fp,
              isInvalid: true,
              invalidTemplate: invalidCheck.templateName,
              similarityToInvalid: invalidCheck.similarity
            };
          }

          logToClient(`👁️ Картка (${card.row},${card.col}) відкрита за ${elapsed}мс (фіолетового: ${Math.round(purpleRatio * 100)}%)`, 'debug');
          return { fingerprint: fp, isInvalid: false };
        }
      }
    } catch {}

    // Якщо пройшло 500мс, а картка все ще фіолетова (> 50%) — можливо клік не зареєструвався через анімацію
    if (Date.now() - startTime > 500 && attempts === 4) {
      logToClient(`🔄 Повторний клік по (${card.row},${card.col}) через затримку анімації...`, 'debug');
      try {
        await activePage.mouse.click(card.vpX, card.vpY);
      } catch {}
    }
  }

  // Якщо час вичерпано, беремо останній знімок
  if (lastPngData) {
    const purpleRatio = calculatePurpleRatio(lastPngData);
    const fp = await extractFingerprintFromPng(lastPngData, ws, nodeId, label);
    const invalidCheck = checkInvalidCard(fp, invalidTemplates, 0.72);
    if (invalidCheck.isInvalid) {
      logToClient(`🚫 Картка (${card.row},${card.col}) збігається з некоректним/порожнім шаблоном (${invalidCheck.templateName}, ${Math.round(invalidCheck.similarity * 100)}%)`, 'info');
      return {
        fingerprint: fp,
        isInvalid: true,
        invalidTemplate: invalidCheck.templateName,
        similarityToInvalid: invalidCheck.similarity
      };
    }
    if (purpleRatio >= 0.40) {
      logToClient(`⚠️ Картка (${card.row},${card.col}) схоже залишилась закритою (${Math.round(purpleRatio * 100)}% фіолетового)`, 'error');
    }
    return { fingerprint: fp, isInvalid: false };
  }

  return { fingerprint: '', isInvalid: false };
}

// ─── Головний обробник ноди ─────────────────────────────────────────────────

export const memoryGameNodeHandler = async ({ // Головна функція-обробник ноди
  currentNode, // Поточна нода сценарію
  activePage, // Активна сторінка браузера
  ws, // WebSocket з'єднання
  context, // Контекст виконання
  logToClient, // Функція логування на клієнт
  smartSleep, // Функція паузи з підтримкою перевірки зупинки
  checkRunning, // Функція перевірки чи працює бот (для безпечної зупинки циклу)
}: NodeHandlerParams) => { // Кінець параметрів

  // Зчитуємо налаштування з інтерфейсу ноди
  const nodeData = currentNode.data as Record<string, unknown>;
  const { // Деструктуризація даних ноди
    flipDelay = 800,       // Затримка анімації перевороту (мс)
    mismatchDelay = 1500,  // Затримка після невдалого перевороту (мс)
    useCropZone = false,   // Чи використовувати зону обрізки
    cropX = 0,             // X зони обрізки
    cropY = 0,             // Y зони обрізки
    cropW = 800,           // Ширина зони обрізки
    cropH = 600,           // Висота зони обрізки
    exitButtonTexts = '',  // Тексти кнопок завершення (через кому або новий рядок)
    matchThreshold = 0.75, // Поріг схожості пар (від 0.0 до 1.0, за замовчуванням 0.75)
  } = nodeData; // Дані ноди

  const MATCH_THRESHOLD = matchThreshold as number; // Визначаємо поріг схожості для визнання пари на основі налаштувань ноди

  // Парсимо список текстів/селекторів кнопок виходу з рядка налаштувань
  const exitTexts: string[] = String(exitButtonTexts) // Приводимо до рядка
    .split(/\n/)        // Розбиваємо по новому рядку (кома може бути частиною тексту)
    .map(s => s.trim()) // Обрізаємо пробіли
    .filter(Boolean);   // Видаляємо порожні рядки

  // Визначає чи рядок є CSS-селектором (містить спецсимволи селекторів)
  const isCssSelector = (s: string): boolean => // Перевірка на CSS-селектор
    /[:.\[#(>~+]/.test(s); // Наявність символів типових для CSS-селекторів

  // Знаходить елемент в основній сторінці або в будь-якому фреймі
  const findInPageAndFrames = async (
    searchFn: (ctx: { locator: (sel: string) => any; getByText: (t: string, opts?: any) => any; getByRole: (r: any, opts?: any) => any }) => Promise<number>
  ): Promise<number> => { // Повертає кількість знайдених елементів
    // Спочатку перевіряємо основну сторінку
    try { // Спроба в основній сторінці
      const cnt = await searchFn({ // Виклик функції пошуку
        locator: (sel) => activePage.locator(sel), // Локатор основної сторінки
        getByText: (t, o) => activePage.getByText(t, o), // Пошук по тексту
        getByRole: (r, o) => activePage.getByRole(r, o), // Пошук по ролі
      }); // Кінець об'єкту
      if (cnt > 0) return cnt; // Знайдено в основній сторінці
    } catch { /* ігноруємо */ } // Помилка основної сторінки

    // Перевіряємо всі фрейми (iframe) — гра може бути всередині фрейму
    for (const frame of activePage.frames()) { // Цикл по фреймах
      if (frame === activePage.mainFrame()) continue; // Пропускаємо головний фрейм
      try { // Спроба у фреймі
        const cnt = await searchFn({ // Виклик функції у фреймі
          locator: (sel) => frame.locator(sel), // Локатор фрейму
          getByText: (t, o) => frame.getByText(t, o), // Текст у фреймі
          getByRole: (r, o) => frame.getByRole(r, o), // Роль у фреймі
        }); // Кінець об'єкту
        if (cnt > 0) return cnt; // Знайдено у фреймі
      } catch { /* ігноруємо */ } // Помилка фрейму
    } // Кінець циклу фреймів
    return 0; // Не знайдено ніде
  }; // Кінець findInPageAndFrames

  // Перевіряє наявність кнопок завершення (підтримує CSS-селектори та текст, шукає в iframe)
  const checkExitButtons = async (verbose = false): Promise<string | null> => { // Повертає знайдений елемент або null
    if (exitTexts.length === 0) return null; // Якщо список порожній — пропускаємо

    for (const entry of exitTexts) { // Перебираємо всі записи
      try { // Блок пошуку
        let count = 0; // Кількість знайдених елементів

        if (isCssSelector(entry)) { // Якщо виглядає як CSS-селектор
          // Використовуємо напряму як CSS-селектор Playwright
          count = await findInPageAndFrames(async ({ locator }) => { // Пошук по селектору
            return await locator(entry).count(); // Кількість елементів за селектором
          }); // Кінець виклику
          if (verbose) logToClient(`🔍 Селектор "${entry}": ${count} елем.`, 'debug'); // Лог
        } else { // Звичайний текст
          // Підхід 1: пошук по тексту в кнопках/посиланнях
          const safeRegex = new RegExp( // Безпечний регекс
            entry.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), // Екранування спецсимволів
            'i' // Регістронезалежний
          ); // Кінець регекс

          count = await findInPageAndFrames(async ({ locator }) => { // Пошук через filter
            return await locator('button, a, [role="button"], input[type="button"], input[type="submit"]') // Інтерактивні елементи
              .filter({ hasText: safeRegex }) // Фільтр по тексту
              .count(); // Кількість
          }); // Кінець виклику

          // Підхід 2: getByRole якщо підхід 1 не знайшов
          if (count === 0) { // Якщо нічого не знайдено
            count = await findInPageAndFrames(async ({ getByRole }) => { // Пошук по ролі
              return await getByRole('button', { name: safeRegex }).count(); // Кнопка по імені
            }); // Кінець виклику
          } // Кінець підходу 2

          // Підхід 3: getByText — пошук будь-якого елемента з таким текстом
          if (count === 0) { // Якщо досі не знайдено
            count = await findInPageAndFrames(async ({ getByText }) => { // Пошук по тексту
              return await getByText(entry, { exact: false }).count(); // Пошук з частковим збігом
            }); // Кінець виклику
          } // Кінець підходу 3

          if (verbose) logToClient(`🔍 Текст "${entry}": ${count} елем.`, 'debug'); // Лог
        } // Кінець розгалуження

        if (count > 0) return entry; // Знайдено — повертаємо
      } catch (err: any) { // Обробка помилок
        if (verbose) logToClient(`⚠️ Помилка пошуку "${entry}": ${err.message}`, 'debug'); // Лог помилки
      } // Кінець catch
    } // Кінець циклу

    return null; // Нічого не знайдено
  }; // Кінець checkExitButtons

  logToClient(`🎮 Гра на Пам'ять: старт...`, 'info'); // Старт гри

  // Завантажуємо шаблони некоректних карток (напівповернуті, порожні тощо)
  const invalidTemplates = await loadInvalidTemplates();
  if (invalidTemplates.length > 0) {
    logToClient(`🔍 Завантажено ${invalidTemplates.length} шаблонів некоректних карток`, 'debug');
  }

  try { // Основний блок перехоплення помилок

    // ── ДІАГНОСТИКА: 2 скріншоти на початку ─────────────────────────────────

    // 1. Скріншот всього вікна браузера для перевірки
    logToClient(`📷 Діагностика: знімаю все вікно...`, 'debug'); // Лог
    try { // Спроба знімку
      const fullBuf = await screenshotWithRetry(activePage, { type: 'png' }); // Весь viewport
      await sendDebugPhoto(ws, '🖥️ Все вікно (діагностика)', currentNode.id, fullBuf); // Відправка
      logToClient(`✅ Скріншот вікна надіслано у Фотодебаг`, 'debug'); // Підтвердження
    } catch (diagErr: any) { // Помилка знімку
      logToClient(`⚠️ Не вдалося зробити скріншот вікна: ${diagErr.message}`, 'error'); // Лог помилки
    } // Кінець блоку знімку вікна

    // 2. Скріншот тільки поля карток (з урахуванням crop-зони)
    if (useCropZone && (cropW as number) > 0 && (cropH as number) > 0) { // Якщо задана crop-зона
      logToClient(`📷 Діагностика: знімаю поле карток (${cropX},${cropY} ${cropW}×${cropH})...`, 'debug');
      try { // Спроба знімку crop-зони
        const cropBuf = await screenshotWithRetry(activePage, { // Знімаємо crop-зону
          type: 'png',
          clip: { x: cropX as number, y: cropY as number, width: cropW as number, height: cropH as number } // Параметри обрізки
        }); // Кінець опцій
        await sendDebugPhoto(ws, '🃏 Поле карток (crop-зона)', currentNode.id, cropBuf); // Відправка
        logToClient(`✅ Скріншот поля карток надіслано у Фотодебаг`, 'debug'); // Підтвердження
      } catch (diagErr: any) { // Помилка знімку
        logToClient(`⚠️ Не вдалося зробити скріншот crop-зони: ${diagErr.message}`, 'error'); // Лог
      } // Кінець блоку
    } // Кінець якщо crop-зона

    // ── ОСНОВНА ЛОГІКА ───────────────────────────────────────────────────────

    // Отримуємо devicePixelRatio через page.evaluate з обробкою помилок
    let dpr = 1; // Значення за замовчуванням
    try { // Спроба отримати DPR
      dpr = await activePage.evaluate(() => window.devicePixelRatio || 1); // Читаємо DPR
    } catch (dprErr: any) { // Якщо контекст знищено
      logToClient(`⚠️ Не вдалося отримати DPR (${dprErr.message}), використовуємо 1`, 'debug'); // Лог
    } // Кінець блоку DPR

    // Знаходимо сітку карток (скріншот + аналіз PNG в Node.js)
    logToClient(`📸 Аналіз сітки карток (dpr=${dpr})...`, 'debug'); // Початок аналізу
    const initialCards = await detectGrid( // Виклик функції пошуку сітки
      activePage, dpr, useCropZone as boolean, cropX as number, cropY as number, cropW as number, cropH as number, // Параметри
      ws, currentNode.id // WebSocket та ID ноди
    ); // Кінець виклику

    if (!initialCards || initialCards.length < 4) { // Якщо карток не знайдено
      logToClient(`❌ Не вдалося знайти сітку карток (знайдено: ${initialCards?.length ?? 0})`, 'error'); // Помилка
      return { data: context, nextHandle: ['error'] }; // Вихід через червоний порт
    } // Кінець перевірки

    const masterGrid: GameCard[] = initialCards.map(c => ({ ...c })); // Зберігаємо початкову майстер-сітку
    let cards: GameCard[] = initialCards;
    const totalCards = masterGrid.length; // Загальна кількість карток
    const totalPairs = Math.floor(totalCards / 2); // Кількість пар
    logToClient(`📐 Знайдено ${totalCards} карток (${Math.max(...masterGrid.map(c => c.row)) + 1}×${Math.max(...masterGrid.map(c => c.col)) + 1}), шукаємо ${totalPairs} пар.`, 'success'); // Успіх

    // Пам'ять бота: індекс картки → відбиток зображення
    const cardFingerprints = new Map<number, string>(); // Map відбитків
    let matchedPairs = 0; // Знайдених пар
    let moveCount = 0; // Кількість ходів
    const maxMoves = Math.max(totalCards * 4, 30); // Максимум ходів

    // Знаходить відому пару серед запам'ятованих карток
    const findKnownPair = (): [number, number] | null => { // Функція пошуку відомої пари
      const known = Array.from(cardFingerprints.entries()) // Всі відомі відбитки
        .filter(([idx]) => !cards[idx].matched); // Тільки незібрані

      for (let i = 0; i < known.length; i++) { // Зовнішній цикл
        for (let j = i + 1; j < known.length; j++) { // Внутрішній цикл
          const sim = fingerprintSimilarity(known[i][1], known[j][1]); // Схожість
          if (sim >= MATCH_THRESHOLD) { // Якщо схожі
            return [known[i][0], known[j][0]]; // Повертаємо пару
          } // Кінець перевірки
        } // Кінець внутрішнього циклу
      } // Кінець зовнішнього циклу
      return null; // Пари не знайдено
    }; // Кінець findKnownPair

    // Знаходить картку в пам'яті що збігається із заданим відбитком
    const findMatchInMemory = (fp: string, excludeIdx: number): number | null => { // Пошук в пам'яті
      for (const [idx, storedFp] of cardFingerprints) { // Перебираємо пам'ять
        if (idx !== excludeIdx && !cards[idx].matched) { // Не поточна і не зібрана
          if (fingerprintSimilarity(fp, storedFp) >= MATCH_THRESHOLD) { // Схожий відбиток
            return idx; // Повертаємо індекс
          } // Кінець перевірки схожості
        } // Кінець умови
      } // Кінець циклу
      return null; // Не знайдено
    }; // Кінець findMatchInMemory

    // ── Перша перевірка кнопок завершення ПЕРЕД початком гри ────────────────
    if (exitTexts.length > 0) { // Логуємо стан перевірки
      const frameCount = activePage.frames().length; // Кількість фреймів
      logToClient(`🔍 Перевіряю кнопки завершення (${exitTexts.length} варіантів, ${frameCount} фреймів)...`, 'debug');
    } // Кінець логу
    const exitBeforeGame = await checkExitButtons(true); // Перевіряємо з вербозним логу
    if (exitBeforeGame) { // Якщо кнопка вже є
      logToClient(`🏁 Виявлено кнопку завершення "${exitBeforeGame}" — гра вже завершена`, 'success');
      return { // Успішний вихід
        data: { ...context, matchedPairs: 0, moveCount: 0, value: 0 }, // Контекст
        nextHandle: [null, undefined, 'success'], // Зелений порт
      }; // Кінець early exit
    } // Кінець перевірки до гри

    // ── Головний цикл гри ───────────────────────────────────────────────────

    while (matchedPairs < totalPairs && moveCount < maxMoves && checkRunning()) { // Цикл ходів поки не зібрано всі пари і бот запущений
      if (!checkRunning()) { // Якщо бот був зупинений користувачем
        break; // Негайно зупиняємо виконання циклу
      }
      moveCount++; // Збільшуємо лічильник ходів
      const knownPair = findKnownPair(); // Шукаємо відому пару

      if (knownPair) { // Є відома пара
        const [idx1, idx2] = knownPair; // Індекси карток пари
        logToClient( // Лог відомої пари
          `🧠 Хід ${moveCount}: відома пара (${cards[idx1].row},${cards[idx1].col}) + (${cards[idx2].row},${cards[idx2].col})`,
          'info'
        ); // Кінець лог

        await activePage.mouse.click(cards[idx1].vpX, cards[idx1].vpY); // Клік по першій картці
        await smartSleep(Math.min(flipDelay as number, 500), ws); // Пауза анімації
        await activePage.mouse.click(cards[idx2].vpX, cards[idx2].vpY); // Клік по другій картці
        await smartSleep(Math.min(flipDelay as number, 500), ws); // Пауза анімації

        cards[idx1].matched = true; // Позначаємо першу як зібрану
        cards[idx2].matched = true; // Позначаємо другу як зібрану
        matchedPairs++; // Збільшуємо лічильник пар

        logToClient(`✅ Пара ${matchedPairs}/${totalPairs}!`, 'success'); // Успіх
        await smartSleep(mismatchDelay as number, ws); // Пауза анімації зникнення

      } else { // Немає відомих пар — досліджуємо нові картки

        const unknowns = cards // Незнайомі незібрані картки
          .map((c, i) => ({ card: c, idx: i })) // З індексами
          .filter(({ card }) => !card.matched && card.fingerprint === null); // Фільтр

        let idx1: number; // Індекс першої картки
        let idx2: number; // Індекс другої картки

        if (unknowns.length >= 2) { // Є 2+ невідомих
          idx1 = unknowns[0].idx; // Перша невідома
          idx2 = unknowns[1].idx; // Друга невідома
        } else if (unknowns.length === 1) { // Лише 1 невідома
          idx1 = unknowns[0].idx; // Перша (невідома)
          const knownUnmatched = cards // Відомі незібрані
            .map((c, i) => ({ card: c, idx: i }))
            .filter(({ card, idx: i }) => !card.matched && card.fingerprint !== null && i !== idx1);
          if (knownUnmatched.length === 0) { // Нема партнера — оновлюємо сітку
            logToClient(`🔄 Залишилась лише 1 невідома карта без пари — перевіряю всі початкові позиції (${masterGrid.length} шт.)...`, 'info');
            cardFingerprints.clear();
            await smartSleep(600, ws);
            const refreshedCards = await rescanMasterGrid(
              activePage, masterGrid, dpr, useCropZone as boolean, cropX as number, cropY as number, cropW as number, cropH as number,
              ws, currentNode.id
            );
            if (refreshedCards && refreshedCards.length >= 2) {
              cards = refreshedCards;
              logToClient(`🎯 Повторне сканування: виявлено ${cards.length}/${masterGrid.length} закритих карток — починаю з початку!`, 'success');
              continue;
            } else {
              logToClient(`🏁 Закритих карток більше не знайдено — завершення`, 'info');
              break;
            }
          }
          idx2 = knownUnmatched[0].idx; // Відома незібрана як партнер
        } else {
          // Пройдено всі карти 1 раз
          logToClient(`🔄 Пройдено всі карти 1 раз — очищую пам'ять та перевіряю всі ${masterGrid.length} початкових позицій...`, 'info');
          cardFingerprints.clear();
          await smartSleep(600, ws);

          const refreshedCards = await rescanMasterGrid(
            activePage, masterGrid, dpr, useCropZone as boolean, cropX as number, cropY as number, cropW as number, cropH as number,
            ws, currentNode.id
          );

          if (refreshedCards && refreshedCards.length >= 2) {
            cards = refreshedCards;
            logToClient(`🎯 Повторне сканування: виявлено ${cards.length}/${masterGrid.length} закритих карток — починаю з початку!`, 'success');
            continue; // Починаємо з початку на свіжій сітці
          } else {
            logToClient(`🏁 Закритих карток більше не виявлено — перевіряю кнопку завершення...`, 'info');
            const finalExit = await checkExitButtons(true);
            if (finalExit) {
              logToClient(`🎉 Гру завершено! Кнопка "${finalExit}" знайдена`, 'success');
            }
            return {
              data: { ...context, matchedPairs, moveCount, value: matchedPairs },
              nextHandle: [null, undefined, 'success'],
            };
          }
        }

        // 1-ша картка: відкриваємо та адаптивно чекаємо появи зображення
        logToClient(`👆 Хід ${moveCount}: відкриваю (${cards[idx1].row},${cards[idx1].col})...`, 'debug');
        const res1 = await openCardAndCaptureFingerprint(
          activePage, cards[idx1], ws, currentNode.id,
          `🃏 Картка (${cards[idx1].row},${cards[idx1].col})`,
          logToClient, invalidTemplates, Math.max(flipDelay as number, 1200)
        );

        if (res1.isInvalid) {
          cards[idx1].matched = true; // Позначаємо зібраною/порожньою
          cards[idx1].fingerprint = null;
          cardFingerprints.delete(idx1);
          await smartSleep(mismatchDelay as number, ws);
          continue; // Переходимо до наступного ходу
        }

        const fp1 = res1.fingerprint;
        cards[idx1].fingerprint = fp1;
        cardFingerprints.set(idx1, fp1);

        // Перевіряємо чи вже знаємо пару для цієї картки у пам'яті
        const memoryMatch = findMatchInMemory(fp1, idx1);
        if (memoryMatch !== null) {
          idx2 = memoryMatch;
          logToClient(`🧠 Знайшов пару в пам'яті! → (${cards[idx2].row},${cards[idx2].col})`, 'info');
        }

        // Невелика пауза між кліками для надійності браузера
        await smartSleep(150, ws);

        // 2-га картка: відкриваємо та адаптивно зчитуємо відбиток у момент відкриття
        logToClient(`👆 Відкриваю (${cards[idx2].row},${cards[idx2].col})...`, 'debug');
        const res2 = await openCardAndCaptureFingerprint(
          activePage, cards[idx2], ws, currentNode.id,
          `🃏 Картка (${cards[idx2].row},${cards[idx2].col})`,
          logToClient, invalidTemplates, Math.max(flipDelay as number, 1200)
        );

        if (res2.isInvalid) {
          cards[idx2].matched = true; // Позначаємо зібраною/порожньою
          cards[idx2].fingerprint = null;
          cardFingerprints.delete(idx2);
          await smartSleep(mismatchDelay as number, ws);
          continue;
        }

        const fp2 = res2.fingerprint;
        cards[idx2].fingerprint = fp2;
        cardFingerprints.set(idx2, fp2);

        const similarity = fingerprintSimilarity(fp1, fp2);

        if (similarity >= MATCH_THRESHOLD) { // Збіг!
          cards[idx1].matched = true; // Перша зібрана
          cards[idx2].matched = true; // Друга зібрана
          matchedPairs++; // Збільшуємо лічильник
          logToClient(`✅ Збіг! Пара ${matchedPairs}/${totalPairs} (схожість: ${Math.round(similarity * 100)}%)`, 'success');
          // Пауза анімації зникнення пари
          await smartSleep(mismatchDelay as number, ws);
        } else { // Не збіг
          logToClient(`❌ Не збіг (${Math.round(similarity * 100)}%). Запам'ятовано.`, 'debug');
          // Чекаємо поки гра завершить анімацію перевертання карток назад, щоб уникнути animation lock
          await smartSleep(Math.max(mismatchDelay as number, 1200), ws);
        }

      } // Кінець розгалуження відомих пар

      if (moveCount % 5 === 0) { // Кожні 5 ходів
        logToClient(`📊 Прогрес: ${matchedPairs}/${totalPairs} пар, ${moveCount} ходів`, 'info');
      } // Кінець прогресу

      // Після кожного ходу перевіряємо чи з'явилась кнопка завершення
      const exitFound = await checkExitButtons(true); // Пошук з вербозним логом
      if (exitFound) { // Якщо знайдено
        logToClient(`🏁 Виявлено кнопку завершення "${exitFound}" після ${moveCount} ходів`, 'success');
        return { // Успішний вихід
          data: { ...context, matchedPairs, moveCount, value: matchedPairs }, // Контекст
          nextHandle: [null, undefined, 'success'], // Зелений порт
        }; // Кінець exit
      } // Кінець перевірки кнопки
    } // Кінець головного циклу

    // ── Результат ────────────────────────────────────────────────────────────

    if (matchedPairs >= totalPairs) { // Гра завершена
      logToClient(`🎉 Гру пройдено! ${matchedPairs} пар знайдено за ${moveCount} ходів`, 'success');
      return { // Успішний вихід
        data: { ...context, matchedPairs, moveCount, value: matchedPairs }, // Контекст
        nextHandle: [null, undefined, 'success'], // Зелений порт
      }; // Кінець success
    } else { // Ліміт ходів вичерпано
      logToClient(`⚠️ Ліміт ходів вичерпано (${maxMoves}). Знайдено ${matchedPairs}/${totalPairs} пар.`, 'error');
      return { data: context, nextHandle: ['error'] }; // Червоний порт
    } // Кінець перевірки результату

  } catch (err: any) { // Обробка загальних помилок
    logger.error(`MemoryGame failed for node ${currentNode.id}`, err instanceof Error ? err : new Error(String(err)));
    logToClient(`❌ Помилка гри: ${err.message}`, 'error'); // Лог помилки
    return { data: context, nextHandle: ['error'] }; // Вихід через помилку
  } // Кінець try-catch
}; // Кінець memoryGameNodeHandler
