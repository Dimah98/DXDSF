import { describe, it, expect, vi } from 'vitest';
import { actionNodeHandler } from './ActionNode';

describe('ActionNode - Click All Copies', () => {
  it('клікає ВСІ знайдені елементи без пропусків при clickAll: true', async () => {
    const clickedElements: number[] = [];

    // Симулюємо 4 DOM елементи, які мають бути зклікані по черзі
    const mockHandles = [0, 1, 2, 3].map((index) => {
      let isMarked = false;
      return {
        evaluate: vi.fn().mockImplementation(async (fn: any, marker: string) => {
          // Якщо функція перевіряє маркер
          if (fn.toString().includes('hasAttribute')) {
            return isMarked;
          }
          // Якщо функція встановлює маркер
          if (fn.toString().includes('setAttribute')) {
            isMarked = true;
            return;
          }
          // isConnected
          if (fn.toString().includes('isConnected')) {
            return true;
          }
          return null;
        }),
        scrollIntoViewIfNeeded: vi.fn().mockResolvedValue(undefined),
        click: vi.fn().mockImplementation(async () => {
          clickedElements.push(index);
        }),
        dispose: vi.fn().mockResolvedValue(undefined)
      };
    });

    const mockFrame = {
      locator: vi.fn().mockReturnValue({
        count: vi.fn().mockResolvedValue(4)
      }),
      $$: vi.fn().mockResolvedValue([...mockHandles]),
      evaluate: vi.fn().mockResolvedValue(undefined)
    };

    const mockPage = {
      frames: vi.fn().mockReturnValue([mockFrame]),
      locator: vi.fn().mockReturnValue({
        count: vi.fn().mockResolvedValue(4)
      }),
      $$: vi.fn().mockResolvedValue([...mockHandles]),
      waitForTimeout: vi.fn().mockResolvedValue(undefined),
      evaluate: vi.fn().mockResolvedValue(undefined)
    };

    const logs: string[] = [];
    const logToClient = vi.fn().mockImplementation((msg: string) => logs.push(msg));
    const takeDebugSnapshot = vi.fn().mockResolvedValue(undefined);
    const smartSleep = vi.fn().mockResolvedValue(undefined);

    const result = await actionNodeHandler({
      currentNode: {
        id: 'node-action-1',
        data: {
          selector: 'img[src*="sunflower"]',
          actionType: 'click',
          clickAll: true,
          quick: true
        }
      } as any,
      activePage: mockPage as any,
      ws: null,
      context: {},
      nodeTitle: 'Дія (Клік)',
      takeDebugSnapshot,
      logToClient,
      smartSleep
    });

    expect(clickedElements).toEqual([0, 1, 2, 3]);
    expect(clickedElements.length).toBe(4);
    expect(result.nextHandle).toEqual([null, undefined, 'success']);
    expect(logs.some(l => l.includes('4 елементів'))).toBe(true);
  });

  it('клікає лише один елемент коли clickAll: false', async () => {
    const clickedElements: number[] = [];

    const mockHandles = [0, 1, 2].map((index) => ({
      evaluate: vi.fn().mockImplementation(async (fn: any) => {
        if (fn.toString().includes('hasAttribute')) return false;
        if (fn.toString().includes('isConnected')) return true;
        return undefined;
      }),
      scrollIntoViewIfNeeded: vi.fn().mockResolvedValue(undefined),
      click: vi.fn().mockImplementation(async () => {
        clickedElements.push(index);
      }),
      dispose: vi.fn().mockResolvedValue(undefined)
    }));

    const mockFrame = {
      locator: vi.fn().mockReturnValue({
        count: vi.fn().mockResolvedValue(3)
      }),
      $$: vi.fn().mockResolvedValue([...mockHandles]),
      evaluate: vi.fn().mockResolvedValue(undefined)
    };

    const mockPage = {
      frames: vi.fn().mockReturnValue([mockFrame]),
      locator: vi.fn().mockReturnValue({
        count: vi.fn().mockResolvedValue(3)
      }),
      $$: vi.fn().mockResolvedValue([...mockHandles]),
      waitForTimeout: vi.fn().mockResolvedValue(undefined),
      evaluate: vi.fn().mockResolvedValue(undefined)
    };

    const logToClient = vi.fn();
    const takeDebugSnapshot = vi.fn().mockResolvedValue(undefined);
    const smartSleep = vi.fn().mockResolvedValue(undefined);

    const result = await actionNodeHandler({
      currentNode: {
        id: 'node-action-2',
        data: {
          selector: '.single-button',
          actionType: 'click',
          clickAll: false
        }
      } as any,
      activePage: mockPage as any,
      ws: null,
      context: {},
      nodeTitle: 'Дія (Клік)',
      takeDebugSnapshot,
      logToClient,
      smartSleep
    });

    expect(clickedElements).toEqual([0]);
    expect(clickedElements.length).toBe(1);
    expect(result.nextHandle).toEqual([null, undefined, 'success']);
  });

  it('клікає всі копії навіть якщо елементи видаляються з DOM одразу після кліку (збір врожаю)', async () => {
    const clickedElements: number[] = [];

    // Симулюємо 6 рослин соняшника на грядці
    const mockHandles = [0, 1, 2, 3, 4, 5].map((index) => {
      let isHarvested = false;
      return {
        evaluate: vi.fn().mockImplementation(async (fn: any) => {
          if (fn.toString().includes('hasAttribute')) return false;
          if (fn.toString().includes('isConnected')) return !isHarvested;
          return undefined;
        }),
        scrollIntoViewIfNeeded: vi.fn().mockResolvedValue(undefined),
        click: vi.fn().mockImplementation(async () => {
          clickedElements.push(index);
          // Після кліку рослина збирається і зникає з DOM
          isHarvested = true;
        }),
        dispose: vi.fn().mockResolvedValue(undefined)
      };
    });

    const mockFrame = {
      locator: vi.fn().mockReturnValue({
        count: vi.fn().mockResolvedValue(6)
      }),
      $$: vi.fn().mockResolvedValue([...mockHandles]),
      evaluate: vi.fn().mockResolvedValue(undefined)
    };

    const mockPage = {
      frames: vi.fn().mockReturnValue([mockFrame]),
      locator: vi.fn().mockReturnValue({
        count: vi.fn().mockResolvedValue(6)
      }),
      $$: vi.fn().mockResolvedValue([...mockHandles]),
      waitForTimeout: vi.fn().mockResolvedValue(undefined),
      evaluate: vi.fn().mockResolvedValue(undefined)
    };

    const logs: string[] = [];
    const logToClient = vi.fn().mockImplementation((msg: string) => logs.push(msg));
    const takeDebugSnapshot = vi.fn().mockResolvedValue(undefined);
    const smartSleep = vi.fn().mockResolvedValue(undefined);

    const result = await actionNodeHandler({
      currentNode: {
        id: 'node-action-harvest',
        data: {
          selector: 'img[src*="sunflower"]',
          actionType: 'click',
          clickAll: true,
          quick: true
        }
      } as any,
      activePage: mockPage as any,
      ws: null,
      context: {},
      nodeTitle: 'Збір врожаю',
      takeDebugSnapshot,
      logToClient,
      smartSleep
    });

    // Перевіряємо: всі 6 рослин мають бути зібрані по черзі [0, 1, 2, 3, 4, 5],
    // Жодна друга рослина не пропущена!
    expect(clickedElements).toEqual([0, 1, 2, 3, 4, 5]);
    expect(clickedElements.length).toBe(6);
    expect(result.nextHandle).toEqual([null, undefined, 'success']);
    expect(logs.some(l => l.includes('6 елементів'))).toBe(true);
  });
});
