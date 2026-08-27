import { Router } from 'express';
import {
  getProjectSave,
  getProjectMap,
  saveProjectMap,
  deleteProjectMap,
  getProjectDeliveries
} from '../controllers/projectDataController';
import { authMiddleware } from '../auth/AuthMiddleware';

const router = Router();

router.get('/api/project-save/:projectName', authMiddleware, getProjectSave);
router.get('/api/project-map/:projectName', authMiddleware, getProjectMap);
router.post('/api/project-map/:projectName', authMiddleware, saveProjectMap);
router.delete('/api/project-map/:projectName', authMiddleware, deleteProjectMap);
router.get('/api/deliveries/:projectName', authMiddleware, getProjectDeliveries);

export default router;
