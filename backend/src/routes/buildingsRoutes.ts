import { Router } from 'express';
import {
  getBuildingsCatalogHandler,
  saveBuildingsCatalogHandler,
  getProjectBuildingsStatusHandler
} from '../controllers/buildingsController';
import { authMiddleware } from '../auth/AuthMiddleware';
import { csrfMiddleware } from '../auth/CSRFMiddleware';

const router = Router();

router.get('/api/buildings-catalog', authMiddleware, getBuildingsCatalogHandler);
router.post('/api/buildings-catalog', authMiddleware, csrfMiddleware, saveBuildingsCatalogHandler);
router.get('/api/projects/:projectName/buildings-status', authMiddleware, getProjectBuildingsStatusHandler);

export default router;
