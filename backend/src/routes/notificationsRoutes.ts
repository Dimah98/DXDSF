import { Router } from 'express';
import {
  getNotifications,
  createNotification,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  deleteAllNotifications
} from '../controllers/notificationsController';
import { authMiddleware } from '../auth/AuthMiddleware';
import { csrfMiddleware } from '../auth/CSRFMiddleware';

const router = Router();

router.get('/api/notifications', authMiddleware, getNotifications);
router.post('/api/notifications', authMiddleware, csrfMiddleware, createNotification);
router.put('/api/notifications/read-all', authMiddleware, csrfMiddleware, markAllNotificationsRead);
router.put('/api/notifications/:id/read', authMiddleware, csrfMiddleware, markNotificationRead);
router.delete('/api/notifications/:id', authMiddleware, csrfMiddleware, deleteNotification);
router.delete('/api/notifications', authMiddleware, csrfMiddleware, deleteAllNotifications);

export default router;
