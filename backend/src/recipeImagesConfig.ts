import fs from 'fs';
import path from 'path';
import { Logger } from './logger';

const logger = new Logger('RecipeImagesConfig');

// Шлях до файлу з налаштуваннями зображень страв
const configPath = path.join(__dirname, '../../data/recipe_images.json');

export interface FoodItemSettings {
  enabled: boolean;
  imageName: string;
}

export interface RecipeImagesData {
  firePit: Record<string, string>;
  kitchen: Record<string, string>;
  deli: Record<string, string>;
  smoothieShack: Record<string, string>;
  bakery: Record<string, string>;
  food: Record<string, FoodItemSettings>;
}

const DEFAULT_DATA: RecipeImagesData = {
  firePit: {},
  kitchen: {},
  deli: {},
  smoothieShack: {},
  bakery: {},
  food: {}
};

export class RecipeImagesConfig {
  private data: RecipeImagesData = { ...DEFAULT_DATA };

  constructor() {
    this.load();
  }

  private load() {
    try {
      if (fs.existsSync(configPath)) {
        const raw = fs.readFileSync(configPath, 'utf8');
        const parsed = JSON.parse(raw);
        this.data = {
          firePit: parsed.firePit || {},
          kitchen: parsed.kitchen || {},
          deli: parsed.deli || {},
          smoothieShack: parsed.smoothieShack || {},
          bakery: parsed.bakery || {},
          food: parsed.food || {}
        };
      }
    } catch (e) {
      logger.error('Failed to load recipe images config', e instanceof Error ? e : new Error(String(e)));
    }
  }

  private save() {
    const dir = path.dirname(configPath);
    fs.promises.mkdir(dir, { recursive: true })
      .then(() => fs.promises.writeFile(configPath, JSON.stringify(this.data, null, 2), 'utf8'))
      .catch(e => {
        logger.error('Failed to save recipe images config', e instanceof Error ? e : new Error(String(e)));
      });
  }

  public getAll(): RecipeImagesData {
    return { ...this.data };
  }

  public getFirePit(): Record<string, string> {
    return { ...this.data.firePit };
  }

  public getKitchen(): Record<string, string> {
    return { ...this.data.kitchen };
  }

  public getDeli(): Record<string, string> {
    return { ...this.data.deli };
  }

  public getSmoothieShack(): Record<string, string> {
    return { ...this.data.smoothieShack };
  }

  public getBakery(): Record<string, string> {
    return { ...this.data.bakery };
  }

  public getFood(): Record<string, FoodItemSettings> {
    return { ...this.data.food };
  }

  public update(data: Partial<RecipeImagesData>) {
    if (data.firePit) this.data.firePit = data.firePit;
    if (data.kitchen) this.data.kitchen = data.kitchen;
    if (data.deli) this.data.deli = data.deli;
    if (data.smoothieShack) this.data.smoothieShack = data.smoothieShack;
    if (data.bakery) this.data.bakery = data.bakery;
    if (data.food) this.data.food = data.food;
    this.save();
  }
}

export const recipeImagesConfig = new RecipeImagesConfig();
