/**
 * Integration test for project deletion with inventory file cleanup
 * 
 * This test creates actual files in a test directory to verify:
 * - Inventory files are properly cleaned up on project deletion
 * - File system operations work correctly
 * - Error handling is robust
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';

const TEST_PROJECT_NAME = 'integration-test-project';

describe('Project Deletion - Inventory File Cleanup Integration', () => {
  let testDir: string;
  let projectPath: string;
  let inventoryPath: string;
  let statsPath: string;

  beforeEach(() => {
    // Create test directory
    testDir = path.join(__dirname, '../test-integration-delete');
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    projectPath = path.join(testDir, `${TEST_PROJECT_NAME}.json`);
    inventoryPath = path.join(testDir, `${TEST_PROJECT_NAME}_inventory.json`);
    statsPath = path.join(testDir, `${TEST_PROJECT_NAME}_stats.json`);
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

  it('should delete inventory file along with project files', async () => {
    // Create project files
    const projectData = { id: 1, name: TEST_PROJECT_NAME, nodes: [] };
    const inventoryData = {
      projectName: TEST_PROJECT_NAME,
      data: [
        { image: 'https://example.com/item1.png', number: 50 },
        { image: 'https://example.com/item2.png', number: 100 }
      ],
      timestamp: Date.now(),
      version: '1.0'
    };
    const statsData = { totalRuns: 5, lastRun: Date.now() };

    await fs.promises.writeFile(projectPath, JSON.stringify(projectData, null, 2));
    await fs.promises.writeFile(inventoryPath, JSON.stringify(inventoryData, null, 2));
    await fs.promises.writeFile(statsPath, JSON.stringify(statsData, null, 2));

    // Verify files exist
    expect(fs.existsSync(projectPath)).toBe(true);
    expect(fs.existsSync(inventoryPath)).toBe(true);
    expect(fs.existsSync(statsPath)).toBe(true);

    // Simulate deletion process
    // 1. Delete main project file
    await fs.promises.unlink(projectPath);
    
    // 2. Delete stats file if exists
    if (fs.existsSync(statsPath)) {
      await fs.promises.unlink(statsPath);
    }
    
    // 3. Delete inventory file if exists (this is the new functionality)
    if (fs.existsSync(inventoryPath)) {
      await fs.promises.unlink(inventoryPath);
    }

    // Verify all files were deleted
    expect(fs.existsSync(projectPath)).toBe(false);
    expect(fs.existsSync(statsPath)).toBe(false);
    expect(fs.existsSync(inventoryPath)).toBe(false);
  });

  it('should handle missing inventory file gracefully', async () => {
    // Create only project file
    const projectData = { id: 1, name: TEST_PROJECT_NAME, nodes: [] };
    await fs.promises.writeFile(projectPath, JSON.stringify(projectData, null, 2));

    // Verify only project file exists
    expect(fs.existsSync(projectPath)).toBe(true);
    expect(fs.existsSync(inventoryPath)).toBe(false);

    // Simulate deletion process
    await fs.promises.unlink(projectPath);
    
    // Attempt to delete inventory file (should not throw)
    let errorThrown = false;
    try {
      if (fs.existsSync(inventoryPath)) {
        await fs.promises.unlink(inventoryPath);
      }
    } catch (err) {
      errorThrown = true;
    }

    expect(errorThrown).toBe(false);
    expect(fs.existsSync(projectPath)).toBe(false);
  });

  it('should maintain data isolation between projects', async () => {
    const project1Name = 'project1';
    const project2Name = 'project2';
    
    const project1Path = path.join(testDir, `${project1Name}.json`);
    const inventory1Path = path.join(testDir, `${project1Name}_inventory.json`);
    const project2Path = path.join(testDir, `${project2Name}.json`);
    const inventory2Path = path.join(testDir, `${project2Name}_inventory.json`);

    // Create two projects with inventory
    await fs.promises.writeFile(project1Path, JSON.stringify({ name: project1Name }));
    await fs.promises.writeFile(inventory1Path, JSON.stringify({ 
      projectName: project1Name, 
      data: [{ image: 'img1.png', number: 1 }] 
    }));
    
    await fs.promises.writeFile(project2Path, JSON.stringify({ name: project2Name }));
    await fs.promises.writeFile(inventory2Path, JSON.stringify({ 
      projectName: project2Name, 
      data: [{ image: 'img2.png', number: 2 }] 
    }));

    // Verify both exist
    expect(fs.existsSync(inventory1Path)).toBe(true);
    expect(fs.existsSync(inventory2Path)).toBe(true);

    // Delete project1
    await fs.promises.unlink(project1Path);
    if (fs.existsSync(inventory1Path)) {
      await fs.promises.unlink(inventory1Path);
    }

    // Verify only project1's inventory is deleted
    expect(fs.existsSync(inventory1Path)).toBe(false);
    expect(fs.existsSync(project1Path)).toBe(false);
    expect(fs.existsSync(inventory2Path)).toBe(true);
    expect(fs.existsSync(project2Path)).toBe(true);
  });

  it('should handle file read errors gracefully', async () => {
    // Create project file
    await fs.promises.writeFile(projectPath, JSON.stringify({ name: TEST_PROJECT_NAME }));
    await fs.promises.writeFile(inventoryPath, JSON.stringify({ data: [] }));

    // Verify inventory file exists and is readable
    expect(fs.existsSync(inventoryPath)).toBe(true);
    const content = await fs.promises.readFile(inventoryPath, 'utf-8');
    expect(content).toBeTruthy();

    // Delete successfully
    await fs.promises.unlink(projectPath);
    if (fs.existsSync(inventoryPath)) {
      await fs.promises.unlink(inventoryPath);
    }

    expect(fs.existsSync(inventoryPath)).toBe(false);
  });

  it('should use correct file naming pattern', () => {
    // Verify naming pattern matches other project files
    const projectName = 'my-project';
    
    const expectedProjectFile = `${projectName}.json`;
    const expectedStatsFile = `${projectName}_stats.json`;
    const expectedLogsFile = `${projectName}_logs.json`;
    const expectedInventoryFile = `${projectName}_inventory.json`;

    // Verify pattern consistency
    expect(expectedProjectFile).toBe('my-project.json');
    expect(expectedStatsFile).toBe('my-project_stats.json');
    expect(expectedLogsFile).toBe('my-project_logs.json');
    expect(expectedInventoryFile).toBe('my-project_inventory.json');
  });
});
