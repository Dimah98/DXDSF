// Панель глобальних налаштувань інтерфейсу
import { useState, useEffect } from 'react';
import { Settings, X, Palette, Square, Type, Map as MapIcon, Sidebar as SidebarIcon, CreditCard, MousePointer2, ClipboardList, AppWindow, Layers, Box, Circle } from 'lucide-react';

// Допоміжний компонент для рядка з вибором кольору
const ColorRow = ({ label, icon: Icon, value, onChange }: any) => (
  <div className="flex items-center justify-between py-1.5 group px-1">
    <div className="flex items-center gap-2 text-[11px] font-medium text-foreground/80 group-hover:text-foreground transition-colors">
      <Icon size={13} className="text-muted-foreground group-hover:text-primary transition-colors" />
      <span>{label}</span>
    </div>
    <div 
      className="relative w-6 h-6 rounded-md border border-border overflow-hidden cursor-pointer hover:ring-2 ring-primary ring-offset-1 ring-offset-background transition-all shrink-0"
      onClick={(e) => e.stopPropagation()} 
    >
      <input 
        type="color" 
        value={value} 
        onInput={(e: any) => onChange(e.target.value)} 
        onChange={(e: any) => onChange(e.target.value)} 
        className="absolute -inset-2 w-[150%] h-[150%] cursor-pointer bg-transparent border-none outline-none" 
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  </div>
);

// Допоміжний компонент для слайдера прозорості
const OpacityRow = ({ label, value, onChange }: any) => (
  <div className="space-y-1.5 py-1 px-1">
    <div className="flex justify-between items-center text-[10px] font-bold text-muted-foreground uppercase">
      <span>{label}</span>
      <span className="text-primary font-mono">{value}%</span>
    </div>
    <input 
      type="range" 
      min="10" 
      max="100" 
      value={value} 
      onChange={(e) => onChange(parseInt(e.target.value))} 
      className="w-full h-1 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
    />
  </div>
);

const GlobalSettings = ({ forceOpen, onOpenChange }: { forceOpen?: boolean, onOpenChange?: (open: boolean) => void }) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = forceOpen !== undefined ? forceOpen : internalOpen;
  const setIsOpen = onOpenChange || setInternalOpen;

  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('sfl_global_settings_v3');
    return saved ? JSON.parse(saved) : {
      sidebarColor: '#020617',
      mapColor: '#020617',
      nodeBodyColor: '#020617',
      nodeTitleColor: '#ffffff',
      inputBgColor: '#0f172a',
      inputTextColor: '#94a3b8',
      btnBgColor: '#1e293b',
      borderColor: '#1e293b',
      textColor: '#f1f5f9',
      sidebarTransparent: false,
      sidebarBorderTransparent: false,
      snapToGrid: true,
      nodeOpacity: 93,
      headerOpacity: 100,
      handleSize: 8,
      nodeStyle: 'standard' // 'standard' або 'round'
    };
  });

  useEffect(() => {
    localStorage.setItem('sfl_global_settings_v3', JSON.stringify(settings));
    
    const root = document.documentElement;
    const h = (hex: string) => hexToHsl(hex);

    root.style.setProperty('--global-sidebar-color', h(settings.sidebarColor));
    root.style.setProperty('--global-sidebar-bg-custom', settings.sidebarTransparent ? 'transparent' : `hsl(${h(settings.sidebarColor)})`);
    root.style.setProperty('--global-sidebar-border-custom', settings.sidebarBorderTransparent ? 'transparent' : `hsl(${h(settings.borderColor)})`);
    root.style.setProperty('--global-map-color', h(settings.mapColor));
    root.style.setProperty('--global-node-body-color', h(settings.nodeBodyColor));
    root.style.setProperty('--global-node-title-color', h(settings.nodeTitleColor));
    
    root.style.setProperty('--global-input-bg-color', `hsla(${h(settings.inputBgColor)} / var(--global-node-opacity))`);
    root.style.setProperty('--global-input-text-color', h(settings.inputTextColor));
    root.style.setProperty('--global-btn-bg-color', `hsla(${h(settings.btnBgColor)} / var(--global-node-opacity))`);
    root.style.setProperty('--global-text-color', h(settings.textColor));
    root.style.setProperty('--global-border-color', h(settings.borderColor));
    
    root.style.setProperty('--global-node-opacity', (settings.nodeOpacity / 100).toString());
    root.style.setProperty('--global-header-opacity', (settings.headerOpacity / 100).toString());
    root.style.setProperty('--global-handle-size', `${settings.handleSize || 8}px`);
    root.style.setProperty('--global-node-style', settings.nodeStyle);
    
    root.style.setProperty('--background', h(settings.mapColor));
    root.style.setProperty('--foreground', h(settings.textColor));
    root.style.setProperty('--card', h(settings.nodeBodyColor));
    root.style.setProperty('--border', h(settings.borderColor));
    root.style.setProperty('--muted', `hsla(${h(settings.inputBgColor)} / var(--global-node-opacity))`); 
    root.style.setProperty('--muted-foreground', h(settings.inputTextColor));
    root.style.setProperty('--accent', `hsla(${h(settings.btnBgColor)} / var(--global-node-opacity))`);

    window.dispatchEvent(new CustomEvent('global-settings-changed', { detail: settings }));
  }, [settings]);

  function hexToHsl(hex: string) {
    if (!hex) return '0 0% 0%';
    let r = parseInt(hex.slice(1, 3), 16) / 255;
    let g = parseInt(hex.slice(3, 5), 16) / 255;
    let b = parseInt(hex.slice(5, 7), 16) / 255;
    let max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s, l = (max + min) / 2;
    if (max === min) h = s = 0;
    else {
      let d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
  }

  const updateSetting = (key: string, value: any) => {
    setSettings((prev: any) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="relative">
      {forceOpen === undefined && (
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 rounded-full hover:bg-muted transition-all text-muted-foreground flex items-center gap-2"
          title="Налаштування інтерфейсу"
        >
          <Settings size={18} className={isOpen ? 'rotate-90 text-primary' : ''} />
        </button>
      )}

      {isOpen && (
        <div 
          className="fixed right-4 top-16 w-80 bg-card border border-border shadow-2xl rounded-2xl p-0 z-[200] animate-in fade-in slide-in-from-top-4 duration-300 text-card-foreground max-h-[85vh] flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()} 
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30 shrink-0">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-primary/10 rounded-lg text-primary">
                <Palette size={18} />
              </div>
              <h3 className="font-black uppercase tracking-wider text-xs">Персоналізація</h3>
            </div>
            <button onClick={() => setIsOpen(false)} className="hover:bg-muted p-1.5 rounded-full transition-colors"><X size={16} /></button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
            {/* Секція: Загальні */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2 px-1">
                 <AppWindow size={14} className="text-primary" />
                 <span className="text-[10px] font-black uppercase tracking-widest text-primary">Загальні</span>
              </div>
              
              <div className="space-y-1">
                <div className="space-y-2 py-1">
                  <ColorRow label="Панель (Sidebar)" icon={SidebarIcon} value={settings.sidebarColor} onChange={(v: string) => updateSetting('sidebarColor', v)} />
                  <div className="grid grid-cols-2 gap-2 ml-5">
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <input type="checkbox" checked={settings.sidebarTransparent} onChange={(e) => updateSetting('sidebarTransparent', e.target.checked)} className="rounded border-border text-primary focus:ring-primary w-3.5 h-3.5" />
                      <span className="text-[10px] text-muted-foreground group-hover:text-foreground transition-colors">Прозорий фон</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <input type="checkbox" checked={settings.sidebarBorderTransparent} onChange={(e) => updateSetting('sidebarBorderTransparent', e.target.checked)} className="rounded border-border text-primary focus:ring-primary w-3.5 h-3.5" />
                      <span className="text-[10px] text-muted-foreground group-hover:text-foreground transition-colors">Прозора межа</span>
                    </label>
                  </div>
                </div>

                <div className="space-y-2 py-1">
                  <ColorRow label="Робоче поле (Map)" icon={MapIcon} value={settings.mapColor} onChange={(v: string) => updateSetting('mapColor', v)} />
                  <label className="flex items-center gap-2 cursor-pointer group ml-5">
                    <input type="checkbox" checked={settings.snapToGrid} onChange={(e) => updateSetting('snapToGrid', e.target.checked)} className="rounded border-border text-primary focus:ring-primary w-3.5 h-3.5" />
                    <span className="text-[10px] text-muted-foreground group-hover:text-foreground transition-colors font-bold">Прив'язка до сітки</span>
                  </label>
                </div>

                <ColorRow label="Колір тексту" icon={Type} value={settings.textColor} onChange={(v: string) => updateSetting('textColor', v)} />
                <ColorRow label="Колір меж (Border)" icon={Square} value={settings.borderColor} onChange={(v: string) => updateSetting('borderColor', v)} />
              </div>
            </div>

            {/* Секція: Для нод */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-2 mb-2 px-1">
                 <Layers size={14} className="text-indigo-500" />
                 <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Для нод</span>
              </div>

              <div className="space-y-1">
                {/* Вибір стилю */}
                <div className="space-y-2 py-1 px-1">
                  <div className="text-[10px] font-bold text-muted-foreground uppercase mb-2">Стиль нод</div>
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      onClick={() => updateSetting('nodeStyle', 'standard')}
                      className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl border-2 transition-all ${settings.nodeStyle === 'standard' ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-muted-foreground/30'}`}
                    >
                      <Box size={14} />
                      <span className="text-[11px] font-bold">Стиль 1</span>
                    </button>
                    <button 
                      onClick={() => updateSetting('nodeStyle', 'round')}
                      className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl border-2 transition-all ${settings.nodeStyle === 'round' ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-muted-foreground/30'}`}
                    >
                      <Circle size={14} />
                      <span className="text-[11px] font-bold">Стиль 2</span>
                    </button>
                  </div>
                </div>

                <div className="h-px bg-border my-4 opacity-50" />

                <ColorRow label="Тіло ноди" icon={CreditCard} value={settings.nodeBodyColor} onChange={(v: string) => updateSetting('nodeBodyColor', v)} />
                <ColorRow label="Текст заголовка" icon={Type} value={settings.nodeTitleColor} onChange={(v: string) => updateSetting('nodeTitleColor', v)} />
                <ColorRow label="Фон полів (Input)" icon={ClipboardList} value={settings.inputBgColor} onChange={(v: string) => updateSetting('inputBgColor', v)} />
                <ColorRow label="Текст у полях" icon={Type} value={settings.inputTextColor} onChange={(v: string) => updateSetting('inputTextColor', v)} />
                <ColorRow label="Кнопки ноди" icon={MousePointer2} value={settings.btnBgColor} onChange={(v: string) => updateSetting('btnBgColor', v)} />
                
                <div className="pt-2 space-y-3">
                  <OpacityRow label="Прозорість фону" value={settings.nodeOpacity} onChange={(v: number) => updateSetting('nodeOpacity', v)} />
                  <OpacityRow label="Прозорість шапки" value={settings.headerOpacity} onChange={(v: number) => updateSetting('headerOpacity', v)} />
                  
                  <div className="space-y-1.5 py-1 px-1">
                    <div className="flex justify-between items-center text-[10px] font-bold text-muted-foreground uppercase">
                      <span>Розмір точок з'єднання</span>
                      <span className="text-primary font-mono">{settings.handleSize}px</span>
                    </div>
                    <input 
                      type="range" 
                      min="4" 
                      max="24" 
                      value={settings.handleSize} 
                      onChange={(e) => updateSetting('handleSize', parseInt(e.target.value))} 
                      className="w-full h-1 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 bg-muted/20 border-t border-border shrink-0">
            <button 
              onClick={() => {
                if(window.confirm('Ви впевнені, що хочете скинути всі налаштування?')) {
                  localStorage.removeItem('sfl_global_settings_v3');
                  window.location.reload();
                }
              }}
              className="w-full py-2 text-[10px] font-black uppercase tracking-widest text-destructive hover:bg-destructive/10 rounded-xl border border-destructive/20 transition-all active:scale-95"
            >
              Скинути до заводських
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default GlobalSettings;
