package ua.diperon.slbotremote

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import coil.compose.AsyncImage
import kotlinx.coroutines.launch
import ua.diperon.slbotremote.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PurchasableBuildingsScreen(
    projectName: String,
    apiService: BotApiService,
    onBackClick: () -> Unit,
    onNavigateToMap: (String, String?) -> Unit
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val configManager = remember { ConnectionConfigManager(context) }
    val baseUrl = remember { configManager.getHttpUrl() }

    var buildings by remember { mutableStateOf<List<ProjectBuildingStatusItem>>(emptyList()) }
    var bumpkinLevel by remember { mutableIntStateOf(1) }
    var coins by remember { mutableDoubleStateOf(0.0) }
    var isLoading by remember { mutableStateOf(true) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var selectedCategory by remember { mutableStateOf("ALL") }

    // Settings state
    var showSettingsDialog by remember { mutableStateOf(false) }
    var catalogItems by remember { mutableStateOf<List<BuildingCatalogItem>>(emptyList()) }
    var isSavingSettings by remember { mutableStateOf(false) }

    fun loadStatus() {
        coroutineScope.launch {
            isLoading = true
            errorMessage = null
            try {
                val res = apiService.getProjectBuildingsStatus(projectName)
                if (res.success) {
                    buildings = res.buildings
                    bumpkinLevel = res.bumpkinLevel
                    coins = res.coins
                } else {
                    errorMessage = res.error ?: "Помилка завантаження даних"
                }
            } catch (e: Exception) {
                errorMessage = e.message ?: "Помилка підключення"
            } finally {
                isLoading = false
            }
        }
    }

    fun openSettings() {
        coroutineScope.launch {
            try {
                val res = apiService.getBuildingsCatalog()
                if (res.success) {
                    catalogItems = res.catalog
                    showSettingsDialog = true
                } else {
                    Toast.makeText(context, res.error ?: "Не вдалося завантажити каталог", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                Toast.makeText(context, e.message ?: "Помилка", Toast.LENGTH_SHORT).show()
            }
        }
    }

    fun saveSettings(updatedCatalog: List<BuildingCatalogItem>) {
        coroutineScope.launch {
            isSavingSettings = true
            try {
                val res = apiService.saveBuildingsCatalog(SaveBuildingsCatalogRequest(updatedCatalog))
                if (res.success) {
                    showSettingsDialog = false
                    Toast.makeText(context, "Налаштування збережено", Toast.LENGTH_SHORT).show()
                    loadStatus()
                } else {
                    Toast.makeText(context, res.message ?: res.error ?: "Помилка збереження", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                Toast.makeText(context, e.message ?: "Помилка збереження", Toast.LENGTH_SHORT).show()
            } finally {
                isSavingSettings = false
            }
        }
    }

    LaunchedEffect(projectName) {
        loadStatus()
    }

    val filteredBuildings = remember(buildings, selectedCategory) {
        buildings.filter {
            when (selectedCategory) {
                "BUILDINGS" -> it.category == "BUILDINGS"
                "BLACKSMITH_ITEMS" -> it.category == "BLACKSMITH_ITEMS"
                else -> true
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("Купівля Будівель", color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                        Text(projectName, color = GlassOnSurfaceVariant, fontSize = 11.sp)
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Назад", tint = Color.White)
                    }
                },
                actions = {
                    IconButton(onClick = { loadStatus() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Оновити", tint = Color.White)
                    }
                    IconButton(onClick = { openSettings() }) {
                        Icon(Icons.Outlined.Settings, contentDescription = "Налаштування", tint = Color(0xFFF59E0B))
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = GlassBg.copy(alpha = 0.9f))
            )
        },
        containerColor = MaterialTheme.colorScheme.background
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            // Метрики (Рівень, Монети)
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp, vertical = 6.dp)
                    .background(Color(0xFF1E293B).copy(alpha = 0.6f), RoundedCornerShape(12.dp))
                    .padding(horizontal = 12.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    Icon(Icons.Outlined.Person, contentDescription = null, tint = Color(0xFF4ADE80), modifier = Modifier.size(16.dp))
                    Text("Рівень: ", color = Color.Gray, fontSize = 12.sp)
                    Text("$bumpkinLevel", color = Color(0xFF4ADE80), fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    Icon(Icons.Outlined.MonetizationOn, contentDescription = null, tint = Color(0xFFFACC15), modifier = Modifier.size(16.dp))
                    Text("Монети: ", color = Color.Gray, fontSize = 12.sp)
                    Text(String.format(java.util.Locale.US, "%,.0f", coins), color = Color(0xFFFACC15), fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
            }

            // Категорії фільтру
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp, vertical = 4.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                FilterChip(
                    selected = selectedCategory == "ALL",
                    onClick = { selectedCategory = "ALL" },
                    label = { Text("Всі (${buildings.size})", fontSize = 11.sp) },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = Color(0xFFF59E0B).copy(alpha = 0.2f),
                        selectedLabelColor = Color(0xFFF59E0B)
                    )
                )
                FilterChip(
                    selected = selectedCategory == "BUILDINGS",
                    onClick = { selectedCategory = "BUILDINGS" },
                    label = { Text("Будівлі (${buildings.count { it.category == "BUILDINGS" }})", fontSize = 11.sp) },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = Color(0xFFF59E0B).copy(alpha = 0.2f),
                        selectedLabelColor = Color(0xFFF59E0B)
                    )
                )
                FilterChip(
                    selected = selectedCategory == "BLACKSMITH_ITEMS",
                    onClick = { selectedCategory = "BLACKSMITH_ITEMS" },
                    label = { Text("Коваль (${buildings.count { it.category == "BLACKSMITH_ITEMS" }})", fontSize = 11.sp) },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = Color(0xFFF59E0B).copy(alpha = 0.2f),
                        selectedLabelColor = Color(0xFFF59E0B)
                    )
                )
            }

            if (isLoading) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = Color(0xFFF59E0B))
                }
            } else if (errorMessage != null) {
                Box(modifier = Modifier.fillMaxSize().padding(16.dp), contentAlignment = Alignment.Center) {
                    Text("Помилка: $errorMessage", color = Color(0xFFEF4444), fontSize = 13.sp)
                }
            } else if (filteredBuildings.isEmpty()) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text("Немає будівель", color = Color.Gray, fontSize = 13.sp)
                }
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(filteredBuildings, key = { it.id }) { item ->
                        BuildingItemCard(
                            item = item,
                            baseUrl = baseUrl,
                            bumpkinLevel = bumpkinLevel,
                            coins = coins,
                            onBuildClick = { onNavigateToMap(projectName, item.name) }
                        )
                    }
                }
            }
        }
    }

    // Діалог налаштувань розмірів та зображень
    if (showSettingsDialog) {
        SettingsCatalogDialog(
            initialCatalog = catalogItems,
            isSaving = isSavingSettings,
            onDismiss = { showSettingsDialog = false },
            onSave = { updated -> saveSettings(updated) }
        )
    }
}

@Composable
fun BuildingItemCard(
    item: ProjectBuildingStatusItem,
    baseUrl: String,
    bumpkinLevel: Int,
    coins: Double,
    onBuildClick: () -> Unit
) {
    val isLevelOk = bumpkinLevel >= item.requiredLevel
    val isCoinsOk = coins >= item.coins

    val cardAlpha = if (item.isPurchased) 0.45f else 1f
    val borderColor = when {
        item.isPurchased -> Color.White.copy(alpha = 0.05f)
        item.canBuild -> Color(0xFFF59E0B).copy(alpha = 0.6f)
        else -> Color.White.copy(alpha = 0.1f)
    }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .alpha(cardAlpha),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFF0F172A).copy(alpha = 0.85f)),
        border = androidx.compose.foundation.BorderStroke(1.dp, borderColor)
    ) {
        Column(modifier = Modifier.padding(10.dp)) {
            Row(verticalAlignment = Alignment.Top) {
                // Картинка будівлі
                Box(
                    modifier = Modifier
                        .size(54.dp)
                        .clip(RoundedCornerShape(8.dp))
                        .background(Color(0xFF020617))
                        .border(1.dp, Color.White.copy(alpha = 0.1f), RoundedCornerShape(8.dp)),
                    contentAlignment = Alignment.Center
                ) {
                    val imgUrl = if (item.image.isNotBlank()) {
                        val cleaned = item.image.removeSuffix(".png")
                        if (baseUrl.isNotBlank()) "$baseUrl/api/im/$cleaned.png" else "file:///android_asset/im/$cleaned.png"
                    } else null

                    if (imgUrl != null) {
                        AsyncImage(
                            model = imgUrl,
                            contentDescription = item.name,
                            modifier = Modifier.fillMaxSize().padding(4.dp),
                            contentScale = ContentScale.Fit
                        )
                    }
                    Text(
                        "${item.width}x${item.height}",
                        modifier = Modifier
                            .align(Alignment.BottomEnd)
                            .background(Color.Black.copy(alpha = 0.6f))
                            .padding(horizontal = 2.dp),
                        color = Color.LightGray,
                        fontSize = 8.sp,
                        fontWeight = FontWeight.Bold
                    )
                }

                Spacer(modifier = Modifier.width(10.dp))

                // Інформація про будівлю
                Column(modifier = Modifier.weight(1f)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(item.name, color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                        if (item.isPurchased) {
                            Text(
                                "✓ Куплено",
                                color = Color(0xFF4ADE80),
                                fontSize = 10.sp,
                                fontWeight = FontWeight.SemiBold,
                                modifier = Modifier
                                    .background(Color(0xFF064E3B).copy(alpha = 0.6f), RoundedCornerShape(4.dp))
                                    .padding(horizontal = 6.dp, vertical = 2.dp)
                            )
                        }
                    }

                    Text(
                        "${if (item.category == "BUILDINGS") "Будівля" else "Коваль"} • Розмір: ${item.width}x${item.height}",
                        color = Color.Gray,
                        fontSize = 10.sp
                    )

                    Spacer(modifier = Modifier.height(4.dp))

                    // Рівень і монети
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text(
                            "Рівень: $bumpkinLevel / ${item.requiredLevel}",
                            color = if (isLevelOk) Color(0xFF4ADE80) else Color(0xFFEF4444),
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Medium
                        )
                        if (item.coins > 0) {
                            Text(
                                "Монети: ${coins.toInt()} / ${item.coins.toInt()}",
                                color = if (isCoinsOk) Color(0xFF4ADE80) else Color(0xFFEF4444),
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Medium
                            )
                        }
                    }

                    // Інгредієнти
                    if (item.ingredients.isNotEmpty()) {
                        Spacer(modifier = Modifier.height(4.dp))
                        Text("Ресурси:", color = Color.LightGray, fontSize = 10.sp)
                        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                            item.ingredients.forEach { (resName, req) ->
                                val userQty = item.userIngredients[resName] ?: 0.0
                                val isResOk = userQty >= req
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .background(
                                            if (isResOk) Color(0xFF064E3B).copy(alpha = 0.2f) else Color(0xFF7F1D1D).copy(alpha = 0.2f),
                                            RoundedCornerShape(4.dp)
                                        )
                                        .padding(horizontal = 4.dp, vertical = 1.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Text(resName, color = if (isResOk) Color(0xFF4ADE80) else Color(0xFFFCA5A5), fontSize = 10.sp)
                                    Text("${userQty.toInt()} / ${req.toInt()}", color = if (isResOk) Color(0xFF4ADE80) else Color(0xFFFCA5A5), fontSize = 10.sp, fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Нижня плашка
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    when {
                        item.isPurchased -> "Будівля вже придбана"
                        item.canBuild -> "✅ Вистачає ресурсів"
                        else -> "❌ Недостатньо ресурсів/рівня"
                    },
                    color = when {
                        item.isPurchased -> Color.Gray
                        item.canBuild -> Color(0xFF4ADE80)
                        else -> Color(0xFFEF4444)
                    },
                    fontSize = 10.sp
                )

                if (!item.isPurchased && item.canBuild) {
                    Button(
                        onClick = onBuildClick,
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFF59E0B)),
                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp),
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier.height(28.dp)
                    ) {
                        Icon(Icons.Outlined.Build, contentDescription = null, tint = Color.Black, modifier = Modifier.size(12.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Построїти", color = Color.Black, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

@Composable
fun SettingsCatalogDialog(
    initialCatalog: List<BuildingCatalogItem>,
    isSaving: Boolean,
    onDismiss: () -> Unit,
    onSave: (List<BuildingCatalogItem>) -> Unit
) {
    val catalogState = remember { mutableStateListOf<BuildingCatalogItem>().apply { addAll(initialCatalog) } }

    Dialog(onDismissRequest = onDismiss) {
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .fillMaxHeight(0.85f),
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = Color(0xFF0B1329))
        ) {
            Column(modifier = Modifier.padding(14.dp)) {
                Text(
                    "Налаштування зображень будівель",
                    color = Color.White,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    "Вкажіть назви файлів зображення для будівлі, категорії та магазину",
                    color = Color.Gray,
                    fontSize = 10.sp
                )

                Spacer(modifier = Modifier.height(8.dp))

                LazyColumn(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    itemsIndexed(catalogState) { idx, item ->
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(Color(0xFF1E293B).copy(alpha = 0.5f), RoundedCornerShape(8.dp))
                                .padding(8.dp)
                        ) {
                            Text(item.name, color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                            Spacer(modifier = Modifier.height(4.dp))

                            OutlinedTextField(
                                value = item.image,
                                onValueChange = { v ->
                                    catalogState[idx] = item.copy(image = v)
                                },
                                label = { Text("Зображення", fontSize = 9.sp) },
                                modifier = Modifier.fillMaxWidth(),
                                textStyle = LocalTextStyle.current.copy(fontSize = 11.sp)
                            )

                            Spacer(modifier = Modifier.height(4.dp))

                            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                OutlinedTextField(
                                    value = item.categoryImage ?: "",
                                    onValueChange = { v ->
                                        catalogState[idx] = item.copy(categoryImage = v)
                                    },
                                    label = { Text("Категорія (img)", fontSize = 9.sp) },
                                    modifier = Modifier.weight(1f),
                                    textStyle = LocalTextStyle.current.copy(fontSize = 11.sp)
                                )
                                OutlinedTextField(
                                    value = item.shopImage ?: "",
                                    onValueChange = { v ->
                                        catalogState[idx] = item.copy(shopImage = v)
                                    },
                                    label = { Text("Магазин (img)", fontSize = 9.sp) },
                                    modifier = Modifier.weight(1f),
                                    textStyle = LocalTextStyle.current.copy(fontSize = 11.sp)
                                )
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    TextButton(onClick = onDismiss) {
                        Text("Скасувати", color = Color.Gray, fontSize = 12.sp)
                    }
                    Spacer(modifier = Modifier.width(8.dp))
                    Button(
                        onClick = { onSave(catalogState.toList()) },
                        enabled = !isSaving,
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFF59E0B))
                    ) {
                        if (isSaving) {
                            CircularProgressIndicator(modifier = Modifier.size(14.dp), color = Color.Black)
                        } else {
                            Text("Зберегти", color = Color.Black, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
    }
}
