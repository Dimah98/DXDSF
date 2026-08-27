package ua.diperon.slbotremote

import android.app.Application
import android.content.Context
import android.content.SharedPreferences
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Base64
import android.util.Log
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import ua.diperon.slbotremote.data.AppDatabase
import ua.diperon.slbotremote.data.CachedDeliveryEntity
import ua.diperon.slbotremote.data.CachedInventoryEntity
import ua.diperon.slbotremote.data.CachedLogEntryEntity
import ua.diperon.slbotremote.data.CachedProjectStatsEntity
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

data class LogEntry(
    val id: String = "${System.nanoTime()}-${(1..1000).random()}",
    val text: String,
    val type: String,
    val timestamp: String
)

enum class ViewMode {
    CONSOLE,
    GALLERY,
    DELIVERY,
    INFO,
    CONTAINERS,
    RUN_HISTORY,
    SAVE_FILE
}

class ProjectMonitorViewModel(application: Application) : AndroidViewModel(application) {

    private val context = application.applicationContext
    private val configManager = ConnectionConfigManager(context)
    private val webSocketClient = BotWebSocketClient()
    private val db = AppDatabase.getInstance(context)
    private val dao = db.dao()
    private val interceptor = DynamicBaseUrlInterceptor()
    private val apiService: BotApiService = BotApiService.create(interceptor)
    private val sharedPrefs: SharedPreferences = context.getSharedPreferences("ProjectMonitorPrefs", Context.MODE_PRIVATE)
    private val moshi = Moshi.Builder().addLast(KotlinJsonAdapterFactory()).build()

    companion object {
        private const val TAG = "ProjectMonitorVM"
        private const val KEY_VIEW_MODE = "view_mode"
    }

    private val _projectName = MutableStateFlow("")
    val projectName: StateFlow<String> = _projectName.asStateFlow()

    private val _isBotRunning = MutableStateFlow(false)
    val isBotRunning: StateFlow<Boolean> = _isBotRunning.asStateFlow()

    private val _isStreamingGrid = MutableStateFlow(false)
    val isStreamingGrid: StateFlow<Boolean> = _isStreamingGrid.asStateFlow()

    private val _isBrowserOpen = MutableStateFlow(false)
    val isBrowserOpen: StateFlow<Boolean> = _isBrowserOpen.asStateFlow()

    private val _allProjects = MutableStateFlow<List<String>>(emptyList())
    val allProjects: StateFlow<List<String>> = _allProjects.asStateFlow()

    private val _latestFrame = MutableStateFlow<Bitmap?>(null)
    val latestFrame: StateFlow<Bitmap?> = _latestFrame.asStateFlow()

    private val _streamDeviceWidth = MutableStateFlow(1280)
    val streamDeviceWidth: StateFlow<Int> = _streamDeviceWidth.asStateFlow()

    private val _streamDeviceHeight = MutableStateFlow(720)
    val streamDeviceHeight: StateFlow<Int> = _streamDeviceHeight.asStateFlow()

    private val _activeExecutingNodeId = MutableStateFlow<String?>(null)
    val activeExecutingNodeId: StateFlow<String?> = _activeExecutingNodeId.asStateFlow()

    private val _activeExecutingNodeTitle = MutableStateFlow<String?>(null)
    val activeExecutingNodeTitle: StateFlow<String?> = _activeExecutingNodeTitle.asStateFlow()

    private val _consoleLogs = MutableStateFlow<List<LogEntry>>(emptyList())
    val consoleLogs: StateFlow<List<LogEntry>> = _consoleLogs.asStateFlow()

    private val _connectionState = MutableStateFlow(ConnectionState.DISCONNECTED)
    val connectionState: StateFlow<ConnectionState> = _connectionState.asStateFlow()

    private val _projectStats = MutableStateFlow<ProjectStats?>(null)
    val projectStats: StateFlow<ProjectStats?> = _projectStats.asStateFlow()

    private val _isLoadingStats = MutableStateFlow(false)
    val isLoadingStats: StateFlow<Boolean> = _isLoadingStats.asStateFlow()

    private val _inventoryItems = MutableStateFlow<List<InventoryItem>>(emptyList())
    val inventoryItems: StateFlow<List<InventoryItem>> = _inventoryItems.asStateFlow()

    private val _projectVariables = MutableStateFlow<Map<String, Any>>(emptyMap())
    val projectVariables: StateFlow<Map<String, Any>> = _projectVariables.asStateFlow()

    private val _screenshots = MutableStateFlow<List<String>>(emptyList())
    val screenshots: StateFlow<List<String>> = _screenshots.asStateFlow()

    private val _showGallery = MutableStateFlow(false)
    val showGallery: StateFlow<Boolean> = _showGallery.asStateFlow()

    private val _viewMode = MutableStateFlow(
        ViewMode.valueOf(
            sharedPrefs.getString(KEY_VIEW_MODE, ViewMode.CONSOLE.name) ?: ViewMode.CONSOLE.name
        )
    )
    val viewMode: StateFlow<ViewMode> = _viewMode.asStateFlow()

    private val _deliveryItems = MutableStateFlow<List<Delivery>>(emptyList())
    val deliveryItems: StateFlow<List<Delivery>> = _deliveryItems.asStateFlow()

    // Мітки доставок: Set<deliveryId> — відмічені доставки поточного проекту
    private val _markedDeliveries = MutableStateFlow<Set<String>>(emptySet())
    val markedDeliveries: StateFlow<Set<String>> = _markedDeliveries.asStateFlow()

    // Сигнатури предметів відмічених доставок: deliveryId -> "Item:Qty,..."
    private val _markedDeliverySignatures = MutableStateFlow<Map<String, String>>(emptyMap())

    private val MARKED_DELIVERIES_KEY = "__markedDeliveries"

    private val _projectContainers = MutableStateFlow<List<FlowNodeData>>(emptyList())
    val projectContainers: StateFlow<List<FlowNodeData>> = _projectContainers.asStateFlow()

    private val _isLoadingContainers = MutableStateFlow(false)
    val isLoadingContainers: StateFlow<Boolean> = _isLoadingContainers.asStateFlow()

    private val _projectRuns = MutableStateFlow<List<RunRecordItem>>(emptyList())
    val projectRuns: StateFlow<List<RunRecordItem>> = _projectRuns.asStateFlow()

    private val _selectedRunId = MutableStateFlow<String?>(null)
    val selectedRunId: StateFlow<String?> = _selectedRunId.asStateFlow()

    private val _selectedRunLogs = MutableStateFlow<String?>("")
    val selectedRunLogs: StateFlow<String?> = _selectedRunLogs.asStateFlow()

    private val _isLoadingRuns = MutableStateFlow(false)
    val isLoadingRuns: StateFlow<Boolean> = _isLoadingRuns.asStateFlow()

    private val _isLoadingRunLogs = MutableStateFlow(false)
    val isLoadingRunLogs: StateFlow<Boolean> = _isLoadingRunLogs.asStateFlow()

    private val _projectSaveRawJson = MutableStateFlow<String?>("")
    val projectSaveRawJson: StateFlow<String?> = _projectSaveRawJson.asStateFlow()

    private val _isLoadingProjectSave = MutableStateFlow(false)
    val isLoadingProjectSave: StateFlow<Boolean> = _isLoadingProjectSave.asStateFlow()

    private val _errorEvents = MutableSharedFlow<String>(extraBufferCapacity = 1)
    val errorEvents: SharedFlow<String> = _errorEvents.asSharedFlow()

    init {
        viewModelScope.launch {
            webSocketClient.connectionState.collect { state ->
                Log.d(TAG, "Socket Connection State Changed: $state")
                _connectionState.value = state
                if (state == ConnectionState.CONNECTED) {
                    addLog("System Connection Established with WebSocket Server", "info")
                    if (_isStreamingGrid.value) {
                        webSocketClient.startStream()
                    }
                } else if (state == ConnectionState.ERROR) {
                    addLog("System Connection Error: Unable to establish socket stream. Check Settings.", "error")
                    _errorEvents.emit("Помилка WebSocket: не вдалося встановити з'єднання. Перевірте налаштування.")
                }
            }
        }

        viewModelScope.launch {
            webSocketClient.messages.collect { message ->
                when (message) {
                    is BotWsMessage.BotRunningState -> {
                        Log.d(TAG, "Bot state changed from WebSocket: isRunning=${message.isRunning}")
                        _isBotRunning.value = message.isRunning
                        if (!message.isRunning) {
                            _activeExecutingNodeId.value = null
                            _activeExecutingNodeTitle.value = null
                        }
                        addLog("Bot Activity Status Synced: ${if (message.isRunning) "RUNNING" else "STOPPED"}", "info")
                    }
                    is BotWsMessage.ConsoleLog -> {
                        addLog(message.message, message.logType)
                    }
                    is BotWsMessage.StreamFrame -> {
                        message.deviceWidth?.let { _streamDeviceWidth.value = it }
                        message.deviceHeight?.let { _streamDeviceHeight.value = it }
                        decodeAndSetFrame(message.frameBase64)
                    }
                    is BotWsMessage.NodeExecuting -> {
                        _activeExecutingNodeId.value = message.nodeId
                        _activeExecutingNodeTitle.value = message.nodeTitle
                        val title = message.nodeTitle ?: message.nodeId
                        addLog("Виконується нода: $title", "info")
                    }
                    is BotWsMessage.GlobalVariablesUpdate -> {
                        @Suppress("UNCHECKED_CAST")
                        val nonNullVars = message.variables.filterValues { it != null } as Map<String, Any>
                        _projectVariables.value = nonNullVars
                        Log.d(TAG, "Real-time project variables updated: ${nonNullVars.keys.size} entries")
                    }
                    is BotWsMessage.NodeDataUpdate -> {
                        Log.d(TAG, "Node data update for node ${message.nodeId}")
                    }
                    is BotWsMessage.ScreenshotSaved -> {
                        if (message.projectName == _projectName.value) {
                            fetchScreenshots()
                        }
                    }
                    is BotWsMessage.BotFinished -> {
                        _isBotRunning.value = false
                        _activeExecutingNodeId.value = null
                        _activeExecutingNodeTitle.value = null
                        val statusText = if (message.error != null) " with error: ${message.error}" else " successfully."
                        addLog("Bot Script finished execution$statusText", if (message.status == "error") "error" else "success")
                        fetchRestStats()
                    }
                }
            }
        }
    }

    fun selectProject(name: String) {
        _projectName.value = name
        _consoleLogs.value = emptyList()
        _latestFrame.value = null
        addLog("Initializing real-time monitor panel for: $name", "info")

        interceptor.setBaseUrl(configManager.getHttpUrl())
        refreshStats()
        fetchInventory()
        loadMarkedDeliveries()

        val wsUrl = configManager.getWebSocketUrl(name)
        webSocketClient.connect(wsUrl)

        fetchRestStats()
        fetchScreenshots()
        fetchDeliveries()

        viewModelScope.launch {
            try {
                val projects = apiService.getProjects()
                _allProjects.value = projects
            } catch (e: Exception) {
                Log.e(TAG, "Failed to load projects: ${e.message}")
                _errorEvents.emit("Помилка завантаження проєктів: ${e.localizedMessage}")
            }
        }

        viewModelScope.launch {
            try {
                val status = apiService.getBrowserStatus(name)
                val isRunning = status["isRunning"] ?: false
                _isBrowserOpen.value = isRunning
                if (isRunning && !_isStreamingGrid.value) {
                    toggleStream()
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to check browser status: ${e.message}")
            }
        }

        // Load cached logs
        viewModelScope.launch {
            try {
                val cached = dao.getLogs(name)
                if (cached.isNotEmpty()) {
                    _consoleLogs.value = cached.map {
                        LogEntry(text = it.text, type = it.type, timestamp = it.timestamp)
                    }
                }
            } catch (e: Exception) {
                Log.w(TAG, "Failed to load cached logs: ${e.message}")
            }
        }
    }

    fun fetchHistoricLogs() {
        val projName = _projectName.value
        viewModelScope.launch {
            try {
                val response = apiService.getProjectLogs(projName)
                val newLogs = response.map {
                    LogEntry(text = it.text, type = it.type, timestamp = it.timestamp.ifBlank {
                        SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(Date())
                    })
                }
                val currentLogs = _consoleLogs.value
                _consoleLogs.value = (newLogs + currentLogs).takeLast(200)
                // cache
                dao.insertLogs(newLogs.map {
                    CachedLogEntryEntity(
                        projectName = projName,
                        text = it.text,
                        type = it.type,
                        timestamp = it.timestamp,
                        cachedAt = System.currentTimeMillis()
                    )
                })
            } catch (e: Exception) {
                Log.e(TAG, "Error fetching historic logs: ${e.message}")
                _errorEvents.emit("Помилка завантаження логів: ${e.localizedMessage}")
            }
        }
    }

    private val isDecodingFrame = java.util.concurrent.atomic.AtomicBoolean(false)

    private fun decodeAndSetFrame(base64Str: String) {
        if (base64Str.isBlank()) return
        if (!isDecodingFrame.compareAndSet(false, true)) {
            return
        }
        viewModelScope.launch(Dispatchers.Default) {
            try {
                val cleanBase64 = if (base64Str.contains(",")) {
                    base64Str.substring(base64Str.indexOf(",") + 1)
                } else {
                    base64Str
                }
                val imageBytes = Base64.decode(cleanBase64, Base64.DEFAULT)
                val options = BitmapFactory.Options().apply {
                    inPreferredConfig = Bitmap.Config.RGB_565
                    inSampleSize = 1
                }
                val newBitmap = BitmapFactory.decodeByteArray(imageBytes, 0, imageBytes.size, options)
                if (newBitmap != null) {
                    withContext(Dispatchers.Main) {
                        val oldBitmap = _latestFrame.value
                        _latestFrame.value = newBitmap
                        if (oldBitmap != null && oldBitmap != newBitmap && !oldBitmap.isRecycled) {
                            oldBitmap.recycle()
                        }
                    }
                }
            } catch (e: OutOfMemoryError) {
                Log.e(TAG, "OOM in frame decoding", e)
                System.gc()
            } catch (e: Exception) {
                Log.e(TAG, "Stream decoding failure: ${e.message}")
            } finally {
                isDecodingFrame.set(false)
            }
        }
    }

    fun addLog(text: String, type: String = "info") {
        if (text.isBlank()) return
        val sdf = SimpleDateFormat("HH:mm:ss", Locale.getDefault())
        val timestamp = sdf.format(Date())
        viewModelScope.launch {
            val newLogs = _consoleLogs.value.toMutableList().apply {
                add(LogEntry(text = text, type = type, timestamp = timestamp))
                if (size > 200) removeAt(0)
            }
            _consoleLogs.value = newLogs
        }
    }

    fun clearConsole() {
        _consoleLogs.value = emptyList()
        addLog("Console log cache cleared by operator.", "debug")
        viewModelScope.launch {
            try { dao.clearLogs(_projectName.value) } catch (e: Exception) { Log.w(TAG, "Cache clear failed: ${e.message}") }
        }
    }

    fun fetchRestStats() {
        val projName = _projectName.value
        if (projName.isBlank()) return

        viewModelScope.launch {
            _isLoadingStats.value = true
            try {
                val rawStats = apiService.getProjectStats(projName)
                val lastTs = (rawStats.lastOrNull()?.get("timestamp") as? Number)?.toLong()?.let { ts ->
                    java.text.SimpleDateFormat("dd.MM.yyyy HH:mm", java.util.Locale.getDefault()).format(java.util.Date(ts))
                }
                val stats = ProjectStats(
                    projectName = projName,
                    totalRuns = rawStats.size,
                    successfulRuns = rawStats.size,
                    failedRuns = 0,
                    lastRunTime = lastTs
                )
                _projectStats.value = stats
                Log.d(TAG, "Rest stats fetched: $stats")
                dao.insertProjectStats(
                    CachedProjectStatsEntity(
                        projectName = stats.projectName,
                        totalRuns = stats.totalRuns,
                        successfulRuns = stats.successfulRuns,
                        failedRuns = stats.failedRuns,
                        lastRunTime = stats.lastRunTime,
                        cachedAt = System.currentTimeMillis()
                    )
                )
                fetchScreenshots()
            } catch (e: Exception) {
                Log.e(TAG, "Error fetching REST project metrics: ${e.message}")
                _errorEvents.emit("Помилка завантаження статистики: ${e.localizedMessage}")
                // try load from cache
                val cached = dao.getProjectStats(projName)
                cached?.let {
                    _projectStats.value = ProjectStats(
                        projectName = it.projectName,
                        totalRuns = it.totalRuns,
                        successfulRuns = it.successfulRuns,
                        failedRuns = it.failedRuns,
                        lastRunTime = it.lastRunTime
                    )
                }
            } finally {
                _isLoadingStats.value = false
            }
        }
    }

    fun runBot() {
        addLog("Sending run command payload to backend...", "info")
        webSocketClient.startBot()
        _isBotRunning.value = true
    }

    fun stopBot() {
        addLog("Sending immediate termination payload to backend...", "info")
        webSocketClient.stopBot()
        _isBotRunning.value = false
    }

    fun toggleStream() {
        val nextState = !_isStreamingGrid.value
        _isStreamingGrid.value = nextState
        if (nextState) {
            addLog("Livestream viewport streaming requested...", "info")
            webSocketClient.startStream()
        } else {
            addLog("Livestream viewport halted.", "info")
            webSocketClient.stopStream()
            _latestFrame.value = null
        }
    }

    fun sendMouseClick(relX: Float, relY: Float, button: String = "left") {
        webSocketClient.sendMouseClick(relX, relY, button)
    }

    fun sendMouseDown(relX: Float, relY: Float, button: String = "left") {
        webSocketClient.sendMouseDown(relX, relY, button)
    }

    fun sendMouseMove(relX: Float, relY: Float) {
        webSocketClient.sendMouseMove(relX, relY)
    }

    fun sendMouseUp(relX: Float, relY: Float, button: String = "left") {
        webSocketClient.sendMouseUp(relX, relY, button)
    }

    fun sendDoubleClick(relX: Float, relY: Float) {
        webSocketClient.sendDoubleClick(relX, relY)
    }

    fun sendRightClick(relX: Float, relY: Float) {
        webSocketClient.sendRightClick(relX, relY)
    }

    fun sendScroll(deltaX: Float, deltaY: Float) {
        webSocketClient.sendScroll(deltaX, deltaY)
    }

    fun sendScrollUp(delta: Int = 500) {
        webSocketClient.sendScrollUp(delta)
    }

    fun sendScrollDown(delta: Int = 500) {
        webSocketClient.sendScrollDown(delta)
    }

    fun sendKeyPress(key: String) {
        webSocketClient.sendKeyPress(key)
    }

    fun sendTypeText(text: String, pressEnter: Boolean = false) {
        webSocketClient.sendTypeText(text, pressEnter)
    }

    fun sendEsc() {
        webSocketClient.sendEsc()
    }

    fun sendEnter() {
        webSocketClient.sendEnter()
    }

    fun sendBackspace() {
        webSocketClient.sendBackspace()
    }

    fun sendTab() {
        webSocketClient.sendTab()
    }

    fun refreshBrowserPage() {
        webSocketClient.refreshPage()
    }

    fun navigateToUrl(url: String) {
        webSocketClient.navigateToUrl(url)
    }

    fun goBack() {
        webSocketClient.goBack()
    }

    fun goForward() {
        webSocketClient.goForward()
    }

    fun sendMouseClick(x: Float, y: Float, width: Int, height: Int) {
        webSocketClient.sendMouseClick(x, y, width, height)
    }

    fun fetchScreenshots() {
        val projName = _projectName.value
        if (projName.isBlank()) return

        viewModelScope.launch {
            try {
                Log.d(TAG, "Fetching screenshots for project: $projName")
                val list = apiService.getScreenshots(projName)
                Log.d(TAG, "Screenshots fetched for $projName: ${list.size} items")
                _screenshots.value = list.sorted()
            } catch (e: Exception) {
                Log.e(TAG, "Error fetching screenshots for $projName: ${e.message}", e)
                _errorEvents.emit("Помилка завантаження скріншотів: ${e.localizedMessage}")
            }
        }
    }

    fun fetchDeliveries() {
        val projName = _projectName.value
        if (projName.isBlank()) return

        viewModelScope.launch {
            try {
                Log.d(TAG, "Fetching deliveries for project: $projName")
                val response = apiService.getDeliveries(projName)
                Log.d(TAG, "Deliveries fetched for $projName: ${response.data.size} items")
                _deliveryItems.value = response.data
                dao.insertDeliveries(
                    listOf(
                        CachedDeliveryEntity(
                            projectName = projName,
                            dataJson = try { moshi.adapter(List::class.java).toJson(response.data) } catch (e: Exception) { "[]" },
                            cachedAt = System.currentTimeMillis()
                        )
                    )
                )
                // Перевіряємо мітки після оновлення доставок
                autoRemoveStaleMarks(response.data, buildInventoryMap())
            } catch (e: Exception) {
                Log.e(TAG, "Error fetching deliveries for $projName: ${e.message}", e)
                _errorEvents.emit("Помилка завантаження доставок: ${e.localizedMessage}")
                // try cache
                val cached = dao.getDeliveries(projName)
                cached?.let {
                    val type = com.squareup.moshi.Types.newParameterizedType(List::class.java, Delivery::class.java)
                    val list = moshi.adapter<List<Delivery>>(type).fromJson(it.dataJson) ?: emptyList()
                    _deliveryItems.value = list
                }
            }
        }
    }

    /** Завантажує мітки доставок з variables проекту */
    fun loadMarkedDeliveries() {
        val projName = _projectName.value
        if (projName.isBlank()) return
        viewModelScope.launch {
            try {
                val response = apiService.getProject(projName)
                if (response.success && response.data != null) {
                    val variables = response.data.variables
                    val marked = mutableSetOf<String>()
                    val signatures = mutableMapOf<String, String>()

                    // Зворотна сумісність: масив __markedDeliveries
                    val legacyRaw = variables[MARKED_DELIVERIES_KEY]
                    if (legacyRaw is List<*>) {
                        marked.addAll(legacyRaw.filterIsInstance<String>())
                    }

                    // Новий формат: "назва_доставки": 1 (помічена) або 0 (не помічена)
                    for ((key, value) in variables) {
                        if (key == MARKED_DELIVERIES_KEY) continue
                        if (key.startsWith("__markedItems_")) {
                            val deliveryKey = key.removePrefix("__markedItems_")
                            if (value is String) {
                                signatures[deliveryKey] = value
                            }
                            continue
                        }
                        val numVal = when (value) {
                            is Number -> value.toInt()
                            is String -> value.toIntOrNull()
                            is Boolean -> if (value) 1 else 0
                            else -> null
                        }
                        if (numVal == 1) {
                            marked.add(key)
                        } else if (numVal == 0) {
                            marked.remove(key)
                        }
                    }
                    _markedDeliveries.value = marked
                    _markedDeliverySignatures.value = signatures
                    Log.d(TAG, "Loaded ${marked.size} marked deliveries for $projName")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to load marked deliveries: ${e.message}")
            }
        }
    }

    /** Зберігає поточний Set міток у variables проекту як назва_доставки = 1/0 */
    private fun saveMarkedDeliveries() {
        val projName = _projectName.value
        if (projName.isBlank()) return
        val currentMarked = _markedDeliveries.value.toSet()
        val currentSignatures = _markedDeliverySignatures.value.toMutableMap()
        viewModelScope.launch {
            try {
                val response = apiService.getProject(projName)
                if (response.success && response.data != null) {
                    val projectData = response.data
                    // Будуємо nodes
                    val nodeData = projectData.nodes.map { n ->
                        mapOf<String, Any>(
                            "id" to n.id,
                            "type" to n.type,
                            "position" to mapOf<String, Any>("x" to n.position.x, "y" to n.position.y),
                            "data" to (n.data as Map<String, Any?>)
                        )
                    }
                    // Будуємо edges
                    val edgeData = projectData.edges.map { e ->
                        mutableMapOf<String, Any>(
                            "id" to e.id,
                            "source" to e.source,
                            "target" to e.target,
                            "sourceHandle" to (e.sourceHandle ?: ""),
                            "targetHandle" to (e.targetHandle ?: ""),
                            "type" to "default"
                        )
                    }
                    val updatedVariables = projectData.variables.toMutableMap()
                    // Видаляємо застарілий масив __markedDeliveries
                    updatedVariables.remove(MARKED_DELIVERIES_KEY)
                    val keysToRemove = updatedVariables.keys.filter { it.startsWith("__markedItems_") }
                    keysToRemove.forEach { updatedVariables.remove(it) }

                    // Збираємо всі відомі назви доставок
                    val knownDeliveryNames = mutableSetOf<String>()
                    knownDeliveryNames.addAll(currentMarked)
                    _deliveryItems.value.forEach { d ->
                        val from = (d.from ?: "").lowercase()
                        knownDeliveryNames.add(getNpcFileName(from))
                        knownDeliveryNames.add(from)
                    }
                    // Також додаємо змінні з значеннями 1 або 0
                    for ((key, value) in projectData.variables) {
                        if (key == MARKED_DELIVERIES_KEY || key.startsWith("__markedItems_")) continue
                        val numVal = when (value) {
                            is Number -> value.toInt()
                            is String -> value.toIntOrNull()
                            is Boolean -> if (value) 1 else 0
                            else -> null
                        }
                        if (numVal == 1 || numVal == 0) {
                            knownDeliveryNames.add(key)
                        }
                    }

                    // Записуємо 1 для помічених (з сигнатурою предметів), 0 для непомічених
                    for (deliveryName in knownDeliveryNames) {
                        if (currentMarked.contains(deliveryName)) {
                            updatedVariables[deliveryName] = 1
                            var sig = currentSignatures[deliveryName]
                            if (sig.isNullOrBlank()) {
                                val delivery = _deliveryItems.value.find { 
                                    val from = (it.from ?: "").lowercase()
                                    getNpcFileName(from) == deliveryName || from == deliveryName || from.replace(" ", "_") == deliveryName 
                                }
                                sig = if (delivery != null) {
                                    getDeliveryItemsSignature(delivery)
                                } else {
                                    projectData.variables["__markedItems_$deliveryName"] as? String ?: ""
                                }
                            }
                            if (!sig.isNullOrBlank()) {
                                updatedVariables["__markedItems_$deliveryName"] = sig
                                currentSignatures[deliveryName] = sig
                            }
                        } else {
                            updatedVariables[deliveryName] = 0
                            currentSignatures.remove(deliveryName)
                        }
                    }

                    _markedDeliverySignatures.value = currentSignatures

                    val saveData = mapOf<String, Any>(
                        "nodes" to nodeData,
                        "edges" to edgeData,
                        "variables" to updatedVariables
                    )
                    apiService.saveProject(ProjectSaveRequest(name = projName, data = saveData))
                    Log.d(TAG, "Saved marked deliveries as 1/0 variables for $projName")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to save marked deliveries: ${e.message}")
            }
        }
    }

    /** Перемикає мітку для доставки та зберігає */
    fun toggleDeliveryMark(deliveryId: String) {
        val current = _markedDeliveries.value.toMutableSet()
        val currentSignatures = _markedDeliverySignatures.value.toMutableMap()
        if (current.contains(deliveryId)) {
            current.remove(deliveryId)
            currentSignatures.remove(deliveryId)
        } else {
            current.add(deliveryId)
            val delivery = _deliveryItems.value.find { 
                val from = (it.from ?: "").lowercase()
                getNpcFileName(from) == deliveryId || from == deliveryId || from.replace(" ", "_") == deliveryId 
            }
            if (delivery != null) {
                currentSignatures[deliveryId] = getDeliveryItemsSignature(delivery)
            }
        }
        _markedDeliveries.value = current
        _markedDeliverySignatures.value = currentSignatures
        saveMarkedDeliveries()
        Log.d(TAG, "Toggle mark for $deliveryId → marked: ${current.contains(deliveryId)}")
    }

    /** Будує mapу інвентаря з поточного стану */
    private fun buildInventoryMap(): Map<String, Double> {
        return _inventoryItems.value.associate {
            val itemName = it.image.substringAfterLast("/").substringBefore(".")
            itemName.lowercase() to it.number
        }
    }

    /** Автоматичне видалення міток вимкнено */
    private fun autoRemoveStaleMarks(deliveries: List<Delivery>, inventoryMap: Map<String, Double>) {
        // Автоматичне зняття міток вимкнено за запитом користувача
        return
    }

    fun toggleGallery() {
        _showGallery.value = !_showGallery.value
        if (_showGallery.value) {
            _viewMode.value = ViewMode.GALLERY
        } else {
            _viewMode.value = ViewMode.CONSOLE
        }
    }

    fun setViewMode(mode: ViewMode) {
        _viewMode.value = mode
        _showGallery.value = mode == ViewMode.GALLERY
        sharedPrefs.edit().putString(KEY_VIEW_MODE, mode.name).apply()

        if (mode == ViewMode.RUN_HISTORY) {
            fetchProjectRuns()
        } else if (mode == ViewMode.SAVE_FILE) {
            fetchProjectSaveRaw()
        }
    }

    fun fetchProjectRuns() {
        val name = _projectName.value
        if (name.isBlank()) return
        viewModelScope.launch {
            _isLoadingRuns.value = true
            try {
                val response = apiService.getProjectRuns(name)
                if (response.success) {
                    _projectRuns.value = response.runs
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to fetch project runs", e)
            } finally {
                _isLoadingRuns.value = false
            }
        }
    }

    fun selectRun(runId: String?) {
        _selectedRunId.value = runId
        if (runId == null) {
            _selectedRunLogs.value = ""
            return
        }
        val name = _projectName.value
        if (name.isBlank()) return
        viewModelScope.launch {
            _isLoadingRunLogs.value = true
            try {
                val body = apiService.getProjectRunLogs(name, runId)
                _selectedRunLogs.value = body.string()
            } catch (e: Exception) {
                Log.e(TAG, "Failed to fetch run logs", e)
                _selectedRunLogs.value = "Помилка завантаження логів: ${e.message}"
            } finally {
                _isLoadingRunLogs.value = false
            }
        }
    }

    fun fetchProjectSaveRaw() {
        val name = _projectName.value
        if (name.isBlank()) return
        viewModelScope.launch {
            _isLoadingProjectSave.value = true
            try {
                val body = apiService.getProjectSaveRaw(name)
                val rawStr = body.string()
                try {
                    val jsonObject = org.json.JSONObject(rawStr)
                    _projectSaveRawJson.value = jsonObject.toString(2)
                } catch (_: Exception) {
                    try {
                        val jsonArray = org.json.JSONArray(rawStr)
                        _projectSaveRawJson.value = jsonArray.toString(2)
                    } catch (_: Exception) {
                        _projectSaveRawJson.value = rawStr
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to fetch project save file", e)
                _projectSaveRawJson.value = "Помилка завантаження файлу збереження: ${e.message}"
            } finally {
                _isLoadingProjectSave.value = false
            }
        }
    }

    fun deleteScreenshot(filename: String) {
        val projName = _projectName.value
        if (projName.isBlank()) return

        viewModelScope.launch {
            try {
                val response = apiService.deleteScreenshot(projName, filename)
                if (response.success) {
                    _screenshots.value = _screenshots.value.filter { it != filename }
                    addLog("Скріншот $filename видалено", "success")
                } else {
                    addLog("Помилка видалення скріншота: ${response.message}", "error")
                    _errorEvents.emit("Помилка видалення: ${response.message}")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error deleting screenshot: ${e.message}")
                addLog("Помилка видалення скріншота: ${e.message}", "error")
                _errorEvents.emit("Помилка видалення скріншота: ${e.localizedMessage}")
            }
        }
    }

    fun fetchInventory() {
        val currentProject = _projectName.value
        if (currentProject.isEmpty()) return

        fetchContainers()

        viewModelScope.launch {
            try {
                val response = apiService.getInventory(currentProject)
                _inventoryItems.value = response.data
                
                try {
                    val saveResponse = apiService.getProjectSave(currentProject)
                    if (saveResponse.success && saveResponse.data != null) {
                        _projectVariables.value = saveResponse.data
                    } else if (response.variables != null) {
                        _projectVariables.value = response.variables
                    }
                } catch (saveErr: Exception) {
                    Log.w(TAG, "Failed to fetch project save for $currentProject: ${saveErr.message}")
                    if (response.variables != null) {
                        _projectVariables.value = response.variables
                    }
                }
                dao.insertInventory(
                    CachedInventoryEntity(
                        projectName = currentProject,
                        itemsJson = try { moshi.adapter(List::class.java).toJson(response.data) } catch (e: Exception) { "[]" },
                        variablesJson = try { moshi.adapter(Map::class.java).toJson(response.variables) } catch (e: Exception) { "{}" },
                        cachedAt = System.currentTimeMillis()
                    )
                )
                // Перевіряємо мітки при оновленні інвентаря
                val invMap = response.data.associate {
                    val itemName = it.image.substringAfterLast("/").substringBefore(".")
                    itemName.lowercase() to it.number
                }
                autoRemoveStaleMarks(_deliveryItems.value, invMap)
            } catch (e: Exception) {
                Log.e(TAG, "Failed to fetch inventory for project $currentProject: ${e.message}")
                _errorEvents.emit("Помилка інвентаря: ${e.localizedMessage}")
                // load cache
                val cached = dao.getInventory(currentProject)
                cached?.let {
                    val type = com.squareup.moshi.Types.newParameterizedType(List::class.java, InventoryItem::class.java)
                    val items = moshi.adapter<List<InventoryItem>>(type).fromJson(it.itemsJson) ?: emptyList()
                    val varType = com.squareup.moshi.Types.newParameterizedType(Map::class.java, String::class.java, Any::class.java)
                    val vars = moshi.adapter<Map<String, Any>>(varType).fromJson(it.variablesJson) ?: emptyMap()
                    _inventoryItems.value = items
                    _projectVariables.value = vars
                }
            }
        }
    }

    fun fetchContainers() {
        val currentProject = _projectName.value
        if (currentProject.isEmpty()) return

        viewModelScope.launch {
            _isLoadingContainers.value = true
            try {
                val response = apiService.getProject(currentProject)
                if (response.success && response.data != null) {
                    val allNodes = response.data.nodes
                    val containers = allNodes.filter { node ->
                        node.type.contains("group", ignoreCase = true) ||
                        node.type.contains("container", ignoreCase = true) ||
                        node.type.contains("sub", ignoreCase = true) ||
                        node.data.containsKey("subNodes")
                    }
                    _projectContainers.value = containers
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to fetch project containers for $currentProject: ${e.message}")
            } finally {
                _isLoadingContainers.value = false
            }
        }
    }

    fun runContainer(containerNode: FlowNodeData) {
        val currentProject = _projectName.value
        if (currentProject.isEmpty()) return

        viewModelScope.launch {
            try {
                val label = containerNode.data["label"] as? String ?: containerNode.id
                val subNodes = containerNode.data["subNodes"]
                val subEdges = containerNode.data["subEdges"]

                webSocketClient.runContainerGroup(
                    nodeId = containerNode.id,
                    nodeType = containerNode.type,
                    subNodes = subNodes,
                    subEdges = subEdges
                )
                addLog("🚀 Запущено контейнер «$label»", "info")
            } catch (e: Exception) {
                Log.e(TAG, "Error running container ${containerNode.id}: ${e.message}")
                addLog("❌ Помилка запуску контейнера: ${e.localizedMessage}", "error")
            }
        }
    }

    fun refreshPage() {
        webSocketClient.refreshPage()
    }

    fun refreshStats() {
        fetchInventory()
        fetchContainers()
    }


    fun onExit() {
        Log.d(TAG, "Leaving screen, releasing connections")
        webSocketClient.stopStream()
        webSocketClient.disconnect()
        val oldBitmap = _latestFrame.value
        _latestFrame.value = null
        if (oldBitmap != null && !oldBitmap.isRecycled) {
            oldBitmap.recycle()
        }
        _isStreamingGrid.value = false
    }

    fun toggleBrowser() {
        val currentlyOpen = _isBrowserOpen.value
        val name = _projectName.value

        viewModelScope.launch {
            try {
                if (currentlyOpen) {
                    apiService.closeBrowser(name)
                    _isBrowserOpen.value = false
                    if (_isStreamingGrid.value) {
                        toggleStream()
                    }
                    addLog("Браузер закрито", "info")
                } else {
                    apiService.openBrowser(name)
                    _isBrowserOpen.value = true
                    if (!_isStreamingGrid.value) {
                        toggleStream()
                    }
                    addLog("Браузер відкрито", "success")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to toggle browser", e)
                addLog("Помилка роботи з браузером: ${e.message}", "error")
                _errorEvents.emit("Помилка браузера: ${e.localizedMessage}")
            }
        }
    }

    fun navigateProject(direction: Int, onNavigate: (String) -> Unit) {
        val currentName = _projectName.value
        val list = _allProjects.value
        if (list.isEmpty()) return

        val currentIndex = list.indexOf(currentName)
        if (currentIndex == -1) return

        var nextIndex = currentIndex + direction
        if (nextIndex < 0) nextIndex = list.size - 1
        if (nextIndex >= list.size) nextIndex = 0

        onNavigate(list[nextIndex])
    }

    override fun onCleared() {
        super.onCleared()
        onExit()
    }
}
