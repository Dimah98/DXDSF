// Нода «Гра на Пам'ять» — автоматичне проходження міні-гри memory-match
// Використовує комп'ютерний зір (аналіз скріншотів) для знаходження карток,
// ідентифікації зображень та стратегічного перевертання пар.
// Весь аналіз пікселів виконується В NODE.JS без page.evaluate (щоб уникнути
// помилки "Execution context was destroyed" при навігації/рендерингу гри).

import { NodeHandlerParams } from './types'; // Імпорт типів параметрів обробника ноди
import { Logger } from '../logger'; // Імпорт логера
import { Page } from 'playwright'; // Імпорт типу сторінки Playwright
import * as zlib from 'zlib'; // Імпорт zlib для розпакування PNG даних в Node.js
import { promisify } from 'util'; // Імпорт утиліти для перетворення колбеків у проміси
import type WebSocket from 'ws'; // Імпорт типу WebSocket для анотацій

const logger = new Logger('MemoryGameNode'); // Ініціалізація логера

// Промісифіковані версії zlib функцій для асинхронного розпакування
const inflateRaw = promisify(zlib.inflateRaw); // Розпакування даних без заголовку zlib
const inflate = promisify(zlib.inflate); // Розпакування даних зі заголовком zlib

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

// Результат розпарсеного PNG зображення
interface PngData { // Структура даних розпарсеного PNG
  width: number;  // Ширина зображення в пікселях
  height: number; // Висота зображення в пікселях
  pixels: Buffer; // Масив пікселів RGBA (4 байти на піксель)
} // Кінець структури PngData

// ─── PNG парсер в Node.js ──────────────────────────────────────────────────

// Розпарсує PNG буфер і повертає масив пікселів RGBA без використання браузера
async function parsePng(buf: Buffer): Promise<PngData | null> { // Асинхронна функція розпарсування PNG
  try { // Блок перехоплення помилок
    // Перевіряємо сигнатуру PNG файлу (перші 8 байт: 137 80 78 71 13 10 26 10)
    if (buf[0] !== 137 || buf[1] !== 80 || buf[2] !== 78 || buf[3] !== 71) { // Перевірка magic bytes
      return null; // Не є PNG файлом
    } // Кінець перевірки сигнатури

    let width = 0; // Ширина зображення
    let height = 0; // Висота зображення
    let bitDepth = 0; // Глибина кольору
    let colorType = 0; // Тип кольору (2=RGB, 6=RGBA)
    const idatChunks: Buffer[] = []; // Масив для збирання IDAT чанків

    let offset = 8; // Початкова позиція (після сигнатури)

    // Перебираємо всі чанки PNG файлу
    while (offset < buf.length - 12) { // Цикл читання чанків
      const chunkLen = buf.readUInt32BE(offset); // Довжина даних чанку
      const chunkType = buf.slice(offset + 4, offset + 8).toString('ascii'); // Тип чанку

      if (chunkType === 'IHDR') { // Заголовковий чанк з параметрами зображення
        width = buf.readUInt32BE(offset + 8); // Ширина зображення
        height = buf.readUInt32BE(offset + 12); // Висота зображення
        bitDepth = buf[offset + 16]; // Глибина кольору в бітах
        colorType = buf[offset + 17]; // Тип кольорового кодування
      } else if (chunkType === 'IDAT') { // Чанк з даними зображення
        idatChunks.push(buf.slice(offset + 8, offset + 8 + chunkLen)); // Збираємо частини даних
      } else if (chunkType === 'IEND') { // Кінцевий чанк
        break; // Завершуємо читання
      } // Кінець перевірки типу чанку

      offset += 12 + chunkLen; // Переміщуємося до наступного чанку
    } // Кінець циклу чанків

    // Підтримуємо лише 8-бітні RGB та RGBA PNG файли
    if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6)) { // Перевірка підтримуваного формату
      return null; // Непідтримуваний формат
    } // Кінець перевірки

    const channels = colorType === 6 ? 4 : 3; // Кількість каналів на піксель (RGBA або RGB)
    const rowSize = 1 + width * channels; // Розмір рядка з байтом фільтру

    // Об'єднуємо та розпаковуємо всі IDAT чанки
    const compressed = Buffer.concat(idatChunks); // Об'єднання стиснутих даних
    let decompressed: Buffer; // Буфер для розпакованих даних
    try { // Блок спроби розпакування
      decompressed = await inflate(compressed) as Buffer; // Розпакування zlib стиснутих даних
    } catch { // Якщо inflate не спрацював
      decompressed = await inflateRaw(compressed) as Buffer; // Спроба розпакування без заголовку
    } // Кінець блоку розпакування

    // Реконструюємо масив пікселів RGBA з рядків PNG із застосуванням фільтрів
    const pixels = Buffer.alloc(width * height * 4); // Виділяємо пам'ять для RGBA пікселів
    const prev = Buffer.alloc(rowSize - 1, 0); // Буфер попереднього рядка (для фільтрів)

    for (let y = 0; y < height; y++) { // Цикл по рядках зображення
      const rowStart = y * rowSize; // Початок поточного рядка в деком. даних
      const filterType = decompressed[rowStart]; // Тип PNG фільтру рядка
      const row = decompressed.slice(rowStart + 1, rowStart + rowSize); // Дані рядка без байту фільтру
      const recon = Buffer.alloc(row.length); // Буфер для реконструйованого рядка

      for (let x = 0; x < row.length; x++) { // Цикл по байтах рядка
        const raw = row[x]; // Поточний байт
        const a = x >= channels ? recon[x - channels] : 0; // Лівий піксель (для фільтру Sub)
        const b = prev[x]; // Верхній піксель (для фільтру Up)
        const c = x >= channels ? prev[x - channels] : 0; // Верхній лівий піксель (для Paeth)

        // Застосовуємо відповідний фільтр PNG рядка
        switch (filterType) { // Вибір типу фільтру
          case 0: recon[x] = raw; break; // None — без фільтру
          case 1: recon[x] = (raw + a) & 0xff; break; // Sub — різниця з лівим
          case 2: recon[x] = (raw + b) & 0xff; break; // Up — різниця з верхнім
          case 3: recon[x] = (raw + Math.floor((a + b) / 2)) & 0xff; break; // Average
          case 4: { // Paeth фільтр — предиктор Поета
            const p = a + b - c; // Базовий предиктор
            const pa = Math.abs(p - a); // Відстань до лівого
            const pb = Math.abs(p - b); // Відстань до верхнього
            const pc = Math.abs(p - c); // Відстань до верхнього лівого
            recon[x] = (raw + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 0xff; // Вибір
            break; // Кінець Paeth
          } // Кінець case 4
          default: recon[x] = raw; break; // Невідомий фільтр — без обробки
        } // Кінець switch
      } // Кінець циклу байтів

      // Записуємо рядок в RGBA буфер
      for (let x = 0; x < width; x++) { // Цикл по пікселях рядка
        const srcIdx = x * channels; // Індекс у вихідних даних
        const dstIdx = (y * width + x) * 4; // Індекс у вихідному RGBA буфері
        pixels[dstIdx] = recon[srcIdx];         // Червоний канал
        pixels[dstIdx + 1] = recon[srcIdx + 1]; // Зелений канал
        pixels[dstIdx + 2] = recon[srcIdx + 2]; // Синій канал
        pixels[dstIdx + 3] = channels === 4 ? recon[srcIdx + 3] : 255; // Альфа (або 255 для RGB)
      } // Кінець циклу пікселів

      recon.copy(prev); // Зберігаємо поточний рядок як попередній для наступного
    } // Кінець циклу рядків

    return { width, height, pixels }; // Повертаємо розпарсені дані
  } catch (e) { // Обробка помилок парсингу
    logger.error('PNG parse error', e instanceof Error ? e : new Error(String(e))); // Логуємо помилку
    return null; // Повертаємо null при помилці
  } // Кінець блоку перехоплення
} // Кінець функції parsePng

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

  // Надсилаємо скріншот у фотодебаг для діагностики
  await sendDebugPhoto(ws, '📸 Поле карток (аналіз сітки)', nodeId, buf); // Відправка фото

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

  const minCardDim = Math.min(W, H) * 0.025; // Мінімальний розмір картки
  const filteredCols = colPeaks.filter(p => (p.end - p.start) > minCardDim); // Відфільтровані стовпці
  const filteredRows = rowPeaks.filter(p => (p.end - p.start) > minCardDim); // Відфільтровані рядки

  const rawCards: any[] = []; // Масив знайдених карток
  for (let r = 0; r < filteredRows.length; r++) { // Цикл по рядках
    for (let c = 0; c < filteredCols.length; c++) { // Цикл по стовпцях
      const cx = filteredCols[c].center; // X центру картки
      const cy = filteredRows[r].center; // Y центру картки
      const w = filteredCols[c].end - filteredCols[c].start; // Ширина картки
      const h = filteredRows[r].end - filteredRows[r].start; // Висота картки

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

// Знімає «відбиток» (хеш) зображення картки після її перевертання
// Аналіз пікселів повністю в Node.js без page.evaluate
async function captureFingerprint( // Функція зняття відбитка картки
  activePage: Page, // Сторінка Playwright
  vpX: number, // X центру картки у viewport
  vpY: number, // Y центру картки у viewport
  vpW: number, // Ширина картки у viewport
  vpH: number  // Висота картки у viewport
): Promise<string> { // Повертає рядок відбитку
  // Розраховуємо clip-область для скріншоту картки
  const clip = { // Параметри обрізки
    x: Math.max(0, vpX - Math.floor(vpW / 2)), // Лівий край
    y: Math.max(0, vpY - Math.floor(vpH / 2)), // Верхній край
    width: vpW,  // Ширина знімку
    height: vpH  // Висота знімку
  }; // Кінець clip

  // Знімаємо скріншот маленької області картки з повторними спробами
  const buf = await screenshotWithRetry(activePage, { type: 'png', clip }); // Скріншот картки

  // Розпарсуємо PNG в Node.js
  const pngData = await parsePng(buf); // Розпарсування зображення
  if (!pngData) return ''; // При помилці повертаємо порожній рядок

  const { width: W, height: H, pixels: px } = pngData; // Деструктуризація

  // Знімаємо сітку 6×6 зразків кольору з центральних 50% картки
  const sampleSize = 6; // Розмір сітки зразків
  const rW = Math.floor(W * 0.5); // Ширина зони зразків
  const rH = Math.floor(H * 0.5); // Висота зони зразків
  const startX = Math.floor(W / 2 - rW / 2); // Початок X
  const startY = Math.floor(H / 2 - rH / 2); // Початок Y
  const samples: number[] = []; // Масив зразків

  for (let sy = 0; sy < sampleSize; sy++) { // Вертикальний цикл зразків
    for (let sx = 0; sx < sampleSize; sx++) { // Горизонтальний цикл зразків
      const ppx = startX + Math.floor(sx * rW / (sampleSize - 1)); // X точки
      const ppy = startY + Math.floor(sy * rH / (sampleSize - 1)); // Y точки
      if (ppx >= 0 && ppx < W && ppy >= 0 && ppy < H) { // Перевірка меж
        const i = (ppy * W + ppx) * 4; // Індекс у пікселях
        samples.push( // Квантовані значення каналів
          Math.floor(px[i] / 32),     // Червоний (0-7)
          Math.floor(px[i + 1] / 32), // Зелений (0-7)
          Math.floor(px[i + 2] / 32)  // Синій (0-7)
        ); // Кінець push
      } // Кінець перевірки меж
    } // Кінець горизонтального циклу
  } // Кінець вертикального циклу

  return samples.join(','); // Повертаємо відбиток як рядок
} // Кінець captureFingerprint

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
    const cards = await detectGrid( // Виклик функції пошуку сітки
      activePage, dpr, useCropZone as boolean, cropX as number, cropY as number, cropW as number, cropH as number, // Параметри
      ws, currentNode.id // WebSocket та ID ноди
    ); // Кінець виклику

    if (!cards || cards.length < 4) { // Якщо карток не знайдено
      logToClient(`❌ Не вдалося знайти сітку карток (знайдено: ${cards?.length ?? 0})`, 'error'); // Помилка
      return { data: context, nextHandle: ['error'] }; // Вихід через червоний порт
    } // Кінець перевірки

    const totalCards = cards.length; // Загальна кількість карток
    const totalPairs = Math.floor(totalCards / 2); // Кількість пар
    logToClient(`📐 Знайдено ${totalCards} карток, шукаємо ${totalPairs} пар.`, 'success'); // Успіх

    // Пам'ять бота: індекс картки → відбиток зображення
    const cardFingerprints = new Map<number, string>(); // Map відбитків
    let matchedPairs = 0; // Знайдених пар
    let moveCount = 0; // Кількість ходів
    const maxMoves = totalCards * 3; // Максимум ходів

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
        await smartSleep(flipDelay as number, ws); // Пауза анімації
        await activePage.mouse.click(cards[idx2].vpX, cards[idx2].vpY); // Клік по другій картці
        await smartSleep(flipDelay as number, ws); // Пауза анімації

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
          if (knownUnmatched.length === 0) { // Нема партнера
            logToClient(`⚠️ Не залишилось карток для дослідження`, 'error'); // Лог
            break; // Виходимо з циклу
          } // Кінець перевірки
          idx2 = knownUnmatched[0].idx; // Відома незібрана як партнер
        } else { // Всі вже переглянуті
          logToClient(`🔄 Скидання пам'яті — повторний аналіз...`, 'info'); // Лог
          cards.forEach(c => { if (!c.matched) c.fingerprint = null; }); // Скидаємо відбитки
          cardFingerprints.clear(); // Очищаємо пам'ять
          continue; // Повторний хід
        } // Кінець розгалуження

        // Клікаємо по першій картці
        logToClient(`👆 Хід ${moveCount}: відкриваю (${cards[idx1].row},${cards[idx1].col})...`, 'debug');
        await activePage.mouse.click(cards[idx1].vpX, cards[idx1].vpY); // Клік
        await smartSleep(flipDelay as number, ws); // Очікуємо анімацію перевороту

        // Знімаємо відбиток першої картки (аналіз в Node.js)
        const fp1 = await captureFingerprint( // Виклик функції відбитку
          activePage, cards[idx1].vpX, cards[idx1].vpY, cards[idx1].vpW, cards[idx1].vpH
        ); // Кінець виклику
        cards[idx1].fingerprint = fp1; // Зберігаємо відбиток
        cardFingerprints.set(idx1, fp1); // Записуємо в пам'ять

        // Перевіряємо чи вже знаємо пару для цієї картки
        const memoryMatch = findMatchInMemory(fp1, idx1); // Пошук в пам'яті
        if (memoryMatch !== null) { // Знайшли в пам'яті
          idx2 = memoryMatch; // Використовуємо відому пару
          logToClient(`🧠 Знайшов пару в пам'яті! → (${cards[idx2].row},${cards[idx2].col})`, 'info');
        } // Кінець перевірки пам'яті

        // Клікаємо по другій картці
        logToClient(`👆 Відкриваю (${cards[idx2].row},${cards[idx2].col})...`, 'debug');
        await activePage.mouse.click(cards[idx2].vpX, cards[idx2].vpY); // Клік
        await smartSleep(flipDelay as number, ws); // Очікуємо анімацію

        // Знімаємо відбиток другої картки
        const fp2 = await captureFingerprint( // Виклик функції відбитку
          activePage, cards[idx2].vpX, cards[idx2].vpY, cards[idx2].vpW, cards[idx2].vpH
        ); // Кінець виклику
        cards[idx2].fingerprint = fp2; // Зберігаємо відбиток
        cardFingerprints.set(idx2, fp2); // Записуємо в пам'ять

        const similarity = fingerprintSimilarity(fp1, fp2); // Порівнюємо відбитки

        if (similarity >= MATCH_THRESHOLD) { // Збіг!
          cards[idx1].matched = true; // Перша зібрана
          cards[idx2].matched = true; // Друга зібрана
          matchedPairs++; // Збільшуємо лічильник
          logToClient(`✅ Збіг! Пара ${matchedPairs}/${totalPairs} (схожість: ${Math.round(similarity * 100)}%)`, 'success');
        } else { // Не збіг
          logToClient(`❌ Не збіг (${Math.round(similarity * 100)}%). Запам'ятовано.`, 'debug');
        } // Кінець порівняння

        await smartSleep(mismatchDelay as number, ws); // Пауза анімації перевертання назад
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
