import { Request, Response } from 'express';
import { Logger } from '../logger';
import { notificationService } from '../services';

const logger = new Logger('NotificationsController');

export async function getNotifications(req: Request, res: Response): Promise<void> {
  try {
    const projectQuery = req.query.project || req.query.projects;
    let projectNames: string[] | undefined;
    if (typeof projectQuery === 'string' && projectQuery.trim().length > 0) {
      projectNames = projectQuery.split(',').map(p => p.trim()).filter(Boolean);
    }

    const notifications = notificationService.getAll(projectNames);
    const unreadCount = notificationService.getUnreadCount(projectNames);

    res.json({
      notifications,
      unreadCount
    });
  } catch (err: any) {
    logger.error('Error fetching notifications', err instanceof Error ? err : new Error(String(err)));
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
}

export async function createNotification(req: Request, res: Response): Promise<void> {
  try {
    const { projectName = 'default', message } = req.body;
    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    const notification = notificationService.add(projectName, message);
    res.status(201).json({
      success: true,
      notification
    });
  } catch (err: any) {
    logger.error('Error creating notification', err instanceof Error ? err : new Error(String(err)));
    res.status(500).json({ error: 'Failed to create notification' });
  }
}

export async function markNotificationRead(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: 'Notification ID is required' });
      return;
    }

    notificationService.markAsRead(id);
    res.json({ success: true, message: 'Notification marked as read' });
  } catch (err: any) {
    logger.error(`Error marking notification read ${req.params.id}`, err instanceof Error ? err : new Error(String(err)));
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
}

export async function markAllNotificationsRead(req: Request, res: Response): Promise<void> {
  try {
    const projectQuery = req.query.project || req.query.projects || req.body?.projects;
    let projectNames: string[] | undefined;
    if (typeof projectQuery === 'string' && projectQuery.trim().length > 0) {
      projectNames = projectQuery.split(',').map(p => p.trim()).filter(Boolean);
    } else if (Array.isArray(projectQuery)) {
      projectNames = projectQuery.map(String).map(p => p.trim()).filter(Boolean);
    }

    notificationService.markAllAsRead(projectNames);
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (err: any) {
    logger.error('Error marking all notifications read', err instanceof Error ? err : new Error(String(err)));
    res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
}

export async function deleteNotification(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: 'Notification ID is required' });
      return;
    }

    notificationService.delete(id);
    res.json({ success: true, message: 'Notification deleted' });
  } catch (err: any) {
    logger.error(`Error deleting notification ${req.params.id}`, err instanceof Error ? err : new Error(String(err)));
    res.status(500).json({ error: 'Failed to delete notification' });
  }
}

export async function deleteAllNotifications(req: Request, res: Response): Promise<void> {
  try {
    const projectQuery = req.query.project || req.query.projects || req.body?.projects;
    let projectNames: string[] | undefined;
    if (typeof projectQuery === 'string' && projectQuery.trim().length > 0) {
      projectNames = projectQuery.split(',').map(p => p.trim()).filter(Boolean);
    } else if (Array.isArray(projectQuery)) {
      projectNames = projectQuery.map(String).map(p => p.trim()).filter(Boolean);
    }

    notificationService.deleteAll(projectNames);
    res.json({ success: true, message: 'All notifications deleted' });
  } catch (err: any) {
    logger.error('Error deleting all notifications', err instanceof Error ? err : new Error(String(err)));
    res.status(500).json({ error: 'Failed to delete all notifications' });
  }
}
