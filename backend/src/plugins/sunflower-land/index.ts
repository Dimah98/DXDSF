import { BotPlugin } from '../types';
import { cropAnalyzerNodeHandler } from '../../nodes/CropAnalyzerNode';
import { firePitNodeHandler } from '../../nodes/FirePitNode';
import { kitchenNodeHandler } from '../../nodes/KitchenNode';
import { deliNodeHandler } from '../../nodes/DeliNode';
import { smoothieShackNodeHandler } from '../../nodes/SmoothieShackNode';
import { bakeryNodeHandler } from '../../nodes/BakeryNode';
import { inventoryScannerNodeHandler } from '../../nodes/InventoryScannerNode';
import { memoryGameNodeHandler } from '../../nodes/MemoryGameNode';
import { whackAMoleNodeHandler } from '../../nodes/WhackAMoleNode';
import { foodNodeHandler } from '../../nodes/FoodNode';

/**
 * Sunflower Land domain plugin.
 * Registers game-specific node handlers for crop analysis, cooking,
 * inventory scanning, and mini-games.
 */
export const sunflowerLandPlugin: BotPlugin = {
  name: 'sunflower-land',
  description: 'Sunflower Land game automation nodes',
  nodeHandlers: {
    cropAnalyzerNode: cropAnalyzerNodeHandler,
    firePitNode: firePitNodeHandler,
    kitchenNode: kitchenNodeHandler,
    deliNode: deliNodeHandler,
    smoothieShackNode: smoothieShackNodeHandler,
    bakeryNode: bakeryNodeHandler,
    inventoryScannerNode: inventoryScannerNodeHandler,
    memoryGameNode: memoryGameNodeHandler,
    whackAMoleNode: whackAMoleNodeHandler,
    foodNode: foodNodeHandler,
  },
};
