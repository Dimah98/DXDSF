import { describe, it, expect, vi } from 'vitest';
import { worldNavigatorNodeHandler } from './WorldNavigatorNode';
import { NodeHandlerParams } from './types';

describe('WorldNavigatorNode', () => {
  it('повертає помилку якщо не вказано ані NPC ані координат', async () => {
    const logToClient = vi.fn();
    const mockPage = {
      url: () => 'https://sunflower-land.com/play/#/world/plaza',
      evaluate: vi.fn()
    } as any;

    const params: NodeHandlerParams = {
      currentNode: {
        id: 'nav_1',
        type: 'worldNavigatorNode',
        position: { x: 0, y: 0 },
        data: { targetNpc: '', customNpcName: '' }
      },
      activePage: mockPage,
      ws: {} as any,
      context: { label: 'test' },
      nodes: [],
      edges: [],
      globalVariables: {},
      projectName: 'test',
      nodeTitle: 'World Navigator',
      logToClient,
      takeDebugSnapshot: vi.fn(),
      smartSleep: vi.fn(),
      broadcastVariables: vi.fn(),
      nodeRuntimeState: new Map(),
      checkRunning: () => true
    };

    const res = await worldNavigatorNodeHandler(params);
    expect(res.nextHandle).toEqual(['error']);
    expect(logToClient).toHaveBeenCalledWith(
      expect.stringContaining('Не вказано цільового NPC або координати'),
      'error'
    );
  });

  it('успішно завершує навігацію коли персонаж доходить до цілі', async () => {
    const logToClient = vi.fn();
    const mockPage = {
      url: () => 'https://sunflower-land.com/play/#/world/plaza',
      evaluate: vi.fn()
        .mockResolvedValueOnce({ sceneKey: 'plaza', npcs: ['stella'] }) // waitForWorldScene
        .mockResolvedValueOnce({
          success: true,
          reachedGoal: true,
          distToGoal: 20,
          startPos: { x: 400, y: 300 },
          finalPos: { x: 320, y: 260 },
          rawWpsCount: 15,
          waypointsCount: 3,
          durationMs: 2500,
          targetNpcFound: true
        }) // navigationResult
        .mockResolvedValueOnce(undefined), // click evaluation
      keyboard: {
        press: vi.fn().mockResolvedValue(undefined)
      }
    } as any;

    const params: NodeHandlerParams = {
      currentNode: {
        id: 'nav_2',
        type: 'worldNavigatorNode',
        position: { x: 0, y: 0 },
        data: { targetLocation: 'plaza', targetNpc: 'stella', autoInteract: true }
      },
      activePage: mockPage,
      ws: {} as any,
      context: { label: 'test' },
      nodes: [],
      edges: [],
      globalVariables: {},
      projectName: 'test',
      nodeTitle: 'World Navigator',
      logToClient,
      takeDebugSnapshot: vi.fn(),
      smartSleep: vi.fn(),
      broadcastVariables: vi.fn(),
      nodeRuntimeState: new Map(),
      checkRunning: () => true
    };

    const res = await worldNavigatorNodeHandler(params);
    expect(res.nextHandle).toEqual(['success']);
    expect(logToClient).toHaveBeenCalledWith(
      expect.stringContaining('Успішно пройдено'),
      'success'
    );
    expect(mockPage.keyboard.press).toHaveBeenCalledWith('Space');
  });

  it('повертає помилку якщо рушій повернув помилку або таймаут', async () => {
    const logToClient = vi.fn();
    const mockPage = {
      url: () => 'https://sunflower-land.com/play/#/world/beach',
      evaluate: vi.fn()
        .mockResolvedValueOnce({ sceneKey: 'beach', npcs: ['corale'] })
        .mockResolvedValueOnce({
          success: false,
          error: 'NPC не знайдено на карті'
        })
    } as any;

    const params: NodeHandlerParams = {
      currentNode: {
        id: 'nav_3',
        type: 'worldNavigatorNode',
        position: { x: 0, y: 0 },
        data: { targetLocation: 'current', targetNpc: 'unknown_npc' }
      },
      activePage: mockPage,
      ws: {} as any,
      context: { label: 'test' },
      nodes: [],
      edges: [],
      globalVariables: {},
      projectName: 'test',
      nodeTitle: 'World Navigator',
      logToClient,
      takeDebugSnapshot: vi.fn(),
      smartSleep: vi.fn(),
      broadcastVariables: vi.fn(),
      nodeRuntimeState: new Map(),
      checkRunning: () => true
    };

    const res = await worldNavigatorNodeHandler(params);
    expect(res.nextHandle).toEqual(['error']);
    expect(logToClient).toHaveBeenCalledWith(
      expect.stringContaining('Помилка: NPC не знайдено на карті'),
      'error'
    );
  });

  it('пріоритезує ім`я NPC над дефолтними координатами {x:0, y:0}', async () => {
    const logToClient = vi.fn();
    const mockPage = {
      url: () => 'https://sunflower-land.com/play/#/world/plaza',
      evaluate: vi.fn()
        .mockResolvedValueOnce({ sceneKey: 'plaza', npcs: ['betty'] })
        .mockResolvedValueOnce({
          success: true,
          reachedGoal: true,
          distToGoal: 25,
          startPos: { x: 300, y: 200 },
          finalPos: { x: 534, y: 88 },
          waypointsCount: 4,
          durationMs: 3100,
          targetNpcFound: true
        })
        .mockResolvedValueOnce(undefined),
      keyboard: {
        press: vi.fn().mockResolvedValue(undefined)
      }
    } as any;

    const params: NodeHandlerParams = {
      currentNode: {
        id: 'nav_4',
        type: 'worldNavigatorNode',
        position: { x: 0, y: 0 },
        data: { targetLocation: 'plaza', targetNpc: 'betty', customCoords: { x: 0, y: 0 }, autoInteract: true }
      },
      activePage: mockPage,
      ws: {} as any,
      context: { label: 'test' },
      nodes: [],
      edges: [],
      globalVariables: {},
      projectName: 'test',
      nodeTitle: 'World Navigator',
      logToClient,
      takeDebugSnapshot: vi.fn(),
      smartSleep: vi.fn(),
      broadcastVariables: vi.fn(),
      nodeRuntimeState: new Map(),
      checkRunning: () => true
    };

    const res = await worldNavigatorNodeHandler(params);
    expect(res.nextHandle).toEqual(['success']);
    expect(logToClient).toHaveBeenCalledWith(
      expect.stringContaining('Старт навігації до NPC «betty»'),
      'info'
    );
  });

  it('автоматично перемикає локацію на plaza коли локація current але вказано blacksmith або коваль', async () => {
    const logToClient = vi.fn();
    const mockPage = {
      url: () => 'https://sunflower-land.com/play/#/',
      goto: vi.fn().mockResolvedValue(undefined),
      evaluate: vi.fn()
        .mockResolvedValueOnce({ sceneKey: 'plaza', npcs: ['blacksmith'] }) // waitForWorldScene after goto
        .mockResolvedValueOnce({
          success: true,
          reachedGoal: true,
          distToGoal: 30,
          startPos: { x: 400, y: 300 },
          finalPos: { x: 367, y: 120 },
          waypointsCount: 3,
          durationMs: 2000,
          targetNpcFound: true
        })
        .mockResolvedValueOnce(undefined),
      keyboard: {
        press: vi.fn().mockResolvedValue(undefined)
      }
    } as any;

    const params: NodeHandlerParams = {
      currentNode: {
        id: 'nav_5',
        type: 'worldNavigatorNode',
        position: { x: 0, y: 0 },
        data: { targetLocation: 'current', targetNpc: 'коваль', autoInteract: true }
      },
      activePage: mockPage,
      ws: {} as any,
      context: { label: 'test' },
      nodes: [],
      edges: [],
      globalVariables: {},
      projectName: 'test',
      nodeTitle: 'World Navigator',
      logToClient,
      takeDebugSnapshot: vi.fn(),
      smartSleep: vi.fn(),
      broadcastVariables: vi.fn(),
      nodeRuntimeState: new Map(),
      checkRunning: () => true
    };

    const res = await worldNavigatorNodeHandler(params);
    expect(res.nextHandle).toEqual(['success']);
    expect(logToClient).toHaveBeenCalledWith(
      expect.stringContaining('Автовибір локації: plaza'),
      'info'
    );
    expect(mockPage.goto).toHaveBeenCalledWith(
      'https://sunflower-land.com/play/#/world/plaza',
      expect.objectContaining({ waitUntil: 'domcontentloaded' })
    );
  });
});
