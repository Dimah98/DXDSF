import { describe, it, expect, vi } from 'vitest';
import {
  findMolePhaserFrame,
  solveWhackAMoleWithPhaserHook,
  whackAMoleNodeHandler
} from './WhackAMoleNode';
import { NodeHandlerParams } from './types';

describe('WhackAMoleNode - Phaser Hook & Engine Modes', () => {
  describe('findMolePhaserFrame', () => {
    it('знаходить фрейм з активним Phaser екземпляром mine-whack', async () => {
      const mockFrame1 = {
        url: () => 'https://sunflower-land.com/game',
        evaluate: vi.fn().mockResolvedValue(false)
      };
      const mockFrame2 = {
        url: () => 'https://mine-whack.sunflower-land.com/?jwt=test',
        evaluate: vi.fn().mockResolvedValue(true)
      };
      const mockPage = {
        frames: () => [mockFrame1, mockFrame2]
      } as any;

      const result = await findMolePhaserFrame(mockPage);
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

      const result = await findMolePhaserFrame(mockPage);
      expect(result).toBeNull();
    });
  });

  describe('solveWhackAMoleWithPhaserHook', () => {
    it('повертає помилку якщо 9 лунок не знайдено в межах тайм-ауту', async () => {
      const mockFrame = {
        evaluate: vi.fn().mockResolvedValue({ status: 'no_scene' })
      };
      const logToClient = vi.fn();
      const smartSleep = vi.fn().mockResolvedValue(undefined);
      const checkRunning = () => true;

      const result = await solveWhackAMoleWithPhaserHook(
        mockFrame,
        logToClient,
        smartSleep,
        checkRunning,
        null,
        0,
        50,
        500
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('не знайдені');
    });

    it('зупиняється негайно якщо checkRunning повертає false', async () => {
      const mockFrame = {
        evaluate: vi.fn().mockResolvedValue({ status: 'ready' })
      };
      const logToClient = vi.fn();
      const smartSleep = vi.fn().mockResolvedValue(undefined);
      let running = true;
      const checkRunning = () => {
        const val = running;
        running = false;
        return val;
      };

      const result = await solveWhackAMoleWithPhaserHook(
        mockFrame,
        logToClient,
        smartSleep,
        checkRunning,
        null,
        0,
        50,
        5000
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('користувачем');
    });

    it('успішно відпрацьовує коли досягнуто цільовий рахунок targetScore', async () => {
      let pollCount = 0;
      const mockFrame = {
        evaluate: vi.fn().mockImplementation((arg: any) => {
          const str = typeof arg === 'string' ? arg : (typeof arg === 'function' ? arg.toString() : '');
          if (str.includes('ready') || str.includes('waiting_holes') || str.includes('portalState')) {
            return { status: 'ready', portalState: 'playing' };
          }
          if (str.includes('__MOLE_AUTOPILOT__') && (str.includes('state') || str.includes('timer'))) {
            pollCount++;
            return {
              score: pollCount * 25,
              streak: Math.min(pollCount, 5),
              whacked: pollCount,
              rocks: pollCount,
              irons: 0,
              golds: 0,
              bunniesAvoided: 2,
              isGameOver: pollCount >= 3
            };
          }
          return null;
        })
      };

      const logToClient = vi.fn();
      const smartSleep = vi.fn().mockResolvedValue(undefined);
      const checkRunning = () => true;

      const result = await solveWhackAMoleWithPhaserHook(
        mockFrame,
        logToClient,
        smartSleep,
        checkRunning,
        null,
        50, // targetScore = 50
        50,
        5000,
        false
      );

      expect(result.success).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(50);
      expect(result.bunniesAvoided).toBe(2);
    });

    it('автоматично розпізнає екранний рахунок та грає до (екран + 300)', async () => {
      let pollCount = 0;
      const mockFrame = {
        evaluate: vi.fn().mockImplementation((arg: any) => {
          const str = typeof arg === 'string' ? arg : (typeof arg === 'function' ? arg.toString() : '');
          if (str.includes('waiting_holes') || str.includes('portalState') || str.includes('ready')) {
            return { status: 'ready', portalState: 'playing' };
          }
          if (str.includes('__MOLE_AUTOPILOT__')) {
            pollCount++;
            const score = pollCount * 1000;
            return {
              score,
              streak: 5,
              whacked: 25,
              rocks: 15,
              irons: 5,
              golds: 5,
              bunniesAvoided: 4,
              whiteHits: 1,
              targetWhiteHits: 1,
              screenTargetScore: 2500,
              effectiveTargetScore: 2800,
              targetReached: score >= 2800,
              isGameOver: score >= 2800
            };
          }
          return null;
        })
      };

      const logToClient = vi.fn();
      const smartSleep = vi.fn().mockResolvedValue(undefined);
      const checkRunning = () => true;

      const result = await solveWhackAMoleWithPhaserHook(
        mockFrame,
        logToClient,
        smartSleep,
        checkRunning,
        null,
        0, // 0 = авто: екран + 300
        50,
        5000,
        false
      );

      expect(result.success).toBe(true);
      expect(result.screenTargetScore).toBe(2500);
      expect(result.effectiveTargetScore).toBe(2800);
      expect(result.score).toBeGreaterThanOrEqual(2800);
      expect(result.whiteHits).toBe(1);
    });
  });

  describe('whackAMoleNodeHandler', () => {
    it('миттєво виходить якщо кнопка завершення вже на екрані (early exit)', async () => {
      const mockPage = {
        frames: () => [{
          evaluate: vi.fn().mockResolvedValue(true)
        }],
        locator: vi.fn().mockReturnValue({
          filter: vi.fn().mockReturnValue({
            count: vi.fn().mockResolvedValue(1)
          })
        }),
        getByRole: vi.fn().mockReturnValue({
          count: vi.fn().mockResolvedValue(0)
        }),
        getByText: vi.fn().mockReturnValue({
          count: vi.fn().mockResolvedValue(0)
        })
      } as any;

      const logToClient = vi.fn();
      const smartSleep = vi.fn();
      const checkRunning = () => true;

      const result = await whackAMoleNodeHandler({
        currentNode: {
          id: 'node-whack-1',
          type: 'whackAMoleNode',
          data: {
            engineMode: 'phaser',
            exitButtonTexts: 'Сбір нагороди'
          }
        } as any,
        activePage: mockPage,
        ws: null,
        context: { test: 123 },
        logToClient,
        smartSleep,
        checkRunning
      } as unknown as NodeHandlerParams);

      expect(result.nextHandle).toEqual([null, undefined, 'success']);
    });

    it('повертає помилку в режимі phaser якщо рушій Phaser не знайдено', async () => {
      const mockPage = {
        frames: () => [{
          url: () => 'https://other.com',
          evaluate: vi.fn().mockResolvedValue(false)
        }],
        locator: vi.fn().mockReturnValue({
          filter: vi.fn().mockReturnValue({
            count: vi.fn().mockResolvedValue(0)
          })
        }),
        getByRole: vi.fn().mockReturnValue({
          count: vi.fn().mockResolvedValue(0)
        }),
        getByText: vi.fn().mockReturnValue({
          count: vi.fn().mockResolvedValue(0)
        })
      } as any;

      const logToClient = vi.fn();
      const smartSleep = vi.fn();
      const checkRunning = () => true;

      const result = await whackAMoleNodeHandler({
        currentNode: {
          id: 'node-whack-2',
          type: 'whackAMoleNode',
          data: {
            engineMode: 'phaser',
            exitButtonTexts: ''
          }
        } as any,
        activePage: mockPage,
        ws: null,
        context: {},
        logToClient,
        smartSleep,
        checkRunning
      } as unknown as NodeHandlerParams);

      expect(result.nextHandle).toEqual(['error']);
      expect(logToClient).toHaveBeenCalledWith(
        expect.stringContaining('екземпляр гри Phaser не знайдено'),
        'error'
      );
    });

    it('успішно проходить гру через Phaser Hook в режимі auto', async () => {
      const mockFrame = {
        url: () => 'https://mine-whack.sunflower-land.com/',
        evaluate: vi.fn().mockImplementation((fn: any) => {
          const str = typeof fn === 'string' ? fn : (typeof fn === 'function' ? fn.toString() : '');
          // check ready
          if (str.includes('waiting_holes') || str.includes('ready') || str.includes('portalState')) {
            return { status: 'ready', portalState: 'playing' };
          }
          // poll state
          if (str.includes('__MOLE_AUTOPILOT__') && (str.includes('state') || str.includes('timer'))) {
            return {
              score: 150,
              streak: 4,
              whacked: 12,
              rocks: 8,
              irons: 3,
              golds: 1,
              bunniesAvoided: 5,
              isGameOver: true
            };
          }
          // findMolePhaserFrame перевірка
          if (str.includes('getGame') || str.includes('__PHASER_GAME__') || str.includes('mine-whack')) {
            return true;
          }
          return null;
        })
      };

      const mockPage = {
        frames: () => [mockFrame],
        locator: vi.fn().mockReturnValue({
          filter: vi.fn().mockReturnValue({
            count: vi.fn().mockResolvedValue(0)
          })
        }),
        getByRole: vi.fn().mockReturnValue({
          count: vi.fn().mockResolvedValue(0)
        }),
        getByText: vi.fn().mockReturnValue({
          count: vi.fn().mockResolvedValue(0)
        })
      } as any;

      const logToClient = vi.fn();
      const smartSleep = vi.fn().mockResolvedValue(undefined);
      const checkRunning = () => true;

      const result = await whackAMoleNodeHandler({
        currentNode: {
          id: 'node-whack-3',
          type: 'whackAMoleNode',
          data: {
            engineMode: 'auto',
            exitButtonTexts: ''
          }
        } as any,
        activePage: mockPage,
        ws: null,
        context: { prevData: true },
        logToClient,
        smartSleep,
        checkRunning
      } as unknown as NodeHandlerParams);

      expect(result.nextHandle).toEqual([null, undefined, 'success']);
      expect((result.data as any).score).toBe(150);
      expect((result.data as any).whacked).toBe(12);
      expect((result.data as any).bunniesAvoided).toBe(5);
    });
  });
});
