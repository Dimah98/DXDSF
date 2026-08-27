// Бокова панель з нодами — підтримка drag (десктоп) та tap (мобільний) + кастомізація кольорів + керування проектами
// Використовує NODE_CONFIG як єдине джерело правди для списку нод
import React, { useState, useEffect, useRef } from 'react';
import { Settings2, PanelLeftClose, PanelLeftOpen, Calendar, ChevronUp, ChevronDown } from 'lucide-react';
import { getDynamicIcon } from '../utils/dynamicIcon';
import { NODE_CONFIG, SIDEBAR_NODE_TYPES } from '../nodeConfig';
import { useUIStore } from '../store/useUIStore';

const ICON_OPTIONS = [
  'Play', 'Globe', 'Scan', 'Search', 'CloudDownload', 'Database',
  'GitFork', 'MousePointerClick', 'Crosshair', 'Keyboard',
  'Camera', 'Layers', 'Monitor', 'Repeat', 'Move',
  'MessageSquare', 'Timer', 'XCircle', 'Calculator', 'Activity',
  'ArrowRightLeft', 'Package', 'Clock', 'CalendarClock', 'Bell', 'Sprout', 'Flame', 'ChefHat', 'Gamepad2', 'Hammer', 'Settings'
];

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
  useUIStore.getState().triggerAddNodeTap(nodeType);
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

  const [customIcons, setCustomIcons] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('sfl_node_icons');
    return saved ? JSON.parse(saved) : {};
  });

  const [nodeOrder, setNodeOrder] = useState<string[]>(() => {
    const saved = localStorage.getItem('sfl_node_order');
    if (saved) {
      const parsed = JSON.parse(saved);
      const missing = SIDEBAR_NODE_TYPES.filter(t => !parsed.includes(t));
      return [...parsed, ...missing];
    }
    return [...SIDEBAR_NODE_TYPES];
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
      const filtered = Array.isArray(data) ? data.filter((name: string) => 
        name !== 'categories' &&
        name !== 'global_building_types' &&
        name !== 'schedule' &&
        name !== 'notifications' &&
        !name.endsWith('_layout') &&
        !name.endsWith('_save') &&
        !name.endsWith('_stats') &&
        !name.endsWith('_logs') &&
        !name.endsWith('_inventory')
      ) : [];
      filtered.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
      setProjects(filtered);
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
    useUIStore.getState().setNodeColors(customColors);
    window.dispatchEvent(new CustomEvent('node-colors-changed', { detail: customColors }));
  }, [customColors]);

  useEffect(() => {
    localStorage.setItem('sfl_node_icons', JSON.stringify(customIcons));
    useUIStore.getState().setNodeIcons(customIcons);
    window.dispatchEvent(new CustomEvent('node-icons-changed', { detail: customIcons }));
  }, [customIcons]);

  useEffect(() => {
    localStorage.setItem('sfl_node_order', JSON.stringify(nodeOrder));
  }, [nodeOrder]);

  const updateIcon = (type: string, iconName: string) => {
    setCustomIcons(prev => ({ ...prev, [type]: iconName }));
  };

  const moveNode = (type: string, direction: 'up' | 'down') => {
    setNodeOrder(prev => {
      const idx = prev.indexOf(type);
      if (idx === -1) return prev;
      const next = [...prev];
      if (direction === 'up' && idx > 0) {
        [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      } else if (direction === 'down' && idx < next.length - 1) {
        [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
      }
      return next;
    });
  };

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
  const NodeItem = ({ type, isFirst, isLast }: { type: string, isFirst: boolean, isLast: boolean }) => {
    const config = NODE_CONFIG[type];
    if (!config) return null;
    const customIconName = customIcons[type];
    const Icon = (customIconName ? getDynamicIcon(customIconName) : null) || config.icon;
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
            className="bg-muted/30 border-x border-b border-border rounded-b-xl p-2 z-[var(--z-context-menu)] animate-in slide-in-from-top-2 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-[9px] font-bold uppercase text-muted-foreground/60 mb-2 px-1 flex justify-between items-center">
              <span>Сортування</span>
              <button onClick={() => setActiveTypeSettings(null)} className="hover:text-foreground">✕</button>
            </div>
            <div className="flex gap-2 mb-3">
              <button disabled={isFirst} onClick={() => moveNode(type, 'up')} className={`p-1 rounded bg-white/5 border border-white/10 flex-1 flex justify-center items-center transition-colors ${!isFirst ? 'hover:bg-white/10 text-white' : 'text-white/20'}`}><ChevronUp size={16}/></button>
              <button disabled={isLast} onClick={() => moveNode(type, 'down')} className={`p-1 rounded bg-white/5 border border-white/10 flex-1 flex justify-center items-center transition-colors ${!isLast ? 'hover:bg-white/10 text-white' : 'text-white/20'}`}><ChevronDown size={16}/></button>
            </div>

            <div className="text-[9px] font-bold uppercase text-muted-foreground/60 mb-2 px-1">Вибір кольору</div>
            <div className="grid grid-cols-6 gap-1.5 mb-3">
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

            <div className="text-[9px] font-bold uppercase text-muted-foreground/60 mb-2 px-1">Вибір іконки</div>
            <div className="grid grid-cols-6 gap-1 max-h-32 overflow-y-auto custom-scrollbar pr-1">
              {ICON_OPTIONS.map((iconName) => {
                const IconComponent = getDynamicIcon(iconName);
                if (!IconComponent) return null;
                const isSelected = customIconName === iconName || (!customIconName && config.icon.name === iconName);
                return (
                  <button
                    key={iconName}
                    className={`flex items-center justify-center p-1 rounded-md border ${isSelected ? 'bg-primary/20 border-primary text-primary' : 'bg-transparent border-transparent hover:bg-white/5 hover:border-white/10 text-muted-foreground'} transition-all`}
                    onClick={() => updateIcon(type, iconName)}
                    title={iconName}
                  >
                    <IconComponent size={14} />
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Мобільний фон-затемнення для закриття сайдбару при тапі поза ним */}
      {!isCollapsed && (
        <div 
          className="fixed inset-0 bg-black/60 z-[calc(var(--z-sidebar)-1)] md:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsCollapsed(true)}
        />
      )}
      <aside
        className={`absolute left-0 top-0 z-[var(--z-sidebar)] border-r text-foreground flex flex-col h-full transition-all duration-300 ${isCollapsed ? 'w-14' : 'w-64 md:w-60 shadow-2xl md:shadow-none'} backdrop-blur-sm bg-[var(--interface-bg)] border-[var(--interface-border)]`}
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

        {/* Список нод — генерується з nodeOrder */}
        <div className="flex-1 overflow-y-auto custom-scrollbar pb-6">
          <div className="flex flex-col gap-1">
            {nodeOrder.map((type, index) => (
              <NodeItem key={type} type={type} isFirst={index === 0} isLast={index === nodeOrder.length - 1} />
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
    </>
  );
};

export default Sidebar;
