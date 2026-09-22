import { describe, it, expect, vi } from 'vitest';
import {
  detectCaptchaType,
  getCaptchaCoordinates,
  getRotateCaptchaState,
  solveCaptcha,
  captchaSolverNodeHandler
} from './CaptchaNode';

describe('CaptchaNode - Sunflower Land Quick Check Puzzle & Rotate', () => {
  describe('detectCaptchaType', () => {
    it('визначає rotate капчу за текстом або елементами', async () => {
      const mockPage = {
        evaluate: vi.fn().mockResolvedValue({ present: true, type: 'rotate' })
      } as any;

      const result = await detectCaptchaType(mockPage);
      expect(result.present).toBe(true);
      expect(result.type).toBe('rotate');
    });

    it('визначає jigsaw капчу за наявністю canvas', async () => {
      const mockPage = {
        evaluate: vi.fn().mockResolvedValue({ present: true, type: 'jigsaw' })
      } as any;

      const result = await detectCaptchaType(mockPage);
      expect(result.present).toBe(true);
      expect(result.type).toBe('jigsaw');
    });

    it('повертає false якщо капчі немає', async () => {
      const mockPage = {
        evaluate: vi.fn().mockResolvedValue({ present: false })
      } as any;

      const result = await detectCaptchaType(mockPage);
      expect(result.present).toBe(false);
    });
  });

  describe('getRotateCaptchaState', () => {
    it('правильно вираховує мінімальну кількість кліків для повернення до 0°', async () => {
      // 225 deg = step 5 (5 * 45). 8 - 5 = 3 right clicks
      const mockState = {
        detected: true,
        collectible: 'Farm Dog',
        currentDeg: 225,
        step: 5,
        clicksNeeded: { dir: 'right', count: 3 }
      };

      const mockPage = {
        evaluate: vi.fn().mockResolvedValue(mockState)
      } as any;

      const res = await getRotateCaptchaState(mockPage);
      expect(res.detected).toBe(true);
      expect(res.collectible).toBe('Farm Dog');
      expect(res.clicksNeeded.dir).toBe('right');
      expect(res.clicksNeeded.count).toBe(3);
    });

    it('для step 2 (90°) повертає 2 лівих кліки', async () => {
      const mockState = {
        detected: true,
        collectible: 'Scarecrow',
        currentDeg: 90,
        step: 2,
        clicksNeeded: { dir: 'left', count: 2 }
      };

      const mockPage = {
        evaluate: vi.fn().mockResolvedValue(mockState)
      } as any;

      const res = await getRotateCaptchaState(mockPage);
      expect(res.clicksNeeded.dir).toBe('left');
      expect(res.clicksNeeded.count).toBe(2);
    });
  });

  describe('getCaptchaCoordinates (Jigsaw)', () => {
    it('успішно витягує координати культури та силуету', async () => {
      const mockCoords = {
        detected: true,
        crop: 'Sunflower',
        piecePos: { x: 15, y: 16 },
        targetPos: { x: 230, y: 87 },
        startClient: { x: 455, y: 289 },
        endClient: { x: 780, y: 396 },
        canvasRect: { left: 405, top: 237, width: 453, height: 226 }
      };

      const mockPage = {
        evaluate: vi.fn().mockResolvedValue(mockCoords)
      } as any;

      const result = await getCaptchaCoordinates(mockPage);
      expect(result.detected).toBe(true);
      expect(result.crop).toBe('Sunflower');
      expect(result.startClient?.x).toBe(455);
      expect(result.endClient?.x).toBe(780);
    });
  });

  describe('solveCaptcha', () => {
    it('пропускає без помилки якщо капчі немає і skipIfNotFound=true', async () => {
      const mockPage = {
        evaluate: vi.fn().mockResolvedValue({ present: false })
      } as any;

      const result = await solveCaptcha(mockPage, { skipIfNotFound: true });
      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
      expect(result.solved).toBe(false);
    });

    it('успішно розв\'язує Rotate Captcha з кліками та кнопкою Submit', async () => {
      let evalCall = 0;
      const mockPage = {
        evaluate: vi.fn().mockImplementation(() => {
          evalCall++;
          if (evalCall === 1) return { present: true, type: 'rotate' };
          if (evalCall === 2) return {
            detected: true,
            collectible: 'Farm Dog',
            currentDeg: 225,
            step: 5,
            clicksNeeded: { dir: 'right', count: 3 }
          };
          if (evalCall === 3) return true; // submit click
          if (evalCall === 4) return { hasCorrect: true, hasContinueBtn: false, hasRotateModal: false };
          return true; // continue click
        }),
        click: vi.fn().mockResolvedValue(undefined),
        waitForTimeout: vi.fn().mockResolvedValue(undefined)
      } as any;

      const log = vi.fn();
      const result = await solveCaptcha(mockPage, { autoClickContinue: true }, log);
      expect(result.success).toBe(true);
      expect(result.solved).toBe(true);
      expect(result.captchaType).toBe('rotate');
      expect(result.crop).toBe('Farm Dog');
      expect(mockPage.click).toHaveBeenCalledTimes(3);
    });

    it('успішно розв\'язує Jigsaw Captcha з перетягуванням', async () => {
      let evalCall = 0;
      const mockPage = {
        evaluate: vi.fn().mockImplementation(() => {
          evalCall++;
          if (evalCall === 1) return { present: true, type: 'jigsaw' };
          if (evalCall === 2) return {
            detected: true,
            crop: 'Sunflower',
            piecePos: { x: 15, y: 16 },
            targetPos: { x: 230, y: 87 },
            startClient: { x: 455, y: 289 },
            endClient: { x: 780, y: 396 }
          };
          if (evalCall === 3) return { hasSuccess: true, hasContinueBtn: true, hasCanvas: true };
          return true;
        }),
        mouse: {
          move: vi.fn().mockResolvedValue(undefined),
          down: vi.fn().mockResolvedValue(undefined),
          up: vi.fn().mockResolvedValue(undefined)
        },
        waitForTimeout: vi.fn().mockResolvedValue(undefined)
      } as any;

      const log = vi.fn();
      const result = await solveCaptcha(mockPage, { autoClickContinue: true }, log);
      expect(result.success).toBe(true);
      expect(result.solved).toBe(true);
      expect(result.captchaType).toBe('jigsaw');
      expect(result.crop).toBe('Sunflower');
      expect(mockPage.mouse.move).toHaveBeenCalled();
      expect(mockPage.mouse.down).toHaveBeenCalled();
      expect(mockPage.mouse.up).toHaveBeenCalled();
    });
  });

  describe('captchaSolverNodeHandler', () => {
    it('повертає success та skipped handle якщо капчу пропущено', async () => {
      const mockPage = {
        evaluate: vi.fn().mockResolvedValue({ present: false })
      } as any;

      const logToClient = vi.fn();
      const params = {
        currentNode: { id: 'node_1', type: 'captchaSolverNode', data: { skipIfNotFound: true } },
        activePage: mockPage,
        context: { someVar: 123 },
        logToClient
      } as any;

      const res = await captchaSolverNodeHandler(params);
      expect(res.data!.captchaSkipped).toBe(true);
      expect(res.data!.captchaSolved).toBe(false);
      expect(res.nextHandle).toContain('skipped');
    });

    it('повертає solved handle якщо капчу успішно пройдено', async () => {
      let callCount = 0;
      const mockPage = {
        evaluate: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) return { present: true, type: 'rotate' };
          if (callCount === 2) return {
            detected: true,
            collectible: 'Farm Dog',
            currentDeg: 0,
            step: 0,
            clicksNeeded: { dir: 'right', count: 0 }
          };
          if (callCount === 3) return true; // submit
          if (callCount === 4) return { hasCorrect: true, hasContinueBtn: true };
          return true;
        }),
        click: vi.fn().mockResolvedValue(undefined),
        waitForTimeout: vi.fn().mockResolvedValue(undefined)
      } as any;

      const logToClient = vi.fn();
      const params = {
        currentNode: { id: 'node_1', type: 'captchaSolverNode', data: { skipIfNotFound: true } },
        activePage: mockPage,
        context: {},
        logToClient
      } as any;

      const res = await captchaSolverNodeHandler(params);
      expect(res.data!.captchaSolved).toBe(true);
      expect(res.data!.captchaType).toBe('rotate');
      expect(res.nextHandle).toContain('solved');
    });
  });
});
