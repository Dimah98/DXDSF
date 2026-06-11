import { nodeHandlers } from './index';
import { inventoryScannerNodeHandler } from './InventoryScannerNode';

describe('InventoryScannerNode Registration', () => {
  test('inventoryScannerNode should be registered in nodeHandlers', () => {
    expect(nodeHandlers['inventoryScannerNode']).toBeDefined();
    expect(nodeHandlers['inventoryScannerNode']).toBe(inventoryScannerNodeHandler);
  });

  test('inventoryScannerNode handler should be a function', () => {
    expect(typeof nodeHandlers['inventoryScannerNode']).toBe('function');
  });

  test('nodeHandlers should include all expected node types', () => {
    // Verify that inventoryScannerNode is now part of the available nodes
    const nodeTypes = Object.keys(nodeHandlers);
    expect(nodeTypes).toContain('inventoryScannerNode');
  });
});
