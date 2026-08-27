import { Router } from 'express';
import { getProjectLogs, saveProjectLogs, deleteProjectLogs } from '../controllers/logsController';
import { authMiddleware } from '../auth/AuthMiddleware';
import { csrfMiddleware } from '../auth/CSRFMiddleware';

const router = Router();

router.get('/api/logs/:project', authMiddleware, getProjectLogs);
router.post('/api/logs/:project', authMiddleware, saveProjectLogs);
router.delete('/api/logs/:project', authMiddleware, csrfMiddleware, deleteProjectLogs);

export default router;
