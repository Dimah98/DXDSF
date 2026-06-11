package com.example

import android.app.Application
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Base64
import android.util.Log
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Data class representing a structured live log output shown on the user console.
 */
data class LogEntry(
    val id: String = "${System.nanoTime()}-${(1..1000).random()}",
    val text: String,
    val type: String, // "success", "error", "info", "debug"
    val timestamp: String
)

/**
 * Android ViewModel holding UI states, running actions, and data-flow controllers for the Project Monitor page.
 */
class ProjectMonitorViewModel(application: Application) : AndroidViewModel(application) {

    private val context = application.applicationContext
    private val configManager = ConnectionConfigManager(context)
    private val webSocketClient = BotWebSocketClient()
    private var apiService: BotApiService? = null

    companion object {
        private const val TAG = "ProjectMonitorVM"
    }

    // Live streams and screen configs
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

    init {
        // Collect network changes and updates from socket client in lifecycle scope
        viewModelScope.launch {
            webSocketClient.connectionState.collect { state ->
                Log.d(TAG, "Socket Connection State Changed: $state")
                _connectionState.value = state
                if (state == ConnectionState.CONNECTED) {
                    addLog("System Connection Established with WebSocket Server", "info")
                    // Automatically request starting stream if user toggles streaming earlier
                    if (_isStreamingGrid.value) {
                        webSocketClient.startStream()
                    }
                } else if (state == ConnectionState.ERROR) {
                    addLog("System Connection Error: Unable to establish socket stream. Check Settings.", "error")
                }
            }
        }

        viewModelScope.launch {
            webSocketClient.messages.collect { message ->
                when (message) {
                    is BotWsMessage.BotRunningState -> {
                        Log.d(TAG, "Bot state changed from WebSocket: isRunning=${message.isRunning}")
                        _isBotRunning.value = message.isRunning
                        addLog("Bot Activity Status Synced: ${if (message.isRunning) "RUNNING" else "STOPPED"}", "info")
                    }
                    is BotWsMessage.ConsoleLog -> {
                        addLog(message.message, message.logType)
                    }
                    is BotWsMessage.StreamFrame -> {
                        decodeAndSetFrame(message.frameBase64)
                    }
                    is BotWsMessage.BotFinished -> {
                        _isBotRunning.value = false
                        addLog("Bot Script successfully executed its full flow.", "success")
                        fetchRestStats() // update stats locally as the run finishes
                    }
                }
            }
        }
    }

    /**
     * Initializes the monitor for a specific project.
     */
    fun selectProject(name: String) {
        _projectName.value = name
        _consoleLogs.value = emptyList()
        _latestFrame.value = null
        addLog("Initializing real-time monitor panel for: $name", "info")
        
        // Rebuild Rest Service matching configuration
        val httpUrl = configManager.getHttpUrl()
        apiService = BotApiService.create(httpUrl)
        refreshStats()
        fetchInventory()
        
        // Connect WebSocket
        val wsUrl = configManager.getWebSocketUrl(name)
        webSocketClient.connect(wsUrl)

        // Fetch historic project metrics via API
        fetchRestStats()

        // Fetch all projects for navigation
        viewModelScope.launch {
            try {
                val service = apiService ?: return@launch
                val projects = service.getProjects()
                _allProjects.value = projects
            } catch (e: Exception) {
                Log.e(TAG, "Failed to load projects: ${e.message}")
            }
        }

        // Check browser status and auto-start stream if running
        viewModelScope.launch {
            try {
                val service = apiService ?: return@launch
                val status = service.getBrowserStatus(name)
                val isRunning = status["isRunning"] ?: false
                _isBrowserOpen.value = isRunning
                if (isRunning && !_isStreamingGrid.value) {
                    toggleStream() // Auto start stream if browser is already open
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to check browser status: ${e.message}")
            }
        }
    }

    /**
     * Завантажує збережені логи з сервера.
     */
    fun fetchHistoricLogs() {
        val projName = _projectName.value
        val service = apiService
        if (projName.isBlank() || service == null) return

        viewModelScope.launch {
            try {
                val response = service.getProjectLogs(projName)
                val newLogs = response.map {
                    LogEntry(text = it.text, type = it.type, timestamp = it.timestamp.ifBlank {
                        val sdf = java.text.SimpleDateFormat("HH:mm:ss", java.util.Locale.getDefault())
                        sdf.format(java.util.Date())
                    })
                }
                
                val currentLogs = _consoleLogs.value
                _consoleLogs.value = (newLogs + currentLogs).takeLast(200)
            } catch (e: Exception) {
                Log.e(TAG, "Error fetching historic logs: ${e.message}")
            }
        }
    }

    /**
     * Decodes Base64 stream images asynchronously using Coroutines over a background executor.
     */
    private fun decodeAndSetFrame(base64Str: String) {
        viewModelScope.launch(Dispatchers.Default) {
            try {
                val cleanBase64 = if (base64Str.contains(",")) {
                    base64Str.substring(base64Str.indexOf(",") + 1)
                } else {
                    base64Str
                }
                val imageBytes = Base64.decode(cleanBase64, Base64.DEFAULT)
                val bitmap = BitmapFactory.decodeByteArray(imageBytes, 0, imageBytes.size)
                
                withContext(Dispatchers.Main) {
                    _latestFrame.value = bitmap
                }
            } catch (e: Exception) {
                Log.e(TAG, "Stream decoding failure: ${e.message}")
            }
        }
    }

    /**
     * Adds a log to console lists with timestamp details.
     */
    fun addLog(text: String, type: String = "info") {
        if (text.isBlank()) return
        val sdf = SimpleDateFormat("HH:mm:ss", Locale.getDefault())
        val timestamp = sdf.format(Date())
        viewModelScope.launch {
            val newLogs = _consoleLogs.value.toMutableList().apply {
                add(LogEntry(text = text, type = type, timestamp = timestamp))
                // Retain max 200 logs on visual list for optimal DOM recomposition memory management
                if (size > 200) {
                    removeAt(0)
                }
            }
            _consoleLogs.value = newLogs
        }
    }

    /**
     * Clears all log events on the UI console dashboard.
     */
    fun clearConsole() {
        _consoleLogs.value = emptyList()
        addLog("Console log cache cleared by operator.", "debug")
    }

    /**
     * Pulls the project stats from REST API dynamically.
     */
    fun fetchRestStats() {
        val projName = _projectName.value
        val service = apiService
        if (projName.isBlank() || service == null) return

        viewModelScope.launch {
            _isLoadingStats.value = true
            try {
                val stats = service.getProjectStats(projName)
                _projectStats.value = stats
                Log.d(TAG, "Rest stats fetched: $stats")
            } catch (e: Exception) {
                Log.e(TAG, "Error fetching REST project metrics: ${e.message}")
            } finally {
                _isLoadingStats.value = false
            }
        }
    }

    /**
     * Commands WebSocket backend to run bot.
     */
    fun runBot() {
        addLog("Sending run command payload to backend...", "info")
        webSocketClient.startBot()
        // Also fire high-level REST command to enforce running status if needed, but WebSocket is primary
        _isBotRunning.value = true
    }

    /**
     * Commands WebSocket backend to stop bot project.
     */
    fun stopBot() {
        addLog("Sending immediate termination payload to backend...", "info")
        webSocketClient.stopBot()
        _isBotRunning.value = false
    }

    /**
     * Toggles live streaming transmission.
     */
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

    /**
     * Відправляє координати кліку миші на сервер.
     */
    fun sendMouseClick(x: Float, y: Float, width: Int, height: Int) {
        webSocketClient.sendMouseClick(x, y, width, height)
    }

    /**
     * Оновлює сторінку в браузері.
     */
    fun fetchInventory() {
        val service = apiService ?: return
        val currentProject = _projectName.value
        if (currentProject.isEmpty()) return

        viewModelScope.launch {
            try {
                val response = service.getInventory(currentProject)
                _inventoryItems.value = response.data
                _projectVariables.value = response.variables ?: emptyMap()
            } catch (e: Exception) {
                Log.e(TAG, "Failed to fetch inventory for project $currentProject: ${e.message}")
            }
        }
    }

    /**
     * Оновлює сторінку в браузері.
     */
    fun refreshPage() {
        webSocketClient.refreshPage()
    }

    fun refreshStats() {
        fetchInventory()
    }

    /**
     * Відправляє свайп/скрол.
     */
    fun sendScroll(deltaX: Float, deltaY: Float) {
        webSocketClient.sendScroll(deltaX, deltaY)
    }

    /**
     * Triggered when leaving screen to safely release network overhead.
     */
    fun onExit() {
        Log.d(TAG, "Leaving screen, releasing connections")
        webSocketClient.stopStream()
        webSocketClient.disconnect()
        _latestFrame.value = null
        _isStreamingGrid.value = false
    }

    /**
     * Відкриває або закриває браузер для проекту
     */
    fun toggleBrowser() {
        val service = apiService ?: return
        val currentlyOpen = _isBrowserOpen.value
        val name = _projectName.value
        
        viewModelScope.launch {
            try {
                if (currentlyOpen) {
                    service.closeBrowser(name)
                    _isBrowserOpen.value = false
                    if (_isStreamingGrid.value) {
                        toggleStream() // Закриваємо трансляцію якщо закрили браузер
                    }
                    addLog("Браузер закрито", "info")
                } else {
                    service.openBrowser(name)
                    _isBrowserOpen.value = true
                    if (!_isStreamingGrid.value) {
                        toggleStream() // Запускаємо трансляцію якщо відкрили браузер
                    }
                    addLog("Браузер відкрито", "success")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to toggle browser", e)
                addLog("Помилка роботи з браузером: ${e.message}", "error")
            }
        }
    }

    /**
     * Навігація до сусіднього проекту (direction: -1 для попереднього, 1 для наступного)
     */
    fun navigateProject(direction: Int, onNavigate: (String) -> Unit) {
        val currentName = _projectName.value
        val list = _allProjects.value
        if (list.isEmpty()) return
        
        val currentIndex = list.indexOf(currentName)
        if (currentIndex == -1) return
        
        var nextIndex = currentIndex + direction
        if (nextIndex < 0) nextIndex = list.size - 1
        if (nextIndex >= list.size) nextIndex = 0
        
        val nextProjectName = list[nextIndex]
        onNavigate(nextProjectName)
    }

    override fun onCleared() {
        super.onCleared()
        onExit()
    }
}
