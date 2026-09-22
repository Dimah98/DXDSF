import { describe, it, expect, vi } from 'vitest';
import {
  findMemoryPhaserFrame,
  solveMemoryGameWithPhaserHook,
  memoryGameNodeHandler
} from './MemoryGameNode';
import { NodeHandlerParams } from './types';

describe('MemoryGameNode - Phaser Hook & Engine Modes', () => {
  describe('findMemoryPhaserFrame', () => {
    it('знаходить фрейм з активним Phaser екземпляром', async () => {
      const mockFrame1 = {
        url: () => 'https://sunflower-land.com/game',
        evaluate: vi.fn().mockResolvedValue(false)
      };
      const mockFrame2 = {
        url: () => 'https://memory.sunflower-land.com/',
        evaluate: vi.fn().mockResolvedValue(true)
      };
      const mockPage = {
        frames: () => [mockFrame1, mockFrame2]
      } as any;

      const result = await findMemoryPhaserFrame(mockPage);
      expect(result).not.toBeNull();
      expect(result?.targetFrame).toBe(mockFrame2);
    });

    it('повертає null якщо Phaser не знайдено в жодному фреймі', async () => {
      const mockFrame = {
        url: () => 'https://sunflower-land.com/game',
        evaluate: vi.fn().mockResolvedValue(false)
      };
      const mockPage = {
        frames: () => [mockFrame]
      } as any;

      const result = await findMemoryPhaserFrame(mockPage);
      expect(result).toBeNull();
    });
  });

  describe('solveMemoryGameWithPhaserHook', () => {
    it('успішно зчитує 30 карток та збирає всі 15 пар', async () => {
      // 15 пар унікальних культур
      const crops = [
        'Sunflower', 'Potato', 'Pumpkin', 'Carrot', 'Cabbage',
        'Beetroot', 'Cauliflower', 'Parsnip', 'Eggplant', 'Corn',
        'Radish', 'Wheat', 'Apple', 'Orange', 'Banana'
      ];
      // 30 карток: кожна культура повторюється двічі
      const mockCards = crops.flatMap((name, idx) => [
        { index: idx * 2, name, isFlipped: false, isSolved: false },
        { index: idx * 2 + 1, name, isFlipped: false, isSolved: false }
      ]);

      const clickedIndices: number[] = [];
      const mockFrame = {
        evaluate: vi.fn().mockImplementation((fn: any, arg?: any) => {
          if (typeof arg === 'number') {
            clickedIndices.push(arg);
            return true;
          }
          if (typeof fn === 'function') {
            const fnStr = fn.toString();
            if (fnStr.includes('waiting_cards')) {
              return { status: 'ready', count: 30 };
            }
            if (fnStr.includes('solvedSet')) {
              return mockCards;
            }
            if (fnStr.includes('flippedCards')) {
              return { locked: false, flipped: 0 };
            }
          }
          return null;
        })
      };

      const logToClient = vi.fn();
      const smartSleep = vi.fn().mockResolvedValue(undefined);
      const checkRunning = () => true;

      const result = await solveMemoryGameWithPhaserHook(
        mockFrame,
        logToClient,
        smartSleep,
        checkRunning,
        null,
        10,
        10,
        5000
      );

      expect(result.success).toBe(true);
      expect(result.matchedPairs).toBe(15);
      expect(result.totalPairs).toBe(15);
      expect(clickedIndices.length).toBe(30);
    });

    it('відкриває карти по порядку як людина (послідовний обхід 0..29)', async () => {
      // Розташуємо пари врозкид: пара для 0 знаходиться на 18, для 1 на 25 і т.д.
      const mockCards = Array.from({ length: 30 }, (_, i) => ({
        index: i,
        name: `Crop_${Math.floor(i % 15)}`,
        isFlipped: false,
        isSolved: false
      }));

      const firstClicksInPairs: number[] = [];
      let clickCount = 0;
      const mockFrame = {
        evaluate: vi.fn().mockImplementation((fn: any, arg?: any) => {
          if (typeof arg === 'number') {
            if (clickCount % 2 === 0) {
              firstClicksInPairs.push(arg);
            }
            clickCount++;
            return true;
          }
          if (typeof fn === 'function') {
            const fnStr = fn.toString();
            if (fnStr.includes('waiting_cards')) return { status: 'ready', count: 30 };
            if (fnStr.includes('solvedSet')) return mockCards;
            if (fnStr.includes('flippedCards')) return { locked: false, flipped: 0 };
          }
          return null;
        })
      };

      const logToClient = vi.fn();
      const smartSleep = vi.fn().mockResolvedValue(undefined);
      const checkRunning = () => true;

      const result = await solveMemoryGameWithPhaserHook(
        mockFrame,
        logToClient,
        smartSleep,
        checkRunning,
        null,
        10,
        10,
        5000
      );

      expect(result.success).toBe(true);
      // Перші картки в парах завжди йдуть у строго зростаючому порядку (послідовно 0, 1, 2...)
      for (let k = 1; k < firstClicksInPairs.length; k++) {
        expect(firstClicksInPairs[k]).toBeGreaterThan(firstClicksInPairs[k - 1]);
      }
      expect(firstClicksInPairs[0]).toBe(0);
    });

    it('перериває роботу якщо checkRunning повертає false', async () => {
      const mockFrame = {
        evaluate: vi.fn().mockResolvedValue({ status: 'ready', count: 30 })
      };
      const logToClient = vi.fn();
      const smartSleep = vi.fn().mockResolvedValue(undefined);
      let runCount = 0;
      const checkRunning = () => {
        runCount++;
        return runCount <= 1; // зупиняється на другій перевірці
      };

      const result = await solveMemoryGameWithPhaserHook(
        mockFrame,
        logToClient,
        smartSleep,
        checkRunning,
        null,
        10,
        10,
        5000
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('зупинено користувачем');
    });
  });

  describe('memoryGameNodeHandler', () => {
    it('виконує Phaser Hook та повертає успіх при знаходженні рушія', async () => {
      const crops = ['Sunflower', 'Potato'];
      const mockCards = crops.flatMap((name, idx) => [
        { index: idx * 2, name, isFlipped: false, isSolved: false },
        { index: idx * 2 + 1, name, isFlipped: false, isSolved: false }
      ]);
      // Доповнюємо до 30
      while (mockCards.length < 30) {
        const i = mockCards.length;
        mockCards.push({ index: i, name: `Crop_${i}`, isFlipped: false, isSolved: true });
      }

      const mockTargetFrame = {
        url: () => 'https://memory.sunflower-land.com/',
        evaluate: vi.fn().mockImplementation((fn: any, arg?: any) => {
          if (typeof arg === 'number') {
            return true;
          }
          if (typeof fn === 'function') {
            const fnStr = fn.toString();
            if (fnStr.includes('PHASER_GAME__?.scene') || fnStr.includes('win.Phaser')) {
              return true;
            }
            if (fnStr.includes('waiting_cards')) {
              return { status: 'ready', count: 30 };
            }
            if (fnStr.includes('solvedSet')) {
              return mockCards;
            }
            if (fnStr.includes('flippedCards')) {
              return { locked: false, flipped: 0 };
            }
          }
          return null;
        })
      };

      const mockPage = {
        frames: () => [mockTargetFrame],
        mainFrame: () => mockTargetFrame,
        locator: vi.fn().mockReturnValue({ count: vi.fn().mockResolvedValue(0) }),
        getByText: vi.fn().mockReturnValue({ count: vi.fn().mockResolvedValue(0) }),
        getByRole: vi.fn().mockReturnValue({ count: vi.fn().mockResolvedValue(0) }),
        evaluate: vi.fn().mockResolvedValue(1)
      } as any;

      const logToClient = vi.fn();
      const smartSleep = vi.fn().mockResolvedValue(undefined);
      const checkRunning = () => true;

      const params = {
        currentNode: {
          id: 'test-mem-node',
          type: 'memoryGameNode',
          data: {
            engineMode: 'phaser',
            phaserFlipDelay: 50,
            phaserPairDelay: 50
          }
        } as any,
        activePage: mockPage,
        ws: null as any,
        context: { runId: 1 },
        logToClient,
        smartSleep,
        checkRunning
      } as unknown as NodeHandlerParams;

      const res = await memoryGameNodeHandler(params);
      expect(res.nextHandle).toEqual([null, undefined, 'success']);
      expect((res.data as any).matchedPairs).toBe(15);
    });

    it('повертає early exit якщо виявлено кнопку завершення перед грою', async () => {
      const mockPage = {
        frames: () => [],
        mainFrame: () => null,
        locator: vi.fn().mockReturnValue({ count: vi.fn().mockResolvedValue(1) }),
        getByText: vi.fn().mockReturnValue({ count: vi.fn().mockResolvedValue(0) }),
        getByRole: vi.fn().mockReturnValue({ count: vi.fn().mockResolvedValue(0) }),
      } as any;

      const logToClient = vi.fn();
      const smartSleep = vi.fn().mockResolvedValue(undefined);
      const checkRunning = () => true;

      const params = {
        currentNode: {
          id: 'test-mem-node',
          type: 'memoryGameNode',
          data: {
            engineMode: 'phaser',
            exitButtonTexts: '.claim-button'
          }
        } as any,
        activePage: mockPage,
        ws: null as any,
        context: { runId: 2 },
        logToClient,
        smartSleep,
        checkRunning
      } as unknown as NodeHandlerParams;

      const res = await memoryGameNodeHandler(params);
      expect(res.nextHandle).toEqual([null, undefined, 'success']);
      expect((res.data as any).matchedPairs).toBe(0);
      expect(logToClient).toHaveBeenCalledWith(expect.stringContaining('гра вже завершена'), 'success');
    });
  });
});
