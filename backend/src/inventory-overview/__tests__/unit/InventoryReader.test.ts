/**
 * Unit tests for InventoryReader class
 * 
 * Tests specific scenarios including:
 * - Pattern matching for *_inventory.json files
 * - JSON parsing and validation
 * - Error handling (missing files, invalid JSON, etc.)
 * - Version and projectName validation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { InventoryReader } from '../../InventoryReader';
import { InventoryFile } from '../../types';

// Mock the fs module
vi.mock('fs', () => ({
  promises: {
    readdir: vi.fn(),
    readFile: vi.fn()
  }
}));

describe('InventoryReader', () => {
  let reader: InventoryReader;
  let mockLogger: {
    error: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    debug: ReturnType<typeof vi.fn>;
  };

  const validInventory: InventoryFile = {
    projectName: 'SF1',
    data: [
      {
        image: 'https://example.com/corn.png',
        number: 29,
        selector: 'div.relative',
        coords: { x: 283, y: 308 }
      }
    ],
    timestamp: 1780876990943,
    version: '1.0',
    metadata: {
      selector: 'div.relative',
      itemCount: 1,
      scanDuration: 20
    }
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

  describe('Pattern Matching', () => {
    it('should only read files matching *_inventory.json pattern', async () => {
      const files = [
        'SF1_inventory.json',
        'SF2_inventory.json',
        'SF1.json',
        'SF1_logs.json',
        'inventory.json',
        'SF3_inventory.txt',
        'default.json'
      ];

      vi.mocked(fs.readdir).mockResolvedValue(files as any);
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(validInventory));

      await reader.readAllInventories('/test/projects');

      // Should only attempt to read files matching the pattern
      expect(fs.readFile).toHaveBeenCalledTimes(2);
      expect(fs.readFile).toHaveBeenCalledWith(
        expect.stringContaining('SF1_inventory.json'),
        'utf-8'
      );
      expect(fs.readFile).toHaveBeenCalledWith(
        expect.stringContaining('SF2_inventory.json'),
        'utf-8'
      );
    });

    it('should extract accountId from filename correctly', async () => {
      vi.mocked(fs.readdir).mockResolvedValue(['SF910_inventory.json'] as any);
      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({ ...validInventory, projectName: 'SF910' })
      );

      const results = await reader.readAllInventories('/test/projects');

      expect(results).toHaveLength(1);
      expect(results[0][0]).toBe('SF910');
    });
  });

  describe('JSON Parsing', () => {
    it('should successfully parse valid JSON inventory files', async () => {
      vi.mocked(fs.readdir).mockResolvedValue(['SF1_inventory.json'] as any);
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(validInventory));

      const results = await reader.readAllInventories('/test/projects');

      expect(results).toHaveLength(1);
      expect(results[0][0]).toBe('SF1');
      expect(results[0][1]).toEqual(validInventory);
    });

    it('should handle invalid JSON and continue processing', async () => {
      vi.mocked(fs.readdir).mockResolvedValue([
        'SF1_inventory.json',
        'SF2_inventory.json'
      ] as any);

      vi.mocked(fs.readFile)
        .mockResolvedValueOnce('{ invalid json }')
        .mockResolvedValueOnce(JSON.stringify({ ...validInventory, projectName: 'SF2' }));

      const results = await reader.readAllInventories('/test/projects');

      // Should log error for invalid JSON
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Invalid JSON in inventory file',
        expect.any(Error),
        expect.objectContaining({ accountId: 'SF1' })
      );

      // Should continue and process valid file
      expect(results).toHaveLength(1);
      expect(results[0][0]).toBe('SF2');
    });
  });

  describe('Structure Validation', () => {
    it('should reject inventory with missing required fields', async () => {
      const invalidInventories = [
        { ...validInventory, projectName: undefined },
        { ...validInventory, data: undefined },
        { ...validInventory, timestamp: undefined },
        { ...validInventory, version: undefined },
        { ...validInventory, metadata: undefined }
      ];

      for (const invalid of invalidInventories) {
        vi.mocked(fs.readdir).mockResolvedValue(['SF1_inventory.json'] as any);
        vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(invalid));

        const results = await reader.readAllInventories('/test/projects');

        expect(results).toHaveLength(0);
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Invalid inventory file structure',
          undefined,
          expect.any(Object)
        );

        vi.clearAllMocks();
      }
    });

    it('should reject inventory with invalid metadata structure', async () => {
      const invalidMetadata = {
        ...validInventory,
        metadata: {
          selector: 'div.relative',
          itemCount: 'invalid', // should be number
          scanDuration: 20
        }
      };

      vi.mocked(fs.readdir).mockResolvedValue(['SF1_inventory.json'] as any);
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(invalidMetadata));

      const results = await reader.readAllInventories('/test/projects');

      expect(results).toHaveLength(0);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Invalid inventory file structure',
        undefined,
        expect.any(Object)
      );
    });

    it('should reject inventory with invalid resource items', async () => {
      const invalidData = {
        ...validInventory,
        data: [
          {
            image: 'https://example.com/corn.png',
            number: 'invalid', // should be number
            selector: 'div.relative',
            coords: { x: 283, y: 308 }
          }
        ]
      };

      vi.mocked(fs.readdir).mockResolvedValue(['SF1_inventory.json'] as any);
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(invalidData));

      const results = await reader.readAllInventories('/test/projects');

      expect(results).toHaveLength(0);
    });

    it('should reject inventory with invalid coords structure', async () => {
      const invalidCoords = {
        ...validInventory,
        data: [
          {
            image: 'https://example.com/corn.png',
            number: 29,
            selector: 'div.relative',
            coords: { x: 'invalid', y: 308 } // x should be number
          }
        ]
      };

      vi.mocked(fs.readdir).mockResolvedValue(['SF1_inventory.json'] as any);
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(invalidCoords));

      const results = await reader.readAllInventories('/test/projects');

      expect(results).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing files gracefully', async () => {
      vi.mocked(fs.readdir).mockResolvedValue(['SF1_inventory.json'] as any);
      
      const error: NodeJS.ErrnoException = new Error('File not found');
      error.code = 'ENOENT';
      vi.mocked(fs.readFile).mockRejectedValue(error);

      const results = await reader.readAllInventories('/test/projects');

      // Should log at debug level for missing files
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Inventory file not found, skipping',
        expect.objectContaining({ accountId: 'SF1' })
      );

      // Should return empty array without throwing
      expect(results).toHaveLength(0);
    });

    it('should handle file access errors', async () => {
      vi.mocked(fs.readdir).mockResolvedValue(['SF1_inventory.json'] as any);
      
      const error: NodeJS.ErrnoException = new Error('Access denied');
      error.code = 'EACCES';
      vi.mocked(fs.readFile).mockRejectedValue(error);

      const results = await reader.readAllInventories('/test/projects');

      // Should log error for access issues
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to read inventory file',
        expect.any(Error),
        expect.objectContaining({ 
          accountId: 'SF1',
          errorCode: 'EACCES'
        })
      );

      expect(results).toHaveLength(0);
    });

    it('should handle directory read errors', async () => {
      vi.mocked(fs.readdir).mockRejectedValue(new Error('Directory not found'));

      const results = await reader.readAllInventories('/nonexistent/path');

      // Should log error
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to read projects directory',
        expect.any(Error),
        expect.objectContaining({ projectsDir: '/nonexistent/path' })
      );

      // Should return empty array
      expect(results).toHaveLength(0);
    });

    it('should continue processing after individual file errors', async () => {
      vi.mocked(fs.readdir).mockResolvedValue([
        'SF1_inventory.json',
        'SF2_inventory.json',
        'SF3_inventory.json'
      ] as any);

      const error: NodeJS.ErrnoException = new Error('Access denied');
      error.code = 'EACCES';

      vi.mocked(fs.readFile)
        .mockResolvedValueOnce(JSON.stringify({ ...validInventory, projectName: 'SF1' }))
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce(JSON.stringify({ ...validInventory, projectName: 'SF3' }));

      const results = await reader.readAllInventories('/test/projects');

      // Should process SF1 and SF3, skip SF2
      expect(results).toHaveLength(2);
      expect(results[0][0]).toBe('SF1');
      expect(results[1][0]).toBe('SF3');
    });
  });

  describe('Version Validation', () => {
    it('should warn on version mismatch but still process file', async () => {
      const differentVersion = {
        ...validInventory,
        version: '2.0'
      };

      vi.mocked(fs.readdir).mockResolvedValue(['SF1_inventory.json'] as any);
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(differentVersion));

      const results = await reader.readAllInventories('/test/projects');

      // Should log warning
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Version mismatch in inventory file',
        expect.objectContaining({
          accountId: 'SF1',
          expectedVersion: '1.0',
          actualVersion: '2.0'
        })
      );

      // Should still return the data
      expect(results).toHaveLength(1);
      expect(results[0][1].version).toBe('2.0');
    });
  });

  describe('ProjectName Validation', () => {
    it('should warn when projectName does not match filename', async () => {
      const mismatchedName = {
        ...validInventory,
        projectName: 'SF999'
      };

      vi.mocked(fs.readdir).mockResolvedValue(['SF1_inventory.json'] as any);
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mismatchedName));

      const results = await reader.readAllInventories('/test/projects');

      // Should log warning
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'ProjectName mismatch in inventory file',
        expect.objectContaining({
          accountId: 'SF1',
          projectName: 'SF999',
          filename: 'SF1_inventory.json'
        })
      );

      // Should still return the data
      expect(results).toHaveLength(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty directory', async () => {
      vi.mocked(fs.readdir).mockResolvedValue([] as any);

      const results = await reader.readAllInventories('/test/projects');

      expect(results).toHaveLength(0);
    });

    it('should handle directory with no matching files', async () => {
      vi.mocked(fs.readdir).mockResolvedValue([
        'SF1.json',
        'SF2_logs.json',
        'readme.txt'
      ] as any);

      const results = await reader.readAllInventories('/test/projects');

      expect(results).toHaveLength(0);
      expect(fs.readFile).not.toHaveBeenCalled();
    });

    it('should handle inventory with empty data array', async () => {
      const emptyData = {
        ...validInventory,
        data: []
      };

      vi.mocked(fs.readdir).mockResolvedValue(['SF1_inventory.json'] as any);
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(emptyData));

      const results = await reader.readAllInventories('/test/projects');

      expect(results).toHaveLength(1);
      expect(results[0][1].data).toEqual([]);
    });

    it('should handle inventory with large data array', async () => {
      const largeData = {
        ...validInventory,
        data: Array(100).fill(validInventory.data[0])
      };

      vi.mocked(fs.readdir).mockResolvedValue(['SF1_inventory.json'] as any);
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(largeData));

      const results = await reader.readAllInventories('/test/projects');

      expect(results).toHaveLength(1);
      expect(results[0][1].data).toHaveLength(100);
    });

    it('should handle different URL types in image field', async () => {
      const differentUrlTypes = {
        ...validInventory,
        data: [
          {
            image: 'https://example.com/absolute.png',
            number: 1,
            selector: 'div',
            coords: { x: 0, y: 0 }
          },
          {
            image: '/api/images/relative.png',
            number: 2,
            selector: 'div',
            coords: { x: 0, y: 0 }
          },
          {
            image: 'data:image/png;base64,iVBORw0KGgo=',
            number: 3,
            selector: 'div',
            coords: { x: 0, y: 0 }
          }
        ]
      };

      vi.mocked(fs.readdir).mockResolvedValue(['SF1_inventory.json'] as any);
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(differentUrlTypes));

      const results = await reader.readAllInventories('/test/projects');

      expect(results).toHaveLength(1);
      expect(results[0][1].data).toHaveLength(3);
    });

    it('should handle fractional number values', async () => {
      const fractionalNumbers = {
        ...validInventory,
        data: [
          {
            image: 'https://example.com/corn.png',
            number: 8.8,
            selector: 'div',
            coords: { x: 0, y: 0 }
          },
          {
            image: 'https://example.com/wheat.png',
            number: 57.2,
            selector: 'div',
            coords: { x: 0, y: 0 }
          }
        ]
      };

      vi.mocked(fs.readdir).mockResolvedValue(['SF1_inventory.json'] as any);
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(fractionalNumbers));

      const results = await reader.readAllInventories('/test/projects');

      expect(results).toHaveLength(1);
      expect(results[0][1].data[0].number).toBe(8.8);
      expect(results[0][1].data[1].number).toBe(57.2);
    });
  });

  describe('Multiple File Processing', () => {
    it('should process multiple valid inventory files', async () => {
      vi.mocked(fs.readdir).mockResolvedValue([
        'SF1_inventory.json',
        'SF2_inventory.json',
        'SF910_inventory.json'
      ] as any);

      vi.mocked(fs.readFile)
        .mockResolvedValueOnce(JSON.stringify({ ...validInventory, projectName: 'SF1' }))
        .mockResolvedValueOnce(JSON.stringify({ ...validInventory, projectName: 'SF2' }))
        .mockResolvedValueOnce(JSON.stringify({ ...validInventory, projectName: 'SF910' }));

      const results = await reader.readAllInventories('/test/projects');

      expect(results).toHaveLength(3);
      expect(results[0][0]).toBe('SF1');
      expect(results[1][0]).toBe('SF2');
      expect(results[2][0]).toBe('SF910');
    });

    it('should handle up to 100 inventory files', async () => {
      // Generate 100 inventory files
      const files = Array.from({ length: 100 }, (_, i) => `SF${i + 1}_inventory.json`);
      vi.mocked(fs.readdir).mockResolvedValue(files as any);

      // Mock reading all files
      for (let i = 0; i < 100; i++) {
        vi.mocked(fs.readFile).mockResolvedValueOnce(
          JSON.stringify({ ...validInventory, projectName: `SF${i + 1}` })
        );
      }

      const results = await reader.readAllInventories('/test/projects');

      expect(results).toHaveLength(100);
    });
  });
});
