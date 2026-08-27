import fs from 'fs';
import path from 'path';
import { Logger } from './logger';

const logger = new Logger('InternalConfig');

// Шлях до файлу збереження внутрішньої конфігурації
const configPath = path.join(__dirname, '../../data/internal_config.json');

export class InternalConfig {
  private config: Record<string, number> = {};

  constructor() {
    this.load();
  }

  private load() {
    try {
      if (fs.existsSync(configPath)) {
        const data = fs.readFileSync(configPath, 'utf8');
        this.config = JSON.parse(data);
      }
    } catch (e) {
      logger.error('Failed to load internal config', e instanceof Error ? e : new Error(String(e)));
    }
  }

  private save() {
    const dir = path.dirname(configPath);
    fs.promises.mkdir(dir, { recursive: true })
      .then(() => fs.promises.writeFile(configPath, JSON.stringify(this.config, null, 2), 'utf8'))
      .catch(e => {
        logger.error('Failed to save internal config', e instanceof Error ? e : new Error(String(e)));
      });
  }

  public get(key: string): number {
    return this.config[key] ?? 0;
  }

  public set(key: string, value: number) {
    this.config[key] = value;
    this.save();
  }

  public getAll(): Record<string, number> {
    return { ...this.config };
  }
}

export const internalConfig = new InternalConfig();
