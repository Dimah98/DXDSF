import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

export interface ConfigRule {
  id: string;
  file: string;
  path: string;
  operator: '>' | '<' | '==' | '>=' | '<=' | '!=' | 'exists' | 'not_exists' | 'read' | 'read_delete' | 'contains' | 'starts_with' | 'ends_with' | 'matches' | 'time_before' | 'time_after' | 'time_equals' | 'time_is_today' | 'time_not_today';
  value?: number | string | boolean;
  rightType?: 'value' | 'path';
  rightFile?: string;
  rightPath?: string;
  outputVar?: string;
  required?: boolean;
}

export interface SavedConfig {
  id: string;
  name: string;
  enabled: boolean;
  rules: ConfigRule[];
  subConfigs?: SavedConfig[];
  createdAt: number;
  updatedAt: number;
}

const CONFIGS_FILE = path.join(__dirname, '../../data/configs.json');

function ensureFile(): SavedConfig[] {
  try {
    if (!fs.existsSync(CONFIGS_FILE)) {
      fs.mkdirSync(path.dirname(CONFIGS_FILE), { recursive: true });
      fs.writeFileSync(CONFIGS_FILE, '[]', 'utf-8');
      return [];
    }
    const raw = fs.readFileSync(CONFIGS_FILE, 'utf-8');
    return JSON.parse(raw) as SavedConfig[];
  } catch (e) {
    return [];
  }
}

function saveFile(configs: SavedConfig[]): void {
  fs.mkdirSync(path.dirname(CONFIGS_FILE), { recursive: true });
  fs.writeFileSync(CONFIGS_FILE, JSON.stringify(configs, null, 2), 'utf-8');
}

export const ConfigStore = {
  getAll(): SavedConfig[] {
    return ensureFile();
  },

  getById(id: string): SavedConfig | undefined {
    return ensureFile().find(c => c.id === id);
  },

  create(config: Omit<SavedConfig, 'id' | 'createdAt' | 'updatedAt'>): SavedConfig {
    const configs = ensureFile();
    const trimmedName = config.name.trim();
    const existing = configs.find(c => c.name.trim().toLowerCase() === trimmedName.toLowerCase());
    if (existing) {
      throw new Error(`Config with name "${trimmedName}" already exists`);
    }
    const now = Date.now();
    const newConfig: SavedConfig = {
      ...config,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    configs.push(newConfig);
    saveFile(configs);
    return newConfig;
  },

  update(id: string, updates: Partial<Omit<SavedConfig, 'id' | 'createdAt'>>): SavedConfig | null {
    const configs = ensureFile();
    const idx = configs.findIndex(c => c.id === id);
    if (idx === -1) return null;
    if (updates.name !== undefined) {
      const trimmedName = updates.name.trim();
      const existing = configs.find(c => c.id !== id && c.name.trim().toLowerCase() === trimmedName.toLowerCase());
      if (existing) {
        throw new Error(`Config with name "${trimmedName}" already exists`);
      }
    }
    configs[idx] = { ...configs[idx], ...updates, updatedAt: Date.now() };
    saveFile(configs);
    return configs[idx];
  },

  delete(id: string): boolean {
    const configs = ensureFile();
    const idx = configs.findIndex(c => c.id === id);
    if (idx === -1) return false;
    configs.splice(idx, 1);
    saveFile(configs);
    return true;
  },
};
