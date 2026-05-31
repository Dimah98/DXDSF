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
import { rotatorNodeHandler } from './RotatorNode'; // Нода Чергувач
import { groupNodeHandler } from './GroupNode'; // Нода-контейнер (підпрограма)
import { cooldownNodeHandler } from './CooldownNode';
import { setNextRunNodeHandler } from './SetNextRunNode';
import { notifyNodeHandler } from './NotifyNode';

import { NodeHandler } from './types';

export const nodeHandlers: Record<string, NodeHandler> = {
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
  // conditionNode видалено — замінено compareNode (зворотна сумісність)
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
  rotatorNode: rotatorNodeHandler, // Чергувач — по черзі або рандом
  groupNode: groupNodeHandler,     // Контейнер — вкладена підпрограма
  cooldownNode: cooldownNodeHandler,
  setNextRunNode: setNextRunNodeHandler,
  notifyNode: notifyNodeHandler,
  subEntryNode: async ({ context }: any) => ({ nextHandle: 'out', data: context }),
  subExitNode: async ({ context }: any) => ({ data: context }),
};
