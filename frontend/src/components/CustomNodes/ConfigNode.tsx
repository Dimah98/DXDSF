import { memo, useEffect, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Settings, CheckCircle, XCircle } from 'lucide-react';
import BaseNode, { getHandleStyle } from './BaseNode';

interface SavedConfigLite {
  id: string;
  name: string;
  description?: string;
  rulesCount: number;
}

const ConfigNode = memo(({ id, data }: any) => {
  const [configs, setConfigs] = useState<SavedConfigLite[]>([]);
  const [loading, setLoading] = useState(false);
  const configId = data.configId;
  const selectedConfig = configs.find(c => c.id === configId);

  const fetchConfigs = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/configs');
      if (!res.ok) return;
      const json = await res.json();
      if (json.success && Array.isArray(json.configs)) {
        setConfigs(json.configs.map((c: any) => ({
          id: c.id,
          name: c.name,
          description: c.description,
          rulesCount: c.rules?.length || 0,
        })));
      }
    } catch (e) {
      console.error('Failed to fetch configs:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigs();
  }, []);

  const onOpenManager = () => {
    window.dispatchEvent(new CustomEvent('open-config-manager'));
  };

  return (
    <BaseNode id={id} data={data} icon={<Settings size={16} />} title="Конфігурація" bgColor="bg-cyan-600" type="configNode" width="w-64">
      <Handle type="target" position={Position.Left} id="execute" style={getHandleStyle('#06b6d4', data.miniCollapsed ? '50%' : '40px', data.miniCollapsed)} className="!left-[-6px]" />
      <Handle type="source" position={Position.Right} id="true" style={getHandleStyle('#22c55e', data.miniCollapsed ? '50%' : '60px', data.miniCollapsed)} className="!right-[-6px]" />
      <Handle type="source" position={Position.Right} id="false" style={getHandleStyle('#ef4444', data.miniCollapsed ? '50%' : '95px', data.miniCollapsed)} className="!right-[-6px]" />

      {!data.miniCollapsed && (
        <div className="p-3 space-y-3">
          <div className="flex gap-2">
            <select
              value={configId || ''}
              onChange={(e) => data.onDataChange(id, { configId: e.target.value || undefined })}
              className="flex-1 h-8 text-[11px] border-border bg-muted text-foreground rounded outline-none px-2"
            >
              <option value="">— Виберіть конфіг —</option>
              {configs.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.rulesCount} правил)
                </option>
              ))}
            </select>
            <button
              onClick={onOpenManager}
              title="Редактор конфігурацій"
              className="h-8 px-2 bg-muted border border-border rounded hover:bg-accent/20 transition-colors text-muted-foreground"
            >
              <Settings size={13} />
            </button>
          </div>

          {selectedConfig ? (
            <div className="bg-black/20 rounded-md p-2 border border-white/5 space-y-1">
              <div className="text-[10px] font-bold text-cyan-400 truncate">{selectedConfig.name}</div>
              {selectedConfig.description && (
                <div className="text-[9px] text-muted-foreground truncate">{selectedConfig.description}</div>
              )}
              <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
                <CheckCircle size={10} className="text-green-500" />
                <span>True</span>
                <span className="mx-1">·</span>
                <XCircle size={10} className="text-red-500" />
                <span>False</span>
              </div>
            </div>
          ) : (
            <div className="text-[10px] text-muted-foreground italic text-center py-2">
              Виберіть або створіть конфігурацію
            </div>
          )}

          {data.lastResult !== undefined && (
            <div className={`text-[10px] font-bold text-center py-1 rounded ${data.lastResult ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
              Останній запуск: {data.lastResult ? 'TRUE' : 'FALSE'}
            </div>
          )}

          {loading && configs.length === 0 && (
            <div className="text-[9px] text-muted-foreground text-center">Завантаження…</div>
          )}
        </div>
      )}
    </BaseNode>
  );
});

export default ConfigNode;
