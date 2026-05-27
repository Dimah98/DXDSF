import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { LogIn } from 'lucide-react';
import { getHandleStyle } from './BaseNode';

// Вхідна точка всередині контейнера GroupNode
// Ця нода не може бути видалена — вона прив'язана до зовнішнього вхідного порту
const SubEntryNode = memo(({ data }: any) => {
  return (
    <div className="flex flex-col items-center gap-1 select-none">
      {/* Вихідний порт (передає сигнал далі всередині контейнера) */}
      <Handle
        type="source"
        position={Position.Right}
        id="out"
        style={getHandleStyle('#22c55e', '50%')}
        className="!right-[-6px]"
      />

      {/* Тіло ноди */}
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg border-2 border-green-400/50"
        style={{ background: 'linear-gradient(135deg, #16a34a, #22c55e)' }}
      >
        <LogIn size={16} className="text-white" />
      </div>
      <span className="text-[9px] font-bold text-green-400 uppercase tracking-wider">Вхід</span>
    </div>
  );
});

export default SubEntryNode;
