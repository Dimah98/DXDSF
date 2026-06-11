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
    try {
      // Create data directory if it doesn't exist
      const dir = path.dirname(configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(configPath, JSON.stringify(this.config, null, 2), 'utf8');
    } catch (e) {
      logger.error('Failed to save internal config', e instanceof Error ? e : new Error(String(e)));
    }
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
