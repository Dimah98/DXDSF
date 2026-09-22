import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clickTarget } from './BuildingPlacerNode';

describe('BuildingPlacerNode - clickTarget', () => {
  beforeEach(() => {
    (global as any).document = {
      querySelector: vi.fn().mockReturnValue(null),
      querySelectorAll: vi.fn().mockReturnValue([])
    };
  });

  it('вибирає ОСТАННЄ зображення зі списку при наявності кількох однакових по src', async () => {
    let lastClicked = false;
    let firstClicked = false;

    const img1 = {
      src: 'https://sunflower-land.com/game/workbench.png',
      offsetParent: {},
      getBoundingClientRect: () => ({ width: 40 }),
      closest: () => null,
      parentElement: null,
      tagName: 'IMG',
      click: () => { firstClicked = true; }
    };

    const img2 = {
      src: 'https://sunflower-land.com/game/workbench.png',
      offsetParent: {},
      getBoundingClientRect: () => ({ width: 40 }),
      closest: () => null,
      parentElement: null,
      tagName: 'IMG',
      click: () => { lastClicked = true; }
    };

    (global as any).document.querySelectorAll = vi.fn().mockImplementation((sel: string) => {
      if (sel.includes('img')) return [img1, img2];
      return [];
    });

    const mockPage = {
      evaluate: vi.fn().mockImplementation((fn: Function, args: any) => {
        return fn(args);
      })
    };

    const res = await clickTarget(mockPage, 'workbench');
    expect(res.success).toBe(true);
    expect(res.method).toBe('img-src-last');
    expect(lastClicked).toBe(true);
    expect(firstClicked).toBe(false);
  });

  it('вибирає ОСТАННЄ зображення зі списку при наявності кількох однакових по alt', async () => {
    let lastClicked = false;
    let firstClicked = false;

    const img1 = {
      src: '',
      alt: 'Kitchen',
      offsetParent: {},
      getBoundingClientRect: () => ({ width: 40 }),
      closest: () => null,
      parentElement: null,
      tagName: 'IMG',
      click: () => { firstClicked = true; }
    };

    const img2 = {
      src: '',
      alt: 'Kitchen',
      offsetParent: {},
      getBoundingClientRect: () => ({ width: 40 }),
      closest: () => null,
      parentElement: null,
      tagName: 'IMG',
      click: () => { lastClicked = true; }
    };

    (global as any).document.querySelectorAll = vi.fn().mockImplementation((sel: string) => {
      if (sel === 'img, [src]') return [];
      if (sel === 'img[alt]') return [img1, img2];
      return [];
    });

    const mockPage = {
      evaluate: vi.fn().mockImplementation((fn: Function, args: any) => {
        return fn(args);
      })
    };

    const res = await clickTarget(mockPage, 'kitchen');
    expect(res.success).toBe(true);
    expect(res.method).toBe('img-alt-last');
    expect(lastClicked).toBe(true);
    expect(firstClicked).toBe(false);
  });

  it('використовує locator.last() у Playwright fallback якщо в DOM не знайдено', async () => {
    const lastMockClick = vi.fn().mockResolvedValue(undefined);
    const firstMockClick = vi.fn().mockResolvedValue(undefined);

    const mockLocator = {
      count: vi.fn().mockResolvedValue(3),
      last: vi.fn().mockReturnValue({
        boundingBox: vi.fn().mockResolvedValue(null),
        click: lastMockClick
      }),
      first: vi.fn().mockReturnValue({
        boundingBox: vi.fn().mockResolvedValue(null),
        click: firstMockClick
      })
    };

    const mockPage = {
      evaluate: vi.fn().mockResolvedValue({ success: false }),
      locator: vi.fn().mockReturnValue(mockLocator)
    };

    const res = await clickTarget(mockPage, 'workbench');
    expect(res.success).toBe(true);
    expect(res.method).toBe('playwright-force-last');
    expect(mockLocator.last).toHaveBeenCalled();
    expect(lastMockClick).toHaveBeenCalled();
    expect(firstMockClick).not.toHaveBeenCalled();
  });
});
