package ua.diperon.slbotremote

import android.widget.Toast
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.outlined.*
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import ua.diperon.slbotremote.ui.theme.*
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import kotlinx.coroutines.launch
import kotlin.math.roundToInt

private val DEFAULT_BUILDING_SIZES = mapOf(
    "Tree" to Pair(2, 2), "Water Well" to Pair(2, 2), "Fruit Patch" to Pair(2, 2),
    "Compost Bin" to Pair(2, 2), "Turbo Composter" to Pair(2, 2), "Sunstone Rock" to Pair(2, 2),
    "Crimstone Rock" to Pair(2, 2), "Big Apple" to Pair(2, 2), "Big Orange" to Pair(2, 2),
    "Market" to Pair(3, 2), "Workbench" to Pair(3, 2), "Fire Pit" to Pair(3, 2),
    "Crafting Box" to Pair(3, 2), "Smoothie Shack" to Pair(3, 2), "Aging Shed" to Pair(3, 2),
    "Deli" to Pair(4, 3), "Bakery" to Pair(4, 3), "Hen House" to Pair(4, 3),
    "Kitchen" to Pair(4, 3), "Town Center" to Pair(4, 3), "Fish Market" to Pair(3, 3), "House" to Pair(4, 4),
    "trees" to Pair(2, 2), "crimstones" to Pair(2, 2), "sunstones" to Pair(2, 2), "fruitPatches" to Pair(2, 2),
    "flowerBeds" to Pair(3, 1),
    "Farmer's Monument" to Pair(3, 3), "Squirrel" to Pair(2, 1), "Stone Beetle" to Pair(1, 2)
)

private val IMAGE_MAPPING = mapOf(
    "crops" to "Crop Plot.png", "trees" to "Tree.png", "stones" to "Stone Rock.png",
    "iron" to "Iron Rock.png", "gold" to "Gold Rock.png", "crimstones" to "Crimstone Rock.png",
    "sunstones" to "Sunstone Rock.png", "flowers" to "Flower Bed.png",
    "fruitPatches" to "Fruit Patch.png", "flowerBeds" to "Flower Bed.png", "beehives" to "Beehive.png",
    "Town Center" to "Town Center.png", "Workbench" to "Workbench.png", "Market" to "Market.png",
    "Fire Pit" to "Fire Pit.png", "House" to "House.png", "Compost Bin" to "Compost Bin.png",
    "Kitchen" to "Kitchen.png", "Aging Shed" to "Aging Shed.png", "Water Well" to "Water Well.png",
    "Big Orange" to "Big Orange.png", "Big Apple" to "Big Apple.png",
    "Basic Scarecrow" to "Basic Scarecrow.png", "Fruit Patch" to "Fruit Patch.png",
    "Crimstone Rock" to "Crimstone Rock.png", "Sunstone Rock" to "Sunstone Rock.png"
)

private fun getDefaultSize(name: String): Pair<Int, Int> = DEFAULT_BUILDING_SIZES[name] ?: Pair(1, 1)

private const val GRID_SIZE = 40
private const val OFFSET = 20
private const val CELL = 32f

data class InventoryBuildingAndroid(
    val name: String,
    val count: Int,
    val placedCount: Int,
    val itemType: String, // "building" or "collectible"
    val image: String?,
    val w: Int,
    val h: Int
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun IslandMapScreen(
    projectName: String,
    apiService: BotApiService,
    onBackClick: () -> Unit
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()

    var items by remember { mutableStateOf<List<MapItem>>(emptyList()) }
    // Глобальні налаштування для кожного ТИПУ будівлі
    var buildingTypes by remember { mutableStateOf<MutableMap<String, BuildingTypeConfig>>(mutableMapOf()) }
    var isLoading by remember { mutableStateOf(true) }
    var isSaving by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var inventoryBuildings by remember { mutableStateOf<List<InventoryBuildingAndroid>>(emptyList()) }

    var scale by remember { mutableStateOf(1f) }
    var offset by remember { mutableStateOf(Offset.Zero) }

    var draggingItemId by remember { mutableStateOf<String?>(null) }
    var dragItemOffset by remember { mutableStateOf(Offset.Zero) }

    var placingBuilding by remember { mutableStateOf<InventoryBuildingAndroid?>(null) }

    // Налаштування типу (BottomSheet)
    var settingsTypeName by remember { mutableStateOf<String?>(null) }
    var settingsW by remember { mutableStateOf("1") }
    var settingsH by remember { mutableStateOf("1") }
    var settingsMapImage by remember { mutableStateOf("") }
    var settingsInventoryImage by remember { mutableStateOf("") }
    var settingsInventoryName by remember { mutableStateOf("") }
    val settingsSheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var showSettingsSheet by remember { mutableStateOf(false) }

    fun getTypeConfig(name: String): BuildingTypeConfig {
        return buildingTypes[name] ?: run {
            val (w, h) = getDefaultSize(name)
            BuildingTypeConfig(w = w, h = h)
        }
    }

    fun parseObjects(objData: Map<String, Any>?, category: String, itemType: String, parsed: MutableList<MapItem>) {
        if (objData == null) return
        objData.forEach { (name, arr) ->
            if (arr is List<*>) {
                arr.forEach { itemObj ->
                    if (itemObj is Map<*, *>) {
                        val coordinates = itemObj["coordinates"] as? Map<*, *>
                        val id = itemObj["id"]?.toString() ?: ""
                        if (coordinates != null) {
                            val x = (coordinates["x"] as? Number)?.toInt() ?: 0
                            val y = (coordinates["y"] as? Number)?.toInt() ?: 0
                            val size = getDefaultSize(name)
                            parsed.add(MapItem(
                                id = "${category}_${name}_$id",
                                name = name, type = itemType,
                                x = x, y = y,
                                w = size.first, h = size.second,
                                image = IMAGE_MAPPING[name] ?: "$name.png"
                            ))
                        }
                    }
                }
            }
        }
    }

    suspend fun loadData() {
        isLoading = true; errorMessage = null
        try {
            val saveRes = apiService.getProjectSave(projectName)
            if (!saveRes.success || saveRes.data == null) throw Exception(saveRes.error ?: "Failed to load save data")
            val farm = (saveRes.data["visitedFarmState"] as? Map<String, Any>) ?: saveRes.data

            val parsed = mutableListOf<MapItem>()
            parseObjects(farm["buildings"] as? Map<String, Any>, "buildings", "building", parsed)
            parseObjects(farm["collectibles"] as? Map<String, Any>, "collectibles", "collectible", parsed)

            val gridTypes = listOf("crops", "trees", "stones", "iron", "gold", "crimstones", "sunstones", "fruitPatches", "beehives")
            gridTypes.forEach { type ->
                val typeMap = farm[type] as? Map<String, Any>
                if (typeMap != null) {
                    typeMap.forEach { (id, itemObj) ->
                        if (itemObj is Map<*, *>) {
                            val x = (itemObj["x"] as? Number)?.toInt()
                            val y = (itemObj["y"] as? Number)?.toInt()
                            if (x != null && y != null) {
                                val size = getDefaultSize(type)
                                parsed.add(MapItem(id = "${type}_${type}_$id", name = type, type = type,
                                    x = x, y = y, w = size.first, h = size.second, image = IMAGE_MAPPING[type]))
                            }
                        }
                    }
                }
            }

            val flowerBedsData = (farm["flowers"] as? Map<String, Any>)?.get("flowerBeds") as? Map<String, Any>
            flowerBedsData?.forEach { (id, itemObj) ->
                if (itemObj is Map<*, *>) {
                    val x = (itemObj["x"] as? Number)?.toInt()
                    val y = (itemObj["y"] as? Number)?.toInt()
                    if (x != null && y != null) {
                        parsed.add(MapItem(id = "flowerBeds_flowerBeds_$id", name = "flowerBeds", type = "flowerBeds",
                            x = x, y = y, w = 3, h = 1, image = "Flower Bed.png"))
                    }
                }
            }

            // Завантажуємо layout і buildingTypes
            val savedBuildingTypes = mutableMapOf<String, BuildingTypeConfig>()
            try {
                val layoutRes = apiService.getProjectMap(projectName)
                if (layoutRes.success && layoutRes.data != null) {
                    // Парсимо дані вручну оскільки data: Any?
                    val rawData = layoutRes.data
                    if (rawData is Map<*, *>) {
                        // Новий формат { items, buildingTypes }
                        val rawItems = rawData["items"] as? List<*>
                        val rawBT = rawData["buildingTypes"] as? Map<*, *>
                        rawBT?.forEach { (k, v) ->
                            if (k is String && v is Map<*, *>) {
                                savedBuildingTypes[k] = BuildingTypeConfig(
                                    w = (v["w"] as? Number)?.toInt() ?: 1,
                                    h = (v["h"] as? Number)?.toInt() ?: 1,
                                    mapImage = v["mapImage"] as? String,
                                    inventoryImage = v["inventoryImage"] as? String,
                                    inventoryName = v["inventoryName"] as? String
                                )
                            }
                        }
                        // Застосовуємо позиції з layout та додаємо нові предмети
                        val layoutMap = mutableMapOf<String, Pair<Int, Int>>()
                        val parsedIds = parsed.map { it.id }.toSet()
                        
                        rawItems?.forEach { item ->
                            if (item is Map<*, *>) {
                                val id = item["id"] as? String ?: return@forEach
                                val lx = (item["x"] as? Number)?.toInt() ?: return@forEach
                                val ly = (item["y"] as? Number)?.toInt() ?: return@forEach
                                layoutMap[id] = Pair(lx, ly)
                                
                                if (!parsedIds.contains(id)) {
                                    val name = item["name"] as? String ?: ""
                                    val type = item["type"] as? String ?: ""
                                    val w = (item["w"] as? Number)?.toInt() ?: 1
                                    val h = (item["h"] as? Number)?.toInt() ?: 1
                                    val image = item["image"] as? String
                                    parsed.add(MapItem(id, name, type, lx, ly, w, h, image))
                                }
                            }
                        }
                        for (i in parsed.indices) {
                            val pos = layoutMap[parsed[i].id]
                            if (pos != null) parsed[i] = parsed[i].copy(x = pos.first, y = pos.second)
                        }
                    } else if (rawData is List<*>) {
                        // Старий формат (масив)
                        val layoutMap = rawData.filterIsInstance<MapItem>().associateBy { it.id }
                        for (i in parsed.indices) {
                            val overridden = layoutMap[parsed[i].id]
                            if (overridden != null) parsed[i] = parsed[i].copy(x = overridden.x, y = overridden.y)
                        }
                    }
                }
            } catch (e: Exception) { /* layout не обов'язковий */ }

            // Застосовуємо розміри з buildingTypes
            val typedParsed = parsed.map { item ->
                val cfg = savedBuildingTypes[item.name]
                if (cfg != null) item.copy(w = cfg.w, h = cfg.h) else item
            }

            buildingTypes = savedBuildingTypes
            items = typedParsed

            // Будуємо список інвентаря
            val inventory = farm["inventory"] as? Map<String, Any>
            if (inventory != null) {
                val placedCounts = mutableMapOf<String, Int>()
                val placedTypes = mutableMapOf<String, String>()
                typedParsed.forEach { item ->
                    placedCounts[item.name] = (placedCounts[item.name] ?: 0) + 1
                    placedTypes[item.name] = item.type
                }

                val mapNames = mutableSetOf<String>()
                mapNames.addAll(placedTypes.keys)
                mapNames.addAll(savedBuildingTypes.keys)

                val usedInventoryNames = mutableSetOf<String>()
                savedBuildingTypes.values.forEach { cfg ->
                    cfg.inventoryName?.let { usedInventoryNames.add(it) }
                }

                inventory.keys.forEach { invKey ->
                    if (DEFAULT_BUILDING_SIZES.containsKey(invKey) && !usedInventoryNames.contains(invKey)) {
                        mapNames.add(invKey)
                    }
                }

                val invList = mutableListOf<InventoryBuildingAndroid>()
                mapNames.forEach { mapName ->
                    val cfg = savedBuildingTypes[mapName]
                    val invName = cfg?.inventoryName ?: mapName
                    val count = inventory[invName]?.toString()?.toDoubleOrNull()?.toInt() ?: 0
                    val placed = placedCounts[mapName] ?: 0

                    if (count > 0 || placed > 0) {
                        var itemType = placedTypes[mapName] ?: "building"
                        if (itemType != "building" && itemType != "collectible") {
                            itemType = "resource"
                        }
                        val size = getDefaultSize(mapName)
                        invList.add(InventoryBuildingAndroid(
                            name = mapName, count = count, placedCount = placed,
                            itemType = itemType,
                            image = IMAGE_MAPPING[mapName] ?: "$mapName.png",
                            w = cfg?.w ?: size.first, h = cfg?.h ?: size.second
                        ))
                    }
                }
                // Спочатку будівлі, потім декор, потім ресурси
                inventoryBuildings = invList.sortedWith(compareBy({ 
                    when (it.itemType) {
                        "building" -> 0
                        "collectible" -> 1
                        else -> 2
                    }
                }, { it.name }))
            }

        } catch (e: Exception) {
            errorMessage = e.message ?: "Failed to load map"
        } finally {
            isLoading = false
        }
    }

    LaunchedEffect(projectName) { loadData() }

    // BottomSheet: налаштування типу будівлі
    if (showSettingsSheet && settingsTypeName != null) {
        ModalBottomSheet(
            onDismissRequest = { showSettingsSheet = false },
            sheetState = settingsSheetState,
            containerColor = Color(0xFF1E2030)
        ) {
            Column(modifier = Modifier.padding(16.dp).fillMaxWidth().verticalScroll(rememberScrollState())) {
                Text("⚙️ Тип: ${settingsTypeName}", color = GlassWarning, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                Text("(налаштування для всіх ${settingsTypeName})", color = Color.Gray, fontSize = 11.sp)
                Spacer(modifier = Modifier.height(16.dp))

                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text("Ширина (W)", color = Color.Gray, fontSize = 11.sp)
                        OutlinedTextField(value = settingsW, onValueChange = { settingsW = it },
                            modifier = Modifier.fillMaxWidth(), singleLine = true,
                            colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = Color(0xFFF59E0B), unfocusedBorderColor = Color.Gray, focusedTextColor = Color.White, unfocusedTextColor = Color.White))
                    }
                    Column(modifier = Modifier.weight(1f)) {
                        Text("Висота (H)", color = Color.Gray, fontSize = 11.sp)
                        OutlinedTextField(value = settingsH, onValueChange = { settingsH = it },
                            modifier = Modifier.fillMaxWidth(), singleLine = true,
                            colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = Color(0xFFF59E0B), unfocusedBorderColor = Color.Gray, focusedTextColor = Color.White, unfocusedTextColor = Color.White))
                    }
                }
                Spacer(modifier = Modifier.height(8.dp))

                Text("Зображення на карті (mapImage)", color = Color.Gray, fontSize = 11.sp)
                OutlinedTextField(value = settingsMapImage, onValueChange = { settingsMapImage = it },
                    placeholder = { Text("напр. Workbench.png", color = Color.Gray, fontSize = 12.sp) },
                    modifier = Modifier.fillMaxWidth(), singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = Color(0xFFF59E0B), unfocusedBorderColor = Color.Gray, focusedTextColor = Color.White, unfocusedTextColor = Color.White))
                Spacer(modifier = Modifier.height(8.dp))

                Text("назва для Алгоритм розміщення (кроки 2)", color = Color.Gray, fontSize = 11.sp)
                OutlinedTextField(value = settingsInventoryImage, onValueChange = { settingsInventoryImage = it },
                    placeholder = { Text("напр. workbench (src=)", color = Color.Gray, fontSize = 12.sp) },
                    modifier = Modifier.fillMaxWidth(), singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = Color(0xFFF59E0B), unfocusedBorderColor = Color.Gray, focusedTextColor = Color.White, unfocusedTextColor = Color.White))
                Spacer(modifier = Modifier.height(8.dp))

                Text("Назва в інвентарі (як у farm.inventory)", color = Color.Gray, fontSize = 11.sp)
                OutlinedTextField(value = settingsInventoryName, onValueChange = { settingsInventoryName = it },
                    placeholder = { Text("напр. Workbench (якщо інша)", color = Color.Gray, fontSize = 12.sp) },
                    modifier = Modifier.fillMaxWidth(), singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = Color(0xFFF59E0B), unfocusedBorderColor = Color.Gray, focusedTextColor = Color.White, unfocusedTextColor = Color.White))
                Spacer(modifier = Modifier.height(16.dp))

                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(onClick = { showSettingsSheet = false }, modifier = Modifier.weight(1f)) {
                        Text("Скасувати", color = Color.Gray)
                    }
                    Button(
                        onClick = {
                            val typeName = settingsTypeName ?: return@Button
                            val newW = settingsW.toIntOrNull()?.coerceAtLeast(1) ?: 1
                            val newH = settingsH.toIntOrNull()?.coerceAtLeast(1) ?: 1
                            val newCfg = BuildingTypeConfig(
                                w = newW, h = newH,
                                mapImage = settingsMapImage.ifBlank { null },
                                inventoryImage = settingsInventoryImage.ifBlank { null },
                                inventoryName = settingsInventoryName.ifBlank { null }
                            )
                            buildingTypes = (buildingTypes + mapOf(typeName to newCfg)).toMutableMap()
                            // Оновлюємо розміри всіх items цього типу
                            items = items.map { if (it.name == typeName) it.copy(w = newW, h = newH) else it }
                            showSettingsSheet = false
                        },
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(containerColor = GlassWarning)
                    ) { Text("Зберегти", color = Color.Black, fontWeight = FontWeight.Bold) }
                }
                Spacer(modifier = Modifier.height(24.dp))
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Карта: $projectName") },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = GlassBg.copy(alpha = 0.85f)),
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    if (placingBuilding != null) {
                        TextButton(onClick = { placingBuilding = null }) {
                            Icon(Icons.Default.Close, contentDescription = null, tint = GlassWarning, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("${placingBuilding!!.name}", color = GlassWarning, fontSize = 12.sp)
                        }
                    }
                    IconButton(onClick = { coroutineScope.launch { loadData() } }, enabled = !isLoading && !isSaving) {
                        Icon(Icons.Default.Refresh, contentDescription = "Refresh")
                    }
                    Button(onClick = {
                        coroutineScope.launch {
                            isSaving = true
                            try {
                                val res = apiService.deleteProjectMap(projectName)
                                if (!res.success) throw Exception(res.message ?: "Failed")
                                Toast.makeText(context, "Скинуто!", Toast.LENGTH_SHORT).show()
                                loadData()
                            } catch (e: Exception) {
                                Toast.makeText(context, "Помилка скидання", Toast.LENGTH_SHORT).show()
                            } finally { isSaving = false }
                        }
                    }, colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFD97706)),
                        enabled = !isLoading && !isSaving, modifier = Modifier.padding(end = 4.dp)) {
                        Text("Скинути", fontSize = 12.sp)
                    }
                    Button(onClick = {
                        coroutineScope.launch {
                            isSaving = true
                            try {
                                val layout = LayoutData(items = items, buildingTypes = buildingTypes)
                                val res = apiService.saveProjectMap(projectName, layout)
                                if (!res.success) throw Exception(res.message ?: "Failed")
                                Toast.makeText(context, "Збережено!", Toast.LENGTH_SHORT).show()
                            } catch (e: Exception) {
                                Toast.makeText(context, "Помилка збереження", Toast.LENGTH_SHORT).show()
                            } finally { isSaving = false }
                        }
                    }, colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF16A34A)),
                        enabled = !isLoading && !isSaving, modifier = Modifier.padding(end = 8.dp)) {
                        Text(if (isSaving) "..." else "Зберегти", fontSize = 12.sp)
                    }
                }
            )
        }
    ) { paddingValues ->
        Column(modifier = Modifier.fillMaxSize().padding(paddingValues).background(Color(0xFF1A1C23))) {

            // Панель інвентаря (будівлі, потім декор)
            if (!isLoading && inventoryBuildings.isNotEmpty()) {
                Column(modifier = Modifier.background(Color(0xFF131520)).fillMaxWidth()) {
                    Row(modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Outlined.Add, contentDescription = null, tint = GlassWarning, modifier = Modifier.size(14.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(if (placingBuilding != null) "Клікни на карту: ${placingBuilding!!.name}" else "З інвентаря:",
                            color = GlassWarning, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }

                    // Спочатку будівлі, потім декор — розділені підзаголовками
                    val buildingGroup = inventoryBuildings.filter { it.itemType == "building" }
                    val collectibleGroup = inventoryBuildings.filter { it.itemType == "collectible" }
                    val resourceGroup = inventoryBuildings.filter { it.itemType == "resource" }

                    listOf("🏗️ Будівлі" to buildingGroup, "🎨 Декор" to collectibleGroup, "📦 Ресурси" to resourceGroup).forEach { (label, group) ->
                        if (group.isEmpty()) return@forEach
                        Text(label, color = GlassOnSurfaceVariant, fontSize = 10.sp,
                            modifier = Modifier.padding(start = 12.dp, top = 2.dp))
                        val configManager = remember { ConnectionConfigManager(context) }
                        val baseUrl = remember { configManager.getHttpUrl() }
                        LazyRow(modifier = Modifier.padding(horizontal = 8.dp).padding(bottom = 4.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            items(group) { b ->
                                val isActive = placingBuilding?.name == b.name
                                val available = b.count - b.placedCount
                                val canPlace = available > 0
                                OutlinedButton(
                                    onClick = { if (canPlace) placingBuilding = if (isActive) null else b },
                                    border = androidx.compose.foundation.BorderStroke(1.dp, if (isActive) GlassWarning else if (!canPlace) Color.DarkGray else Color(0xFF4B5563)),
                                    colors = ButtonDefaults.outlinedButtonColors(containerColor = if (isActive) GlassWarning.copy(alpha = 0.15f) else Color.Transparent),
                                    contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp),
                                    modifier = Modifier.then(if (!canPlace) Modifier.alpha(0.5f) else Modifier)
                                ) {
                                    if (b.image != null) {
                                        AsyncImage(model = "$baseUrl/api/im/${b.image}", contentDescription = b.name,
                                            modifier = Modifier.size(18.dp), contentScale = ContentScale.Fit)
                                        Spacer(modifier = Modifier.width(4.dp))
                                    }
                                    Column {
                                        Text(b.name, color = Color.White, fontSize = 10.sp, fontWeight = FontWeight.Medium)
                                        Text(if (canPlace) "+$available" else "Розміщені", color = if (canPlace) Color(0xFF4ADE80) else Color.Gray, fontSize = 9.sp)
                                    }
                                }
                            }
                        }
                    }
                    Spacer(modifier = Modifier.height(4.dp))
                }
            }

            // Карта
            Box(modifier = Modifier.fillMaxSize()
                .pointerInput(Unit) {
                    detectTransformGestures { _, pan, zoom, _ ->
                        if (draggingItemId == null) {
                            scale = (scale * zoom).coerceIn(0.1f, 5f)
                            offset += pan
                        }
                    }
                }
            ) {
                if (isLoading) {
                    CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))
                } else if (errorMessage != null) {
                    Text(text = errorMessage ?: "Unknown error", color = Color.White,
                        modifier = Modifier.align(Alignment.Center).background(GlassError.copy(alpha = 0.5f)).padding(16.dp))
                } else {
                    val density = androidx.compose.ui.platform.LocalDensity.current
                    val cellPx = with(density) { 32.dp.toPx() }

                    Box(modifier = Modifier
                        .graphicsLayer(scaleX = scale, scaleY = scale, translationX = offset.x, translationY = offset.y)
                        .size((GRID_SIZE * 32).dp)
                        .then(if (placingBuilding != null) Modifier.pointerInput(placingBuilding) {
                            detectTapGestures { tapOffset ->
                                val newGameX = (tapOffset.x / cellPx).roundToInt() - OFFSET
                                val newGameY = OFFSET - (tapOffset.y / cellPx).roundToInt()
                                val b = placingBuilding ?: return@detectTapGestures
                                val newItem = MapItem(
                                    id = "buildings_${b.name}_inv_${System.currentTimeMillis()}",
                                    name = b.name, type = b.itemType,
                                    x = newGameX, y = newGameY,
                                    w = b.w, h = b.h,
                                    image = b.image
                                )
                                items = items + newItem
                                placingBuilding = null
                            }
                        } else Modifier)
                    ) {
                        Canvas(modifier = Modifier.fillMaxSize()) {
                            val w = size.width; val h = size.height
                            drawRect(color = Color.Black.copy(alpha = 0.4f), size = size)
                            for (i in 0..GRID_SIZE) {
                                drawLine(Color.White.copy(alpha = 0.1f), start = Offset(i * cellPx, 0f), end = Offset(i * cellPx, h), strokeWidth = 1f)
                                drawLine(Color.White.copy(alpha = 0.1f), start = Offset(0f, i * cellPx), end = Offset(w, i * cellPx), strokeWidth = 1f)
                            }
                        }

                        items.forEach { item ->
                            val cfg = buildingTypes[item.name]
                            val imgName = cfg?.mapImage ?: item.image
                            val isDragging = item.id == draggingItemId
                            val pixelLeft = if (isDragging) dragItemOffset.x else (item.x + OFFSET) * cellPx
                            val pixelTop = if (isDragging) dragItemOffset.y else (OFFSET - item.y) * cellPx
                            val configManager = remember { ConnectionConfigManager(context) }
                            val baseUrl = remember { configManager.getHttpUrl() }

                            Box(modifier = Modifier
                                .offset { IntOffset(pixelLeft.roundToInt(), pixelTop.roundToInt()) }
                                .size((item.w * 32).dp, (item.h * 32).dp)
                                .border(1.dp, if (isDragging) Color.White.copy(alpha = 0.6f) else Color.White.copy(alpha = 0.3f), RoundedCornerShape(2.dp))
                                .background(Color.Black.copy(alpha = 0.25f))
                                .then(if (placingBuilding == null) Modifier
                                    .pointerInput(item.id) {
                                        detectTapGestures(onLongPress = {
                                            settingsTypeName = item.name
                                            val existCfg = buildingTypes[item.name]
                                            settingsW = (existCfg?.w ?: item.w).toString()
                                            settingsH = (existCfg?.h ?: item.h).toString()
                                            settingsMapImage = existCfg?.mapImage ?: ""
                                            settingsInventoryImage = existCfg?.inventoryImage ?: ""
                                            settingsInventoryName = existCfg?.inventoryName ?: ""
                                            showSettingsSheet = true
                                        })
                                    }
                                    .pointerInput(item.id) {
                                        detectDragGestures(
                                            onDragStart = { _ ->
                                                draggingItemId = item.id
                                                dragItemOffset = Offset((item.x + OFFSET) * cellPx, (OFFSET - item.y) * cellPx)
                                            },
                                            onDrag = { change, dragAmount ->
                                                change.consume()
                                                dragItemOffset += dragAmount
                                            },
                                            onDragEnd = {
                                                val newX = (dragItemOffset.x / cellPx).roundToInt() - OFFSET
                                                val newY = OFFSET - (dragItemOffset.y / cellPx).roundToInt()
                                                items = items.map { if (it.id == item.id) it.copy(x = newX, y = newY) else it }
                                                draggingItemId = null
                                            },
                                            onDragCancel = { draggingItemId = null }
                                        )
                                    }
                                else Modifier)
                            ) {
                                if (imgName != null) {
                                    AsyncImage(model = "$baseUrl/api/im/$imgName", contentDescription = item.name,
                                        modifier = Modifier.fillMaxSize(), contentScale = ContentScale.Fit)
                                } else {
                                    val bgColor = when (item.type) {
                                        "crops" -> Color(0xFFB45309).copy(alpha = 0.7f)
                                        "trees" -> Color(0xFF15803D).copy(alpha = 0.7f)
                                        "building" -> Color(0xFF1D4ED8).copy(alpha = 0.7f)
                                        else -> Color(0xFF7E22CE).copy(alpha = 0.7f)
                                    }
                                    Box(modifier = Modifier.fillMaxSize().background(bgColor), contentAlignment = Alignment.Center) {
                                        Text(text = item.name, color = Color.White, fontSize = 6.sp, fontWeight = FontWeight.Bold)
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
