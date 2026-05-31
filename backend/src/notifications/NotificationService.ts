import fs from 'fs';
import path from 'path';

export interface Notification {
  id: string;
  projectName: string;
  message: string;
  timestamp: number;
  read: boolean;
}

export class NotificationService {
  private notifications: Notification[] = [];
  private filePath: string;
  private maxNotifications = 500;

  constructor(projectsDir: string) {
    this.filePath = path.join(projectsDir, 'notifications.json');
    this.load();
  }

  private load(): void {
    if (fs.existsSync(this.filePath)) {
      try {
        const data = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(data);
        if (parsed.notifications && Array.isArray(parsed.notifications)) {
          this.notifications = parsed.notifications;
        }
      } catch (err) {
        console.error('Помилка читання notifications.json:', err);
      }
    }
  }

  private save(): void {
    try {
      this.cleanup();
      fs.writeFileSync(this.filePath, JSON.stringify({ notifications: this.notifications }, null, 2), 'utf-8');
    } catch (err) {
      console.error('Помилка збереження notifications.json:', err);
    }
  }

  private cleanup(): void {
    if (this.notifications.length > this.maxNotifications) {
      // Залишаємо останні maxNotifications
      this.notifications = this.notifications.slice(-this.maxNotifications);
    }
  }

  public add(projectName: string, message: string): Notification {
    const notification: Notification = {
      id: Date.now().toString() + Math.floor(Math.random() * 1000).toString(),
      projectName,
      message,
      timestamp: Date.now(),
      read: false
    };
    
    this.notifications.push(notification);
    this.save();
    return notification;
  }

  public getAll(projectNames?: string[]): Notification[] {
    let filtered = this.notifications;
    if (projectNames && projectNames.length > 0) {
      filtered = filtered.filter(n => projectNames.includes(n.projectName));
    }
    // Сортуємо від найновіших до найстаріших
    return [...filtered].sort((a, b) => b.timestamp - a.timestamp);
  }

  public markAsRead(id: string): void {
    const notif = this.notifications.find(n => n.id === id);
    if (notif) {
      notif.read = true;
      this.save();
    }
  }

  public markAllAsRead(projectNames?: string[]): void {
    let changed = false;
    for (const notif of this.notifications) {
      if (!notif.read) {
        if (!projectNames || projectNames.length === 0 || projectNames.includes(notif.projectName)) {
          notif.read = true;
          changed = true;
        }
      }
    }
    if (changed) {
      this.save();
    }
  }

  public delete(id: string): void {
    const initialLength = this.notifications.length;
    this.notifications = this.notifications.filter(n => n.id !== id);
    if (this.notifications.length !== initialLength) {
      this.save();
    }
  }

  public getUnreadCount(projectNames?: string[]): number {
    let unread = this.notifications.filter(n => !n.read);
    if (projectNames && projectNames.length > 0) {
      unread = unread.filter(n => projectNames.includes(n.projectName));
    }
    return unread.length;
  }
}
