import { Router } from 'express';
import {
  getGlobalConfig,
  updateGlobalConfig,
  getAllConfigs,
  getConfigById,
  createConfig,
  updateConfig,
  deleteConfig,
  getMatchingProjects
} from '../controllers/configsController';
import { authMiddleware } from '../auth/AuthMiddleware';
import { csrfMiddleware } from '../auth/CSRFMiddleware';

const router = Router();

router.get('/api/config', getGlobalConfig);
router.put('/api/config', authMiddleware, csrfMiddleware, updateGlobalConfig);

router.get('/api/configs', authMiddleware, getAllConfigs);
router.get('/api/configs/:id', authMiddleware, getConfigById);
router.post('/api/configs', authMiddleware, createConfig);
router.put('/api/configs/:id', authMiddleware, updateConfig);
router.delete('/api/configs/:id', authMiddleware, deleteConfig);
router.get('/api/configs/:id/matching-projects', authMiddleware, getMatchingProjects);

export default router;
