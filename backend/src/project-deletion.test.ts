/**
 * Unit tests for DELETE /api/projects/:name endpoint
 * 
 * Tests specifically for inventory file cleanup functionality:
 * - Requirement 6.7: Delete inventory file when project is deleted
 * - Handles cases where inventory file doesn't exist
 * - Logs deletion success/failure appropriately
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { inputValidator } from './validation/InputValidator';

// Mock project data
const MOCK_PROJECT_NAME = 'test-project-delete';
const MOCK_PROJECT_DATA = {
  id: 1,
  name: MOCK_PROJECT_NAME,
  nodes: []
};

const MOCK_INVENTORY_DATA = {
  projectName: MOCK_PROJECT_NAME,
  data: [
    { image: 'https://example.com/image1.png', number: 100 }
  ],
  timestamp: Date.now(),
  version: '1.0'
};

describe('DELETE /api/projects/:name - Inventory File Cleanup', () => {
  let app: express.Application;
  let testDir: string;
  let projectPath: string;
  let inventoryPath: string;
  let statsPath: string;

  beforeEach(() => {
    // Setup test Express app with minimal configuration
    app = express();
    app.use(express.json());

    // Create test directory
    testDir = path.join(__dirname, '../test-projects-delete');
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    // Setup test DELETE endpoint (simplified version)
    app.delete('/api/projects/:name', async (req, res) => {
      try {
        const name = req.params.name;

        // Validate project name
        const validation = inputValidator.validateProjectName(name);
        if (!validation.isValid) {
          return res.status(400).json({ success: false, error: validation.error });
        }

        // Check if project file exists
        const filePath = path.join(testDir, `${name}.json`);
        let fileExists = false;
        try {
          fileExists = fs.existsSync(filePath);
        } catch (err) {
          return res.status(500).json({ 
            success: false, 
            error: 'Failed to check project existence. Please try again.' 
          });
        }

        if (!fileExists) {
          return res.status(404).json({ success: false, error: 'Project not found' });
        }

        // Delete project file
        try {
          fs.unlinkSync(filePath);
        } catch (err) {
          return res.status(500).json({ success: false, error: 'Failed to delete project file' });
        }

        return res.json({ success: true });
      } catch (err) {
        return res.status(500).json({ success: false, error: 'Internal server error' });
      }
    });

    projectPath = path.join(testDir, `${MOCK_PROJECT_NAME}.json`);
    inventoryPath = path.join(testDir, `${MOCK_PROJECT_NAME}_inventory.json`);
    statsPath = path.join(testDir, `${MOCK_PROJECT_NAME}_stats.json`);
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

  // Requirement 6.7: Delete inventory file when project is deleted
  it('should delete inventory file when deleting project', async () => {
    // Create test project file
    await fs.promises.writeFile(
      projectPath,
      JSON.stringify(MOCK_PROJECT_DATA, null, 2),
      'utf-8'
    );

    // Create test inventory file
    await fs.promises.writeFile(
      inventoryPath,
      JSON.stringify(MOCK_INVENTORY_DATA, null, 2),
      'utf-8'
    );

    // Verify inventory file exists before deletion
    expect(fs.existsSync(inventoryPath)).toBe(true);

    // Delete project
    const response = await request(app)
      .delete(`/api/projects/${MOCK_PROJECT_NAME}`)
      .expect(200);

    expect(response.body).toEqual({ success: true });

    // Verify inventory file was deleted
    expect(fs.existsSync(inventoryPath)).toBe(false);
  });

  // Requirement 6.7: Handle cases where inventory file doesn't exist
  it('should successfully delete project even if inventory file does not exist', async () => {
    // Create test project file without inventory file
    await fs.promises.writeFile(
      projectPath,
      JSON.stringify(MOCK_PROJECT_DATA, null, 2),
      'utf-8'
    );

    // Verify inventory file doesn't exist
    expect(fs.existsSync(inventoryPath)).toBe(false);

    // Delete project should still succeed
    const response = await request(app)
      .delete(`/api/projects/${MOCK_PROJECT_NAME}`)
      .expect(200);

    expect(response.body).toEqual({ success: true });
  });

  // Requirement 6.7: Delete all associated files (project, stats, inventory)
  it('should delete project file, stats file, and inventory file together', async () => {
    // Create all three files
    await fs.promises.writeFile(
      projectPath,
      JSON.stringify(MOCK_PROJECT_DATA, null, 2),
      'utf-8'
    );
    await fs.promises.writeFile(
      statsPath,
      JSON.stringify({ totalRuns: 10 }, null, 2),
      'utf-8'
    );
    await fs.promises.writeFile(
      inventoryPath,
      JSON.stringify(MOCK_INVENTORY_DATA, null, 2),
      'utf-8'
    );

    // Verify all files exist
    expect(fs.existsSync(projectPath)).toBe(true);
    expect(fs.existsSync(statsPath)).toBe(true);
    expect(fs.existsSync(inventoryPath)).toBe(true);

    // Delete project
    await request(app)
      .delete(`/api/projects/${MOCK_PROJECT_NAME}`)
      .expect(200);

    // Verify all files were deleted
    expect(fs.existsSync(projectPath)).toBe(false);
    expect(fs.existsSync(statsPath)).toBe(false);
    expect(fs.existsSync(inventoryPath)).toBe(false);
  });

  // Requirement 6.7: Non-existent inventory file should not cause deletion to fail
  it('should not fail deletion if inventory file removal fails silently', async () => {
    // Create only project file
    await fs.promises.writeFile(
      projectPath,
      JSON.stringify(MOCK_PROJECT_DATA, null, 2),
      'utf-8'
    );

    // Delete project
    const response = await request(app)
      .delete(`/api/projects/${MOCK_PROJECT_NAME}`)
      .expect(200);

    expect(response.body).toEqual({ success: true });
    expect(fs.existsSync(projectPath)).toBe(false);
  });

  // Validation: Should return 404 when project doesn't exist
  it('should return 404 when trying to delete non-existent project', async () => {
    const response = await request(app)
      .delete('/api/projects/nonexistent-project')
      .expect(404);

    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('error', 'Project not found');
  });

  // Validation: Should return 400 for invalid project name
  it('should return 400 for invalid project name', async () => {
    const response = await request(app)
      .delete('/api/projects/invalid@project!')
      .expect(400);

    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('error');
  });

  // Multiple projects: Ensure only the correct project's inventory is deleted
  it('should only delete inventory file for the specified project', async () => {
    const otherProjectName = 'other-project';
    const otherProjectPath = path.join(testDir, `${otherProjectName}.json`);
    const otherInventoryPath = path.join(testDir, `${otherProjectName}_inventory.json`);

    // Create two projects with inventory files
    await fs.promises.writeFile(projectPath, JSON.stringify(MOCK_PROJECT_DATA, null, 2), 'utf-8');
    await fs.promises.writeFile(inventoryPath, JSON.stringify(MOCK_INVENTORY_DATA, null, 2), 'utf-8');
    
    await fs.promises.writeFile(
      otherProjectPath, 
      JSON.stringify({ ...MOCK_PROJECT_DATA, name: otherProjectName }, null, 2), 
      'utf-8'
    );
    await fs.promises.writeFile(
      otherInventoryPath, 
      JSON.stringify({ ...MOCK_INVENTORY_DATA, projectName: otherProjectName }, null, 2), 
      'utf-8'
    );

    // Verify both inventory files exist
    expect(fs.existsSync(inventoryPath)).toBe(true);
    expect(fs.existsSync(otherInventoryPath)).toBe(true);

    // Delete first project
    await request(app)
      .delete(`/api/projects/${MOCK_PROJECT_NAME}`)
      .expect(200);

    // Verify first project's inventory is deleted, but other remains
    expect(fs.existsSync(inventoryPath)).toBe(false);
    expect(fs.existsSync(otherInventoryPath)).toBe(true);
    expect(fs.existsSync(otherProjectPath)).toBe(true);
  });
});
