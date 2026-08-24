package ua.diperon.slbotremote

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items as gridItems
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import ua.diperon.slbotremote.ui.theme.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import coil.request.ImageRequest
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Helper function to get NPC filename from location name
 */
private val globalNpcNameMap = mapOf(
    "pumpkin' pete" to "pumpkin- pete",
    "old salty" to "old salty"
)

fun getNpcFileName(location: String?): String {
    if (location.isNullOrBlank()) return ""
    val lower = location.lowercase()
    return globalNpcNameMap[lower] ?: lower
}

fun getDeliveryItemsSignature(delivery: Delivery?): String {
    if (delivery == null) return ""
    val items = delivery.items ?: return ""
    return items.entries
        .sortedBy { it.key ?: "" }
        .joinToString(",") { "${it.key ?: ""}:${it.value}" }
}

/**
 * NPC selector item for horizontal NPC filter
 */
@Composable
fun NpcSelectorItem(
    npcName: String,
    npcFileName: String?,
    isSelected: Boolean,
    onClick: () -> Unit
) {
    Column(
        modifier = Modifier
            .width(60.dp)
            .clip(RoundedCornerShape(24.dp))
            .background(
                if (isSelected) GlassWarning else Color.White.copy(alpha = 0.06f)
            )
            .border(
                width = if (isSelected) 2.dp else 1.dp,
                color = if (isSelected) GlassWarning else Color.White.copy(alpha = 0.08f),
                shape = RoundedCornerShape(24.dp)
            )
            .clickable { onClick() }
            .padding(6.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        // NPC image or placeholder
        Box(
            modifier = Modifier
                .size(40.dp)
                .clip(RoundedCornerShape(8.dp))
                .background(GlassBg)
        ) {
            if (npcFileName != null) {
                AsyncImage(
                    model = ImageRequest.Builder(LocalContext.current)
                        .data("file:///android_asset/im/$npcFileName.png")
                        .crossfade(true)
                        .build(),
                    contentDescription = npcName,
                    modifier = Modifier.fillMaxSize(),
                    contentScale = ContentScale.Fit
                )
            } else {
                // "All" placeholder
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "📋",
                        fontSize = 20.sp
                    )
                }
            }
        }

        // NPC name
        Text(
            text = npcName,
            fontSize = 10.sp,
            color = if (isSelected) GlassBg else Color.White,
            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
            maxLines = 1
        )
    }
}

/**
 * Карточка однієї доставки
 */
@OptIn(androidx.compose.foundation.ExperimentalFoundationApi::class)
@Composable
fun AllDeliveriesItemCard(
    delivery: Delivery,
    projectName: String,
    inventoryMap: Map<String, Double>,
    baseUrl: String = "",
    isMarked: Boolean = false,
    onToggleMark: () -> Unit = {}
) {
    // Перевіряємо стан доставки для кольору рамки
    val isCompleted = delivery.completedAt != null
    val hasSufficientResources = remember(delivery, inventoryMap) {
        delivery.items.all { (itemName, requiredAmount) ->
            val clean = itemName.lowercase().trim()
            val available = inventoryMap[clean] ?: inventoryMap[clean.replace(" ", "_")] ?: 0.0
            available >= requiredAmount
        }
    }

    // Колір рамки: фіолетова = відмічена, зелена = виконана, жовта = готова, червона = не вистачає
    val borderColor = when {
        isMarked -> GlassIndigo
        isCompleted -> GlassSuccess
        hasSufficientResources -> GlassWarning
        else -> GlassError
    }

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .aspectRatio(1f)
    ) {
        Card(
            modifier = Modifier
                .fillMaxSize()
                .combinedClickable(
                    onClick = {},
                    onLongClick = onToggleMark
                ),
            shape = RoundedCornerShape(24.dp),
            colors = CardDefaults.cardColors(
                containerColor = if (isMarked) GlassIndigo.copy(alpha = 0.1f) else GlassBg
            ),
            border = BorderStroke(2.dp, borderColor),
            elevation = CardDefaults.cardElevation(defaultElevation = if (isMarked) 8.dp else 4.dp)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(8.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                // Project name badge
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = projectName,
                        style = MaterialTheme.typography.labelSmall,
                        color = if (isMarked) GlassIndigoLight else MaterialTheme.colorScheme.primary,
                        fontWeight = FontWeight.Bold,
                        fontSize = 10.sp
                    )
                    if (isCompleted) {
                        Text(
                            text = "Виконано",
                            style = MaterialTheme.typography.labelSmall,
                            color = GlassSuccess,
                            fontSize = 9.sp,
                            fontWeight = FontWeight.Bold
                        )
                    } else if (hasSufficientResources) {
                        Text(
                            text = "Готово",
                            style = MaterialTheme.typography.labelSmall,
                            color = GlassWarning,
                            fontSize = 9.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }

                // Верхня частина: NPC зліва, предмети справа
                Row(
                    modifier = Modifier.weight(1f),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    // Зображення NPC зліва
                    Box(
                        modifier = Modifier
                            .width(50.dp)
                            .fillMaxHeight()
                            .clip(RoundedCornerShape(8.dp))
                            .background(Color.White.copy(alpha = 0.06f))
                    ) {
                        val npcFile = getNpcFileName(delivery.from)
                        val npcImgUrl = if (baseUrl.isNotBlank()) "$baseUrl/api/im/$npcFile.png" else "file:///android_asset/im/$npcFile.png"
                        AsyncImage(
                            model = ImageRequest.Builder(LocalContext.current)
                                .data(npcImgUrl)
                                .crossfade(true)
                                .build(),
                            contentDescription = delivery.from,
                            modifier = Modifier.fillMaxSize(),
                            contentScale = ContentScale.Fit
                        )
                    }

                    // Предмети для доставки справа
                    Column(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxHeight(),
                        verticalArrangement = Arrangement.spacedBy(2.dp)
                    ) {
                        delivery.items.forEach { (itemName, amount) ->
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                val cleanItem = itemName.lowercase().trim().replace(" ", "_")
                                val itemImgUrl = if (baseUrl.isNotBlank()) "$baseUrl/api/im/$cleanItem.png" else "file:///android_asset/im/$cleanItem.png"
                                // Міні зображення предмета
                                AsyncImage(
                                    model = ImageRequest.Builder(LocalContext.current)
                                        .data(itemImgUrl)
                                        .crossfade(true)
                                        .build(),
                                    contentDescription = itemName,
                                    modifier = Modifier.size(16.dp),
                                    contentScale = ContentScale.Fit
                                )
                                // Кількість: в інвентарі / потрібно
                                val clean = itemName.lowercase().trim()
                                val available = inventoryMap[clean] ?: inventoryMap[clean.replace(" ", "_")] ?: 0.0
                                val textColor = if (available >= amount) GlassSuccess else GlassError
                                val availText = if (available % 1.0 == 0.0) available.toInt().toString() else String.format("%.1f", available)
                                val reqText = if (amount % 1.0 == 0.0) amount.toInt().toString() else String.format("%.1f", amount)
                                Text(
                                    text = "$availText/$reqText",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = textColor,
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                    }
                }

                // Нагорода знизу по центру
                Box(
                    modifier = Modifier.fillMaxWidth(),
                    contentAlignment = Alignment.Center
                ) {
                    Row(
                        horizontalArrangement = Arrangement.Center,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        val reward = delivery.reward
                        val hasReward = (reward?.coins != null && reward.coins > 0) ||
                                        (reward?.sfl != null && reward.sfl > 0)

                        if (hasReward) {
                            reward?.coins?.let { coins ->
                                if (coins > 0) {
                                    Row(
                                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        AsyncImage(
                                            model = ImageRequest.Builder(LocalContext.current)
                                                .data("file:///android_asset/im/coins.png")
                                                .crossfade(true)
                                                .build(),
                                            contentDescription = "Coins",
                                            modifier = Modifier.size(16.dp)
                                        )
                                        Text(
                                            text = coins.toInt().toString(),
                                            style = MaterialTheme.typography.bodySmall,
                                            color = GlassWarning,
                                            fontSize = 11.sp,
                                            fontWeight = FontWeight.Bold
                                        )
                                    }
                                }
                            }
                            reward?.sfl?.let { sfl ->
                                if (sfl > 0) {
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Row(
                                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        AsyncImage(
                                            model = ImageRequest.Builder(LocalContext.current)
                                                .data("file:///android_asset/im/sfl.png")
                                                .crossfade(true)
                                                .build(),
                                            contentDescription = "SFL",
                                            modifier = Modifier.size(16.dp)
                                        )
                                        Text(
                                            text = String.format("%.1f", sfl),
                                            style = MaterialTheme.typography.bodySmall,
                                            color = GlassWarning,
                                            fontSize = 11.sp,
                                            fontWeight = FontWeight.Bold
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }
        } // end Card

        // Значок мітки — верхній правий кут
        if (isMarked) {
            Box(
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .padding(3.dp)
                    .size(16.dp)
                    .background(GlassIndigo, shape = RoundedCornerShape(3.dp)),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "\uD83D\uDCCC",
                    fontSize = 9.sp
                )
            }
        }
    } // end outer Box
}

/**
 * Екран перегляду всіх доставок

 * Дозволяє побачити всі доставки з усіх проектів
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AllDeliveriesScreen(
    apiService: BotApiService,
    onBackClick: () -> Unit
) {
    android.util.Log.d("AllDeliveries", "AllDeliveriesScreen called")
    
    val context = androidx.compose.ui.platform.LocalContext.current
    LaunchedEffect(Unit) {
        android.widget.Toast.makeText(context, "AllDeliveriesScreen opened", android.widget.Toast.LENGTH_SHORT).show()
    }
    
    var allDeliveries by remember { mutableStateOf<Map<String, List<Delivery>>>(emptyMap()) }
    var allInventories by remember { mutableStateOf<Map<String, List<InventoryItem>>>(emptyMap()) }
    var allProjectData by remember { mutableStateOf<Map<String, ProjectData?>>(emptyMap()) }
    var isLoading by remember { mutableStateOf(true) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var selectedNpc by remember { mutableStateOf<String?>(null) }
    // Мітки: projectName → Set<deliveryId>
    var markedDeliveries by remember { mutableStateOf<Map<String, Set<String>>>(emptyMap()) }
    val scope = rememberCoroutineScope()
    val baseUrl = remember { ConnectionConfigManager(context).getHttpUrl().removeSuffix("/") }
    val MARKED_KEY = "__markedDeliveries"

    val loadData = {
        scope.launch {
            android.util.Log.d("AllDeliveries", "loadData called")
            isLoading = true
            errorMessage = null
            try {
                val projectNames = apiService.getProjects()
                android.util.Log.d("AllDeliveries", "Found ${projectNames.size} projects")
                val deliveryMap = mutableMapOf<String, List<Delivery>>()
                val inventoryMap = mutableMapOf<String, List<InventoryItem>>()
                val projectDataMap = mutableMapOf<String, ProjectData?>()
                val markedMap = mutableMapOf<String, Set<String>>()

                for (name in projectNames) {
                    try {
                        val deliveryResponse = apiService.getDeliveries(name)
                        android.util.Log.d("AllDeliveries", "Project $name has ${deliveryResponse.data.size} deliveries")
                        if (deliveryResponse.data.isNotEmpty()) {
                            deliveryMap[name] = deliveryResponse.data
                            // Log delivery item names
                            deliveryResponse.data.forEach { delivery ->
                                android.util.Log.d("AllDeliveries", "Delivery ${delivery.id} items: ${delivery.items.keys}")
                            }
                        }
                    } catch (e: Exception) {
                        android.util.Log.d("AllDeliveries", "Error getting deliveries for $name: ${e.message}")
                        // Skip projects without deliveries
                    }
                    try {
                        val inventoryResponse = apiService.getInventory(name)
                        android.util.Log.d("AllDeliveries", "Project $name has ${inventoryResponse.data.size} inventory items")
                        // Log inventory item names
                        inventoryResponse.data.forEach { item ->
                            android.util.Log.d("AllDeliveries", "Inventory item: image=${item.image}, number=${item.number}")
                        }
                        inventoryMap[name] = inventoryResponse.data
                    } catch (e: Exception) {
                        android.util.Log.d("AllDeliveries", "Error getting inventory for $name: ${e.message}")
                        // Skip projects without inventory
                    }
                    // Завантажуємо мітки для проекту
                    try {
                        val projResponse = apiService.getProject(name)
                        if (projResponse.success && projResponse.data != null) {
                            projectDataMap[name] = projResponse.data
                            val variables = projResponse.data.variables
                            val marked = mutableSetOf<String>()

                            // Зворотна сумісність: масив __markedDeliveries
                            val legacyRaw = variables[MARKED_KEY]
                            if (legacyRaw is List<*>) {
                                marked.addAll(legacyRaw.filterIsInstance<String>())
                            }

                            // Новий формат: "назва": 1 (помічена) або 0 (не помічена)
                            for ((key, value) in variables) {
                                if (key == MARKED_KEY || key.startsWith("__markedItems_")) continue
                                val numVal = when (value) {
                                    is Number -> value.toInt()
                                    is String -> value.toIntOrNull()
                                    is Boolean -> if (value) 1 else 0
                                    else -> null
                                }
                                if (numVal == 1) {
                                    marked.add(key)
                                } else if (numVal == 0) {
                                    marked.remove(key)
                                }
                            }
                            markedMap[name] = marked
                        }
                    } catch (e: Exception) {
                        android.util.Log.d("AllDeliveries", "Error getting project data for $name: ${e.message}")
                    }
                }

                allDeliveries = deliveryMap
                allInventories = inventoryMap
                allProjectData = projectDataMap
                markedDeliveries = markedMap
                android.util.Log.d("AllDeliveries", "Loaded ${deliveryMap.size} projects with deliveries")
                isLoading = false
            } catch (e: Exception) {
                android.util.Log.d("AllDeliveries", "Error in loadData: ${e.message}")
                errorMessage = "Помилка: ${e.message}"
                isLoading = false
            }
        }
    }

    // Зберігає мітки для конкретного проекту на сервер
    fun saveMarkedForProject(projectName: String, markedSet: Set<String>) {
        scope.launch {
            try {
                val projectData = allProjectData[projectName] ?: return@launch
                val nodeData = projectData.nodes.map { n ->
                    mapOf<String, Any>(
                        "id" to n.id,
                        "type" to n.type,
                        "position" to mapOf<String, Any>("x" to n.position.x, "y" to n.position.y),
                        "data" to (n.data as Map<String, Any?>)
                    )
                }
                val edgeData = projectData.edges.map { e ->
                    mutableMapOf<String, Any>(
                        "id" to e.id,
                        "source" to e.source,
                        "target" to e.target,
                        "sourceHandle" to (e.sourceHandle ?: ""),
                        "targetHandle" to (e.targetHandle ?: ""),
                        "type" to "default"
                    )
                }
                val updatedVariables = projectData.variables.toMutableMap()
                updatedVariables.remove(MARKED_KEY)
                val keysToRemove = updatedVariables.keys.filter { it.startsWith("__markedItems_") }
                keysToRemove.forEach { updatedVariables.remove(it) }

                val projectDeliveries = allDeliveries[projectName] ?: emptyList()
                val knownDeliveryNames = mutableSetOf<String>()
                knownDeliveryNames.addAll(markedSet)
                projectDeliveries.forEach { d ->
                    val from = (d.from ?: "").lowercase()
                    knownDeliveryNames.add(getNpcFileName(from))
                    knownDeliveryNames.add(from)
                }
                for ((key, value) in projectData.variables) {
                    if (key == MARKED_KEY || key.startsWith("__markedItems_")) continue
                    val numVal = when (value) {
                        is Number -> value.toInt()
                        is String -> value.toIntOrNull()
                        is Boolean -> if (value) 1 else 0
                        else -> null
                    }
                    if (numVal == 1 || numVal == 0) {
                        knownDeliveryNames.add(key)
                    }
                }

                for (deliveryName in knownDeliveryNames) {
                    if (markedSet.contains(deliveryName)) {
                        updatedVariables[deliveryName] = 1
                        val delivery = projectDeliveries.find { 
                            val from = (it.from ?: "").lowercase()
                            getNpcFileName(from) == deliveryName || from == deliveryName || from.replace(" ", "_") == deliveryName 
                        }
                        val sig = if (delivery != null) {
                            getDeliveryItemsSignature(delivery)
                        } else {
                            projectData.variables["__markedItems_$deliveryName"] as? String ?: ""
                        }
                        if (sig.isNotBlank()) {
                            updatedVariables["__markedItems_$deliveryName"] = sig
                        }
                    } else {
                        updatedVariables[deliveryName] = 0
                    }
                }

                val saveData = mapOf<String, Any>(
                    "nodes" to nodeData,
                    "edges" to edgeData,
                    "variables" to updatedVariables
                )
                apiService.saveProject(ProjectSaveRequest(name = projectName, data = saveData))
                android.util.Log.d("AllDeliveries", "Saved ${markedSet.size} marks for $projectName")
            } catch (e: Exception) {
                android.util.Log.d("AllDeliveries", "Error saving marks for $projectName: ${e.message}")
            }
        }
    }

    // Перемикає мітку доставки та зберігає
    fun toggleMark(projectName: String, deliveryId: String) {
        val currentSet = markedDeliveries[projectName]?.toMutableSet() ?: mutableSetOf()
        if (currentSet.contains(deliveryId)) {
            currentSet.remove(deliveryId)
        } else {
            currentSet.add(deliveryId)
        }
        markedDeliveries = markedDeliveries.toMutableMap().also { it[projectName] = currentSet }
        saveMarkedForProject(projectName, currentSet)
    }

    LaunchedEffect(Unit) {
        loadData()
    }

    // Extract unique NPCs from all deliveries
    val uniqueNpcs = remember(allDeliveries) {
        allDeliveries.values.flatten().map { it.from }.filter { it.isNotBlank() }.distinct().sorted()
    }

    // Показуємо доставки відповідно до логіки фронтенду (усі або вибраний NPC, активні попереду)
    val filteredDeliveries = remember(allDeliveries, selectedNpc) {
        val result = mutableListOf<Pair<String, Delivery>>()
        allDeliveries.forEach { (projectName, deliveries) ->
            deliveries.forEach { delivery ->
                if (selectedNpc == null || delivery.from.equals(selectedNpc, ignoreCase = true)) {
                    result.add(Pair(projectName, delivery))
                }
            }
        }
        // Сортуємо: активні спочатку, завершені в кінці
        result.sortWith { a, b ->
            val aCompleted = a.second.completedAt != null
            val bCompleted = b.second.completedAt != null
            when {
                !aCompleted && bCompleted -> -1
                aCompleted && !bCompleted -> 1
                else -> a.first.compareTo(b.first, ignoreCase = true)
            }
        }
        result
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("Всі Доставки", fontWeight = FontWeight.Bold, fontSize = 18.sp)
                        val totalDeliveries = filteredDeliveries.size
                        if (totalDeliveries > 0) {
                            Text(
                                text = "$totalDeliveries доставок",
                                fontSize = 11.sp,
                                color = Color.White.copy(alpha = 0.5f)
                            )
                        }
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Назад")
                    }
                },
                actions = {
                    IconButton(onClick = { loadData() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Оновити")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = GlassBg.copy(alpha = 0.85f),
                    titleContentColor = Color.White,
                    navigationIconContentColor = Color.White,
                    actionIconContentColor = Color.White
                )
            )
        },
        containerColor = GlassBg
    ) { padding ->
        Column(modifier = Modifier.padding(padding).fillMaxSize()) {
            if (isLoading) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
                }
            } else if (errorMessage != null) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text(errorMessage!!, color = Color.Red, textAlign = TextAlign.Center)
                }
            } else {
                // NPC Selector
                if (uniqueNpcs.isNotEmpty()) {
                    LazyRow(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 12.dp, vertical = 8.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        // "All" option
                        item {
                            NpcSelectorItem(
                                npcName = "Усі",
                                npcFileName = null,
                                isSelected = selectedNpc == null,
                                onClick = { selectedNpc = null }
                            )
                        }
                        // NPC items
                        items(uniqueNpcs, key = { it }) { npcName ->
                            NpcSelectorItem(
                                npcName = npcName,
                                npcFileName = getNpcFileName(npcName),
                                isSelected = selectedNpc == npcName,
                                onClick = { selectedNpc = npcName }
                            )
                        }
                    }
                }

                if (filteredDeliveries.isEmpty()) {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Text(
                            text = if (selectedNpc == null)
                                "Доставок з достатніми ресурсами не знайдено"
                            else
                                "Доставок для $selectedNpc не знайдено",
                            color = Color.White.copy(alpha = 0.5f),
                            textAlign = TextAlign.Center
                        )
                    }
                } else {
                    LazyVerticalGrid(
                    columns = GridCells.Fixed(3),
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(12.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    gridItems(filteredDeliveries, key = { "${it.first}_${it.second.id}" }) { (projectName, delivery) ->
                        val inventoryMap = allInventories[projectName]?.associate {
                            val itemName = it.image.substringAfterLast("/").substringBefore(".")
                            itemName.lowercase() to it.number
                        } ?: emptyMap()

                        AllDeliveriesItemCard(
                            delivery = delivery,
                            projectName = projectName,
                            inventoryMap = inventoryMap,
                            baseUrl = baseUrl,
                            isMarked = markedDeliveries[projectName]?.contains(getNpcFileName(delivery.from)) == true,
                            onToggleMark = { toggleMark(projectName, getNpcFileName(delivery.from)) }
                        )
                    }
                }
            }
        }
    }
}
}
