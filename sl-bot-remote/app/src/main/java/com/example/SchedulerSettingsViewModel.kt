package com.example // Пакет нашого керуючого додатку

import android.app.Application // Імпорт контексту Android додатку
import android.util.Log // Імпорт логувальника для відладки
import androidx.lifecycle.AndroidViewModel // Використовуємо ViewModel з контекстом додатку
import androidx.lifecycle.viewModelScope // Робота в корутинах у межах життєвого циклу ViewModel
import kotlinx.coroutines.flow.MutableStateFlow // Стан для редагування всередині класу
import kotlinx.coroutines.flow.StateFlow // Лише для читання у Compose-компонентах
import kotlinx.coroutines.flow.asStateFlow // Захищене приведення у стан лише для зчитування
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
    private var apiService: BotApiService? = null

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
        val httpUrl = configManager.getHttpUrl() // Отримання робочої адреси сервера
        apiService = BotApiService.create(httpUrl) // Ініціалізація Retrofit інтерфейсу
        loadProjectConfig(projectName) // Виклик завантаження
    }

    /**
     * Завантажує конфігурацію проекту з веб-сервера.
     */
    fun loadProjectConfig(projectName: String) {
        val service = apiService ?: return // Повернення, якщо АРІ не ініціалізовано
        viewModelScope.launch {
            _isLoading.value = true // Показати індикатор прогресу
            _errorMessage.value = null // Стерти минулі помилки
            try {
                // Виклик GET запиту на отримання поточного JSON конфігурації
                val response = service.getProjectConfig(projectName)
                // Оновлення реактивного стану отриманими даними
                _launchSettings.value = response.data.launchSettings
                Log.d(TAG, "Конфігурацію розкладу успішно завантажено: $response")
            } catch (e: Exception) {
                Log.e(TAG, "Помилка при завантаженні розкладу, використання значень за замовчуванням: ${e.message}")
                // Безпечне падіння на значення за замовчуванням у разі відсутності конфігурації на сервері (HTTP 404 / 500)
                _launchSettings.value = LaunchSettings()
            } finally {
                _isLoading.value = false // Приховати індикатор прогресу
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

    /**
     * Відправляє оновлену конфігурацію проекту POST-запитом на сервер.
     */
    fun saveConfig(projectName: String, onComplete: (Boolean) -> Unit) {
        val service = apiService ?: return // Повернення у разі відсутності сервісу
        viewModelScope.launch {
            _isLoading.value = true // Показати прогрес завантаження
            _errorMessage.value = null // Скинути старі помилки
            _saveSuccess.value = false // Скинути успішний статус
            try {
                // Побудова запиту конфігурації з вкладеним об'єктом за схемою API
                val request = ProjectConfigRequest(
                    name = projectName,
                    data = ProjectConfigData(launchSettings = _launchSettings.value)
                )
                // Відправка POST запиту на /api/save
                val response = service.saveProjectConfig(request)
                if (response.success) {
                    _saveSuccess.value = true // Успішно збережено
                    onComplete(true) // Виклик зворотного виклику з успіхом
                } else {
                    _errorMessage.value = response.message ?: "Помилка при збереженні конфігурації розкладу"
                    onComplete(false) // Сповістити про невдачу
                }
            } catch (e: Exception) {
                Log.e(TAG, "Помилка збереження JSON налаштувань: ${e.message}")
                _errorMessage.value = "Помилка підключення до сервера при збереженні"
                onComplete(false) // Помилка мережі
            } finally {
                _isLoading.value = false // Прибрати індикатор роботи
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
