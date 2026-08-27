import { Router } from 'express';
import {
  getInventoryOverview,
  getInventoryCategories,
  saveInventoryCategories,
  getProjectInventory
} from '../controllers/inventoryController';
import { authMiddleware } from '../auth/AuthMiddleware';

const router = Router();

router.get('/api/inventory/overview', authMiddleware, getInventoryOverview);
router.get('/api/inventory/categories', authMiddleware, getInventoryCategories);
router.post('/api/inventory/categories', authMiddleware, saveInventoryCategories);
router.get('/api/inventory/:projectName', authMiddleware, getProjectInventory);

export default router;
