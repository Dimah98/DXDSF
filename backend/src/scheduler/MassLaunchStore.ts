import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

export interface MassLaunch {
  id: string;
  name: string;
  mode: 'manual_time' | 'json_time';
  time?: string; // "HH:mm"
  jsonPath?: string;
  configId?: string;
  containers: string[];
  enabled: boolean;
  lastRunTime?: number;
  projectLastRuns?: Record<string, number>;
}

const FILE_PATH = path.join(__dirname, '../../../data/mass_launches.json');

function ensureFile(): MassLaunch[] {
  try {
    if (!fs.existsSync(FILE_PATH)) {
      fs.mkdirSync(path.dirname(FILE_PATH), { recursive: true });
      fs.writeFileSync(FILE_PATH, '[]', 'utf-8');
      return [];
    }
    return JSON.parse(fs.readFileSync(FILE_PATH, 'utf-8'));
  } catch (e) {
    return [];
  }
}

function saveFile(data: MassLaunch[]) {
  fs.mkdirSync(path.dirname(FILE_PATH), { recursive: true });
  fs.writeFileSync(FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

export const MassLaunchStore = {
  getAll(): MassLaunch[] {
    return ensureFile();
  },
  
  getById(id: string): MassLaunch | undefined {
    return ensureFile().find(x => x.id === id);
  },

  create(data: Omit<MassLaunch, 'id' | 'lastRunTime'>): MassLaunch {
    const list = ensureFile();
    const item: MassLaunch = {
      ...data,
      id: randomUUID(),
    };
    list.push(item);
    saveFile(list);
    return item;
  },

  update(id: string, updates: Partial<MassLaunch>): MassLaunch | null {
    const list = ensureFile();
    const idx = list.findIndex(x => x.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...updates };
    saveFile(list);
    return list[idx];
  },

  delete(id: string): boolean {
    const list = ensureFile();
    const idx = list.findIndex(x => x.id === id);
    if (idx === -1) return false;
    list.splice(idx, 1);
    saveFile(list);
    return true;
  }
};
