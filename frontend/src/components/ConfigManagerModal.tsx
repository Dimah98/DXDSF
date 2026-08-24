import React, { useEffect, useState, useCallback } from 'react';
import { X, Plus, Trash2, Save, Settings } from 'lucide-react';

interface ConfigRule {
  id: string;
  file: string;
  path: string;
  operator: string;
  value?: string | number;
  rightType?: 'value' | 'path';
  rightFile?: string;
  rightPath?: string;
  outputVar?: string;
  required?: boolean;  // true=обов'язкове (AND), false=хоча б одна (OR)
}

interface SavedConfig {
  id: string;
  name: string;
  enabled: boolean;
  rules: ConfigRule[];
  subConfigs?: SavedConfig[];
  createdAt: number;
  updatedAt: number;
}

const OPERATORS = [
  { value: '>', label: '> (більше)' },
  { value: '<', label: '< (менше)' },
  { value: '==', label: '== (дорівнює)' },
  { value: '>=', label: '>= (більше або рівно)' },
  { value: '<=', label: '<= (менше або рівно)' },
  { value: '!=', label: '!= (не дорівнює)' },
  { value: 'exists', label: 'Існує (exists)' },
  { value: 'not_exists', label: 'Не існує (not_exists)' },
  { value: 'read', label: 'Прочитати (read)' },
  { value: 'read_delete', label: 'Прочитати і видалити (read_delete)' },
  { value: 'contains', label: 'Містить текст (contains)' },
  { value: 'starts_with', label: 'Починається з (starts_with)' },
  { value: 'ends_with', label: 'Закінчується на (ends_with)' },
  { value: 'matches', label: 'Regex (matches)' },
  { value: 'time_before', label: 'Час < зараз (time_before)' },
  { value: 'time_after', label: 'Час > зараз (time_after)' },
  { value: 'time_equals', label: 'Час ≈ зараз (time_equals)' },
  { value: 'time_is_today', label: 'Дата = сьогодні (time_is_today)' },
  { value: 'time_not_today', label: 'Дата ≠ сьогодні (time_not_today)' },
];

const FILE_ALIASES = [
  { value: '(save)', label: '(save) — _save.json проекту' },
  { value: '(stats)', label: '(stats) — _stats.json проекту' },
  { value: 'custom', label: 'Інший файл…' },
];

let ruleIdCounter = 0;
const genRuleId = () => `rule_${Date.now()}_${++ruleIdCounter}`;

export default function ConfigManagerModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [configs, setConfigs] = useState<SavedConfig[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [subConfigs, setSubConfigs] = useState<SavedConfig[]>([]);
  const [rules, setRules] = useState<ConfigRule[]>([]);

  const selectedConfig = configs.find(c => c.id === selectedConfigId);

  const fetchConfigs = useCallback(async () => {
    try {
      const res = await fetch('/api/configs');
      if (!res.ok) return;
      const json = await res.json();
      if (json.success) setConfigs(json.configs || []);
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    const handler = () => { setIsOpen(true); fetchConfigs(); };
    window.addEventListener('open-config-manager', handler);
    return () => window.removeEventListener('open-config-manager', handler);
  }, [fetchConfigs]);

  useEffect(() => {
    if (selectedConfig) {
      setName(selectedConfig.name);
      setEnabled(selectedConfig.enabled !== false);
      setSubConfigs(selectedConfig.subConfigs ? selectedConfig.subConfigs.map(s => ({ ...s })) : []);
      setRules(selectedConfig.rules.map(r => ({ ...r })));
    } else {
      setName('');
      setEnabled(true);
      setSubConfigs([]);
      setRules([]);
    }
  }, [selectedConfigId, selectedConfig]);

  const createNew = () => {
    setSelectedConfigId(null);
    setName('Нова конфігурація');
    setEnabled(true);
    setSubConfigs([]);
    setRules([
      { id: genRuleId(), file: '(save)', path: '$.visitedFarmState.inventory.Wood', operator: '>', value: 50, rightType: 'value', required: true },
    ]);
  };

  const saveConfig = async () => {
    if (!name.trim()) return;
    setIsSaving(true);
    try {
      const body = { name: name.trim(), enabled, rules, subConfigs };
      let res;
      if (selectedConfigId) {
        res = await fetch(`/api/configs/${selectedConfigId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch('/api/configs', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }
      if (res.ok) {
        await fetchConfigs();
        const json = await res.json();
        if (json.config?.id) setSelectedConfigId(json.config.id);
      }
    } catch (e) { console.error(e); }
    setIsSaving(false);
  };

  const deleteConfig = async (id: string) => {
    if (!confirm('Видалити цю конфігурацію?')) return;
    try {
      const res = await fetch(`/api/configs/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setConfigs(prev => prev.filter(c => c.id !== id));
        if (selectedConfigId === id) setSelectedConfigId(null);
      }
    } catch (e) { console.error(e); }
  };

  const addRule = () => {
    setRules(prev => [...prev, {
      id: genRuleId(),
      file: '(save)',
      path: '',
      operator: '>',
      value: '',
      rightType: 'value',
      outputVar: '',
      required: true,
    }]);
  };

  const updateRule = (id: string, patch: Partial<ConfigRule>) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
  };

  const removeRule = (id: string) => {
    setRules(prev => prev.filter(r => r.id !== id));
  };

  const needsValue = (op: string) => !['exists', 'not_exists', 'read', 'read_delete'].includes(op);
  const needsOutputVar = (op: string) => ['read', 'read_delete'].includes(op);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[var(--z-modal)] bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col" style={{ background: 'linear-gradient(145deg, #0f172a, #1e293b)' }}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700/50" style={{ background: 'linear-gradient(90deg, #1e1b4b, #0f172a)' }}>
          <div className="flex items-center gap-2">
            <Settings size={18} className="text-indigo-400" />
            <h2 className="text-sm font-bold text-white">Редактор конфігурацій</h2>
          </div>
          <button onClick={() => setIsOpen(false)} className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar — list of configs */}
          <div className="w-56 border-r border-slate-700/50 flex flex-col bg-slate-950/50">
            <div className="p-3 border-b border-border">
              <button
                onClick={createNew}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[11px] font-bold transition-colors"
              >
                <Plus size={13} /> Нова
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {configs.map(c => (
                <button
                  key={c.id}
                  onClick={() => setSelectedConfigId(c.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-[11px] transition-colors ${selectedConfigId === c.id ? 'bg-indigo-500/20 text-indigo-400 font-bold border border-indigo-500/30' : 'hover:bg-white/5 text-slate-300'}`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${c.enabled !== false ? 'bg-green-400' : 'bg-red-400'}`} />
                    <span className="truncate">{c.name}</span>
                  </div>
                  <div className="text-[9px] text-muted-foreground">{c.rules.length} правил{c.subConfigs?.length ? `, ${c.subConfigs.length} підконф` : ''}</div>
                </button>
              ))}
              {configs.length === 0 && (
                <div className="text-[10px] text-muted-foreground text-center py-4 italic">Немає конфігурацій</div>
              )}
            </div>
          </div>

          {/* Main editor */}
          <div className="flex-1 flex flex-col overflow-hidden bg-slate-900">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Name & Description */}
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Назва конфігурації</label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Наприклад: Перевірка ресурсів"
                    className="w-full h-9 px-3 text-sm bg-muted border border-border rounded-lg text-foreground outline-none focus:border-cyan-500"
                  />
                </div>
                <div className="flex items-center gap-3 pt-1">
                  <button
                    onClick={() => setEnabled(v => !v)}
                    className={`relative h-6 w-11 rounded-full transition-colors ${enabled ? 'bg-indigo-500' : 'bg-slate-700'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                  <span className="text-[11px] font-bold text-white">{enabled ? '✅ Активна' : '🚹 Вимкнена'}</span>
                </div>
              </div>

              {/* Rules */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Правила (обов&apos;язкові — AND, хоча б одна — OR)</label>
                  <button
                    onClick={addRule}
                    className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold bg-slate-800 border border-slate-700 rounded hover:bg-slate-700 transition-colors text-white"
                  >
                    <Plus size={11} /> Додати
                  </button>
                </div>

                <div className="space-y-2">
                  {rules.map((rule, idx) => (
                    <div key={rule.id} className="bg-muted/30 border border-border rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-cyan-400">#{idx + 1}</span>
                          <button
                            onClick={() => updateRule(rule.id, { required: rule.required === false })}
                            className={`text-[9px] font-bold px-2 py-0.5 rounded border transition-colors ${
                              rule.required !== false
                                ? 'bg-red-500/20 text-red-400 border-red-500/40'
                                : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                            }`}
                            title={rule.required !== false ? "Обов'язкове (AND)" : "Хоча б одна (OR)"}
                          >
                            {rule.required !== false ? "● Обов'язкове" : "○ Хоча б одна"}
                          </button>
                        </div>
                        <button onClick={() => removeRule(rule.id)} className="text-muted-foreground hover:text-red-400 transition-colors">
                          <Trash2 size={12} />
                        </button>
                      </div>

                      <div className="space-y-2">
                        {/* Left side (A) */}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[9px] text-muted-foreground mb-0.5 block">Файл A</label>
                            <select
                              value={rule.file.startsWith('(') ? rule.file : 'custom'}
                              onChange={e => {
                                const val = e.target.value;
                                if (val === 'custom') updateRule(rule.id, { file: '' });
                                else updateRule(rule.id, { file: val });
                              }}
                              className="w-full h-8 text-[11px] bg-muted border border-border rounded px-2 outline-none"
                            >
                              {FILE_ALIASES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                            </select>
                            {(rule.file === '' || (!rule.file.startsWith('(') && rule.file !== 'custom')) && (
                              <input
                                type="text"
                                value={rule.file === 'custom' ? '' : rule.file}
                                onChange={e => updateRule(rule.id, { file: e.target.value })}
                                placeholder="data.json"
                                className="w-full h-8 mt-1 text-[11px] bg-muted border border-border rounded px-2 outline-none"
                              />
                            )}
                          </div>
                          <div>
                            <label className="text-[9px] text-muted-foreground mb-0.5 block">Оператор</label>
                            <select
                              value={rule.operator}
                              onChange={e => updateRule(rule.id, { operator: e.target.value })}
                              className="w-full h-8 text-[11px] bg-muted border border-border rounded px-2 outline-none"
                            >
                              {OPERATORS.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="text-[9px] text-muted-foreground mb-0.5 block">Шлях A (JSONPath)</label>
                          <input
                            type="text"
                            value={rule.path}
                            onChange={e => updateRule(rule.id, { path: e.target.value })}
                            placeholder="$.visitedFarmState.inventory.Wood"
                            className="w-full h-8 text-[11px] bg-muted border border-border rounded px-2 outline-none font-mono"
                          />
                        </div>

                        {/* Right side toggle */}
                        {needsValue(rule.operator) && (
                          <>
                            <div className="flex gap-2">
                              <button
                                onClick={() => updateRule(rule.id, { rightType: 'value' })}
                                className={`flex-1 h-7 text-[10px] font-bold rounded border transition-colors ${rule.rightType !== 'path' ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50' : 'bg-muted text-muted-foreground border-border'}`}
                              >
                                Значення
                              </button>
                              <button
                                onClick={() => updateRule(rule.id, { rightType: 'path', rightFile: rule.file, rightPath: '' })}
                                className={`flex-1 h-7 text-[10px] font-bold rounded border transition-colors ${rule.rightType === 'path' ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50' : 'bg-muted text-muted-foreground border-border'}`}
                              >
                                Шлях B
                              </button>
                            </div>

                            {rule.rightType === 'path' ? (
                              <div className="space-y-2">
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <label className="text-[9px] text-muted-foreground mb-0.5 block">Файл B</label>
                                    <select
                                      value={rule.rightFile?.startsWith('(') ? rule.rightFile : 'custom'}
                                      onChange={e => {
                                        const val = e.target.value;
                                        if (val === 'custom') updateRule(rule.id, { rightFile: '' });
                                        else updateRule(rule.id, { rightFile: val });
                                      }}
                                      className="w-full h-8 text-[11px] bg-muted border border-border rounded px-2 outline-none"
                                    >
                                      {FILE_ALIASES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                                    </select>
                                    {(rule.rightFile === '' || (!rule.rightFile?.startsWith('(') && rule.rightFile !== 'custom')) && (
                                      <input
                                        type="text"
                                        value={rule.rightFile === 'custom' ? '' : rule.rightFile || ''}
                                        onChange={e => updateRule(rule.id, { rightFile: e.target.value })}
                                        placeholder="data.json"
                                        className="w-full h-8 mt-1 text-[11px] bg-muted border border-border rounded px-2 outline-none"
                                      />
                                    )}
                                  </div>
                                </div>
                                <div>
                                  <label className="text-[9px] text-muted-foreground mb-0.5 block">Шлях B (JSONPath)</label>
                                  <input
                                    type="text"
                                    value={rule.rightPath || ''}
                                    onChange={e => updateRule(rule.id, { rightPath: e.target.value })}
                                    placeholder="$.visitedFarmState.coins"
                                    className="w-full h-8 text-[11px] bg-muted border border-border rounded px-2 outline-none font-mono"
                                  />
                                </div>
                              </div>
                            ) : (
                              <div>
                                <label className="text-[9px] text-muted-foreground mb-0.5 block">Значення B</label>
                                <input
                                  type="text"
                                  value={rule.value ?? ''}
                                  onChange={e => updateRule(rule.id, { value: e.target.value })}
                                  placeholder="50"
                                  className="w-full h-8 text-[11px] bg-muted border border-border rounded px-2 outline-none"
                                />
                              </div>
                            )}
                          </>
                        )}

                        {needsOutputVar(rule.operator) && (
                          <div>
                            <label className="text-[9px] text-muted-foreground mb-0.5 block">Змінна для запису (опціонально)</label>
                            <input
                              type="text"
                              value={rule.outputVar || ''}
                              onChange={e => updateRule(rule.id, { outputVar: e.target.value })}
                              placeholder="woodAmount"
                              className="w-full h-8 text-[11px] bg-muted border border-border rounded px-2 outline-none"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {rules.length === 0 && (
                    <div className="text-center py-6 text-muted-foreground text-[11px] italic border border-dashed border-border rounded-lg">
                      Натисніть «Додати» щоб створити перше правило
                    </div>
                  )}
                </div>
              </div>

              {/* Sub-configs */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Підконфігурації (OR — хоч одна TRUE)</label>
                  <select
                    value=""
                    onChange={e => {
                      const id = e.target.value;
                      if (!id) return;
                      const cfg = configs.find(c => c.id === id);
                      if (!cfg) return;
                      if (selectedConfigId && cfg.id === selectedConfigId) return;
                      if (subConfigs.find(s => s.id === cfg.id)) return;
                      setSubConfigs(prev => [...prev, { ...cfg, rules: cfg.rules.map(r => ({ ...r })) }]);
                      e.target.value = '';
                    }}
                    className="h-7 text-[10px] bg-muted border border-border rounded px-2 outline-none"
                  >
                    <option value="">+ Додати підконфіг…</option>
                    {configs.filter(c => c.id !== selectedConfigId).map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  {subConfigs.map((sub, idx) => (
                    <div key={sub.id} className="flex items-center justify-between bg-muted/30 border border-border rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-cyan-400">#{idx + 1}</span>
                        <span className="text-[11px]">{sub.name}</span>
                        <span className="text-[9px] text-muted-foreground">({sub.rules.length} правил)</span>
                        {!sub.enabled && <span className="text-[9px] text-red-400">ВИМК</span>}
                      </div>
                      <button
                        onClick={() => setSubConfigs(prev => prev.filter(s => s.id !== sub.id))}
                        className="text-muted-foreground hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                  {subConfigs.length === 0 && (
                    <div className="text-center py-4 text-muted-foreground text-[11px] italic border border-dashed border-border rounded-lg">
                      Без підконфігурацій — перевіряються тільки правила
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-700/50 flex justify-between items-center bg-slate-950/50">
              {selectedConfigId && (
                <button
                  onClick={() => deleteConfig(selectedConfigId)}
                  className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                >
                  <Trash2 size={13} /> Видалити
                </button>
              )}
              <div className="ml-auto flex gap-2">
                <button
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 text-[11px] font-bold text-muted-foreground hover:bg-muted rounded-lg transition-colors"
                >
                  Закрити
                </button>
                <button
                  onClick={saveConfig}
                  disabled={isSaving || !name.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 text-[11px] font-bold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg transition-colors"
                >
                  <Save size={13} /> {isSaving ? 'Збереження…' : 'Зберегти'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
