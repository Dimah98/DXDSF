import { inflate, inflateRaw } from 'zlib';
import { promisify } from 'util';
import { Logger } from '../logger';

const inflateAsync = promisify(inflate);
const inflateRawAsync = promisify(inflateRaw);
const logger = new Logger('PngParser');

export interface PngData {
  width: number;
  height: number;
  pixels: Buffer;
}

/**
 * Високопродуктивний PNG парсер для Node.js з повторним використанням буферів пам'яті.
 * Підтримує типи кольорів: RGBA (6), RGB (2), Indexed (3 з PLTE/tRNS), Grayscale (0).
 */
export async function parsePng(buf: Buffer): Promise<PngData | null> {
  try {
    if (!buf || buf.length < 8) return null;
    // Перевірка magic bytes сигнатури PNG
    if (buf[0] !== 137 || buf[1] !== 80 || buf[2] !== 78 || buf[3] !== 71) {
      return null;
    }

    let width = 0, height = 0, bitDepth = 0, colorType = 0;
    const idatChunks: Buffer[] = [];
    const plte: Buffer[] = [];
    const trns: Buffer[] = [];
    let offset = 8;

    while (offset < buf.length - 12) {
      const chunkLen = buf.readUInt32BE(offset);
      const chunkType = buf.slice(offset + 4, offset + 8).toString('ascii');

      if (chunkType === 'IHDR') {
        width = buf.readUInt32BE(offset + 8);
        height = buf.readUInt32BE(offset + 12);
        bitDepth = buf[offset + 16];
        colorType = buf[offset + 17];
      } else if (chunkType === 'PLTE') {
        plte.push(buf.slice(offset + 8, offset + 8 + chunkLen));
      } else if (chunkType === 'tRNS') {
        trns.push(buf.slice(offset + 8, offset + 8 + chunkLen));
      } else if (chunkType === 'IDAT') {
        idatChunks.push(buf.slice(offset + 8, offset + 8 + chunkLen));
      } else if (chunkType === 'IEND') {
        break;
      }
      offset += 12 + chunkLen;
    }

    if (width <= 0 || height <= 0) return null;

    const palette = plte.length > 0 ? Buffer.concat(plte) : null;
    const transparency = trns.length > 0 ? Buffer.concat(trns) : null;

    if (colorType === 3 && !palette) {
      return null;
    }

    const channels = colorType === 6 ? 4 : (colorType === 2 ? 3 : 1);
    let rowBytes = 0;

    if (colorType === 3) {
      if (bitDepth === 8) rowBytes = width;
      else if (bitDepth === 4) rowBytes = Math.ceil(width / 2);
      else if (bitDepth === 2) rowBytes = Math.ceil(width / 4);
      else if (bitDepth === 1) rowBytes = Math.ceil(width / 8);
      else return null;
    } else {
      if (bitDepth !== 8) return null;
      rowBytes = width * channels;
    }

    const rowSize = 1 + rowBytes;
    const compressed = Buffer.concat(idatChunks);
    let decompressed: Buffer;

    try {
      decompressed = await inflateAsync(compressed);
    } catch {
      decompressed = await inflateRawAsync(compressed);
    }

    const pixels = Buffer.allocUnsafe(width * height * 4);
    // Виділяємо робочі буфери один раз на все зображення замість виділення на кожен рядок
    let recon = Buffer.allocUnsafe(rowBytes);
    let prev = Buffer.alloc(rowBytes, 0);

    for (let y = 0; y < height; y++) {
      const rowStart = y * rowSize;
      const filterType = decompressed[rowStart];
      const row = decompressed.slice(rowStart + 1, rowStart + rowSize);

      for (let x = 0; x < rowBytes; x++) {
        const raw = row[x];
        const a = x >= channels ? recon[x - channels] : 0;
        const b = prev[x];
        const c = x >= channels ? prev[x - channels] : 0;

        switch (filterType) {
          case 0: recon[x] = raw; break;
          case 1: recon[x] = (raw + a) & 0xff; break;
          case 2: recon[x] = (raw + b) & 0xff; break;
          case 3: recon[x] = (raw + Math.floor((a + b) / 2)) & 0xff; break;
          case 4: {
            const p = a + b - c;
            const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
            recon[x] = (raw + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 0xff;
            break;
          }
          default: recon[x] = raw; break;
        }
      }

      if (colorType === 3 && palette) {
        if (bitDepth === 8) {
          for (let x = 0; x < width; x++) {
            const idx = recon[x];
            const pi = idx * 3;
            const di = (y * width + x) * 4;
            pixels[di] = palette[pi] !== undefined ? palette[pi] : 0;
            pixels[di + 1] = palette[pi + 1] !== undefined ? palette[pi + 1] : 0;
            pixels[di + 2] = palette[pi + 2] !== undefined ? palette[pi + 2] : 0;
            pixels[di + 3] = transparency && idx < transparency.length ? transparency[idx] : 255;
          }
        } else if (bitDepth === 4) {
          for (let x = 0; x < width; x++) {
            const byteIdx = Math.floor(x / 2);
            const shift = x % 2 === 0 ? 4 : 0;
            const idx = (recon[byteIdx] >> shift) & 0x0f;
            const pi = idx * 3;
            const di = (y * width + x) * 4;
            pixels[di] = palette[pi] !== undefined ? palette[pi] : 0;
            pixels[di + 1] = palette[pi + 1] !== undefined ? palette[pi + 1] : 0;
            pixels[di + 2] = palette[pi + 2] !== undefined ? palette[pi + 2] : 0;
            pixels[di + 3] = transparency && idx < transparency.length ? transparency[idx] : 255;
          }
        }
      } else {
        for (let x = 0; x < width; x++) {
          const si = x * channels, di = (y * width + x) * 4;
          pixels[di] = recon[si];
          pixels[di + 1] = recon[si + 1];
          pixels[di + 2] = recon[si + 2];
          pixels[di + 3] = channels === 4 ? recon[si + 3] : 255;
        }
      }

      // Замість створення нового буфера, міняємо місцями prev та recon
      const temp = prev;
      prev = recon;
      recon = temp;
    }

    return { width, height, pixels };
  } catch (e) {
    logger.error('parsePng error', e instanceof Error ? e : new Error(String(e)));
    return null;
  }
}

// ─── PNG Encoder ─────────────────────────────────────────────────────────────

import { deflateSync } from 'zlib';

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c >>> 0;
}

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function createChunk(type: string, data: Buffer): Buffer {
  const len = data.length;
  const chunk = Buffer.allocUnsafe(12 + len);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  const typeAndData = chunk.slice(4, 8 + len);
  chunk.writeUInt32BE(crc32(typeAndData), 8 + len);
  return chunk;
}

/**
 * Швидке кодування RGBA пікселів у валідний PNG буфер
 */
export function encodePng(data: PngData): Buffer {
  const { width, height, pixels } = data;
  const rowBytes = width * 4;
  const rawData = Buffer.allocUnsafe(height * (1 + rowBytes));

  for (let y = 0; y < height; y++) {
    const rawOffset = y * (1 + rowBytes);
    rawData[rawOffset] = 0; // Filter None
    pixels.copy(rawData, rawOffset + 1, y * rowBytes, (y + 1) * rowBytes);
  }

  const compressed = deflateSync(rawData);

  // IHDR
  const ihdrData = Buffer.allocUnsafe(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;  // bit depth
  ihdrData[9] = 6;  // color type RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrChunk = createChunk('IHDR', ihdrData);
  const idatChunk = createChunk('IDAT', compressed);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}
