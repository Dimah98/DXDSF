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

let cachedLaunches: MassLaunch[] | null = null;

function ensureCache(): MassLaunch[] {
  if (cachedLaunches !== null) return cachedLaunches;
  try {
    if (fs.existsSync(FILE_PATH)) {
      cachedLaunches = JSON.parse(fs.readFileSync(FILE_PATH, 'utf-8'));
    } else {
      cachedLaunches = [];
      fs.promises.mkdir(path.dirname(FILE_PATH), { recursive: true })
        .then(() => fs.promises.writeFile(FILE_PATH, '[]', 'utf-8'))
        .catch(() => {});
    }
  } catch (e) {
    cachedLaunches = [];
  }
  return cachedLaunches || [];
}

function persistAsync(data: MassLaunch[]) {
  fs.promises.mkdir(path.dirname(FILE_PATH), { recursive: true })
    .then(() => fs.promises.writeFile(FILE_PATH, JSON.stringify(data, null, 2), 'utf-8'))
    .catch(err => console.error('[MassLaunchStore] Failed to persist mass launches', err));
}

export const MassLaunchStore = {
  getAll(): MassLaunch[] {
    return ensureCache();
  },
  
  getById(id: string): MassLaunch | undefined {
    return ensureCache().find(x => x.id === id);
  },

  create(data: Omit<MassLaunch, 'id' | 'lastRunTime'>): MassLaunch {
    const list = ensureCache();
    const item: MassLaunch = {
      ...data,
      id: randomUUID(),
    };
    list.push(item);
    persistAsync(list);
    return item;
  },

  update(id: string, updates: Partial<MassLaunch>): MassLaunch | null {
    const list = ensureCache();
    const idx = list.findIndex(x => x.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...updates };
    persistAsync(list);
    return list[idx];
  },

  delete(id: string): boolean {
    const list = ensureCache();
    const idx = list.findIndex(x => x.id === id);
    if (idx === -1) return false;
    list.splice(idx, 1);
    persistAsync(list);
    return true;
  }
};
