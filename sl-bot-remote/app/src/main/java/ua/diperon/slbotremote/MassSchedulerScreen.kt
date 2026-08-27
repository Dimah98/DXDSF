package ua.diperon.slbotremote

import android.util.Log
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Timer
import androidx.compose.material.icons.outlined.Info
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import ua.diperon.slbotremote.ui.theme.*

private const val TAG = "MassSchedulerScreen"

private val COMMON_JSON_PATHS = listOf(
    "🏝️ Острів (початок)" to "$.visitedFarmState.floatingIsland.schedule[0].startAt",
    "🏝️ Острів (кінець)" to "$.visitedFarmState.floatingIsland.schedule[0].endAt",
    "🚢 Корабель" to "$.visitedFarmState.shipments.restockedAt",
    "⛏️ Шахта" to "$.visitedFarmState.minigames.games[\"mine-whack\"].history[0].prizeClaimedAt"
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MassSchedulerScreen(
    apiService: BotApiService,
    onBackClick: () -> Unit
) {
    val scope = rememberCoroutineScope()
    val snackbarHostState = remember { SnackbarHostState() }

    var launches by remember { mutableStateOf<List<MassLaunchItem>>(emptyList()) }
    var configs by remember { mutableStateOf<List<SavedConfig>>(emptyList()) }
    var availableContainers by remember { mutableStateOf<List<String>>(emptyList()) }
    var isLoading by remember { mutableStateOf(false) }

    // Dialog state
    var isDialogOpen by remember { mutableStateOf(false) }
    var editingLaunch by remember { mutableStateOf<MassLaunchItem?>(null) }
    var expandedBreakdownId by remember { mutableStateOf<String?>(null) }

    fun fetchData() {
        scope.launch {
            isLoading = true
            try {
                launches = apiService.getMassLaunches()
            } catch (e: Exception) {
                Log.e(TAG, "Failed to fetch mass launches", e)
                snackbarHostState.showSnackbar("Помилка завантаження розкладу: ${e.message}")
            }
            try {
                val cfgResp = apiService.getConfigs()
                if (cfgResp.success) {
                    configs = cfgResp.configs
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to fetch configs", e)
            }
            try {
                val contResp = apiService.getContainersList("SF")
                if (contResp.success) {
                    availableContainers = contResp.containers
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to fetch containers", e)
            }
            isLoading = false
        }
    }

    LaunchedEffect(Unit) {
        fetchData()
    }

    fun toggleEnabled(item: MassLaunchItem) {
        scope.launch {
            try {
                val newEnabled = !item.enabled
                apiService.updateMassLaunch(item.id, mapOf("enabled" to newEnabled))
                launches = launches.map { if (it.id == item.id) it.copy(enabled = newEnabled) else it }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to toggle enabled", e)
                snackbarHostState.showSnackbar("Помилка: ${e.message}")
            }
        }
    }

    fun deleteLaunch(id: String) {
        scope.launch {
            try {
                val res = apiService.deleteMassLaunch(id)
                if (res.success) {
                    launches = launches.filter { it.id != id }
                    snackbarHostState.showSnackbar("Розклад видалено")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to delete launch", e)
                snackbarHostState.showSnackbar("Помилка: ${e.message}")
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Default.CalendarMonth,
                            contentDescription = null,
                            tint = GlassIndigo,
                            modifier = Modifier.size(24.dp)
                        )
                        Spacer(modifier = Modifier.width(10.dp))
                        Text(
                            text = "Масовий Планувальник",
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
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
                actions = {
                    IconButton(onClick = { fetchData() }) {
                        Icon(
                            imageVector = Icons.Default.Refresh,
                            contentDescription = "Оновити",
                            tint = Color.White
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Color(0xFF14161B)
                )
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = {
                    editingLaunch = null
                    isDialogOpen = true
                },
                containerColor = GlassIndigo,
                contentColor = Color.White,
                shape = CircleShape
            ) {
                Icon(Icons.Default.Add, contentDescription = "Додати запуск")
            }
        },
        snackbarHost = { SnackbarHost(snackbarHostState) },
        containerColor = MaterialTheme.colorScheme.background
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            if (isLoading && launches.isEmpty()) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = GlassIndigo)
                }
            } else if (launches.isEmpty()) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(
                            imageVector = Icons.Default.CalendarMonth,
                            contentDescription = null,
                            tint = Color.White.copy(alpha = 0.2f),
                            modifier = Modifier.size(64.dp)
                        )
                        Spacer(modifier = Modifier.height(12.dp))
                        Text(
                            text = "Немає створених масових запусків",
                            color = Color.White.copy(alpha = 0.5f),
                            fontSize = 14.sp
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "Натисніть + щоб створити новий розклад",
                            color = GlassIndigo,
                            fontSize = 12.sp
                        )
                    }
                }
            } else {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(horizontal = 14.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    items(launches, key = { it.id }) { item ->
                        MassLaunchCard(
                            item = item,
                            configs = configs,
                            isExpanded = expandedBreakdownId == item.id,
                            onToggleExpand = {
                                expandedBreakdownId = if (expandedBreakdownId == item.id) null else item.id
                            },
                            onToggleEnabled = { toggleEnabled(item) },
                            onEdit = {
                                editingLaunch = item
                                isDialogOpen = true
                            },
                            onDelete = { deleteLaunch(item.id) }
                        )
                    }
                }
            }
        }
    }

    if (isDialogOpen) {
        MassLaunchEditDialog(
            launch = editingLaunch,
            configs = configs,
            availableContainers = availableContainers,
            apiService = apiService,
            onDismiss = { isDialogOpen = false },
            onSaved = {
                isDialogOpen = false
                fetchData()
            }
        )
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun MassLaunchCard(
    item: MassLaunchItem,
    configs: List<SavedConfig>,
    isExpanded: Boolean,
    onToggleExpand: () -> Unit,
    onToggleEnabled: () -> Unit,
    onEdit: () -> Unit,
    onDelete: () -> Unit
) {
    val configName = remember(item.configId, configs) {
        if (item.configId.isNullOrEmpty() || item.configId == "all") {
            "Всі проекти"
        } else {
            configs.find { it.id == item.configId }?.name ?: item.configId
        }
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = Color.White.copy(alpha = 0.05f)
        ),
        border = BorderStroke(1.dp, if (item.enabled) GlassIndigo.copy(alpha = 0.4f) else Color.White.copy(alpha = 0.08f))
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp)
        ) {
            // Header: Name + Status + Switch
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = item.name,
                        color = Color.White,
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp
                    )
                    Spacer(modifier = Modifier.height(2.dp))
                    Text(
                        text = "Ціль: $configName",
                        color = GlassIndigoLight,
                        fontSize = 11.sp
                    )
                }

                Row(verticalAlignment = Alignment.CenterVertically) {
                    Switch(
                        checked = item.enabled,
                        onCheckedChange = { onToggleEnabled() },
                        colors = SwitchDefaults.colors(
                            checkedThumbColor = Color.White,
                            checkedTrackColor = GlassIndigo,
                            uncheckedThumbColor = Color.White.copy(alpha = 0.6f),
                            uncheckedTrackColor = Color.White.copy(alpha = 0.1f)
                        )
                    )
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            // Mode & Time info box
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(10.dp))
                    .background(Color.Black.copy(alpha = 0.3f))
                    .padding(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                if (item.mode == "manual_time") {
                    Icon(
                        imageVector = Icons.Default.Schedule,
                        contentDescription = null,
                        tint = GlassBalance,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = "Щоденно о ${item.time ?: "--:--"}",
                        color = Color.White,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Medium
                    )
                } else {
                    Icon(
                        imageVector = Icons.Default.Timer,
                        contentDescription = null,
                        tint = GlassGem,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = "Динамічно: ${item.jsonPath ?: ""}",
                        color = Color.White,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Normal,
                        maxLines = 1
                    )
                }
            }

            // Next Launch Summary
            item.nextLaunchSummary?.let { summary ->
                Spacer(modifier = Modifier.height(8.dp))
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(10.dp))
                        .background(if (summary.isPast) Color(0xFFEF4444).copy(alpha = 0.15f) else GlassSuccess.copy(alpha = 0.15f))
                        .padding(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = if (summary.isPast) "⚠️ Прострочено:" else "⏱️ Наступний:",
                        color = if (summary.isPast) Color(0xFFEF4444) else GlassSuccess,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = "${summary.project} о ${summary.time} (${summary.relative})",
                        color = Color.White,
                        fontSize = 11.sp
                    )
                }
            }

            // Containers list chips
            if (item.containers.isNotEmpty()) {
                Spacer(modifier = Modifier.height(10.dp))
                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    item.containers.forEach { container ->
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(6.dp))
                                .background(GlassIndigo.copy(alpha = 0.2f))
                                .border(1.dp, GlassIndigo.copy(alpha = 0.4f), RoundedCornerShape(6.dp))
                                .padding(horizontal = 8.dp, vertical = 3.dp)
                        ) {
                            Text(
                                text = "📦 $container",
                                color = GlassIndigoLight,
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
            }

            // Expandable breakdown per project
            if (!item.calculatedTimes.isNullOrEmpty()) {
                Spacer(modifier = Modifier.height(8.dp))
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onToggleExpand() }
                        .padding(vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = "Деталі за проектами (${item.calculatedTimes.size})",
                        color = GlassIndigoLight,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Medium
                    )
                    Icon(
                        imageVector = if (isExpanded) Icons.Default.KeyboardArrowUp else Icons.Default.KeyboardArrowDown,
                        contentDescription = null,
                        tint = GlassIndigoLight,
                        modifier = Modifier.size(16.dp)
                    )
                }

                AnimatedVisibility(visible = isExpanded) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 6.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .background(Color.Black.copy(alpha = 0.4f))
                            .padding(8.dp),
                        verticalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        item.calculatedTimes.forEach { ct ->
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text(
                                    text = ct.project,
                                    color = Color.White,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold
                                )
                                Text(
                                    text = "${ct.timeStr} (${ct.relative})",
                                    color = if (ct.isPast) Color(0xFFEF4444) else GlassSuccess,
                                    fontSize = 11.sp
                                )
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            // Actions: Edit / Delete
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.End
            ) {
                IconButton(onClick = onEdit, modifier = Modifier.size(32.dp)) {
                    Icon(
                        imageVector = Icons.Default.Edit,
                        contentDescription = "Редагувати",
                        tint = Color.White.copy(alpha = 0.7f),
                        modifier = Modifier.size(16.dp)
                    )
                }
                Spacer(modifier = Modifier.width(8.dp))
                IconButton(onClick = onDelete, modifier = Modifier.size(32.dp)) {
                    Icon(
                        imageVector = Icons.Default.Delete,
                        contentDescription = "Видалити",
                        tint = Color(0xFFEF4444),
                        modifier = Modifier.size(16.dp)
                    )
                }
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun MassLaunchEditDialog(
    launch: MassLaunchItem?,
    configs: List<SavedConfig>,
    availableContainers: List<String>,
    apiService: BotApiService,
    onDismiss: () -> Unit,
    onSaved: () -> Unit
) {
    val scope = rememberCoroutineScope()

    var name by remember { mutableStateOf(launch?.name ?: "") }
    var mode by remember { mutableStateOf(launch?.mode ?: "manual_time") }
    var time by remember { mutableStateOf(launch?.time ?: "09:00") }
    var jsonPath by remember { mutableStateOf(launch?.jsonPath ?: "$.visitedFarmState.floatingIsland.schedule[0].startAt") }
    var selectedConfigId by remember { mutableStateOf(launch?.configId ?: "") }
    var selectedContainers by remember { mutableStateOf(launch?.containers ?: emptyList()) }
    var containersInput by remember { mutableStateOf(launch?.containers?.joinToString(", ") ?: "") }
    
    var isSaving by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    // Live preview state
    var previewSummary by remember { mutableStateOf<MassLaunchSummary?>(null) }
    var isLoadingPreview by remember { mutableStateOf(false) }

    fun fetchPreview() {
        if (mode != "json_time" || jsonPath.isBlank()) {
            previewSummary = null
            return
        }
        scope.launch {
            isLoadingPreview = true
            try {
                val res = apiService.previewMassLaunchTime(
                    configId = if (selectedConfigId.isBlank()) "all" else selectedConfigId,
                    jsonPath = jsonPath.trim()
                )
                if (res.success) {
                    previewSummary = res.summary
                }
            } catch (e: Exception) {
                Log.e(TAG, "Preview error", e)
            } finally {
                isLoadingPreview = false
            }
        }
    }

    LaunchedEffect(mode, jsonPath, selectedConfigId) {
        if (mode == "json_time") {
            delay(300)
            fetchPreview()
        }
    }

    fun save() {
        if (name.isBlank()) {
            errorMessage = "Введіть назву запуску"
            return
        }
        val containersList = if (selectedContainers.isNotEmpty()) {
            selectedContainers
        } else {
            containersInput.split(",").map { it.trim() }.filter { it.isNotBlank() }
        }

        scope.launch {
            isSaving = true
            errorMessage = null
            try {
                val request = MassLaunchCreateRequest(
                    name = name.trim(),
                    mode = mode,
                    time = if (mode == "manual_time") time.trim() else null,
                    jsonPath = if (mode == "json_time") jsonPath.trim() else null,
                    configId = if (selectedConfigId.isBlank()) null else selectedConfigId,
                    containers = containersList,
                    enabled = true
                )

                if (launch != null) {
                    apiService.updateMassLaunch(
                        launch.id,
                        mapOf(
                            "name" to request.name,
                            "mode" to request.mode,
                            "time" to request.time,
                            "jsonPath" to request.jsonPath,
                            "configId" to request.configId,
                            "containers" to request.containers,
                            "enabled" to true
                        )
                    )
                } else {
                    apiService.createMassLaunch(request)
                }
                onSaved()
            } catch (e: Exception) {
                Log.e(TAG, "Save error", e)
                errorMessage = e.message ?: "Помилка збереження"
            } finally {
                isSaving = false
            }
        }
    }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Card(
            modifier = Modifier
                .fillMaxWidth(0.95f)
                .clip(RoundedCornerShape(24.dp)),
            colors = CardDefaults.cardColors(containerColor = Color(0xFF161922)),
            border = BorderStroke(1.dp, Color.White.copy(alpha = 0.1f))
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(20.dp)
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                Text(
                    text = if (launch != null) "Редагувати Розклад" else "Новий Масовий Запуск",
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                    fontSize = 18.sp
                )

                // Name
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Назва розкладу") },
                    placeholder = { Text("наприклад: Полив острова") },
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = GlassIndigo,
                        unfocusedBorderColor = Color.White.copy(alpha = 0.2f),
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White
                    )
                )

                // Mode Tabs
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(Color.Black.copy(alpha = 0.4f))
                        .padding(4.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(8.dp))
                            .background(if (mode == "manual_time") GlassIndigo else Color.Transparent)
                            .clickable { mode = "manual_time" }
                            .padding(vertical = 8.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "🕒 Фіксований час",
                            color = if (mode == "manual_time") Color.White else Color.White.copy(alpha = 0.5f),
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }

                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(8.dp))
                            .background(if (mode == "json_time") GlassIndigo else Color.Transparent)
                            .clickable { mode = "json_time" }
                            .padding(vertical = 8.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "📄 З файлу JSON",
                            color = if (mode == "json_time") Color.White else Color.White.copy(alpha = 0.5f),
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }

                // Mode Settings
                if (mode == "manual_time") {
                    OutlinedTextField(
                        value = time,
                        onValueChange = { time = it },
                        label = { Text("Час щоденного запуску (HH:MM)") },
                        placeholder = { Text("09:00 або 14:30") },
                        modifier = Modifier.fillMaxWidth(),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = GlassIndigo,
                            unfocusedBorderColor = Color.White.copy(alpha = 0.2f),
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color.White
                        )
                    )
                } else {
                    // Preset chips
                    Text(
                        text = "Швидкі пресети JSON шляху:",
                        color = Color.White.copy(alpha = 0.7f),
                        fontSize = 11.sp
                    )

                    FlowRow(
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                        verticalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        COMMON_JSON_PATHS.forEach { (lbl, pth) ->
                            val isSelected = jsonPath == pth
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(if (isSelected) GlassIndigo else Color.White.copy(alpha = 0.08f))
                                    .clickable { jsonPath = pth }
                                    .padding(horizontal = 8.dp, vertical = 4.dp)
                            ) {
                                Text(
                                    text = lbl,
                                    color = if (isSelected) Color.White else Color.White.copy(alpha = 0.8f),
                                    fontSize = 10.sp
                                )
                            }
                        }
                    }

                    OutlinedTextField(
                        value = jsonPath,
                        onValueChange = { jsonPath = it },
                        label = { Text("JSONPath до мітки часу") },
                        modifier = Modifier.fillMaxWidth(),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = GlassIndigo,
                            unfocusedBorderColor = Color.White.copy(alpha = 0.2f),
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color.White
                        )
                    )

                    // Live Preview Box
                    if (isLoadingPreview) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            CircularProgressIndicator(modifier = Modifier.size(16.dp), color = GlassIndigo)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Розрахунок часу з файлів...", color = Color.White.copy(alpha = 0.6f), fontSize = 11.sp)
                        }
                    } else if (previewSummary != null) {
                        val s = previewSummary!!
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(10.dp))
                                .background(GlassSuccess.copy(alpha = 0.15f))
                                .border(1.dp, GlassSuccess.copy(alpha = 0.3f), RoundedCornerShape(10.dp))
                                .padding(10.dp)
                        ) {
                            Column {
                                Text(
                                    text = "✨ Знайдено розклад: ${s.totalWithTime} з ${s.totalProjects} проектів",
                                    color = GlassSuccess,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold
                                )
                                Spacer(modifier = Modifier.height(2.dp))
                                Text(
                                    text = "Найближчий: ${s.project} о ${s.time} (${s.relative})",
                                    color = Color.White,
                                    fontSize = 11.sp
                                )
                            }
                        }
                    }
                }

                // Config Filter Selector
                Text(
                    text = "Фільтр проектів (Конфігурація):",
                    color = Color.White.copy(alpha = 0.7f),
                    fontSize = 12.sp
                )

                var configDropdownOpen by remember { mutableStateOf(false) }
                val currentConfigLabel = remember(selectedConfigId, configs) {
                    if (selectedConfigId.isBlank() || selectedConfigId == "all") "Усі доступні проекти"
                    else configs.find { it.id == selectedConfigId }?.name ?: selectedConfigId
                }

                Box {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(10.dp))
                            .background(Color.White.copy(alpha = 0.08f))
                            .clickable { configDropdownOpen = true }
                            .padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(text = currentConfigLabel, color = Color.White, fontSize = 13.sp)
                        Icon(Icons.Default.KeyboardArrowDown, contentDescription = null, tint = Color.White)
                    }

                    DropdownMenu(
                        expanded = configDropdownOpen,
                        onDismissRequest = { configDropdownOpen = false }
                    ) {
                        DropdownMenuItem(
                            text = { Text("Усі доступні проекти") },
                            onClick = {
                                selectedConfigId = ""
                                configDropdownOpen = false
                            }
                        )
                        configs.forEach { cfg ->
                            DropdownMenuItem(
                                text = { Text(cfg.name) },
                                onClick = {
                                    selectedConfigId = cfg.id
                                    configDropdownOpen = false
                                }
                            )
                        }
                    }
                }

                // Containers Selection
                Text(
                    text = "Виберіть контейнери для запуску:",
                    color = Color.White.copy(alpha = 0.7f),
                    fontSize = 12.sp
                )

                if (availableContainers.isNotEmpty()) {
                    FlowRow(
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                        verticalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        availableContainers.forEach { cName ->
                            val isSel = selectedContainers.contains(cName)
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(if (isSel) GlassIndigo else Color.White.copy(alpha = 0.08f))
                                    .border(1.dp, if (isSel) GlassIndigoLight else Color.Transparent, RoundedCornerShape(8.dp))
                                    .clickable {
                                        selectedContainers = if (isSel) {
                                            selectedContainers - cName
                                        } else {
                                            selectedContainers + cName
                                        }
                                    }
                                    .padding(horizontal = 10.dp, vertical = 6.dp)
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    if (isSel) {
                                        Icon(Icons.Default.Check, contentDescription = null, tint = Color.White, modifier = Modifier.size(12.dp))
                                        Spacer(modifier = Modifier.width(4.dp))
                                    }
                                    Text(
                                        text = cName,
                                        color = if (isSel) Color.White else Color.White.copy(alpha = 0.8f),
                                        fontSize = 11.sp,
                                        fontWeight = if (isSel) FontWeight.Bold else FontWeight.Normal
                                    )
                                }
                            }
                        }
                    }
                } else {
                    OutlinedTextField(
                        value = containersInput,
                        onValueChange = { containersInput = it },
                        label = { Text("Назви контейнерів (через кому)") },
                        placeholder = { Text("Полив, Збір, Доставка") },
                        modifier = Modifier.fillMaxWidth(),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = GlassIndigo,
                            unfocusedBorderColor = Color.White.copy(alpha = 0.2f),
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color.White
                        )
                    )
                }

                if (errorMessage != null) {
                    Text(
                        text = errorMessage ?: "",
                        color = Color(0xFFEF4444),
                        fontSize = 12.sp
                    )
                }

                // Action Buttons
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 8.dp),
                    horizontalArrangement = Arrangement.End
                ) {
                    TextButton(onClick = onDismiss) {
                        Text("Скасувати", color = Color.White.copy(alpha = 0.6f))
                    }
                    Spacer(modifier = Modifier.width(8.dp))
                    Button(
                        onClick = { save() },
                        enabled = !isSaving,
                        colors = ButtonDefaults.buttonColors(containerColor = GlassIndigo)
                    ) {
                        if (isSaving) {
                            CircularProgressIndicator(modifier = Modifier.size(16.dp), color = Color.White)
                        } else {
                            Text("Зберегти", color = Color.White)
                        }
                    }
                }
            }
        }
    }
}
