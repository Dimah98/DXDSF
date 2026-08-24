package ua.diperon.slbotremote

import android.app.Application
import android.util.Log
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.isActive
import ua.diperon.slbotremote.data.AppDatabase
import ua.diperon.slbotremote.data.CachedGlobalStatsEntity
import ua.diperon.slbotremote.data.CachedNotificationEntity
import ua.diperon.slbotremote.data.CachedProjectEntity
import ua.diperon.slbotremote.data.CachedScheduleEntity
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory

sealed class TestConnectionResult {
    object Idle : TestConnectionResult()
    object Testing : TestConnectionResult()
    data class Success(val message: String) : TestConnectionResult()
    data class Failure(val error: String) : TestConnectionResult()
}

data class ProjectModel(
    val name: String,
    val isRunning: Boolean = false,
    val isBrowserOpen: Boolean = false,
    val activeNodeTitle: String? = null,
    val nextRun: Long? = null,
    val plannedNodeRun: Long? = null,
    val miniImages: List<Pair<String, Int?>> = emptyList(),
    val level: Int? = null,
    val gold: Double? = null,
    val balance: Double? = null,
    val gem: Double? = null,
    val isFullMoon: Boolean = false,
    val season: String? = null
)

class DashboardViewModel(application: Application) : AndroidViewModel(application) {

    private val context = application.applicationContext
    private val configManager = ConnectionConfigManager(context)
    private val miniImagesManager = MiniImagesManager(context)
    private val db = AppDatabase.getInstance(context)
    private val dao = db.dao()
    private val interceptor = DynamicBaseUrlInterceptor()
    private var apiService: BotApiService = BotApiService.create(interceptor)
    private val moshi = Moshi.Builder().addLast(KotlinJsonAdapterFactory()).build()

    fun getApiService(): BotApiService = apiService

    companion object {
        private const val TAG = "DashboardVM"
    }

    private val _projects = MutableStateFlow<List<ProjectModel>>(emptyList())
    val projects: StateFlow<List<ProjectModel>> = _projects.asStateFlow()

    private val _globalStats = MutableStateFlow<GlobalStats?>(null)
    val globalStats: StateFlow<GlobalStats?> = _globalStats.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _isConnectionSuccessful = MutableStateFlow<Boolean?>(null)
    val isConnectionSuccessful: StateFlow<Boolean?> = _isConnectionSuccessful.asStateFlow()

    private val _isQueueRunning = MutableStateFlow(false)
    val isQueueRunning: StateFlow<Boolean> = _isQueueRunning.asStateFlow()

    private var sequentialRunJob: kotlinx.coroutines.Job? = null

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    private val _errorEvents = MutableSharedFlow<String>(extraBufferCapacity = 1)
    val errorEvents: SharedFlow<String> = _errorEvents.asSharedFlow()

    private val _notificationCount = MutableStateFlow(0)
    val notificationCount: StateFlow<Int> = _notificationCount.asStateFlow()

    private val _internalConfig = MutableStateFlow<Map<String, Int>>(emptyMap())
    val internalConfig: StateFlow<Map<String, Int>> = _internalConfig.asStateFlow()

    private val _testResult = MutableStateFlow<TestConnectionResult>(TestConnectionResult.Idle)
    val testResult: StateFlow<TestConnectionResult> = _testResult.asStateFlow()

    private val _connectionConfig = MutableStateFlow(ConnectionConfig())
    val connectionConfig: StateFlow<ConnectionConfig> = _connectionConfig.asStateFlow()

    init {
        loadConfigAndRefresh()
        startPeriodicRefresh()
    }

    private fun startPeriodicRefresh() {
        viewModelScope.launch {
            while (true) {
                kotlinx.coroutines.delay(30000)
                refreshData()
            }
        }
    }

    fun loadConfigAndRefresh() {
        val config = configManager.loadConfig()
        _connectionConfig.value = config
        val url = configManager.getHttpUrl()
        interceptor.setBaseUrl(url)
        // load from cache first
        viewModelScope.launch {
            try {
                val cached = dao.getProjects()
                if (cached.isNotEmpty()) {
                    _projects.value = cached.map { e ->
                        val miniImages = parseMiniImages(e.miniImagesJson)
                        ProjectModel(
                            name = e.name,
                            isRunning = e.isRunning,
                            isBrowserOpen = false, // Не кешуємо цей стан, він швидко оновиться
                            activeNodeTitle = e.activeNodeTitle,
                            nextRun = e.nextRun,
                            plannedNodeRun = e.plannedNodeRun,
                            miniImages = miniImages,
                            level = e.level,
                            gold = e.gold,
                            balance = e.balance,
                            gem = e.gem,
                            isFullMoon = e.isFullMoon,
                            season = e.season
                        )
                    }
                }
                val cachedGlobal = dao.getGlobalStats()
                if (cachedGlobal != null) {
                    _globalStats.value = GlobalStats(
                        cachedGlobal.totalRuns,
                        cachedGlobal.successfulRuns,
                        cachedGlobal.failedRuns,
                        cachedGlobal.activeBots
                    )
                }
            } catch (e: Exception) {
                Log.w(TAG, "Cache read error: ${e.message}")
            }
            refreshData()
        }
    }

    private fun parseMiniImages(json: String): List<Pair<String, Int?>> {
        return try {
            val type = com.squareup.moshi.Types.newParameterizedType(
                List::class.java,
                com.squareup.moshi.Types.newParameterizedType(
                    Pair::class.java,
                    String::class.java,
                    Int::class.javaObjectType
                )
            )
            moshi.adapter<List<Pair<String, Int?>>>(type).fromJson(json) ?: emptyList()
        } catch (e: Exception) {
            emptyList()
        }
    }

    private fun toMiniImagesJson(list: List<Pair<String, Int?>>): String {
        return try {
            val type = com.squareup.moshi.Types.newParameterizedType(
                List::class.java,
                com.squareup.moshi.Types.newParameterizedType(
                    Pair::class.java,
                    String::class.java,
                    Int::class.javaObjectType
                )
            )
            moshi.adapter<List<Pair<String, Int?>>>(type).toJson(list) ?: "[]"
        } catch (e: Exception) {
            "[]"
        }
    }

    fun refreshData() {
        viewModelScope.launch {
            _isLoading.value = true
            _errorMessage.value = null
            try {
                val projectNames = try {
                    val names = apiService.getProjects()
                    _isConnectionSuccessful.value = true
                    names
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to get projects: ${e.message}")
                    _isConnectionSuccessful.value = false
                    _errorEvents.emit("Помилка завантаження проєктів: ${e.localizedMessage}")
                    emptyList<String>()
                }

                val statusMap = try {
                    apiService.getProjectsStatus()
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to get running states: ${e.message}")
                    emptyMap<String, ProjectStatusInfo>()
                }

                val schedules = try {
                    apiService.getSchedule()
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to get schedules: ${e.message}")
                    emptyList<ScheduleInfo>()
                }
                val scheduleMap = schedules.associateBy { it.projectName }

                val loadedProjects = kotlinx.coroutines.coroutineScope {
                    projectNames.map { name ->
                        async {
                            val statusInfo = statusMap[name]
                            val scheduleInfo = scheduleMap[name]

                            val projectSaveData = try {
                                val saveResponse = apiService.getProjectSave(name)
                                if (saveResponse.success) saveResponse.data else null
                            } catch (e: Exception) {
                                Log.w(TAG, "Project save data not available for $name: ${e.message}")
                                null
                            }

                            val miniImages = miniImagesManager.getMiniImagesForProject(projectSaveData)
                            val level = miniImagesManager.calculateLevelFromSaveData(projectSaveData)
                            val gold = miniImagesManager.getGoldFromSaveData(projectSaveData)
                            val balance = miniImagesManager.getBalanceFromSaveData(projectSaveData)
                            val gem = miniImagesManager.getGemFromSaveData(projectSaveData)
                            val isFullMoon = miniImagesManager.checkFullMoonFromSaveData(projectSaveData)
                            val season = miniImagesManager.getSeasonFromSaveData(projectSaveData)

                            ProjectModel(
                                name = name,
                                isRunning = statusInfo?.isRunning ?: false,
                                isBrowserOpen = statusInfo?.isBrowserOpen ?: false,
                                activeNodeTitle = statusInfo?.activeNodeTitle,
                                nextRun = scheduleInfo?.nextRun,
                                plannedNodeRun = scheduleInfo?.plannedRuns?.firstOrNull()?.runAt,
                                miniImages = miniImages,
                                level = level,
                                gold = gold,
                                balance = balance,
                                gem = gem,
                                isFullMoon = isFullMoon,
                                season = season
                            )
                        }
                    }.awaitAll()
                }
                _projects.value = loadedProjects

                // cache to Room
                dao.insertProjects(loadedProjects.map {
                    CachedProjectEntity(
                        name = it.name,
                        isRunning = it.isRunning,
                        activeNodeTitle = it.activeNodeTitle,
                        nextRun = it.nextRun,
                        plannedNodeRun = it.plannedNodeRun,
                        miniImagesJson = toMiniImagesJson(it.miniImages),
                        level = it.level,
                        gold = it.gold,
                        balance = it.balance,
                        gem = it.gem,
                        isFullMoon = it.isFullMoon,
                        season = it.season,
                        cachedAt = System.currentTimeMillis()
                    )
                })
                dao.insertSchedules(schedules.map {
                    CachedScheduleEntity(
                        projectName = it.projectName,
                        mode = it.mode,
                        nextRun = it.nextRun,
                        lastRun = it.lastRun,
                        settingsJson = try { moshi.adapter(ScheduleSettings::class.java).toJson(it.settings) } catch (e: Exception) { "{}" },
                        plannedRunsJson = try { moshi.adapter(List::class.java).toJson(it.plannedRuns) } catch (e: Exception) { "[]" },
                        cachedAt = System.currentTimeMillis()
                    )
                })

                val stats = try {
                    val rawStats = apiService.getGlobalStats()
                    val totalRuns = rawStats.sumOf { (it["stats"] as? List<*>)?.size ?: 0 }
                    GlobalStats(
                        totalRuns = totalRuns,
                        successfulRuns = totalRuns,
                        failedRuns = 0,
                        activeBots = _projects.value.count { it.isRunning }
                    )
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to get global stats: ${e.message}")
                    null
                }
                _globalStats.value = stats
                stats?.let {
                    dao.insertGlobalStats(
                        CachedGlobalStatsEntity(
                            id = 1,
                            totalRuns = it.totalRuns,
                            successfulRuns = it.successfulRuns,
                            failedRuns = it.failedRuns,
                            activeBots = it.activeBots,
                            cachedAt = System.currentTimeMillis()
                        )
                    )
                }

                try {
                    fetchNotificationCount()
                } catch (e: Exception) {
                    Log.w(TAG, "Notification count error: ${e.message}")
                }
                try {
                    fetchInternalConfig()
                } catch (e: Exception) {
                    Log.w(TAG, "Internal config error: ${e.message}")
                }
                if (projectNames.isNotEmpty()) {
                    _errorMessage.value = null
                    _isConnectionSuccessful.value = true
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failure during refreshData: ${e.message}", e)
                if (_projects.value.isEmpty()) {
                    _isConnectionSuccessful.value = false
                    _errorMessage.value = "Помилка синхронізації з бекендом. Перевірте налаштування з'єднання."
                }
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun fetchNotificationCount() {
        viewModelScope.launch {
            try {
                val response = apiService.getNotifications()
                _notificationCount.value = response.unreadCount
                dao.insertNotifications(response.notifications.map {
                    CachedNotificationEntity(
                        id = it.id,
                        projectName = it.projectName,
                        message = it.message,
                        timestamp = it.timestamp,
                        read = it.read,
                        cachedAt = System.currentTimeMillis()
                    )
                })
            } catch (e: Exception) {
                Log.e(TAG, "Failed to fetch notifications count: ${e.message}")
                _errorEvents.emit("Помилка сповіщень: ${e.localizedMessage}")
            }
        }
    }

    fun fetchInternalConfig() {
        viewModelScope.launch {
            try {
                val config = apiService.getInternalConfig()
                _internalConfig.value = config
            } catch (e: Exception) {
                Log.e(TAG, "Failed to fetch internal config: ${e.message}")
                _errorEvents.emit("Помилка конфігурації: ${e.localizedMessage}")
            }
        }
    }

    fun updateInternalConfig(newConfig: Map<String, Int>) {
        viewModelScope.launch {
            try {
                apiService.updateInternalConfig(newConfig)
                fetchInternalConfig()
            } catch (e: Exception) {
                Log.e(TAG, "Failed to update internal config: ${e.message}")
                _errorEvents.emit("Помилка оновлення конфігурації: ${e.localizedMessage}")
            }
        }
    }

    fun startProject(projectName: String) {
        viewModelScope.launch {
            try {
                val response = apiService.runMultiple(RunProjectsRequest(listOf(projectName)))
                if (response.success) {
                    updateLocalProjectState(projectName, true)
                } else {
                    _errorMessage.value = response.message ?: "Failed to start $projectName"
                    _errorEvents.emit(response.message ?: "Не вдалося запустити $projectName")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error starting project $projectName: ${e.message}")
                _errorEvents.emit("Помилка запуску: ${e.localizedMessage}")
            }
        }
    }

    fun stopProject(projectName: String) {
        viewModelScope.launch {
            try {
                val response = apiService.stopMultiple(StopProjectsRequest(listOf(projectName)))
                if (response.success) {
                    updateLocalProjectState(projectName, false)
                } else {
                    _errorMessage.value = response.message ?: "Failed to halt $projectName"
                    _errorEvents.emit(response.message ?: "Не вдалося зупинити $projectName")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error halting project $projectName: ${e.message}")
                _errorEvents.emit("Помилка зупинки: ${e.localizedMessage}")
            }
        }
    }

    fun updateProjectSchedule(
        projectName: String,
        request: ScheduleUpdateRequest,
        onSuccess: () -> Unit = {}
    ) {
        viewModelScope.launch {
            try {
                val response = apiService.updateSchedule(projectName, request)
                if (response.success) {
                    _errorEvents.emit("Налаштування для $projectName збережено!")
                    refreshData()
                    onSuccess()
                } else {
                    _errorEvents.emit("Помилка: ${response.message}")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to update schedule for $projectName", e)
                _errorEvents.emit("Помилка збереження: ${e.localizedMessage}")
            }
        }
    }

    fun startSequentialQueue(projectNames: List<String>, delayMinutes: Int) {
        if (projectNames.isEmpty()) return
        cancelSequentialQueue()
        _isQueueRunning.value = true

        sequentialRunJob = viewModelScope.launch {
            try {
                for ((index, projectName) in projectNames.withIndex()) {
                    if (!isActive) break
                    
                    // Повідомлення про старт
                    _errorEvents.emit("Запуск проекту $projectName (${index + 1} з ${projectNames.size})")

                    // Start project
                    val response = apiService.runMultiple(RunProjectsRequest(listOf(projectName)))
                    if (!response.success) {
                        _errorEvents.emit("Помилка запуску $projectName в черзі: ${response.message}")
                    } else {
                        updateLocalProjectState(projectName, true)
                        
                        // Чекаємо завершення (поки isRunning = true)
                        var isFinished = false
                        while (isActive && !isFinished) {
                            kotlinx.coroutines.delay(5000) // перевіряємо кожні 5 сек
                            try {
                                val statusMap = apiService.getProjectsStatus()
                                val status = statusMap[projectName]
                                if (status == null || !status.isRunning) {
                                    updateLocalProjectState(projectName, false)
                                    isFinished = true
                                }
                            } catch (e: Exception) {
                                Log.w(TAG, "Error polling status for $projectName: ${e.message}")
                            }
                        }
                    }

                    // Затримка перед наступним проектом
                    if (index < projectNames.size - 1 && isActive) {
                        _errorEvents.emit("Проект $projectName завершено. Очікування $delayMinutes хв перед наступним...")
                        val delayMs = delayMinutes * 60 * 1000L
                        kotlinx.coroutines.delay(delayMs)
                    }
                }
                
                if (isActive) {
                    _errorEvents.emit("Черга успішно завершена! Виконано ${projectNames.size} проектів.")
                }
            } catch (e: Exception) {
                if (e !is kotlinx.coroutines.CancellationException) {
                    Log.e(TAG, "Queue error: ${e.message}")
                    _errorEvents.emit("Помилка черги: ${e.localizedMessage}")
                }
            } finally {
                _isQueueRunning.value = false
            }
        }
    }

    fun cancelSequentialQueue() {
        sequentialRunJob?.cancel()
        sequentialRunJob = null
        _isQueueRunning.value = false
        viewModelScope.launch {
            _errorEvents.emit("Виконання черги скасовано")
        }
    }

    fun saveSettings(host: String, port: String, ipAddress: String, ipAddress2: String, activeIpAddress: Int) {
        val newConfig = ConnectionConfig(host.trim(), port.trim(), ipAddress.trim(), ipAddress2.trim(), activeIpAddress)
        configManager.saveConfig(newConfig)
        _connectionConfig.value = newConfig
        val url = configManager.getHttpUrl()
        interceptor.setBaseUrl(url)
        Log.d(TAG, "Settings saved. Base URL updated: $url")
        refreshData()
    }

    fun testConnection(tempHost: String, tempPort: String) {
        viewModelScope.launch {
            _testResult.value = TestConnectionResult.Testing
            try {
                val cleanHost = tempHost.replace("http://", "").replace("https://", "").trim()
                val cleanPort = tempPort.trim()
                val tempInterceptor = DynamicBaseUrlInterceptor()
                tempInterceptor.setBaseUrl("http://$cleanHost:$cleanPort")
                val tempService = BotApiService.create(tempInterceptor)
                val projects = tempService.getProjects()
                _testResult.value = TestConnectionResult.Success(
                    "Connected successfully!\nDiscovered ${projects.size} active bot constructor projects."
                )
            } catch (e: Exception) {
                Log.e(TAG, "Connection verification failed: ${e.message}")
                _testResult.value = TestConnectionResult.Failure(
                    e.localizedMessage ?: "Network Connection Refused or Timed out."
                )
                _errorEvents.emit("Тест з'єднання не вдався: ${e.localizedMessage}")
            }
        }
    }

    fun testActiveConnection() {
        viewModelScope.launch {
            _testResult.value = TestConnectionResult.Testing
            try {
                val activeIp = configManager.getActiveIpAddress()
                val projects = apiService.getProjects()
                _testResult.value = TestConnectionResult.Success(
                    "Connected successfully to $activeIp!\nDiscovered ${projects.size} active bot constructor projects."
                )
            } catch (e: Exception) {
                Log.e(TAG, "Connection verification failed: ${e.message}")
                _testResult.value = TestConnectionResult.Failure(
                    e.localizedMessage ?: "Network Connection Refused or Timed out."
                )
                _errorEvents.emit("Тест з'єднання не вдався: ${e.localizedMessage}")
            }
        }
    }

    fun resetTestResult() {
        _testResult.value = TestConnectionResult.Idle
    }

    private fun updateLocalProjectState(name: String, isRunning: Boolean) {
        _projects.value = _projects.value.map {
            if (it.name == name) it.copy(isRunning = isRunning) else it
        }
    }

    fun closeAllBrowsers() {
        viewModelScope.launch {
            try {
                val response = apiService.closeAllBrowsers()
                if (response.success) {
                    _errorEvents.emit("🌐 Всі браузери на комп'ютері успішно закриті")
                } else {
                    _errorEvents.emit("❌ Помилка: ${response.message ?: "Не вдалося закрити браузери"}")
                }
                refreshData()
            } catch (e: Exception) {
                Log.e(TAG, "Error closing all browsers: ${e.message}")
                _errorEvents.emit("❌ Помилка закриття браузерів: ${e.localizedMessage}")
            }
        }
    }
}
