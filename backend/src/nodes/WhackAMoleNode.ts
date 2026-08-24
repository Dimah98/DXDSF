// Нода «Вдарь Крота» — автоматичне проходження міні-гри Whack-a-Mole
// Поле 3×3. Порівнює кожну клітинку зі зразками з папки mine/
// Весь аналіз зображень виконується в Node.js без page.evaluate

import { NodeHandlerParams } from './types'; // Типи параметрів обробника
import { Logger } from '../logger';           // Логер
import { Page } from 'playwright';            // Тип сторінки Playwright
import * as zlib from 'zlib';                 // Розпакування PNG
import * as fs from 'fs';                     // Файлова система
import * as path from 'path';                 // Шляхи
import { promisify } from 'util';             // Утиліти
import type WebSocket from 'ws';              // Тип WebSocket

const logger = new Logger('WhackAMoleNode'); // Ініціалізація логера

const inflate = promisify(zlib.inflate);       // Промісифікований inflate
const inflateRaw = promisify(zlib.inflateRaw); // Промісифікований inflateRaw

// ─── Типи ────────────────────────────────────────────────────────────────────

// Розпарсені дані PNG зображення (пікселі RGBA в Node.js)
interface PngData {
  width: number;   // Ширина зображення в пікселях
  height: number;  // Висота зображення в пікселях
  pixels: Buffer;  // Масив пікселів RGBA (4 байти на піксель)
}

// Один завантажений шаблон крота
interface MoleTemplate {
  name: string;    // Назва файлу шаблону
  data: PngData;   // Розпарсені пікселі шаблону
}

// ─── PNG парсер (Node.js, без браузера) ─────────────────────────────────────

// Розпарсує PNG буфер і повертає масив пікселів RGBA повністю в Node.js
async function parsePng(buf: Buffer): Promise<PngData | null> { // Функція розпарсування PNG зображення повністю в Node.js
  try { // Блок try для перехоплення можливих помилок парсингу
    if (buf[0] !== 137 || buf[1] !== 80 || buf[2] !== 78 || buf[3] !== 71) { // Перевіряємо перші 4 магічні байти сигнатури PNG
      return null; // Повертаємо null, якщо це не PNG файл
    }

    let width = 0, height = 0, bitDepth = 0, colorType = 0; // Оголошуємо змінні метаданих зображення (ширина, висота, глибина, тип)
    const idatChunks: Buffer[] = []; // Створюємо масив для збирання фрагментів стиснених даних IDAT
    const plte: Buffer[] = []; // Створюємо масив для зберігання фрагментів палітри PLTE
    const trns: Buffer[] = []; // Створюємо масив для зберігання фрагментів прозорості tRNS
    let offset = 8; // Починаємо читання після 8 байтів сигнатури PNG

    while (offset < buf.length - 12) { // Цикл проходу по структурі чанків файлу до кінця
      const chunkLen = buf.readUInt32BE(offset); // Зчитуємо 4 байти довжини поточного чанку
      const chunkType = buf.slice(offset + 4, offset + 8).toString('ascii'); // Зчитуємо 4 байти імені типу чанку

      if (chunkType === 'IHDR') { // Якщо тип чанку є заголовком IHDR
        width = buf.readUInt32BE(offset + 8); // Зчитуємо 4 байти ширини зображення
        height = buf.readUInt32BE(offset + 12); // Зчитуємо 4 байти висоти зображення
        bitDepth = buf[offset + 16]; // Зчитуємо 1 байт глибини кольору (біт на канал)
        colorType = buf[offset + 17]; // Зчитуємо 1 байт типу кодування кольору (2=RGB, 6=RGBA, 3=Indexed)
      } else if (chunkType === 'PLTE') { // Якщо тип чанку є таблицею палітри PLTE
        plte.push(buf.slice(offset + 8, offset + 8 + chunkLen)); // Зберігаємо фрагмент даних палітри у масив
      } else if (chunkType === 'tRNS') { // Якщо тип чанку є даними прозорості tRNS
        trns.push(buf.slice(offset + 8, offset + 8 + chunkLen)); // Зберігаємо фрагмент даних прозорості у масив
      } else if (chunkType === 'IDAT') { // Якщо тип чанку є даними зображення IDAT
        idatChunks.push(buf.slice(offset + 8, offset + 8 + chunkLen)); // Зберігаємо фрагмент стиснених даних у масив
      } else if (chunkType === 'IEND') { // Якщо це кінцевий чанк IEND
        break; // Негайно перериваємо цикл читання чанків
      }
      offset += 12 + chunkLen; // Зсуваємо вказівник на початок наступного чанку (довжина + тип + дані + CRC)
    }

    const palette = plte.length > 0 ? Buffer.concat(plte) : null; // Об'єднуємо всі частини палітри в єдиний буфер
    const transparency = trns.length > 0 ? Buffer.concat(trns) : null; // Об'єднуємо всі частини прозорості в єдиний буфер

    if (colorType === 3 && !palette) { // Якщо колір зображення індексований, але чанк палітри PLTE відсутній
      return null; // Повертаємо null, оскільки палітра критична для рендерингу
    }

    const channels = colorType === 6 ? 4 : (colorType === 2 ? 3 : 1); // Кількість каналів для дефільтрації (для палітри це завжди 1 канал індексів)
    let rowBytes = 0; // Оголошуємо змінну для збереження ширини рядка у байтах

    if (colorType === 3) { // Якщо тип кольору індексований (використовує палітру)
      if (bitDepth === 8) { // Якщо глибина кольору становить 8 біт на піксель
        rowBytes = width; // Кожен байт відповідає одному пікселю
      } else if (bitDepth === 4) { // Якщо глибина кольору становить 4 біти на піксель
        rowBytes = Math.ceil(width / 2); // Два пікселі пакуються в один байт
      } else if (bitDepth === 2) { // Якщо глибина кольору становить 2 біти на піксель
        rowBytes = Math.ceil(width / 4); // Чотири пікселі пакуються в один байт
      } else if (bitDepth === 1) { // Якщо глибина кольору становить 1 біт на піксель
        rowBytes = Math.ceil(width / 8); // Вісім пікселів пакуються в один байт
      } else { // Будь-яке інше непідтримуване значення глибини
        return null; // Непідтримувана глибина кольору для індексованих зображень
      }
    } else { // Для зображень RGB або RGBA
      if (bitDepth !== 8) return null; // Підтримуємо тільки 8-бітові канали для прямого RGB/RGBA
      rowBytes = width * channels; // Рядок займає ширина * кількість каналів байт
    }

    const rowSize = 1 + rowBytes; // Довжина рядка в розпакованому буфері (1 байт типу фільтру + дані)

    const compressed = Buffer.concat(idatChunks); // Об'єднуємо всі фрагменти IDAT у суцільний стиснутий буфер
    let decompressed: Buffer; // Оголошуємо змінну під розпакований буфер
    try { // Блок спроби розпакування за допомогою стандартного inflate
      decompressed = await inflate(compressed) as Buffer; // Викликаємо розпакування inflate
    } catch { // У разі виникнення помилки
      decompressed = await inflateRaw(compressed) as Buffer; // Пробуємо варіант inflateRaw (без zlib заголовків)
    }

    const pixels = Buffer.alloc(width * height * 4); // Виділяємо буфер під результат у форматі RGBA (4 байти на піксель)
    const prev = Buffer.alloc(rowBytes, 0); // Створюємо буфер для зберігання значень попереднього рядка при дефільтрації

    for (let y = 0; y < height; y++) { // Цикл проходу по кожному рядку зображення по висоті
      const rowStart = y * rowSize; // Розраховуємо індекс початку поточного рядка в розпакованому буфері
      const filterType = decompressed[rowStart]; // Отримуємо перший байт рядка — це тип PNG фільтру
      const row = decompressed.slice(rowStart + 1, rowStart + rowSize); // Отримуємо безпосередні дані рядка без типу фільтру
      const recon = Buffer.alloc(row.length); // Створюємо буфер для відновлених (дефільтрованих) даних рядка

      for (let x = 0; x < row.length; x++) { // Цикл обробки кожного байту в рядку
        const raw = row[x]; // Поточне закодоване значення фільтром
        const a = x >= channels ? recon[x - channels] : 0; // Отримуємо значення пікселя ліворуч (або 0, якщо це початок)
        const b = prev[x]; // Отримуємо значення пікселя з попереднього рядка згори
        const c = x >= channels ? prev[x - channels] : 0; // Отримуємо значення лівого верхнього пікселя з попереднього рядка

        switch (filterType) { // Обробка байту залежно від типу фільтру PNG
          case 0: recon[x] = raw; break; // Тип 0 (None) — значення залишається без змін
          case 1: recon[x] = (raw + a) & 0xff; break; // Тип 1 (Sub) — додаємо значення лівого пікселя
          case 2: recon[x] = (raw + b) & 0xff; break; // Тип 2 (Up) — додаємо значення верхнього пікселя
          case 3: recon[x] = (raw + Math.floor((a + b) / 2)) & 0xff; break; // Тип 3 (Average) — додаємо середнє лівого та верхнього
          case 4: { // Тип 4 (Paeth) — застосовуємо лінійну функцію прогнозування Paeth
            const p = a + b - c; // Обчислюємо базове Paeth значення
            const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); // Рахуємо відстані до трьох сусідів
            recon[x] = (raw + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 0xff; // Додаємо найближчий колір сусіднього пікселя
            break; // Вихід з гілки case
          }
          default: recon[x] = raw; break; // За замовчуванням залишаємо як є
        }
      }

      if (colorType === 3 && palette) { // Якщо використовується палітра кольорів
        if (bitDepth === 8) { // Для 8-бітної палітри (кожен байт є індексом кольору)
          for (let x = 0; x < width; x++) { // Проходимо по кожному пікселю рядка
            const idx = recon[x]; // Отримуємо індекс кольору з відновленого буфера рядка
            const pi = idx * 3; // Обчислюємо зміщення для трьох каналів у палітрі PLTE
            const di = (y * width + x) * 4; // Обчислюємо зміщення для пікселя у фінальному буфері RGBA
            pixels[di] = palette[pi] !== undefined ? palette[pi] : 0; // Записуємо червоний канал R
            pixels[di + 1] = palette[pi + 1] !== undefined ? palette[pi + 1] : 0; // Записуємо зелений канал G
            pixels[di + 2] = palette[pi + 2] !== undefined ? palette[pi + 2] : 0; // Записуємо синій канал B
            pixels[di + 3] = transparency && idx < transparency.length ? transparency[idx] : 255; // Записуємо альфу (прозорість)
          }
        } else if (bitDepth === 4) { // Для 4-бітної палітри (два індекси пакуються в один байт)
          for (let x = 0; x < width; x++) { // Проходимо по кожному пікселю рядка
            const byteIdx = Math.floor(x / 2); // Знаходимо індекс байта у відновленому рядку
            const shift = x % 2 === 0 ? 4 : 0; // Визначаємо зміщення (парні пікселі у старших 4 бітах, непарні в молодших)
            const idx = (recon[byteIdx] >> shift) & 0x0f; // Отримуємо 4-бітне значення індексу палітри
            const pi = idx * 3; // Обчислюємо індекс трійки RGB у палітрі
            const di = (y * width + x) * 4; // Обчислюємо індекс у результуючому буфері RGBA
            pixels[di] = palette[pi] !== undefined ? palette[pi] : 0; // Записуємо червоний канал R
            pixels[di + 1] = palette[pi + 1] !== undefined ? palette[pi + 1] : 0; // Записуємо зелений канал G
            pixels[di + 2] = palette[pi + 2] !== undefined ? palette[pi + 2] : 0; // Записуємо синій канал B
            pixels[di + 3] = transparency && idx < transparency.length ? transparency[idx] : 255; // Записуємо альфу (прозорість)
          }
        }
      } else { // Для прямих колірних моделей RGB (colorType 2) або RGBA (colorType 6)
        for (let x = 0; x < width; x++) { // Проходимо по кожному пікселю рядка
          const si = x * channels, di = (y * width + x) * 4; // Визначаємо індекс початку пікселя в джерелі та результаті
          pixels[di] = recon[si]; // Записуємо червоний канал R
          pixels[di + 1] = recon[si + 1]; // Записуємо зелений канал G
          pixels[di + 2] = recon[si + 2]; // Записуємо синій канал B
          pixels[di + 3] = channels === 4 ? recon[si + 3] : 255; // Записуємо альфу (прозорість з джерела або 255 за замовчуванням)
        }
      }

      recon.copy(prev); // Копіюємо відновлений рядок у буфер prev для обробки наступного рядка
    }

    return { width, height, pixels }; // Повертаємо розпарсений об'єкт із шириною, висотою та пікселями зображення
  } catch (e) { // У разі виникнення будь-якої помилки під час парсингу
    logger.error('parsePng error', e instanceof Error ? e : new Error(String(e))); // Логуємо помилку у системний логер
    return null; // Повертаємо null як ознаку помилки розбору файлу
  }
}

// ─── Допоміжні функції ───────────────────────────────────────────────────────

// Скріншот з повторними спробами при падінні контексту
async function screenshotWithRetry(page: Page, options: any, retries = 3, delay = 800): Promise<Buffer> {
  for (let i = 0; i < retries; i++) {
    try {
      return await page.screenshot(options); // Знімаємо екран
    } catch (err: any) {
      if (i < retries - 1) {
        logger.warn(`Screenshot failed (спроба ${i + 1}/${retries}): ${err.message}`);
        await new Promise(r => setTimeout(r, delay));
      } else throw err;
    }
  }
  throw new Error('screenshotWithRetry: спроби вичерпані');
}

// Надсилає фото напряму у фотодебаг через WebSocket (без збереження у файл)
async function sendDebugPhoto(ws: WebSocket, label: string, nodeId: string, buf: Buffer): Promise<void> {
  if (!ws || (ws as any).readyState !== 1) return; // Перевіряємо з'єднання
  try {
    const base64 = `data:image/png;base64,${buf.toString('base64')}`; // Data URL
    (ws as any).send(JSON.stringify({ // Надсилаємо WebSocket повідомлення
      type: 'DEBUG_SNAPSHOT', // Тип для фотодебагу
      nodeId,                 // ID ноди
      nodeTitle: label,       // Підпис для відображення
      image: base64,          // Base64 зображення
      timestamp: Date.now()   // Мітка часу
    }));
  } catch (e) {
    logger.warn('sendDebugPhoto failed', { error: String(e) });
  }
}

// Вирізає прямокутник з RGBA пікселів та повертає новий PngData
function cropRegion(src: PngData, rx: number, ry: number, rw: number, rh: number): PngData {
  const pixels = Buffer.alloc(rw * rh * 4); // Новий буфер для кропу
  for (let y = 0; y < rh; y++) {           // Цикл по рядках вирізки
    for (let x = 0; x < rw; x++) {          // Цикл по стовпцях вирізки
      const si = ((ry + y) * src.width + (rx + x)) * 4; // Індекс у джерелі
      const di = (y * rw + x) * 4;                       // Індекс у вихідному
      pixels[di] = src.pixels[si];         // R
      pixels[di + 1] = src.pixels[si + 1]; // G
      pixels[di + 2] = src.pixels[si + 2]; // B
      pixels[di + 3] = src.pixels[si + 3]; // A
    }
  }
  return { width: rw, height: rh, pixels }; // Повертаємо вирізану область
}

// Масштабує зображення до заданого розміру методом білінійної інтерполяції
function resizeNearest(src: PngData, targetW: number, targetH: number): PngData {
  const pixels = Buffer.alloc(targetW * targetH * 4); // Буфер результату
  const xRatio = src.width / targetW;                  // Коефіцієнт X
  const yRatio = src.height / targetH;                 // Коефіцієнт Y

  for (let y = 0; y < targetH; y++) {    // Цикл по рядках
    for (let x = 0; x < targetW; x++) {  // Цикл по стовпцях
      const sx = Math.min(Math.floor(x * xRatio), src.width - 1);  // Джерело X
      const sy = Math.min(Math.floor(y * yRatio), src.height - 1); // Джерело Y
      const si = (sy * src.width + sx) * 4; // Індекс джерела
      const di = (y * targetW + x) * 4;     // Індекс результату
      pixels[di] = src.pixels[si];           // R
      pixels[di + 1] = src.pixels[si + 1];  // G
      pixels[di + 2] = src.pixels[si + 2];  // B
      pixels[di + 3] = src.pixels[si + 3];  // A
    }
  }
  return { width: targetW, height: targetH, pixels }; // Результат масштабування
}

// Обчислює нормалізовану перехресну кореляцію (NCC) між двома зображеннями однакового розміру
// Повертає значення від 0.0 (зовсім різні) до 1.0 (ідентичні)
function computeNCC(a: PngData, b: PngData): number {
  if (a.width !== b.width || a.height !== b.height) return 0; // Перевірка розмірів

  let sumA = 0, sumB = 0, sumAA = 0, sumBB = 0, sumAB = 0; // Статистичні суми
  const n = a.width * a.height; // Кількість пікселів

  for (let i = 0; i < n; i++) { // Цикл по всіх пікселях
    const idx = i * 4; // RGBA індекс
    // Конвертуємо RGB в градації сірого (яскравість)
    const ga = a.pixels[idx] * 0.299 + a.pixels[idx + 1] * 0.587 + a.pixels[idx + 2] * 0.114;
    const gb = b.pixels[idx] * 0.299 + b.pixels[idx + 1] * 0.587 + b.pixels[idx + 2] * 0.114;
    sumA += ga;   // Сума A
    sumB += gb;   // Сума B
    sumAA += ga * ga; // Сума квадратів A
    sumBB += gb * gb; // Сума квадратів B
    sumAB += ga * gb; // Сума добутків
  }

  const meanA = sumA / n;  // Середнє A
  const meanB = sumB / n;  // Середнє B
  const stdA = Math.sqrt(sumAA / n - meanA * meanA); // Стандартне відхилення A
  const stdB = Math.sqrt(sumBB / n - meanB * meanB); // Стандартне відхилення B

  if (stdA < 1e-6 || stdB < 1e-6) return 0; // Уникаємо ділення на 0

  const ncc = (sumAB / n - meanA * meanB) / (stdA * stdB); // NCC формула
  return Math.max(0, Math.min(1, (ncc + 1) / 2)); // Нормалізуємо до [0, 1]
}

// Завантажує всі PNG шаблони з вказаної папки
async function loadTemplates(templateDir: string): Promise<MoleTemplate[]> {
  const templates: MoleTemplate[] = []; // Масив шаблонів

  if (!fs.existsSync(templateDir)) { // Перевіряємо чи існує папка
    logger.warn(`Папка шаблонів не знайдена: ${templateDir}`);
    return templates; // Порожній масив
  }

  const files = fs.readdirSync(templateDir) // Читаємо файли папки
    .filter(f => f.toLowerCase().endsWith('.png')) // Тільки PNG
    .sort(); // Сортуємо

  for (const file of files) { // Цикл по файлах
    const fullPath = path.join(templateDir, file); // Повний шлях
    try {
      const buf = fs.readFileSync(fullPath);  // Читаємо файл
      const data = await parsePng(buf);       // Парсимо PNG
      if (data) {
        templates.push({ name: file, data }); // Додаємо шаблон
        logger.info(`Завантажено шаблон: ${file} (${data.width}×${data.height})`);
      }
    } catch (e) {
      logger.warn(`Не вдалося завантажити шаблон: ${file}`);
    }
  }

  return templates; // Повертаємо всі шаблони
}

// Перевіряє чи кнопки завершення присутні на сторінці або в iframe
async function checkExitButtons(
  activePage: Page,
  exitTexts: string[],
  logFn: (message: string, type?: 'info' | 'error' | 'success' | 'debug', data?: any) => void,
  verbose = false
): Promise<string | null> {
  if (exitTexts.length === 0) return null; // Список порожній — пропускаємо

  const isCssSelector = (s: string) => /[:.[\[#(>~+]/.test(s); // CSS-селектор?

  // Пошук в основній сторінці та всіх фреймах
  const findInPageAndFrames = async (
    fn: (ctx: { locator: (s: string) => any; getByText: (t: string, o?: any) => any; getByRole: (r: any, o?: any) => any }) => Promise<number>
  ): Promise<number> => {
    try { const c = await fn({ locator: s => activePage.locator(s), getByText: (t, o) => activePage.getByText(t, o), getByRole: (r, o) => activePage.getByRole(r, o) }); if (c > 0) return c; } catch {}
    for (const frame of activePage.frames()) {
      if (frame === activePage.mainFrame()) continue;
      try { const c = await fn({ locator: s => frame.locator(s), getByText: (t, o) => frame.getByText(t, o), getByRole: (r, o) => frame.getByRole(r, o) }); if (c > 0) return c; } catch {}
    }
    return 0;
  };

  for (const entry of exitTexts) { // Перевіряємо кожен варіант
    try {
      let count = 0;
      if (isCssSelector(entry)) { // CSS-селектор
        count = await findInPageAndFrames(async ({ locator }) => await locator(entry).count());
        if (verbose) logFn(`🔍 Селектор "${entry}": ${count} елем.`, 'debug');
      } else { // Текст
        const re = new RegExp(entry.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        count = await findInPageAndFrames(async ({ locator }) =>
          await locator('button, a, [role="button"], input[type="button"], input[type="submit"]').filter({ hasText: re }).count()
        );
        if (count === 0) count = await findInPageAndFrames(async ({ getByRole }) => await getByRole('button', { name: re }).count());
        if (count === 0) count = await findInPageAndFrames(async ({ getByText }) => await getByText(entry, { exact: false }).count());
        if (verbose) logFn(`🔍 Текст "${entry}": ${count} елем.`, 'debug');
      }
      if (count > 0) return entry; // Знайдено!
    } catch (err: any) {
      if (verbose) logFn(`⚠️ Помилка пошуку "${entry}": ${err.message}`, 'debug');
    }
  }
  return null; // Не знайдено
}

// ─── Головний обробник ноди ──────────────────────────────────────────────────

export const whackAMoleNodeHandler = async ({
  currentNode,    // Поточна нода з налаштуваннями
  activePage,     // Активна сторінка Playwright
  ws,             // WebSocket з'єднання
  context,        // Вхідний контекст
  logToClient,    // Функція логування на клієнт
  smartSleep,     // Пауза з підтримкою стопу
  checkRunning,   // Функція перевірки чи працює бот (для зупинки циклу)
}: NodeHandlerParams) => {

  // Зчитуємо налаштування ноди
  const nodeData = currentNode.data as Record<string, unknown>;
  const {
    checkInterval = 400,       // Інтервал перевірки поля (мс)
    clickDelay = 150,          // Затримка після кліку (мс)
    matchThreshold = 0.72,     // Поріг схожості NCC для визнання крота
    maxDuration = 60000,       // Максимальний час роботи (мс)
    useCropZone = false,       // Чи обмежувати зону пошуку
    cropX = 0,                 // X зони пошуку
    cropY = 0,                 // Y зони пошуку
    cropW = 600,               // Ширина зони пошуку
    cropH = 400,               // Висота зони пошуку
    exitButtonTexts = '',      // Тексти кнопок завершення
    templateDir = '',          // Папка шаблонів (порожнє = авто mine/)
  } = nodeData;

  // Парсимо тексти кнопок завершення
  const exitTexts: string[] = String(exitButtonTexts)
    .split(/\n/).map(s => s.trim()).filter(Boolean);

  // Визначаємо папку шаблонів (за замовчуванням — mine/ у корені проєкту)
  const resolvedTemplateDir = (templateDir as string) // Якщо шлях до папки шаблонів задано в налаштуваннях
    ? path.resolve(templateDir as string) // Використовуємо вказаний користувачем шлях
    : path.resolve(process.cwd(), '..', 'mine'); // Автоматично визначаємо шлях до папки mine в корені проєкту (на один рівень вище backend)

  logToClient(`🔨 Вдарь Крота: старт...`, 'info');
  logToClient(`📁 Папка шаблонів: ${resolvedTemplateDir}`, 'debug');

  try {
    // ── Завантаження шаблонів ─────────────────────────────────────────────
    const templates = await loadTemplates(resolvedTemplateDir); // Завантажуємо шаблони

    if (templates.length === 0) { // Якщо шаблони не знайдено
      logToClient(`❌ Шаблони крота не знайдено в: ${resolvedTemplateDir}`, 'error');
      return { data: context, nextHandle: ['error'] };
    }

    logToClient(`✅ Завантажено ${templates.length} шаблон(ів) крота`, 'success');

    // ── Перша перевірка кнопок завершення ────────────────────────────────
    if (exitTexts.length > 0) {
      logToClient(`🔍 Перевіряю кнопки завершення (${exitTexts.length} варіантів, ${activePage.frames().length} фреймів)...`, 'debug');
    }
    const earlyExit = await checkExitButtons(activePage, exitTexts, logToClient, true);
    if (earlyExit) {
      logToClient(`🏁 Кнопка "${earlyExit}" вже на екрані — завершення`, 'success');
      return { data: { ...context, value: 0 }, nextHandle: [null, undefined, 'success'] };
    }

    // ── Діагностичний скріншот ────────────────────────────────────────────
    try {
      const diagBuf = await screenshotWithRetry(activePage, { type: 'png' }); // Весь екран
      await sendDebugPhoto(ws, '🔍 Стартовий скріншот', currentNode.id, diagBuf);
      if (useCropZone && (cropW as number) > 0 && (cropH as number) > 0) { // Якщо є crop-зона
        const cropBuf = await screenshotWithRetry(activePage, {
          type: 'png', clip: { x: cropX, y: cropY, width: cropW, height: cropH }
        });
        await sendDebugPhoto(ws, '🎯 Зона пошуку кротів', currentNode.id, cropBuf);
      }
    } catch (e) { logToClient(`⚠️ Діагностичний скріншот не вдався`, 'debug'); }

    // ── Основний ігровий цикл ─────────────────────────────────────────────

    const startTime = Date.now(); // Час старту
    let totalClicks = 0;          // Всього кліків по кротах
    let frameCount = 0;           // Лічильник ітерацій циклу

    // Розмір клітинки для порівняння з шаблонами (NxN пікселів)
    const COMPARE_SIZE = 32; // Розмір для нормалізованого порівняння

    while (Date.now() - startTime < (maxDuration as number) && checkRunning()) { // Цикл поки не вийшов ліміт часу та бот запущений
      if (!checkRunning()) { // Якщо бот зупинений користувачем під час роботи
        break; // Перериваємо цикл та виходимо
      }
      frameCount++; // Збільшуємо лічильник кадрів/ітерацій циклу

      // Знімаємо скріншот ігрового поля
      const shotOptions: { type: string; clip?: { x: number; y: number; width: number; height: number } } = { type: 'png' };
      if (useCropZone && (cropW as number) > 0 && (cropH as number) > 0) { // Якщо є обмеження зони
        shotOptions.clip = { x: cropX as number, y: cropY as number, width: cropW as number, height: cropH as number };
      }

      let fieldBuf: Buffer;
      try {
        fieldBuf = await screenshotWithRetry(activePage, shotOptions); // Скріншот поля
      } catch (e) {
        logToClient(`⚠️ Не вдалося зробити скріншот поля`, 'debug');
        await smartSleep(checkInterval as number, ws); // Чекаємо перед повтором
        continue; // Наступна ітерація
      }

      // Розпарсуємо PNG в Node.js
      const fieldPng = await parsePng(fieldBuf); // Парсинг поля
      if (!fieldPng) {
        await smartSleep(checkInterval as number, ws);
        continue; // Якщо не вдалося — пропускаємо
      }

      // Розбиваємо поле на 3×3 клітинки та аналізуємо кожну
      const cellW = Math.floor(fieldPng.width / 3);   // Ширина клітинки
      const cellH = Math.floor(fieldPng.height / 3);  // Висота клітинки

      let clicksThisFrame = 0; // Кліки у цій ітерації

      for (let row = 0; row < 3; row++) {   // Рядки сітки (0, 1, 2)
        for (let col = 0; col < 3; col++) { // Стовпці сітки (0, 1, 2)

          const cellX = col * cellW; // X клітинки в зображенні
          const cellY = row * cellH; // Y клітинки в зображенні

          // Вирізаємо клітинку з поля
          const cell = cropRegion(fieldPng, cellX, cellY, cellW, cellH);
          // Масштабуємо до стандартного розміру для порівняння
          const cellResized = resizeNearest(cell, COMPARE_SIZE, COMPARE_SIZE);

          // Порівнюємо клітинку з кожним шаблоном крота
          let bestScore = 0;   // Найкращий результат порівняння
          let bestTemplate = ''; // Назва найкращого шаблону

          for (const tmpl of templates) { // Перевіряємо кожен шаблон
            const tmplResized = resizeNearest(tmpl.data, COMPARE_SIZE, COMPARE_SIZE); // Масштаб
            const score = computeNCC(cellResized, tmplResized); // NCC порівняння
            if (score > bestScore) { // Якщо кращий результат
              bestScore = score;         // Запам'ятовуємо
              bestTemplate = tmpl.name;  // І назву шаблону
            }
          }

          if (bestScore >= (matchThreshold as number)) { // Якщо схожість вище порогу
            // Обчислюємо координати центру клітинки у viewport
            const vpCellX = (useCropZone ? (cropX as number) : 0) + cellX + Math.floor(cellW / 2);
            const vpCellY = (useCropZone ? (cropY as number) : 0) + cellY + Math.floor(cellH / 2);

            logToClient(
              `🔨 Крот! (${row},${col}) шаблон="${bestTemplate}" NCC=${Math.round(bestScore * 100)}% → клік (${vpCellX},${vpCellY})`,
              'success'
            );

            await activePage.mouse.click(vpCellX, vpCellY); // Клікаємо по кроту!
            await smartSleep(clickDelay as number, ws); // Коротка пауза після кліку
            totalClicks++;     // Збільшуємо лічильник
            clicksThisFrame++; // Кліки цієї ітерації
          }
        }
      }

      // Кожні 10 ітерацій логуємо прогрес
      if (frameCount % 10 === 0) {
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        logToClient(`📊 Прогрес: ${totalClicks} кротів за ${elapsed}с (${frameCount} кадрів)`, 'info');
      }

      // Перевіряємо кнопки завершення після кожної ітерації
      const exitFound = await checkExitButtons(activePage, exitTexts, logToClient, frameCount <= 3);
      if (exitFound) { // Якщо знайдено кнопку завершення
        logToClient(`🏁 Виявлено кнопку завершення "${exitFound}" після ${totalClicks} кліків`, 'success');
        return {
          data: { ...context, totalClicks, frameCount, value: totalClicks },
          nextHandle: [null, undefined, 'success'], // Зелений порт
        };
      }

      await smartSleep(checkInterval as number, ws); // Пауза перед наступним кадром
    }

    // ── Час вийшов ────────────────────────────────────────────────────────

    logToClient(`⏱️ Час вийшов (${(maxDuration as number) / 1000}с). Всього кліків: ${totalClicks}`, 'info');

    if (totalClicks > 0) { // Якщо хоч щось зробили — успіх
      return {
        data: { ...context, totalClicks, frameCount, value: totalClicks },
        nextHandle: [null, undefined, 'success'],
      };
    } else { // Якщо жодного кліку — помилка
      return { data: context, nextHandle: ['error'] };
    }

  } catch (err: any) { // Обробка критичних помилок
    logger.error(`WhackAMole failed: ${currentNode.id}`, err instanceof Error ? err : new Error(String(err)));
    logToClient(`❌ Помилка гри: ${err.message}`, 'error');
    return { data: context, nextHandle: ['error'] };
  }
};
