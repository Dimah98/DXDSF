import { describe, it, expect, vi } from 'vitest';
import {
  findSequencePhaserFrame,
  solveSequenceWithPhaserHook,
  sequenceMemoryNodeHandler
} from './SequenceMemoryNode';
import { NodeHandlerParams } from './types';

describe('SequenceMemoryNode - Phaser Hook & Engine Modes', () => {
  describe('findSequencePhaserFrame', () => {
    it('знаходить фрейм з активним Phaser екземпляром chaacs-temple', async () => {
      const mockFrame1 = {
        url: () => 'https://sunflower-land.com/game',
        evaluate: vi.fn().mockResolvedValue(false)
      };
      const mockFrame2 = {
        url: () => 'https://chaacs-temple.minigames.sunflower-land.com/?jwt=test',
        evaluate: vi.fn().mockResolvedValue(true)
      };
      const mockPage = {
        frames: () => [mockFrame1, mockFrame2]
      } as any;

      const result = await findSequencePhaserFrame(mockPage);
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

      const result = await findSequencePhaserFrame(mockPage);
      expect(result).toBeNull();
    });
  });

  describe('solveSequenceWithPhaserHook', () => {
    it('повертає помилку якщо 9 рун не знайдено в межах тайм-ауту', async () => {
      const mockFrame = {
        evaluate: vi.fn().mockResolvedValue({ status: 'no_board' })
      };
      const logToClient = vi.fn();
      const smartSleep = vi.fn().mockResolvedValue(undefined);
      const checkRunning = () => true;

      const result = await solveSequenceWithPhaserHook(
        mockFrame,
        logToClient,
        smartSleep,
        checkRunning,
        null,
        5,
        50,
        30,
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

      const result = await solveSequenceWithPhaserHook(
        mockFrame,
        logToClient,
        smartSleep,
        checkRunning,
        null,
        5,
        50,
        30,
        50,
        5000
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('користувачем');
    });

    it('успішно проходить гру коли досягнуто targetScore', async () => {
      let currentScore = 0;
      let roundSteps = [6, 7];

      const mockFrame = {
        evaluate: vi.fn().mockImplementation((arg: any) => {
          const str = typeof arg === 'string' ? arg : (typeof arg === 'function' ? arg.toString() : '');
          if (str.includes('waiting_pieces') || str.includes('status: \'ready\'') || str.includes('ready')) {
            return { status: 'ready', portalState: 'playing' };
          }
          if (str.includes('nextTarget') || str.includes('currLength')) {
            return {
              locked: false,
              score: currentScore,
              lives: 3,
              currLength: roundSteps.length,
              targetScore: 2,
              nextTarget: roundSteps.length > 0 ? roundSteps[0] : null,
              remainingInRound: roundSteps.length,
              portalState: 'playing'
            };
          }
          if (str.includes('handlePointerDown') && str.includes('handlePointerUp')) {
            roundSteps.shift();
            if (roundSteps.length === 0) {
              currentScore++;
              if (currentScore < 2) {
                roundSteps = [1, 2, 3];
              }
            }
            return { ok: true, score: currentScore, lives: 3 };
          }
          return null;
        })
      };

      const logToClient = vi.fn();
      const smartSleep = vi.fn().mockResolvedValue(undefined);
      const checkRunning = () => true;

      const result = await solveSequenceWithPhaserHook(
        mockFrame,
        logToClient,
        smartSleep,
        checkRunning,
        null,
        2, // targetScore = 2
        10,
        10,
        10,
        5000,
        false
      );

      expect(result.success).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(2);
      expect(result.lives).toBe(3);
    });
  });

  describe('sequenceMemoryNodeHandler', () => {
    it('повертає помилку в режимі phaser якщо рушій Phaser не знайдено', async () => {
      const mockPage = {
        frames: () => [{
          url: () => 'https://other.com',
          evaluate: vi.fn().mockResolvedValue(false)
        }]
      } as any;

      const logToClient = vi.fn();
      const smartSleep = vi.fn().mockResolvedValue(undefined);
      const checkRunning = () => true;

      const result = await sequenceMemoryNodeHandler({
        currentNode: {
          id: 'node-seq-1',
          type: 'sequenceMemoryNode',
          data: {
            engineMode: 'phaser'
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
        expect.stringContaining('екземпляр гри Phaser (Chaac\'s Temple) не знайдено'),
        'error'
      );
    });

    it('успішно проходить гру через Phaser Hook в режимі auto', async () => {
      let currentScore = 0;
      let roundSteps = [0, 4];

      const mockFrame = {
        url: () => 'https://chaacs-temple.minigames.sunflower-land.com/',
        evaluate: vi.fn().mockImplementation((fn: any) => {
          const str = typeof fn === 'string' ? fn : (typeof fn === 'function' ? fn.toString() : '');
          if (str.includes('waiting_pieces') || str.includes('ready')) {
            return { status: 'ready', portalState: 'playing' };
          }
          if (str.includes('nextTarget') || str.includes('currLength')) {
            return {
              locked: false,
              score: currentScore,
              lives: 3,
              currLength: roundSteps.length,
              targetScore: 1,
              nextTarget: roundSteps.length > 0 ? roundSteps[0] : null,
              remainingInRound: roundSteps.length,
              portalState: 'playing'
            };
          }
          if (str.includes('handlePointerDown') && str.includes('handlePointerUp')) {
            roundSteps.shift();
            if (roundSteps.length === 0) {
              currentScore++;
            }
            return { ok: true, score: currentScore, lives: 3 };
          }
          if (str.includes('chaacs-temple') || str.includes('getGame') || str.includes('__PHASER_GAME__')) {
            return true;
          }
          return null;
        })
      };

      const mockPage = {
        frames: () => [mockFrame]
      } as any;

      const logToClient = vi.fn();
      const smartSleep = vi.fn().mockResolvedValue(undefined);
      const checkRunning = () => true;

      const result = await sequenceMemoryNodeHandler({
        currentNode: {
          id: 'node-seq-2',
          type: 'sequenceMemoryNode',
          data: {
            engineMode: 'auto',
            targetScore: 1
          }
        } as any,
        activePage: mockPage,
        ws: null,
        context: { prevData: 42 },
        logToClient,
        smartSleep,
        checkRunning
      } as unknown as NodeHandlerParams);

      expect(result.nextHandle).toEqual([null, undefined, 'success']);
      expect((result.data as any).score).toBe(1);
      expect((result.data as any).completedRounds).toBe(1);
      expect((result.data as any).lives).toBe(3);
    });
  });
});
