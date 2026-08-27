import { describe, it, expect } from 'vitest';
import routes from './index';
import * as systemController from '../controllers/systemController';
import * as projectsController from '../controllers/projectsController';
import * as logsController from '../controllers/logsController';
import * as statsController from '../controllers/statsController';
import * as inventoryController from '../controllers/inventoryController';
import * as configsController from '../controllers/configsController';
import * as massLaunchesController from '../controllers/massLaunchesController';
import * as projectDataController from '../controllers/projectDataController';
import * as browserController from '../controllers/browserController';
import * as mediaController from '../controllers/mediaController';
import * as projectRunner from '../runner/ProjectRunner';
import * as massLaunchRunner from '../runner/MassLaunchRunner';
import * as wsModule from '../websocket';

describe('Decomposed Routes & Controllers Integrity', () => {
  it('should export an Express router instance', () => {
    expect(routes).toBeDefined();
    expect(typeof routes).toBe('function');
  });

  it('should export all system controller handlers', () => {
    expect(typeof systemController.getHealth).toBe('function');
    expect(typeof systemController.getSystemStatus).toBe('function');
  });

  it('should export all project controller handlers', () => {
    expect(typeof projectsController.getProjects).toBe('function');
    expect(typeof projectsController.getProject).toBe('function');
    expect(typeof projectsController.getProjectContainers).toBe('function');
    expect(typeof projectsController.getProjectsStatus).toBe('function');
    expect(typeof projectsController.getProjectRuns).toBe('function');
    expect(typeof projectsController.getProjectRunLogs).toBe('function');
    expect(typeof projectsController.loadProject).toBe('function');
    expect(typeof projectsController.saveProject).toBe('function');
    expect(typeof projectsController.deleteProjectHandler).toBe('function');
    expect(typeof projectsController.runMultipleProjects).toBe('function');
    expect(typeof projectsController.stopMultipleProjects).toBe('function');
    expect(typeof projectsController.copyNodes).toBe('function');
    expect(typeof projectsController.runSequentialProjects).toBe('function');
  });

  it('should export all logs controller handlers', () => {
    expect(typeof logsController.getProjectLogs).toBe('function');
    expect(typeof logsController.saveProjectLogs).toBe('function');
    expect(typeof logsController.deleteProjectLogs).toBe('function');
  });

  it('should export all stats controller handlers', () => {
    expect(typeof statsController.getGlobalStats).toBe('function');
    expect(typeof statsController.getProjectStatsHandler).toBe('function');
  });

  it('should export all inventory controller handlers', () => {
    expect(typeof inventoryController.getInventoryOverview).toBe('function');
    expect(typeof inventoryController.getInventoryCategories).toBe('function');
    expect(typeof inventoryController.saveInventoryCategories).toBe('function');
    expect(typeof inventoryController.getProjectInventory).toBe('function');
  });

  it('should export all configs controller handlers', () => {
    expect(typeof configsController.getGlobalConfig).toBe('function');
    expect(typeof configsController.updateGlobalConfig).toBe('function');
    expect(typeof configsController.getAllConfigs).toBe('function');
    expect(typeof configsController.getConfigById).toBe('function');
    expect(typeof configsController.createConfig).toBe('function');
    expect(typeof configsController.updateConfig).toBe('function');
    expect(typeof configsController.deleteConfig).toBe('function');
    expect(typeof configsController.getMatchingProjects).toBe('function');
  });

  it('should export all mass launches controller handlers', () => {
    expect(typeof massLaunchesController.getMassLaunches).toBe('function');
    expect(typeof massLaunchesController.createMassLaunch).toBe('function');
    expect(typeof massLaunchesController.updateMassLaunch).toBe('function');
    expect(typeof massLaunchesController.deleteMassLaunch).toBe('function');
    expect(typeof massLaunchesController.previewMassLaunchTime).toBe('function');
  });

  it('should export all project data controller handlers', () => {
    expect(typeof projectDataController.getProjectSave).toBe('function');
    expect(typeof projectDataController.getProjectMap).toBe('function');
    expect(typeof projectDataController.saveProjectMap).toBe('function');
    expect(typeof projectDataController.deleteProjectMap).toBe('function');
    expect(typeof projectDataController.getProjectDeliveries).toBe('function');
  });

  it('should export all browser controller handlers', () => {
    expect(typeof browserController.getBrowserEnv).toBe('function');
    expect(typeof browserController.openBrowser).toBe('function');
    expect(typeof browserController.closeBrowser).toBe('function');
    expect(typeof browserController.getBrowserStatus).toBe('function');
  });

  it('should export all media controller handlers', () => {
    expect(typeof mediaController.getImages).toBe('function');
    expect(typeof mediaController.getScreenshots).toBe('function');
    expect(typeof mediaController.deleteScreenshot).toBe('function');
  });

  it('should export ProjectRunner methods & singleton queue manager', () => {
    expect(typeof projectRunner.startProject).toBe('function');
    expect(typeof projectRunner.executeProjectInternal).toBe('function');
    expect(typeof projectRunner.stopProject).toBe('function');
    expect(typeof projectRunner.executeNodeLogic).toBe('function');
    expect(typeof projectRunner.smartSleep).toBe('function');
    expect(projectRunner.projectQueueManager).toBeDefined();
    expect(typeof projectRunner.projectQueueManager.enqueue).toBe('function');
  });

  it('should export MassLaunchRunner methods & scheduler controls', () => {
    expect(typeof massLaunchRunner.checkAndRunMassLaunches).toBe('function');
    expect(typeof massLaunchRunner.startMassLaunchScheduler).toBe('function');
    expect(typeof massLaunchRunner.stopMassLaunchScheduler).toBe('function');
    expect(typeof massLaunchRunner.parseTimeInfo).toBe('function');
  });

  it('should export WebSocket server setup function', () => {
    expect(typeof wsModule.setupWebSocketServer).toBe('function');
  });
});
