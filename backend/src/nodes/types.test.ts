import { describe, it, expect } from 'vitest';
import type { 
  ScanResult, 
  InventoryScannerNodeData, 
  InventoryScannerOutput,
  InventoryFile 
} from './types';

describe('Inventory Scanner Types', () => {
  describe('ScanResult interface', () => {
    it('should allow valid ScanResult with required fields', () => {
      const scanResult: ScanResult = {
        image: 'https://example.com/image.png',
        number: 42
      };
      
      expect(scanResult.image).toBe('https://example.com/image.png');
      expect(scanResult.number).toBe(42);
    });

    it('should allow ScanResult with optional fields', () => {
      const scanResult: ScanResult = {
        image: 'data:image/png;base64,abc123',
        number: 3.14,
        selector: '.inventory-item',
        coords: { x: 100, y: 200 }
      };
      
      expect(scanResult.selector).toBe('.inventory-item');
      expect(scanResult.coords).toEqual({ x: 100, y: 200 });
    });

    it('should accept decimal numbers', () => {
      const scanResult: ScanResult = {
        image: '/relative/path.jpg',
        number: 99.99
      };
      
      expect(scanResult.number).toBe(99.99);
    });

    it('should accept zero as a valid number', () => {
      const scanResult: ScanResult = {
        image: 'image.png',
        number: 0
      };
      
      expect(scanResult.number).toBe(0);
    });
  });

  describe('InventoryScannerNodeData interface', () => {
    it('should allow valid configuration with all required fields', () => {
      const nodeData: InventoryScannerNodeData = {
        label: 'Scan Inventory',
        selector: '.item',
        mode: 'all',
        imageSource: 'auto'
      };
      
      expect(nodeData.label).toBe('Scan Inventory');
      expect(nodeData.selector).toBe('.item');
      expect(nodeData.mode).toBe('all');
      expect(nodeData.imageSource).toBe('auto');
    });

    it('should allow mode "first"', () => {
      const nodeData: InventoryScannerNodeData = {
        label: 'Test',
        selector: '#element',
        mode: 'first',
        imageSource: 'src'
      };
      
      expect(nodeData.mode).toBe('first');
    });

    it('should allow imageSource "src"', () => {
      const nodeData: InventoryScannerNodeData = {
        label: 'Test',
        selector: 'img',
        mode: 'all',
        imageSource: 'src'
      };
      
      expect(nodeData.imageSource).toBe('src');
    });

    it('should allow imageSource "background"', () => {
      const nodeData: InventoryScannerNodeData = {
        label: 'Test',
        selector: '.box',
        mode: 'all',
        imageSource: 'background'
      };
      
      expect(nodeData.imageSource).toBe('background');
    });

    it('should allow optional custom regex', () => {
      const nodeData: InventoryScannerNodeData = {
        label: 'Test',
        selector: '.price',
        mode: 'all',
        imageSource: 'auto',
        numberRegex: '\\$([0-9]+\\.?[0-9]*)'
      };
      
      expect(nodeData.numberRegex).toBe('\\$([0-9]+\\.?[0-9]*)');
    });

    it('should allow optional UI state fields', () => {
      const nodeData: InventoryScannerNodeData = {
        label: 'Test',
        selector: '.item',
        mode: 'all',
        imageSource: 'auto',
        status: 'success',
        lastScanCount: 10,
        lastScanTime: 1234567890
      };
      
      expect(nodeData.status).toBe('success');
      expect(nodeData.lastScanCount).toBe(10);
      expect(nodeData.lastScanTime).toBe(1234567890);
    });
  });

  describe('InventoryScannerOutput interface', () => {
    it('should allow valid output with inventory results', () => {
      const output: InventoryScannerOutput = {
        inventoryResults: [
          { image: 'img1.png', number: 10 },
          { image: 'img2.png', number: 20 }
        ],
        count: 2
      };
      
      expect(output.inventoryResults).toHaveLength(2);
      expect(output.count).toBe(2);
    });

    it('should allow empty inventory results', () => {
      const output: InventoryScannerOutput = {
        inventoryResults: [],
        count: 0
      };
      
      expect(output.inventoryResults).toHaveLength(0);
      expect(output.count).toBe(0);
    });

    it('should extend NodeData and allow additional fields', () => {
      const output: InventoryScannerOutput = {
        inventoryResults: [{ image: 'test.png', number: 5 }],
        count: 1,
        value: 'test',
        text: 'some text',
        customField: 'custom value'
      };
      
      expect(output.value).toBe('test');
      expect(output.text).toBe('some text');
      expect(output.customField).toBe('custom value');
    });
  });

  describe('InventoryFile interface', () => {
    it('should allow valid inventory file structure', () => {
      const file: InventoryFile = {
        projectName: 'test-project',
        data: [
          { image: 'img1.png', number: 100 },
          { image: 'img2.png', number: 200 }
        ],
        timestamp: Date.now(),
        version: '1.0'
      };
      
      expect(file.projectName).toBe('test-project');
      expect(file.data).toHaveLength(2);
      expect(file.version).toBe('1.0');
      expect(typeof file.timestamp).toBe('number');
    });

    it('should allow empty data array', () => {
      const file: InventoryFile = {
        projectName: 'empty-project',
        data: [],
        timestamp: 1234567890,
        version: '1.0'
      };
      
      expect(file.data).toHaveLength(0);
    });

    it('should allow optional metadata', () => {
      const file: InventoryFile = {
        projectName: 'test-project',
        data: [{ image: 'test.png', number: 1 }],
        timestamp: 1234567890,
        version: '1.0',
        metadata: {
          selector: '.inventory-item',
          itemCount: 1,
          scanDuration: 500
        }
      };
      
      expect(file.metadata).toBeDefined();
      expect(file.metadata?.selector).toBe('.inventory-item');
      expect(file.metadata?.itemCount).toBe(1);
      expect(file.metadata?.scanDuration).toBe(500);
    });

    it('should work without metadata', () => {
      const file: InventoryFile = {
        projectName: 'test-project',
        data: [],
        timestamp: Date.now(),
        version: '1.0'
      };
      
      expect(file.metadata).toBeUndefined();
    });
  });

  describe('Type relationships', () => {
    it('should allow ScanResult in InventoryFile data array', () => {
      const results: ScanResult[] = [
        { image: 'img1.png', number: 1, selector: '.item' },
        { image: 'img2.png', number: 2 }
      ];

      const file: InventoryFile = {
        projectName: 'test',
        data: results,
        timestamp: Date.now(),
        version: '1.0'
      };
      
      expect(file.data).toEqual(results);
    });

    it('should allow ScanResult in InventoryScannerOutput', () => {
      const results: ScanResult[] = [
        { image: 'img1.png', number: 10 }
      ];

      const output: InventoryScannerOutput = {
        inventoryResults: results,
        count: results.length
      };
      
      expect(output.inventoryResults).toEqual(results);
      expect(output.count).toBe(results.length);
    });
  });

  describe('Edge cases', () => {
    it('should handle very large numbers', () => {
      const scanResult: ScanResult = {
        image: 'img.png',
        number: 999999999.99
      };
      
      expect(scanResult.number).toBe(999999999.99);
    });

    it('should handle negative numbers', () => {
      const scanResult: ScanResult = {
        image: 'img.png',
        number: -42
      };
      
      expect(scanResult.number).toBe(-42);
    });

    it('should handle base64 encoded images', () => {
      const longBase64 = 'data:image/png;base64,' + 'A'.repeat(1000);
      const scanResult: ScanResult = {
        image: longBase64,
        number: 1
      };
      
      expect(scanResult.image).toBe(longBase64);
    });

    it('should handle complex CSS selectors', () => {
      const nodeData: InventoryScannerNodeData = {
        label: 'Complex Selector',
        selector: 'div.container > ul.items li[data-type="inventory"]:not(.disabled)',
        mode: 'all',
        imageSource: 'auto'
      };
      
      expect(nodeData.selector).toBe('div.container > ul.items li[data-type="inventory"]:not(.disabled)');
    });

    it('should handle Unicode in labels and selectors', () => {
      const nodeData: InventoryScannerNodeData = {
        label: 'Сканування інвентаря',
        selector: '.предмет',
        mode: 'all',
        imageSource: 'auto'
      };
      
      expect(nodeData.label).toBe('Сканування інвентаря');
      expect(nodeData.selector).toBe('.предмет');
    });
  });
});
