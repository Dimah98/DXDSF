/**
 * Unit tests for GET /api/inventory/overview endpoint
 * 
 * Tests Requirements:
 * - 3.1: GET endpoint /api/inventory/overview
 * - 3.2: Returns JSON with accounts, resources, data, timestamp
 * - 3.3: Returns HTTP 200 for successful request
 * - 3.4: Returns HTTP 500 for errors
 * - 4.1: Response structure with accounts (string[])
 * - 4.2: Response structure with resources (ResourceMetadata[])
 * - 4.5: Response includes timestamp
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { InventoryReader } from './InventoryReader';
import { ResourceAggregator } from './ResourceAggregator';
import type { InventoryFile } from './types';

// Mock inventory data for testing
const createMockInventory = (projectName: string, items: Array<{ image: string; number: number }>): InventoryFile => ({
  projectName,
  data: items.map((item, idx) => ({
    image: item.image,
    number: item.number,
    selector: 'div.item',
    coords: { x: idx * 100, y: idx * 100 }
  })),
  timestamp: Date.now(),
  version: '1.0',
  metadata: {
    selector: 'div.item',
    itemCount: items.length,
    scanDuration: 100
  }
});

describe('GET /api/inventory/overview', () => {
  let app: express.Application;
  let testDir: string;

  beforeEach(() => {
    // Setup test Express app
    app = express();
    app.use(express.json());

    // Create test directory
    testDir = path.join(__dirname, '../../test-inventory-overview');
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    // Setup test endpoint (no auth for testing)
    app.get('/api/inventory/overview', async (_req, res) => {
      try {
        const inventoryReader = new InventoryReader();
        const resourceAggregator = new ResourceAggregator();

        const inventories = await inventoryReader.readAllInventories(testDir);
        const aggregatedData = resourceAggregator.aggregate(inventories);

        res.status(200).json(aggregatedData);
      } catch (err) {
        res.status(500).json({
          success: false,
          error: 'Failed to generate inventory overview. Please try again later.'
        });
      }
    });
  });

  afterEach(() => {
    // Cleanup test files
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

  // Requirement 3.3: Successfully returns HTTP 200
  it('should return HTTP 200 for successful request', async () => {
    const response = await request(app)
      .get('/api/inventory/overview')
      .expect(200);

    expect(response.status).toBe(200);
  });

  // Requirement 3.2, 4.1, 4.2, 4.5: Response structure
  it('should return JSON with accounts, resources, data, timestamp', async () => {
    const response = await request(app)
      .get('/api/inventory/overview')
      .expect(200);

    expect(response.body).toHaveProperty('accounts');
    expect(response.body).toHaveProperty('resources');
    expect(response.body).toHaveProperty('data');
    expect(response.body).toHaveProperty('timestamp');

    expect(Array.isArray(response.body.accounts)).toBe(true);
    expect(Array.isArray(response.body.resources)).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(typeof response.body.timestamp).toBe('number');
  });

  // Requirement 3.3: Returns empty arrays when no inventory files exist
  it('should return empty arrays when no inventory files exist', async () => {
    const response = await request(app)
      .get('/api/inventory/overview')
      .expect(200);

    expect(response.body.accounts).toEqual([]);
    expect(response.body.resources).toEqual([]);
    expect(response.body.data).toEqual([]);
  });

  // Requirement 3.2: Returns aggregated data from multiple accounts
  it('should aggregate data from multiple accounts', async () => {
    // Create test inventory files
    const inventory1 = createMockInventory('SF1', [
      { image: 'https://example.com/corn.png', number: 100 },
      { image: 'https://example.com/wheat.png', number: 50 }
    ]);
    const inventory2 = createMockInventory('SF2', [
      { image: 'https://example.com/corn.png', number: 200 },
      { image: 'https://example.com/rice.png', number: 75 }
    ]);

    await fs.promises.writeFile(
      path.join(testDir, 'SF1_inventory.json'),
      JSON.stringify(inventory1, null, 2)
    );
    await fs.promises.writeFile(
      path.join(testDir, 'SF2_inventory.json'),
      JSON.stringify(inventory2, null, 2)
    );

    const response = await request(app)
      .get('/api/inventory/overview')
      .expect(200);

    // Check accounts are sorted alphabetically
    expect(response.body.accounts).toEqual(['SF1', 'SF2']);

    // Check resources contain unique image URLs
    expect(response.body.resources).toHaveLength(3);
    const imageUrls = response.body.resources.map((r: any) => r.image);
    expect(imageUrls).toContain('https://example.com/corn.png');
    expect(imageUrls).toContain('https://example.com/wheat.png');
    expect(imageUrls).toContain('https://example.com/rice.png');

    // Check data matrix dimensions
    expect(response.body.data).toHaveLength(2); // 2 accounts
    expect(response.body.data[0]).toHaveLength(3); // 3 resources
    expect(response.body.data[1]).toHaveLength(3); // 3 resources
  });

  // Requirement 4.2: ResourceMetadata structure
  it('should return resources with image and index fields', async () => {
    const inventory = createMockInventory('SF1', [
      { image: 'https://example.com/item.png', number: 10 }
    ]);

    await fs.promises.writeFile(
      path.join(testDir, 'SF1_inventory.json'),
      JSON.stringify(inventory, null, 2)
    );

    const response = await request(app)
      .get('/api/inventory/overview')
      .expect(200);

    expect(response.body.resources).toHaveLength(1);
    expect(response.body.resources[0]).toHaveProperty('image');
    expect(response.body.resources[0]).toHaveProperty('index');
    expect(typeof response.body.resources[0].image).toBe('string');
    expect(typeof response.body.resources[0].index).toBe('number');
  });

  // Requirement 4.5: Timestamp is recent
  it('should return timestamp within reasonable range of current time', async () => {
    const before = Date.now();
    const response = await request(app)
      .get('/api/inventory/overview')
      .expect(200);
    const after = Date.now();

    expect(response.body.timestamp).toBeGreaterThanOrEqual(before);
    expect(response.body.timestamp).toBeLessThanOrEqual(after);
  });

  // Requirement 3.3: Handles alphabetical sorting of accounts
  it('should sort accounts alphabetically', async () => {
    const accounts = ['SF10', 'SF2', 'SF1', 'SF20'];
    
    for (const account of accounts) {
      const inventory = createMockInventory(account, [
        { image: 'https://example.com/item.png', number: 10 }
      ]);
      await fs.promises.writeFile(
        path.join(testDir, `${account}_inventory.json`),
        JSON.stringify(inventory, null, 2)
      );
    }

    const response = await request(app)
      .get('/api/inventory/overview')
      .expect(200);

    // Check alphabetical sorting (SF1, SF10, SF2, SF20)
    expect(response.body.accounts).toEqual(['SF1', 'SF10', 'SF2', 'SF20']);
  });

  // Requirement 3.2: Data matrix contains correct values
  it('should populate data matrix with correct resource quantities', async () => {
    const inventory1 = createMockInventory('SF1', [
      { image: 'https://example.com/item1.png', number: 100 },
      { image: 'https://example.com/item2.png', number: 50 }
    ]);
    const inventory2 = createMockInventory('SF2', [
      { image: 'https://example.com/item1.png', number: 200 }
      // item2 is missing in SF2
    ]);

    await fs.promises.writeFile(
      path.join(testDir, 'SF1_inventory.json'),
      JSON.stringify(inventory1, null, 2)
    );
    await fs.promises.writeFile(
      path.join(testDir, 'SF2_inventory.json'),
      JSON.stringify(inventory2, null, 2)
    );

    const response = await request(app)
      .get('/api/inventory/overview')
      .expect(200);

    // Find indices of resources
    const item1Index = response.body.resources.findIndex((r: any) => r.image === 'https://example.com/item1.png');
    const item2Index = response.body.resources.findIndex((r: any) => r.image === 'https://example.com/item2.png');

    // Check data matrix values
    expect(response.body.data[0][item1Index]).toBe(100); // SF1 has 100 item1
    expect(response.body.data[0][item2Index]).toBe(50);  // SF1 has 50 item2
    expect(response.body.data[1][item1Index]).toBe(200); // SF2 has 200 item1
    expect(response.body.data[1][item2Index]).toBe(null); // SF2 doesn't have item2
  });

  // Requirement 3.3: Handles invalid JSON gracefully
  it('should continue processing when encountering invalid JSON file', async () => {
    // Create one valid and one invalid inventory file
    const validInventory = createMockInventory('SF1', [
      { image: 'https://example.com/item.png', number: 10 }
    ]);

    await fs.promises.writeFile(
      path.join(testDir, 'SF1_inventory.json'),
      JSON.stringify(validInventory, null, 2)
    );
    await fs.promises.writeFile(
      path.join(testDir, 'SF2_inventory.json'),
      '{ invalid json }'
    );

    const response = await request(app)
      .get('/api/inventory/overview')
      .expect(200);

    // Should only include SF1 (SF2 was invalid and skipped)
    expect(response.body.accounts).toEqual(['SF1']);
    expect(response.body.resources).toHaveLength(1);
  });
});
