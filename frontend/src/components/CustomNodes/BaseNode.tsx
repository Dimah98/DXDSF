import React, { useEffect } from 'react';
import { useUpdateNodeInternals } from '@xyflow/react';
import NodeHeader from './NodeHeader';
import { useExecutionStore } from '../../store/useExecutionStore';

/**
 * Єдиний стандарт портів (Handles).
 * ВАЖЛИВО: top — пікселі від верху ноди (включно з заголовком ~30px).
 */
export const getHandleStyle = (
  color: string,
  defaultTop: string | number = '20px',
  miniCollapsed: boolean = false
) => ({
  background: color,
  border: '2px solid rgba(255,255,255,0.25)',
  borderRadius: '50%',
  boxSizing: 'border-box' as const,
  width: 12,
  height: 12,
  zIndex: 10,
  // При міні-режимі — порти центруються на іконці
  top: miniCollapsed ? '50%' : defaultTop,
  transition: 'all 0.2s ease',
  cursor: 'crosshair',
});

interface BaseNodeProps {
  id: string;
  data: any;
  icon: React.ReactNode;
  title: string;
  bgColor: string;
  type: string;
  children: React.ReactNode;
  width?: string;
  className?: string;
}

const BaseNode: React.FC<BaseNodeProps> = ({
  id, data, icon, title, bgColor, type,
  children, width = 'w-64', className = '',
}) => {
  const updateNodeInternals = useUpdateNodeInternals();
  const isExecuting = useExecutionStore((s) => s.activeExecutingNodeId === id);

  // Оновлюємо позиції handles після анімації згортання
  useEffect(() => {
    updateNodeInternals(id);
    const t = setTimeout(() => updateNodeInternals(id), 320);
    return () => clearTimeout(t);
  }, [id, data.miniCollapsed, updateNodeInternals]);

  // Колір межі — hex або Tailwind
  const isTailwindColor = !bgColor.startsWith('#');
  const borderColorClass = isTailwindColor ? bgColor.replace('bg-', 'border-') : '';
  const borderColorStyle = !isTailwindColor ? { borderColor: bgColor } : {};

  const executingGlowStyle = isExecuting ? {
    boxShadow: '0 0 20px rgba(59, 130, 246, 0.8)',
    outline: '2px solid #3b82f6',
  } : {};

  // ── Режим міні-іконки ──────────────────────────────────────────────────────
  if (data.miniCollapsed) {
    return (
      // node-style-round → CSS ховає handles, але вони ЗАЛИШАЮТЬСЯ в DOM
      <div 
        className={`relative node-style-round ${className}`}
        style={executingGlowStyle}
      >
        {/* Іконка-заголовок (кнопка розгорнути) */}
        <NodeHeader id={id} icon={icon} title={title} data={data} bgColor={bgColor} type={type} />

        {/* Handles завжди в DOM — НЕ можна видаляти, інакше лінії обриваються */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            overflow: 'visible',
          }}
        >
          {children}
        </div>
      </div>
    );
  }

  // ── Повний режим ───────────────────────────────────────────────────────────
  return (
    <div
      className={`
        ${width} border-2 shadow-lg rounded-xl
        relative transition-all duration-300
        ${borderColorClass} ${className}
      `}
      style={{
        // Використовуємо --node-bg з персоналізації
        backgroundColor: 'var(--node-bg)',
        color: 'var(--interface-text-primary)',
        backdropFilter: 'blur(8px)',
        ...borderColorStyle,
        ...executingGlowStyle,
      }}
    >
      {/* Кольорова смужка зліва — акцент кольору ноди */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl opacity-70"
        style={{ backgroundColor: isTailwindColor ? undefined : bgColor }}
      />

      {/* Заголовок */}
      <NodeHeader id={id} icon={icon} title={title} data={data} bgColor={bgColor} type={type} />

      {/* Контент з вертикальним скролом */}
      <div className="nowheel nodrag select-text max-h-[440px] overflow-y-auto custom-scrollbar">
        {children}
      </div>
    </div>
  );
};

export default BaseNode;
