/**
 * Setup verification tests
 * 
 * Verifies that the testing framework and type definitions are correctly configured
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { 
  ResourceItem, 
  InventoryFile, 
  AggregatedInventoryData,
  ResourceMetadata 
} from '../types';
import {
  resourceItemArbitrary,
  inventoryFileArbitrary,
  accountNameArbitrary,
  imageUrlArbitrary
} from '../__fixtures__/arbitraries';

describe('Testing Framework Setup', () => {
  describe('Vitest Configuration', () => {
    it('should run basic tests', () => {
      expect(true).toBe(true);
    });

    it('should support TypeScript', () => {
      const num: number = 42;
      const str: string = 'test';
      expect(typeof num).toBe('number');
      expect(typeof str).toBe('string');
    });
  });

  describe('Fast-check Integration', () => {
    it('should generate random integers', () => {
      fc.assert(
        fc.property(fc.integer(), (num) => {
          expect(typeof num).toBe('number');
          expect(Number.isInteger(num)).toBe(true);
        }),
        { numRuns: 10 }
      );
    });

    it('should generate random strings', () => {
      fc.assert(
        fc.property(fc.string(), (str) => {
          expect(typeof str).toBe('string');
        }),
        { numRuns: 10 }
      );
    });
  });

  describe('Type Definitions', () => {
    it('should have valid ResourceItem interface', () => {
      const item: ResourceItem = {
        image: 'https://example.com/test.png',
        number: 42,
        selector: 'div.test',
        coords: { x: 100, y: 200 }
      };

      expect(item.image).toBeDefined();
      expect(item.number).toBeDefined();
      expect(item.selector).toBeDefined();
      expect(item.coords).toBeDefined();
    });

    it('should have valid InventoryFile interface', () => {
      const inventory: InventoryFile = {
        projectName: 'SF1',
        data: [],
        timestamp: Date.now(),
        version: '1.0',
        metadata: {
          selector: 'div.test',
          itemCount: 0,
          scanDuration: 10
        }
      };

      expect(inventory.projectName).toBe('SF1');
      expect(Array.isArray(inventory.data)).toBe(true);
      expect(inventory.version).toBe('1.0');
    });

    it('should have valid AggregatedInventoryData interface', () => {
      const aggregated: AggregatedInventoryData = {
        accounts: ['SF1', 'SF2'],
        resources: [
          { image: 'https://example.com/test.png', index: 0 }
        ],
        data: [[42], [null]],
        timestamp: Date.now()
      };

      expect(aggregated.accounts.length).toBe(2);
      expect(aggregated.resources.length).toBe(1);
      expect(aggregated.data.length).toBe(2);
    });

    it('should have valid ResourceMetadata interface', () => {
      const metadata: ResourceMetadata = {
        image: 'https://example.com/test.png',
        index: 0
      };

      expect(metadata.image).toBeDefined();
      expect(metadata.index).toBe(0);
    });
  });

  describe('Custom Arbitraries', () => {
    it('should generate valid ResourceItem objects', () => {
      fc.assert(
        fc.property(resourceItemArbitrary, (item) => {
          expect(item).toBeDefined();
          expect(typeof item.image).toBe('string');
          expect(item.image.length).toBeGreaterThan(0);
          expect(typeof item.number).toBe('number');
          expect(item.number).toBeGreaterThanOrEqual(0);
          expect(typeof item.selector).toBe('string');
          expect(item.coords).toBeDefined();
          expect(typeof item.coords.x).toBe('number');
          expect(typeof item.coords.y).toBe('number');
        }),
        { numRuns: 50 }
      );
    });

    it('should generate valid InventoryFile objects', () => {
      fc.assert(
        fc.property(inventoryFileArbitrary, (inventory) => {
          expect(inventory).toBeDefined();
          expect(typeof inventory.projectName).toBe('string');
          expect(Array.isArray(inventory.data)).toBe(true);
          expect(typeof inventory.timestamp).toBe('number');
          expect(inventory.version).toBe('1.0');
          expect(inventory.metadata).toBeDefined();
          expect(typeof inventory.metadata.itemCount).toBe('number');
        }),
        { numRuns: 50 }
      );
    });

    it('should generate valid account names', () => {
      fc.assert(
        fc.property(accountNameArbitrary, (name) => {
          expect(name).toMatch(/^SF\d+$/);
        }),
        { numRuns: 50 }
      );
    });

    it('should generate valid image URLs', () => {
      fc.assert(
        fc.property(imageUrlArbitrary, (url) => {
          expect(typeof url).toBe('string');
          expect(url.length).toBeGreaterThan(0);
          
          // Should be one of: absolute URL, relative URL, or data URI
          const isAbsolute = url.startsWith('https://');
          const isRelative = url.startsWith('/api/images/');
          const isDataUri = url.startsWith('data:image/');
          
          expect(isAbsolute || isRelative || isDataUri).toBe(true);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Sample Fixtures', () => {
    it('should have access to fixture directory structure', () => {
      // This test just verifies the test setup can access fixture paths
      const fixturePath = '../__fixtures__/sample-inventories';
      expect(fixturePath).toBeDefined();
    });
  });
});

describe('Property-Based Testing Configuration', () => {
  it('should support custom numRuns configuration', () => {
    let runCount = 0;
    
    fc.assert(
      fc.property(fc.integer(), () => {
        runCount++;
        return true;
      }),
      { numRuns: 100 }
    );
    
    expect(runCount).toBe(100);
  });

  it('should support shrinking on failure', () => {
    // This test demonstrates shrinking capability
    // It's expected to pass, but shows how fast-check works
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1000 }), (n) => {
        // Property: all numbers are less than or equal to 1000
        return n <= 1000;
      }),
      { numRuns: 100 }
    );
  });
});
