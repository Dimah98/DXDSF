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
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.outlined.*
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Sort
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
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
import androidx.compose.ui.graphics.Color
import ua.diperon.slbotremote.ui.theme.*
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

private const val TAG = "ConfigManager"

private val OPERATORS = listOf(
    ">" to ">",
    "<" to "<",
    "==" to "==",
    ">=" to "≥",
    "<=" to "≤",
    "!=" to "≠",
    "exists" to "∃ існує",
    "not_exists" to "∄ не існує",
    "read" to "📖 читати",
    "read_delete" to "📖⛔ чит+видал",
    "contains" to "🔤 містить",
    "starts_with" to "🔤 починається",
    "ends_with" to "🔤 закінчується",
    "matches" to "🔤 regex",
    "time_before" to "⏰ < зараз",
    "time_after" to "⏰ > зараз",
    "time_equals" to "⏰ ≈ зараз"
)

private fun genRuleId(): String = "rule_${System.currentTimeMillis()}_${(0..999).random()}"
private fun genConfigId(): String = "cfg_${System.currentTimeMillis()}_${(0..999).random()}"

enum class SortMode(val label: String) {
    NAME("За назвою"),
    RULES_COUNT("За правилами"),
    STATUS("За статусом")
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ConfigManagerScreen(
    apiService: BotApiService,
    onBackClick: () -> Unit
) {
    val scope = rememberCoroutineScope()
    val snackbarHostState = remember { SnackbarHostState() }

    var configs by remember { mutableStateOf<List<SavedConfig>>(emptyList()) }
    var expandedId by remember { mutableStateOf<String?>(null) }
    var isLoading by remember { mutableStateOf(false) }
    var savingIds by remember { mutableStateOf<Set<String>>(emptySet()) }
    var sortMode by remember { mutableStateOf(SortMode.NAME) }
    var showSortMenu by remember { mutableStateOf(false) }

    // Відсортований список
    val sortedConfigs = remember(configs, sortMode) {
        when (sortMode) {
            SortMode.NAME -> configs.sortedBy { it.name.lowercase() }
            SortMode.RULES_COUNT -> configs.sortedByDescending { it.rules.size }
            SortMode.STATUS -> configs.sortedByDescending { if (it.enabled) 1 else 0 }
        }
    }

    fun fetchConfigs() {
        scope.launch {
            isLoading = true
            try {
                val response = apiService.getConfigs()
                if (response.success) configs = response.configs
            } catch (e: Exception) {
                Log.e(TAG, "Failed to fetch configs", e)
                snackbarHostState.showSnackbar("Помилка: ${e.message}")
            } finally {
                isLoading = false
            }
        }
    }

    LaunchedEffect(Unit) { fetchConfigs() }

    fun saveConfig(config: SavedConfig, isNew: Boolean = false, silent: Boolean = false) {
        scope.launch {
            savingIds = savingIds + config.id
            try {
                val request = ConfigCreateRequest(
                    name = config.name.trim(),
                    enabled = config.enabled,
                    rules = config.rules,
                    subConfigs = config.subConfigs?.ifEmpty { null }
                )
                val response = if (isNew) {
                    apiService.createConfig(request)
                } else {
                    apiService.updateConfig(config.id, request)
                }
                if (response.success && response.config != null) {
                    if (!silent) snackbarHostState.showSnackbar("Збережено: ${config.name}")
                    fetchConfigs()
                    if (isNew) {
                        expandedId = response.config.id
                    }
                } else if (!silent) {
                    snackbarHostState.showSnackbar(response.error ?: "Помилка збереження")
                }
            } catch (e: Exception) {
                if (!silent) snackbarHostState.showSnackbar("Помилка: ${e.message}")
            } finally {
                savingIds = savingIds - config.id
            }
        }
    }

    fun deleteConfig(id: String) {
        scope.launch {
            try {
                val response = apiService.deleteConfig(id)
                if (response.success) {
                    configs = configs.filter { it.id != id }
                    if (expandedId == id) expandedId = null
                    snackbarHostState.showSnackbar("Видалено")
                }
            } catch (e: Exception) {
                snackbarHostState.showSnackbar("Помилка: ${e.message}")
            }
        }
    }

    fun createNewConfig() {
        val newId = genConfigId()
        val newConfig = SavedConfig(
            id = newId,
            name = "Нова конфігурація",
            enabled = true,
            rules = listOf(
                ConfigRule(
                    id = genRuleId(), file = "(save)",
                    path = "$.visitedFarmState.inventory.Wood",
                    operator = ">", value = 50, rightType = "value", required = true
                )
            ),
            subConfigs = emptyList()
        )
        configs = configs + newConfig
        expandedId = newId
    }

    fun updateConfig(id: String, block: (SavedConfig) -> SavedConfig) {
        configs = configs.map { if (it.id == id) block(it) else it }
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Outlined.Settings, null, tint = Color(0xFF06B6D4), modifier = Modifier.size(20.dp))
                        Spacer(Modifier.width(8.dp))
                        Text("Конфігурації", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold, color = Color.White)
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Назад", tint = Color.White)
                    }
                },
                actions = {
                    Box {
                        IconButton(onClick = { showSortMenu = true }) {
                            Icon(Icons.Outlined.Sort, "Сортування", tint = Color(0xFF06B6D4))
                        }
                        DropdownMenu(
                            expanded = showSortMenu,
                            onDismissRequest = { showSortMenu = false },
                            modifier = Modifier.background(Color(0xFF0A0E1A).copy(alpha = 0.95f))
                        ) {
                            SortMode.entries.forEach { mode ->
                                DropdownMenuItem(
                                    text = {
                                        Row(verticalAlignment = Alignment.CenterVertically) {
                                            if (sortMode == mode) {
                                                Box(
                                                    modifier = Modifier
                                                        .size(6.dp)
                                                        .background(Color(0xFF06B6D4), CircleShape)
                                                )
                                                Spacer(Modifier.width(6.dp))
                                            } else {
                                                Spacer(Modifier.width(12.dp))
                                            }
                                            Text(mode.label, color = if (sortMode == mode) Color(0xFF06B6D4) else Color.White, fontSize = 13.sp)
                                        }
                                    },
                                    onClick = { sortMode = mode; showSortMenu = false }
                                )
                            }
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = GlassBg.copy(alpha = 0.85f))
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = { createNewConfig() },
                containerColor = Color(0xFF06B6D4),
                shape = CircleShape,
                modifier = Modifier.size(48.dp)
            ) {
                Icon(Icons.Outlined.Add, "Нова", tint = Color.White, modifier = Modifier.size(22.dp))
            }
        },
        containerColor = MaterialTheme.colorScheme.background
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 10.dp)
        ) {
            if (isLoading && configs.isEmpty()) {
                CircularProgressIndicator(
                    modifier = Modifier.align(Alignment.Center),
                    color = Color(0xFF06B6D4)
                )
            } else if (configs.isEmpty()) {
                Column(
                    modifier = Modifier.align(Alignment.Center),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text("Немає конфігурацій", fontSize = 14.sp, color = Color.White.copy(alpha = 0.5f))
                    Spacer(Modifier.height(8.dp))
                    Button(onClick = { createNewConfig() }, colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF06B6D4))) {
                        Text("Створити першу", fontSize = 13.sp)
                    }
                }
            } else {
                LazyColumn(
                    verticalArrangement = Arrangement.spacedBy(6.dp),
                    modifier = Modifier.fillMaxSize()
                ) {
                    // Підказка сортування
                    item {
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                            horizontalArrangement = Arrangement.End,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                "Сортування: ${sortMode.label}",
                                fontSize = 10.sp,
                                color = Color(0xFF06B6D4).copy(alpha = 0.7f)
                            )
                        }
                    }
                    items(sortedConfigs, key = { it.id }) { config ->
                        ConfigListItem(
                            config = config,
                            isExpanded = expandedId == config.id,
                            isSaving = config.id in savingIds,
                            onToggleExpand = {
                                expandedId = if (expandedId == config.id) null else config.id
                            },
                            onToggleEnabled = {
                                val updated = config.copy(enabled = !config.enabled)
                                updateConfig(config.id) { updated }
                                // Автозбереження після зміни статусу
                                saveConfig(updated, isNew = config.id.startsWith("cfg_"), silent = true)
                            },
                            onUpdate = { cfg ->
                                updateConfig(config.id) { cfg }
                            },
                            onAutoSave = { cfg ->
                                saveConfig(cfg, isNew = cfg.id.startsWith("cfg_"), silent = true)
                            },
                            onDelete = { deleteConfig(config.id) },
                            allConfigs = configs
                        )
                    }
                    item { Spacer(Modifier.height(72.dp)) }
                }
            }
        }
    }
}

@Composable
private fun ConfigListItem(
    config: SavedConfig,
    isExpanded: Boolean,
    isSaving: Boolean,
    onToggleExpand: () -> Unit,
    onToggleEnabled: () -> Unit,
    onUpdate: (SavedConfig) -> Unit,
    onAutoSave: (SavedConfig) -> Unit,
    onDelete: () -> Unit,
    allConfigs: List<SavedConfig>
) {
    // Debounce-автозбереження при змінах конфігурації
    val scope = rememberCoroutineScope()
    var autoSaveJob by remember { mutableStateOf<kotlinx.coroutines.Job?>(null) }

    fun scheduleAutoSave(cfg: SavedConfig) {
        autoSaveJob?.cancel()
        autoSaveJob = scope.launch {
            delay(1500) // чекаємо 1.5с після останньої зміни
            if (cfg.name.isNotBlank()) onAutoSave(cfg)
        }
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(24.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White.copy(alpha = 0.06f)),
        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.12f))
    ) {
        Column {
            // --- Compact header (always visible) ---
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable(onClick = onToggleExpand)
                    .padding(horizontal = 12.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                // Status dot
                Box(
                    modifier = Modifier
                        .size(8.dp)
                        .background(
                            if (config.enabled) Color(0xFF22C55E) else Color(0xFFEF4444),
                            CircleShape
                        )
                )

                Column(modifier = Modifier.weight(1f)) {
                    Text(config.name, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = Color.White)
                    Text(
                        "${config.rules.size} правил${config.subConfigs?.let { ", ${it.size} підконф" } ?: ""}${if (isSaving) " · збереження…" else ""}",
                        fontSize = 10.sp,
                        color = if (isSaving) Color(0xFF06B6D4) else Color.White.copy(alpha = 0.4f)
                    )
                }

                // Enabled toggle compact
                Box(
                    modifier = Modifier
                        .size(width = 36.dp, height = 20.dp)
                        .clickable(onClick = onToggleEnabled)
                        .background(
                            if (config.enabled) Color(0xFF06B6D4) else Color(0xFF2A2D35),
                            RoundedCornerShape(10.dp)
                        ),
                    contentAlignment = if (config.enabled) Alignment.CenterEnd else Alignment.CenterStart
                ) {
                    Box(
                        modifier = Modifier
                            .padding(2.dp)
                            .size(16.dp)
                            .background(Color.White, CircleShape)
                    )
                }

                // Expand arrow
                Icon(
                    imageVector = if (isExpanded) Icons.Default.KeyboardArrowUp else Icons.Default.KeyboardArrowDown,
                    contentDescription = null,
                    tint = Color.White.copy(alpha = 0.4f),
                    modifier = Modifier.size(20.dp)
                )
            }

            // --- Expanded editor ---
            AnimatedVisibility(visible = isExpanded, enter = fadeIn(), exit = fadeOut()) {
                Column(
                    modifier = Modifier.padding(start = 12.dp, end = 12.dp, bottom = 12.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    androidx.compose.material3.HorizontalDivider(color = Color.White.copy(alpha = 0.05f))

                    // Name — компактне поле
                    OutlinedTextField(
                        value = config.name,
                        onValueChange = {
                            val updated = config.copy(name = it)
                            onUpdate(updated)
                            scheduleAutoSave(updated)
                        },
                        label = { Text("Назва", fontSize = 10.sp) },
                        modifier = Modifier.fillMaxWidth(),
                        colors = fieldColors(),
                        shape = RoundedCornerShape(8.dp),
                        textStyle = androidx.compose.ui.text.TextStyle(fontSize = 13.sp, color = Color.White),
                        singleLine = true
                    )

                    // Rules section
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Правила (AND)", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color.White.copy(alpha = 0.6f))
                        IconButton(
                            onClick = {
                                val newRule = ConfigRule(
                                    id = genRuleId(), file = "(save)", path = "",
                                    operator = ">", value = "", rightType = "value"
                                )
                                val updated = config.copy(rules = config.rules + newRule)
                                onUpdate(updated)
                                scheduleAutoSave(updated)
                            },
                            modifier = Modifier.size(28.dp)
                        ) {
                            Icon(Icons.Outlined.Add, null, tint = Color(0xFF06B6D4), modifier = Modifier.size(18.dp))
                        }
                    }

                    config.rules.forEachIndexed { idx, rule ->
                        RuleCardVertical(
                            index = idx + 1,
                            rule = rule,
                            onUpdate = { block ->
                                val updated = config.copy(rules = config.rules.map { if (it.id == rule.id) block(it) else it })
                                onUpdate(updated)
                                scheduleAutoSave(updated)
                            },
                            onDelete = {
                                val updated = config.copy(rules = config.rules.filter { it.id != rule.id })
                                onUpdate(updated)
                                scheduleAutoSave(updated)
                            }
                        )
                    }

                    if (config.rules.isEmpty()) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(44.dp)
                                .border(1.dp, Color.White.copy(alpha = 0.05f), RoundedCornerShape(10.dp))
                                .background(Color(0xFF14161B), RoundedCornerShape(10.dp)),
                            contentAlignment = Alignment.Center
                        ) {
                            Text("Натисніть + для першого правила", fontSize = 11.sp, color = Color.White.copy(alpha = 0.3f))
                        }
                    }

                    // Sub-configs section
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Підконфігурації (OR)", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color.White.copy(alpha = 0.6f))
                        SubConfigSelectorDropdown(
                            configs = allConfigs.filter { it.id != config.id && config.subConfigs?.none { s -> s.id == it.id } != false },
                            onSelect = { selected ->
                                val currentSubs = config.subConfigs ?: emptyList()
                                if (currentSubs.none { it.id == selected.id }) {
                                    val updated = config.copy(subConfigs = currentSubs + selected.copy(rules = selected.rules.map { it.copy() }))
                                    onUpdate(updated)
                                    scheduleAutoSave(updated)
                                }
                            }
                        )
                    }

                    val subs = config.subConfigs ?: emptyList()
                    subs.forEachIndexed { idx, sub ->
                        SubConfigCard(
                            index = idx + 1,
                            config = sub,
                            onDelete = {
                                val updated = config.copy(subConfigs = subs.filter { it.id != sub.id })
                                onUpdate(updated)
                                scheduleAutoSave(updated)
                            }
                        )
                    }

                    if (subs.isEmpty()) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(36.dp)
                                .border(1.dp, Color.White.copy(alpha = 0.05f), RoundedCornerShape(10.dp))
                                .background(Color(0xFF14161B), RoundedCornerShape(10.dp)),
                            contentAlignment = Alignment.Center
                        ) {
                            Text("Без підконфігурацій", fontSize = 11.sp, color = Color.White.copy(alpha = 0.3f))
                        }
                    }

                    // Тільки кнопка видалення — без збереження (автозбереження)
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        // Автозбереження-індикатор
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            if (isSaving) {
                                CircularProgressIndicator(
                                    color = Color(0xFF06B6D4),
                                    modifier = Modifier.size(12.dp),
                                    strokeWidth = 1.5.dp
                                )
                                Spacer(Modifier.width(4.dp))
                                Text("Збереження…", fontSize = 10.sp, color = Color(0xFF06B6D4))
                            } else {
                                Text("Автозбереження", fontSize = 10.sp, color = Color.White.copy(alpha = 0.25f))
                            }
                        }
                        IconButton(
                            onClick = onDelete,
                            modifier = Modifier.size(30.dp)
                        ) {
                            Icon(Icons.Outlined.Delete, null, tint = GlassError, modifier = Modifier.size(16.dp))
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun fieldColors() = OutlinedTextFieldDefaults.colors(
    focusedTextColor = Color.White,
    unfocusedTextColor = Color.White,
    focusedBorderColor = Color(0xFF06B6D4),
    unfocusedBorderColor = Color.White.copy(alpha = 0.1f),
    focusedLabelColor = Color(0xFF06B6D4),
    unfocusedLabelColor = Color.White.copy(alpha = 0.4f)
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SubConfigSelectorDropdown(
    configs: List<SavedConfig>,
    onSelect: (SavedConfig) -> Unit
) {
    var expanded by remember { mutableStateOf(false) }

    ExposedDropdownMenuBox(
        expanded = expanded,
        onExpandedChange = { expanded = it }
    ) {
        Box(modifier = Modifier.menuAnchor()) {
            IconButton(
                onClick = { expanded = true },
                modifier = Modifier.size(28.dp)
            ) {
                Icon(Icons.Outlined.Add, null, tint = Color(0xFF06B6D4), modifier = Modifier.size(18.dp))
            }
        }
        ExposedDropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false },
            modifier = Modifier.background(Color(0xFF0A0E1A).copy(alpha = 0.95f))
        ) {
            if (configs.isEmpty()) {
                DropdownMenuItem(
                    text = { Text("Немає доступних", color = Color.White.copy(alpha = 0.4f), fontSize = 12.sp) },
                    onClick = { expanded = false }
                )
            } else {
                configs.forEach { config ->
                    DropdownMenuItem(
                        text = {
                            Column {
                                Text(config.name, color = Color.White, fontSize = 13.sp)
                                Text("${config.rules.size} правил", color = Color.White.copy(alpha = 0.4f), fontSize = 10.sp)
                            }
                        },
                        onClick = { expanded = false; onSelect(config) }
                    )
                }
            }
        }
    }
}

@Composable
private fun SubConfigCard(
    index: Int,
    config: SavedConfig,
    onDelete: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(24.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White.copy(alpha = 0.06f)),
        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.12f))
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 10.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(18.dp)
                    .background(Color(0xFF06B6D4).copy(alpha = 0.2f), CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Text("$index", fontSize = 9.sp, fontWeight = FontWeight.Bold, color = Color(0xFF06B6D4))
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(config.name, fontSize = 12.sp, color = Color.White)
                Text(
                    "${config.rules.size} правил${if (config.enabled) "" else ", ВИМК"}",
                    fontSize = 9.sp,
                    color = if (config.enabled) Color.White.copy(alpha = 0.4f) else Color(0xFFEF4444)
                )
            }
            IconButton(onClick = onDelete, modifier = Modifier.size(28.dp)) {
                Icon(Icons.Outlined.Delete, null, tint = GlassError, modifier = Modifier.size(15.dp))
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun RuleCardVertical(
    index: Int,
    rule: ConfigRule,
    onUpdate: ((ConfigRule) -> ConfigRule) -> Unit,
    onDelete: () -> Unit
) {
    var expanded by remember { mutableStateOf(true) }
    val isPathCompare = rule.rightType == "path"
    val needsValue = rule.operator !in listOf("exists", "not_exists", "read", "read_delete")
    val needsOutputVar = rule.operator in listOf("read", "read_delete")

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(24.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White.copy(alpha = 0.06f)),
        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.12f))
    ) {
        Column(modifier = Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            // Header
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.weight(1f)) {
                    Box(
                        modifier = Modifier
                            .size(20.dp)
                            .background(Color(0xFF06B6D4).copy(alpha = 0.2f), CircleShape),
                        contentAlignment = Alignment.Center
                    ) {
                        Text("$index", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = Color(0xFF06B6D4))
                    }
                    Spacer(Modifier.width(6.dp))
                    Text(
                        text = compactRuleSummary(rule),
                        fontSize = 11.sp,
                        color = Color.White.copy(alpha = 0.7f),
                        modifier = Modifier.weight(1f)
                    )
                }
                Row {
                    // Required toggle
                    val isRequired = rule.required != false
                    TextButton(
                        onClick = { onUpdate { it.copy(required = !isRequired) } },
                        modifier = Modifier.height(28.dp),
                        contentPadding = PaddingValues(horizontal = 6.dp, vertical = 0.dp)
                    ) {
                        Text(
                            text = if (isRequired) "● Обов'яз." else "○ Хоча б",
                            fontSize = 8.sp,
                            color = if (isRequired) Color(0xFFEF4444) else Color(0xFFFFA000),
                            fontWeight = FontWeight.Bold
                        )
                    }
                    IconButton(onClick = { expanded = !expanded }, modifier = Modifier.size(28.dp)) {
                        Icon(
                            if (expanded) Icons.Default.KeyboardArrowUp else Icons.Default.KeyboardArrowDown,
                            null,
                            tint = Color.White.copy(alpha = 0.5f),
                            modifier = Modifier.size(18.dp)
                        )
                    }
                    IconButton(onClick = onDelete, modifier = Modifier.size(28.dp)) {
                        Icon(Icons.Outlined.Delete, null, tint = GlassError, modifier = Modifier.size(15.dp))
                    }
                }
            }

            AnimatedVisibility(visible = expanded, enter = fadeIn(), exit = fadeOut()) {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    // --- Left side (A) ---
                    Text("Ліва частина (A)", fontSize = 9.sp, fontWeight = FontWeight.Bold, color = Color(0xFF06B6D4))
                    FileDropdown(
                        value = rule.file,
                        onChange = { newFile -> onUpdate { it.copy(file = newFile) } }
                    )
                    PathInput(
                        value = rule.path,
                        onChange = { newPath -> onUpdate { it.copy(path = newPath) } },
                        label = "Шлях A"
                    )

                    // --- Operator ---
                    OperatorDropdown(
                        value = rule.operator,
                        onChange = { newOp -> onUpdate { it.copy(operator = newOp) } }
                    )

                    // --- Right type toggle ---
                    if (needsValue) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            ToggleChip(
                                text = "Значення",
                                selected = !isPathCompare,
                                onClick = { onUpdate { it.copy(rightType = "value") } },
                                modifier = Modifier.weight(1f)
                            )
                            ToggleChip(
                                text = "Шлях B",
                                selected = isPathCompare,
                                onClick = { onUpdate { it.copy(rightType = "path", rightFile = rule.file, rightPath = "") } },
                                modifier = Modifier.weight(1f)
                            )
                        }

                        if (isPathCompare) {
                            Text("Права частина (B)", fontSize = 9.sp, fontWeight = FontWeight.Bold, color = Color(0xFF06B6D4))
                            FileDropdown(
                                value = rule.rightFile ?: rule.file,
                                onChange = { newFile -> onUpdate { it.copy(rightFile = newFile) } }
                            )
                            PathInput(
                                value = rule.rightPath ?: "",
                                onChange = { newPath -> onUpdate { it.copy(rightPath = newPath) } },
                                label = "Шлях B"
                            )
                        } else {
                            OutlinedTextField(
                                value = rule.value?.toString() ?: "",
                                onValueChange = { onUpdate { r -> r.copy(value = it) } },
                                label = { Text("Значення B", fontSize = 9.sp) },
                                modifier = Modifier.fillMaxWidth(),
                                colors = fieldColors(),
                                shape = RoundedCornerShape(8.dp),
                                textStyle = androidx.compose.ui.text.TextStyle(fontSize = 12.sp),
                                singleLine = true
                            )
                        }
                    }

                    // --- Output variable ---
                    if (needsOutputVar) {
                        OutlinedTextField(
                            value = rule.outputVar ?: "",
                            onValueChange = { onUpdate { r -> r.copy(outputVar = it) } },
                            label = { Text("Змінна для результату (опціонально)", fontSize = 9.sp) },
                            modifier = Modifier.fillMaxWidth(),
                            colors = fieldColors(),
                            shape = RoundedCornerShape(8.dp),
                            textStyle = androidx.compose.ui.text.TextStyle(fontSize = 12.sp),
                            singleLine = true
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun compactRuleSummary(rule: ConfigRule): String {
    val opLabel = OPERATORS.find { it.first == rule.operator }?.second ?: rule.operator
    val left = rule.path.substringAfterLast(".")
    return if (rule.rightType == "path") {
        val right = rule.rightPath?.substringAfterLast(".") ?: "?"
        "$left $opLabel $right"
    } else {
        "$left $opLabel ${rule.value ?: "?"}"
    }
}

@Composable
private fun ToggleChip(
    text: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .height(30.dp)
            .clickable(onClick = onClick)
            .background(
                if (selected) Color(0xFF06B6D4).copy(alpha = 0.2f) else GlassBg,
                RoundedCornerShape(8.dp)
            )
            .border(
                1.dp,
                if (selected) Color(0xFF06B6D4).copy(alpha = 0.5f) else Color.White.copy(alpha = 0.05f),
                RoundedCornerShape(8.dp)
            ),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text,
            fontSize = 11.sp,
            fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal,
            color = if (selected) Color(0xFF06B6D4) else Color.White.copy(alpha = 0.6f)
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun FileDropdown(
    value: String,
    onChange: (String) -> Unit
) {
    var expanded by remember { mutableStateOf(false) }
    val items = listOf(
        "(save)" to "(save) _save.json",
        "(stats)" to "(stats) _stats.json",
        "custom" to "Інший файл…"
    )
    val isCustom = value != "(save)"

    ExposedDropdownMenuBox(
        expanded = expanded,
        onExpandedChange = { expanded = it }
    ) {
        OutlinedTextField(
            value = if (isCustom) value else items.find { it.first == value }?.second ?: value,
            onValueChange = {
                if (isCustom) onChange(it)
            },
            readOnly = !isCustom,
            label = { Text("Файл", fontSize = 9.sp) },
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded) },
            modifier = Modifier.menuAnchor().fillMaxWidth(),
            colors = fieldColors(),
            shape = RoundedCornerShape(8.dp),
            textStyle = androidx.compose.ui.text.TextStyle(fontSize = 11.sp)
        )
        ExposedDropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false },
            modifier = Modifier.background(Color(0xFF0A0E1A).copy(alpha = 0.95f))
        ) {
            items.forEach { (k, label) ->
                DropdownMenuItem(
                    text = { Text(label, color = Color.White, fontSize = 12.sp) },
                    onClick = {
                        expanded = false
                        if (k == "custom") onChange("") else onChange(k)
                    }
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun OperatorDropdown(
    value: String,
    onChange: (String) -> Unit
) {
    var expanded by remember { mutableStateOf(false) }

    ExposedDropdownMenuBox(
        expanded = expanded,
        onExpandedChange = { expanded = it }
    ) {
        OutlinedTextField(
            value = OPERATORS.find { it.first == value }?.second ?: value,
            onValueChange = {},
            readOnly = true,
            label = { Text("Оператор", fontSize = 9.sp) },
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded) },
            modifier = Modifier.menuAnchor().fillMaxWidth(),
            colors = fieldColors(),
            shape = RoundedCornerShape(8.dp),
            textStyle = androidx.compose.ui.text.TextStyle(fontSize = 12.sp)
        )
        ExposedDropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false },
            modifier = Modifier.background(Color(0xFF0A0E1A).copy(alpha = 0.95f))
        ) {
            OPERATORS.forEach { (op, label) ->
                DropdownMenuItem(
                    text = { Text(label, color = Color.White, fontSize = 12.sp) },
                    onClick = { expanded = false; onChange(op) }
                )
            }
        }
    }
}

@Composable
private fun PathInput(
    value: String,
    onChange: (String) -> Unit,
    label: String
) {
    OutlinedTextField(
        value = value,
        onValueChange = onChange,
        label = { Text(label, fontSize = 9.sp) },
        modifier = Modifier.fillMaxWidth(),
        colors = fieldColors(),
        shape = RoundedCornerShape(8.dp),
        textStyle = androidx.compose.ui.text.TextStyle(
            fontSize = 11.sp,
            fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace,
            color = Color.White
        ),
        singleLine = true
    )
}
