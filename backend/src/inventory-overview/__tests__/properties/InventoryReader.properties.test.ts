/**
 * Property-based tests for InventoryReader class
 * 
 * Tests universal properties that should hold across all valid inputs:
 * - Property 1: Inventory file pattern matching
 * - Property 2: JSON serialization round-trip
 * - Property 3: Resilience to missing files
 * - Property 4: Resilience to malformed files
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { promises as fs } from 'fs';
import { InventoryReader } from '../../InventoryReader';
import { InventoryFile, ResourceItem } from '../../types';

// Mock the fs module
vi.mock('fs', () => ({
  promises: {
    readdir: vi.fn(),
    readFile: vi.fn()
  }
}));

// Arbitraries for generating test data
const coordsArbitrary = fc.record({
  x: fc.integer(),
  y: fc.integer()
});

const resourceItemArbitrary: fc.Arbitrary<ResourceItem> = fc.record({
  image: fc.oneof(
    fc.webUrl({ validSchemes: ['https'] }), // absolute URL
    fc.string().map(s => `/api/images/${s}.png`), // relative URL
    fc.string().map(s => `data:image/png;base64,${s}`) // data: URL
  ),
  number: fc.float({ min: 0, max: 10000, noNaN: true, noDefaultInfinity: true }),
  selector: fc.constant('div.relative:has(img[alt="item"])'),
  coords: coordsArbitrary
});

const inventoryFileArbitrary = (projectName: string): fc.Arbitrary<InventoryFile> => 
  fc.record({
    projectName: fc.constant(projectName),
    data: fc.array(resourceItemArbitrary, { maxLength: 50 }),
    timestamp: fc.integer({ min: 1000000000000, max: 2000000000000 }),
    version: fc.constant('1.0'),
    metadata: fc.record({
      selector: fc.constant('div.relative:has(img[alt="item"])'),
      itemCount: fc.integer({ min: 0, max: 100 }),
      scanDuration: fc.integer({ min: 10, max: 1000 })
    })
  });

describe('InventoryReader - Property Tests', () => {
  let reader: InventoryReader;
  let mockLogger: {
    error: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    debug: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockLogger = {
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn()
    };
    reader = new InventoryReader(mockLogger);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  /**
   * **Validates: Requirements 1.1**
   * Property 1: Inventory file pattern matching
   * 
   * For any directory containing files, scanning SHALL identify only files 
   * matching the pattern *_inventory.json and ignore all other files.
   */
  it('Property 1: should only identify files matching *_inventory.json pattern', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            name: fc.string({ minLength: 1, maxLength: 20 }),
            isInventory: fc.boolean(),
            extension: fc.oneof(
              fc.constant('.json'),
              fc.constant('.txt'),
              fc.constant('.log'),
              fc.constant('')
            )
          }),
          { minLength: 1, maxLength: 30 }
        ),
        async (fileSpecs) => {
          // Generate filenames based on specs
          const files = fileSpecs.map(spec => {
            if (spec.isInventory) {
              return `${spec.name}_inventory.json`;
            } else {
              return `${spec.name}${spec.extension}`;
            }
          });

          // Count expected inventory files
          const expectedCount = fileSpecs.filter(spec => spec.isInventory).length;

          // Reset mocks AFTER we've determined expectations
          vi.clearAllMocks();

          // Mock file system
          vi.mocked(fs.readdir).mockResolvedValue(files as any);
          vi.mocked(fs.readFile).mockImplementation((path) => {
            const filename = String(path).split(/[/\\]/).pop() || '';
            if (filename.endsWith('_inventory.json')) {
              const accountId = filename.replace('_inventory.json', '');
              return Promise.resolve(JSON.stringify({
                projectName: accountId,
                data: [],
                timestamp: 1000000000000,
                version: '1.0',
                metadata: {
                  selector: 'div',
                  itemCount: 0,
                  scanDuration: 10
                }
              }));
            }
            return Promise.reject(new Error('Should not read non-inventory files'));
          });

          const results = await reader.readAllInventories('/test/projects');

          // Verify only inventory files were processed
          expect(results.length).toBe(expectedCount);
          
          // Verify readFile was called only for inventory files
          expect(fs.readFile).toHaveBeenCalledTimes(expectedCount);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 1.2**
   * Property 2: JSON serialization round-trip
   * 
   * For any valid InventoryFile object, writing it to JSON and reading it back 
   * SHALL produce an equivalent object with all fields preserved.
   */
  it('Property 2: should preserve data through JSON round-trip', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 }).map(s => s.replace(/[^a-zA-Z0-9]/g, '')).filter(s => s.length > 0),
        async (accountId) => {
          const inventoryData = await fc.sample(inventoryFileArbitrary(accountId), 1)[0];
          
          // Serialize to JSON
          const jsonString = JSON.stringify(inventoryData);
          
          // Reset mocks AFTER we've prepared the data
          vi.clearAllMocks();

          // Mock file system
          vi.mocked(fs.readdir).mockResolvedValue([`${accountId}_inventory.json`] as any);
          vi.mocked(fs.readFile).mockResolvedValue(jsonString);

          const results = await reader.readAllInventories('/test/projects');

          // Verify data is preserved
          expect(results).toHaveLength(1);
          expect(results[0][0]).toBe(accountId);
          
          const readData = results[0][1];
          
          // All fields should be preserved
          expect(readData.projectName).toBe(inventoryData.projectName);
          expect(readData.timestamp).toBe(inventoryData.timestamp);
          expect(readData.version).toBe(inventoryData.version);
          expect(readData.metadata).toEqual(inventoryData.metadata);
          expect(readData.data.length).toBe(inventoryData.data.length);
          
          // Check each resource item
          for (let i = 0; i < inventoryData.data.length; i++) {
            expect(readData.data[i].image).toBe(inventoryData.data[i].image);
            expect(readData.data[i].number).toBe(inventoryData.data[i].number);
            expect(readData.data[i].selector).toBe(inventoryData.data[i].selector);
            expect(readData.data[i].coords).toEqual(inventoryData.data[i].coords);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 1.3**
   * Property 3: Resilience to missing files
   * 
   * For any set of account names where some corresponding inventory files do not exist, 
   * the reading process SHALL complete successfully without throwing exceptions 
   * and return data only for existing files.
   */
  it('Property 3: should handle missing files without throwing exceptions', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            accountId: fc.string({ minLength: 1, maxLength: 10 }).map(s => s.replace(/[^a-zA-Z0-9]/g, '')),
            exists: fc.boolean()
          }),
          { minLength: 1, maxLength: 20 }
        ),
        async (fileSpecs) => {
          // Filter out empty account IDs and deduplicate by accountId
          const uniqueMap = new Map<string, typeof fileSpecs[0]>();
          fileSpecs.forEach(spec => {
            if (spec.accountId.length > 0 && !uniqueMap.has(spec.accountId)) {
              uniqueMap.set(spec.accountId, spec);
            }
          });
          const validSpecs = Array.from(uniqueMap.values());
          if (validSpecs.length === 0) return; // Skip if no valid specs

          // Reset mocks AFTER we've determined the valid specs
          vi.clearAllMocks();

          const files = validSpecs.map(spec => `${spec.accountId}_inventory.json`);
          const expectedExisting = validSpecs.filter(spec => spec.exists).length;

          vi.mocked(fs.readdir).mockResolvedValue(files as any);
          vi.mocked(fs.readFile).mockImplementation((path) => {
            const filename = String(path).split(/[/\\]/).pop() || '';
            const accountId = filename.replace('_inventory.json', '');
            const spec = validSpecs.find(s => s.accountId === accountId);

            if (spec && spec.exists) {
              return Promise.resolve(JSON.stringify({
                projectName: accountId,
                data: [],
                timestamp: 1000000000000,
                version: '1.0',
                metadata: {
                  selector: 'div',
                  itemCount: 0,
                  scanDuration: 10
                }
              }));
            } else {
              const error: NodeJS.ErrnoException = new Error('File not found');
              error.code = 'ENOENT';
              return Promise.reject(error);
            }
          });

          // Should not throw
          const results = await reader.readAllInventories('/test/projects');

          // Should return only existing files
          expect(results.length).toBe(expectedExisting);

          // Should log debug message for each missing file
          const missingCount = validSpecs.filter(spec => !spec.exists).length;
          const debugCalls = mockLogger.debug.mock.calls.filter(
            call => call[0] === 'Inventory file not found, skipping'
          );
          expect(debugCalls.length).toBe(missingCount);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 1.4**
   * Property 4: Resilience to malformed files
   * 
   * For any set of files containing both valid and invalid JSON, the reading process 
   * SHALL successfully process valid files, log errors for invalid files, 
   * and continue processing remaining files.
   */
  it('Property 4: should process valid files and log errors for invalid JSON', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            accountId: fc.string({ minLength: 1, maxLength: 10 }).map(s => s.replace(/[^a-zA-Z0-9]/g, '')),
            isValidJson: fc.boolean()
          }),
          { minLength: 1, maxLength: 20 }
        ),
        async (fileSpecs) => {
          // Filter out empty account IDs and deduplicate by accountId
          const uniqueMap = new Map<string, typeof fileSpecs[0]>();
          fileSpecs.forEach(spec => {
            if (spec.accountId.length > 0 && !uniqueMap.has(spec.accountId)) {
              uniqueMap.set(spec.accountId, spec);
            }
          });
          const validSpecs = Array.from(uniqueMap.values());
          if (validSpecs.length === 0) return; // Skip if no valid specs

          // Reset mocks AFTER we've determined the valid specs
          vi.clearAllMocks();

          const files = validSpecs.map(spec => `${spec.accountId}_inventory.json`);
          const expectedValidCount = validSpecs.filter(spec => spec.isValidJson).length;
          const expectedInvalidCount = validSpecs.filter(spec => !spec.isValidJson).length;

          vi.mocked(fs.readdir).mockResolvedValue(files as any);
          vi.mocked(fs.readFile).mockImplementation((path) => {
            const filename = String(path).split(/[/\\]/).pop() || '';
            const accountId = filename.replace('_inventory.json', '');
            const spec = validSpecs.find(s => s.accountId === accountId);

            if (spec && spec.isValidJson) {
              return Promise.resolve(JSON.stringify({
                projectName: accountId,
                data: [],
                timestamp: 1000000000000,
                version: '1.0',
                metadata: {
                  selector: 'div',
                  itemCount: 0,
                  scanDuration: 10
                }
              }));
            } else {
              // Return invalid JSON
              return Promise.resolve('{ invalid json syntax here }');
            }
          });

          // Should not throw
          const results = await reader.readAllInventories('/test/projects');

          // Should return only valid files
          expect(results.length).toBe(expectedValidCount);

          // Should log error for each invalid file
          const errorCalls = mockLogger.error.mock.calls.filter(
            call => call[0] === 'Invalid JSON in inventory file'
          );
          expect(errorCalls.length).toBe(expectedInvalidCount);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Should handle mixed scenarios (valid, invalid JSON, missing files, wrong structure)
   * 
   * This property tests the combination of all error scenarios together.
   */
  it('Property: should handle mixed valid/invalid/missing files gracefully', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            accountId: fc.string({ minLength: 1, maxLength: 10 }).map(s => s.replace(/[^a-zA-Z0-9]/g, '')),
            status: fc.oneof(
              fc.constant('valid' as const),
              fc.constant('invalid-json' as const),
              fc.constant('missing' as const),
              fc.constant('invalid-structure' as const)
            )
          }),
          { minLength: 1, maxLength: 20 }
        ),
        async (fileSpecs) => {
          // Filter out empty account IDs and deduplicate by accountId
          const uniqueMap = new Map<string, typeof fileSpecs[0]>();
          fileSpecs.forEach(spec => {
            if (spec.accountId.length > 0 && !uniqueMap.has(spec.accountId)) {
              uniqueMap.set(spec.accountId, spec);
            }
          });
          const validSpecs = Array.from(uniqueMap.values());
          if (validSpecs.length === 0) return; // Skip if no valid specs

          // Reset mocks AFTER we've determined the valid specs
          vi.clearAllMocks();

          const files = validSpecs.map(spec => `${spec.accountId}_inventory.json`);
          const expectedValidCount = validSpecs.filter(spec => spec.status === 'valid').length;

          vi.mocked(fs.readdir).mockResolvedValue(files as any);
          vi.mocked(fs.readFile).mockImplementation((path) => {
            const filename = String(path).split(/[/\\]/).pop() || '';
            const accountId = filename.replace('_inventory.json', '');
            const spec = validSpecs.find(s => s.accountId === accountId);

            if (!spec) return Promise.reject(new Error('Spec not found'));

            switch (spec.status) {
              case 'valid':
                return Promise.resolve(JSON.stringify({
                  projectName: accountId,
                  data: [],
                  timestamp: 1000000000000,
                  version: '1.0',
                  metadata: {
                    selector: 'div',
                    itemCount: 0,
                    scanDuration: 10
                  }
                }));
              
              case 'invalid-json':
                return Promise.resolve('{ invalid json }');
              
              case 'missing': {
                const error: NodeJS.ErrnoException = new Error('File not found');
                error.code = 'ENOENT';
                return Promise.reject(error);
              }
              
              case 'invalid-structure':
                return Promise.resolve(JSON.stringify({
                  projectName: accountId,
                  // Missing required fields
                }));
            }
          });

          // Should not throw
          const results = await reader.readAllInventories('/test/projects');

          // Should return only valid files
          expect(results.length).toBe(expectedValidCount);

          // All returned results should have the expected structure
          results.forEach(([accountId, inventory]) => {
            expect(typeof accountId).toBe('string');
            expect(inventory.projectName).toBe(accountId);
            expect(Array.isArray(inventory.data)).toBe(true);
            expect(typeof inventory.timestamp).toBe('number');
            expect(typeof inventory.version).toBe('string');
            expect(typeof inventory.metadata).toBe('object');
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});
