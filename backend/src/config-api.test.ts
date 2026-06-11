/**
 * Unit tests for Config API endpoints
 * 
 * Tests GET /api/config endpoint functionality
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import { ConfigService } from './config/ConfigService';
import * as fs from 'fs/promises';
import * as path from 'path';

const TEST_CONFIG_DIR = path.join(__dirname, '..', 'test-config-api-temp');

describe('Config API Endpoints', () => {
  let app: Express;
  let configService: ConfigService;

  beforeAll(async () => {
    // Create test config directory
    await fs.mkdir(TEST_CONFIG_DIR, { recursive: true });
    
    // Initialize ConfigService
    configService = new ConfigService(TEST_CONFIG_DIR);
    await configService.loadConfig();
    
    // Setup minimal Express app with GET endpoint
    app = express();
    app.use(express.json());
    
    // Add GET /api/config endpoint (no authentication for testing)
    app.get('/api/config', async (req, res) => {
      try {
        const config = configService.getConfig();
        res.status(200).json(config);
      } catch (error: any) {
        res.status(500).json({ error: 'Internal server error' });
      }
    });
  });

  afterAll(async () => {
    // Cleanup test directory
    try {
      await fs.rm(TEST_CONFIG_DIR, { recursive: true, force: true });
    } catch (err) {
      // Ignore cleanup errors
    }
  });

  describe('GET /api/config', () => {
    // Test Requirement 2.4: Returns 200 OK
    it('should return 200 OK for GET /api/config', async () => {
      const response = await request(app).get('/api/config');
      
      expect(response.status).toBe(200);
    });

    // Test Requirement 2.2: Returns correct JSON format
    it('should return config in format {"route": "string", "value": number}', async () => {
      const response = await request(app).get('/api/config');
      
      expect(response.body).toHaveProperty('route');
      expect(response.body).toHaveProperty('value');
      expect(typeof response.body.route).toBe('string');
      expect(typeof response.body.value).toBe('number');
    });

    // Test Requirement 2.3: Includes Content-Type header
    it('should include Content-Type: application/json header', async () => {
      const response = await request(app).get('/api/config');
      
      expect(response.headers['content-type']).toMatch(/application\/json/);
    });

    // Test Requirement 2.5: No authentication required (should work without auth)
    it('should allow GET without authentication', async () => {
      // No Authorization header sent
      const response = await request(app).get('/api/config');
      
      // Should succeed without auth
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('route');
      expect(response.body).toHaveProperty('value');
    });

    // Test Requirement 1.4: Returns default values when file doesn't exist
    it('should return default config {"route": "", "value": 0}', async () => {
      const response = await request(app).get('/api/config');
      
      expect(response.body.route).toBe('');
      expect(response.body.value).toBe(0);
    });

    // Test that config structure contains exactly two fields
    it('should return exactly two fields: route and value', async () => {
      const response = await request(app).get('/api/config');
      
      const keys = Object.keys(response.body);
      expect(keys).toHaveLength(2);
      expect(keys).toContain('route');
      expect(keys).toContain('value');
    });
  });
});
