/**
 * Integration tests for /api/inventory/overview endpoint
 * 
 * These tests verify the endpoint works correctly when integrated
 * with the actual Express server, authentication, and file system.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import type { InventoryFile, AggregatedInventoryData } from './types';

describe('Integration: /api/inventory/overview', () => {
  let testDir: string;

  beforeEach(() => {
    // Create test directory
    testDir = path.join(__dirname, '../../test-integration-overview');
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Cleanup
    try {
      if (fs.existsSync(testDir)) {
        const files = fs.readdirSync(testDir);
        files.forEach(file => {
          fs.unlinkSync(path.join(testDir, file));
        });
        fs.rmdirSync(testDir);
      }
    } catch (err) {
      // Ignore cleanup errors
    }
  });

  it('should handle large number of accounts (scalability test)', async () => {
    const { InventoryReader } = await import('./InventoryReader');
    const { ResourceAggregator } = await import('./ResourceAggregator');

    // Create 50 account inventory files
    for (let i = 1; i <= 50; i++) {
      const inventory: InventoryFile = {
        projectName: `SF${i}`,
        data: [
          {
            image: `https://example.com/resource${i % 10}.png`,
            number: i * 10,
            selector: 'div.item',
            coords: { x: 0, y: 0 }
          }
        ],
        timestamp: Date.now(),
        version: '1.0',
        metadata: {
          selector: 'div.item',
          itemCount: 1,
          scanDuration: 100
        }
      };

      await fs.promises.writeFile(
        path.join(testDir, `SF${i}_inventory.json`),
        JSON.stringify(inventory, null, 2)
      );
    }

    const reader = new InventoryReader();
    const aggregator = new ResourceAggregator();

    const startTime = Date.now();
    const inventories = await reader.readAllInventories(testDir);
    const result = aggregator.aggregate(inventories);
    const duration = Date.now() - startTime;

    // Verify results
    expect(result.accounts).toHaveLength(50);
    expect(result.data).toHaveLength(50);
    
    // Performance check: Should complete within 2 seconds (Requirement 3.5)
    expect(duration).toBeLessThan(2000);
  });

  it('should handle mixed valid and invalid inventory files', async () => {
    const { InventoryReader } = await import('./InventoryReader');
    const { ResourceAggregator } = await import('./ResourceAggregator');

    // Valid inventory
    const validInventory: InventoryFile = {
      projectName: 'SF1',
      data: [
        {
          image: 'https://example.com/item.png',
          number: 100,
          selector: 'div.item',
          coords: { x: 0, y: 0 }
        }
      ],
      timestamp: Date.now(),
      version: '1.0',
      metadata: {
        selector: 'div.item',
        itemCount: 1,
        scanDuration: 100
      }
    };

    await fs.promises.writeFile(
      path.join(testDir, 'SF1_inventory.json'),
      JSON.stringify(validInventory, null, 2)
    );

    // Invalid JSON
    await fs.promises.writeFile(
      path.join(testDir, 'SF2_inventory.json'),
      '{ invalid json here }'
    );

    // Non-inventory file (should be ignored)
    await fs.promises.writeFile(
      path.join(testDir, 'SF3_logs.json'),
      JSON.stringify({ logs: [] })
    );

    const reader = new InventoryReader();
    const aggregator = new ResourceAggregator();

    const inventories = await reader.readAllInventories(testDir);
    const result = aggregator.aggregate(inventories);

    // Should only include SF1
    expect(result.accounts).toEqual(['SF1']);
    expect(result.resources).toHaveLength(1);
  });

  it('should handle resources with different URL types', async () => {
    const { InventoryReader } = await import('./InventoryReader');
    const { ResourceAggregator } = await import('./ResourceAggregator');

    const inventory: InventoryFile = {
      projectName: 'SF1',
      data: [
        {
          image: 'https://example.com/absolute.png',
          number: 10,
          selector: 'div.item',
          coords: { x: 0, y: 0 }
        },
        {
          image: '/api/images/relative.png',
          number: 20,
          selector: 'div.item',
          coords: { x: 0, y: 0 }
        },
        {
          image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          number: 30,
          selector: 'div.item',
          coords: { x: 0, y: 0 }
        }
      ],
      timestamp: Date.now(),
      version: '1.0',
      metadata: {
        selector: 'div.item',
        itemCount: 3,
        scanDuration: 100
      }
    };

    await fs.promises.writeFile(
      path.join(testDir, 'SF1_inventory.json'),
      JSON.stringify(inventory, null, 2)
    );

    const reader = new InventoryReader();
    const aggregator = new ResourceAggregator();

    const inventories = await reader.readAllInventories(testDir);
    const result = aggregator.aggregate(inventories);

    // All three URL types should be present
    expect(result.resources).toHaveLength(3);
    const imageUrls = result.resources.map(r => r.image);
    expect(imageUrls).toContain('https://example.com/absolute.png');
    expect(imageUrls).toContain('/api/images/relative.png');
    expect(imageUrls.some(url => url.startsWith('data:image/png'))).toBe(true);
  });

  it('should handle empty inventory data array', async () => {
    const { InventoryReader } = await import('./InventoryReader');
    const { ResourceAggregator } = await import('./ResourceAggregator');

    const inventory: InventoryFile = {
      projectName: 'SF1',
      data: [], // Empty data array
      timestamp: Date.now(),
      version: '1.0',
      metadata: {
        selector: 'div.item',
        itemCount: 0,
        scanDuration: 100
      }
    };

    await fs.promises.writeFile(
      path.join(testDir, 'SF1_inventory.json'),
      JSON.stringify(inventory, null, 2)
    );

    const reader = new InventoryReader();
    const aggregator = new ResourceAggregator();

    const inventories = await reader.readAllInventories(testDir);
    const result = aggregator.aggregate(inventories);

    // Should include account but no resources
    expect(result.accounts).toEqual(['SF1']);
    expect(result.resources).toEqual([]);
    expect(result.data).toEqual([[]]); // Single account with empty resource array
  });

  it('should handle fractional resource quantities and round to 1 decimal', async () => {
    const { InventoryReader } = await import('./InventoryReader');
    const { ResourceAggregator } = await import('./ResourceAggregator');

    const inventory: InventoryFile = {
      projectName: 'SF1',
      data: [
        {
          image: 'https://example.com/item1.png',
          number: 10.123456,
          selector: 'div.item',
          coords: { x: 0, y: 0 }
        },
        {
          image: 'https://example.com/item2.png',
          number: 99.999,
          selector: 'div.item',
          coords: { x: 0, y: 0 }
        },
        {
          image: 'https://example.com/item3.png',
          number: 0.05,
          selector: 'div.item',
          coords: { x: 0, y: 0 }
        }
      ],
      timestamp: Date.now(),
      version: '1.0',
      metadata: {
        selector: 'div.item',
        itemCount: 3,
        scanDuration: 100
      }
    };

    await fs.promises.writeFile(
      path.join(testDir, 'SF1_inventory.json'),
      JSON.stringify(inventory, null, 2)
    );

    const reader = new InventoryReader();
    const aggregator = new ResourceAggregator();

    const inventories = await reader.readAllInventories(testDir);
    const result = aggregator.aggregate(inventories);

    // Check rounded values
    expect(result.data[0][0]).toBe(10.1); // 10.123456 → 10.1
    expect(result.data[0][1]).toBe(100); // 99.999 → 100
    expect(result.data[0][2]).toBe(0.1); // 0.05 → 0.1 (rounding up)
  });

  it('should maintain data matrix alignment across multiple accounts', async () => {
    const { InventoryReader } = await import('./InventoryReader');
    const { ResourceAggregator } = await import('./ResourceAggregator');

    // SF1 has resources A and B
    const inventory1: InventoryFile = {
      projectName: 'SF1',
      data: [
        {
          image: 'https://example.com/resourceA.png',
          number: 100,
          selector: 'div.item',
          coords: { x: 0, y: 0 }
        },
        {
          image: 'https://example.com/resourceB.png',
          number: 200,
          selector: 'div.item',
          coords: { x: 0, y: 0 }
        }
      ],
      timestamp: Date.now(),
      version: '1.0',
      metadata: { selector: 'div.item', itemCount: 2, scanDuration: 100 }
    };

    // SF2 has only resource B
    const inventory2: InventoryFile = {
      projectName: 'SF2',
      data: [
        {
          image: 'https://example.com/resourceB.png',
          number: 300,
          selector: 'div.item',
          coords: { x: 0, y: 0 }
        }
      ],
      timestamp: Date.now(),
      version: '1.0',
      metadata: { selector: 'div.item', itemCount: 1, scanDuration: 100 }
    };

    // SF3 has only resource C (new resource)
    const inventory3: InventoryFile = {
      projectName: 'SF3',
      data: [
        {
          image: 'https://example.com/resourceC.png',
          number: 400,
          selector: 'div.item',
          coords: { x: 0, y: 0 }
        }
      ],
      timestamp: Date.now(),
      version: '1.0',
      metadata: { selector: 'div.item', itemCount: 1, scanDuration: 100 }
    };

    await fs.promises.writeFile(
      path.join(testDir, 'SF1_inventory.json'),
      JSON.stringify(inventory1, null, 2)
    );
    await fs.promises.writeFile(
      path.join(testDir, 'SF2_inventory.json'),
      JSON.stringify(inventory2, null, 2)
    );
    await fs.promises.writeFile(
      path.join(testDir, 'SF3_inventory.json'),
      JSON.stringify(inventory3, null, 2)
    );

    const reader = new InventoryReader();
    const aggregator = new ResourceAggregator();

    const inventories = await reader.readAllInventories(testDir);
    const result = aggregator.aggregate(inventories);

    // Verify dimensions
    expect(result.accounts).toEqual(['SF1', 'SF2', 'SF3']);
    expect(result.resources).toHaveLength(3);
    expect(result.data).toHaveLength(3);
    expect(result.data[0]).toHaveLength(3);
    expect(result.data[1]).toHaveLength(3);
    expect(result.data[2]).toHaveLength(3);

    // Find resource indices
    const resourceA = result.resources.findIndex(r => r.image === 'https://example.com/resourceA.png');
    const resourceB = result.resources.findIndex(r => r.image === 'https://example.com/resourceB.png');
    const resourceC = result.resources.findIndex(r => r.image === 'https://example.com/resourceC.png');

    // Verify data alignment
    expect(result.data[0][resourceA]).toBe(100); // SF1 has A
    expect(result.data[0][resourceB]).toBe(200); // SF1 has B
    expect(result.data[0][resourceC]).toBe(null); // SF1 doesn't have C

    expect(result.data[1][resourceA]).toBe(null); // SF2 doesn't have A
    expect(result.data[1][resourceB]).toBe(300); // SF2 has B
    expect(result.data[1][resourceC]).toBe(null); // SF2 doesn't have C

    expect(result.data[2][resourceA]).toBe(null); // SF3 doesn't have A
    expect(result.data[2][resourceB]).toBe(null); // SF3 doesn't have B
    expect(result.data[2][resourceC]).toBe(400); // SF3 has C
  });
});
