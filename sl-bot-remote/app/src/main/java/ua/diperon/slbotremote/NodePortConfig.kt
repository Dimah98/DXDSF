package ua.diperon.slbotremote

import androidx.compose.ui.graphics.Color
import ua.diperon.slbotremote.ui.theme.*

/**
 * Конфігурація портів (входів/виходів) для кожного типу ноди.
 * Аналог Handle'ів у ReactFlow на фронтенді.
 */

data class PortInfo(
    val id: String,
    val label: String,
    val color: Color,
    val isInput: Boolean
)

data class NodeTypeConfig(
    val type: String,
    val label: String,
    val color: Long,
    val icon: String, // Material icon name
    val inputs: List<PortInfo>,
    val outputs: List<PortInfo>,
    val description: String = ""
)

/**
 * Єдиний реєстр конфігурацій нод з портами.
 * Відповідає фронтендному NODE_CONFIG + Handle визначення з кожного CustomNode.
 */
val NODE_PORT_CONFIG: Map<String, NodeTypeConfig> = mapOf(
    "startNode" to NodeTypeConfig(
        type = "startNode", label = "Початок", color = 0xFF64748B, icon = "PlayArrow",
        inputs = emptyList(),
        outputs = listOf(PortInfo("default", "→", GlassSuccess, false)),
        description = "Точка входу сценарію"
    ),
    "actionNode" to NodeTypeConfig(
        type = "actionNode", label = "Дія (Клік)", color = 0xFF22C55E, icon = "TouchApp",
        inputs = listOf(PortInfo("default", "→", Color(0xFF3B82F6), true)),
        outputs = listOf(
            PortInfo("success", "✓", GlassSuccess, false),
            PortInfo("error", "✗", GlassError, false)
        ),
        description = "Клік по селектору"
    ),
    "selectorCheckNode" to NodeTypeConfig(
        type = "selectorCheckNode", label = "Перевірка", color = 0xFFF59E0B, icon = "Search",
        inputs = listOf(PortInfo("default", "→", Color(0xFFFB923C), true)),
        outputs = listOf(
            PortInfo("exists", "Є", GlassSuccess, false),
            PortInfo("not_exists", "Ні", GlassError, false)
        ),
        description = "Перевіряє наявність елемента"
    ),
    "compareNode" to NodeTypeConfig(
        type = "compareNode", label = "Порівняння (IF)", color = 0xFFFB923C, icon = "Compare",
        inputs = listOf(PortInfo("default", "→", Color(0xFFFB923C), true)),
        outputs = listOf(
            PortInfo("true", "Так", GlassSuccess, false),
            PortInfo("false", "Ні", GlassError, false)
        ),
        description = "Порівнює два значення"
    ),
    "variableNode" to NodeTypeConfig(
        type = "variableNode", label = "Змінна", color = 0xFF8B5CF6, icon = "Storage",
        inputs = listOf(PortInfo("default", "→", GlassBalance, true)),
        outputs = listOf(PortInfo("default", "→", GlassBalance, false)),
        description = "Створити/Змінити змінну"
    ),
    "apiNode" to NodeTypeConfig(
        type = "apiNode", label = "API Запит", color = 0xFF10B981, icon = "CloudDownload",
        inputs = listOf(PortInfo("default", "→", GlassSuccess, true)),
        outputs = listOf(
            PortInfo("success", "✓", GlassSuccess, false),
            PortInfo("error", "✗", GlassError, false)
        ),
        description = "HTTP GET/POST запит"
    ),
    "groupNode" to NodeTypeConfig(
        type = "groupNode", label = "Контейнер", color = 0xFF1D4ED8, icon = "Inventory2",
        inputs = listOf(PortInfo("in", "→", GlassSuccess, true)),
        outputs = listOf(PortInfo("out", "→", GlassError, false)),
        description = "Підпрограма з вкладеними нодами"
    ),
    "delayNode" to NodeTypeConfig(
        type = "delayNode", label = "Затримка", color = 0xFFF59E0B, icon = "Timer",
        inputs = listOf(PortInfo("default", "→", GlassWarning, true)),
        outputs = listOf(PortInfo("default", "→", GlassWarning, false)),
        description = "Пауза між діями"
    ),
    "randomDelayNode" to NodeTypeConfig(
        type = "randomDelayNode", label = "Рандом-Пауза", color = 0xFF6366F1, icon = "Timer",
        inputs = listOf(PortInfo("default", "→", GlassIndigo, true)),
        outputs = listOf(PortInfo("default", "→", GlassIndigo, false)),
        description = "Випадкова затримка X-Y мс"
    ),
    "keyboardNode" to NodeTypeConfig(
        type = "keyboardNode", label = "Клавіатура", color = 0xFF6366F1, icon = "Keyboard",
        inputs = listOf(PortInfo("default", "→", GlassIndigo, true)),
        outputs = listOf(PortInfo("default", "→", GlassIndigo, false)),
        description = "Ввід тексту/клавіш"
    ),
    "coordClickNode" to NodeTypeConfig(
        type = "coordClickNode", label = "Клік координати", color = 0xFFEF4444, icon = "GpsFixed",
        inputs = listOf(PortInfo("default", "→", GlassError, true)),
        outputs = listOf(
            PortInfo("success", "✓", GlassSuccess, false),
            PortInfo("error", "✗", GlassError, false)
        ),
        description = "Клік по {X, Y}"
    ),
    "screenshotNode" to NodeTypeConfig(
        type = "screenshotNode", label = "Скріншот", color = 0xFFEC4899, icon = "CameraAlt",
        inputs = listOf(PortInfo("default", "→", Color(0xFFEC4899), true)),
        outputs = listOf(PortInfo("default", "→", Color(0xFFEC4899), false)),
        description = "Збереження екрану"
    ),
    "valueLoopNode" to NodeTypeConfig(
        type = "valueLoopNode", label = "Цикл", color = 0xFFD946EF, icon = "Loop",
        inputs = listOf(PortInfo("default", "→", Color(0xFFD946EF), true)),
        outputs = listOf(
            PortInfo("item", "Елемент", GlassSuccess, false),
            PortInfo("done", "Завершено", Color(0xFF3B82F6), false)
        ),
        description = "Ітерація по масиву"
    ),
    "multiLogicNode" to NodeTypeConfig(
        type = "multiLogicNode", label = "Диспетчер", color = 0xFFF43F5E, icon = "AccountTree",
        inputs = listOf(PortInfo("default", "→", Color(0xFFF43F5E), true)),
        outputs = listOf(
            PortInfo("default", "→", Color(0xFFF43F5E), false),
            PortInfo("fallback", "Інакше", GlassOnSurfaceDim, false)
        ),
        description = "Варіації з пріоритетом"
    ),
    "searchInNode" to NodeTypeConfig(
        type = "searchInNode", label = "Пошук в", color = 0xFF14B8A6, icon = "FindInPage",
        inputs = listOf(PortInfo("default", "→", Color(0xFF14B8A6), true)),
        outputs = listOf(
            PortInfo("found", "✓", GlassSuccess, false),
            PortInfo("not_found", "✗", GlassError, false)
        ),
        description = "Знайти елемент в іншому"
    ),
    "browserNode" to NodeTypeConfig(
        type = "browserNode", label = "Браузер", color = 0xFFA855F7, icon = "Language",
        inputs = listOf(PortInfo("default", "→", Color(0xFFA855F7), true)),
        outputs = listOf(PortInfo("default", "→", Color(0xFFA855F7), false)),
        description = "Керування сторінкою"
    ),
    "infoNode" to NodeTypeConfig(
        type = "infoNode", label = "Сканер", color = 0xFF3B82F6, icon = "QrCodeScanner",
        inputs = listOf(PortInfo("default", "→", Color(0xFF3B82F6), true)),
        outputs = listOf(PortInfo("default", "→", Color(0xFF3B82F6), false)),
        description = "Витягти текст/дані"
    ),
    "displayNode" to NodeTypeConfig(
        type = "displayNode", label = "Екран", color = 0xFF0EA5E9, icon = "Monitor",
        inputs = listOf(PortInfo("default", "→", Color(0xFF0EA5E9), true)),
        outputs = emptyList(),
        description = "Вивід значень"
    ),
    "commentNode" to NodeTypeConfig(
        type = "commentNode", label = "Коментар", color = 0xFF94A3B8, icon = "Comment",
        inputs = emptyList(),
        outputs = emptyList(),
        description = "Нотатки на полотні"
    ),
    "gateNode" to NodeTypeConfig(
        type = "gateNode", label = "Шлюз", color = 0xFF8B5CF6, icon = "CallSplit",
        inputs = listOf(PortInfo("default", "→", GlassBalance, true)),
        outputs = listOf(PortInfo("out", "→", GlassBalance, false)),
        description = "Об'єднання сигналів"
    ),
    "multiScanNode" to NodeTypeConfig(
        type = "multiScanNode", label = "Мульти-сканер", color = 0xFF3B82F6, icon = "DocumentScanner",
        inputs = listOf(PortInfo("default", "→", Color(0xFF3B82F6), true)),
        outputs = listOf(PortInfo("default", "→", Color(0xFF3B82F6), false)),
        description = "Витягти масив даних"
    ),
    "rotatorNode" to NodeTypeConfig(
        type = "rotatorNode", label = "Чергувач", color = 0xFF8B5CF6, icon = "Autorenew",
        inputs = listOf(PortInfo("default", "→", GlassBalance, true)),
        outputs = listOf(
            PortInfo("out_0", "1", GlassSuccess, false),
            PortInfo("out_1", "2", Color(0xFF3B82F6), false)
        ),
        description = "По черзі або рандом"
    ),
    "cooldownNode" to NodeTypeConfig(
        type = "cooldownNode", label = "Таймаут", color = 0xFF0D9488, icon = "HourglassEmpty",
        inputs = listOf(PortInfo("default", "→", Color(0xFF0D9488), true)),
        outputs = listOf(
            PortInfo("active", "Готово", GlassSuccess, false),
            PortInfo("cooldown", "Чекай", GlassError, false)
        ),
        description = "Затримка між викликами"
    ),
    "notifyNode" to NodeTypeConfig(
        type = "notifyNode", label = "Сповіщення", color = 0xFFF59E0B, icon = "Notifications",
        inputs = listOf(PortInfo("default", "→", GlassWarning, true)),
        outputs = listOf(PortInfo("default", "→", GlassWarning, false)),
        description = "Надіслати повідомлення"
    ),
    "configNode" to NodeTypeConfig(
        type = "configNode", label = "Конфігурація", color = 0xFF06B6D4, icon = "Settings",
        inputs = listOf(PortInfo("default", "→", Color(0xFF06B6D4), true)),
        outputs = listOf(
            PortInfo("true", "Так", GlassSuccess, false),
            PortInfo("false", "Ні", GlassError, false)
        ),
        description = "Перевірки з JSON"
    ),
    "setNextRunNode" to NodeTypeConfig(
        type = "setNextRunNode", label = "Наступний запуск", color = 0xFF0EA5E9, icon = "Event",
        inputs = listOf(PortInfo("default", "→", Color(0xFF0EA5E9), true)),
        outputs = listOf(PortInfo("default", "→", Color(0xFF0EA5E9), false)),
        description = "Запланувати повтор"
    ),
    "cropAnalyzerNode" to NodeTypeConfig(
        type = "cropAnalyzerNode", label = "Аналіз врожаю", color = 0xFF16A34A, icon = "Grass",
        inputs = listOf(PortInfo("default", "→", Color(0xFF16A34A), true)),
        outputs = listOf(
            PortInfo("ready", "Дозрів", GlassSuccess, false),
            PortInfo("growing", "Росте", Color(0xFF3B82F6), false)
        ),
        description = "Час дозрівання"
    ),
    "firePitNode" to NodeTypeConfig(
        type = "firePitNode", label = "Шеф Fire Pit", color = 0xFFEA580C, icon = "LocalFireDepartment",
        inputs = listOf(PortInfo("default", "→", Color(0xFFEA580C), true)),
        outputs = listOf(
            PortInfo("cooked", "✓", GlassSuccess, false),
            PortInfo("skip", "→", GlassOnSurfaceDim, false)
        ),
        description = "Готування страв"
    ),
    "kitchenNode" to NodeTypeConfig(
        type = "kitchenNode", label = "Шеф Kitchen", color = 0xFFA855F7, icon = "Restaurant",
        inputs = listOf(PortInfo("default", "→", Color(0xFFA855F7), true)),
        outputs = listOf(
            PortInfo("cooked", "✓", GlassSuccess, false),
            PortInfo("skip", "→", GlassOnSurfaceDim, false)
        ),
        description = "Готування в Kitchen"
    ),
    "inventoryScannerNode" to NodeTypeConfig(
        type = "inventoryScannerNode", label = "Сканер Інвентаря", color = 0xFF6366F1, icon = "Inventory",
        inputs = listOf(PortInfo("default", "→", GlassIndigo, true)),
        outputs = listOf(PortInfo("default", "→", GlassIndigo, false)),
        description = "Зображення + числа"
    ),
    "memoryGameNode" to NodeTypeConfig(
        type = "memoryGameNode", label = "Гра Пам'ять", color = 0xFF7C3AED, icon = "Casino",
        inputs = listOf(PortInfo("default", "→", Color(0xFF7C3AED), true)),
        outputs = listOf(
            PortInfo("success", "✓", GlassSuccess, false),
            PortInfo("error", "✗", GlassError, false)
        ),
        description = "Міні-гра memory"
    ),
    "whackAMoleNode" to NodeTypeConfig(
        type = "whackAMoleNode", label = "Вдарь Крота", color = 0xFFD97706, icon = "SportsEsports",
        inputs = listOf(PortInfo("default", "→", Color(0xFFD97706), true)),
        outputs = listOf(
            PortInfo("success", "✓", GlassSuccess, false),
            PortInfo("error", "✗", GlassError, false)
        ),
        description = "Міні-гра Whack-a-Mole"
    ),
    "searchAndClickNode" to NodeTypeConfig(
        type = "searchAndClickNode", label = "Введення та Клік", color = 0xFF9333EA, icon = "TextFields",
        inputs = listOf(PortInfo("default", "→", Color(0xFF9333EA), true)),
        outputs = listOf(
            PortInfo("success", "✓", GlassSuccess, false),
            PortInfo("error", "✗", GlassError, false)
        ),
        description = "Ввести текст та клікнути"
    ),
    "eventVariationsNode" to NodeTypeConfig(
        type = "eventVariationsNode", label = "Варіації подій", color = 0xFFF43F5E, icon = "AltRoute",
        inputs = listOf(PortInfo("default", "→", Color(0xFFF43F5E), true)),
        outputs = listOf(
            PortInfo("matched", "✓", GlassSuccess, false),
            PortInfo("none", "Нічого", GlassOnSurfaceDim, false)
        ),
        description = "Перевірка списку умов"
    ),
    "nestedCheckNode" to NodeTypeConfig(
        type = "nestedCheckNode", label = "Вкладена перевірка", color = 0xFF6366F1, icon = "FactCheck",
        inputs = listOf(PortInfo("default", "→", GlassIndigo, true)),
        outputs = listOf(
            PortInfo("exists", "Є", GlassSuccess, false),
            PortInfo("not_exists", "Ні", GlassError, false)
        ),
        description = "Перевірка вкладених елементів"
    ),
    "visualSearchNode" to NodeTypeConfig(
        type = "visualSearchNode", label = "Візуальний пошук", color = 0xFFA855F7, icon = "ImageSearch",
        inputs = listOf(PortInfo("default", "→", Color(0xFFA855F7), true)),
        outputs = listOf(
            PortInfo("found", "✓", GlassSuccess, false),
            PortInfo("not_found", "✗", GlassError, false)
        ),
        description = "Пошук по картинці"
    ),
    "escNode" to NodeTypeConfig(
        type = "escNode", label = "Закрити (ESC)", color = 0xFF64748B, icon = "Close",
        inputs = listOf(PortInfo("default", "→", GlassOnSurfaceDim, true)),
        outputs = listOf(PortInfo("default", "→", GlassOnSurfaceDim, false)),
        description = "Закрити вікна/модалки"
    ),
    "calculatorNode" to NodeTypeConfig(
        type = "calculatorNode", label = "Калькулятор", color = 0xFF0284C7, icon = "Calculate",
        inputs = listOf(PortInfo("default", "→", Color(0xFF0284C7), true)),
        outputs = listOf(PortInfo("default", "→", Color(0xFF0284C7), false)),
        description = "Математичні вирази"
    ),
    "variablesMonitorNode" to NodeTypeConfig(
        type = "variablesMonitorNode", label = "Монітор Змінних", color = 0xFF059669, icon = "Monitor",
        inputs = emptyList(),
        outputs = emptyList(),
        description = "Список усіх значень"
    ),
    "subEntryNode" to NodeTypeConfig(
        type = "subEntryNode", label = "Вхід", color = 0xFF22C55E, icon = "Login",
        inputs = emptyList(),
        outputs = listOf(PortInfo("out", "→", GlassSuccess, false)),
        description = "Вхідна точка контейнера"
    ),
    "subExitNode" to NodeTypeConfig(
        type = "subExitNode", label = "Вихід", color = 0xFFEF4444, icon = "Logout",
        inputs = listOf(PortInfo("in", "→", GlassError, true)),
        outputs = emptyList(),
        description = "Вихідна точка контейнера"
    ),
    "imageSearchNode" to NodeTypeConfig(
        type = "imageSearchNode", label = "Пошук картинки", color = 0xFFEC4899, icon = "Image",
        inputs = listOf(PortInfo("default", "→", Color(0xFFEC4899), true)),
        outputs = listOf(
            PortInfo("found", "✓", GlassSuccess, false),
            PortInfo("not_found", "✗", GlassError, false)
        ),
        description = "Шукає зображення на екрані"
    ),
    "coordOffsetNode" to NodeTypeConfig(
        type = "coordOffsetNode", label = "Зсув координат", color = 0xFF64748B, icon = "ControlCamera",
        inputs = listOf(PortInfo("default", "→", GlassOnSurfaceDim, true)),
        outputs = listOf(PortInfo("default", "→", GlassOnSurfaceDim, false)),
        description = "Зміщення X/Y"
    )
)

/**
 * Отримати конфігурацію ноди за типом.
 * Якщо тип невідомий — повертає дефолтну конфігурацію.
 */
fun getNodeConfig(type: String): NodeTypeConfig {
    return NODE_PORT_CONFIG[type] ?: NodeTypeConfig(
        type = type,
        label = type,
        color = 0xFF64748B,
        icon = "Help",
        inputs = listOf(PortInfo("default", "→", GlassOnSurfaceDim, true)),
        outputs = listOf(PortInfo("default", "→", GlassOnSurfaceDim, false)),
        description = "Невідомий тип ноди"
    )
}
