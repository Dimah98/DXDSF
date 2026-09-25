import { Request, Response } from 'express';
import { npcDeliveriesService, DeliverySetting } from '../services/npcDeliveriesService';
import { Logger } from '../logger';

const logger = new Logger('NpcDeliveriesController');

export function getNpcDeliveries(_req: Request, res: Response): void {
  try {
    const data = npcDeliveriesService.getAllNpcDeliveries();
    res.status(200).json({ success: true, data });
  } catch (error: any) {
    logger.error('Failed to get NPC deliveries', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export function getDeliverySettings(req: Request, res: Response): void {
  try {
    const projectName = typeof req.query.projectName === 'string' ? req.query.projectName : undefined;
    const result = npcDeliveriesService.getSettings(projectName);
    res.status(200).json({
      success: true,
      projectName,
      ...result,
    });
  } catch (error: any) {
    logger.error('Failed to get delivery settings', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export function saveDeliverySettings(req: Request, res: Response): void {
  try {
    const { projectName, settings, applyToAll } = req.body as {
      projectName?: string;
      settings: Record<string, DeliverySetting>;
      applyToAll?: boolean;
    };

    if (!settings || typeof settings !== 'object') {
      res.status(400).json({ success: false, error: 'Invalid settings object' });
      return;
    }

    const saved = npcDeliveriesService.saveSettings(settings, projectName, !!applyToAll);
    if (saved) {
      res.status(200).json({ success: true, message: 'Settings saved successfully' });
    } else {
      res.status(500).json({ success: false, error: 'Failed to save settings file' });
    }
  } catch (error: any) {
    logger.error('Failed to save delivery settings', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export function testDeliveryConfig(req: Request, res: Response): void {
  try {
    const { projectName, configId } = req.body as {
      projectName: string;
      configId: string;
    };

    if (!configId) {
      res.status(400).json({ success: false, error: 'configId is required' });
      return;
    }

    const passed = npcDeliveriesService.evaluateConfigForProject(configId, projectName || '');
    res.status(200).json({
      success: true,
      configId,
      projectName,
      passed,
    });
  } catch (error: any) {
    logger.error('Failed to test delivery config', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}
