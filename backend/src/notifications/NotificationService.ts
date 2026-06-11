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
    // Перевіряємо чи існує файл за вказаним шляхом
    if (fs.existsSync(this.filePath)) {
      try {
        // Читаємо вміст файлу у кодуванні utf-8
        const data = fs.readFileSync(this.filePath, 'utf-8');
        // Розбираємо JSON-дані у об'єкт
        const parsed = JSON.parse(data);
        // Перевіряємо наявність та тип масиву сповіщень
        if (parsed.notifications && Array.isArray(parsed.notifications)) {
          // Записуємо завантажені сповіщення у внутрішній масив класу
          this.notifications = parsed.notifications;
        }
      } catch (err) {
        // Виводимо помилку читання файлу в консоль сервера
        console.error('Помилка читання notifications.json:', err);
      }
    }
  }

  // Приватний метод для збереження сповіщень у файл
  private save(): void {
    try {
      // Очищуємо застарілі сповіщення перед збереженням
      this.cleanup();
      // Записуємо оновлений масив сповіщень у файл із відступами для читабельності
      fs.writeFileSync(this.filePath, JSON.stringify({ notifications: this.notifications }, null, 2), 'utf-8');
    } catch (err) {
      // Виводимо помилку збереження у консоль сервера
      console.error('Помилка збереження notifications.json:', err);
    }
  }

  // Приватний метод для обмеження кількості збережених сповіщень
  private cleanup(): void {
    // Якщо розмір перевищує ліміт
    if (this.notifications.length > this.maxNotifications) {
      // Обрізаємо масив, залишаючи лише останні записи
      this.notifications = this.notifications.slice(-this.maxNotifications);
    }
  }

  // Публічний метод для створення та додавання нового сповіщення
  public add(projectName: string, message: string): Notification {
    // Формуємо об'єкт нового сповіщення
    const notification: Notification = {
      // Генеруємо унікальний ідентифікатор сповіщення
      id: Date.now().toString() + Math.floor(Math.random() * 1000).toString(),
      // Зберігаємо назву проекту, що надіслав сповіщення
      projectName,
      // Текст самого сповіщення
      message,
      // Часова мітка створення сповіщення
      timestamp: Date.now(),
      // Встановлюємо початковий стан прочитання як хибний
      read: false
    };
    
    // Додаємо створене сповіщення до внутрішнього масиву
    this.notifications.push(notification);
    // Зберігаємо оновлений масив сповіщень у файл
    this.save();
    
    // Якщо задано функцію зворотного виклику для логування
    if (this.onNotificationAdded) {
      // Викликаємо її для запису сповіщення у лог-файл відповідного проекту
      this.onNotificationAdded(projectName, message);
    }

    // Повертаємо об'єкт створеного сповіщення
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
