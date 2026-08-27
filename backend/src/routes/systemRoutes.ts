import { Router } from 'express';
import { getHealth, getSystemStatus } from '../controllers/systemController';
import { authMiddleware } from '../auth/AuthMiddleware';

const router = Router();

// /health endpoint (no auth required for health check probes)
router.get('/health', getHealth);

// /api/system/status endpoint (authenticated)
router.get('/api/system/status', authMiddleware, getSystemStatus);

export default router;
