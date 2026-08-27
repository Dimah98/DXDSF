import { Router } from 'express';
import {
  getMassLaunches,
  createMassLaunch,
  updateMassLaunch,
  deleteMassLaunch,
  previewMassLaunchTime
} from '../controllers/massLaunchesController';
import { authMiddleware } from '../auth/AuthMiddleware';

const router = Router();

router.get('/api/mass-launches', authMiddleware, getMassLaunches);
router.post('/api/mass-launches', authMiddleware, createMassLaunch);
router.put('/api/mass-launches/:id', authMiddleware, updateMassLaunch);
router.delete('/api/mass-launches/:id', authMiddleware, deleteMassLaunch);
router.get('/api/mass-launches/preview-time', authMiddleware, previewMassLaunchTime);

export default router;
