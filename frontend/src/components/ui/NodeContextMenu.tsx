import React from 'react';
import { 
  Copy, Clipboard, Trash2, Image, ChevronRight,
  Zap, Target, Cpu, MousePointer2, Keyboard, Search, Circle, Square, Package,
  Settings, Palette
} from 'lucide-react';

const ICON_MAP: Record<string, any> = {
  Zap, Target, Cpu, MousePointer2, Keyboard, Search, Circle, Square, Package
};

const GROUP_COLORS = [
  { name: 'Синій', value: '#1d4ed8' },
  { name: 'Фіолетовий', value: '#7c3aed' },
  { name: 'Зелений', value: '#059669' },
  { name: 'Червоний', value: '#dc2626' },
  { name: 'Бурштиновий', value: '#d97706' },
  { name: 'Темний', value: '#334155' },
  { name: 'Рожевий', value: '#db2777' },
  { name: 'Бірюзовий', value: '#0d9488' },
];

interface NodeContextMenuProps {
  menu: { 
    x: number; 
    y: number; 
    type: 'pane' | 'node' | 'selection'; 
    nodeId?: string; 
    nodeType?: string;
    hasSelection?: boolean 
  } | null;
  onCopy: () => void;
  onPaste: (pos: { x: number; y: number }) => void;
  onDeleteSelected: () => void;
  onSetCustomIcon?: (nodeId: string, iconName?: string) => void;
  onOpenGroupSettings?: (nodeId: string) => void;
  onSetGroupColor?: (nodeId: string, color: string) => void;
  protectedIds?: string[];
  onClickOutside: () => void;
}

/**
 * Контекстне меню для нод та полотна
 */
export const NodeContextMenu: React.FC<NodeContextMenuProps> = ({
  menu,
  onCopy,
  onPaste,
  onDeleteSelected,
  onSetCustomIcon,
  onOpenGroupSettings,
  onSetGroupColor,
  onClickOutside
}) => {
  if (!menu) return null;

  return (
    <div
      className="fixed z-[var(--z-context-menu)] min-w-[160px] bg-[var(--interface-bg)] backdrop-blur-md border border-[var(--interface-border)] shadow-2xl rounded-xl p-1.5 animate-in fade-in zoom-in-95 duration-150"
      style={{ top: menu.y, left: menu.x }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Кнопка "Вставити" доступна завжди при кліку на полотно */}
      <button
        onClick={() => { onPaste({ x: menu.x, y: menu.y }); onClickOutside(); }}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-primary/20 hover:text-primary rounded-lg transition-all group"
      >
        <Clipboard size={14} className="text-muted-foreground group-hover:text-primary" />
        <span>Вставити</span>
      </button>

      {/* Якщо є виділені ноди — додаємо Копіювати */}
      {menu.hasSelection && (
        <>
          <button
            onClick={() => { onCopy(); onClickOutside(); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-primary/20 hover:text-primary rounded-lg transition-all group"
          >
            <Copy size={14} className="text-muted-foreground group-hover:text-primary" />
            <span>Копіювати</span>
          </button>
        </>
      )}

      {/* Спеціальні опції для контейнера (GroupNode) */}
      {menu.type === 'node' && menu.nodeType === 'groupNode' && (
        <>
          <button
            onClick={() => {
              if (menu.nodeId) {
                if (onOpenGroupSettings) {
                  onOpenGroupSettings(menu.nodeId);
                } else {
                  window.dispatchEvent(new CustomEvent('sfl-open-group-settings', { detail: { nodeId: menu.nodeId } }));
                }
              }
              onClickOutside();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-amber-300 hover:bg-amber-500/20 rounded-lg transition-all group"
          >
            <Settings size={14} className="text-amber-400 group-hover:rotate-45 transition-transform" />
            <span>Налаштування контейнера</span>
          </button>

          <div className="relative group/sub">
            <button
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-slate-200 hover:bg-primary/20 hover:text-primary rounded-lg transition-all group"
            >
              <div className="flex items-center gap-2.5">
                <Palette size={14} className="text-muted-foreground group-hover:text-primary" />
                <span>Колір контейнера</span>
              </div>
              <ChevronRight size={12} className="text-muted-foreground/50" />
            </button>
            
            {/* Підменю вибору кольору */}
            <div className="absolute left-full top-0 ml-1 hidden group-hover/sub:flex flex-col gap-1.5 p-2 bg-[var(--interface-bg)] border border-[var(--interface-border)] shadow-2xl rounded-xl min-w-[140px] z-[var(--z-special)]">
              <div className="text-[9px] font-black uppercase text-muted-foreground px-1">Палітра</div>
              <div className="grid grid-cols-4 gap-1.5">
                {GROUP_COLORS.map(c => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => {
                      if (menu.nodeId) onSetGroupColor?.(menu.nodeId, c.value);
                      onClickOutside();
                    }}
                    className="w-6 h-6 rounded-full border border-white/20 hover:scale-110 transition-transform shadow cursor-pointer"
                    style={{ backgroundColor: c.value }}
                    title={c.name}
                  />
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Зміна іконки для звичайних нод */}
      {menu.type === 'node' && menu.nodeType !== 'groupNode' && (
        <div className="relative group/sub">
            <button
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-slate-200 hover:bg-primary/20 hover:text-primary rounded-lg transition-all group"
            >
              <div className="flex items-center gap-2.5">
                <Image size={14} className="text-muted-foreground group-hover:text-primary" />
                <span>Змінити іконку</span>
              </div>
              <ChevronRight size={12} className="text-muted-foreground/50" />
            </button>
            
            {/* Підменю іконок */}
            <div className="absolute left-full top-0 ml-1 hidden group-hover/sub:grid grid-cols-3 gap-1 p-2 bg-card/95 border border-border/50 shadow-2xl rounded-xl min-w-[120px]">
              {['Zap', 'Target', 'Cpu', 'MousePointer2', 'Keyboard', 'Search', 'Circle', 'Square', 'Package'].map(icon => (
                <button
                  key={icon}
                  onClick={() => { onSetCustomIcon?.(menu.nodeId!, icon); onClickOutside(); }}
                  className="p-2 hover:bg-primary/20 rounded-lg flex items-center justify-center transition-colors"
                  title={icon}
                >
                  {React.createElement(ICON_MAP[icon] || Image, { size: 16, className: "text-primary" })}
                </button>
              ))}
              <button
                onClick={() => { onSetCustomIcon?.(menu.nodeId!, undefined); onClickOutside(); }}
                className="col-span-3 py-1 text-[9px] uppercase font-black text-muted-foreground hover:text-primary transition-colors text-center"
              >
                Скинути
              </button>
            </div>
          </div>
      )}

      <div className="my-1 border-t border-border/30" />

      <button
        onClick={() => { onDeleteSelected(); onClickOutside(); }}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-destructive hover:bg-destructive/10 rounded-lg transition-all group"
      >
        <Trash2 size={14} className="text-destructive/70 group-hover:text-destructive" />
        <span>Видалити виділене</span>
      </button>
    </div>
  );
};
