/**
 * Unit tests for ResourceAggregator
 * 
 * Tests specific scenarios, edge cases, and data processing logic
 */

import { describe, it, expect } from 'vitest';
import { ResourceAggregator } from '../../ResourceAggregator';
import type { InventoryFile } from '../../types';

describe('ResourceAggregator', () => {
  const aggregator = new ResourceAggregator();

  describe('Basic Functionality', () => {
    it('should aggregate empty inventories', () => {
      const inventories: Array<[string, InventoryFile]> = [];
      
      const result = aggregator.aggregate(inventories);
      
      expect(result.accounts).toEqual([]);
      expect(result.resources).toEqual([]);
      expect(result.data).toEqual([]);
      expect(result.timestamp).toBeGreaterThan(0);
    });

    it('should aggregate single inventory with single resource', () => {
      const inventories: Array<[string, InventoryFile]> = [
        ['SF1', {
          projectName: 'SF1',
          data: [
            {
              image: 'https://example.com/corn.png',
              number: 29,
              selector: 'div',
              coords: { x: 100, y: 200 }
            }
          ],
          timestamp: Date.now(),
          version: '1.0',
          metadata: {
            selector: 'div',
            itemCount: 1,
            scanDuration: 10
          }
        }]
      ];
      
      const result = aggregator.aggregate(inventories);
      
      expect(result.accounts).toEqual(['SF1']);
      expect(result.resources).toHaveLength(1);
      expect(result.resources[0].image).toBe('https://example.com/corn.png');
      expect(result.resources[0].index).toBe(0);
      expect(result.data).toEqual([[29]]);
    });

    it('should aggregate multiple accounts with different resources', () => {
      const inventories: Array<[string, InventoryFile]> = [
        ['SF2', {
          projectName: 'SF2',
          data: [
            {
              image: 'https://example.com/wheat.png',
              number: 50,
              selector: 'div',
              coords: { x: 0, y: 0 }
            }
          ],
          timestamp: Date.now(),
          version: '1.0',
          metadata: { selector: 'div', itemCount: 1, scanDuration: 10 }
        }],
        ['SF1', {
          projectName: 'SF1',
          data: [
            {
              image: 'https://example.com/corn.png',
              number: 29,
              selector: 'div',
              coords: { x: 0, y: 0 }
            }
          ],
          timestamp: Date.now(),
          version: '1.0',
          metadata: { selector: 'div', itemCount: 1, scanDuration: 10 }
        }]
      ];
      
      const result = aggregator.aggregate(inventories);
      
      // Accounts should be sorted alphabetically
      expect(result.accounts).toEqual(['SF1', 'SF2']);
      expect(result.resources).toHaveLength(2);
      
      // Find resource indices
      const cornIndex = result.resources.find(r => r.image === 'https://example.com/corn.png')?.index;
      const wheatIndex = result.resources.find(r => r.image === 'https://example.com/wheat.png')?.index;
      
      expect(cornIndex).toBeDefined();
      expect(wheatIndex).toBeDefined();
      
      // SF1 has corn, no wheat
      expect(result.data[0][cornIndex!]).toBe(29);
      expect(result.data[0][wheatIndex!]).toBe(null);
      
      // SF2 has wheat, no corn
      expect(result.data[1][cornIndex!]).toBe(null);
      expect(result.data[1][wheatIndex!]).toBe(50);
    });
  });

  describe('Resource Uniqueness', () => {
    it('should deduplicate resources by image URL', () => {
      const inventories: Array<[string, InventoryFile]> = [
        ['SF1', {
          projectName: 'SF1',
          data: [
            {
              image: 'https://example.com/corn.png',
              number: 10,
              selector: 'div',
              coords: { x: 0, y: 0 }
            },
            {
              image: 'https://example.com/corn.png',
              number: 20,
              selector: 'div',
              coords: { x: 100, y: 100 }
            }
          ],
          timestamp: Date.now(),
          version: '1.0',
          metadata: { selector: 'div', itemCount: 2, scanDuration: 10 }
        }]
      ];
      
      const result = aggregator.aggregate(inventories);
      
      // Should have only one unique resource
      expect(result.resources).toHaveLength(1);
      expect(result.resources[0].image).toBe('https://example.com/corn.png');
      
      // The last occurrence should be used (or both summed - depends on spec)
      // Based on the algorithm, each item is processed and overwrites previous
      expect(result.data[0][0]).toBe(20);
    });

    it('should treat different URL types as unique resources', () => {
      const inventories: Array<[string, InventoryFile]> = [
        ['SF1', {
          projectName: 'SF1',
          data: [
            {
              image: 'https://example.com/corn.png',
              number: 10,
              selector: 'div',
              coords: { x: 0, y: 0 }
            },
            {
              image: '/api/images/corn.png',
              number: 20,
              selector: 'div',
              coords: { x: 0, y: 0 }
            },
            {
              image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
              number: 30,
              selector: 'div',
              coords: { x: 0, y: 0 }
            }
          ],
          timestamp: Date.now(),
          version: '1.0',
          metadata: { selector: 'div', itemCount: 3, scanDuration: 10 }
        }]
      ];
      
      const result = aggregator.aggregate(inventories);
      
      // All three URL types should be treated as unique resources
      expect(result.resources).toHaveLength(3);
      
      const hasAbsolute = result.resources.some(r => r.image.startsWith('https://'));
      const hasRelative = result.resources.some(r => r.image.startsWith('/api/images/'));
      const hasDataUri = result.resources.some(r => r.image.startsWith('data:image/'));
      
      expect(hasAbsolute).toBe(true);
      expect(hasRelative).toBe(true);
      expect(hasDataUri).toBe(true);
    });
  });

  describe('Alphabetical Sorting', () => {
    it('should sort accounts alphabetically', () => {
      const inventories: Array<[string, InventoryFile]> = [
        ['SF910', createEmptyInventory('SF910')],
        ['SF2', createEmptyInventory('SF2')],
        ['SF10', createEmptyInventory('SF10')],
        ['SF1', createEmptyInventory('SF1')]
      ];
      
      const result = aggregator.aggregate(inventories);
      
      expect(result.accounts).toEqual(['SF1', 'SF10', 'SF2', 'SF910']);
    });
  });

  describe('Numeric Precision', () => {
    it('should round numbers to 1 decimal place', () => {
      const inventories: Array<[string, InventoryFile]> = [
        ['SF1', {
          projectName: 'SF1',
          data: [
            {
              image: 'https://example.com/resource1.png',
              number: 29.14159,
              selector: 'div',
              coords: { x: 0, y: 0 }
            },
            {
              image: 'https://example.com/resource2.png',
              number: 42.99,
              selector: 'div',
              coords: { x: 0, y: 0 }
            },
            {
              image: 'https://example.com/resource3.png',
              number: 10.05,
              selector: 'div',
              coords: { x: 0, y: 0 }
            },
            {
              image: 'https://example.com/resource4.png',
              number: 7.94,
              selector: 'div',
              coords: { x: 0, y: 0 }
            }
          ],
          timestamp: Date.now(),
          version: '1.0',
          metadata: { selector: 'div', itemCount: 4, scanDuration: 10 }
        }]
      ];
      
      const result = aggregator.aggregate(inventories);
      
      expect(result.data[0][0]).toBe(29.1);
      expect(result.data[0][1]).toBe(43.0);
      expect(result.data[0][2]).toBe(10.1);
      expect(result.data[0][3]).toBe(7.9);
    });

    it('should handle negative numbers correctly', () => {
      const inventories: Array<[string, InventoryFile]> = [
        ['SF1', {
          projectName: 'SF1',
          data: [
            {
              image: 'https://example.com/debt.png',
              number: -42.66,
              selector: 'div',
              coords: { x: 0, y: 0 }
            }
          ],
          timestamp: Date.now(),
          version: '1.0',
          metadata: { selector: 'div', itemCount: 1, scanDuration: 10 }
        }]
      ];
      
      const result = aggregator.aggregate(inventories);
      
      // Negative numbers should be rounded to 1 decimal place
      expect(result.data[0][0]).toBe(-42.7);
    });

    it('should handle zero correctly', () => {
      const inventories: Array<[string, InventoryFile]> = [
        ['SF1', {
          projectName: 'SF1',
          data: [
            {
              image: 'https://example.com/zero.png',
              number: 0,
              selector: 'div',
              coords: { x: 0, y: 0 }
            },
            {
              image: 'https://example.com/nearzero.png',
              number: 0.04,
              selector: 'div',
              coords: { x: 0, y: 0 }
            }
          ],
          timestamp: Date.now(),
          version: '1.0',
          metadata: { selector: 'div', itemCount: 2, scanDuration: 10 }
        }]
      ];
      
      const result = aggregator.aggregate(inventories);
      
      expect(result.data[0][0]).toBe(0);
      expect(result.data[0][1]).toBe(0);
    });
  });

  describe('Invalid Data Handling', () => {
    it('should filter out resources with missing image field', () => {
      const inventories: Array<[string, InventoryFile]> = [
        ['SF1', {
          projectName: 'SF1',
          data: [
            {
              image: 'https://example.com/valid.png',
              number: 10,
              selector: 'div',
              coords: { x: 0, y: 0 }
            },
            {
              image: '',
              number: 20,
              selector: 'div',
              coords: { x: 0, y: 0 }
            } as any,
            {
              number: 30,
              selector: 'div',
              coords: { x: 0, y: 0 }
            } as any
          ],
          timestamp: Date.now(),
          version: '1.0',
          metadata: { selector: 'div', itemCount: 3, scanDuration: 10 }
        }]
      ];
      
      const result = aggregator.aggregate(inventories);
      
      // Only the valid resource should be included
      expect(result.resources).toHaveLength(1);
      expect(result.resources[0].image).toBe('https://example.com/valid.png');
      expect(result.data[0][0]).toBe(10);
    });

    it('should handle non-numeric number values by using 0', () => {
      const inventories: Array<[string, InventoryFile]> = [
        ['SF1', {
          projectName: 'SF1',
          data: [
            {
              image: 'https://example.com/resource.png',
              number: NaN,
              selector: 'div',
              coords: { x: 0, y: 0 }
            }
          ],
          timestamp: Date.now(),
          version: '1.0',
          metadata: { selector: 'div', itemCount: 1, scanDuration: 10 }
        }]
      ];
      
      const result = aggregator.aggregate(inventories);
      
      expect(result.resources).toHaveLength(1);
      expect(result.data[0][0]).toBe(0);
    });

    it('should handle string number values by using 0', () => {
      const inventories: Array<[string, InventoryFile]> = [
        ['SF1', {
          projectName: 'SF1',
          data: [
            {
              image: 'https://example.com/resource.png',
              number: '42' as any,
              selector: 'div',
              coords: { x: 0, y: 0 }
            }
          ],
          timestamp: Date.now(),
          version: '1.0',
          metadata: { selector: 'div', itemCount: 1, scanDuration: 10 }
        }]
      ];
      
      const result = aggregator.aggregate(inventories);
      
      expect(result.resources).toHaveLength(1);
      expect(result.data[0][0]).toBe(0);
    });
  });

  describe('Data Matrix Structure', () => {
    it('should create correct matrix dimensions', () => {
      const inventories: Array<[string, InventoryFile]> = [
        ['SF1', createInventoryWithResources('SF1', ['A', 'B'])],
        ['SF2', createInventoryWithResources('SF2', ['C'])],
        ['SF3', createInventoryWithResources('SF3', ['A', 'C'])]
      ];
      
      const result = aggregator.aggregate(inventories);
      
      expect(result.accounts).toHaveLength(3);
      expect(result.resources).toHaveLength(3); // A, B, C
      expect(result.data).toHaveLength(3); // 3 accounts
      expect(result.data[0]).toHaveLength(3); // 3 resources
      expect(result.data[1]).toHaveLength(3);
      expect(result.data[2]).toHaveLength(3);
    });

    it('should use null for absent resources', () => {
      const inventories: Array<[string, InventoryFile]> = [
        ['SF1', createInventoryWithResources('SF1', ['A'])],
        ['SF2', createInventoryWithResources('SF2', ['B'])]
      ];
      
      const result = aggregator.aggregate(inventories);
      
      const aIndex = result.resources.find(r => r.image.includes('A'))?.index;
      const bIndex = result.resources.find(r => r.image.includes('B'))?.index;
      
      // SF1 has A, not B
      expect(result.data[0][aIndex!]).toBe(10);
      expect(result.data[0][bIndex!]).toBe(null);
      
      // SF2 has B, not A
      expect(result.data[1][aIndex!]).toBe(null);
      expect(result.data[1][bIndex!]).toBe(10);
    });
  });

  describe('Timestamp Generation', () => {
    it('should add a timestamp to the result', () => {
      const before = Date.now();
      const result = aggregator.aggregate([]);
      const after = Date.now();
      
      expect(result.timestamp).toBeGreaterThanOrEqual(before);
      expect(result.timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe('Resource Index Assignment', () => {
    it('should assign sequential indices to resources', () => {
      const inventories: Array<[string, InventoryFile]> = [
        ['SF1', createInventoryWithResources('SF1', ['A', 'B', 'C'])]
      ];
      
      const result = aggregator.aggregate(inventories);
      
      const indices = result.resources.map(r => r.index).sort((a, b) => a - b);
      expect(indices).toEqual([0, 1, 2]);
    });
  });
});

// Helper functions

function createEmptyInventory(projectName: string): InventoryFile {
  return {
    projectName,
    data: [],
    timestamp: Date.now(),
    version: '1.0',
    metadata: {
      selector: 'div',
      itemCount: 0,
      scanDuration: 10
    }
  };
}

function createInventoryWithResources(projectName: string, resourceIds: string[]): InventoryFile {
  return {
    projectName,
    data: resourceIds.map(id => ({
      image: `https://example.com/resource${id}.png`,
      number: 10,
      selector: 'div',
      coords: { x: 0, y: 0 }
    })),
    timestamp: Date.now(),
    version: '1.0',
    metadata: {
      selector: 'div',
      itemCount: resourceIds.length,
      scanDuration: 10
    }
  };
}
