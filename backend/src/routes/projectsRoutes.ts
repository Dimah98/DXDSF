import { Router } from 'express';
import {
  getProjects,
  getProjectsOverview,
  getProjectsStatus,
  getProjectContainers,
  getProjectRuns,
  getProjectRunLogs,
  getProject,
  loadProject,
  saveProject,
  deleteProjectHandler,
  runMultipleProjects,
  stopMultipleProjects,
  copyNodes,
  runSequentialProjects
} from '../controllers/projectsController';
import { authMiddleware } from '../auth/AuthMiddleware';
import { csrfMiddleware } from '../auth/CSRFMiddleware';
import { runMultipleRateLimiter } from '../auth/RateLimiter';

const router = Router();

// Projects listing & status
router.get('/api/projects', authMiddleware, getProjects);
router.get('/api/projects/overview', authMiddleware, getProjectsOverview);
router.get('/api/projects/status', authMiddleware, getProjectsStatus);

// Specific project metadata & history
router.get('/api/projects/:projectName/containers', authMiddleware, getProjectContainers);
router.get('/api/projects/:name/runs', authMiddleware, getProjectRuns);
router.get('/api/projects/:name/runs/:runId/logs', authMiddleware, getProjectRunLogs);
router.get('/api/projects/:name', authMiddleware, getProject);

// Project loading & saving
router.get('/api/load', authMiddleware, loadProject);
router.post('/api/save', authMiddleware, csrfMiddleware, saveProject);
router.delete('/api/projects/:name', authMiddleware, csrfMiddleware, deleteProjectHandler);

// Batch operations
router.post('/api/projects/run-multiple', authMiddleware, csrfMiddleware, runMultipleRateLimiter, runMultipleProjects);
router.post('/api/projects/stop-multiple', authMiddleware, csrfMiddleware, stopMultipleProjects);
router.post('/api/projects/copy-nodes', authMiddleware, copyNodes);
router.post('/api/projects/run-sequential', authMiddleware, runSequentialProjects);

export default router;
