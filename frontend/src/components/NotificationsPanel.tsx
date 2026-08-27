import React, { useState, useEffect } from 'react';
import { Bell, Trash2, CheckCircle2 } from 'lucide-react';

interface Notification {
  id: string;
  projectName: string;
  message: string;
  timestamp: number;
  read: boolean;
}

// Оголошуємо інтерфейс для пропсів компонента NotificationsPanel
interface NotificationsPanelProps {
  // Чи є панель сповіщень активною/видимою у даний момент
  isActive: boolean;
  // Назва поточного проекту (залишено для сумісності з пропсами)
  projectName: string;
}

import { useUIStore } from '../store/useUIStore';

// Головна функція компонента NotificationsPanel з типом пропсів
export function NotificationsPanel({ isActive, projectName }: NotificationsPanelProps) {
  // Стейт для зберігання списку сповіщень усіх проектів
  const [notifications, setNotifications] = useState<Notification[]>([]);
  // Стейт для зберігання загальної кількості непрочитаних сповіщень
  const [unreadCount, setUnreadCount] = useState(0);

  // Асинхронна функція для завантаження всіх сповіщень через спільний API ендпоінт
  const fetchNotifications = async () => {
    try {
      // Робимо HTTP GET запит до API для отримання сповіщень від усіх проектів в одному місці
      const res = await fetch('/api/notifications');
      // Якщо відповідь від сервера успішна
      if (res.ok) {
        // Розбираємо JSON-відповідь
        const data = await res.json();
        // Оновлюємо стейт списку сповіщень
        setNotifications(data.notifications || []);
        // Оновлюємо стейт кількості непрочитаних сповіщень
        const count = data.unreadCount || 0;
        setUnreadCount(count);
        useUIStore.getState().setUnreadNotificationsCount(count);
        // Сповіщаємо інші компоненти про зміну кількості непрочитаних сповіщень через подію
        window.dispatchEvent(new CustomEvent('unread-notifications-update', { detail: count }));
      }
    } catch (e) {
      // Логуємо помилку у разі невдалого запиту
      console.error('Failed to fetch notifications', e);
    }
  };

  // Ефект для оновлення даних при монтуванні та при зміні імені поточного проекту
  useEffect(() => {
    // Викликаємо завантаження всіх сповіщень
    fetchNotifications();
    // Налаштовуємо регулярне опитування сервера кожні 5 секунд
    const interval = setInterval(fetchNotifications, 5000);
    // Повертаємо функцію очищення для видалення таймера при розмонтуванні або зміні projectName
    return () => clearInterval(interval);
  }, [projectName]); // Залежність від projectName гарантує оновлення при зміні проекту

  // Обробник для позначення конкретного сповіщення як прочитане
  const handleMarkAsRead = async (id: string) => {
    try {
      // Надсилаємо HTTP PUT запит для оновлення статусу сповіщення на сервері
      await fetch(`/api/notifications/${id}/read`, { method: 'PUT' });
      // Перезавантажуємо список сповіщень
      fetchNotifications();
    } catch (e) {
      // Логуємо помилку
      console.error(e);
    }
  };

  // Обробник для позначення всіх сповіщень усіх проектів як прочитані
  const handleMarkAllAsRead = async () => {
    try {
      // Надсилаємо HTTP PUT запит без фільтрації для позначення прочитаними сповіщень від усіх проектів
      await fetch('/api/notifications/read-all', { method: 'PUT' });
      // Перезавантажуємо список сповіщень
      fetchNotifications();
    } catch (e) {
      // Логуємо помилку
      console.error(e);
    }
  };

  // Обробник для видалення конкретного сповіщення
  const handleDelete = async (id: string) => {
    try {
      // Надсилаємо HTTP DELETE запит для видалення сповіщення з бази даних
      await fetch(`/api/notifications/${id}`, { method: 'DELETE' });
      // Перезавантажуємо список сповіщень
      fetchNotifications();
    } catch (e) {
      // Логуємо помилку
      console.error(e);
    }
  };

  if (!isActive) return null;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-black/20 relative">
      {/* Тулбар */}
      <div className="flex items-center justify-between p-2 border-b border-white/5">
        <div className="flex gap-2 items-center">
          <span className="text-[10px] uppercase font-bold text-muted-foreground ml-2">
            Сповіщення {unreadCount > 0 && <span className="text-amber-500">({unreadCount} нових)</span>}
          </span>
        </div>
        
        {notifications.length > 0 && (
          <button 
            onClick={handleMarkAllAsRead}
            className="px-2 py-1 flex items-center gap-1.5 bg-white/5 hover:bg-white/10 rounded-md text-[9px] uppercase font-bold text-muted-foreground hover:text-white transition-colors"
          >
            <CheckCircle2 size={12} /> Позначити всі прочитаними
          </button>
        )}
      </div>

      {/* Список */}
      <div className="flex-1 overflow-y-auto p-2 custom-scrollbar space-y-1">
        {notifications.length === 0 ? (
          <div className="h-full flex items-center justify-center text-muted-foreground opacity-30 italic text-[11px]">
            Немає сповіщень...
          </div>
        ) : (
          notifications.map(notif => (
            <div 
              key={notif.id} 
              className={`p-2 rounded-lg border flex gap-3 group transition-colors ${notif.read ? 'bg-white/5 border-transparent opacity-70' : 'bg-amber-500/10 border-amber-500/30'}`}
              onMouseEnter={() => {
                if (!notif.read) handleMarkAsRead(notif.id);
              }}
            >
              <div className="mt-0.5">
                <Bell size={14} className={notif.read ? 'text-muted-foreground' : 'text-amber-500'} />
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-start mb-0.5">
                  <span className="text-[10px] font-bold text-white/80">{notif.projectName}</span>
                  <span className="text-[9px] text-muted-foreground">{new Date(notif.timestamp).toLocaleTimeString()}</span>
                </div>
                <div className={`text-[11px] ${notif.read ? 'text-slate-300' : 'text-amber-100'}`}>
                  {notif.message}
                </div>
              </div>
              <div className="opacity-0 group-hover:opacity-100 flex flex-col justify-start">
                <button 
                  onClick={(e) => { e.stopPropagation(); handleDelete(notif.id); }}
                  className="p-1 text-muted-foreground hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
