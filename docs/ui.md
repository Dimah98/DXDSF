# UI Документація

## Загальний огляд

Frontend побудований на **React 19** з використанням **TypeScript** та **Tailwind CSS**. Візуальний редактор реалізований через бібліотеку **@xyflow/react** (React Flow).

## UI Framework та бібліотеки

### Core
- **React 19.2.5** - UI framework
- **React DOM 19.2.5** - DOM renderer
- **TypeScript 5.4.5** - Type safety
- **Vite 8.0.10** - Build tool та dev server

### UI Components
- **Radix UI** - Accessible, unstyled component primitives
- **@xyflow/react 12.10.2** - Flow-based node editor
- **Lucide React 1.14.0** - SVG icon library
- **Recharts 3.8.1** - Charts та data visualization

### Styling
- **Tailwind CSS 3.4.19** - Utility-first CSS framework
- **tailwindcss-animate 1.0.7** - Animation utilities
- **class-variance-authority** - Variant-based component styling
- **clsx** - Conditional className utility
- **tailwind-merge** - Merge Tailwind classes intelligently

## Структура компонентів

```
src/
├── App.tsx                     # Root component
├── main.tsx                    # Entry point
├── components/
│   ├── NodeEditor.tsx         # Головний редактор (React Flow)
│   ├── ConsolePane.tsx        # Панель логів
│   ├── StreamPicker.tsx       # Element picker з відеопотоком
│   ├── StatisticsModal.tsx    # Графіки статистики
│   ├── GlobalStatisticsModal.tsx
│   ├── InventoryModal.tsx     # Модаль інвентаря
│   ├── InventoryOverview.tsx  # Зведена таблиця інвентарів
│   ├── ProjectManagerModal.tsx # Управління проєктами
│   ├── ScheduleManager.tsx    # Планувальник запусків
│   ├── NotificationsPanel.tsx # Панель сповіщень
│   ├── GlobalSettings.tsx     # Глобальні налаштування
│   ├── Sidebar.tsx            # Sidebar з доступними нодами
│   ├── DelayEdge.tsx          # Custom edge component
│   ├── PortTooltipManager.tsx # Tooltips для портів нод
│   ├── CustomNodes/           # 40+ компонентів нод
│   └── ui/                    # Reusable UI primitives (Radix wrappers)
├── hooks/
│   ├── useWebSocket.ts        # WebSocket communication
│   ├── useAutoSave.ts         # Auto-save functionality
│   ├── useHistory.ts          # Undo/Redo
│   ├── useProjectManager.ts   # Project management
│   ├── useLaunchSettings.ts   # Launch settings management
│   ├── useClipboard.ts        # Copy/Paste nodes
│   └── useCanvasActions.ts    # Zoom, pan, fit view
└── utils/
    └── flowUtils.ts           # React Flow utilities
```

## Головні компоненти

### App.tsx

**Призначення**: Root component, orchestration

**Відповідальність**:
- Global state initialization
- WebSocket connection setup
- Layout rendering

**Structure**:
```tsx
<div className="app-container">
  <NodeEditor />
</div>
```

---

### NodeEditor.tsx

**Призначення**: Візуальний редактор графів на базі React Flow

**Ключові фічі**:
- Drag-n-drop нод з Sidebar
- Connection validation
- Auto-save (через useAutoSave)
- Undo/Redo (через useHistory)
- Zoom, Pan, Fit View controls
- Node/Edge selection
- Context menu
- Mini-map (потребує уточнення)

**State Management**:
```tsx
const [nodes, setNodes] = useState<Node[]>([])
const [edges, setEdges] = useState<Edge[]>([])
const [globalVariables, setGlobalVariables] = useState<Record<string, any>>({})
```

**React Flow Integration**:
```tsx
<ReactFlow
  nodes={nodes}
  edges={edges}
  onNodesChange={onNodesChange}
  onEdgesChange={onEdgesChange}
  onConnect={onConnect}
  nodeTypes={nodeTypes}
  edgeTypes={edgeTypes}
  fitView
/>
```

**Layout**:
- Main canvas area (React Flow)
- Top toolbar (Run, Stop, Save buttons)
- Left Sidebar (Available nodes)
- Right panel (Variables, Settings)
- Bottom panel (Console logs)

---

### Sidebar.tsx

**Призначення**: Панель з доступними типами нод для drag-n-drop

**Категорії нод**:
1. **System** - Start, Comment
2. **Browser** - Browser, Action, Keyboard, Visual Search
3. **Logic** - Compare, Multi Logic, Gate, Nested Check
4. **Utilities** - Delay, Variable, Display, Calculator, API
5. **Loops** - Value Loop, Rotator
6. **Specialized** - Inventory Scanner, Crop Analyzer, Fire Pit, Kitchen

**Drag-n-Drop Pattern**:
```tsx
<div
  draggable
  onDragStart={(e) => {
    e.dataTransfer.setData('application/reactflow', nodeType)
    e.dataTransfer.effectAllowed = 'move'
  }}
  className="sidebar-node"
>
  <Icon /> {nodeLabel}
</div>
```

---

### ConsolePane.tsx

**Призначення**: Відображення логів виконання в real-time

**Features**:
- Real-time лог потік через WebSocket
- Кольорове форматування:
  - ✅ Success (зелений)
  - ❌ Error (червоний)
  - ℹ️ Info (синій)
  - 🔍 Debug (сірий)
- Фільтрація по типу логів
- Auto-scroll до останнього повідомлення
- Clear logs button
- Export logs (потребує уточнення)

**Log Entry Structure**:
```tsx
interface LogEntry {
  timestamp: number
  message: string
  logType: 'success' | 'error' | 'info' | 'debug'
  nodeId?: string
}
```

**Rendering**:
```tsx
{logs.map((log, index) => (
  <div key={index} className={`log-entry log-${log.logType}`}>
    <span className="timestamp">{formatTime(log.timestamp)}</span>
    <span className="message">{log.message}</span>
  </div>
))}
```

---

### StreamPicker.tsx

**Призначення**: Interactive element selector з відеопотоком браузера

**Mechanism**:
1. Отримання video frames через WebSocket (base64 JPEG)
2. Рендеринг в `<canvas>` або `<img>`
3. Click event на canvas → координати
4. Відправка координат на backend
5. Backend інжектує picker script
6. Picker повертає selector + metadata
7. Оновлення node data

**UI Elements**:
- Video stream canvas
- Crosshair cursor
- Element highlight overlay
- Info panel (selector, text, attributes)
- Close button

**Example**:
```tsx
<div className="stream-picker">
  <canvas
    ref={canvasRef}
    width={1280}
    height={720}
    onClick={handleCanvasClick}
  />
  {selectedElement && (
    <div className="element-info">
      <div>Selector: {selectedElement.selector}</div>
      <div>Text: {selectedElement.text}</div>
    </div>
  )}
</div>
```

---

### StatisticsModal.tsx

**Призначення**: Візуалізація статистики виконань проєкту

**Charts (Recharts)**:
1. **Variable Timeline** - Зміни змінних по часу (LineChart)
2. **Execution Duration** - Тривалість виконань (BarChart)
3. **Success Rate** - Співвідношення успіх/помилка (PieChart)
4. **Nodes Executed** - Кількість виконаних нод (AreaChart)

**Data Source**:
- `GET /api/stats/:projectName`
- WebSocket updates in real-time

**Example Chart**:
```tsx
<LineChart data={variableHistory} width={600} height={300}>
  <CartesianGrid strokeDasharray="3 3" />
  <XAxis dataKey="timestamp" tickFormatter={formatTime} />
  <YAxis />
  <Tooltip />
  <Legend />
  <Line type="monotone" dataKey="counter" stroke="#8884d8" />
</LineChart>
```

---

### ProjectManagerModal.tsx

**Призначення**: CRUD операції з проєктами

**Features**:
- Список всіх проєктів
- Create new project
- Load project
- Delete project (з підтвердженням)
- Rename project (потребує уточнення)
- Export project (JSON download)
- Import project (JSON upload)

**UI Layout**:
```
┌─────────────────────────────────────┐
│  Project Manager                    │
├─────────────────────────────────────┤
│  [+ New Project]  [Import]         │
├─────────────────────────────────────┤
│  □ project1        [Load] [Delete] │
│  □ project2        [Load] [Delete] │
│  □ daily-scraper   [Load] [Delete] │
└─────────────────────────────────────┘
```

---

### ScheduleManager.tsx

**Призначення**: Управління автоматичним запуском проєктів

**Schedule Types**:
1. **Interval-based** - Кожні N хвилин/годин
2. **Time-based** - Конкретний час щодня
3. **Day-based** - Конкретні дні тижня + час

**UI Form**:
```tsx
<div className="schedule-form">
  <Select value={mode}>
    <option value="manual">Manual</option>
    <option value="interval">Every N minutes</option>
    <option value="schedule">Specific time</option>
  </Select>
  
  {mode === 'interval' && (
    <Input type="number" value={intervalValue} />
  )}
  
  {mode === 'schedule' && (
    <>
      <Input type="time" value={scheduleTime} />
      <CheckboxGroup options={daysOfWeek} />
    </>
  )}
</div>
```

---

### GlobalSettings.tsx

**Призначення**: Глобальні налаштування додатку

**Settings**:
- Default browser profile
- Default browser window size
- Proxy settings
- Debug mode (photo snapshots)
- Auto-save interval
- Theme (light/dark) - потребує уточнення

---

### InventoryOverview.tsx

**Призначення**: Зведена таблиця інвентарів всіх проєктів

**Features**:
- Агрегована таблиця по всім акаунтам
- Фільтрація по категоріям
- Сортування по назві/кількості
- Export до CSV
- Total counts

**Table Structure**:
```
┌──────────────┬───────────┬─────────┬───────┐
│ Account      │ Sunflower │ Axe     │ ...   │
├──────────────┼───────────┼─────────┼───────┤
│ Account1     │ 150       │ 1       │       │
│ Account2     │ 200       │ 2       │       │
├──────────────┼───────────┼─────────┼───────┤
│ Total        │ 350       │ 3       │       │
└──────────────┴───────────┴─────────┴───────┘
```

---

## Custom Nodes (components/CustomNodes/)

### Node Component Pattern

Всі ноди наслідують спільний pattern:

```tsx
interface NodeProps {
  id: string
  data: {
    label?: string
    [key: string]: any
  }
  selected?: boolean
}

export const CustomNode: FC<NodeProps> = ({ id, data, selected }) => {
  const [isEditing, setIsEditing] = useState(false)
  
  return (
    <div className={`custom-node ${selected ? 'selected' : ''}`}>
      <Handle type="target" position={Position.Left} />
      
      <div className="node-header">
        <NodeIcon />
        <span>{data.label || 'Node'}</span>
      </div>
      
      <div className="node-body">
        {/* Node-specific UI */}
      </div>
      
      <Handle type="source" position={Position.Right} id="success" />
      <Handle type="source" position={Position.Right} id="error" />
    </div>
  )
}
```

### Node Categories

#### 1. System Nodes

**StartNode**:
- Початкова точка графу
- Немає input handle
- 1 output handle

**CommentNode**:
- Текстовий коментар для документування
- Немає handles

---

#### 2. Browser Nodes

**BrowserNode**:
- Inputs: URL, wait condition (load/networkidle/domcontentloaded)
- Outputs: success, error

**ActionNode**:
- Inputs: Action type (click/type/press), selector, text/key
- Element picker button
- Outputs: success, error

**KeyboardNode**:
- Inputs: Key combination (Ctrl+C, Enter, etc.)
- Outputs: success, error

**VisualSearchNode**:
- Inputs: Image template, confidence threshold
- Outputs: found, notFound

**SelectorCheckNode**:
- Inputs: Selector
- Outputs: exists, notExists

**SearchInNode**:
- Inputs: Parent selector, search text
- Outputs: found, notFound

**CoordClickNode**:
- Inputs: X, Y coordinates
- Outputs: success, error

**CoordOffsetNode**:
- Inputs: Base selector, X offset, Y offset
- Outputs: success, error

---

#### 3. Logic Nodes

**CompareNode**:
- Inputs: Value A, Operator (==, !=, >, <, >=, <=), Value B
- Outputs: true, false

**MultiLogicNode**:
- Inputs: Logic type (AND/OR), Multiple conditions
- Outputs: true, false

**NestedCheckNode**:
- Inputs: Nested condition structure
- Outputs: true, false

**GateNode**:
- Inputs: Limit count
- Outputs: pass (якщо count < limit), block
- Internal counter

---

#### 4. Utility Nodes

**DelayNode**:
- Inputs: Delay (ms)
- Outputs: next

**RandomDelayNode**:
- Inputs: Min delay, Max delay
- Outputs: next

**VariableNode**:
- Inputs: Variable name, Value, Operation (set/increment/decrement)
- Outputs: next

**DisplayNode**:
- Inputs: Message template (підтримує змінні {varName})
- Outputs: next
- Side effect: Log to console

**CalculatorNode**:
- Inputs: Expression (supports +, -, *, /, %)
- Variable substitution
- Outputs: next

**ApiNode**:
- Inputs: Method (GET/POST/PUT/DELETE), URL, Headers, Body
- Outputs: success, error

---

#### 5. Loop Nodes

**ValueLoopNode**:
- Inputs: Array of values або range
- Outputs: next (для кожного елементу), finish (коли закінчились)
- Sets current value to variable

**RotatorNode**:
- Inputs: Array of values
- Outputs: next
- Cycles through values infinitely

---

#### 6. Specialized Nodes

**InventoryScannerNode**:
- Inputs: Scan area selector
- Outputs: success, error
- Side effect: Save inventory to {projectName}_inventory.json

**CropAnalyzerNode**:
- Domain-specific для Sunflower Land
- Аналіз стану врожаю

**FirePitNode**:
- Domain-specific для Sunflower Land
- Управління firepit

**KitchenNode**:
- Domain-specific для Sunflower Land
- Управління кухнею

**CooldownNode**:
- Rate limiting delay
- Inputs: Cooldown duration
- Outputs: next

**EventVariationsNode**:
- Генерування варіацій подій
- Inputs: Event templates
- Outputs: next

**NotifyNode**:
- Відправка Telegram сповіщення
- Inputs: Message
- Outputs: next

**SetNextRunNode**:
- Встановлення часу наступного запуску
- Inputs: Delay (minutes)
- Outputs: next

**InfoNode**:
- Відображення інформаційного повідомлення в UI
- Outputs: next

**GroupNode**:
- Контейнер для під-сценаріїв
- Потребує уточнення

---

### Node Styling

**Tailwind Classes**:
```tsx
<div className="
  bg-white dark:bg-gray-800
  border-2 border-gray-300 dark:border-gray-600
  rounded-lg
  shadow-md
  p-4
  min-w-[200px]
  hover:shadow-lg
  transition-shadow
">
```

**Selected State**:
```tsx
className={`
  node-wrapper
  ${selected ? 'ring-2 ring-blue-500' : ''}
`}
```

**Node Colors** (по категоріям):
- System: Gray
- Browser: Blue
- Logic: Purple
- Utilities: Green
- Loops: Orange
- Specialized: Pink

---

## UI Primitives (components/ui/)

Reusable компоненти на базі **Radix UI**:

### Dialog
```tsx
<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogTrigger>Open</DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Title</DialogTitle>
    </DialogHeader>
    {children}
  </DialogContent>
</Dialog>
```

### Dropdown Menu
```tsx
<DropdownMenu>
  <DropdownMenuTrigger>Menu</DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem onClick={handleClick}>Item 1</DropdownMenuItem>
    <DropdownMenuItem>Item 2</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

### Select
```tsx
<Select value={value} onValueChange={setValue}>
  <SelectTrigger>
    <SelectValue placeholder="Choose..." />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="option1">Option 1</SelectItem>
    <SelectItem value="option2">Option 2</SelectItem>
  </SelectContent>
</Select>
```

### Tooltip
```tsx
<Tooltip>
  <TooltipTrigger>Hover me</TooltipTrigger>
  <TooltipContent>
    <p>Tooltip text</p>
  </TooltipContent>
</Tooltip>
```

### Button
```tsx
<Button
  variant="default" // default | outline | ghost | destructive
  size="md"         // sm | md | lg
  onClick={handleClick}
>
  Click me
</Button>
```

### Input
```tsx
<Input
  type="text"
  placeholder="Enter value..."
  value={value}
  onChange={(e) => setValue(e.target.value)}
/>
```

### Label
```tsx
<Label htmlFor="input-id">Label text</Label>
<Input id="input-id" />
```

---

## Custom Hooks

### useWebSocket

**Призначення**: WebSocket communication з автоматичним reconnect

```tsx
const {
  sendMessage,
  lastMessage,
  connectionStatus,
  reconnect
} = useWebSocket('ws://localhost:3001/ws?project=myProject')

// Відправка повідомлення
sendMessage({ type: 'RUN_BOT', nodes, edges, settings })

// Обробка вхідних повідомлень
useEffect(() => {
  if (lastMessage) {
    const message = JSON.parse(lastMessage.data)
    if (message.type === 'CONSOLE_LOG') {
      addLog(message)
    }
  }
}, [lastMessage])
```

---

### useAutoSave

**Призначення**: Автоматичне збереження проєкту через debounce

```tsx
useAutoSave(
  projectName,
  nodes,
  edges,
  globalVariables,
  {
    interval: 5000, // Save every 5 seconds
    enabled: true
  }
)
```

---

### useHistory

**Призначення**: Undo/Redo functionality

```tsx
const {
  past,
  present,
  future,
  set,
  undo,
  redo,
  canUndo,
  canRedo
} = useHistory(initialState)

// Update state
set(newState)

// Undo
if (canUndo) undo()

// Redo
if (canRedo) redo()
```

**Keyboard Shortcuts**:
- `Ctrl+Z` - Undo
- `Ctrl+Shift+Z` - Redo

---

### useClipboard

**Призначення**: Copy/Paste нод

```tsx
const {
  copy,
  paste,
  hasCopiedNodes
} = useClipboard()

// Copy selected nodes
copy(selectedNodes)

// Paste
const pastedNodes = paste()
```

**Keyboard Shortcuts**:
- `Ctrl+C` - Copy
- `Ctrl+V` - Paste

---

### useCanvasActions

**Призначення**: Canvas operations (zoom, pan, fit view)

```tsx
const {
  zoomIn,
  zoomOut,
  fitView,
  centerNode
} = useCanvasActions(reactFlowInstance)

// Zoom
zoomIn() // +10%
zoomOut() // -10%

// Fit all nodes in view
fitView({ padding: 0.2 })

// Center specific node
centerNode(nodeId)
```

---

## Навігація

**Поточний стан**: Single page application (немає routing)

**Модалі для різних функцій**:
- Project Manager Modal
- Statistics Modal
- Global Statistics Modal
- Inventory Modal
- Schedule Manager Modal
- Settings Modal

**Потенційний routing** (якщо буде додано):
```
/ - Main editor
/projects - Project list
/project/:id - Specific project
/settings - Settings page
/statistics - Global statistics
```

---

## Стилізація

### Tailwind CSS

**Config** (tailwind.config.js):
```javascript
module.exports = {
  darkMode: 'class', // або 'media'
  theme: {
    extend: {
      colors: {
        // Custom colors
      },
      animation: {
        // Custom animations
      }
    }
  }
}
```

**Utility Classes**:
- Layout: `flex`, `grid`, `container`
- Spacing: `p-4`, `m-2`, `gap-2`
- Sizing: `w-full`, `h-screen`, `min-w-[200px]`
- Typography: `text-lg`, `font-bold`, `text-center`
- Colors: `bg-blue-500`, `text-white`
- Borders: `border`, `rounded-lg`
- Effects: `shadow-md`, `hover:shadow-lg`
- Transitions: `transition-all`, `duration-300`

---

### CSS Modules (потребує уточнення)

Можливо використовуються для специфічних компонентів:
```css
/* InventoryOverview.css */
.inventory-table {
  /* Custom styles */
}
```

---

## Дизайн-система

### Кольорова палітра

**Primary Colors**:
- Blue: `#3B82F6` - Primary actions, links
- Green: `#10B981` - Success states
- Red: `#EF4444` - Error states, destructive actions
- Yellow: `#F59E0B` - Warnings
- Gray: `#6B7280` - Neutral, disabled states

**Node Colors** (по категоріям):
- System: `#9CA3AF` (gray-400)
- Browser: `#60A5FA` (blue-400)
- Logic: `#A78BFA` (purple-400)
- Utilities: `#34D399` (green-400)
- Loops: `#FB923C` (orange-400)
- Specialized: `#F472B6` (pink-400)

---

### Typography

**Font Family**: System fonts (потребує уточнення)

**Font Sizes**:
- xs: 0.75rem (12px)
- sm: 0.875rem (14px)
- base: 1rem (16px)
- lg: 1.125rem (18px)
- xl: 1.25rem (20px)
- 2xl: 1.5rem (24px)

**Font Weights**:
- normal: 400
- medium: 500
- semibold: 600
- bold: 700

---

### Spacing Scale

- 0: 0px
- 1: 0.25rem (4px)
- 2: 0.5rem (8px)
- 3: 0.75rem (12px)
- 4: 1rem (16px)
- 6: 1.5rem (24px)
- 8: 2rem (32px)

---

### Border Radius

- none: 0px
- sm: 0.125rem (2px)
- base: 0.25rem (4px)
- md: 0.375rem (6px)
- lg: 0.5rem (8px)
- xl: 0.75rem (12px)
- full: 9999px (круглі елементи)

---

### Shadows

- sm: `0 1px 2px 0 rgba(0, 0, 0, 0.05)`
- base: `0 1px 3px 0 rgba(0, 0, 0, 0.1)`
- md: `0 4px 6px -1px rgba(0, 0, 0, 0.1)`
- lg: `0 10px 15px -3px rgba(0, 0, 0, 0.1)`
- xl: `0 20px 25px -5px rgba(0, 0, 0, 0.1)`

---

## Теми

### Dark Mode

**Потребує уточнення** - Чи реалізований dark mode?

Якщо так, pattern:
```tsx
<html className="dark">
  {/* Dark mode активний */}
</html>
```

Tailwind classes для темної теми:
```tsx
<div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
```

---

## Accessibility

### Radix UI Benefits
- Keyboard navigation
- ARIA attributes
- Focus management
- Screen reader support

### Best Practices
- Alt text для зображень
- Semantic HTML
- Focus indicators
- Contrast ratios (WCAG AA)

---

## Performance Optimization

### React Flow
- Виртуалізація нод (автоматично в React Flow)
- Мемоізація компонентів нод
- Debounce для auto-save

### Images
- Lazy loading (потребує уточнення)
- WebP format для скріншотів (потребує уточнення)

### Code Splitting (потребує уточнення)
- Dynamic imports для великих модалів

---

**Дата створення**: 2026-06-08  
**Версія**: 1.0
