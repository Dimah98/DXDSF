import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { LogOut } from 'lucide-react';
import { getHandleStyle } from './BaseNode';

// Вихідна точка всередині контейнера GroupNode
// Ця нода не може бути видалена — вона прив'язана до зовнішнього вихідного порту
const SubExitNode = memo(({ data }: any) => {
  return (
    <div className="flex flex-col items-center gap-1 select-none">
      {/* Вхідний порт (приймає сигнал від внутрішніх нод) */}
      <Handle
        type="target"
        position={Position.Left}
        id="in"
        style={getHandleStyle('#ef4444', '50%')}
        className="!left-[-6px]"
      />

      {/* Тіло ноди */}
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg border-2 border-red-400/50"
        style={{ background: 'linear-gradient(135deg, #dc2626, #ef4444)' }}
      >
        <LogOut size={16} className="text-white" />
      </div>
      <span className="text-[9px] font-bold text-red-400 uppercase tracking-wider">Вихід</span>
    </div>
  );
});

export default SubExitNode;
