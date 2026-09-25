import fs from 'fs';
import path from 'path';
import { Logger } from '../logger';
import { ConfigStore } from '../configs/ConfigStore';
import { evaluateConfig, loadConfigFiles, saveConfigFiles } from '../configs/ConfigEvaluator';

const logger = new Logger('NpcDeliveriesService');

export type DeliveryStatus = 'skip' | 'deliver' | 'config';

export interface DeliverySetting {
  status: DeliveryStatus;
  configId?: string;
}

export interface NpcDeliverySettingsFile {
  global: Record<string, DeliverySetting>;
  projects: Record<string, Record<string, DeliverySetting>>;
}

export interface DeliveryItem {
  name: string;
  amount: number;
  image: string;
}

export interface DeliveryOption {
  id: string;
  signature: string;
  items: DeliveryItem[];
  reward: string;
  rewardType: 'coins' | 'flower' | 'tickets';
  rewardIcon: string;
  cost: string;
}

export interface NpcData {
  id: string;
  name: string;
  displayName: string;
  icon: string;
  category: 'FLOWER' | 'COINS' | 'TICKETS' | string;
  avgReward: string;
  avgCost: string;
  deliveriesCount: number;
  deliveries: DeliveryOption[];
}

export class NpcDeliveriesService {
  private static instance: NpcDeliveriesService;
  private deliveriesData: Record<string, NpcData> | null = null;
  private readonly dataFilePath: string;
  private readonly settingsFilePath: string;

  private constructor() {
    this.dataFilePath = path.resolve(__dirname, '../../data/npcDeliveries.json');
    this.settingsFilePath = path.resolve(__dirname, '../../data/npc_deliveries_settings.json');
  }

  public static getInstance(): NpcDeliveriesService {
    if (!NpcDeliveriesService.instance) {
      NpcDeliveriesService.instance = new NpcDeliveriesService();
    }
    return NpcDeliveriesService.instance;
  }

  /**
   * Завантаження каталогу всіх 24 NPC та їх варіантів доставок
   */
  public getAllNpcDeliveries(): Record<string, NpcData> {
    if (this.deliveriesData) {
      return this.deliveriesData;
    }

    try {
      if (fs.existsSync(this.dataFilePath)) {
        const raw = fs.readFileSync(this.dataFilePath, 'utf8');
        this.deliveriesData = JSON.parse(raw);
        return this.deliveriesData || {};
      }
    } catch (e: any) {
      logger.error('Failed to load npcDeliveries.json', e);
    }
    return {};
  }

  /**
   * Зчитування збережених налаштувань
   */
  public loadSettingsFile(): NpcDeliverySettingsFile {
    try {
      if (fs.existsSync(this.settingsFilePath)) {
        const raw = fs.readFileSync(this.settingsFilePath, 'utf8');
        const parsed = JSON.parse(raw);
        return {
          global: parsed.global || {},
          projects: parsed.projects || {},
        };
      }
    } catch (e: any) {
      logger.error('Failed to read npc_deliveries_settings.json', e);
    }
    return { global: {}, projects: {} };
  }

  /**
   * Отримання ефективних налаштувань для проекту
   */
  public getSettings(projectName?: string): {
    settings: Record<string, DeliverySetting>;
    global: Record<string, DeliverySetting>;
    projectOverrides: Record<string, DeliverySetting>;
  } {
    const fileData = this.loadSettingsFile();
    const globalSettings = fileData.global || {};
    const projectOverrides = (projectName && fileData.projects?.[projectName]) || {};

    // Ефективні налаштування: глобальні, перекриті специфічними для проекту
    const effectiveSettings: Record<string, DeliverySetting> = {
      ...globalSettings,
      ...projectOverrides,
    };

    return {
      settings: effectiveSettings,
      global: globalSettings,
      projectOverrides,
    };
  }

  /**
   * Збереження налаштувань
   */
  public saveSettings(
    newSettings: Record<string, DeliverySetting>,
    projectName?: string,
    applyToAll: boolean = false
  ): boolean {
    try {
      const fileData = this.loadSettingsFile();

      if (!projectName || projectName === 'global' || applyToAll) {
        fileData.global = {
          ...fileData.global,
          ...newSettings,
        };

        if (applyToAll && fileData.projects) {
          // Якщо застосувати до всіх — синхронізуємо або скидаємо специфічні оверрайди
          for (const proj of Object.keys(fileData.projects)) {
            fileData.projects[proj] = {
              ...fileData.projects[proj],
              ...newSettings,
            };
          }
        }
      } else {
        if (!fileData.projects) {
          fileData.projects = {};
        }
        fileData.projects[projectName] = {
          ...(fileData.projects[projectName] || {}),
          ...newSettings,
        };
      }

      const dir = path.dirname(this.settingsFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(this.settingsFilePath, JSON.stringify(fileData, null, 2), 'utf8');
      logger.info('Saved NPC delivery settings successfully', { projectName, applyToAll });
      return true;
    } catch (e: any) {
      logger.error('Failed to save NPC delivery settings', e);
      return false;
    }
  }

  /**
   * Оцінка конфігурації для конкретного проекту
   * Успішна (true) -> доставляти
   * Провальна (false) -> пропускати
   */
  public evaluateConfigForProject(
    configId: string,
    projectName: string,
    logToClient?: (msg: string, type?: any, data?: unknown) => void
  ): boolean {
    if (!configId) return false;
    try {
      const config = ConfigStore.getById(configId);
      if (!config) {
        if (logToClient) logToClient(`❌ Конфігурацію ${configId} не знайдено`, 'error');
        return false;
      }

      const safeLog = logToClient || ((msg: string) => logger.info(msg));
      const fileCache = loadConfigFiles(config, projectName, safeLog);
      const extractedVars: Record<string, unknown> = {};
      const filesToSave = new Set<string>();

      const allPassed = evaluateConfig(
        config,
        projectName,
        fileCache,
        filesToSave,
        extractedVars,
        {},
        safeLog
      );

      saveConfigFiles(filesToSave, fileCache, projectName, safeLog);
      return !!allPassed;
    } catch (e: any) {
      logger.error('Failed to evaluate config for NPC delivery', e);
      if (logToClient) logToClient(`❌ Помилка оцінки конфігурації ${configId}: ${e.message}`, 'error');
      return false;
    }
  }

  /**
   * Перевірка чи слід доставляти конкретне замовлення
   */
  public shouldDeliver(
    projectName: string,
    npcName: string,
    items: Record<string, number> | Array<{ name: string; amount: number }>,
    logToClient?: (msg: string, type?: any, data?: unknown) => void
  ): { shouldDeliver: boolean; reason: string; status?: DeliveryStatus } {
    const allNpcs = this.getAllNpcDeliveries();
    const norm = (s: string) => (s || '').toLowerCase().replace(/['"_\-\s.]+/g, '');
    const normNpc = norm(npcName);

    // Знаходимо NPC в каталозі
    const matchedNpc = Object.values(allNpcs).find((n) => norm(n.name) === normNpc || norm(n.displayName) === normNpc);
    if (!matchedNpc) {
      return { shouldDeliver: true, reason: 'NPC не знайдено в каталозі' };
    }

    // Створюємо підпис предметів замовлення: Sorted items "Name:amount;Name:amount"
    let orderSig = '';
    if (Array.isArray(items)) {
      orderSig = items
        .map((it) => `${norm(it.name)}:${it.amount}`)
        .sort()
        .join(';');
    } else if (typeof items === 'object' && items !== null) {
      orderSig = Object.entries(items)
        .map(([k, v]) => `${norm(k)}:${v}`)
        .sort()
        .join(';');
    }

    // Знаходимо варіант доставки
    const matchedOption = matchedNpc.deliveries.find((d) => {
      const optSig = d.items
        .map((it) => `${norm(it.name)}:${it.amount}`)
        .sort()
        .join(';');
      return optSig === orderSig;
    });

    if (!matchedOption) {
      return { shouldDeliver: true, reason: 'Варіант замовлення не знайдено в каталозі (дефолт)' };
    }

    const { settings } = this.getSettings(projectName);
    const setting = settings[matchedOption.id];

    if (!setting) {
      return { shouldDeliver: true, reason: 'Статус замовлення не налаштовано (дефолт)' };
    }

    if (setting.status === 'skip') {
      return { shouldDeliver: false, reason: `Налаштовано: Пропускати (${matchedOption.id})`, status: 'skip' };
    }

    if (setting.status === 'deliver') {
      return { shouldDeliver: true, reason: `Налаштовано: Доставляти (${matchedOption.id})`, status: 'deliver' };
    }

    if (setting.status === 'config') {
      if (!setting.configId) {
        return { shouldDeliver: false, reason: 'Конфігурація не вибрана (пропуск)', status: 'config' };
      }
      const passed = this.evaluateConfigForProject(setting.configId, projectName, logToClient);
      return {
        shouldDeliver: passed,
        reason: `Конфігурація ${setting.configId}: ${passed ? 'Успіх (доставляти)' : 'Провал (пропускати)'}`,
        status: 'config',
      };
    }

    return { shouldDeliver: true, reason: 'Невідомий статус' };
  }
}

export const npcDeliveriesService = NpcDeliveriesService.getInstance();
