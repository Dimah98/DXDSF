import { describe, it, expect, vi } from 'vitest';
import { BotEngine } from './BotEngine';
import { BaseNode, BaseEdge } from '@sf/shared-types';

describe('BotEngine status and error reporting', () => {
  const createMockWs = () => ({
    send: vi.fn(),
    readyState: 1
  } as any);

  it('should complete with status success when all nodes execute without error', async () => {
    const nodes: BaseNode[] = [
      { id: 'start', type: 'startNode', position: { x: 0, y: 0 }, data: { label: 'Start' } },
      { id: 'step1', type: 'actionNode', position: { x: 100, y: 0 }, data: { label: 'Step 1' } }
    ];
    const edges: BaseEdge[] = [
      { id: 'e1', source: 'start', target: 'step1' }
    ];

    const nodeHandlers = {
      startNode: async ({ context }: any) => ({ data: context }),
      actionNode: async ({ context }: any) => ({ data: { ...context, step1: true } })
    };

    const onFinished = vi.fn();
    const ws = createMockWs();

    const engine = new BotEngine({
      nodes,
      edges,
      activePage: null,
      ws,
      globalVariables: {},
      projectName: 'test_project',
      broadcastVariables: vi.fn(),
      logToClient: vi.fn(),
      takeDebugSnapshot: vi.fn().mockResolvedValue(undefined),
      smartSleep: vi.fn().mockResolvedValue(undefined),
      nodeRuntimeState: new Map(),
      checkRunning: () => true,
      nodeHandlers,
      onFinished
    });

    const result = await engine.run('start');

    expect(result).toBeDefined();
    expect(result?.status).toBe('success');
    expect(result?.error).toBeUndefined();
    expect(result?.context).toEqual({ step1: true });
    expect(onFinished).toHaveBeenCalledWith('success', undefined);
  });

  it('should report status error and error message when a node handler throws', async () => {
    const nodes: BaseNode[] = [
      { id: 'start', type: 'startNode', position: { x: 0, y: 0 }, data: { label: 'Start' } },
      { id: 'failingNode', type: 'actionNode', position: { x: 100, y: 0 }, data: { label: 'Fail Step' } },
      { id: 'afterFail', type: 'delayNode', position: { x: 200, y: 0 }, data: { label: 'Unreachable' } }
    ];
    const edges: BaseEdge[] = [
      { id: 'e1', source: 'start', target: 'failingNode' },
      { id: 'e2', source: 'failingNode', target: 'afterFail' }
    ];

    const nodeHandlers = {
      startNode: async ({ context }: any) => ({ data: context }),
      actionNode: async () => {
        throw new Error('Element selector timeout: button#submit');
      },
      delayNode: async () => ({ data: {} })
    };

    const onFinished = vi.fn();
    const ws = createMockWs();

    const engine = new BotEngine({
      nodes,
      edges,
      activePage: null,
      ws,
      globalVariables: {},
      projectName: 'test_project',
      broadcastVariables: vi.fn(),
      logToClient: vi.fn(),
      takeDebugSnapshot: vi.fn().mockResolvedValue(undefined),
      smartSleep: vi.fn().mockResolvedValue(undefined),
      nodeRuntimeState: new Map(),
      checkRunning: () => true,
      nodeHandlers,
      onFinished
    });

    const result = await engine.run('start');

    expect(result).toBeDefined();
    expect(result?.status).toBe('error');
    expect(result?.error).toBe('Element selector timeout: button#submit');
    expect(onFinished).toHaveBeenCalledWith('error', 'Element selector timeout: button#submit');
  });

  it('should report status stopped when checkRunning returns false', async () => {
    const nodes: BaseNode[] = [
      { id: 'start', type: 'startNode', position: { x: 0, y: 0 }, data: { label: 'Start' } },
      { id: 'step1', type: 'actionNode', position: { x: 100, y: 0 }, data: { label: 'Step 1' } }
    ];
    const edges: BaseEdge[] = [
      { id: 'e1', source: 'start', target: 'step1' }
    ];

    let running = true;
    const nodeHandlers = {
      startNode: async ({ context }: any) => {
        running = false; // user stops the bot during execution
        return { data: context };
      },
      actionNode: async ({ context }: any) => ({ data: context })
    };

    const onFinished = vi.fn();
    const ws = createMockWs();

    const engine = new BotEngine({
      nodes,
      edges,
      activePage: null,
      ws,
      globalVariables: {},
      projectName: 'test_project',
      broadcastVariables: vi.fn(),
      logToClient: vi.fn(),
      takeDebugSnapshot: vi.fn().mockResolvedValue(undefined),
      smartSleep: vi.fn().mockResolvedValue(undefined),
      nodeRuntimeState: new Map(),
      checkRunning: () => running,
      nodeHandlers,
      onFinished
    });

    const result = await engine.run('start');

    expect(result).toBeDefined();
    expect(result?.status).toBe('stopped');
    expect(result?.error).toBe('Зупинено користувачем');
    expect(onFinished).toHaveBeenCalledWith('stopped', 'Зупинено користувачем');
  });
});
