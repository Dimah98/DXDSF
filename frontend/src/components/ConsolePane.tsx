import React, { useState, useEffect } from 'react';
import { Terminal, Camera, Trash2, Image as ImageIcon, Search, Bell } from 'lucide-react';
import { NotificationsPanel } from './NotificationsPanel';

interface ConsolePaneProps {
  isOpen: boolean; // Чи відкрита панель консолі
  setIsOpen: (isOpen: boolean) => void; // Функція зміни стану відкритості
  isSidebarCollapsed: boolean; // Чи згорнута бокова панель
  logs: any[]; // Масив поточних логів
  setLogs: (logs: any) => void; // Функція оновлення масиву логів
  debugImages: any[]; // Масив скріншотів дебагу
  activeTab: 'logs' | 'photos' | 'notifications'; // Активна вкладка
  setActiveTab: (tab: 'logs' | 'photos' | 'notifications') => void; // Функція зміни активної вкладки
  currentProject: string; // Назва поточного проекту для збереження логів
}

export const ConsolePane: React.FC<ConsolePaneProps> = ({
  isOpen,
  setIsOpen,
  isSidebarCollapsed,
  logs,
  setLogs,
  debugImages,
  activeTab,
  setActiveTab,
  currentProject // Назва поточного проекту для збереження/очищення логів на диску
}) => {
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  // Функція перемикача зі збереженням стану у localStorage
  const handleToggle = () => {
    // Розраховуємо новий стан (інверсія поточного)
    const next = !isOpen;
    // Оновлюємо стан в батьківському компоненті
    setIsOpen(next);
    // Зберігаємо стан відкритості консолі для наступного сеансу
    localStorage.setItem('sfl_console_open', String(next));
  };

  useEffect(() => {
    const handleUpdate = (e: any) => setUnreadNotifications(e.detail);
    window.addEventListener('unread-notifications-update', handleUpdate);
    return () => window.removeEventListener('unread-notifications-update', handleUpdate);
  }, []);

  return (
    <div className={`absolute bottom-0 right-0 z-[110] transition-all duration-300 ease-in-out ${isOpen ? 'h-[350px]' : 'h-10'} ${isSidebarCollapsed ? 'left-14' : 'left-60'} bg-[var(--interface-bg)] backdrop-blur-md border-t border-[var(--interface-border)] shadow-2xl flex flex-col`}>
      {/* Шапка консолі */}
      <div className="flex items-center justify-between px-4 h-10 border-b border-border/50">
        <div 
          className="flex items-center gap-3 cursor-pointer flex-1 h-full"
          onClick={handleToggle}
        >
          <div className={`p-1 rounded ${isOpen ? 'bg-indigo-500 text-white' : 'text-muted-foreground'}`}>
            <Terminal size={14} />
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
            Консоль
            {logs.length > 0 && (
              <span className="bg-indigo-500/20 text-indigo-400 text-[9px] px-1.5 py-0.5 rounded-full">
                {logs.length}
              </span>
            )}
          </span>
        </div>

        {isOpen && (
          <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg mr-4 border border-white/10 backdrop-blur-md">
            {/* Кнопка логів */}
            <button 
              onClick={() => setActiveTab('logs')}
              className={`px-3 py-1 rounded-md text-[9px] font-bold uppercase transition-all flex items-center gap-2 ${
                activeTab === 'logs' 
                  ? 'bg-blue-500/30 text-blue-300 border border-blue-500/30 shadow-sm' 
                  : 'text-white/40 hover:text-white/80'
              }`}
            >
              <Terminal size={12} /> Логи
            </button>
            {/* Кнопка фото дебагу */}
            <button 
              onClick={() => setActiveTab('photos')}
              className={`px-3 py-1 rounded-md text-[9px] font-bold uppercase transition-all flex items-center gap-2 ${
                activeTab === 'photos' 
                  ? 'bg-blue-500/30 text-blue-300 border border-blue-500/30 shadow-sm' 
                  : 'text-white/40 hover:text-white/80'
              }`}
            >
              <Camera size={12} /> Фото дебагу
            </button>
            {/* Кнопка Сповіщень */}
            <button 
              onClick={() => setActiveTab('notifications')}
              className={`px-3 py-1 rounded-md text-[9px] font-bold uppercase transition-all flex items-center gap-2 ${
                activeTab === 'notifications' 
                  ? 'bg-blue-500/30 text-blue-300 border border-blue-500/30 shadow-sm' 
                  : 'text-white/40 hover:text-white/80'
              }`}
            >
              <Bell size={12} /> Сповіщення
              {unreadNotifications > 0 && (
                <span className="bg-amber-500 text-black px-1 rounded-full text-[8px] leading-tight ml-1">{unreadNotifications}</span>
              )}
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
          {isOpen && (
            <button 
              onClick={() => {
                // Очищуємо логи в UI
                setLogs([]);
                // Також видаляємо збережені логи з файлу на бекенді
                fetch(`/api/logs/${encodeURIComponent(currentProject)}`, { method: 'DELETE' }).catch(() => {});
              }}
              className="p-1.5 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-lg transition-colors"
              title="Очистити консоль"
            >
              <Trash2 size={14} />
            </button>
          )}
          <button 
            onClick={handleToggle}
            className="p-1.5 hover:bg-muted text-muted-foreground rounded-lg transition-colors"
          >
            <Search size={14} className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* Тіло консолі */}
      {isOpen && (
        <div className="flex-1 flex flex-col min-h-0">
          {activeTab === 'logs' ? (
            <div className="flex-1 overflow-y-auto p-2 font-mono text-[11px] custom-scrollbar bg-black/20">
              {logs.length === 0 ? (
                <div className="h-full flex items-center justify-center text-muted-foreground opacity-30 italic">
                  Консоль порожня...
                </div>
              ) : (
                logs.map((log) => {
                  const hasNodeTag = log.message.startsWith('[');
                  const nodeTitle = hasNodeTag ? log.message.split(']')[0].substring(1) : null;
                  const cleanMessage = hasNodeTag ? log.message.split(']').slice(1).join(']').trim() : log.message;

                  return (
                    <div key={log.id} className="group border-b border-white/[0.02] last:border-0">
                      <div className="flex gap-3 py-1.5 px-2 hover:bg-white/[0.03] transition-colors rounded">
                        <span className="text-muted-foreground/40 shrink-0 select-none min-w-[65px]">{log.time}</span>
                        <div className="flex flex-col gap-1 flex-1 min-w-0">
                          <div className="flex items-start gap-2">
                            {nodeTitle ? (
                              <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider shadow-sm border ${
                                log.type === 'error' ? 'bg-red-500/20 text-red-400 border-red-500/30' : 
                                log.type === 'success' ? 'bg-green-500/20 text-green-400 border-green-500/30' : 
                                log.type === 'debug' ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' : 
                                'bg-indigo-500/20 text-indigo-400 border-indigo-500/30'
                              }`}>
                                {nodeTitle}
                              </span>
                            ) : (
                              <span className={`w-1.5 h-1.5 rounded-full mt-1.5 ${
                                log.type === 'error' ? 'bg-red-500 shadow-[0_0_8px_#ef4444]' : 
                                log.type === 'success' ? 'bg-green-500 shadow-[0_0_8px_#22c55e]' : 
                                'bg-indigo-500 shadow-[0_0_8px_#6366f1]'
                              }`} />
                            )}
                            
                            <span className={`flex-1 break-words leading-relaxed ${
                              log.type === 'error' ? 'text-red-300' : 
                              log.type === 'success' ? 'text-green-300' : 
                              'text-foreground/80'
                            }`}>
                              {cleanMessage}
                            </span>
                          </div>
                        </div>
                      </div>
                      {log.data && (
                        <div className="ml-20 mb-2 p-2 bg-black/40 rounded-lg border border-white/5 overflow-x-auto">
                          <pre className="text-[9px] text-indigo-300/80">
                            {JSON.stringify(log.data, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          ) : activeTab === 'photos' ? (
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-black/20">
               {debugImages.length === 0 ? (
                 <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50 italic">
                    <ImageIcon size={32} className="mb-2 opacity-20" />
                    Скріншотів поки немає...
                 </div>
               ) : (
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {debugImages.map((img) => (
                      <div key={img.id} className="bg-muted/30 border border-border/50 rounded-xl overflow-hidden group hover:border-indigo-500/50 transition-all shadow-lg">
                         <div className="relative aspect-video bg-black/40">
                            <img src={img.image} className="w-full h-full object-contain" alt="Debug View" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                         </div>
                         <div className="p-2.5 flex items-center justify-between border-t border-border/50 bg-background/50">
                            <div className="flex flex-col">
                               <span className="text-[10px] font-black uppercase text-indigo-400 tracking-tighter truncate max-w-[150px]">
                                  {img.nodeName}
                               </span>
                               <span className="text-[8px] text-muted-foreground">{img.time}</span>
                            </div>
                            <button 
                              onClick={() => {
                                const link = document.createElement('a');
                                link.href = img.image;
                                link.download = `debug_${img.id}.png`;
                                link.click();
                              }}
                              className="p-1.5 hover:bg-indigo-500/20 text-muted-foreground hover:text-indigo-400 rounded-lg transition-colors"
                            >
                               <ImageIcon size={14} />
                            </button>
                         </div>
                      </div>
                    ))}
                 </div>
               )}
            </div>
          ) : (
            // Рендеримо панель сповіщень, передаючи стан активності та назву поточного проекту для фільтрації
            <NotificationsPanel 
              isActive={activeTab === 'notifications'} 
              projectName={currentProject} 
            />
          )}
        </div>
      )}
    </div>
  );
};
