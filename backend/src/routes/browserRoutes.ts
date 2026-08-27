import { Router } from 'express';
import {
  getBrowserEnv,
  openBrowser,
  closeBrowser,
  getBrowserStatus
} from '../controllers/browserController';
import { authMiddleware } from '../auth/AuthMiddleware';
import { csrfMiddleware } from '../auth/CSRFMiddleware';

const router = Router();

router.get('/api/browser-env', authMiddleware, getBrowserEnv);
router.post('/api/browser/open/:projectName', authMiddleware, csrfMiddleware, openBrowser);
router.post('/api/browser/close/:projectName', authMiddleware, csrfMiddleware, closeBrowser);
router.get('/api/browser/status/:projectName', authMiddleware, getBrowserStatus);

export default router;
