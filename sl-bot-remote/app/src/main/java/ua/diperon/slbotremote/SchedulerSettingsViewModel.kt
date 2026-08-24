package ua.diperon.slbotremote // Пакет нашого керуючого додатку

import android.app.Application // Імпорт контексту Android додатку
import android.util.Log // Імпорт логувальника для відладки
import androidx.lifecycle.AndroidViewModel // Використовуємо ViewModel з контекстом додатку
import androidx.lifecycle.viewModelScope // Робота в корутинах у межах життєвого циклу ViewModel
import kotlinx.coroutines.flow.MutableStateFlow // Стан для редагування всередині класу
import kotlinx.coroutines.flow.StateFlow // Лише для читання у Compose-компонентах
import kotlinx.coroutines.flow.asStateFlow // Захищене приведення у стан лише для зчитування
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.launch // Запуск асинхронних завдань

/**
 * Android ViewModel державна структура для керування та налаштування розкладів запусків проектів.
 */
class SchedulerSettingsViewModel(application: Application) : AndroidViewModel(application) {
    // Отримуємо глобальний контекст додатку
    private val context = application.applicationContext
    // Менеджер конфігурації для динамічного зчитування URL сервера
    private val configManager = ConnectionConfigManager(context)
    // Посилання на сервіс REST API
    private val interceptor = DynamicBaseUrlInterceptor()
    private val apiService: BotApiService = BotApiService.create(interceptor)

    private val _errorEvents = MutableSharedFlow<String>(extraBufferCapacity = 1)
    val errorEvents: SharedFlow<String> = _errorEvents.asSharedFlow()

    companion object {
        // Тег для логування подій налаштування розкладу
        private const val TAG = "SchedulerSettingsVM"
    }

    // Редагуємий стан налаштувань запуску проекту
    private val _launchSettings = MutableStateFlow(LaunchSettings())
    // Зовнішній потік стану конфігурації розкладу
    val launchSettings: StateFlow<LaunchSettings> = _launchSettings.asStateFlow()

    // Стан відображення індикатора завантаження
    private val _isLoading = MutableStateFlow(false)
    // Зовнішній потік для відстеження статусу завантаження
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    // Стан успішного збереження конфігурації в базу даних/бекенд
    private val _saveSuccess = MutableStateFlow(false)
    // Потік успішного збереження для виклику сповіщень
    val saveSuccess: StateFlow<Boolean> = _saveSuccess.asStateFlow()

    // Повідомлення про виникнення помилок при синхронізації
    private val _errorMessage = MutableStateFlow<String?>(null)
    // Зовнішній потік для відображення тостів або панелі помилок
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    /**
     * Ініціалізує API та запускає завантаження розкладу для обраного проекту.
     */
    fun initForProject(projectName: String) {
        interceptor.setBaseUrl(configManager.getHttpUrl())
        loadProjectConfig(projectName)
    }

    fun loadProjectConfig(projectName: String) {
        viewModelScope.launch {
            _isLoading.value = true
            _errorMessage.value = null
            try {
                val response = apiService.getProjectConfig(projectName)
                _launchSettings.value = response.data.launchSettings
                Log.d(TAG, "Конфігурацію розкладу успішно завантажено: $response")
            } catch (e: Exception) {
                Log.e(TAG, "Помилка при завантаженні розкладу: ${e.message}")
                _errorEvents.emit("Помилка завантаження розкладу: ${e.localizedMessage}")
                _launchSettings.value = LaunchSettings()
            } finally {
                _isLoading.value = false
            }
        }
    }

    /**
     * Змінює режим роботи планувальника (interval або schedule).
     */
    fun updateMode(mode: String) {
        _launchSettings.value = _launchSettings.value.copy(mode = mode)
    }

    /**
     * Оновлює числове значення тривалості інтервалу між запусками.
     */
    fun updateIntervalValue(value: Int) {
        _launchSettings.value = _launchSettings.value.copy(intervalValue = value)
    }

    /**
     * Встановлює одиницю вимірювання інтервалу (хвилини чи години).
     */
    fun updateIntervalUnit(unit: String) {
        _launchSettings.value = _launchSettings.value.copy(intervalUnit = unit)
    }

    /**
     * Встановлює точний час запуску бота у форматі HH:MM.
     */
    fun updateScheduleTime(time: String) {
        _launchSettings.value = _launchSettings.value.copy(scheduleTime = time)
    }

    /**
     * Додає або видаляє певний день тижня зі списку днів виконання за розкладом.
     */
    fun toggleScheduleDay(day: Int) {
        val currentDays = _launchSettings.value.scheduleDays.toMutableList() // Копіювання існуючого списку днів
        if (currentDays.contains(day)) {
            currentDays.remove(day) // Видалити, якщо день уже був обраний
        } else {
            currentDays.add(day) // Додати новий обраний день
        }
        currentDays.sort() // Сортувати дні по зростанню (від Понеділка 1 до Неділі 7)
        _launchSettings.value = _launchSettings.value.copy(scheduleDays = currentDays) // Збереження копії у стейт
    }

    fun saveConfig(projectName: String, onComplete: (Boolean) -> Unit) {
        viewModelScope.launch {
            _isLoading.value = true
            _errorMessage.value = null
            _saveSuccess.value = false
            try {
                val request = ProjectConfigRequest(
                    name = projectName,
                    data = ProjectConfigData(launchSettings = _launchSettings.value)
                )
                val response = apiService.saveProjectConfig(request)
                if (response.success) {
                    _saveSuccess.value = true
                    onComplete(true)
                } else {
                    _errorMessage.value = response.message ?: "Помилка при збереженні конфігурації розкладу"
                    _errorEvents.emit(response.message ?: "Помилка збереження")
                    onComplete(false)
                }
            } catch (e: Exception) {
                Log.e(TAG, "Помилка збереження JSON налаштувань: ${e.message}")
                _errorMessage.value = "Помилка підключення до сервера при збереженні"
                _errorEvents.emit("Помилка збереження: ${e.localizedMessage}")
                onComplete(false)
            } finally {
                _isLoading.value = false
            }
        }
    }

    /**
     * Скидає прапорець успіху збереження в UI.
     */
    fun resetSaveSuccess() {
        _saveSuccess.value = false
    }
}
