package ua.diperon.slbotremote

import com.squareup.moshi.Json
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.Response
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path
import retrofit2.http.Query
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference

// ===== Data Models =====

data class Project(
    @Json(name = "name") val name: String,
    @Json(name = "isRunning") val isRunning: Boolean = false
)

data class ProjectOverviewItem(
    @Json(name = "name") val name: String,
    @Json(name = "isRunning") val isRunning: Boolean = false,
    @Json(name = "isBrowserOpen") val isBrowserOpen: Boolean = false,
    @Json(name = "activeNodeTitle") val activeNodeTitle: String? = null,
    @Json(name = "nextRun") val nextRun: Double? = null,
    @Json(name = "plannedNodeRun") val plannedNodeRun: Double? = null,
    @Json(name = "level") val level: Int? = null,
    @Json(name = "gold") val gold: Double? = null,
    @Json(name = "balance") val balance: Double? = null,
    @Json(name = "gem") val gem: Double? = null,
    @Json(name = "season") val season: String? = null,
    @Json(name = "isFullMoon") val isFullMoon: Boolean = false,
    @Json(name = "hasChestCollectedToday") val hasChestCollectedToday: Boolean = false,
    @Json(name = "hasShipmentRestockedToday") val hasShipmentRestockedToday: Boolean = false,
    @Json(name = "hasPetalPuzzleSolvedToday") val hasPetalPuzzleSolvedToday: Boolean = false,
    @Json(name = "miniImages") val miniImages: List<List<Any?>> = emptyList(),
    @Json(name = "completedDeliveries") val completedDeliveries: Int = 0,
    @Json(name = "completedDeliveryTypes") val completedDeliveryTypes: List<String> = emptyList(),
    @Json(name = "lastSaveUpdate") val lastSaveUpdate: Double? = null
) {
    val nextRunLong: Long? get() = nextRun?.toLong()
    val plannedNodeRunLong: Long? get() = plannedNodeRun?.toLong()
    val lastSaveUpdateLong: Long? get() = lastSaveUpdate?.toLong()
    fun getParsedMiniImages(): List<Pair<String, Int?>> {
        return miniImages.mapNotNull { item ->
            if (item.isNotEmpty()) {
                val img = item[0] as? String ?: return@mapNotNull null
                val count = (item.getOrNull(1) as? Number)?.toInt()
                Pair(img, count)
            } else null
        }
    }
}

data class NextRunRequest(
    @Json(name = "runAt") val runAt: Long? = null,
    @Json(name = "delayMinutes") val delayMinutes: Int? = null
)

data class RunProjectsRequest(@Json(name = "projectNames") val projectNames: List<String>)
data class StopProjectsRequest(@Json(name = "projectNames") val projectNames: List<String>)

data class LaunchSettings(
    @Json(name = "mode") val mode: String = "interval",
    @Json(name = "intervalValue") val intervalValue: Int = 30,
    @Json(name = "intervalUnit") val intervalUnit: String = "minutes",
    @Json(name = "scheduleDays") val scheduleDays: List<Int> = emptyList(),
    @Json(name = "scheduleTime") val scheduleTime: String = "09:00"
)

data class ProjectConfigData(@Json(name = "launchSettings") val launchSettings: LaunchSettings = LaunchSettings())

data class ProjectConfigRequest(@Json(name = "name") val name: String, @Json(name = "data") val data: ProjectConfigData = ProjectConfigData())

data class ProjectConfigResponse(@Json(name = "name") val name: String, @Json(name = "data") val data: ProjectConfigData = ProjectConfigData())

data class ProjectStats(
    @Json(name = "projectName") val projectName: String,
    @Json(name = "totalRuns") val totalRuns: Int = 0,
    @Json(name = "successfulRuns") val successfulRuns: Int = 0,
    @Json(name = "failedRuns") val failedRuns: Int = 0,
    @Json(name = "lastRunTime") val lastRunTime: String? = null
)

data class GlobalStats(
    @Json(name = "totalRuns") val totalRuns: Int = 0,
    @Json(name = "successfulRuns") val successfulRuns: Int = 0,
    @Json(name = "failedRuns") val failedRuns: Int = 0,
    @Json(name = "activeBots") val activeBots: Int = 0
)

data class ProjectStatusInfo(
    @Json(name = "isRunning") val isRunning: Boolean = false,
    @Json(name = "activeNodeTitle") val activeNodeTitle: String? = null,
    @Json(name = "isBrowserOpen") val isBrowserOpen: Boolean = false
)

data class ProjectBrowserSettings(
    @Json(name = "profileDir") val profileDir: String? = null,
    @Json(name = "proxy") val proxy: String? = null,
    @Json(name = "headless") val headless: Boolean? = false,
    @Json(name = "disableImages") val disableImages: Boolean? = false,
    @Json(name = "photoDebug") val photoDebug: Boolean? = true,
    @Json(name = "width") val width: Int? = 1280,
    @Json(name = "height") val height: Int? = 720
)

data class ScheduleInfo(
    @Json(name = "projectName") val projectName: String,
    @Json(name = "mode") val mode: String = "none",
    @Json(name = "nextRun") val nextRun: Long? = null,
    @Json(name = "lastRun") val lastRun: Long = 0,
    @Json(name = "settings") val settings: ScheduleSettings? = null,
    @Json(name = "browserSettings") val browserSettings: ProjectBrowserSettings? = null,
    @Json(name = "plannedRuns") val plannedRuns: List<PlannedRun> = emptyList()
)

data class ScheduleSettings(
    @Json(name = "mode") val mode: String = "none",
    @Json(name = "intervalValue") val intervalValue: Int = 2,
    @Json(name = "intervalUnit") val intervalUnit: String = "hours",
    @Json(name = "randomOffsetMinutes") val randomOffsetMinutes: Int = 0
)

data class PlannedRun(
    @Json(name = "projectName") val projectName: String,
    @Json(name = "runAt") val runAt: Long,
    @Json(name = "source") val source: String = "node"
)

data class ScheduleUpdateRequest(
    @Json(name = "mode") val mode: String? = null,
    @Json(name = "intervalValue") val intervalValue: Int? = null,
    @Json(name = "intervalUnit") val intervalUnit: String? = null,
    @Json(name = "randomOffsetMinutes") val randomOffsetMinutes: Int? = null,
    @Json(name = "nextRunAt") val nextRunAt: Long? = null,
    @Json(name = "clearNextRun") val clearNextRun: Boolean? = null,
    @Json(name = "browserSettings") val browserSettings: ProjectBrowserSettings? = null
)

data class NotificationsResponse(
    @Json(name = "notifications") val notifications: List<NotificationItem> = emptyList(),
    @Json(name = "unreadCount") val unreadCount: Int = 0
)

data class NotificationItem(
    @Json(name = "id") val id: String,
    @Json(name = "projectName") val projectName: String,
    @Json(name = "message") val message: String,
    @Json(name = "timestamp") val timestamp: Long,
    @Json(name = "read") val read: Boolean = false
)

data class LogEntryResponse(
    @Json(name = "text") val text: String = "",
    @Json(name = "type") val type: String = "info",
    @Json(name = "timestamp") val timestamp: String = ""
)

data class InventoryItem(
    @Json(name = "image") val image: String,
    @Json(name = "number") val number: Double
)

data class InventoryResponse(
    @Json(name = "data") val data: List<InventoryItem> = emptyList(),
    @Json(name = "timestamp") val timestamp: Double? = null,
    @Json(name = "projectName") val projectName: String = "",
    @Json(name = "variables") val variables: Map<String, Any>? = null
)

data class CategoriesResponse(
    @Json(name = "categories") val categories: List<String> = emptyList(),
    @Json(name = "itemToCategories") val itemToCategories: Map<String, List<String>> = emptyMap()
)

typealias ScreenshotsList = List<String>

data class DeliveryReward(
    @Json(name = "coins") val coins: Double? = null,
    @Json(name = "sfl") val sfl: Double? = null,
    @Json(name = "items") val items: Map<String, Any> = emptyMap()
)

data class Delivery(
    @Json(name = "createdAt") val createdAt: Long = 0L,
    @Json(name = "readyAt") val readyAt: Long = 0L,
    @Json(name = "from") val from: String = "",
    @Json(name = "id") val id: String = "",
    @Json(name = "items") val items: Map<String, Double> = emptyMap(),
    @Json(name = "reward") val reward: DeliveryReward? = null,
    @Json(name = "completedAt") val completedAt: Long? = null
)

data class DeliveryResponse(
    @Json(name = "data") val data: List<Delivery> = emptyList(),
    @Json(name = "timestamp") val timestamp: Double? = null,
    @Json(name = "projectName") val projectName: String = ""
)

data class ActionResponse(
    @Json(name = "success") val success: Boolean,
    @Json(name = "message") val message: String? = null,
    @Json(name = "error") val error: String? = null
)

data class ProjectSaveResponse(
    @Json(name = "success") val success: Boolean,
    @Json(name = "data") val data: Map<String, Any>? = null,
    @Json(name = "projectName") val projectName: String? = null,
    @Json(name = "error") val error: String? = null
)

// ===== Config Data Models =====

data class ConfigRule(
    @Json(name = "id") val id: String = "",
    @Json(name = "file") val file: String = "",
    @Json(name = "path") val path: String = "",
    @Json(name = "operator") val operator: String = "",
    @Json(name = "value") val value: Any? = null,
    @Json(name = "rightType") val rightType: String? = "value",
    @Json(name = "rightFile") val rightFile: String? = null,
    @Json(name = "rightPath") val rightPath: String? = null,
    @Json(name = "outputVar") val outputVar: String? = null,
    @Json(name = "required") val required: Boolean? = true
)

data class SavedConfig(
    @Json(name = "id") val id: String = "",
    @Json(name = "name") val name: String = "",
    @Json(name = "enabled") val enabled: Boolean = true,
    @Json(name = "rules") val rules: List<ConfigRule> = emptyList(),
    @Json(name = "subConfigs") val subConfigs: List<SavedConfig>? = null,
    @Json(name = "createdAt") val createdAt: Long = 0,
    @Json(name = "updatedAt") val updatedAt: Long = 0
)

data class ConfigCreateRequest(
    @Json(name = "name") val name: String,
    @Json(name = "enabled") val enabled: Boolean = true,
    @Json(name = "rules") val rules: List<ConfigRule> = emptyList(),
    @Json(name = "subConfigs") val subConfigs: List<SavedConfig>? = null
)



data class ConfigResponse(
    @Json(name = "success") val success: Boolean = false,
    @Json(name = "config") val config: SavedConfig? = null,
    @Json(name = "error") val error: String? = null
)

data class ConfigListResponse(
    @Json(name = "success") val success: Boolean = false,
    @Json(name = "configs") val configs: List<SavedConfig> = emptyList(),
    @Json(name = "error") val error: String? = null
)

data class QueueResponse(
    @Json(name = "queue") val queue: List<String> = emptyList(),
    @Json(name = "maxParallel") val maxParallel: Int? = 1,
    @Json(name = "activeRunning") val activeRunning: Int? = 0
)

// ===== Island Map Models =====
data class MapItem(
    @Json(name = "id") val id: String,
    @Json(name = "name") val name: String,
    @Json(name = "type") val type: String,
    @Json(name = "x") val x: Int,
    @Json(name = "y") val y: Int,
    @Json(name = "w") val w: Int,
    @Json(name = "h") val h: Int,
    @Json(name = "image") val image: String? = null
)

data class BuildingTypeConfig(
    @Json(name = "w") val w: Int = 1,
    @Json(name = "h") val h: Int = 1,
    @Json(name = "mapImage") val mapImage: String? = null,
    @Json(name = "inventoryImage") val inventoryImage: String? = null,
    @Json(name = "inventoryName") val inventoryName: String? = null
)

data class LayoutData(
    @Json(name = "items") val items: List<MapItem> = emptyList(),
    @Json(name = "buildingTypes") val buildingTypes: Map<String, BuildingTypeConfig> = emptyMap()
)

data class ProjectMapResponse(
    @Json(name = "success") val success: Boolean,
    @Json(name = "data") val data: Any? = null, // Can be List<MapItem> or LayoutData
    @Json(name = "error") val error: String? = null
)

// ===== Mass Scheduler Models =====
data class MassCalculatedTime(
    @Json(name = "project") val project: String = "",
    @Json(name = "timestamp") val timestamp: Long = 0L,
    @Json(name = "timeStr") val timeStr: String = "",
    @Json(name = "fullDateTime") val fullDateTime: String = "",
    @Json(name = "relative") val relative: String = "",
    @Json(name = "isPast") val isPast: Boolean = false
)

data class MassLaunchSummary(
    @Json(name = "time") val time: String = "",
    @Json(name = "fullDateTime") val fullDateTime: String = "",
    @Json(name = "project") val project: String = "",
    @Json(name = "relative") val relative: String = "",
    @Json(name = "isPast") val isPast: Boolean = false,
    @Json(name = "totalWithTime") val totalWithTime: Int = 0,
    @Json(name = "totalProjects") val totalProjects: Int = 0
)

data class MassLaunchItem(
    @Json(name = "id") val id: String = "",
    @Json(name = "name") val name: String = "",
    @Json(name = "mode") val mode: String = "manual_time", // "manual_time" | "json_time"
    @Json(name = "time") val time: String? = null,
    @Json(name = "jsonPath") val jsonPath: String? = null,
    @Json(name = "configId") val configId: String? = null,
    @Json(name = "containers") val containers: List<String> = emptyList(),
    @Json(name = "enabled") val enabled: Boolean = true,
    @Json(name = "calculatedTimes") val calculatedTimes: List<MassCalculatedTime>? = null,
    @Json(name = "nextLaunchSummary") val nextLaunchSummary: MassLaunchSummary? = null
)

data class MassLaunchCreateRequest(
    @Json(name = "name") val name: String,
    @Json(name = "mode") val mode: String,
    @Json(name = "time") val time: String? = null,
    @Json(name = "jsonPath") val jsonPath: String? = null,
    @Json(name = "configId") val configId: String? = null,
    @Json(name = "containers") val containers: List<String> = emptyList(),
    @Json(name = "enabled") val enabled: Boolean = true
)

data class ProjectTimePreviewItem(
    @Json(name = "projectName") val projectName: String = "",
    @Json(name = "timestamp") val timestamp: Long? = null,
    @Json(name = "timeStr") val timeStr: String? = null,
    @Json(name = "dateStr") val dateStr: String? = null,
    @Json(name = "fullDateTime") val fullDateTime: String? = null,
    @Json(name = "relative") val relative: String? = null,
    @Json(name = "isPast") val isPast: Boolean = false,
    @Json(name = "status") val status: String = "not_found"
)

data class PreviewTimeResponse(
    @Json(name = "success") val success: Boolean = false,
    @Json(name = "summary") val summary: MassLaunchSummary? = null,
    @Json(name = "projectTimes") val projectTimes: List<ProjectTimePreviewItem> = emptyList(),
    @Json(name = "error") val error: String? = null
)

data class MatchingProjectsResponse(
    @Json(name = "success") val success: Boolean = false,
    @Json(name = "projects") val projects: List<String> = emptyList()
)

data class ProjectContainersResponse(
    @Json(name = "success") val success: Boolean = false,
    @Json(name = "containers") val containers: List<String> = emptyList()
)

// ===== Run History Models =====
data class RunRecordItem(
    @Json(name = "runId") val runId: String,
    @Json(name = "startTime") val startTime: Long,
    @Json(name = "endTime") val endTime: Long? = null,
    @Json(name = "status") val status: String = "running"
)

data class ProjectRunsResponse(
    @Json(name = "success") val success: Boolean = false,
    @Json(name = "runs") val runs: List<RunRecordItem> = emptyList(),
    @Json(name = "error") val error: String? = null
)

// ===== NPC Deliveries Models =====

data class NpcDeliveryCatalogItem(
    @Json(name = "name") val name: String = "",
    @Json(name = "amount") val amount: Double = 0.0,
    @Json(name = "image") val image: String = ""
)

data class NpcDeliveryVariant(
    @Json(name = "id") val id: String = "",
    @Json(name = "signature") val signature: String = "",
    @Json(name = "items") val items: List<NpcDeliveryCatalogItem> = emptyList(),
    @Json(name = "reward") val reward: String = "",
    @Json(name = "rewardType") val rewardType: String = "",
    @Json(name = "rewardIcon") val rewardIcon: String = "",
    @Json(name = "cost") val cost: String = ""
)

data class NpcGroup(
    @Json(name = "id") val id: String = "",
    @Json(name = "name") val name: String = "",
    @Json(name = "displayName") val displayName: String = "",
    @Json(name = "icon") val icon: String = "",
    @Json(name = "category") val category: String = "",
    @Json(name = "avgReward") val avgReward: String = "",
    @Json(name = "avgCost") val avgCost: String = "",
    @Json(name = "deliveriesCount") val deliveriesCount: Int = 0,
    @Json(name = "deliveries") val deliveries: List<NpcDeliveryVariant> = emptyList()
)

data class NpcDeliveriesCatalogResponse(
    @Json(name = "success") val success: Boolean = false,
    @Json(name = "data") val data: Map<String, NpcGroup> = emptyMap()
)

data class NpcDeliverySetting(
    @Json(name = "status") val status: String = "skip", // "skip" | "deliver" | "config"
    @Json(name = "configId") val configId: String? = null
)

data class NpcDeliverySettingsResponse(
    @Json(name = "success") val success: Boolean = false,
    @Json(name = "projectName") val projectName: String? = null,
    @Json(name = "settings") val settings: Map<String, NpcDeliverySetting> = emptyMap(),
    @Json(name = "global") val global: Map<String, NpcDeliverySetting>? = null,
    @Json(name = "projectOverrides") val projectOverrides: Map<String, NpcDeliverySetting>? = null
)

data class SaveNpcDeliverySettingsRequest(
    @Json(name = "projectName") val projectName: String? = null,
    @Json(name = "settings") val settings: Map<String, NpcDeliverySetting>,
    @Json(name = "applyToAll") val applyToAll: Boolean = false
)

data class TestNpcConfigRequest(
    @Json(name = "projectName") val projectName: String,
    @Json(name = "configId") val configId: String
)

data class TestNpcConfigResponse(
    @Json(name = "success") val success: Boolean = false,
    @Json(name = "configId") val configId: String? = null,
    @Json(name = "projectName") val projectName: String? = null,
    @Json(name = "passed") val passed: Boolean = false,
    @Json(name = "error") val error: String? = null
)

// ===== Bulk All Data Models =====

data class AllDeliveriesBulkResponse(
    @Json(name = "success") val success: Boolean = false,
    @Json(name = "timestamp") val timestamp: Long = 0L,
    @Json(name = "deliveries") val deliveries: Map<String, List<Delivery>> = emptyMap(),
    @Json(name = "inventories") val inventories: Map<String, List<InventoryItem>> = emptyMap(),
    @Json(name = "marked") val marked: Map<String, List<String>> = emptyMap()
)

data class AllInventoriesBulkResponse(
    @Json(name = "success") val success: Boolean = false,
    @Json(name = "timestamp") val timestamp: Long = 0L,
    @Json(name = "inventories") val inventories: Map<String, List<InventoryItem>> = emptyMap(),
    @Json(name = "stock") val stock: Map<String, List<InventoryItem>> = emptyMap(),
    @Json(name = "categories") val categories: List<String> = emptyList(),
    @Json(name = "itemToCategories") val itemToCategories: Map<String, List<String>> = emptyMap()
)

// ===== Dynamic Base URL Interceptor =====

class DynamicBaseUrlInterceptor : Interceptor {
    private val baseUrlRef = AtomicReference<HttpUrl?>(null)

    fun setBaseUrl(url: String) {
        val sanitized = sanitizeNetworkAddress(url).trim().removeSuffix("/")
        val withScheme = if (!sanitized.startsWith("http://", ignoreCase = true) && !sanitized.startsWith("https://", ignoreCase = true)) {
            "http://$sanitized"
        } else sanitized

        val parsedUrl = "$withScheme/".toHttpUrlOrNull()
        if (parsedUrl != null) {
            baseUrlRef.set(parsedUrl)
        } else {
            android.util.Log.e("DynamicBaseUrlInterceptor", "Invalid URL provided: '$url' (sanitized: '$sanitized'). Keeping previous URL: ${baseUrlRef.get()}")
            if (baseUrlRef.get() == null) {
                baseUrlRef.set("http://127.0.0.1:3001/".toHttpUrlOrNull())
            }
        }
    }

    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()
        val baseUrl = baseUrlRef.get() ?: return chain.proceed(request)

        val oldUrl = request.url
        val newUrl = oldUrl.newBuilder()
            .scheme(baseUrl.scheme)
            .host(baseUrl.host)
            .port(baseUrl.port)
            .build()

        return chain.proceed(request.newBuilder().url(newUrl).build())
    }
}

// ===== Retry Interceptor =====

class RetryInterceptor(private val maxRetries: Int = 2) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        var request = chain.request()
        var response: Response? = null
        var exception: Exception? = null
        for (i in 0..maxRetries) {
            try {
                response = chain.proceed(request)
                if (response.isSuccessful || i == maxRetries) {
                    return response
                }
                response.close()
            } catch (e: Exception) {
                exception = e
                if (i == maxRetries) throw e
            }
            request = request.newBuilder().build()
        }
        return response ?: throw exception ?: IllegalStateException("Request failed after $maxRetries retries")
    }
}

// ===== Buildings Catalog & Status Models =====

data class BuildingCatalogItem(
    @Json(name = "id") val id: String = "",
    @Json(name = "name") val name: String = "",
    @Json(name = "category") val category: String = "BUILDINGS",
    @Json(name = "coins") val coins: Double = 0.0,
    @Json(name = "ingredients") val ingredients: Map<String, Double> = emptyMap(),
    @Json(name = "requiredLevel") val requiredLevel: Int = 1,
    @Json(name = "width") val width: Int = 1,
    @Json(name = "height") val height: Int = 1,
    @Json(name = "image") val image: String = "",
    @Json(name = "categoryImage") val categoryImage: String? = null,
    @Json(name = "shopImage") val shopImage: String? = null
)

data class BuildingsCatalogResponse(
    @Json(name = "success") val success: Boolean = false,
    @Json(name = "catalog") val catalog: List<BuildingCatalogItem> = emptyList(),
    @Json(name = "error") val error: String? = null
)

data class SaveBuildingsCatalogRequest(
    @Json(name = "catalog") val catalog: List<BuildingCatalogItem>
)

data class ProjectBuildingStatusItem(
    @Json(name = "id") val id: String = "",
    @Json(name = "name") val name: String = "",
    @Json(name = "category") val category: String = "BUILDINGS",
    @Json(name = "coins") val coins: Double = 0.0,
    @Json(name = "ingredients") val ingredients: Map<String, Double> = emptyMap(),
    @Json(name = "userIngredients") val userIngredients: Map<String, Double> = emptyMap(),
    @Json(name = "requiredLevel") val requiredLevel: Int = 1,
    @Json(name = "bumpkinLevel") val bumpkinLevel: Int = 1,
    @Json(name = "userCoins") val userCoins: Double = 0.0,
    @Json(name = "isPurchased") val isPurchased: Boolean = false,
    @Json(name = "canBuild") val canBuild: Boolean = false,
    @Json(name = "width") val width: Int = 1,
    @Json(name = "height") val height: Int = 1,
    @Json(name = "image") val image: String = "",
    @Json(name = "categoryImage") val categoryImage: String? = null,
    @Json(name = "shopImage") val shopImage: String? = null
)

data class ProjectBuildingsStatusResponse(
    @Json(name = "success") val success: Boolean = false,
    @Json(name = "bumpkinLevel") val bumpkinLevel: Int = 1,
    @Json(name = "coins") val coins: Double = 0.0,
    @Json(name = "buildings") val buildings: List<ProjectBuildingStatusItem> = emptyList(),
    @Json(name = "error") val error: String? = null
)

// ===== API Interface =====

interface BotApiService {

    @GET("api/projects")
    suspend fun getProjects(): List<String>

    @GET("api/projects/overview")
    suspend fun getProjectsOverview(): List<ProjectOverviewItem>

    @GET("api/projects/status")
    suspend fun getProjectsStatus(): Map<String, ProjectStatusInfo>

    @POST("api/projects/run-multiple")
    suspend fun runMultiple(@Body request: RunProjectsRequest): ActionResponse

    @POST("api/projects/stop-multiple")
    suspend fun stopMultiple(@Body request: StopProjectsRequest): ActionResponse

    @GET("api/stats/{projectName}")
    suspend fun getProjectStats(@Path("projectName") projectName: String): List<Map<String, Any>>

    @GET("api/global-stats")
    suspend fun getGlobalStats(): List<Map<String, Any>>

    @GET("api/global-stats")
    suspend fun getGlobalStatsRaw(): okhttp3.ResponseBody

    @GET("api/config/{projectName}")
    suspend fun getProjectConfig(@Path("projectName") projectName: String): ProjectConfigResponse

    @POST("api/save")
    suspend fun saveProjectConfig(@Body request: ProjectConfigRequest): ActionResponse

    @GET("api/projects/{name}")
    suspend fun getProject(@Path("name") name: String): ProjectDataResponse

    @POST("api/save")
    suspend fun saveProject(@Body request: ProjectSaveRequest): ActionResponse

    @GET("api/projects/{name}")
    suspend fun getProjectRaw(@Path("name") name: String): okhttp3.ResponseBody

    @POST("api/save")
    suspend fun saveProjectRaw(@Body body: okhttp3.RequestBody): okhttp3.ResponseBody

    @GET("api/schedule")
    suspend fun getSchedule(): List<ScheduleInfo>

    @GET("api/queue")
    suspend fun getQueue(): QueueResponse

    @PUT("api/schedule/{projectName}")
    suspend fun updateSchedule(
        @Path("projectName") projectName: String,
        @Body settings: ScheduleUpdateRequest
    ): ActionResponse

    @POST("api/schedule/{projectName}/next-run")
    suspend fun setNextRun(
        @Path("projectName") projectName: String,
        @Body request: NextRunRequest
    ): ActionResponse

    @GET("api/notifications")
    suspend fun getNotifications(): NotificationsResponse

    @PUT("api/notifications/{id}/read")
    suspend fun markNotificationRead(@Path("id") id: String): ActionResponse

    @PUT("api/notifications/read-all")
    suspend fun markAllNotificationsRead(): ActionResponse

    @DELETE("api/notifications/{id}")
    suspend fun deleteNotification(@Path("id") id: String): ActionResponse

    @DELETE("api/notifications")
    suspend fun deleteAllNotifications(): ActionResponse

    @GET("api/logs/{name}")
    suspend fun getProjectLogs(@Path("name") name: String): List<LogEntryResponse>

    @GET("api/inventory/{projectName}")
    suspend fun getInventory(
        @Path("projectName") projectName: String,
        @Query("source") source: String? = null
    ): InventoryResponse

    @GET("api/project-save/{projectName}")
    suspend fun getProjectSave(@Path("projectName") projectName: String): ProjectSaveResponse

    @GET("api/inventory/categories")
    suspend fun getInventoryCategories(): CategoriesResponse

    @POST("api/inventory/categories")
    suspend fun saveInventoryCategories(@Body categories: CategoriesResponse): ActionResponse

    @GET("api/config")
    suspend fun getInternalConfig(): Map<String, Int>

    @PUT("api/config")
    suspend fun updateInternalConfig(@Body config: Map<String, Int>): ActionResponse

    @POST("api/browser/open/{projectName}")
    suspend fun openBrowser(@Path("projectName") projectName: String): ActionResponse

    @POST("api/browser/close/{projectName}")
    suspend fun closeBrowser(@Path("projectName") projectName: String): ActionResponse

    @POST("api/browser/close-all")
    suspend fun closeAllBrowsers(): ActionResponse

    @GET("api/browser/status/{projectName}")
    suspend fun getBrowserStatus(@Path("projectName") projectName: String): Map<String, Boolean>

    @GET("api/screenshots/{projectName}")
    suspend fun getScreenshots(@Path("projectName") projectName: String): ScreenshotsList

    @DELETE("api/screenshots/{projectName}/{filename}")
    suspend fun deleteScreenshot(
        @Path("projectName") projectName: String,
        @Path("filename") filename: String
    ): ActionResponse

    @GET("api/deliveries/{projectName}")
    suspend fun getDeliveries(@Path("projectName") projectName: String): DeliveryResponse

    // --- Island Map API ---
    @GET("api/project-map/{projectName}")
    suspend fun getProjectMap(@Path("projectName") projectName: String): ProjectMapResponse

    @POST("api/project-map/{projectName}")
    suspend fun saveProjectMap(@Path("projectName") projectName: String, @Body layout: LayoutData): ActionResponse

    @DELETE("api/project-map/{projectName}")
    suspend fun deleteProjectMap(@Path("projectName") projectName: String): ActionResponse

    // --- Saved Configs API ---
    @GET("api/configs")
    suspend fun getConfigs(): ConfigListResponse

    @GET("api/configs/{id}")
    suspend fun getConfig(@Path("id") id: String): ConfigResponse

    @POST("api/configs")
    suspend fun createConfig(@Body request: ConfigCreateRequest): ConfigResponse

    @PUT("api/configs/{id}")
    suspend fun updateConfig(
        @Path("id") id: String,
        @Body request: ConfigCreateRequest
    ): ConfigResponse

    @DELETE("api/configs/{id}")
    suspend fun deleteConfig(@Path("id") id: String): ActionResponse

    // --- Mass Launches API ---
    @GET("api/mass-launches")
    suspend fun getMassLaunches(): List<MassLaunchItem>

    @POST("api/mass-launches")
    suspend fun createMassLaunch(@Body request: MassLaunchCreateRequest): ActionResponse

    @PUT("api/mass-launches/{id}")
    suspend fun updateMassLaunch(@Path("id") id: String, @Body request: Map<String, Any?>): ActionResponse

    @DELETE("api/mass-launches/{id}")
    suspend fun deleteMassLaunch(@Path("id") id: String): ActionResponse

    @GET("api/mass-launches/preview-time")
    suspend fun previewMassLaunchTime(
        @Query("configId") configId: String,
        @Query("jsonPath") jsonPath: String
    ): PreviewTimeResponse

    @GET("api/configs/{configId}/matching-projects")
    suspend fun getMatchingProjects(@Path("configId") configId: String): MatchingProjectsResponse

    @GET("api/projects/{projectName}/containers")
    suspend fun getContainersList(@Path("projectName") projectName: String): ProjectContainersResponse

    // --- Run History API ---
    @GET("api/projects/{projectName}/runs")
    suspend fun getProjectRuns(@Path("projectName") projectName: String): ProjectRunsResponse

    @GET("api/projects/{projectName}/runs/{runId}/logs")
    suspend fun getProjectRunLogs(
        @Path("projectName") projectName: String,
        @Path("runId") runId: String
    ): okhttp3.ResponseBody

    @GET("api/project-save/{projectName}")
    suspend fun getProjectSaveRaw(@Path("projectName") projectName: String): okhttp3.ResponseBody

    // --- Buildings Catalog & Status API ---
    @GET("api/buildings-catalog")
    suspend fun getBuildingsCatalog(): BuildingsCatalogResponse

    @POST("api/buildings-catalog")
    suspend fun saveBuildingsCatalog(@Body request: SaveBuildingsCatalogRequest): ActionResponse

    @GET("api/projects/{projectName}/buildings-status")
    suspend fun getProjectBuildingsStatus(@Path("projectName") projectName: String): ProjectBuildingsStatusResponse

    // --- NPC Deliveries API ---
    @GET("api/npc-deliveries")
    suspend fun getNpcDeliveries(): NpcDeliveriesCatalogResponse

    @GET("api/npc-deliveries/settings")
    suspend fun getNpcDeliverySettings(@Query("projectName") projectName: String? = null): NpcDeliverySettingsResponse

    @POST("api/npc-deliveries/settings")
    suspend fun saveNpcDeliverySettings(@Body request: SaveNpcDeliverySettingsRequest): ActionResponse

    @POST("api/npc-deliveries/test-config")
    suspend fun testNpcDeliveryConfig(@Body request: TestNpcConfigRequest): TestNpcConfigResponse

    // --- Bulk All Data API ---
    @GET("api/all-deliveries")
    suspend fun getAllDeliveries(): AllDeliveriesBulkResponse

    @GET("api/all-inventories")
    suspend fun getAllInventories(): AllInventoriesBulkResponse

    companion object {
        private const val TAG = "BotApiService"

        fun create(interceptor: DynamicBaseUrlInterceptor): BotApiService {
            val logging = HttpLoggingInterceptor().apply {
                level = HttpLoggingInterceptor.Level.BASIC
            }

            val okHttpClient = OkHttpClient.Builder()
                .connectTimeout(15, TimeUnit.SECONDS)
                .readTimeout(30, TimeUnit.SECONDS)
                .writeTimeout(30, TimeUnit.SECONDS)
                .pingInterval(30, TimeUnit.SECONDS)
                .retryOnConnectionFailure(true)
                .addInterceptor(RetryInterceptor(maxRetries = 2))
                .addInterceptor(interceptor)
                .addInterceptor(logging)
                .build()

            val moshi = Moshi.Builder()
                .addLast(KotlinJsonAdapterFactory())
                .build()

            return Retrofit.Builder()
                .baseUrl("http://placeholder/") // overridden by interceptor
                .client(okHttpClient)
                .addConverterFactory(MoshiConverterFactory.create(moshi))
                .build()
                .create(BotApiService::class.java)
        }
    }
}
