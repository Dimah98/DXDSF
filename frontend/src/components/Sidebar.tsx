// Бокова панель з нодами — підтримка drag (десктоп) та tap (мобільний) + кастомізація кольорів + керування проектами
// Використовує NODE_CONFIG як єдине джерело правди для списку нод
import React, { useState, useEffect, useRef } from 'react';
// Більше не використовуємо DropdownMenu — замінено на ProjectManagerModal
import { Settings2, PanelLeftClose, PanelLeftOpen, Calendar } from 'lucide-react';
import { NODE_CONFIG, SIDEBAR_NODE_TYPES } from '../nodeConfig';

// Колір за замовчуванням для кожного типу ноди
const DEFAULT_COLORS: Record<string, string> = Object.fromEntries(
  Object.entries(NODE_CONFIG).map(([type, cfg]) => [type, cfg.defaultColor])
);

const COLOR_OPTIONS = [
  { name: 'Slate', value: '#64748b' }, { name: 'Red', value: '#ef4444' },
  { name: 'Orange', value: '#f97316' }, { name: 'Amber', value: '#f59e0b' },
  { name: 'Yellow', value: '#eab308' }, { name: 'Lime', value: '#84cc16' },
  { name: 'Green', value: '#22c55e' }, { name: 'Emerald', value: '#10b981' },
  { name: 'Teal', value: '#14b8a6' }, { name: 'Cyan', value: '#06b6d4' },
  { name: 'Sky', value: '#0ea5e9' }, { name: 'Blue', value: '#3b82f6' },
  { name: 'Indigo', value: '#6366f1' }, { name: 'Violet', value: '#8b5cf6' },
  { name: 'Purple', value: '#a855f7' }, { name: 'Fuchsia', value: '#d946ef' },
  { name: 'Pink', value: '#ec4899' }, { name: 'Rose', value: '#f43f5e' },
];

// Додавання ноди тапом (мобільний пристрій)
const addNodeByTap = (nodeType: string) => {
  window.dispatchEvent(new CustomEvent('add-node-tap', { detail: { type: nodeType } }));
};

const Sidebar = ({
  onSettingsToggle, isCollapsed, setIsCollapsed, onOpenManager, onScheduleToggle
}: {
  onSettingsToggle: () => void, isCollapsed: boolean, setIsCollapsed: (val: boolean) => void,
  onOpenManager: () => void; // Відкриває великий менеджер проектів
  onScheduleToggle: () => void; // Відкриває менеджер розкладу
}) => {
  const [customColors, setCustomColors] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('sfl_node_colors_hex');
    return saved ? JSON.parse(saved) : DEFAULT_COLORS;
  });

  const [activeTypeSettings, setActiveTypeSettings] = useState<string | null>(null);

  const [projects, setProjects] = useState<string[]>([]);
  const [currentProject, setCurrentProject] = useState<string | null>(() => {
    return localStorage.getItem('sfl_current_project');
  });
  const settingsRef = useRef<HTMLDivElement>(null);

  // Оновлюємо список проектів при відкритті меню
  const fetchProjects = async () => {
    try {
      const res = await fetch(`/api/projects`);
      if (!res.ok) return;
      const text = await res.text();
      if (!text) return;
      const data = JSON.parse(text);
      setProjects(data);
    } catch (e) { console.error('Error fetching projects:', e); }
  };

  useEffect(() => {
    localStorage.setItem('sfl_sidebar_collapsed', String(isCollapsed));
  }, [isCollapsed]);

  useEffect(() => {
    if (currentProject) localStorage.setItem('sfl_current_project', currentProject);
    else localStorage.removeItem('sfl_current_project');
  }, [currentProject]);

  useEffect(() => {
    localStorage.setItem('sfl_node_colors_hex', JSON.stringify(customColors));
    window.dispatchEvent(new CustomEvent('node-colors-changed', { detail: customColors }));
  }, [customColors]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setActiveTypeSettings(null);
      }
    };
    if (activeTypeSettings) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeTypeSettings]);

  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  const updateColor = (type: string, color: string) => {
    setCustomColors(prev => ({ ...prev, [type]: color }));
  };

  const handleDeleteProject = async (e: React.MouseEvent, name: string) => {
    e.stopPropagation();
    try {
      await fetch(`/api/projects/${name}`, { method: 'DELETE' });
      if (currentProject === name) setCurrentProject(null);
      fetchProjects();
    } catch (e) { console.error('Delete error:', e); }
  };



  // Компонент одного елемента в сайдбарі — рендерується з NODE_CONFIG
  const NodeItem = ({ type }: { type: string }) => {
    const config = NODE_CONFIG[type];
    if (!config) return null;
    const Icon = config.icon;
    const colorHex = customColors[type] || config.defaultColor;
    const isOpen = activeTypeSettings === type;

    return (
      <div className={`flex flex-col mb-1 w-full ${isCollapsed ? 'px-0' : 'px-2'}`}>
        <div
          className={`flex items-center ${isCollapsed ? 'justify-center border-none bg-transparent shadow-none hover:bg-white/10 w-full' : 'p-2 rounded-xl border shadow-sm hover:brightness-110'} ${isOpen ? 'border-primary ring-1 ring-primary' : 'border-[var(--interface-border)]'} cursor-grab transition-all group shrink-0 ${isCollapsed ? 'min-w-0' : 'min-w-[140px] md:min-w-0'} relative overflow-hidden`}
          style={isCollapsed ? {} : { backgroundColor: 'var(--node-bg)' }}
          onDragStart={(event) => onDragStart(event, type)}
          onClick={() => addNodeByTap(type)}
          draggable
        >
          <div
            className={`p-1.5 rounded-lg text-white ${isCollapsed ? 'mr-0' : 'mr-2 md:mr-3'} group-hover:scale-110 transition-transform shadow-sm`}
            style={{ backgroundColor: colorHex }}
          >
            <Icon size={16} />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col min-w-0 flex-1">
              {/* Назва ноди — основний текст */}
              <span className="text-[11px] font-bold truncate" style={{ color: 'var(--interface-text-primary)' }}>{config.label}</span>
              {/* Опис — додатковий текст */}
              <span className="text-[9px] truncate leading-tight hidden md:block" style={{ color: 'var(--interface-text-secondary)' }}>{config.desc}</span>
            </div>
          )}

          {!isCollapsed && (
            <button
              className={`p-1.5 hover:bg-muted rounded-full text-muted-foreground transition-all ${isOpen ? 'opacity-100 rotate-90 text-primary' : 'opacity-0 group-hover:opacity-100'}`}
              onClick={(e) => {
                e.stopPropagation();
                setActiveTypeSettings(isOpen ? null : type);
              }}
            >
              <Settings2 size={13} />
            </button>
          )}
        </div>

        {isOpen && (
          <div
            ref={settingsRef}
            className="bg-muted/30 border-x border-b border-border rounded-b-xl p-2 z-[50] animate-in slide-in-from-top-2 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-[9px] font-bold uppercase text-muted-foreground/60 mb-2 px-1 flex justify-between items-center">
              <span>Вибір кольору</span>
              <button onClick={() => setActiveTypeSettings(null)} className="hover:text-foreground">✕</button>
            </div>
            <div className="grid grid-cols-6 gap-1.5">
              {COLOR_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  className={`w-5 h-5 rounded-full border ${colorHex === opt.value ? 'ring-2 ring-primary ring-offset-1 ring-offset-background' : 'border-transparent'} hover:scale-110 transition-all`}
                  style={{ backgroundColor: opt.value }}
                  onClick={() => updateColor(type, opt.value)}
                  title={opt.name}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <aside
      className={`absolute left-0 top-0 z-[40] border-r text-foreground flex flex-col h-full transition-all duration-300 ${isCollapsed ? 'w-14' : 'w-60'} backdrop-blur-sm bg-[var(--interface-bg)] border-[var(--interface-border)]`}
    >
      <div className={`flex flex-col shrink-0 ${isCollapsed ? 'p-1 items-center' : 'p-3 items-start'}`}>
        <div className={`flex items-center w-full ${isCollapsed ? 'justify-center' : 'justify-between'} mb-4`}>
          {/* Логотип — клік відкриває менеджер проектів */}
          <button
            className="flex items-center gap-2 hover:opacity-80 transition-opacity focus:outline-none group"
            onClick={onOpenManager}
            title="Менеджер проектів"
          >
            <div className="w-10 h-10 flex items-center justify-center transition-all">
              <img src="/logo.png" alt="Logo" className="w-10 h-10 object-contain" />
            </div>
            {!isCollapsed && (
              <div className="flex flex-col items-start">
                <span className="text-[10px] font-black uppercase tracking-tighter leading-none">SFL Builder</span>
                {/* Підказка що клік відкриває менеджер */}
                <span className="text-[8px] text-muted-foreground font-bold group-hover:text-primary transition-colors">Проекти</span>
              </div>
            )}
          </button>

          {!isCollapsed && (
            <button
              onClick={() => setIsCollapsed(true)}
              className="p-1.5 hover:bg-muted rounded-md text-muted-foreground transition-colors ml-auto"
            >
              <PanelLeftClose size={16} />
            </button>
          )}
        </div>

        {isCollapsed && (
          <button
            onClick={() => setIsCollapsed(false)}
            className="p-1.5 hover:bg-muted rounded-md text-muted-foreground transition-colors mb-4"
          >
            <PanelLeftOpen size={16} />
          </button>
        )}

        {!isCollapsed && <h3 className="font-black text-[9px] uppercase text-muted-foreground/50 tracking-widest px-1 mb-2">Доступні Ноди</h3>}
      </div>

      {/* Список нод — генерується автоматично з SIDEBAR_NODE_TYPES */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pb-6">
        <div className="flex flex-col gap-1">
          {SIDEBAR_NODE_TYPES.map(type => (
            <NodeItem key={type} type={type} />
          ))}
        </div>
      </div>

      {/* Кнопка розкладу внизу сайдбару */}
      <div className={`p-2 border-t border-[var(--interface-border)] ${isCollapsed ? 'flex justify-center' : ''}`}>
        <button
          onClick={onScheduleToggle}
          className={`flex items-center gap-2 p-2 rounded-lg w-full transition-colors text-muted-foreground hover:bg-white/10 hover:text-primary ${isCollapsed ? 'justify-center' : ''}`}
          title="Менеджер розкладу"
        >
          <Calendar size={18} />
          {!isCollapsed && <span className="text-[11px] font-bold">Розклад</span>}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
