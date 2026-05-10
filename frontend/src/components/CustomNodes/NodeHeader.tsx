// Загальний заголовок для всіх нод — з кнопками згортання, видалення, запуску та редагованим заголовком
import React, { useState, useRef, useEffect } from 'react';
import { Play, HelpCircle, Trash2, Maximize2 } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

interface NodeHeaderProps {
  id: string;
  icon: React.ReactNode;
  title: string;
  tooltip?: string;
  data: any;
  bgColor?: string; // Початковий колір
  type?: string;    // Тип ноди для динамічного кольору
}

const NodeHeader = ({ id, icon, title, tooltip, data, bgColor = 'bg-slate-400', type }: NodeHeaderProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempTitle, setTempTitle] = useState(data.label || title);
  const [currentBg, setCurrentBg] = useState(bgColor);
  const inputRef = useRef<HTMLInputElement>(null);

  // Слухаємо зміну кольорів категорій
  useEffect(() => {
    if (!type) return;
    
    const handleColorChange = (e: any) => {
      const colors = e.detail;
      if (colors[type]) {
        setCurrentBg(colors[type]);
      }
    };

    // Початкове завантаження
    const saved = localStorage.getItem('sfl_node_colors_hex');
    if (saved) {
      const colors = JSON.parse(saved);
      if (colors[type]) setCurrentBg(colors[type]);
    }

    window.addEventListener('node-colors-changed', handleColorChange);
    return () => window.removeEventListener('node-colors-changed', handleColorChange);
  }, [type]);

  useEffect(() => {
    if (data.label) setTempTitle(data.label);
  }, [data.label]);

  const saveTitle = () => {
    setIsEditing(false);
    if (data.onDataChange) {
      data.onDataChange(id, { label: tempTitle });
    }
  };

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const headerStyle = {
    backgroundColor: currentBg.startsWith('#') ? currentBg : undefined,
    color: 'hsl(var(--global-node-title-color))',
    opacity: 'var(--global-header-opacity)'
  };

  // Визначаємо іконку: кастомна або дефолтна
  const CustomIcon = data.customIcon ? (LucideIcons as any)[data.customIcon] : null;
  const displayIcon = CustomIcon ? <CustomIcon size={16} /> : icon;

  const [nodeStyle, setNodeStyle] = useState(() => {
    const saved = localStorage.getItem('sfl_global_settings_v3');
    return saved ? JSON.parse(saved).nodeStyle : 'standard';
  });

  // Слухаємо зміну глобальних налаштувань (стилю)
  useEffect(() => {
    const handleSettingsChange = (e: any) => {
      if (e.detail && e.detail.nodeStyle) {
        setNodeStyle(e.detail.nodeStyle);
      }
    };
    window.addEventListener('global-settings-changed', handleSettingsChange);
    return () => window.removeEventListener('global-settings-changed', handleSettingsChange);
  }, []);

  if (data.miniCollapsed) {
    const isRound = nodeStyle === 'round';
    return (
      <TooltipProvider>
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <div 
              className={`drag-handle w-10 h-10 ${isRound ? 'rounded-full' : 'rounded-lg'} flex items-center justify-center cursor-grab shadow-lg border-2 border-white/20 transition-all hover:scale-110 group relative animate-in zoom-in-50 duration-200`}
              style={{ backgroundColor: currentBg.startsWith('#') ? currentBg : undefined }}
              onClick={(e) => {
                if (e.detail === 2) data.onToggleMini && data.onToggleMini(id);
              }}
            >
              <div className="group-hover:hidden text-white">{displayIcon}</div>
              <button 
                onClick={(e) => { e.stopPropagation(); data.onToggleMini && data.onToggleMini(id); }}
                className="hidden group-hover:flex text-white"
              >
                <Maximize2 size={18} />
              </button>
              
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-background hidden group-data-[running=true]:block" />
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-[10px] font-bold uppercase tracking-wider">
            {data.label || title}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div 
      className={`${!currentBg.startsWith('#') ? currentBg : ''} drag-handle cursor-grab p-2 flex items-center justify-between font-bold shadow-sm rounded-t-[6px] transition-colors duration-500`}
      style={headerStyle}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div className="shrink-0">{displayIcon}</div>

        {isEditing ? (
          <input
            ref={inputRef}
            value={tempTitle}
            onChange={(e) => setTempTitle(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => e.key === 'Enter' && saveTitle()}
            className="bg-white/20 border-none outline-none text-[12px] px-1 rounded w-full text-white placeholder:text-white/50"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span 
            className="text-[12px] truncate cursor-text hover:bg-white/10 px-1 rounded transition-colors flex-1"
            onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
            title="Клікніть, щоб змінити назву"
          >
            {data.label || title}
          </span>
        )}
      </div>

      <div className="flex items-center gap-0.5 shrink-0 ml-2">
        <button onClick={() => data.onRunNode && data.onRunNode(id)} className="p-1 hover:bg-white/20 rounded transition-colors" title="Запустити"><Play size={12} fill="currentColor" /></button>
        {tooltip && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="p-1 hover:bg-white/20 rounded cursor-help"><HelpCircle size={12} /></div>
              </TooltipTrigger>
              <TooltipContent className="max-w-[200px] text-[11px]">{tooltip}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); data.onToggleMini && data.onToggleMini(id); }}
          className="p-1 hover:bg-white/20 rounded transition-colors"
          title="Згорнути в міні-режим"
        >
          <Maximize2 size={12} className="rotate-45" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); data.onDeleteNode && data.onDeleteNode(id); }}
          className="p-1 hover:bg-red-400/80 rounded transition-colors ml-0.5"
          title="Видалити"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
};

export default NodeHeader;
