import { Router } from 'express';
import {
  getBrowserEnv,
  openBrowser,
  closeBrowser,
  getBrowserStatus,
  getProfiles,
  getProxies,
  getPageSource,
  evalPageScript,
  evalContextAction
} from '../controllers/browserController';
import { authMiddleware } from '../auth/AuthMiddleware';
import { csrfMiddleware } from '../auth/CSRFMiddleware';

const router = Router();

router.get('/api/browser-env', authMiddleware, getBrowserEnv);
router.post('/api/browser/open/:projectName', authMiddleware, csrfMiddleware, openBrowser);
router.post('/api/browser/close/:projectName', authMiddleware, csrfMiddleware, closeBrowser);
router.get('/api/browser/status/:projectName', authMiddleware, getBrowserStatus);
router.get('/api/browser/page-source/:projectName', authMiddleware, getPageSource);
router.get('/api/browser/page-source', authMiddleware, getPageSource);
router.post('/api/browser/eval/:projectName', evalPageScript);
router.post('/api/browser/context/:projectName', evalContextAction);

// Profiles and Proxies endpoints (підтримка як /api/itbrowser/* для сумісності з UI, так і нових /api/*)
router.get('/api/itbrowser/profiles', authMiddleware, getProfiles);
router.get('/api/itbrowser/proxies', authMiddleware, getProxies);
router.get('/api/browser/profiles', authMiddleware, getProfiles);
router.get('/api/browser/proxies', authMiddleware, getProxies);

export default router;
