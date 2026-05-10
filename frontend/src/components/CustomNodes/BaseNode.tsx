import React, { useEffect } from 'react';
import { useUpdateNodeInternals } from '@xyflow/react';
import NodeHeader from './NodeHeader';

/**
 * Глобальна функція для стилізації портів (Handles).
 * Використовує наш преміальний стандарт 12px/-6px з 50% центруванням.
 */
export const getHandleStyle = (color: string, defaultTop: string | number = '20px', miniCollapsed: boolean = false) => ({
  background: color,
  backgroundClip: 'content-box' as const,
  padding: '1px',
  border: 'none',
  borderRadius: '50%',
  boxSizing: 'border-box' as const,
  zIndex: 10,
  top: miniCollapsed ? '50%' : defaultTop,
  left: miniCollapsed ? '50%' : undefined, // Центруємо по горизонталі
  right: miniCollapsed ? 'auto' : undefined,
  transform: miniCollapsed ? 'translate(-50%, -50%)' : 'none',
  transition: 'all 0.3s ease-in-out',
});

interface BaseNodeProps {
  id: string;
  data: any;
  icon: React.ReactNode;
  title: string;
  bgColor: string;
  type: string;
  children: React.ReactNode; // Внутрішній контент ноди
  width?: string;           // Кастомна ширина (за замовчуванням w-64)
  className?: string;       // Додаткові класи
}

/**
 * Базовий шаблон для всіх нод бота.
 * Відповідає за зовнішній вигляд, заголовок та стан згортання.
 */
const BaseNode: React.FC<BaseNodeProps> = ({ 
  id, 
  data, 
  icon, 
  title, 
  bgColor, 
  type, 
  children, 
  width = 'w-64',
  className = ''
}) => {
  const updateNodeInternals = useUpdateNodeInternals();

  // Оновлюємо внутрішні параметри ноди при зміні стану згортання
  // Це важливо для того, щоб лінії (edges) завжди сходилися в правильну точку
  useEffect(() => {
    updateNodeInternals(id);
    const timer = setTimeout(() => updateNodeInternals(id), 300); // Затримка для плавних анімацій
    return () => clearTimeout(timer);
  }, [id, data.miniCollapsed, updateNodeInternals]);

  // Визначаємо колір межі на основі фону заголовка
  const borderColor = bgColor.replace('bg-', 'border-');

  return (
    <div 
      className={`
        ${data.miniCollapsed ? 'w-auto border-none bg-transparent node-style-round' : `${width} border-2 shadow-xl`} 
        rounded-lg ${borderColor} text-card-foreground relative transition-all duration-300 ${className}
      `}
      style={!data.miniCollapsed ? { 
        backgroundColor: 'hsla(var(--card) / var(--global-node-opacity))',
        backdropFilter: 'blur(4px)'
      } : {}}
    >
      {/* Спільний заголовок з логікою згортання */}
      <NodeHeader 
        id={id} 
        icon={icon} 
        title={title} 
        data={data} 
        bgColor={bgColor} 
        type={type} 
      />
      
      {/* Контент ноди (порти та інпути) */}
      {children}
    </div>
  );
};

export default BaseNode;
