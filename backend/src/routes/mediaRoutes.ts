import { Router } from 'express';
import {
  getImages,
  getScreenshots,
  deleteScreenshot
} from '../controllers/mediaController';
import { authMiddleware } from '../auth/AuthMiddleware';
import { csrfMiddleware } from '../auth/CSRFMiddleware';

const router = Router();

router.get('/api/images', authMiddleware, getImages);
router.get('/api/screenshots/:projectName', authMiddleware, getScreenshots);
router.delete('/api/screenshots/:projectName/:filename', authMiddleware, csrfMiddleware, deleteScreenshot);

export default router;
