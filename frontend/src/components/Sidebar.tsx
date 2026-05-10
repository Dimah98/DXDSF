// Бокова панель з нодами — підтримка drag (десктоп) та tap (мобільний) + кастомізація кольорів + керування проектами
import React, { useState, useEffect, useRef } from 'react';
import { 
  Globe, Scan, Monitor, Search, 
  MousePointerClick, Crosshair, Play,
  Camera, Layers, Keyboard, CloudDownload,
  Database, Repeat, GitFork, Settings2,
  PanelLeftClose, PanelLeftOpen,
  Save, FolderOpen, Settings, Trash2, FileJson, Plus, FilePlus,
  Square, ArrowRightLeft, Smile, Copy, Terminal, ChevronUp, ChevronDown, XCircle, Image as ImageIcon,
  Type
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "./ui/dropdown-menu";

const DEFAULT_COLORS: Record<string, string> = {
  startNode: '#64748b',
  browserNode: '#a855f7',
  infoNode: '#14b8a6',
  imageSearchNode: '#6366f1',
  searchInNode: '#6366f1',
  apiNode: '#6366f1',
  variableNode: '#f59e0b',
  multiLogicNode: '#8b5cf6',
  compareNode: '#6366f1',
  selectorCheckNode: '#fb923c',
  nestedCheckNode: '#ec4899',
  valueLoopNode: '#d946ef',
  actionNode: '#3b82f6',
  coordClickNode: '#06b6d4',
  keyboardNode: '#64748b',
  multiScanNode: '#0891b2',
  visualSearchNode: '#10b981',
  textCompareNode: '#db2777',
  escNode: '#475569',
  displayNode: '#64748b'
};

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

const addNodeByTap = (nodeType: string) => {
  window.dispatchEvent(new CustomEvent('add-node-tap', { detail: { type: nodeType } }));
};

const Sidebar = ({ 
  onSave, onLoad, onClear, onSettingsToggle 
}: { 
  onSave: (name?: string) => void, onLoad: (name?: string) => void, onClear: () => void, 
  onSettingsToggle: () => void 
}) => {
  const [customColors, setCustomColors] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('sfl_node_colors_hex');
    return saved ? JSON.parse(saved) : DEFAULT_COLORS;
  });
  
  const [activeTypeSettings, setActiveTypeSettings] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('sfl_sidebar_collapsed');
    return saved === 'true';
  });
  const [projects, setProjects] = useState<string[]>([]);
  const [currentProject, setCurrentProject] = useState<string | null>(() => {
    return localStorage.getItem('sfl_current_project');
  });
  const settingsRef = useRef<HTMLDivElement>(null);

  // Оновлюємо список проектів при відкритті меню
  const fetchProjects = async () => {
    try {
      const res = await fetch(`/api/projects`);
      const data = await res.json();
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

  const handleSave = (asNew: boolean = false) => {
    if (asNew || !currentProject) {
      const name = window.prompt('Назва проекту:', currentProject || '');
      if (name) {
        setCurrentProject(name);
        onSave(name);
      }
    } else {
      // Пряме збереження без діалогу
      onSave(currentProject);
    }
  };

  const handleLoad = (name: string) => {
    setCurrentProject(name);
    onLoad(name);
  };

  const handleNew = () => {
    setCurrentProject(null);
    onClear();
  };

  const NodeItem = ({ type, icon: Icon, label, desc }: any) => {
    const colorHex = customColors[type] || '#64748b';
    const isOpen = activeTypeSettings === type;
    
    return (
      <div className={`flex flex-col mb-1 w-full ${isCollapsed ? 'px-0' : 'px-2'}`}>
        <div
          className={`flex items-center ${isCollapsed ? 'justify-center border-none bg-transparent shadow-none hover:bg-muted/20 w-full' : 'p-2 rounded-xl border bg-card hover:bg-muted shadow-sm'} ${isOpen ? 'border-primary ring-1 ring-primary' : 'border-border'} cursor-grab transition-all group shrink-0 ${isCollapsed ? 'min-w-0' : 'min-w-[140px] md:min-w-0'} relative overflow-hidden`}
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
              <span className="text-[11px] font-bold text-foreground truncate">{label}</span>
              <span className="text-[9px] text-muted-foreground truncate leading-tight hidden md:block">{desc}</span>
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
      className={`absolute left-0 top-0 z-[40] border-r text-foreground flex flex-col h-full transition-all duration-300 ${isCollapsed ? 'w-14' : 'w-60'} backdrop-blur-sm`}
      style={{ backgroundColor: 'var(--global-sidebar-bg-custom)', borderColor: 'var(--global-sidebar-border-custom)' }}
    >
      <div className={`flex flex-col shrink-0 ${isCollapsed ? 'p-1 items-center' : 'p-3 items-start'}`}>
        <div className={`flex items-center w-full ${isCollapsed ? 'justify-center' : 'justify-between'} mb-4`}>
          <DropdownMenu onOpenChange={(open) => open && fetchProjects()}>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 hover:opacity-80 transition-opacity focus:outline-none group">
                <div className="w-10 h-10 flex items-center justify-center transition-all">
                  <img src="/logo.png" alt="Logo" className="w-10 h-10 object-contain" />
                </div>
                {!isCollapsed && (
                  <div className="flex flex-col items-start">
                    <span className="text-[10px] font-black uppercase tracking-tighter leading-none">SFL Builder</span>
                    <span className="text-[8px] text-muted-foreground font-bold">Меню</span>
                  </div>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="right" className="w-64 ml-2 p-2 bg-card border-border shadow-2xl rounded-xl z-[201]">
              <div className="px-2 py-2 text-[11px] font-black uppercase text-slate-200 tracking-widest border-b border-border/50 mb-2">Керування проектами</div>
              
              <DropdownMenuItem onClick={handleNew} className="flex items-center gap-3 py-2.5 cursor-pointer rounded-lg hover:bg-muted focus:bg-muted group">
                <FilePlus size={16} className="text-emerald-500 group-hover:scale-110 transition-transform" />
                <span className="text-sm font-bold text-white">Новий проект</span>
              </DropdownMenuItem>

              <DropdownMenuItem onClick={() => handleSave(false)} className="flex items-center gap-3 py-2.5 cursor-pointer rounded-lg hover:bg-muted focus:bg-muted group">
                <Save size={16} className="text-blue-500 group-hover:scale-110 transition-transform" />
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-white">Зберегти {currentProject ? `"${currentProject}"` : ''}</span>
                  {!currentProject && <span className="text-[9px] text-slate-400 italic">потрібна назва</span>}
                </div>
              </DropdownMenuItem>

              <DropdownMenuItem onClick={() => handleSave(true)} className="flex items-center gap-3 py-2.5 cursor-pointer rounded-lg hover:bg-muted focus:bg-muted group">
                <Plus size={16} className="text-indigo-500 group-hover:scale-110 transition-transform" />
                <span className="text-sm font-bold text-white">Зберегти як...</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator className="my-1 bg-border/50" />

              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="flex items-center gap-3 py-2.5 cursor-pointer rounded-lg hover:bg-muted group">
                  <FolderOpen size={16} className="text-amber-500 group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-bold text-white">Завантажити проект</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-56 p-2 bg-card border-border shadow-xl rounded-xl ml-1">
                   {projects.length === 0 ? (
                     <div className="px-3 py-2 text-xs text-muted-foreground italic">Проектів не знайдено</div>
                   ) : (
                     projects.map(p => (
                       <div key={p} className="flex items-center justify-between group/p">
                         <DropdownMenuItem 
                           onClick={() => handleLoad(p)}
                           className="flex-1 flex items-center gap-2 py-2 cursor-pointer rounded-lg hover:bg-muted"
                         >
                           <FileJson size={14} className="text-muted-foreground" />
                           <span className="text-xs font-bold text-white">{p}</span>
                         </DropdownMenuItem>
                         <button 
                           onClick={(e) => handleDeleteProject(e, p)}
                           className="p-1 opacity-0 group-hover/p:opacity-100 hover:text-destructive transition-all mr-1"
                         >
                           <Trash2 size={12} />
                         </button>
                       </div>
                     ))
                   )}
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              <DropdownMenuSeparator className="my-1 bg-border/50" />
              <div className="px-2 py-2 text-[10px] font-black uppercase text-primary/80 tracking-widest">Налаштування</div>
              
              <DropdownMenuItem onClick={onSettingsToggle} className="flex items-center gap-3 py-2.5 cursor-pointer rounded-lg hover:bg-muted focus:bg-muted group">
                <Settings size={16} className="text-primary group-hover:rotate-45 transition-transform" />
                <span className="text-sm font-bold text-white">Персоналізація</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

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
      
      <div className="flex-1 overflow-y-auto custom-scrollbar pb-6">
        <div className="flex flex-col gap-1">
          <NodeItem type="startNode" icon={Play} label="Початок" desc="Точка входу" />
          <NodeItem type="browserNode" icon={Globe} label="Браузер" desc="Керування сторінкою" />
          <NodeItem type="infoNode" icon={Scan} label="Сканер" desc="Аналіз елемента" />
          <NodeItem type="imageSearchNode" icon={Search} label="Пошук картинки" desc="Знайти за файлом" />
          <NodeItem type="searchInNode" icon={Search} label="Пошук у блоці" desc="Шукати в селекторі" />
          <NodeItem type="apiNode" icon={CloudDownload} label="API Запит" desc="Дані з сервера SFL" />
          <NodeItem type="variableNode" icon={Database} label="Змінні" desc="Глобальна пам'ять" />
          <NodeItem type="multiLogicNode" icon={GitFork} label="Логічний ХАБ" desc="Багато умов" />
          <NodeItem type="compareNode" icon={GitFork} label="Порівняння" desc="A vs B" />
          <NodeItem type="textCompareNode" icon={Type} label="Порівняння тексту" desc="Текст vs Текст" />
          <NodeItem type="selectorCheckNode" icon={Search} label="Перевірка" desc="Чи є на екрані?" />
          <NodeItem type="nestedCheckNode" icon={Layers} label="Вкладена" desc="Пошук всередині" />
          <NodeItem type="valueLoopNode" icon={Repeat} label="Цикл Кліків" desc="Клік за умовою" />
          <NodeItem type="actionNode" icon={MousePointerClick} label="Дія" desc="Клік / Наведення" />
          <NodeItem type="coordClickNode" icon={Crosshair} label="Клік (X,Y)" desc="Точний клік" />
          <NodeItem type="keyboardNode" icon={Keyboard} label="Макрос" desc="Клавіші" />
          <NodeItem type="escNode" icon={XCircle} label="Натиснути ESC" desc="Закрити меню" />
          <NodeItem type="multiScanNode" icon={Layers} label="Мульти-Сканер" desc="Багато селекторів" />
          <NodeItem type="visualSearchNode" icon={Camera} label="Візуальний зір" desc="Пошук скріншотом" />
          <NodeItem type="displayNode" icon={Monitor} label="Вивід" desc="Результат" />
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
