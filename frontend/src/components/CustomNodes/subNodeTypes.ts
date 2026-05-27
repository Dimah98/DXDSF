// Реєстр типів нод для використання всередині GroupNode (sub-canvas)
// Окремий файл щоб уникнути кругових залежностей (GroupNode → NodeEditor → GroupNode)
// ВАЖЛИВО: GroupNode тут не включено (немає рекурсії)

import ActionNode from './ActionNode';
import CoordOffsetNode from './CoordOffsetNode';
import BrowserNode from './BrowserNode';
import InfoNode from './InfoNode';
import DisplayNode from './DisplayNode';
import ImageSearchNode from './ImageSearchNode';
import SelectorCheckNode from './SelectorCheckNode';
import CoordClickNode from './CoordClickNode';
import NestedCheckNode from './NestedCheckNode';
import KeyboardNode from './KeyboardNode';
import VisualSearchNode from './VisualSearchNode';
import ApiNode from './ApiNode';
import VariableNode from './VariableNode';
import ValueLoopNode from './ValueLoopNode';
import MultiLogicNode from './MultiLogicNode';
import SearchInNode from './SearchInNode';
import CompareNode from './CompareNode';
import MultiScanNode from './MultiScanNode';
import GateNode from './GateNode';
import EscNode from './EscNode';
import CommentNode from './CommentNode';
import RandomDelayNode from './RandomDelayNode';
import EventVariationsNode from './EventVariationsNode';
import CalculatorNode from './CalculatorNode';
import VariablesMonitorNode from './VariablesMonitorNode';
import RotatorNode from './RotatorNode';
import SubEntryNode from './SubEntryNode';
import SubExitNode from './SubExitNode';
import CooldownNode from './CooldownNode';

// Всі доступні типи нод для sub-canvas (без GroupNode — без рекурсії)
export const SUB_NODE_TYPES: Record<string, any> = {
  actionNode: ActionNode,
  coordOffsetNode: CoordOffsetNode,
  conditionNode: CompareNode, // зворотна сумісність
  browserNode: BrowserNode,
  infoNode: InfoNode,
  displayNode: DisplayNode,
  imageSearchNode: ImageSearchNode,
  selectorCheckNode: SelectorCheckNode,
  coordClickNode: CoordClickNode,
  nestedCheckNode: NestedCheckNode,
  keyboardNode: KeyboardNode,
  visualSearchNode: VisualSearchNode,
  apiNode: ApiNode,
  variableNode: VariableNode,
  valueLoopNode: ValueLoopNode,
  multiLogicNode: MultiLogicNode,
  searchInNode: SearchInNode,
  compareNode: CompareNode,
  multiScanNode: MultiScanNode,
  gateNode: GateNode,
  escNode: EscNode,
  commentNode: CommentNode,
  randomDelayNode: RandomDelayNode,
  eventVariationsNode: EventVariationsNode,
  calculatorNode: CalculatorNode,
  variablesMonitorNode: VariablesMonitorNode,
  rotatorNode: RotatorNode,
  // Спеціальні ноди sub-graph
  subEntryNode: SubEntryNode,
  subExitNode: SubExitNode,
  cooldownNode: CooldownNode,
};
