// Панель глобальних налаштувань інтерфейсу
import { useState, useEffect } from 'react';
import { Settings, X, Palette, AppWindow, Layers, Type, Square, CreditCard, ClipboardList, Monitor, ImageOff, Globe, Camera, Grid3x3 } from 'lucide-react';

const ColorRow = ({ label, icon: Icon, value, onChange }: any) => (
  <div className="flex items-center justify-between py-1.5 group px-1">
    <div className="flex items-center gap-2 text-[11px] font-medium text-slate-300 group-hover:text-white transition-colors">
      <Icon size={13} className="text-slate-500 group-hover:text-blue-400 transition-colors" />
      <span>{label}</span>
    </div>
    <div 
      className="relative w-6 h-6 rounded-md border border-border overflow-hidden cursor-pointer hover:ring-2 ring-blue-500 ring-offset-1 ring-offset-background transition-all shrink-0"
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

const OpacityRow = ({ label, value, onChange }: any) => (
  <div className="space-y-1.5 py-1 px-1">
    <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase">
      <span>{label}</span>
      <span className="text-blue-400 font-mono">{value}%</span>
    </div>
    <input 
      type="range" 
      min="0" 
      max="100" 
      value={value} 
      onChange={(e) => onChange(parseInt(e.target.value))} 
      className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
    />
  </div>
);

const GlobalSettings = ({ forceOpen, onOpenChange }: { forceOpen?: boolean, onOpenChange?: (open: boolean) => void }) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = forceOpen !== undefined ? forceOpen : internalOpen;
  const setIsOpen = onOpenChange || setInternalOpen;

  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('sfl_global_settings_v4');
    // Дефолтні значення
    return saved ? JSON.parse(saved) : {
      interfaceColor: '#0a0f1e',
      interfaceOpacity: 90,
      interfaceBorderColor: '#3b82f6',
      interfaceBorderTransparent: false,
      primaryTextColor: '#f8fafc',
      secondaryTextColor: '#94a3b8',
      mapColor: '#020617',
      nodeBodyColor: '#1e293b',
      nodeOpacity: 93,
      inputBgColor: '#0f172a',
      inputBgOpacity: 100,
      nodeTitleColor: '#ffffff',
      inputTextColor: '#cbd5e1',
      disableImages: false,
      photoDebug: true,
      snapToGrid: true
    };
  });

  useEffect(() => {
    localStorage.setItem('sfl_global_settings_v4', JSON.stringify(settings));
    
    const root = document.documentElement;
    const h = (hex: string) => hexToHsl(hex);

    // Змінні для Інтерфейсу
    root.style.setProperty('--interface-bg', `hsla(${h(settings.interfaceColor)} / ${settings.interfaceOpacity}%)`);
    root.style.setProperty('--interface-border', settings.interfaceBorderTransparent ? 'transparent' : `hsla(${h(settings.interfaceBorderColor)} / 40%)`);
    root.style.setProperty('--interface-text-primary', `hsl(${h(settings.primaryTextColor)})`);
    root.style.setProperty('--interface-text-secondary', `hsl(${h(settings.secondaryTextColor)})`);
    root.style.setProperty('--map-bg', `hsl(${h(settings.mapColor)})`);

    // Змінні для Нод
    root.style.setProperty('--node-bg', `hsla(${h(settings.nodeBodyColor)} / ${settings.nodeOpacity}%)`);
    root.style.setProperty('--node-input-bg', `hsla(${h(settings.inputBgColor)} / ${settings.inputBgOpacity}%)`);
    root.style.setProperty('--node-title', `hsl(${h(settings.nodeTitleColor)})`);
    root.style.setProperty('--node-input-text', `hsl(${h(settings.inputTextColor)})`);
    
    // Стандартні Tailwind змінні (для сумісності)
    root.style.setProperty('--background', h(settings.mapColor));
    root.style.setProperty('--foreground', h(settings.primaryTextColor));
    root.style.setProperty('--border', h(settings.interfaceBorderColor));

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
          className="p-2 rounded-full hover:bg-slate-800 transition-all text-slate-400 flex items-center gap-2"
          title="Налаштування інтерфейсу"
        >
          <Settings size={18} className={isOpen ? 'rotate-90 text-blue-500' : ''} />
        </button>
      )}

      {isOpen && (
        <div 
          className="fixed inset-0 z-[400] flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setIsOpen(false)}
        >
          <div 
            className="flex flex-col w-full max-w-lg rounded-2xl border bg-transparent backdrop-blur-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 max-h-[85vh]"
            style={{ 
              backgroundColor: `hsla(${hexToHsl(settings.interfaceColor)} / ${settings.interfaceOpacity}%)`,
              borderColor: settings.interfaceBorderTransparent ? 'transparent' : `hsla(${hexToHsl(settings.interfaceBorderColor)} / 40%)`
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-500/20 rounded-lg text-blue-400">
                  <Palette size={18} />
                </div>
                <h3 className="font-black uppercase tracking-wider text-xs text-slate-200">Вікно персоналізації</h3>
              </div>
              <button onClick={() => setIsOpen(false)} className="hover:bg-white/10 text-slate-400 p-1.5 rounded-full transition-colors"><X size={16} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {/* Секція: Інтерфейс */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-2 px-1">
                   <AppWindow size={14} className="text-blue-400" />
                   <span className="text-[10px] font-black uppercase tracking-widest text-blue-400">Інтерфейс</span>
                </div>
                
                <div className="space-y-1">
                  <ColorRow label="Колір інтерфейсу" icon={Monitor} value={settings.interfaceColor} onChange={(v: string) => updateSetting('interfaceColor', v)} />
                  <OpacityRow label="Шкала прозорості інтерфейсу" value={settings.interfaceOpacity} onChange={(v: number) => updateSetting('interfaceOpacity', v)} />
                  
                  <div className="h-px bg-white/5 my-3" />

                  <ColorRow label="Колір обводу інтерфейсу" icon={Square} value={settings.interfaceBorderColor} onChange={(v: string) => updateSetting('interfaceBorderColor', v)} />
                  <label className="flex items-center justify-between p-2 rounded-xl hover:bg-white/5 cursor-pointer transition-colors border border-transparent">
                    <span className="text-[11px] text-slate-300">Прозора обводка</span>
                    <input 
                      type="checkbox" 
                      checked={settings.interfaceBorderTransparent} 
                      onChange={(e) => updateSetting('interfaceBorderTransparent', e.target.checked)} 
                      className="rounded border-white/20 text-blue-500 focus:ring-blue-500 bg-black/20" 
                    />
                  </label>

                  <div className="h-px bg-white/5 my-3" />

                  <ColorRow label="Колір головного тексту" icon={Type} value={settings.primaryTextColor} onChange={(v: string) => updateSetting('primaryTextColor', v)} />
                  <ColorRow label="Колір звичайного тексту" icon={Type} value={settings.secondaryTextColor} onChange={(v: string) => updateSetting('secondaryTextColor', v)} />
                  
                  <div className="h-px bg-white/5 my-3" />

                  <ColorRow label="Колір робочого поля" icon={AppWindow} value={settings.mapColor} onChange={(v: string) => updateSetting('mapColor', v)} />
                </div>
              </div>

              {/* Секція: Для нод */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2 mb-2 px-1">
                   <Layers size={14} className="text-indigo-400" />
                   <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Ноди</span>
                </div>

                <div className="space-y-1">
                  <ColorRow label="Колір тіла ноди" icon={CreditCard} value={settings.nodeBodyColor} onChange={(v: string) => updateSetting('nodeBodyColor', v)} />
                  <OpacityRow label="Шкала прозорості тіла ноди" value={settings.nodeOpacity} onChange={(v: number) => updateSetting('nodeOpacity', v)} />
                  
                  <div className="h-px bg-white/5 my-3" />

                  <ColorRow label="Колір фону полів" icon={ClipboardList} value={settings.inputBgColor} onChange={(v: string) => updateSetting('inputBgColor', v)} />
                  <OpacityRow label="Шкала прозорості фону полів" value={settings.inputBgOpacity} onChange={(v: number) => updateSetting('inputBgOpacity', v)} />

                  <div className="h-px bg-white/5 my-3" />

                  <ColorRow label="Колір тексту заголовка" icon={Type} value={settings.nodeTitleColor} onChange={(v: string) => updateSetting('nodeTitleColor', v)} />
                  <ColorRow label="Колір тексту у полях" icon={Type} value={settings.inputTextColor} onChange={(v: string) => updateSetting('inputTextColor', v)} />
                </div>
              </div>

              {/* Секція: Браузер */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2 mb-2 px-1">
                   <Globe size={14} className="text-green-400" />
                   <span className="text-[10px] font-black uppercase tracking-widest text-green-400">Браузер</span>
                </div>

                <div className="space-y-1">
                    <label className="flex items-center justify-between p-2 rounded-xl hover:bg-white/5 cursor-pointer transition-colors border border-transparent">
                      <div className="flex items-center gap-2 text-[11px] font-medium text-slate-300">
                        <ImageOff size={13} className="text-slate-500" />
                        <span>Вимкнути завантаження картинок (економія трафіку)</span>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={settings.disableImages} 
                        onChange={(e) => updateSetting('disableImages', e.target.checked)} 
                        className="rounded border-white/20 text-blue-500 focus:ring-blue-500 bg-black/20" 
                      />
                    </label>

                    <label className="flex items-center justify-between p-2 rounded-xl hover:bg-white/5 cursor-pointer transition-colors border border-transparent">
                      <div className="flex items-center gap-2 text-[11px] font-medium text-slate-300">
                        <Camera size={13} className="text-slate-500" />
                        <span>Фото-дебаг (зберігати скріншоти)</span>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={settings.photoDebug !== false} 
                        onChange={(e) => updateSetting('photoDebug', e.target.checked)} 
                        className="rounded border-white/20 text-blue-500 focus:ring-blue-500 bg-black/20" 
                      />
                    </label>
                  </div>
                </div>

                {/* Секція: Редактор */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-2 mb-2 px-1">
                     <Grid3x3 size={14} className="text-amber-400" />
                     <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">Редактор</span>
                  </div>

                  <div className="space-y-1">
                    <label className="flex items-center justify-between p-2 rounded-xl hover:bg-white/5 cursor-pointer transition-colors border border-transparent">
                      <div className="flex items-center gap-2 text-[11px] font-medium text-slate-300">
                        <Grid3x3 size={13} className="text-slate-500" />
                        <span>Прив'язка до сітки (Snap to grid)</span>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={settings.snapToGrid !== false} 
                        onChange={(e) => updateSetting('snapToGrid', e.target.checked)} 
                        className="rounded border-white/20 text-amber-500 focus:ring-amber-500 bg-black/20" 
                      />
                    </label>
                  </div>
                </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-black/20 border-t border-white/10 shrink-0">
              <button 
                onClick={() => {
                  if(window.confirm('Ви впевнені, що хочете скинути всі налаштування?')) {
                    localStorage.removeItem('sfl_global_settings_v4');
                    window.location.reload();
                  }
                }}
                className="w-full py-2.5 text-[11px] font-black uppercase tracking-widest text-red-400 hover:bg-red-950/30 rounded-xl border border-red-900/50 transition-all active:scale-95"
              >
                Скинути до заводських
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GlobalSettings;
