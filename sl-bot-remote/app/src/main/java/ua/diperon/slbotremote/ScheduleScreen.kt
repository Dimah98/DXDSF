package ua.diperon.slbotremote

import android.app.Application
import android.util.Log
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.horizontalScroll
import androidx.compose.ui.window.Dialog
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.outlined.*
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import ua.diperon.slbotremote.data.AppDatabase
import ua.diperon.slbotremote.data.CachedScheduleEntity
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import java.text.SimpleDateFormat
import java.util.*
import ua.diperon.slbotremote.ui.theme.*

class ScheduleViewModel(application: Application) : AndroidViewModel(application) {
    private val context = application.applicationContext
    private val configManager = ConnectionConfigManager(context)
    private val interceptor = DynamicBaseUrlInterceptor()
    private val apiService: BotApiService = BotApiService.create(interceptor)
    private val db = AppDatabase.getInstance(context)
    private val dao = db.dao()
    private val moshi = Moshi.Builder().addLast(KotlinJsonAdapterFactory()).build()

    private val _schedules = MutableStateFlow<List<ScheduleInfo>>(emptyList())
    val schedules: StateFlow<List<ScheduleInfo>> = _schedules.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    private val _errorEvents = MutableSharedFlow<String>(extraBufferCapacity = 1)
    val errorEvents: SharedFlow<String> = _errorEvents.asSharedFlow()

    init {
        interceptor.setBaseUrl(configManager.getHttpUrl())
        loadCacheAndFetch()
    }

    private fun loadCacheAndFetch() {
        viewModelScope.launch {
            try {
                val cached = dao.getSchedules()
                if (cached.isNotEmpty()) {
                    _schedules.value = cached.map { e ->
                        ScheduleInfo(
                            projectName = e.projectName,
                            mode = e.mode,
                            nextRun = e.nextRun,
                            lastRun = e.lastRun,
                            settings = try { moshi.adapter(ScheduleSettings::class.java).fromJson(e.settingsJson) } catch (ex: Exception) { null },
                            plannedRuns = try {
                                val type = com.squareup.moshi.Types.newParameterizedType(List::class.java, PlannedRun::class.java)
                                moshi.adapter<List<PlannedRun>>(type).fromJson(e.plannedRunsJson) ?: emptyList()
                            } catch (ex: Exception) { emptyList() }
                        )
                    }
                }
            } catch (e: Exception) {
                Log.w("ScheduleVM", "Cache error: ${e.message}")
            }
            fetchSchedule()
        }
    }

    fun fetchSchedule() {
        viewModelScope.launch {
            _isLoading.value = true
            _errorMessage.value = null
            try {
                val data = apiService.getSchedule()
                _schedules.value = data
                dao.clearSchedules()
                dao.insertSchedules(data.map {
                    CachedScheduleEntity(
                        projectName = it.projectName,
                        mode = it.mode,
                        nextRun = it.nextRun,
                        lastRun = it.lastRun,
                        settingsJson = try { moshi.adapter(ScheduleSettings::class.java).toJson(it.settings) } catch (e: Exception) { "{}" },
                        plannedRunsJson = try {
                            val type = com.squareup.moshi.Types.newParameterizedType(List::class.java, PlannedRun::class.java)
                            moshi.adapter<List<PlannedRun>>(type).toJson(it.plannedRuns) ?: "[]"
                        } catch (e: Exception) { "[]" },
                        cachedAt = System.currentTimeMillis()
                    )
                })
            } catch (e: Exception) {
                Log.e("ScheduleVM", "Error fetching schedule: ${e.message}")
                _errorMessage.value = "Не вдалося завантажити розклад"
                _errorEvents.emit("Помилка розкладу: ${e.localizedMessage}")
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun updateSchedule(projectName: String, request: ScheduleUpdateRequest) {
        viewModelScope.launch {
            try {
                val response = apiService.updateSchedule(projectName, request)
                if (response.success) {
                    fetchSchedule()
                } else {
                    _errorMessage.value = response.message ?: "Помилка збереження"
                    _errorEvents.emit(response.message ?: "Помилка збереження розкладу")
                }
            } catch (e: Exception) {
                Log.e("ScheduleVM", "Error saving schedule: ${e.message}")
                _errorMessage.value = "Не вдалося зберегти розклад"
                _errorEvents.emit("Помилка збереження: ${e.localizedMessage}")
            }
        }
    }
}

// ... rest of the UI code stays unchanged below, but we need to keep the whole file
// To avoid rewriting the entire UI, let's just write the whole file.
// The UI part after line 100 is mostly unchanged. Let's read it first to preserve.


/**
 * Екран менеджера розкладу.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ScheduleScreen(onBackClick: () -> Unit) {
    val viewModel: ScheduleViewModel = viewModel()
    val schedules by viewModel.schedules.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(Unit) {
        viewModel.errorEvents.collect { message ->
            snackbarHostState.showSnackbar(message)
        }
    }

    // Автоматичне оновлення кожні 30 секунд
    LaunchedEffect(Unit) {
        while (true) {
            delay(30000)
            viewModel.fetchSchedule()
        }
    }

    var scheduleToEdit by remember { mutableStateOf<ScheduleInfo?>(null) }

    Scaffold(
        topBar = {
            TopAppBar(
                modifier = androidx.compose.ui.Modifier.height(56.dp),
                title = {
                    Column {
                        Text(
                            "Менеджер розкладу",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                        Text(
                            "ТАЙМЛАЙН ЗАПУСКІВ ПРОЕКТІВ НА ДОБУ",
                            style = MaterialTheme.typography.labelSmall,
                            color = Color.White.copy(alpha = 0.5f)
                        )
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Назад",
                            tint = Color.White
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = GlassBg.copy(alpha = 0.85f)
                )
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) },
        containerColor = GlassBg
    ) { padding ->
        if (isLoading && schedules.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
            }
        } else {
            val verticalScroll = androidx.compose.foundation.rememberScrollState()
            val horizontalScroll = androidx.compose.foundation.rememberScrollState()

            val rowHeight = 72.dp
            val leftColumnWidth = 120.dp
            val timelineWidth = 1200.dp

            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .padding(top = 16.dp)
                    .verticalScroll(verticalScroll)
            ) {
                Row {
                    // Ліва колонка з назвами проектів
                    Column(modifier = Modifier.width(leftColumnWidth)) {
                        // Порожній кут для шапки
                        Box(modifier = Modifier.height(40.dp))

                        schedules.forEach { schedule ->
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(rowHeight)
                                    .clickable { scheduleToEdit = schedule }
                                    .padding(horizontal = 12.dp),
                                verticalArrangement = Arrangement.Center
                            ) {
                                Text(
                                    text = schedule.projectName,
                                    fontWeight = FontWeight.Bold,
                                    color = Color.White,
                                    fontSize = 14.sp
                                )
                                Spacer(modifier = Modifier.height(4.dp))
                                val modeText = if (schedule.mode == "interval") "КОЖНІ ${schedule.settings?.intervalValue} ${if (schedule.settings?.intervalUnit == "hours") "ГОД" else "ХВ"}" else "БЕЗ РОЗКЛАДУ"
                                Text(
                                    text = modeText,
                                    color = if (schedule.mode == "interval") GlassSuccess else Color.White.copy(alpha = 0.4f),
                                    fontSize = 9.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                    }

                    // Права колонка з прокруткою (таймлайн)
                    Column(modifier = Modifier.horizontalScroll(horizontalScroll)) {
                        // Шапка з годинами
                        Row(modifier = Modifier.width(timelineWidth).height(40.dp)) {
                            for (i in 0..11) {
                                Box(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = "${String.format(Locale.getDefault(), "%02d", i * 2)}:00",
                                        color = Color.White.copy(alpha = 0.5f),
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                            }
                        }

                        // Сітка та індикатори
                        Box(modifier = Modifier.width(timelineWidth).height(rowHeight * schedules.size)) {
                            androidx.compose.foundation.Canvas(modifier = Modifier.fillMaxSize()) {
                                val gridColor = Color(0xFF2DD4BF).copy(alpha = 0.3f)

                                // Горизонтальні лінії
                                for (i in 0..schedules.size) {
                                    val y = i * rowHeight.toPx()
                                    drawLine(color = gridColor, start = androidx.compose.ui.geometry.Offset(0f, y), end = androidx.compose.ui.geometry.Offset(size.width, y), strokeWidth = 1.dp.toPx())
                                }

                                // Вертикальні лінії
                                val colWidth = size.width / 12
                                for (i in 0..11) {
                                    val x = i * colWidth
                                    drawLine(color = gridColor, start = androidx.compose.ui.geometry.Offset(x, 0f), end = androidx.compose.ui.geometry.Offset(x, size.height), strokeWidth = 1.dp.toPx())
                                }

                                // Лінія "Зараз"
                                val cal = Calendar.getInstance()
                                val nowHours = cal.get(Calendar.HOUR_OF_DAY)
                                val nowMinutes = cal.get(Calendar.MINUTE)
                                val nowFraction = (nowHours + nowMinutes / 60f) / 24f
                                val nowX = nowFraction * size.width
                                drawLine(color = GlassError, start = androidx.compose.ui.geometry.Offset(nowX, 0f), end = androidx.compose.ui.geometry.Offset(nowX, size.height), strokeWidth = 2.dp.toPx())

                                // Малювання точок запусків
                                schedules.forEachIndexed { index, schedule ->
                                    val yCenter = index * rowHeight.toPx() + rowHeight.toPx() / 2

                                    schedule.nextRun?.let { time ->
                                        val runCal = Calendar.getInstance().apply { timeInMillis = time }
                                        // Перевіряємо чи це сьогоднішній день
                                        if (runCal.get(Calendar.DAY_OF_YEAR) == cal.get(Calendar.DAY_OF_YEAR)) {
                                            val h = runCal.get(Calendar.HOUR_OF_DAY)
                                            val m = runCal.get(Calendar.MINUTE)
                                            val f = (h + m / 60f) / 24f
                                            val x = f * size.width
                                            drawCircle(color = Color(0xFF3B82F6), radius = 6.dp.toPx(), center = androidx.compose.ui.geometry.Offset(x, yCenter))
                                        }
                                    }

                                    // Малювання програмних запусків від нод
                                    schedule.plannedRuns.forEach { planned ->
                                        val runCal = Calendar.getInstance().apply { timeInMillis = planned.runAt }
                                        if (runCal.get(Calendar.DAY_OF_YEAR) == cal.get(Calendar.DAY_OF_YEAR)) {
                                            val h = runCal.get(Calendar.HOUR_OF_DAY)
                                            val m = runCal.get(Calendar.MINUTE)
                                            val f = (h + m / 60f) / 24f
                                            val x = f * size.width
                                            drawCircle(color = GlassWarning, radius = 5.dp.toPx(), center = androidx.compose.ui.geometry.Offset(x, yCenter))
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Діалог редагування
    if (scheduleToEdit != null) {
        val schedule = scheduleToEdit!!
        Dialog(onDismissRequest = { scheduleToEdit = null }) {
            Card(
                shape = RoundedCornerShape(24.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White.copy(alpha = 0.06f)),
                border = BorderStroke(1.dp, Color.White.copy(alpha = 0.12f))
            ) {
                Column(
                    modifier = Modifier.padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    Text("Розклад: ${schedule.projectName}", color = Color.White, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)

                    var mode by remember { mutableStateOf(schedule.settings?.mode ?: "none") }
                    var intervalValue by remember { mutableStateOf((schedule.settings?.intervalValue ?: 2).toString()) }
                    var intervalUnit by remember { mutableStateOf(schedule.settings?.intervalUnit ?: "hours") }
                    var randomOffset by remember { mutableStateOf((schedule.settings?.randomOffsetMinutes ?: 0).toString()) }

                    // Вибір режиму
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        RadioButton(selected = mode == "none", onClick = { mode = "none" })
                        Text("Вимк.", color = Color.White)
                        Spacer(modifier = Modifier.width(16.dp))
                        RadioButton(selected = mode == "interval", onClick = { mode = "interval" })
                        Text("Інтервал", color = Color.White)
                    }

                    if (mode == "interval") {
                        OutlinedTextField(
                            value = intervalValue,
                            onValueChange = { intervalValue = it },
                            label = { Text("Інтервал", color = Color.White.copy(alpha = 0.5f)) },
                            textStyle = LocalTextStyle.current.copy(color = Color.White)
                        )

                        Button(onClick = { intervalUnit = if (intervalUnit == "hours") "minutes" else "hours" }) {
                            Text(if (intervalUnit == "hours") "Годин" else "Хвилин")
                        }

                        OutlinedTextField(
                            value = randomOffset,
                            onValueChange = { randomOffset = it },
                            label = { Text("Рандомізація (хв)", color = Color.White.copy(alpha = 0.5f)) },
                            textStyle = LocalTextStyle.current.copy(color = Color.White)
                        )
                    }

                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                        TextButton(onClick = { scheduleToEdit = null }) {
                            Text("СКАСУВАТИ", color = Color.White.copy(alpha = 0.5f))
                        }
                        Spacer(modifier = Modifier.width(8.dp))
                        Button(
                            onClick = {
                                val req = ScheduleUpdateRequest(
                                    mode = mode,
                                    intervalValue = intervalValue.toIntOrNull() ?: 2,
                                    intervalUnit = intervalUnit,
                                    randomOffsetMinutes = randomOffset.toIntOrNull() ?: 0
                                )
                                viewModel.updateSchedule(schedule.projectName, req)
                                scheduleToEdit = null
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary)
                        ) {
                            Text("ЗБЕРЕГТИ", color = Color.Black, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
    }
}
