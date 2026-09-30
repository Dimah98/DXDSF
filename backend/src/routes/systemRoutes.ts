import { Router } from 'express';
import { getHealth, getSystemStatus, restartBackend, getErrorMetricsHandler } from '../controllers/systemController';
import { authMiddleware } from '../auth/AuthMiddleware';

const router = Router();

// /health endpoint (no auth required for health check probes)
router.get('/health', getHealth);

// /api/system/status endpoint (authenticated)
router.get('/api/system/status', authMiddleware, getSystemStatus);

// /api/system/error-metrics endpoint (authenticated)
router.get('/api/system/error-metrics', authMiddleware, getErrorMetricsHandler);

// /api/system/restart endpoint
router.post('/api/system/restart', restartBackend);

export default router;
