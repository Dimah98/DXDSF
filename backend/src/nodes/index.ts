import { actionNodeHandler } from './ActionNode';
import { valueLoopNodeHandler } from './ValueLoopNode';
import { delayNodeHandler } from './DelayNode';
import { variableNodeHandler } from './VariableNode';
import { browserNodeHandler } from './BrowserNode';
import { keyboardNodeHandler } from './KeyboardNode';
import { infoNodeHandler } from './InfoNode';
import { visualSearchNodeHandler } from './VisualSearchNode';
import { multiLogicNodeHandler } from './MultiLogicNode';
import { coordClickNodeHandler } from './CoordClickNode';
import { coordOffsetNodeHandler } from './CoordOffsetNode';
import { compareNodeHandler } from './CompareNode';
import { apiNodeHandler } from './ApiNode';
import { displayNodeHandler } from './DisplayNode';
import { selectorCheckNodeHandler } from './SelectorCheckNode';
import { multiScanNodeHandler } from './MultiScanNode';
import { gateNodeHandler } from './GateNode';
import { nestedCheckNodeHandler } from './NestedCheckNode';
import { searchInNodeHandler } from './SearchInNode';
import { commentNodeHandler } from './CommentNode';
import { randomDelayNodeHandler } from './RandomDelayNode';
import { eventVariationsHandler } from './EventVariationsNode';
import { calculatorNodeHandler } from './CalculatorNode';
import { rotatorNodeHandler } from './RotatorNode';
import { groupNodeHandler } from './GroupNode';
import { cooldownNodeHandler } from './CooldownNode';
import { setNextRunNodeHandler } from './SetNextRunNode';
import { notifyNodeHandler } from './NotifyNode';
import { screenshotNodeHandler } from './ScreenshotNode';
import { searchAndClickNodeHandler } from './SearchAndClickNode';
import { roninWalletNodeHandler } from './RoninWalletNode';

import { configNodeHandler } from './ConfigNode';
import { islandArrangerNodeHandler } from './IslandArrangerNode';
import { textInputNodeHandler } from './TextInputNode';
import { flowerPlanterNodeHandler } from './FlowerPlanterNode';
import { deliveryNodeHandler } from './DeliveryNode';

// Domain-specific plugins
import { sunflowerLandPlugin } from '../plugins/sunflower-land';

import { NodeHandler, NodeHandlerParams, NodeResult } from './types';

// ─── Generic node handlers (universal, game-agnostic) ────────────────────────
const genericHandlers: Record<string, NodeHandler> = {
  actionNode: actionNodeHandler,
  valueLoopNode: valueLoopNodeHandler,
  delayNode: delayNodeHandler,
  randomDelayNode: randomDelayNodeHandler,
  eventVariationsNode: eventVariationsHandler,
  variableNode: variableNodeHandler,
  calculatorNode: calculatorNodeHandler,
  browserNode: browserNodeHandler,
  keyboardNode: keyboardNodeHandler,
  escNode: keyboardNodeHandler,
  infoNode: infoNodeHandler,
  // conditionNode removed — replaced by compareNode (backward compatibility)
  conditionNode: compareNodeHandler,
  imageSearchNode: visualSearchNodeHandler,
  visualSearchNode: visualSearchNodeHandler,
  multiLogicNode: multiLogicNodeHandler,
  coordClickNode: coordClickNodeHandler,
  coordOffsetNode: coordOffsetNodeHandler,
  compareNode: compareNodeHandler,
  apiNode: apiNodeHandler,
  displayNode: displayNodeHandler,
  selectorCheckNode: selectorCheckNodeHandler,
  multiScanNode: multiScanNodeHandler,
  gateNode: gateNodeHandler,
  nestedCheckNode: nestedCheckNodeHandler,
  searchInNode: searchInNodeHandler,
  commentNode: commentNodeHandler,
  rotatorNode: rotatorNodeHandler,
  groupNode: groupNodeHandler,
  cooldownNode: cooldownNodeHandler,
  setNextRunNode: setNextRunNodeHandler,
  notifyNode: notifyNodeHandler,
  screenshotNode: screenshotNodeHandler,
  searchAndClickNode: searchAndClickNodeHandler,
  roninWalletNode: roninWalletNodeHandler,
  configNode: configNodeHandler,
  islandArrangerNode: islandArrangerNodeHandler,
  textInputNode: textInputNodeHandler,
  flowerPlanterNode: flowerPlanterNodeHandler,
  deliveryNode: deliveryNodeHandler,
  subEntryNode: async ({ context }: NodeHandlerParams): Promise<NodeResult> => ({ data: context }),
  subExitNode: async ({ context }: NodeHandlerParams): Promise<NodeResult> => ({ data: context }),
};

// ─── Merge plugin handlers ───────────────────────────────────────────────────
// Plugin handlers take precedence for domain-specific nodes.
// This allows plugins to override or extend generic behavior.
export const nodeHandlers: Record<string, NodeHandler> = {
  ...genericHandlers,
  ...sunflowerLandPlugin.nodeHandlers,
};
