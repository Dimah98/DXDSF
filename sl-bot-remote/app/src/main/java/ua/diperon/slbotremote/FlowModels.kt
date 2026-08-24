package ua.diperon.slbotremote

/**
 * API response/request models for project editor
 */
data class ProjectDataResponse(
    val success: Boolean = false,
    val data: ProjectData? = null,
    val error: String? = null
)

data class ProjectData(
    val nodes: List<FlowNodeData> = emptyList(),
    val edges: List<FlowEdgeData> = emptyList(),
    val variables: Map<String, Any> = emptyMap()
)

data class FlowNodeData(
    val id: String = "",
    val type: String = "",
    val position: PositionData = PositionData(),
    val data: Map<String, Any?> = emptyMap()
)

data class PositionData(
    val x: Float = 0f,
    val y: Float = 0f
)

data class FlowEdgeData(
    val id: String = "",
    val source: String = "",
    val target: String = "",
    val sourceHandle: String? = null,
    val targetHandle: String? = null,
    val type: String = "default",
    val data: Map<String, Any?>? = null
)

data class ProjectSaveRequest(
    val name: String,
    val data: Map<String, Any>
)

/**
 * Моделі для нативного редактора нод (React Flow-подібного).
 * Використовуються для серіалізації/десеріалізації JSON проекту.
 */

/**
 * Внутрішні моделі редактора (mutable state).
 */
data class FlowNode(
    val id: String,
    val type: String,
    val position: NodePosition,
    val data: NodeData = NodeData()
)

data class NodePosition(
    val x: Float = 0f,
    val y: Float = 0f
)

data class NodeData(
    val label: String = "",
    val selector: String = "",
    val value: String = "",
    val delay: Int = 0,
    val key: String = "",
    val customKey: String = "",
    val configId: String? = null,
    val subNodes: List<FlowNode> = emptyList(),
    val subEdges: List<FlowEdge> = emptyList(),
    // Додаткові поля для різних типів нод
    val duration: Int? = null,
    val unit: String? = null,
    val message: String? = null,
    val url: String? = null,
    val method: String? = null,
    val body: String? = null,
    val headers: String? = null,
    val outputVar: String? = null,
    val imageSource: String? = null,
    val mode: String? = null,
    val containerSelector: String? = null,
    val numberRegex: String? = null,
    val scanItems: List<ScanItem>? = null,
    val childSelector: String? = null,
    val parentSelector: String? = null,
    val pickType: String? = null,
    val activeNodeLabel: String? = null,
    val activeNodeId: String? = null,
    val color: String? = null,
    val miniCollapsed: Boolean? = null,
    val customIcon: String? = null,
    val nextRunDelay: Int? = null,
    val useCondition: Boolean? = null,
    val leftVar: String? = null,
    val operator: String? = null,
    val rightValue: String? = null,
    val rightVar: String? = null,
    val trueLabel: String? = null,
    val falseLabel: String? = null,
    val timeoutMs: Int? = null,
    val pollIntervalMs: Int? = null,
    val invert: Boolean? = null,
    val maxRetries: Int? = null,
    val retryDelayMs: Int? = null,
    val keys: String? = null,
    val coordSource: String? = null,
    val offsetX: Int? = null,
    val offsetY: Int? = null,
    val scale: Float? = null,
    val loops: Int? = null,
    val varName: String? = null,
    val setValue: String? = null,
    val increment: Boolean? = null,
    val decrement: Boolean? = null,
    val copyToClipboard: Boolean? = null,
    val rightType: String? = null,
    val rightPath: String? = null,
    val rightFile: String? = null,
    val textTemplate: String? = null,
    val webhookUrl: String? = null,
    val webhookMethod: String? = null,
    val webhookBody: String? = null,
    val webhookHeaders: String? = null,
    val webhookOnStart: Boolean? = null,
    val webhookOnEnd: Boolean? = null,
    val webhookOnError: Boolean? = null,
    val autoCreateName: String? = null,
    val autoCreateProfile: String? = null,
    val autoCreateTemplate: String? = null,
    val autoCreateOnFail: Boolean? = null,
    val autoCreateCount: Int? = null,
    val schedule: String? = null,
    val scheduleEnabled: Boolean? = null,
    val scheduleOnce: Boolean? = null,
    val scheduleInterval: Int? = null,
    val scheduleUnit: String? = null,
    val scheduleDays: List<Int>? = null,
    val scheduleHours: List<Int>? = null,
    val notifyOnFinish: Boolean? = null,
    val notifyOnError: Boolean? = null,
    val notifyTelegramChatId: String? = null,
    val notifyTelegramBotToken: String? = null,
    val notifyDiscordWebhook: String? = null,
    val notifyEmail: String? = null,
    val threshold: Int? = null,
    val thresholdType: String? = null,
    val thresholdVar: String? = null,
    val thresholdAction: String? = null,
    val thresholdMessage: String? = null,
    val thresholdReset: Boolean? = null,
    val cooldownMinutes: Int? = null,
    val cooldownEnabled: Boolean? = null,
    val cooldownResetOnError: Boolean? = null,
    val cooldownNotify: Boolean? = null,
    val cooldownNotifyMessage: String? = null,
    val cooldownAction: String? = null,
    val cooldownActionTarget: String? = null,
    val cooldownActionDelay: Int? = null,
    val cooldownActionDelayUnit: String? = null,
    val cooldownActionRepeat: Int? = null,
    val cooldownActionRepeatDelay: Int? = null,
    val cooldownActionRepeatDelayUnit: String? = null,
    val cooldownActionRepeatCount: Int? = null,
    val cooldownActionRepeatCountLimit: Int? = null,
    val cooldownActionRepeatCountLimitAction: String? = null,
    val cooldownActionRepeatCountLimitActionTarget: String? = null,
    val cooldownActionRepeatCountLimitActionDelay: Int? = null,
    val cooldownActionRepeatCountLimitActionDelayUnit: String? = null
)

data class ScanItem(
    val selector: String = "",
    val label: String = ""
)

data class FlowEdge(
    val id: String,
    val source: String,
    val target: String,
    val sourceHandle: String? = null,
    val targetHandle: String? = null,
    val type: String = "default",
    val data: EdgeData? = null
)

data class EdgeData(
    val delay: Int = 0
)

/**
 * Повний проект для завантаження/збереження.
 */
data class ProjectFlow(
    val nodes: List<FlowNode> = emptyList(),
    val edges: List<FlowEdge> = emptyList(),
    val variables: Map<String, Any> = emptyMap()
)

/**
 * Доступні типи нод для сайдбару.
 */
val NODE_TYPES = listOf(
    NodeTypeInfo("startNode", "Старт", 0xFF22C55E),
    NodeTypeInfo("actionNode", "Дія", 0xFF3B82F6),
    NodeTypeInfo("delayNode", "Затримка", 0xFFF59E0B),
    NodeTypeInfo("selectorCheckNode", "Перевірка", 0xFF8B5CF6),
    NodeTypeInfo("keyboardNode", "Клавіатура", 0xFFEC4899),
    NodeTypeInfo("coordClickNode", "Клік", 0xFFEF4444),
    NodeTypeInfo("screenshotNode", "Скріншот", 0xFF10B981),
    NodeTypeInfo("apiNode", "API", 0xFF06B6D4),
    NodeTypeInfo("valueLoopNode", "Цикл", 0xFFF97316),
    NodeTypeInfo("variableNode", "Змінна", 0xFF6366F1),
    NodeTypeInfo("groupNode", "Контейнер", 0xFF1D4ED8),
    NodeTypeInfo("configNode", "Конфіг", 0xFF0891B2),
    NodeTypeInfo("notifyNode", "Сповіщення", 0xFFE11D48),
    NodeTypeInfo("commentNode", "Коментар", 0xFF64748B),
    NodeTypeInfo("cooldownNode", "Таймаут", 0xFF0D9488),
    NodeTypeInfo("infoNode", "Інфо", 0xFF6B7280),
    NodeTypeInfo("displayNode", "Вивід", 0xFF14B8A6),
    NodeTypeInfo("compareNode", "Порівняння", 0xFFD946EF),
    NodeTypeInfo("randomDelayNode", "Випадкова", 0xFF84CC16),
    NodeTypeInfo("browserNode", "Браузер", 0xFF4F46E5),
    NodeTypeInfo("searchAndClickNode", "Пошук", 0xFFF43F5E),
    NodeTypeInfo("searchInNode", "Пошук в", 0xFF2DD4BF),
    NodeTypeInfo("rotatorNode", "Чергувач", 0xFF8B5CF6),
    NodeTypeInfo("multiScanNode", "Сканер", 0xFF0EA5E9),
    NodeTypeInfo("visualSearchNode", "Візуальний", 0xFFA855F7),
    NodeTypeInfo("inventoryScannerNode", "Інвентар", 0xFF10B981),
    NodeTypeInfo("firePitNode", "Вогнище", 0xFFF97316),
    NodeTypeInfo("kitchenNode", "Кухня", 0xFFEC4899),
    NodeTypeInfo("cropAnalyzerNode", "Аналіз", 0xFF22C55E),
    NodeTypeInfo("gateNode", "Ворота", 0xFFEF4444),
    NodeTypeInfo("memoryGameNode", "Пам'ять", 0xFFD946EF),
    NodeTypeInfo("whackAMoleNode", "Гра", 0xFFF59E0B),
    NodeTypeInfo("nestedCheckNode", "Вкладена", 0xFF6366F1),
    NodeTypeInfo("eventVariationsNode", "Події", 0xFF06B6D4),
    NodeTypeInfo("setNextRunNode", "Наступний", 0xFF84CC16),
    NodeTypeInfo("multiLogicNode", "Логіка", 0xFF4F46E5)
)

data class NodeTypeInfo(
    val type: String,
    val label: String,
    val color: Long
)
