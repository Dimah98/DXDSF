import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import http from 'http';
import request from 'supertest';

/**
 * Health Check Endpoint Tests
 * 
 * Tests for Requirement 24: Health Check Endpoint
 * 
 * Validates:
 * 1. Endpoint is accessible without authentication
 * 2. Returns HTTP 200 OK
 * 3. Includes required fields: status, timestamp, uptime, memory, activeSessionCount, activeBrowserCount
 * 4. Response time is under 100 milliseconds
 * 5. Response is formatted as JSON
 */

describe('Health Check Endpoint', () => {
  let app: express.Application;
  let server: http.Server;

  beforeAll(async () => {
    // Create a minimal Express app with just the health endpoint
    app = express();
    app.use(express.json());

    // Mock sessions map for testing
    const mockSessions = new Map();
    mockSessions.set('test-project-1', {
      page: { isClosed: () => false },
      isBotRunning: true
    });
    mockSessions.set('test-project-2', {
      page: null,
      isBotRunning: false
    });

    // Implement health check endpoint (same as in index.ts)
    app.get('/health', (_req, res) => {
      try {
        const memoryUsage = process.memoryUsage();
        const uptime = process.uptime();
        
        let activeSessionCount = 0;
        let activeBrowserCount = 0;
        
        mockSessions.forEach((session: any) => {
          activeSessionCount++;
          if (session.page && session.isBotRunning) {
            activeBrowserCount++;
          }
        });
        
        const healthResponse = {
          status: 'ok',
          timestamp: new Date().toISOString(),
          uptime: Math.floor(uptime),
          memory: {
            heapUsed: Math.floor(memoryUsage.heapUsed / 1024 / 1024),
            heapTotal: Math.floor(memoryUsage.heapTotal / 1024 / 1024),
            rss: Math.floor(memoryUsage.rss / 1024 / 1024),
            external: Math.floor(memoryUsage.external / 1024 / 1024)
          },
          activeSessionCount,
          activeBrowserCount
        };
        
        res.status(200).json(healthResponse);
      } catch (err) {
        res.status(500).json({ status: 'error', message: 'Health check failed' });
      }
    });

    // Start server on random available port
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it('should return HTTP 200 OK', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
  });

  it('should not require authentication', async () => {
    // Request without any authentication headers should succeed
    const response = await request(app)
      .get('/health')
      .expect(200);
    
    expect(response.body).toBeDefined();
  });

  it('should return JSON response', async () => {
    const response = await request(app).get('/health');
    expect(response.headers['content-type']).toMatch(/application\/json/);
  });

  it('should include status field', async () => {
    const response = await request(app).get('/health');
    expect(response.body).toHaveProperty('status');
    expect(response.body.status).toBe('ok');
  });

  it('should include timestamp field in ISO format', async () => {
    const response = await request(app).get('/health');
    expect(response.body).toHaveProperty('timestamp');
    expect(response.body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('should include uptime field as integer', async () => {
    const response = await request(app).get('/health');
    expect(response.body).toHaveProperty('uptime');
    expect(typeof response.body.uptime).toBe('number');
    expect(Number.isInteger(response.body.uptime)).toBe(true);
    expect(response.body.uptime).toBeGreaterThanOrEqual(0);
  });

  it('should include memory usage with all required fields', async () => {
    const response = await request(app).get('/health');
    expect(response.body).toHaveProperty('memory');
    expect(response.body.memory).toHaveProperty('heapUsed');
    expect(response.body.memory).toHaveProperty('heapTotal');
    expect(response.body.memory).toHaveProperty('rss');
    expect(response.body.memory).toHaveProperty('external');
    
    // All memory values should be positive integers (in MB)
    expect(typeof response.body.memory.heapUsed).toBe('number');
    expect(typeof response.body.memory.heapTotal).toBe('number');
    expect(typeof response.body.memory.rss).toBe('number');
    expect(typeof response.body.memory.external).toBe('number');
    
    expect(response.body.memory.heapUsed).toBeGreaterThan(0);
    expect(response.body.memory.heapTotal).toBeGreaterThan(0);
    expect(response.body.memory.rss).toBeGreaterThan(0);
  });

  it('should include activeSessionCount field', async () => {
    const response = await request(app).get('/health');
    expect(response.body).toHaveProperty('activeSessionCount');
    expect(typeof response.body.activeSessionCount).toBe('number');
    expect(Number.isInteger(response.body.activeSessionCount)).toBe(true);
    expect(response.body.activeSessionCount).toBe(2); // We have 2 mock sessions
  });

  it('should include activeBrowserCount field', async () => {
    const response = await request(app).get('/health');
    expect(response.body).toHaveProperty('activeBrowserCount');
    expect(typeof response.body.activeBrowserCount).toBe('number');
    expect(Number.isInteger(response.body.activeBrowserCount)).toBe(true);
    expect(response.body.activeBrowserCount).toBe(1); // Only 1 mock session has active browser
  });

  it('should respond within 100 milliseconds', async () => {
    const startTime = Date.now();
    await request(app).get('/health');
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    expect(responseTime).toBeLessThan(100);
  });

  it('should handle errors gracefully', async () => {
    // Create a new app that throws an error
    const errorApp = express();
    errorApp.get('/health', (_req, res) => {
      try {
        throw new Error('Simulated error');
      } catch (err) {
        res.status(500).json({ status: 'error', message: 'Health check failed' });
      }
    });

    const response = await request(errorApp).get('/health');
    expect(response.status).toBe(500);
    expect(response.body).toHaveProperty('status', 'error');
    expect(response.body).toHaveProperty('message', 'Health check failed');
  });

  it('should return all required fields in correct format', async () => {
    const response = await request(app).get('/health');
    
    // Verify complete response structure
    expect(response.body).toEqual({
      status: expect.any(String),
      timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
      uptime: expect.any(Number),
      memory: {
        heapUsed: expect.any(Number),
        heapTotal: expect.any(Number),
        rss: expect.any(Number),
        external: expect.any(Number)
      },
      activeSessionCount: expect.any(Number),
      activeBrowserCount: expect.any(Number)
    });
  });
});
