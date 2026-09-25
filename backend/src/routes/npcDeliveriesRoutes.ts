import { Router } from 'express';
import {
  getNpcDeliveries,
  getDeliverySettings,
  saveDeliverySettings,
  testDeliveryConfig,
} from '../controllers/npcDeliveriesController';
import { authMiddleware } from '../auth/AuthMiddleware';

const router = Router();

router.get('/api/npc-deliveries', authMiddleware, getNpcDeliveries);
router.get('/api/npc-deliveries/settings', authMiddleware, getDeliverySettings);
router.post('/api/npc-deliveries/settings', authMiddleware, saveDeliverySettings);
router.post('/api/npc-deliveries/test-config', authMiddleware, testDeliveryConfig);

export default router;
