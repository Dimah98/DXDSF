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
  // Приватне поле для збереження функції зворотного виклику при додаванні сповіщення
  private onNotificationAdded?: (projectName: string, message: string) => void;
  // Шлях до файлу збереження сповіщень
  private filePath: string;
  // Максимальна кількість збережених сповіщень у системі
  private maxNotifications = 500;

  // Конструктор класу з підтримкою необов'язкового зворотного виклику
  constructor(projectsDir: string, onNotificationAdded?: (projectName: string, message: string) => void) {
    // Встановлюємо шлях до файлу notifications.json
    this.filePath = path.join(projectsDir, 'notifications.json');
    // Зберігаємо функцію зворотного виклику в приватне поле класу
    this.onNotificationAdded = onNotificationAdded;
    // Завантажуємо раніше збережені сповіщення з файлу на диску
    this.load();
  }

  // Приватний метод для завантаження сповіщень з файлу
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

  // Приватний метод для збереження сповіщень у файл
  private save(): void {
    this.cleanup();
    fs.promises.writeFile(this.filePath, JSON.stringify({ notifications: this.notifications }, null, 2), 'utf-8')
      .catch(err => {
        console.error('Помилка збереження notifications.json:', err);
      });
  }

  // Приватний метод для обмеження кількості збережених сповіщень
  private cleanup(): void {
    if (this.notifications.length > this.maxNotifications) {
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
    
    if (this.onNotificationAdded) {
      this.onNotificationAdded(projectName, message);
    }

    return notification;
  }

  public getAll(projectNames?: string[]): Notification[] {
    let filtered = this.notifications;
    if (projectNames && projectNames.length > 0) {
      filtered = filtered.filter(n => projectNames.includes(n.projectName));
    }
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

  public deleteAll(projectNames?: string[]): void {
    if (!projectNames || projectNames.length === 0) {
      this.notifications = [];
    } else {
      this.notifications = this.notifications.filter(n => !projectNames.includes(n.projectName));
    }
    this.save();
  }

  public getUnreadCount(projectNames?: string[]): number {
    let unread = this.notifications.filter(n => !n.read);
    if (projectNames && projectNames.length > 0) {
      unread = unread.filter(n => projectNames.includes(n.projectName));
    }
    return unread.length;
  }
}
