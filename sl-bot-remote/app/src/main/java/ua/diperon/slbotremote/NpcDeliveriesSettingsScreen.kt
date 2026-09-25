package ua.diperon.slbotremote

import android.content.Context
import android.util.Log
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.squareup.moshi.Moshi
import com.squareup.moshi.Types
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import kotlinx.coroutines.launch
import ua.diperon.slbotremote.ui.theme.*

/**
 * Допоміжна функція завантаження каталогу доставок NPC з локального файлу асетів npcDeliveries.json
 */
private fun loadLocalNpcCatalog(context: Context): Map<String, NpcGroup> {
    return try {
        context.assets.open("npcDeliveries.json").use { inputStream ->
            val json = inputStream.bufferedReader().use { it.readText() }
            val moshi = Moshi.Builder().addLast(KotlinJsonAdapterFactory()).build()
            val type = Types.newParameterizedType(Map::class.java, String::class.java, NpcGroup::class.java)
            val adapter = moshi.adapter<Map<String, NpcGroup>>(type)
            adapter.fromJson(json) ?: emptyMap()
        }
    } catch (e: Exception) {
        Log.e("NpcDeliveriesSettings", "Помилка завантаження npcDeliveries.json з асетів", e)
        emptyMap()
    }
}

/**
 * Екран налаштування доставок NPC.
 * Дозволяє обирати NPC, переглядати всі варіанти його доставок з відображенням іконок предметів,
 * налаштовувати статус (пропуск, доставляти, конфігурація з тестуванням) та зберігати для конкретного або всіх проектів.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NpcDeliveriesSettingsScreen(
    apiService: BotApiService,
    onBackClick: () -> Unit,
    initialProjectName: String? = null
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val snackbarHostState = remember { SnackbarHostState() }
    val baseUrl = remember { ConnectionConfigManager(context).getHttpUrl().removeSuffix("/") }

    // Каталог NPC
    var npcCatalog by remember { mutableStateOf<Map<String, NpcGroup>>(emptyMap()) }
    var projects by remember { mutableStateOf<List<String>>(emptyList()) }
    var configs by remember { mutableStateOf<List<SavedConfig>>(emptyList()) }

    // Стан вибору проекту та опції "Для всіх"
    var selectedProject by remember { mutableStateOf(initialProjectName ?: "global") }
    var applyToAll by remember { mutableStateOf(false) }

    // Стан налаштувань: deliveryId -> NpcDeliverySetting
    var settings by remember { mutableStateOf<Map<String, NpcDeliverySetting>>(emptyMap()) }
    var initialSettings by remember { mutableStateOf<Map<String, NpcDeliverySetting>>(emptyMap()) }

    // UI фільтри
    var selectedNpcKey by remember { mutableStateOf("betty") }
    var categoryFilter by remember { mutableStateOf("ALL") } // "ALL", "FLOWER", "COINS", "TICKETS"
    var npcSearchQuery by remember { mutableStateOf("") }
    var variantStatusFilter by remember { mutableStateOf("ALL") } // "ALL", "deliver", "config", "skip"
    var variantSearchQuery by remember { mutableStateOf("") }

    // Стани завантаження
    var isLoading by remember { mutableStateOf(true) }
    var isSaving by remember { mutableStateOf(false) }

    // Результати тестування конфігів: deliveryId -> Pair(passed: Boolean, isTesting: Boolean)
    var testStates by remember { mutableStateOf<Map<String, Pair<Boolean?, Boolean>>>(emptyMap()) }

    // Перевірка наявності незбережених змін
    val hasChanges = remember(settings, initialSettings) {
        settings != initialSettings
    }

    // Завантаження налаштувань для проекту
    val loadSettings = { projName: String ->
        scope.launch {
            try {
                val projParam = if (projName == "global") null else projName
                val resp = apiService.getNpcDeliverySettings(projParam)
                if (resp.success) {
                    settings = resp.settings
                    initialSettings = resp.settings
                }
            } catch (e: Exception) {
                Log.e("NpcDeliveriesSettings", "Помилка завантаження налаштувань: ${e.message}", e)
                snackbarHostState.showSnackbar("Не вдалося завантажити налаштування: ${e.localizedMessage}")
            }
        }
    }

    // Первинне завантаження каталогу, проектів, конфігурацій та налаштувань
    LaunchedEffect(Unit) {
        isLoading = true
        // 1. Спершу підвантажуємо локальний каталог для миттєвого відображення
        val local = loadLocalNpcCatalog(context)
        if (local.isNotEmpty()) {
            npcCatalog = local
            val firstKey = local.keys.firstOrNull { it.equals("betty", ignoreCase = true) } ?: local.keys.firstOrNull() ?: ""
            if (firstKey.isNotBlank()) selectedNpcKey = firstKey
        }

        // 2. Паралельно завантажуємо актуальні дані з бекенду
        try {
            // Каталог доставок
            try {
                val catalogResp = apiService.getNpcDeliveries()
                if (catalogResp.success && catalogResp.data.isNotEmpty()) {
                    npcCatalog = catalogResp.data
                    if (selectedNpcKey.isBlank()) {
                        selectedNpcKey = catalogResp.data.keys.firstOrNull() ?: ""
                    }
                }
            } catch (e: Exception) {
                Log.w("NpcDeliveriesSettings", "Серверний каталог недоступний, використовується локальний: ${e.message}")
            }

            // Список проектів
            try {
                val projs = apiService.getProjects()
                projects = projs
            } catch (e: Exception) {
                Log.w("NpcDeliveriesSettings", "Не вдалося отримати проекти: ${e.message}")
            }

            // Список збережених конфігурацій
            try {
                val cfgResp = apiService.getConfigs()
                if (cfgResp.success) {
                    configs = cfgResp.configs
                }
            } catch (e: Exception) {
                Log.w("NpcDeliveriesSettings", "Не вдалося отримати конфігурації: ${e.message}")
            }

            // Налаштування для обраного проекту
            val projParam = if (selectedProject == "global") null else selectedProject
            val settingsResp = apiService.getNpcDeliverySettings(projParam)
            if (settingsResp.success) {
                settings = settingsResp.settings
                initialSettings = settingsResp.settings
            }
        } catch (e: Exception) {
            Log.e("NpcDeliveriesSettings", "Загальна помилка завантаження: ${e.message}", e)
            snackbarHostState.showSnackbar("Помилка завантаження: ${e.localizedMessage}")
        } finally {
            isLoading = false
        }
    }

    // Зміна проекту
    fun onSelectProject(newProj: String) {
        if (newProj == selectedProject) return
        selectedProject = newProj
        loadSettings(newProj)
    }

    // Збереження налаштувань
    fun saveSettings() {
        scope.launch {
            isSaving = true
            try {
                val projParam = if (selectedProject == "global") null else selectedProject
                val req = SaveNpcDeliverySettingsRequest(
                    projectName = projParam,
                    settings = settings,
                    applyToAll = applyToAll
                )
                val resp = apiService.saveNpcDeliverySettings(req)
                if (resp.success) {
                    initialSettings = HashMap(settings)
                    val msg = if (applyToAll) {
                        "✅ Налаштування збережено та застосовано до всіх проектів!"
                    } else {
                        "✅ Налаштування успішно збережено!"
                    }
                    snackbarHostState.showSnackbar(msg)
                } else {
                    snackbarHostState.showSnackbar("❌ Помилка: ${resp.error ?: "Невідома помилка"}")
                }
            } catch (e: Exception) {
                Log.e("NpcDeliveriesSettings", "Помилка збереження: ${e.message}", e)
                snackbarHostState.showSnackbar("❌ Помилка збереження: ${e.localizedMessage}")
            } finally {
                isSaving = false
            }
        }
    }

    // Тестування конкретного конфігу для доставки
    fun testConfig(deliveryId: String, configId: String) {
        scope.launch {
            testStates = testStates.toMutableMap().also { it[deliveryId] = Pair(null, true) }
            try {
                val targetProj = if (selectedProject == "global") {
                    projects.firstOrNull() ?: "SF1"
                } else {
                    selectedProject
                }
                val resp = apiService.testNpcDeliveryConfig(TestNpcConfigRequest(projectName = targetProj, configId = configId))
                if (resp.success) {
                    testStates = testStates.toMutableMap().also { it[deliveryId] = Pair(resp.passed, false) }
                    val statusText = if (resp.passed) "Пройдено (Доставляти)" else "Провалено (Пропускати)"
                    snackbarHostState.showSnackbar("Результат тесту $configId: $statusText")
                } else {
                    testStates = testStates.toMutableMap().also { it[deliveryId] = Pair(null, false) }
                    snackbarHostState.showSnackbar("❌ Помилка тесту: ${resp.error ?: "Невдача"}")
                }
            } catch (e: Exception) {
                testStates = testStates.toMutableMap().also { it[deliveryId] = Pair(null, false) }
                snackbarHostState.showSnackbar("❌ Помилка тесту: ${e.localizedMessage}")
            }
        }
    }

    // Масове встановлення статусу для поточного NPC
    fun setMassStatusForCurrentNpc(status: String) {
        val currentGroup = npcCatalog.values.firstOrNull {
            it.id.equals(selectedNpcKey, ignoreCase = true) || it.name.equals(selectedNpcKey, ignoreCase = true)
        } ?: return

        val defaultCfgId = configs.firstOrNull()?.id ?: ""
        val updated = settings.toMutableMap()
        for (del in currentGroup.deliveries) {
            val existing = updated[del.id]
            val cfgId = if (status == "config") (existing?.configId ?: defaultCfgId) else null
            updated[del.id] = NpcDeliverySetting(status = status, configId = cfgId)
        }
        settings = updated

        val label = when (status) {
            "deliver" -> "Доставляти"
            "config" -> "Конфігурація"
            else -> "Пропускати"
        }
        scope.launch {
            snackbarHostState.showSnackbar("Всі доставки ${currentGroup.displayName}: $label")
        }
    }

    // Список відфільтрованих NPC
    val filteredNpcList = remember(npcCatalog, categoryFilter, npcSearchQuery) {
        npcCatalog.values.filter { npc ->
            val matchCat = categoryFilter == "ALL" || npc.category.equals(categoryFilter, ignoreCase = true)
            val matchQuery = npcSearchQuery.isBlank() ||
                    npc.name.contains(npcSearchQuery, ignoreCase = true) ||
                    npc.displayName.contains(npcSearchQuery, ignoreCase = true)
            matchCat && matchQuery
        }.sortedBy { it.displayName }
    }

    // Поточний обраний NPC
    val currentNpc = remember(npcCatalog, selectedNpcKey, filteredNpcList) {
        npcCatalog.values.firstOrNull {
            it.id.equals(selectedNpcKey, ignoreCase = true) || it.name.equals(selectedNpcKey, ignoreCase = true)
        } ?: filteredNpcList.firstOrNull() ?: npcCatalog.values.firstOrNull()
    }

    // Список доставок поточного NPC з фільтрацією
    val filteredDeliveries = remember(currentNpc, settings, variantStatusFilter, variantSearchQuery) {
        if (currentNpc == null) return@remember emptyList<NpcDeliveryVariant>()
        currentNpc.deliveries.filter { del ->
            val currentSetting = settings[del.id] ?: NpcDeliverySetting(status = "skip")
            val matchStatus = when (variantStatusFilter) {
                "deliver" -> currentSetting.status == "deliver"
                "config" -> currentSetting.status == "config"
                "skip" -> currentSetting.status == "skip"
                else -> true
            }
            val matchItem = variantSearchQuery.isBlank() || del.items.any {
                it.name.contains(variantSearchQuery, ignoreCase = true)
            }
            matchStatus && matchItem
        }
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            Text("Налаштування NPC", fontWeight = FontWeight.Bold, fontSize = 18.sp)
                            if (hasChanges) {
                                Box(
                                    modifier = Modifier
                                        .size(8.dp)
                                        .background(GlassWarning, CircleShape)
                                )
                            }
                        }
                        Text(
                            text = if (selectedProject == "global") "Глобальні правила (за замовчуванням)" else "Проект: $selectedProject",
                            fontSize = 11.sp,
                            color = Color.White.copy(alpha = 0.6f)
                        )
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Назад")
                    }
                },
                actions = {
                    IconButton(
                        onClick = {
                            selectedProject.let { loadSettings(it) }
                        }
                    ) {
                        Icon(Icons.Default.Refresh, contentDescription = "Оновити")
                    }

                    // Кнопка Зберегти
                    Button(
                        onClick = { saveSettings() },
                        enabled = !isSaving,
                        colors = ButtonDefaults.buttonColors(
                            containerColor = if (hasChanges) GlassSuccess else GlassCardActive,
                            contentColor = Color.White
                        ),
                        shape = RoundedCornerShape(10.dp),
                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                        modifier = Modifier.padding(end = 8.dp)
                    ) {
                        if (isSaving) {
                            CircularProgressIndicator(modifier = Modifier.size(16.dp), color = Color.White, strokeWidth = 2.dp)
                        } else {
                            Icon(Icons.Default.Save, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Зберегти", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = GlassBg.copy(alpha = 0.92f),
                    titleContentColor = Color.White,
                    navigationIconContentColor = Color.White,
                    actionIconContentColor = Color.White
                )
            )
        },
        containerColor = GlassBg
    ) { padding ->
        Column(
            modifier = Modifier
                .padding(padding)
                .fillMaxSize()
        ) {
            // ══════════════════════════════════════════════════════
            // 1. Панель вибору проекту та прапорця "Для всіх"
            // ══════════════════════════════════════════════════════
            ProjectSelectionBar(
                selectedProject = selectedProject,
                projects = projects,
                applyToAll = applyToAll,
                onProjectSelect = { onSelectProject(it) },
                onApplyToAllChange = { applyToAll = it }
            )

            HorizontalDivider(color = GlassBorderSubtle, thickness = 1.dp)

            // ══════════════════════════════════════════════════════
            // 2. Горизонтальний рядок вибору NPC з фільтрами
            // ══════════════════════════════════════════════════════
            NpcSelectionHeader(
                categoryFilter = categoryFilter,
                onCategorySelect = { categoryFilter = it },
                npcSearchQuery = npcSearchQuery,
                onSearchChange = { npcSearchQuery = it }
            )

            NpcHorizontalRow(
                npcs = filteredNpcList,
                selectedNpcKey = currentNpc?.id ?: currentNpc?.name ?: "",
                settings = settings,
                baseUrl = baseUrl,
                onNpcSelect = { npc ->
                    selectedNpcKey = npc.id.ifBlank { npc.name }
                }
            )

            HorizontalDivider(color = GlassBorderSubtle, thickness = 1.dp)

            // ══════════════════════════════════════════════════════
            // 3. Інформаційна картка обраного NPC та масові дії
            // ══════════════════════════════════════════════════════
            if (currentNpc != null) {
                SelectedNpcToolbar(
                    npc = currentNpc,
                    baseUrl = baseUrl,
                    onDeliverAll = { setMassStatusForCurrentNpc("deliver") },
                    onConfigAll = { setMassStatusForCurrentNpc("config") },
                    onSkipAll = { setMassStatusForCurrentNpc("skip") }
                )

                // Фільтр варіантів доставок (статус + пошук предмета)
                VariantFilterBar(
                    statusFilter = variantStatusFilter,
                    onStatusSelect = { variantStatusFilter = it },
                    searchQuery = variantSearchQuery,
                    onSearchChange = { variantSearchQuery = it },
                    totalCount = currentNpc.deliveries.size,
                    filteredCount = filteredDeliveries.size
                )
            }

            // ══════════════════════════════════════════════════════
            // 4. Список варіантів доставок
            // ══════════════════════════════════════════════════════
            if (isLoading && npcCatalog.isEmpty()) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = GlassPrimary)
                }
            } else if (currentNpc == null) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text("NPC не знайдено", color = GlassOnSurfaceVariant)
                }
            } else if (filteredDeliveries.isEmpty()) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text("Немає доставок за обраними фільтрами", color = GlassOnSurfaceVariant)
                }
            } else {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(horizontal = 12.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                    contentPadding = PaddingValues(top = 8.dp, bottom = 24.dp)
                ) {
                    items(filteredDeliveries, key = { it.id }) { delivery ->
                        val currentSetting = settings[delivery.id] ?: NpcDeliverySetting(status = "skip")
                        val testState = testStates[delivery.id]

                        NpcDeliveryVariantCard(
                            delivery = delivery,
                            setting = currentSetting,
                            configs = configs,
                            baseUrl = baseUrl,
                            isTesting = testState?.second == true,
                            testPassed = testState?.first,
                            onStatusChange = { newStatus ->
                                val defaultCfg = configs.firstOrNull()?.id ?: ""
                                val cfgId = if (newStatus == "config") (currentSetting.configId ?: defaultCfg) else null
                                val updated = settings.toMutableMap()
                                updated[delivery.id] = NpcDeliverySetting(status = newStatus, configId = cfgId)
                                settings = updated
                            },
                            onConfigChange = { newCfgId ->
                                val updated = settings.toMutableMap()
                                updated[delivery.id] = NpcDeliverySetting(status = "config", configId = newCfgId)
                                settings = updated
                            },
                            onTestConfig = { cfgId ->
                                testConfig(delivery.id, cfgId)
                            }
                        )
                    }
                }
            }
        }
    }
}

// ══════════════════════════════════════════════════════════════════
// Допоміжні компоненти
// ══════════════════════════════════════════════════════════════════

/**
 * Панель вибору проекту та прапорця "Для всіх"
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ProjectSelectionBar(
    selectedProject: String,
    projects: List<String>,
    applyToAll: Boolean,
    onProjectSelect: (String) -> Unit,
    onApplyToAllChange: (Boolean) -> Unit
) {
    var expanded by remember { mutableStateOf(false) }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(GlassCard)
            .padding(horizontal = 12.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Dropdown вибору проекту
        Box {
            Surface(
                onClick = { expanded = true },
                shape = RoundedCornerShape(8.dp),
                color = GlassCardActive,
                border = BorderStroke(1.dp, GlassBorder)
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Icon(
                        imageVector = if (selectedProject == "global") Icons.Outlined.Public else Icons.Outlined.Folder,
                        contentDescription = null,
                        modifier = Modifier.size(16.dp),
                        tint = if (selectedProject == "global") GlassGem else GlassPrimary
                    )
                    Text(
                        text = if (selectedProject == "global") "Глобально (за замовчуванням)" else selectedProject,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = Color.White
                    )
                    Icon(
                        imageVector = Icons.Default.ArrowDropDown,
                        contentDescription = null,
                        modifier = Modifier.size(16.dp),
                        tint = GlassOnSurfaceVariant
                    )
                }
            }

            DropdownMenu(
                expanded = expanded,
                onDismissRequest = { expanded = false },
                modifier = Modifier.background(Color(0xFF1E293B))
            ) {
                DropdownMenuItem(
                    text = {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Icon(Icons.Outlined.Public, contentDescription = null, tint = GlassGem, modifier = Modifier.size(18.dp))
                            Text("Глобально (за замовчуванням)", color = Color.White)
                        }
                    },
                    onClick = {
                        onProjectSelect("global")
                        expanded = false
                    }
                )
                projects.forEach { proj ->
                    DropdownMenuItem(
                        text = {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                Icon(Icons.Outlined.Folder, contentDescription = null, tint = GlassPrimary, modifier = Modifier.size(18.dp))
                                Text(proj, color = Color.White)
                            }
                        },
                        onClick = {
                            onProjectSelect(proj)
                            expanded = false
                        }
                    )
                }
            }
        }

        // Прапорець "Застосувати для всіх"
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier
                .clip(RoundedCornerShape(6.dp))
                .clickable { onApplyToAllChange(!applyToAll) }
                .padding(horizontal = 4.dp, vertical = 2.dp)
        ) {
            Checkbox(
                checked = applyToAll,
                onCheckedChange = onApplyToAllChange,
                colors = CheckboxDefaults.colors(
                    checkedColor = GlassWarning,
                    uncheckedColor = GlassOnSurfaceVariant,
                    checkmarkColor = Color.Black
                ),
                modifier = Modifier.size(24.dp)
            )
            Spacer(modifier = Modifier.width(6.dp))
            Text(
                text = "Для всіх проектів",
                fontSize = 11.sp,
                color = if (applyToAll) GlassWarning else GlassOnSurfaceVariant,
                fontWeight = if (applyToAll) FontWeight.Bold else FontWeight.Normal
            )
        }
    }
}

/**
 * Фільтри категорій NPC та поле пошуку
 */
@Composable
private fun NpcSelectionHeader(
    categoryFilter: String,
    onCategorySelect: (String) -> Unit,
    npcSearchQuery: String,
    onSearchChange: (String) -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 6.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Категорії: ALL, FLOWER, COINS, TICKETS
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                listOf(
                    "ALL" to "Усі",
                    "FLOWER" to "Flower",
                    "COINS" to "Coins",
                    "TICKETS" to "Tickets"
                ).forEach { (catKey, label) ->
                    val isSelected = categoryFilter.equals(catKey, ignoreCase = true)
                    Surface(
                        onClick = { onCategorySelect(catKey) },
                        shape = RoundedCornerShape(12.dp),
                        color = if (isSelected) GlassPrimary.copy(alpha = 0.2f) else Color.Transparent,
                        border = BorderStroke(1.dp, if (isSelected) GlassPrimary else GlassBorderSubtle)
                    ) {
                        Text(
                            text = label,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                            fontSize = 11.sp,
                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                            color = if (isSelected) GlassPrimary else GlassOnSurfaceVariant
                        )
                    }
                }
            }

            // Поле пошуку NPC
            OutlinedTextField(
                value = npcSearchQuery,
                onValueChange = onSearchChange,
                placeholder = { Text("Пошук NPC...", fontSize = 11.sp, color = GlassOnSurfaceDim) },
                singleLine = true,
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, modifier = Modifier.size(14.dp), tint = GlassOnSurfaceVariant) },
                trailingIcon = {
                    if (npcSearchQuery.isNotEmpty()) {
                        IconButton(onClick = { onSearchChange("") }, modifier = Modifier.size(20.dp)) {
                            Icon(Icons.Default.Close, contentDescription = "Очистити", modifier = Modifier.size(12.dp), tint = GlassOnSurfaceVariant)
                        }
                    }
                },
                modifier = Modifier
                    .width(150.dp)
                    .height(40.dp),
                shape = RoundedCornerShape(16.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = GlassPrimary,
                    unfocusedBorderColor = GlassBorder,
                    focusedTextColor = Color.White,
                    unfocusedTextColor = Color.White,
                    focusedContainerColor = GlassCard,
                    unfocusedContainerColor = GlassCard
                )
            )
        }
    }
}

/**
 * Горизонтальний ряд карток вибору NPC
 */
@Composable
private fun NpcHorizontalRow(
    npcs: List<NpcGroup>,
    selectedNpcKey: String,
    settings: Map<String, NpcDeliverySetting>,
    baseUrl: String,
    onNpcSelect: (NpcGroup) -> Unit
) {
    val context = LocalContext.current

    LazyRow(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        contentPadding = PaddingValues(horizontal = 12.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        items(npcs, key = { it.id.ifBlank { it.name } }) { npc ->
            val isSelected = npc.id.equals(selectedNpcKey, ignoreCase = true) || npc.name.equals(selectedNpcKey, ignoreCase = true)

            // Підрахунок статусів
            var deliverCount = 0
            var configCount = 0
            var skipCount = 0
            for (del in npc.deliveries) {
                when (settings[del.id]?.status) {
                    "deliver" -> deliverCount++
                    "config" -> configCount++
                    else -> skipCount++
                }
            }

            Column(
                modifier = Modifier
                    .width(68.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(if (isSelected) GlassCardActive else GlassCard)
                    .border(
                        width = if (isSelected) 2.dp else 1.dp,
                        color = if (isSelected) GlassPrimary else GlassBorderSubtle,
                        shape = RoundedCornerShape(12.dp)
                    )
                    .clickable { onNpcSelect(npc) }
                    .padding(6.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                // Аватарка NPC
                Box(
                    modifier = Modifier
                        .size(42.dp)
                        .clip(RoundedCornerShape(8.dp))
                        .background(Color.White.copy(alpha = 0.04f)),
                    contentAlignment = Alignment.Center
                ) {
                    val npcIconUrl = remember(npc.icon, baseUrl) {
                        ItemImageResolver.resolveImageUrl(npc.icon, context, baseUrl)
                    }
                    AsyncImage(
                        model = ImageRequest.Builder(context)
                            .data(npcIconUrl)
                            .crossfade(true)
                            .build(),
                        contentDescription = npc.displayName,
                        modifier = Modifier.fillMaxSize(),
                        contentScale = ContentScale.Fit
                    )
                }

                // Ім'я NPC
                Text(
                    text = npc.displayName.ifBlank { npc.name },
                    fontSize = 10.sp,
                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                    color = if (isSelected) Color.White else GlassOnSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )

                // Індикатор статусів: зелена / синя / сіра точки
                Row(
                    horizontalArrangement = Arrangement.spacedBy(2.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    if (deliverCount > 0) {
                        Box(modifier = Modifier.size(5.dp).background(GlassSuccess, CircleShape))
                    }
                    if (configCount > 0) {
                        Box(modifier = Modifier.size(5.dp).background(GlassGem, CircleShape))
                    }
                    if (skipCount > 0) {
                        Box(modifier = Modifier.size(5.dp).background(Color.White.copy(alpha = 0.25f), CircleShape))
                    }
                }
            }
        }
    }
}

/**
 * Інформаційна картка обраного NPC та панель масових дій
 */
@Composable
private fun SelectedNpcToolbar(
    npc: NpcGroup,
    baseUrl: String,
    onDeliverAll: () -> Unit,
    onConfigAll: () -> Unit,
    onSkipAll: () -> Unit
) {
    val context = LocalContext.current

    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 6.dp),
        shape = RoundedCornerShape(12.dp),
        color = GlassCard,
        border = BorderStroke(1.dp, GlassBorder)
    ) {
        Column(
            modifier = Modifier.padding(10.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            // Верхня лінія: інфо про NPC
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .size(36.dp)
                            .clip(RoundedCornerShape(6.dp))
                            .background(Color.White.copy(alpha = 0.05f))
                    ) {
                        val npcUrl = remember(npc.icon, baseUrl) {
                            ItemImageResolver.resolveImageUrl(npc.icon, context, baseUrl)
                        }
                        AsyncImage(
                            model = ImageRequest.Builder(context).data(npcUrl).crossfade(true).build(),
                            contentDescription = npc.displayName,
                            modifier = Modifier.fillMaxSize(),
                            contentScale = ContentScale.Fit
                        )
                    }

                    Column {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            Text(
                                text = npc.displayName.ifBlank { npc.name },
                                fontWeight = FontWeight.Bold,
                                fontSize = 14.sp,
                                color = Color.White
                            )
                            // Категорія badge
                            val catColor = when (npc.category.uppercase()) {
                                "FLOWER" -> GlassGem
                                "COINS" -> GlassWarning
                                "TICKETS" -> GlassBalance
                                else -> GlassPrimary
                            }
                            Text(
                                text = npc.category,
                                fontSize = 9.sp,
                                fontWeight = FontWeight.Bold,
                                color = catColor,
                                modifier = Modifier
                                    .background(catColor.copy(alpha = 0.15f), RoundedCornerShape(4.dp))
                                    .padding(horizontal = 4.dp, vertical = 1.dp)
                            )
                        }
                        Text(
                            text = "Сер. нагорода: ${npc.avgReward} • Сер. собівартість: ${npc.avgCost}",
                            fontSize = 10.sp,
                            color = GlassOnSurfaceVariant
                        )
                    }
                }

                // Кількість варіантів
                Text(
                    text = "${npc.deliveries.size} варіантів",
                    fontSize = 11.sp,
                    color = Color.White.copy(alpha = 0.7f),
                    fontWeight = FontWeight.SemiBold
                )
            }

            // Нижня лінія: кнопки масових дій
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                Button(
                    onClick = onDeliverAll,
                    modifier = Modifier.weight(1f).height(32.dp),
                    shape = RoundedCornerShape(8.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = GlassSuccess.copy(alpha = 0.2f),
                        contentColor = GlassSuccessLight
                    ),
                    contentPadding = PaddingValues(0.dp),
                    border = BorderStroke(1.dp, GlassSuccess.copy(alpha = 0.4f))
                ) {
                    Text("Всі: Доставляти", fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                }

                Button(
                    onClick = onConfigAll,
                    modifier = Modifier.weight(1f).height(32.dp),
                    shape = RoundedCornerShape(8.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = GlassGem.copy(alpha = 0.2f),
                        contentColor = GlassGem
                    ),
                    contentPadding = PaddingValues(0.dp),
                    border = BorderStroke(1.dp, GlassGem.copy(alpha = 0.4f))
                ) {
                    Text("Всі: Конфіг", fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                }

                Button(
                    onClick = onSkipAll,
                    modifier = Modifier.weight(1f).height(32.dp),
                    shape = RoundedCornerShape(8.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color.White.copy(alpha = 0.08f),
                        contentColor = GlassOnSurfaceVariant
                    ),
                    contentPadding = PaddingValues(0.dp),
                    border = BorderStroke(1.dp, GlassBorderSubtle)
                ) {
                    Text("Всі: Пропуск", fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                }
            }
        }
    }
}

/**
 * Фільтри для варіантів доставки (статус та пошук за предметом)
 */
@Composable
private fun VariantFilterBar(
    statusFilter: String,
    onStatusSelect: (String) -> Unit,
    searchQuery: String,
    onSearchChange: (String) -> Unit,
    totalCount: Int,
    filteredCount: Int
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Статусні фільтри
        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            listOf(
                "ALL" to "Всі",
                "deliver" to "Доставляти",
                "config" to "Конфіг",
                "skip" to "Пропуск"
            ).forEach { (st, label) ->
                val isSelected = statusFilter == st
                val activeColor = when (st) {
                    "deliver" -> GlassSuccess
                    "config" -> GlassGem
                    "skip" -> GlassError
                    else -> Color.White
                }
                Surface(
                    onClick = { onStatusSelect(st) },
                    shape = RoundedCornerShape(10.dp),
                    color = if (isSelected) activeColor.copy(alpha = 0.2f) else Color.Transparent,
                    border = BorderStroke(1.dp, if (isSelected) activeColor else GlassBorderSubtle)
                ) {
                    Text(
                        text = label,
                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 3.dp),
                        fontSize = 10.sp,
                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                        color = if (isSelected) activeColor else GlassOnSurfaceVariant
                    )
                }
            }
        }

        // Пошук за предметом
        OutlinedTextField(
            value = searchQuery,
            onValueChange = onSearchChange,
            placeholder = { Text("Пошук предмета...", fontSize = 10.sp, color = GlassOnSurfaceDim) },
            singleLine = true,
            leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, modifier = Modifier.size(12.dp), tint = GlassOnSurfaceVariant) },
            trailingIcon = {
                if (searchQuery.isNotEmpty()) {
                    IconButton(onClick = { onSearchChange("") }, modifier = Modifier.size(16.dp)) {
                        Icon(Icons.Default.Close, contentDescription = null, modifier = Modifier.size(10.dp), tint = GlassOnSurfaceVariant)
                    }
                }
            },
            modifier = Modifier
                .width(140.dp)
                .height(36.dp),
            shape = RoundedCornerShape(12.dp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = GlassGem,
                unfocusedBorderColor = GlassBorderSubtle,
                focusedTextColor = Color.White,
                unfocusedTextColor = Color.White,
                focusedContainerColor = GlassCard,
                unfocusedContainerColor = GlassCard
            )
        )
    }
}

/**
 * Картка одного варіанта доставки NPC.
 * Відображає предмети у вигляді іконок-зображень з кількістю, вартість, винагороду
 * та перемикач статусу (Пропуск / Доставляти / Конфігурація).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun NpcDeliveryVariantCard(
    delivery: NpcDeliveryVariant,
    setting: NpcDeliverySetting,
    configs: List<SavedConfig>,
    baseUrl: String,
    isTesting: Boolean,
    testPassed: Boolean?,
    onStatusChange: (String) -> Unit,
    onConfigChange: (String) -> Unit,
    onTestConfig: (String) -> Unit
) {
    val context = LocalContext.current
    var selectedItemDetail by remember { mutableStateOf<NpcDeliveryCatalogItem?>(null) }
    var configDropdownExpanded by remember { mutableStateOf(false) }

    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        color = GlassCard,
        border = BorderStroke(
            1.dp,
            when (setting.status) {
                "deliver" -> GlassSuccess.copy(alpha = 0.5f)
                "config" -> GlassGem.copy(alpha = 0.5f)
                else -> GlassBorderSubtle
            }
        )
    ) {
        Column(
            modifier = Modifier.padding(10.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            // Верхня лінія: #id, вартість, нагорода
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // ID та собівартість
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Text(
                        text = "#${delivery.id}",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = GlassOnSurfaceVariant
                    )
                    Text(
                        text = "Собівартість: ${delivery.cost}",
                        fontSize = 10.sp,
                        color = Color.White.copy(alpha = 0.6f)
                    )
                }

                // Винагорода
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    val rewardIconUrl = remember(delivery.rewardIcon, baseUrl) {
                        ItemImageResolver.resolveImageUrl(delivery.rewardIcon, context, baseUrl)
                    }
                    AsyncImage(
                        model = ImageRequest.Builder(context).data(rewardIconUrl).crossfade(true).build(),
                        contentDescription = "Reward",
                        modifier = Modifier.size(16.dp),
                        contentScale = ContentScale.Fit
                    )
                    Text(
                        text = delivery.reward,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = GlassWarning
                    )
                }
            }

            // ══════════════════════════════════════════════════════
            // Рядок предметів доставки — ЗОБРАЖЕННЯ, А НЕ НАЗВИ ТЕКСТОМ!
            // ══════════════════════════════════════════════════════
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                delivery.items.forEach { item ->
                    Box(
                        modifier = Modifier
                            .size(52.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .background(Color.White.copy(alpha = 0.05f))
                            .border(1.dp, Color.White.copy(alpha = 0.1f), RoundedCornerShape(8.dp))
                            .clickable { selectedItemDetail = item }
                            .padding(4.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        val itemImgUrl = remember(item.image, item.name, baseUrl) {
                            val imgTarget = item.image.ifBlank { "${item.name}.png" }
                            ItemImageResolver.resolveImageUrl(imgTarget, context, baseUrl)
                        }

                        AsyncImage(
                            model = ImageRequest.Builder(context)
                                .data(itemImgUrl)
                                .crossfade(true)
                                .build(),
                            contentDescription = item.name,
                            modifier = Modifier.size(36.dp),
                            contentScale = ContentScale.Fit
                        )

                        // Бейдж кількості у правому нижньому кутку
                        Box(
                            modifier = Modifier
                                .align(Alignment.BottomEnd)
                                .background(Color.Black.copy(alpha = 0.75f), RoundedCornerShape(4.dp))
                                .padding(horizontal = 3.dp, vertical = 1.dp)
                        ) {
                            val countStr = if (item.amount % 1.0 == 0.0) item.amount.toInt().toString() else item.amount.toString()
                            Text(
                                text = "x$countStr",
                                fontSize = 9.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color.White
                            )
                        }
                    }
                }

                // Додатковий підпис, якщо натиснуто на предмет
                selectedItemDetail?.let { itm ->
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = "${itm.name} (x${if (itm.amount % 1.0 == 0.0) itm.amount.toInt() else itm.amount})",
                        fontSize = 11.sp,
                        color = GlassPrimaryLight,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }

            // ══════════════════════════════════════════════════════
            // 3-позиційний перемикач статусу: Пропуск | Доставляти | Конфігурація
            // ══════════════════════════════════════════════════════
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color.Black.copy(alpha = 0.3f), RoundedCornerShape(8.dp))
                    .padding(3.dp),
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                // Кнопка: Пропуск
                val isSkip = setting.status == "skip"
                Surface(
                    onClick = { onStatusChange("skip") },
                    modifier = Modifier.weight(1f).height(28.dp),
                    shape = RoundedCornerShape(6.dp),
                    color = if (isSkip) GlassErrorDark.copy(alpha = 0.3f) else Color.Transparent,
                    border = BorderStroke(1.dp, if (isSkip) GlassError else Color.Transparent)
                ) {
                    Row(
                        modifier = Modifier.fillMaxSize(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.Center
                    ) {
                        Text(
                            text = "Пропуск",
                            fontSize = 11.sp,
                            fontWeight = if (isSkip) FontWeight.Bold else FontWeight.Normal,
                            color = if (isSkip) GlassError else GlassOnSurfaceVariant
                        )
                    }
                }

                // Кнопка: Доставляти
                val isDeliver = setting.status == "deliver"
                Surface(
                    onClick = { onStatusChange("deliver") },
                    modifier = Modifier.weight(1f).height(28.dp),
                    shape = RoundedCornerShape(6.dp),
                    color = if (isDeliver) GlassSuccess.copy(alpha = 0.3f) else Color.Transparent,
                    border = BorderStroke(1.dp, if (isDeliver) GlassSuccess else Color.Transparent)
                ) {
                    Row(
                        modifier = Modifier.fillMaxSize(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.Center
                    ) {
                        Text(
                            text = "Доставляти",
                            fontSize = 11.sp,
                            fontWeight = if (isDeliver) FontWeight.Bold else FontWeight.Normal,
                            color = if (isDeliver) GlassSuccessLight else GlassOnSurfaceVariant
                        )
                    }
                }

                // Кнопка: Конфігурація
                val isConfig = setting.status == "config"
                Surface(
                    onClick = { onStatusChange("config") },
                    modifier = Modifier.weight(1f).height(28.dp),
                    shape = RoundedCornerShape(6.dp),
                    color = if (isConfig) GlassGem.copy(alpha = 0.3f) else Color.Transparent,
                    border = BorderStroke(1.dp, if (isConfig) GlassGem else Color.Transparent)
                ) {
                    Row(
                        modifier = Modifier.fillMaxSize(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.Center
                    ) {
                        Text(
                            text = "Конфігурація",
                            fontSize = 11.sp,
                            fontWeight = if (isConfig) FontWeight.Bold else FontWeight.Normal,
                            color = if (isConfig) GlassGem else GlassOnSurfaceVariant
                        )
                    }
                }
            }

            // ══════════════════════════════════════════════════════
            // Блок вибору конфігурації та тестування (коли статус == "config")
            // ══════════════════════════════════════════════════════
            AnimatedVisibility(
                visible = setting.status == "config",
                enter = fadeIn(),
                exit = fadeOut()
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(GlassGem.copy(alpha = 0.08f), RoundedCornerShape(8.dp))
                        .border(1.dp, GlassGem.copy(alpha = 0.25f), RoundedCornerShape(8.dp))
                        .padding(8.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        // Випадаючий список доступних конфігурацій
                        Box(modifier = Modifier.weight(1f)) {
                            val activeCfg = configs.firstOrNull { it.id == setting.configId }
                                ?: configs.firstOrNull()

                            Surface(
                                onClick = { configDropdownExpanded = true },
                                shape = RoundedCornerShape(6.dp),
                                color = Color(0xFF1E293B),
                                border = BorderStroke(1.dp, GlassGem.copy(alpha = 0.4f)),
                                modifier = Modifier.fillMaxWidth().height(32.dp)
                            ) {
                                Row(
                                    modifier = Modifier.padding(horizontal = 8.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Text(
                                        text = activeCfg?.name ?: "Оберіть конфіг...",
                                        fontSize = 11.sp,
                                        color = Color.White,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                    Icon(
                                        Icons.Default.ArrowDropDown,
                                        contentDescription = null,
                                        modifier = Modifier.size(16.dp),
                                        tint = GlassGem
                                    )
                                }
                            }

                            DropdownMenu(
                                expanded = configDropdownExpanded,
                                onDismissRequest = { configDropdownExpanded = false },
                                modifier = Modifier.background(Color(0xFF1E293B))
                            ) {
                                if (configs.isEmpty()) {
                                    DropdownMenuItem(
                                        text = { Text("Немає створених конфігів", color = GlassOnSurfaceDim) },
                                        onClick = { configDropdownExpanded = false }
                                    )
                                } else {
                                    configs.forEach { cfg ->
                                        DropdownMenuItem(
                                            text = {
                                                Column {
                                                    Text(cfg.name, color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                                                    Text("${cfg.rules.size} правил", color = GlassOnSurfaceVariant, fontSize = 10.sp)
                                                }
                                            },
                                            onClick = {
                                                onConfigChange(cfg.id)
                                                configDropdownExpanded = false
                                            }
                                        )
                                    }
                                }
                            }
                        }

                        // Кнопка тестування конфігурації
                        Button(
                            onClick = {
                                val targetCfgId = setting.configId ?: configs.firstOrNull()?.id ?: ""
                                if (targetCfgId.isNotBlank()) {
                                    onTestConfig(targetCfgId)
                                }
                            },
                            enabled = !isTesting && configs.isNotEmpty(),
                            modifier = Modifier.height(32.dp),
                            shape = RoundedCornerShape(6.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = GlassGem,
                                contentColor = Color.Black
                            ),
                            contentPadding = PaddingValues(horizontal = 10.dp)
                        ) {
                            if (isTesting) {
                                CircularProgressIndicator(modifier = Modifier.size(14.dp), color = Color.Black, strokeWidth = 2.dp)
                            } else {
                                Icon(Icons.Default.PlayArrow, contentDescription = null, modifier = Modifier.size(14.dp))
                                Spacer(modifier = Modifier.width(2.dp))
                                Text("Тест", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }

                    // Відображення результату тесту (пройдено/провалено)
                    testPassed?.let { passed ->
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            if (passed) {
                                Icon(Icons.Default.CheckCircle, contentDescription = null, tint = GlassSuccess, modifier = Modifier.size(14.dp))
                                Text("Конфіг успішний → Доставляти", fontSize = 10.sp, color = GlassSuccessLight, fontWeight = FontWeight.Bold)
                            } else {
                                Icon(Icons.Default.Cancel, contentDescription = null, tint = GlassError, modifier = Modifier.size(14.dp))
                                Text("Конфіг провальний → Пропускати", fontSize = 10.sp, color = GlassError, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }
        }
    }
}
