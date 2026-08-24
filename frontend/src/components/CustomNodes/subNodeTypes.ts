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
import SetNextRunNode from './SetNextRunNode';
import NotifyNode from './NotifyNode';
import CropAnalyzerNode from './CropAnalyzerNode';
import FirePitNode from './FirePitNode';
import KitchenNode from './KitchenNode';
import DeliNode from './DeliNode';
import SmoothieShackNode from './SmoothieShackNode';
import BakeryNode from './BakeryNode';
// Сканер інвентаря — реєструємо для відображення всередині контейнера
import InventoryScannerNode from './InventoryScannerNode';
import ScreenshotNode from './ScreenshotNode';
import MemoryGameNode from './MemoryGameNode'; // Імпортуємо компонент ноди Гра Пам'ять
import WhackAMoleNode from './WhackAMoleNode'; // Імпортуємо компонент ноди Вдарь Крота
// Імпортуємо новий компонент для введення тексту та кліку
import SearchAndClickNode from './SearchAndClickNode';
import ConfigNode from './ConfigNode';
import IslandArrangerNode from './IslandArrangerNode';
import TextInputNode from './TextInputNode';
import FlowerPlanterNode from './FlowerPlanterNode';
import DeliveryNode from './DeliveryNode';
import FoodNode from './FoodNode';
import { RoninWalletNode } from './RoninWalletNode';

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
  setNextRunNode: SetNextRunNode,
  notifyNode: NotifyNode,
  cropAnalyzerNode: CropAnalyzerNode,
  firePitNode: FirePitNode,
  kitchenNode: KitchenNode,
  deliNode: DeliNode,
  smoothieShackNode: SmoothieShackNode,
  bakeryNode: BakeryNode,
  // Сканер інвентаря — реєструємо для відображення всередині контейнера
  inventoryScannerNode: InventoryScannerNode,
  // Скріншот — реєструємо для відображення всередині контейнера
  screenshotNode: ScreenshotNode,
  // Гра Пам'ять — реєструємо для відображення всередині контейнера
  memoryGameNode: MemoryGameNode,
  // Вдарь Крота — реєструємо для відображення всередині контейнера
  whackAMoleNode: WhackAMoleNode,
  // Реєструємо нову ноду введення та кліку в реєстрі піднод
  searchAndClickNode: SearchAndClickNode,
  configNode: ConfigNode,
  islandArrangerNode: IslandArrangerNode,
  textInputNode: TextInputNode,
  flowerPlanterNode: FlowerPlanterNode,
  deliveryNode: DeliveryNode,
  foodNode: FoodNode,
  roninWalletNode: RoninWalletNode,
};
