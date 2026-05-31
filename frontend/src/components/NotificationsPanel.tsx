import React, { useState, useEffect } from 'react';
import { Bell, Trash2, CheckCircle2 } from 'lucide-react';

interface Notification {
  id: string;
  projectName: string;
  message: string;
  timestamp: number;
  read: boolean;
}

export function NotificationsPanel({ isActive }: { isActive: boolean }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
        // Також сповіщаємо батьківські компоненти про кількість непрочитаних
        window.dispatchEvent(new CustomEvent('unread-notifications-update', { detail: data.unreadCount }));
      }
    } catch (e) {
      console.error('Failed to fetch notifications', e);
    }
  };

  useEffect(() => {
    // Первинне завантаження
    fetchNotifications();
    // Поллінг кожні 5 секунд
    const interval = setInterval(fetchNotifications, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleMarkAsRead = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: 'PUT' });
      fetchNotifications();
    } catch (e) {
      console.error(e);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await fetch('/api/notifications/read-all', { method: 'PUT' });
      fetchNotifications();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}`, { method: 'DELETE' });
      fetchNotifications();
    } catch (e) {
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
