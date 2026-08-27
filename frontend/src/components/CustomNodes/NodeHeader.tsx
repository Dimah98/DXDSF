import React, { useState, useRef, useEffect } from 'react';
import { Play, HelpCircle, Trash2, Minimize2 } from 'lucide-react';
import { getDynamicIcon } from '../../utils/dynamicIcon';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { NODE_CONFIG } from '../../nodeConfig';

interface NodeHeaderProps {
  id: string;
  icon: React.ReactNode;
  title: string;
  tooltip?: string; // Залишаємо для зворотної сумісності
  data: any;
  bgColor?: string;
  type?: string;
}

import { useUIStore } from '../../store/useUIStore';
import { useGlobalSettingsStore } from '../../store/useGlobalSettingsStore';

const NodeHeader = ({ id, icon, title, tooltip, data, bgColor = 'bg-slate-400', type }: NodeHeaderProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempTitle, setTempTitle] = useState(data.label || title);
  const [currentBg, setCurrentBg] = useState(bgColor);
  const inputRef = useRef<HTMLInputElement>(null);

  const storeColors = useUIStore((s) => s.nodeColors);
  const globalNodeStyle = useGlobalSettingsStore((s) => s.settings?.nodeStyle);

  // Опис ноди для кнопки "?": hint — розгорнутий текст з NODE_CONFIG
  const nodeDesc = tooltip || (type ? NODE_CONFIG[type]?.hint : undefined);

  // Слухаємо зміну кольорів категорій
  useEffect(() => {
    if (!type) return;
    if (storeColors[type]) {
      setCurrentBg(storeColors[type]);
      return;
    }
    const handleColorChange = (e: any) => {
      if (e.detail?.[type]) setCurrentBg(e.detail[type]);
    };
    const saved = localStorage.getItem('sfl_node_colors_hex');
    if (saved) {
      const colors = JSON.parse(saved);
      if (colors[type]) setCurrentBg(colors[type]);
    }
    window.addEventListener('node-colors-changed', handleColorChange);
    return () => window.removeEventListener('node-colors-changed', handleColorChange);
  }, [type, storeColors]);

  useEffect(() => {
    if (data.label) setTempTitle(data.label);
  }, [data.label]);

  const saveTitle = () => {
    setIsEditing(false);
    data.onDataChange?.(id, { label: tempTitle });
  };

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Заголовок: hex-колір або Tailwind-клас (прозорий завдяки color-mix)
  const headerStyle = {
    backgroundColor: currentBg.startsWith('#') 
      ? `color-mix(in srgb, ${currentBg} calc(var(--global-header-opacity) * 100%), transparent)` 
      : undefined,
    // Використовуємо --node-title з персоналізації
    color: 'var(--node-title, #ffffff)',
    backdropFilter: 'blur(4px)',
  };

  // Кастомна або дефолтна іконка
  const CustomIcon = getDynamicIcon(data.customIcon);
  const displayIcon = CustomIcon ? <CustomIcon size={14} /> : icon;

  const [nodeStyle, setNodeStyle] = useState(() => {
    const saved = localStorage.getItem('sfl_global_settings_v4');
    return saved ? JSON.parse(saved).nodeStyle : 'standard';
  });

  useEffect(() => {
    if (globalNodeStyle) {
      setNodeStyle(globalNodeStyle);
      return;
    }
    const handleSettingsChange = (e: any) => {
      if (e.detail?.nodeStyle) setNodeStyle(e.detail.nodeStyle);
    };
    window.addEventListener('global-settings-changed', handleSettingsChange);
    return () => window.removeEventListener('global-settings-changed', handleSettingsChange);
  }, [globalNodeStyle]);

  // ─── Мінімізований режим (міні-нода) ────────────────────────────────────────
  if (data.miniCollapsed) {
    const isRound = nodeStyle === 'round';
    return (
      <TooltipProvider>
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <div
              className={`drag-handle w-10 h-10 ${isRound ? 'rounded-full' : 'rounded-xl'} flex items-center justify-center cursor-grab shadow-lg border-2 border-white/20 transition-all hover:scale-110 group relative animate-in zoom-in-50 duration-200`}
              style={{ backgroundColor: currentBg.startsWith('#') ? currentBg : undefined }}
            >
              {/* Іконка нормального стану */}
              <div className="group-hover:hidden text-white">{displayIcon}</div>
              {/* Кнопка розгорнути при hover */}
              <button
                onClick={(e) => { e.stopPropagation(); data.onToggleMini?.(id); }}
                className="hidden group-hover:flex items-center justify-center text-white"
                title="Розгорнути"
              >
                <Minimize2 size={16} className="rotate-45" />
              </button>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-[10px] font-bold uppercase tracking-wider">
            {data.label || title}
            {nodeDesc && <div className="text-[9px] font-normal opacity-70 mt-0.5">{nodeDesc}</div>}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // ─── Звичайний заголовок ─────────────────────────────────────────────────────
  return (
    <div
      className={`${!currentBg.startsWith('#') ? currentBg : ''} drag-handle cursor-grab px-2 py-1.5 flex items-center justify-between rounded-t-[6px] transition-colors duration-500`}
      style={headerStyle}
    >
      {/* Ліва частина: іконка + назва */}
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        <div className="shrink-0 opacity-90">{displayIcon}</div>

        {isEditing ? (
          <input
            ref={inputRef}
            value={tempTitle}
            onChange={(e) => setTempTitle(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => e.key === 'Enter' && saveTitle()}
            className="nodrag bg-white/20 border-none outline-none text-[11px] font-bold px-1 rounded w-full text-white placeholder:text-white/50"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className="text-[11px] font-bold truncate cursor-text hover:bg-white/10 px-1 py-0.5 rounded transition-colors flex-1 leading-tight"
            onDoubleClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
            title="Подвійний клік — змінити назву"
          >
            {data.label || title}
          </span>
        )}
      </div>

      {/* Права частина: кнопки дій */}
      <div className="flex items-center shrink-0 ml-1">
        {/* ▶ Запустити */}
        <TooltipProvider>
          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <button
                onClick={(e) => { e.stopPropagation(); data.onRunNode?.(id); }}
                className="p-1 hover:bg-white/20 rounded transition-colors text-white/80 hover:text-white"
              >
                <Play size={11} fill="currentColor" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-[10px]">Запустити з цієї ноди</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* ? Опис ноди — автоматично з NODE_CONFIG */}
        {nodeDesc && (
          <TooltipProvider>
            <Tooltip delayDuration={100}>
              <TooltipTrigger asChild>
                <button
                  className="p-1 hover:bg-white/20 rounded transition-colors text-white/60 hover:text-white"
                  onClick={(e) => e.stopPropagation()}
                >
                  <HelpCircle size={11} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[220px] text-[11px] leading-relaxed">
                <div className="font-bold mb-0.5 text-primary">{data.label || title}</div>
                {nodeDesc}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* ⊞ Згорнути */}
        <TooltipProvider>
          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <button
                onClick={(e) => { e.stopPropagation(); data.onToggleMini?.(id); }}
                className="p-1 hover:bg-white/20 rounded transition-colors text-white/80 hover:text-white"
              >
                <Minimize2 size={11} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-[10px]">Згорнути в міні-режим</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* 🗑 Видалити */}
        <TooltipProvider>
          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <button
                onClick={(e) => { e.stopPropagation(); data.onDeleteNode?.(id); }}
                className="p-1 hover:bg-red-500/60 rounded transition-colors text-white/60 hover:text-white ml-0.5"
              >
                <Trash2 size={11} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-[10px] text-red-400">Видалити ноду</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
};

export default NodeHeader;
