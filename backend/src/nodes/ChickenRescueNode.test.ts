import { describe, it, expect, vi } from 'vitest';
import {
  findChickenRescuePhaserFrame,
  solveChickenRescueWithPhaserHook,
  chickenRescueNodeHandler
} from './ChickenRescueNode';
import { NodeHandlerParams } from './types';

describe('ChickenRescueNode - Phaser Hook & Autopilot', () => {
  describe('findChickenRescuePhaserFrame', () => {
    it('знаходить фрейм з активним екземпляром chicken-rescue', async () => {
      const mockFrame1 = {
        url: () => 'https://sunflower-land.com/game',
        evaluate: vi.fn().mockResolvedValue(false)
      };
      const mockFrame2 = {
        url: () => 'https://chicken-rescue.sunflower-land.com/?jwt=test',
        evaluate: vi.fn().mockResolvedValue(true)
      };
      const mockPage = {
        context: () => ({
          pages: () => [{
            frames: () => [mockFrame1, mockFrame2]
          }]
        })
      } as any;

      const result = await findChickenRescuePhaserFrame(mockPage);
      expect(result).not.toBeNull();
      expect(result?.targetFrame).toBe(mockFrame2);
    });

    it('повертає null якщо гру не знайдено в жодному фреймі', async () => {
      const mockFrame = {
        url: () => 'https://sunflower-land.com/game',
        evaluate: vi.fn().mockResolvedValue(false)
      };
      const mockPage = {
        context: () => ({
          pages: () => [{
            frames: () => [mockFrame]
          }]
        })
      } as any;

      const result = await findChickenRescuePhaserFrame(mockPage);
      expect(result).toBeNull();
    });
  });

  describe('solveChickenRescueWithPhaserHook', () => {
    it('повертає помилку якщо сцену chicken_rescue не знайдено в межах тайм-ауту', async () => {
      const mockFrame = {
        evaluate: vi.fn().mockResolvedValue({ status: 'no_scene' })
      };
      const logToClient = vi.fn();
      const smartSleep = vi.fn().mockResolvedValue(undefined);
      const checkRunning = () => true;

      const result = await solveChickenRescueWithPhaserHook(
        mockFrame,
        logToClient,
        smartSleep,
        checkRunning,
        null,
        10,
        1000
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('не знайдено');
    });

    it('повертає помилку якщо виконання зупинено користувачем', async () => {
      const mockFrame = {
        evaluate: vi.fn().mockResolvedValue({ status: 'ready' })
      };
      const logToClient = vi.fn();
      const smartSleep = vi.fn().mockResolvedValue(undefined);
      let running = true;

      const promise = solveChickenRescueWithPhaserHook(
        mockFrame,
        logToClient,
        smartSleep,
        () => running,
        null,
        10,
        5000
      );

      running = false;
      const result = await promise;

      expect(result.success).toBe(false);
      expect(result.error).toBe('зупинено користувачем');
    });

    it('успішно проходить гру та повертає результат при досягненні цільового рахунку', async () => {
      let callCount = 0;
      const mockFrame = {
        evaluate: vi.fn().mockImplementation((code: string) => {
          if (code.includes('status: \'ready\'') || code.includes('status: \'ready\'')) {
            return Promise.resolve({ status: 'ready', isDead: false, score: 0 });
          }
          if (code.includes('win.__CHICKEN_AUTOPILOT_HOOK__ = hook')) {
            return Promise.resolve(true);
          }
          if (code.includes('followingCount: sc.following')) {
            callCount++;
            if (callCount === 1) {
              return Promise.resolve({ score: 10, isDead: false, followingCount: 10, target: 40 });
            }
            return Promise.resolve({ score: 40, isDead: false, followingCount: 40, target: 40 });
          }
          return Promise.resolve(true);
        })
      };
      const logToClient = vi.fn();
      const smartSleep = vi.fn().mockResolvedValue(undefined);
      const checkRunning = () => true;

      const result = await solveChickenRescueWithPhaserHook(
        mockFrame,
        logToClient,
        smartSleep,
        checkRunning,
        null,
        40,
        30000,
        true,
        true,
        3
      );

      expect(result.success).toBe(true);
      expect(result.score).toBe(40);
      expect(logToClient).toHaveBeenCalledWith(expect.stringContaining('Ціль досягнуто'), 'success');
    });

    it('коректно завершує роботу якщо вичерпано спроби у порталі (noAttempts)', async () => {
      const mockFrame = {
        evaluate: vi.fn().mockImplementation((code: string) => {
          if (code.includes('status: \'ready\'')) {
            return Promise.resolve({ status: 'ready', isDead: false, score: 0 });
          }
          if (code.includes('win.__CHICKEN_AUTOPILOT_HOOK__ = hook')) {
            return Promise.resolve(true);
          }
          if (code.includes('followingCount: sc.following')) {
            return Promise.resolve({ score: 0, isDead: true, followingCount: 0, portalState: 'noAttempts' });
          }
          return Promise.resolve(true);
        })
      };
      const logToClient = vi.fn();
      const smartSleep = vi.fn().mockResolvedValue(undefined);
      const checkRunning = () => true;

      const result = await solveChickenRescueWithPhaserHook(
        mockFrame,
        logToClient,
        smartSleep,
        checkRunning,
        null,
        40,
        10000,
        true,
        true,
        3
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('noAttempts');
      expect(logToClient).toHaveBeenCalledWith(expect.stringContaining('Вичерпано спроби'), 'error');
    });
  });

  describe('chickenRescueNodeHandler', () => {
    it('повертає помилку якщо активна сторінка відсутня', async () => {
      const logToClient = vi.fn();
      const result = await chickenRescueNodeHandler({
        currentNode: {
          id: 'test-node',
          data: { targetScore: 40 }
        },
        activePage: null as any,
        ws: null as any,
        context: {},
        logToClient,
        smartSleep: vi.fn(),
        checkRunning: () => true
      } as unknown as NodeHandlerParams);

      expect(result.nextHandle).toContain('error');
      expect((result.data as any).error).toContain('немає активної сторінки');
    });

    it('повертає помилку якщо рушій гри не знайдено', async () => {
      const logToClient = vi.fn();
      const mockPage = {
        context: () => ({
          pages: () => [{
            frames: () => [{
              url: () => 'https://other.com',
              evaluate: vi.fn().mockResolvedValue(false)
            }]
          }]
        })
      } as any;

      const result = await chickenRescueNodeHandler({
        currentNode: {
          id: 'test-node',
          data: { targetScore: 40 }
        },
        activePage: mockPage,
        ws: null as any,
        context: {},
        logToClient,
        smartSleep: vi.fn(),
        checkRunning: () => true
      } as unknown as NodeHandlerParams);

      expect(result.nextHandle).toContain('error');
      expect((result.data as any).error).toContain('chicken_rescue не знайдено');
    });
  });
});
