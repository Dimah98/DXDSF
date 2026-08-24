package ua.diperon.slbotremote

import android.app.Application
import android.util.Log
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import com.squareup.moshi.Json
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*
import ua.diperon.slbotremote.ui.theme.*

// Моделі даних для парсингу статистики
data class GlobalStatEntry(
    val projectName: String, // Назва проекту
    val stats: List<StatDataPoint> // Масив точок статистики
)

data class StatDataPoint(
    val timestamp: Long, // Час запису
    val snapshot: Map<String, Double>? = null, // Снімок змінних
    val changes: Map<String, Double>? = null // Зміни змінних
)

/**
 * ViewModel для екрану глобальної статистики.
 */
class GlobalStatisticsViewModel(application: Application) : AndroidViewModel(application) {
    private val context = application.applicationContext
    private val configManager = ConnectionConfigManager(context)
    private val interceptor = DynamicBaseUrlInterceptor()
    private val apiService: BotApiService = BotApiService.create(interceptor)

    private val _errorEvents = MutableSharedFlow<String>(extraBufferCapacity = 1)
    val errorEvents: SharedFlow<String> = _errorEvents.asSharedFlow()

    private val _entries = MutableStateFlow<List<GlobalStatEntry>>(emptyList())

    private val _availableVariables = MutableStateFlow<List<String>>(emptyList())
    val availableVariables: StateFlow<List<String>> = _availableVariables.asStateFlow()

    private val _selectedVariable = MutableStateFlow<String?>(null)
    val selectedVariable: StateFlow<String?> = _selectedVariable.asStateFlow()

    private val _isLoading = MutableStateFlow(true)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()
    
    private val _errorText = MutableStateFlow<String?>(null)
    val errorText: StateFlow<String?> = _errorText.asStateFlow()

    init {
        interceptor.setBaseUrl(configManager.getHttpUrl())
        fetchStats()
    }

    /**
     * Отримує статистику та витягує всі змінні.
     */
    fun fetchStats() {
        val service = apiService ?: return // Перевіряємо наявність сервісу
        viewModelScope.launch {
            _isLoading.value = true
            try {
                // Отримуємо сиру відповідь через Retrofit клієнт, 
                // який вже має всі налаштування (перехоплювачі, таймаути і т.д.)
                val responseBody = service.getGlobalStatsRaw()
                val jsonStr = responseBody.string()
                
                Log.d("GlobalStatsVM", "Raw response: ${jsonStr.take(500)}") // Логуємо перші 500 символів
                
                // Парсимо JSON за допомогою org.json
                val entries = parseGlobalStats(jsonStr)
                _entries.value = entries
                
                if (entries.isEmpty()) {
                    _errorText.value = "Parsed entries is empty. JSON: ${jsonStr.take(200)}"
                } else {
                    _errorText.value = null
                }
                
                // Витягуємо всі унікальні змінні з снімків
                val vars = mutableSetOf<String>()
                entries.forEach { entry ->
                    entry.stats.forEach { point ->
                        point.snapshot?.keys?.forEach { vars.add(it) } // Ключі з snapshot
                        point.changes?.keys?.forEach { vars.add(it) } // Ключі з changes
                    }
                }
                val varList = vars.toList().sorted() // Сортуємо змінні
                _availableVariables.value = varList // Зберігаємо список доступних змінних
                Log.d("GlobalStatsVM", "Parsed ${entries.size} entries, vars: $varList") // Логуємо
                if (varList.isNotEmpty() && _selectedVariable.value == null) {
                    _selectedVariable.value = varList.first() // Вибираємо першу змінну за замовчуванням
                }
            } catch (e: Exception) {
                Log.e("GlobalStatsVM", "Error fetching global stats: ${e.message}", e)
                _errorText.value = "Network Error: ${e.message}"
            } finally {
                _isLoading.value = false // Вимикаємо індикатор завантаження
            }
        }
    }
    
    /**
     * Парсить JSON-рядок зі статистикою проекту вручну через org.json.
     */
    private fun parseGlobalStats(json: String): List<GlobalStatEntry> {
        val result = mutableListOf<GlobalStatEntry>() // Результуючий список
        try {
            val arr = org.json.JSONArray(json) // Парсимо коріневий масив
            for (i in 0 until arr.length()) { // Проходимо по кожному проекту
                val obj = arr.getJSONObject(i) // Об'єкт проекту
                val projectName = obj.getString("projectName") // Назва проекту
                val statsArr = obj.optJSONArray("stats") ?: continue // Масив статистики
                val stats = mutableListOf<StatDataPoint>() // Список точок
                for (j in 0 until statsArr.length()) { // Проходимо по кожній точці
                    val pt = statsArr.getJSONObject(j) // Точка даних
                    val timestamp = pt.optLong("timestamp", 0L) // Час запису
                    val snapshot = parseDoubleMap(pt.optJSONObject("snapshot")) // Снімок
                    val changesObj = pt.optJSONObject("changes") // Зміни
                    // Парсимо changes: об'єкт {varName: {before, after}} -> беремо delta (after - before)
                    val changes = if (changesObj != null) {
                        val map = mutableMapOf<String, Double>()
                        changesObj.keys().forEach { key ->
                            val ch = changesObj.optJSONObject(key) // Об'єкт зміни
                            if (ch != null) {
                                val after = ch.optDouble("after", Double.NaN) // Значення після
                                if (!after.isNaN()) map[key] = after // Зберігаємо значення
                            }
                        }
                        if (map.isEmpty()) null else map
                    } else null
                    stats.add(StatDataPoint(timestamp, snapshot, changes)) // Додаємо точку
                }
                result.add(GlobalStatEntry(projectName, stats)) // Додаємо проект
            }
        } catch (e: Exception) {
            Log.e("GlobalStatsVM", "JSON parse error: ${e.message}", e) // Логуємо помилку
            _errorText.value = "Parse error: ${e.message}"
        }
        return result // Повертаємо результат
    }
    
    /**
     * Парсить JSONObject в Map<String, Double>.
     */
    private fun parseDoubleMap(obj: org.json.JSONObject?): Map<String, Double>? {
        if (obj == null) return null // Повертаємо null якщо об'єкт порожній
        val map = mutableMapOf<String, Double>() // Результуюча карта
        obj.keys().forEach { key ->
            val v = obj.optDouble(key, Double.NaN) // Отримуємо значення
            if (!v.isNaN()) map[key] = v // Додаємо лише не-NaN значення
        }
        return if (map.isEmpty()) null else map // Повертаємо null для порожньої карти
    }

    fun selectVariable(variable: String) {
        _selectedVariable.value = variable
    }

    /**
     * Отримує останні значення обраної змінної для кожного проекту.
     */
    fun getLatestValuesForSelected(): Map<String, Double> {
        val selected = _selectedVariable.value ?: return emptyMap() // Якщо нічого не вибрано — повертаємо пусто
        val result = mutableMapOf<String, Double>() // Результуюча карта
        
        _entries.value.forEach { entry ->
            // Шукаємо останнє значення в зворотньому порядку
            for (i in entry.stats.indices.reversed()) {
                val point = entry.stats[i] // Поточна точка
                val snapVal = point.snapshot?.get(selected) // Значення зі снімку
                if (snapVal != null) {
                    result[entry.projectName] = snapVal // Зберігаємо значення
                    break // Знайшли — зупиняємось
                }
                val changesVal = point.changes?.get(selected) // Значення зі змін
                if (changesVal != null) {
                    result[entry.projectName] = changesVal // Зберігаємо значення
                    break // Знайшли — зупиняємось
                }
            }
        }
        return result // Повертаємо результат
    }
}

/**
 * Екран загальної статистики.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GlobalStatisticsScreen(onBackClick: () -> Unit) {
    val viewModel: GlobalStatisticsViewModel = viewModel()
    val availableVariables by viewModel.availableVariables.collectAsState()
    val selectedVariable by viewModel.selectedVariable.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val errorText by viewModel.errorText.collectAsState()

    var expandedDropdown by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                modifier = androidx.compose.ui.Modifier.height(56.dp),
                
                title = {
                    Text(
                        "Загальна статистика", // Назва екрану
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Назад", // Перекладено
                            tint = Color.White
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = GlassBg.copy(alpha = 0.85f) // Темний фон
                )
            )
        },
        containerColor = GlassBg // Темний фон екрану
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 16.dp)
        ) {
            Spacer(modifier = Modifier.height(16.dp))

            // Селектор змінної
            Box {
                OutlinedCard(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { expandedDropdown = true },
                    shape = RoundedCornerShape(24.dp),
                    colors = CardDefaults.outlinedCardColors(containerColor = Color.White.copy(alpha = 0.06f)),
                    border = BorderStroke(1.dp, Color.White.copy(alpha = 0.12f))
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = selectedVariable ?: "Завантаження...", // Вибрана змінна
                            color = Color.White,
                            style = MaterialTheme.typography.titleMedium
                        )
                        Icon(Icons.Default.ArrowDropDown, contentDescription = null, tint = Color.White)
                    }
                }

                DropdownMenu(
                    expanded = expandedDropdown,
                    onDismissRequest = { expandedDropdown = false },
                    modifier = Modifier.background(Color.White.copy(alpha = 0.06f))
                ) {
                    availableVariables.forEach { variable ->
                        DropdownMenuItem(
                            text = { Text(variable, color = Color.White) },
                            onClick = {
                                viewModel.selectVariable(variable)
                                expandedDropdown = false
                            }
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Таблиця даних
            if (isLoading) {
                Box(modifier = Modifier.fillMaxWidth().weight(1f), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
                }
            } else if (errorText != null) {
                Box(modifier = Modifier.fillMaxWidth().weight(1f), contentAlignment = Alignment.Center) {
                    Text(
                        text = errorText ?: "Невідома помилка",
                        color = Color.Red,
                        style = MaterialTheme.typography.bodyMedium
                    )
                }
            } else if (availableVariables.isEmpty()) {
                Box(modifier = Modifier.fillMaxWidth().weight(1f), contentAlignment = Alignment.Center) {
                    Text(
                        text = "Даних ще немає. Запустіть проекти для збору статистики.", // Перекладено
                        color = Color.White.copy(alpha = 0.5f),
                        style = MaterialTheme.typography.bodyMedium
                    )
                }
            } else if (selectedVariable != null) {
                Text(
                    text = "Останні значення по проектам", // Заголовок
                    style = MaterialTheme.typography.titleMedium,
                    color = Color.White.copy(alpha = 0.7f),
                    modifier = Modifier.padding(bottom = 12.dp)
                )

                val valuesMap = viewModel.getLatestValuesForSelected()
                
                if (valuesMap.isEmpty()) {
                    Text("Даних не знайдено", color = Color.White.copy(alpha = 0.5f)) // Перекладено
                } else {
                    LazyColumn(
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(valuesMap.entries.toList(), key = { it.key }) { entry ->
                            ProjectValueRow(projectName = entry.key, value = entry.value)
                        }
                    }
                }
            }
        }
    }
}

/**
 * Рядок з значенням проекту.
 */
@Composable
fun ProjectValueRow(projectName: String, value: Double) {
    // Генеруємо колір на основі назви проекту
    val colors = listOf(GlassSuccess, Color(0xFF3B82F6), GlassBalance, GlassWarning, GlassAccentLight)
    val colorIndex = Math.abs(projectName.hashCode()) % colors.size
    val indicatorColor = colors[colorIndex]

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(24.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White.copy(alpha = 0.06f)),
        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.12f))
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(12.dp)
                        .clip(CircleShape)
                        .background(indicatorColor)
                )
                Spacer(modifier = Modifier.width(12.dp))
                Text(
                    text = projectName, // Проект
                    style = MaterialTheme.typography.bodyLarge,
                    color = Color.White,
                    fontWeight = FontWeight.Bold
                )
            }
            
            val formattedValue = if (value % 1.0 == 0.0) value.toInt().toString() else String.format("%.2f", value)
            Text(
                text = formattedValue, // Значення
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.primary,
                fontWeight = FontWeight.Bold
            )
        }
    }
}

