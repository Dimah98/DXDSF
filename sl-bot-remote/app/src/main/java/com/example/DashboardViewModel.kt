package com.example

import android.app.Application
import android.util.Log
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * Represent states of API connection tests
 */
sealed class TestConnectionResult {
    object Idle : TestConnectionResult()
    object Testing : TestConnectionResult()
    data class Success(val message: String) : TestConnectionResult()
    data class Failure(val error: String) : TestConnectionResult()
}

/**
 * Combined list representations of projects with live states
 */
data class ProjectModel(
    val name: String,
    val isRunning: Boolean = false,
    val activeNodeTitle: String? = null,
    val nextRun: Long? = null, // Час наступного запуску від розкладу
    val plannedNodeRun: Long? = null // Час наступного запуску від ноди
)

class DashboardViewModel(application: Application) : AndroidViewModel(application) {

    private val context = application.applicationContext
    private val configManager = ConnectionConfigManager(context)
    private var apiService: BotApiService? = null
    
    // Публічний доступ до apiService для інших екранів
    fun getApiService(): BotApiService? = apiService

    companion object {
        private const val TAG = "DashboardVM"
    }

    private val _projects = MutableStateFlow<List<ProjectModel>>(emptyList())
    val projects: StateFlow<List<ProjectModel>> = _projects.asStateFlow()

    private val _globalStats = MutableStateFlow<GlobalStats?>(null)
    val globalStats: StateFlow<GlobalStats?> = _globalStats.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    private val _notificationCount = MutableStateFlow(0) // Кількість непрочитаних сповіщень
    val notificationCount: StateFlow<Int> = _notificationCount.asStateFlow() // Публічний потік лічильника

    private val _internalConfig = MutableStateFlow<Map<String, Int>>(emptyMap())
    val internalConfig: StateFlow<Map<String, Int>> = _internalConfig.asStateFlow()

    // Test connection states
    private val _testResult = MutableStateFlow<TestConnectionResult>(TestConnectionResult.Idle)
    val testResult: StateFlow<TestConnectionResult> = _testResult.asStateFlow()

    // Loaded settings state
    private val _connectionConfig = MutableStateFlow(ConnectionConfig())
    val connectionConfig: StateFlow<ConnectionConfig> = _connectionConfig.asStateFlow()

    init {
        loadConfigAndRefresh()
    }

    /**
     * Loads saved host configurations from store, sets up API service, and refreshes remote resources.
     */
    fun loadConfigAndRefresh() {
        val config = configManager.loadConfig()
        _connectionConfig.value = config
        
        val url = configManager.getHttpUrl()
        apiService = BotApiService.create(url)
        
        refreshData()
    }

    /**
     * Refreshes project listings, live active status configurations, and global statistics.
     */
    fun refreshData() {
        val service = apiService ?: return
        viewModelScope.launch {
            _isLoading.value = true
            _errorMessage.value = null
            try {
                // Fetch projects list (Array of project names)
                val projectNames = try {
                    service.getProjects()
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to get projects: ${e.message}")
                    emptyList()
                }

                // Fetch running statuses (Map of name -> state)
                val statusMap = try {
                    service.getProjectsStatusDetailed() // Отримуємо детальні статуси проектів
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to get running states: ${e.message}") // Логуємо помилку
                    emptyMap<String, ProjectStatusInfo>() // Повертаємо порожню карту при помилці
                }

                // Fetch schedule info
                val schedules = try {
                    service.getSchedule()
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to get schedules: ${e.message}")
                    emptyList()
                }
                // Map project name to schedule info
                val scheduleMap = schedules.associateBy { it.projectName }

                // Map results into our integrated model structure
                val loadedProjects = projectNames.map { name ->
                    val statusInfo = statusMap[name] // Отримуємо статус для кожного проекту
                    val scheduleInfo = scheduleMap[name] // Отримуємо розклад для проекту
                    ProjectModel(
                        name = name, // Назва проекту
                        isRunning = statusInfo?.isRunning ?: false, // Стан запуску
                        activeNodeTitle = statusInfo?.activeNodeTitle, // Назва активної ноди
                        nextRun = scheduleInfo?.nextRun, // Час наступного запуску за розкладом
                        plannedNodeRun = scheduleInfo?.plannedRuns?.firstOrNull()?.runAt // Запуск від ноди
                    )
                }
                _projects.value = loadedProjects

                // Fetch Global statistics metrics
                val stats = try {
                    service.getGlobalStats()
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to get global stats: ${e.message}")
                    null
                }
                _globalStats.value = stats
                
                fetchNotificationCount() // Завантажуємо сповіщення
                fetchInternalConfig() // Завантажуємо конфігурацію модулів

            } catch (e: Exception) {
                Log.e(TAG, "Fatal failure during refreshData: ${e.message}", e)
                _errorMessage.value = "Failed to sync with backend. Check Connection Settings."
            } finally {
                _isLoading.value = false
            }
        }
    }

    /**
     * Завантажує кількість непрочитаних сповіщень від сервера.
     */
    fun fetchNotificationCount() {
        val service = apiService ?: return // Перевіряємо наявність сервісу
        viewModelScope.launch { // Запускаємо корутину
            try {
                val response = service.getNotifications() // Отримуємо сповіщення від API
                _notificationCount.value = response.unreadCount // Оновлюємо лічильник непрочитаних
            } catch (e: Exception) {
                Log.e(TAG, "Failed to fetch notifications count: ${e.message}") // Логуємо помилку
            }
        }
    }

    /**
     * Завантажує внутрішню конфігурацію модулів
     */
    fun fetchInternalConfig() {
        val service = apiService ?: return
        viewModelScope.launch {
            try {
                val config = service.getInternalConfig()
                _internalConfig.value = config
            } catch (e: Exception) {
                Log.e(TAG, "Failed to fetch internal config: ${e.message}")
            }
        }
    }

    /**
     * Оновлює внутрішню конфігурацію
     */
    fun updateInternalConfig(newConfig: Map<String, Int>) {
        val service = apiService ?: return
        viewModelScope.launch {
            try {
                service.updateInternalConfig(newConfig)
                fetchInternalConfig() // Оновлюємо стейт після успішного збереження
            } catch (e: Exception) {
                Log.e(TAG, "Failed to update internal config: ${e.message}")
            }
        }
    }

    /**
     * Quick Toggle Action: Run a project from dashboard card list.
     */
    fun startProject(projectName: String) {
        val service = apiService ?: return
        viewModelScope.launch {
            try {
                val response = service.runMultiple(RunProjectsRequest(listOf(projectName)))
                if (response.success) {
                    // Instantly update local state representation for responsive UI reactivity
                    updateLocalProjectState(projectName, true)
                } else {
                    _errorMessage.value = response.message ?: "Failed to start $projectName"
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error starting project $projectName: ${e.message}")
                _errorMessage.value = "Connection failure while launching project."
            }
        }
    }

    /**
     * Quick Toggle Action: Stop a project from dashboard card list.
     */
    fun stopProject(projectName: String) {
        val service = apiService ?: return
        viewModelScope.launch {
            try {
                val response = service.stopMultiple(StopProjectsRequest(listOf(projectName)))
                if (response.success) {
                    // Instantly update local state representation
                    updateLocalProjectState(projectName, false)
                } else {
                    _errorMessage.value = response.message ?: "Failed to halt $projectName"
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error halting project $projectName: ${e.message}")
                _errorMessage.value = "Connection failure while stopping project."
            }
        }
    }

    /**
     * Saves new Host parameters and resets services instantly.
     */
    fun saveSettings(host: String, port: String) {
        val newConfig = ConnectionConfig(host.trim(), port.trim())
        configManager.saveConfig(newConfig)
        _connectionConfig.value = newConfig
        
        val url = configManager.getHttpUrl()
        apiService = BotApiService.create(url)
        
        Log.d(TAG, "Settings saved. Remaking REST services with base URL: $url")
        refreshData()
    }

    /**
     * Tests connectivity to the current host / port setup by making a direct REST query.
     */
    fun testConnection(tempHost: String, tempPort: String) {
        viewModelScope.launch {
            _testResult.value = TestConnectionResult.Testing
            try {
                val cleanHost = tempHost.replace("http://", "").replace("https://", "").trim()
                val cleanPort = tempPort.trim()
                val targetUrl = "http://$cleanHost:$cleanPort"
                
                // Create temporary retro client to test specific URL endpoints
                val tempService = BotApiService.create(targetUrl)
                val projects = tempService.getProjects()
                _testResult.value = TestConnectionResult.Success(
                    "Connected successfully!\nDiscovered ${projects.size} active bot constructor projects."
                )
            } catch (e: Exception) {
                Log.e(TAG, "Connection verification failed: ${e.message}")
                _testResult.value = TestConnectionResult.Failure(
                    e.localizedMessage ?: "Network Connection Refused or Timed out."
                )
            }
        }
    }

    /**
     * Clears connection test states.
     */
    fun resetTestResult() {
        _testResult.value = TestConnectionResult.Idle
    }

    /**
     * Utility helper to update specific project running statuses in local Flow arrays.
     */
    private fun updateLocalProjectState(name: String, isRunning: Boolean) {
        _projects.value = _projects.value.map {
            if (it.name == name) it.copy(isRunning = isRunning) else it
        }
    }
}
