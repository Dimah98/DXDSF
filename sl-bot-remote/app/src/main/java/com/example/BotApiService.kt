package com.example // Пакет нашого додатку

import com.squareup.moshi.Json // Імпорт анотації Moshi для мапінгу JSON
import com.squareup.moshi.Moshi // Імпорт Moshi для серіалізації/десеріалізації JSON
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory // Рефлексивний адаптер для Moshi
import okhttp3.OkHttpClient // HTTP-клієнт
import okhttp3.logging.HttpLoggingInterceptor // Логувальник запитів
import retrofit2.Retrofit // Бібліотека Retrofit для роботи з REST API
import retrofit2.converter.moshi.MoshiConverterFactory // Конвертер Moshi для Retrofit
import retrofit2.http.Body // Анотація для передачі об'єкта в тілі запиту
import retrofit2.http.GET // Анотація для GET-запитів
import retrofit2.http.POST // Анотація для POST-запитів
import retrofit2.http.PUT // Анотація для PUT-запитів
import retrofit2.http.DELETE // Анотація для DELETE-запитів
import retrofit2.http.Path // Анотація для передачі параметрів у шляху URL
import okhttp3.ResponseBody // Відповідь сервера в сирому вигляді
import java.util.concurrent.TimeUnit // Клас одиниць часу

/**
 * Проект бота з прапорцем його запущеного стану.
 */
data class Project(
    @Json(name = "name") val name: String, // Назва проекту
    @Json(name = "isRunning") val isRunning: Boolean = false // Чи запущений в даний момент
)

/**
 * Запит на запуск кількох проектів синхронно.
 */
data class RunProjectsRequest(
    @Json(name = "projectNames") val projectNames: List<String> // Список імен проектів для запуску
)

/**
 * Запит на зупинку кількох проектів синхронно.
 */
data class StopProjectsRequest(
    @Json(name = "projectNames") val projectNames: List<String> // Список імен проектів для зупинки
)

/**
 * Налаштування розкладу запусків бота.
 */
data class LaunchSettings(
    @Json(name = "mode") val mode: String = "interval", // Режим запуску: 'schedule' (розклад) або 'interval' (інтервальний)
    @Json(name = "intervalValue") val intervalValue: Int = 30, // Значення інтервалу часу
    @Json(name = "intervalUnit") val intervalUnit: String = "minutes", // Одиниця виміру інтервалу: 'minutes', 'hours'
    @Json(name = "scheduleDays") val scheduleDays: List<Int> = emptyList(), // Дні тижня для запуску за розкладом (1 - понеділок, 7 - неділя)
    @Json(name = "scheduleTime") val scheduleTime: String = "09:00" // Час запуску у форматі HH:MM
)

/**
 * Вкладені дані конфігурації.
 */
data class ProjectConfigData(
    @Json(name = "launchSettings") val launchSettings: LaunchSettings = LaunchSettings() // Об'єкт налаштувань запуску
)

/**
 * Модель конфігурації проекту для збереження.
 */
data class ProjectConfigRequest(
    @Json(name = "name") val name: String, // Назва проекту
    @Json(name = "data") val data: ProjectConfigData = ProjectConfigData() // Дані конфігурації
)

/**
 * Модель відповіді з сервера з конфігурацією проекту.
 */
data class ProjectConfigResponse(
    @Json(name = "name") val name: String, // Назва проекту
    @Json(name = "data") val data: ProjectConfigData = ProjectConfigData() // Дані конфігурації
)

/**
 * Об'єкт статистики запусків проекту.
 */
data class ProjectStats(
    @Json(name = "projectName") val projectName: String, // Назва проекту
    @Json(name = "totalRuns") val totalRuns: Int = 0, // Загальна кількість запусків проекту
    @Json(name = "successfulRuns") val successfulRuns: Int = 0, // Кількість успішних запусків
    @Json(name = "failedRuns") val failedRuns: Int = 0, // Кількість невдалих запусків
    @Json(name = "lastRunTime") val lastRunTime: String? = null // Час останнього запуску
)

/**
 * Загальна статистика по всім проектам та активним ботам.
 */
data class GlobalStats(
    @Json(name = "totalRuns") val totalRuns: Int = 0, // Загальна кількість запусків по всій системі
    @Json(name = "successfulRuns") val successfulRuns: Int = 0, // Загальна кількість успішних запусків
    @Json(name = "failedRuns") val failedRuns: Int = 0, // Загальна кількість невдалих запусків
    @Json(name = "activeBots") val activeBots: Int = 0 // Кількість ботів, що працюють зараз
)

// Інформація про статус проекту з деталями активної ноди
data class ProjectStatusInfo(
    @Json(name = "isRunning") val isRunning: Boolean = false, // Чи запущений бот
    @Json(name = "activeNodeTitle") val activeNodeTitle: String? = null // Назва активної ноди
)

// Інформація про розклад проекту
data class ScheduleInfo(
    @Json(name = "projectName") val projectName: String, // Назва проекту
    @Json(name = "mode") val mode: String = "none", // Режим розкладу (none/interval)
    @Json(name = "nextRun") val nextRun: Long? = null, // Час наступного запуску в мілісекундах
    @Json(name = "lastRun") val lastRun: Long = 0, // Час останнього запуску
    @Json(name = "settings") val settings: ScheduleSettings? = null, // Налаштування інтервалу
    @Json(name = "plannedRuns") val plannedRuns: List<PlannedRun> = emptyList() // Програмні запуски від нод
)

// Налаштування інтервалу розкладу
data class ScheduleSettings(
    @Json(name = "mode") val mode: String = "none", // Режим розкладу
    @Json(name = "intervalValue") val intervalValue: Int = 2, // Числове значення інтервалу
    @Json(name = "intervalUnit") val intervalUnit: String = "hours", // Одиниця виміру (hours/minutes)
    @Json(name = "randomOffsetMinutes") val randomOffsetMinutes: Int = 0 // Хвилини рандомізації
)

// Запланований програмний запуск від ноди
data class PlannedRun(
    @Json(name = "projectName") val projectName: String, // Назва проекту
    @Json(name = "runAt") val runAt: Long, // Час запуску в мілісекундах
    @Json(name = "source") val source: String = "node" // Джерело запуску
)

// Запит на оновлення розкладу проекту
data class ScheduleUpdateRequest(
    @Json(name = "mode") val mode: String, // Режим розкладу
    @Json(name = "intervalValue") val intervalValue: Int, // Значення інтервалу
    @Json(name = "intervalUnit") val intervalUnit: String, // Одиниця виміру
    @Json(name = "randomOffsetMinutes") val randomOffsetMinutes: Int // Хвилини рандомізації
)

// Відповідь з масивом сповіщень
data class NotificationsResponse(
    @Json(name = "notifications") val notifications: List<NotificationItem> = emptyList(), // Список сповіщень
    @Json(name = "unreadCount") val unreadCount: Int = 0 // Кількість непрочитаних
)

// Окреме сповіщення
data class NotificationItem(
    @Json(name = "id") val id: String, // Унікальний ідентифікатор
    @Json(name = "projectName") val projectName: String, // Назва проекту
    @Json(name = "message") val message: String, // Текст повідомлення
    @Json(name = "timestamp") val timestamp: Long, // Час створення в мілісекундах
    @Json(name = "read") val read: Boolean = false // Чи прочитане
)

// Запис логу від сервера
data class LogEntryResponse(
    @Json(name = "text") val text: String = "", // Текст логу
    @Json(name = "type") val type: String = "info", // Тип: success/error/info/debug
    @Json(name = "timestamp") val timestamp: String = "" // Час запису
)

// Елемент інвентаря (зображення + число)
data class InventoryItem(
    @Json(name = "image") val image: String, // URL зображення
    @Json(name = "number") val number: Double // Кількість (може бути дробовим числом)
)

// Відповідь з даними інвентаря
data class InventoryResponse(
    @Json(name = "data") val data: List<InventoryItem> = emptyList(), // Список елементів інвентаря
    @Json(name = "timestamp") val timestamp: Long? = null, // Час останнього оновлення
    @Json(name = "projectName") val projectName: String = "", // Назва проекту
    @Json(name = "variables") val variables: Map<String, Any>? = null // Змінні проекту
)

// Відповідь зі списком скріншотів (прямо масив імен файлів)
typealias ScreenshotsList = List<String>

/**
 * Проста універсальна відповідь на виклик операцій.
 */
data class ActionResponse(
    @Json(name = "success") val success: Boolean, // Успішність виконання запиту
    @Json(name = "message") val message: String? = null // Повідомлення від сервера у разі помилки або успіху
)

/**
 * Retrofit-інтерфейс, що представляє REST API підключення до конструктора Sunflower Land Bot.
 */
interface BotApiService {

    @GET("/api/projects") // Маршрут для отримання списку проектів
    suspend fun getProjects(): List<String> // Повертає простий список імен проектів

    @GET("/api/projects/status") // Маршрут для отримання статусів виконання проектів
    suspend fun getProjectsStatus(): Map<String, Boolean> // Карта відповідності: назва проекту -> стан запуску

    @POST("/api/projects/run-multiple") // Маршрут для запуску кількох проектів
    suspend fun runMultiple(@Body request: RunProjectsRequest): ActionResponse // Метод відправки запиту на запуск

    @POST("/api/projects/stop-multiple") // Маршрут для зупинки кількох проектів
    suspend fun stopMultiple(@Body request: StopProjectsRequest): ActionResponse // Метод відправки запиту на зупинку

    @GET("/api/stats/{projectName}") // Маршрут детальної статистики запущеного проекту
    suspend fun getProjectStats(@Path("projectName") projectName: String): ProjectStats // Повертає статистику конкретного проекту

    @GET("/api/global-stats") // Маршрут для отримання агрегованої загальної статистики
    suspend fun getGlobalStats(): GlobalStats // Повертає глобальні показники системи

    @GET("/api/config/{projectName}") // Маршрут отримання поточної конфігурації проекту
    suspend fun getProjectConfig(@Path("projectName") projectName: String): ProjectConfigResponse // Отримує параметри розкладу проекту

    @POST("/api/save") // Маршрут збереження розширених налаштувань проекту
    suspend fun saveProjectConfig(@Body request: ProjectConfigRequest): ActionResponse // Зберігає налаштування на бекенді

    @GET("/api/projects/status") // Маршрут для отримання детальних статусів проектів
    suspend fun getProjectsStatusDetailed(): Map<String, ProjectStatusInfo> // Повертає карту детальних статусів

    @GET("/api/schedule") // Маршрут для отримання розкладу всіх проектів
    suspend fun getSchedule(): List<ScheduleInfo> // Повертає масив розкладів

    @PUT("/api/schedule/{projectName}") // Маршрут для оновлення розкладу проекту
    suspend fun updateSchedule(
        @Path("projectName") projectName: String, // Назва проекту у шляху URL
        @Body settings: ScheduleUpdateRequest // Тіло запиту з налаштуваннями
    ): ActionResponse // Повертає результат операції

    @GET("/api/notifications") // Маршрут для отримання сповіщень
    suspend fun getNotifications(): NotificationsResponse // Повертає об'єкт зі списком сповіщень та кількістю непрочитаних

    @PUT("/api/notifications/{id}/read") // Маршрут для позначення сповіщення прочитаним
    suspend fun markNotificationRead(@Path("id") id: String): ActionResponse // Повертає результат операції

    @PUT("/api/notifications/read-all") // Маршрут для позначення всіх сповіщень прочитаними
    suspend fun markAllNotificationsRead(): ActionResponse // Повертає результат операції

    @DELETE("/api/notifications/{id}") // Маршрут для видалення сповіщення
    suspend fun deleteNotification(@Path("id") id: String): ActionResponse // Повертає результат операції

    @GET("/api/global-stats") // Маршрут для отримання глобальної статистики сирим JSON
    suspend fun getGlobalStatsRaw(): ResponseBody // Повертає сире тіло відповіді

    @GET("/api/logs/{name}") // Маршрут для завантаження збережених логів проекту
    suspend fun getProjectLogs(@Path("name") name: String): List<LogEntryResponse> // Повертає масив записів логування

    @GET("/api/inventory/{projectName}") // Маршрут для отримання інвентаря проекту
    suspend fun getInventory(@Path("projectName") projectName: String): InventoryResponse // Повертає дані інвентаря

    @GET("/api/config") // Маршрут для отримання конфігурації модулів (доступний також через internal://config в нодах)
    suspend fun getInternalConfig(): Map<String, Int>

    @PUT("/api/config") // Маршрут для збереження конфігурації модулів
    suspend fun updateInternalConfig(@Body config: Map<String, Int>): ActionResponse

    @POST("/api/browser/open/{projectName}") // Відкрити браузер
    suspend fun openBrowser(@Path("projectName") projectName: String): ActionResponse

    @POST("/api/browser/close/{projectName}") // Закрити браузер
    suspend fun closeBrowser(@Path("projectName") projectName: String): ActionResponse

    @GET("/api/browser/status/{projectName}") // Отримати статус браузера
    suspend fun getBrowserStatus(@Path("projectName") projectName: String): Map<String, Boolean>

    @GET("/api/screenshots/{projectName}") // Отримати список скріншотів проекту
    suspend fun getScreenshots(@Path("projectName") projectName: String): ScreenshotsList // Повертає масив імен файлів

    @DELETE("/api/screenshots/{projectName}/{filename}") // Видалити скріншот
    suspend fun deleteScreenshot(
        @Path("projectName") projectName: String,
        @Path("filename") filename: String
    ): ActionResponse // Повертає результат операції

    /**
     * Фабричний об'єкт для створення екземпляра REST-сервісу із динамічно налаштованими параметрами URL.
     */
    companion object {
        fun create(baseUrl: String): BotApiService {
            // Налаштування логувальника запитів до сервера для відладки
            val loggingInterceptor = HttpLoggingInterceptor().apply {
                level = HttpLoggingInterceptor.Level.BODY // Логувати заголовок, параметри та тіло
            }

            // Побудова HTTP-клієнта з таймаутами
            val okHttpClient = OkHttpClient.Builder()
                .connectTimeout(5, TimeUnit.SECONDS) // Час очікування з'єднання 5 секунд
                .readTimeout(10, TimeUnit.SECONDS) // Час очікування відповіді 10 секунд
                .writeTimeout(10, TimeUnit.SECONDS) // Час очікування передачі даних 10 секунд
                .addInterceptor(loggingInterceptor) // Підключення перехоплювача логів
                .build()

            // Налаштування конвертера Moshi із рефлексією Kotlin
            val moshi = Moshi.Builder()
                .addLast(KotlinJsonAdapterFactory()) // Автоматична генерація адаптерів
                .build()

            // Побудова Retrofit-клієнта
            return Retrofit.Builder()
                .baseUrl(if (baseUrl.endsWith("/")) baseUrl else "$baseUrl/") // Форматування URL
                .client(okHttpClient) // Передача okHttp клієнта
                .addConverterFactory(MoshiConverterFactory.create(moshi)) // Конвертер JSON в об'єкти Kotlin
                .build()
                .create(BotApiService::class.java) // Генерація реалізації інтерфейсу
        }
    }
}
