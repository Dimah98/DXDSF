import { Router } from 'express';
import { getGlobalStats, getProjectStatsHandler } from '../controllers/statsController';
import { authMiddleware } from '../auth/AuthMiddleware';

const router = Router();

router.get('/api/global-stats', authMiddleware, getGlobalStats);
router.get('/api/stats/:name', authMiddleware, getProjectStatsHandler);

export default router;
