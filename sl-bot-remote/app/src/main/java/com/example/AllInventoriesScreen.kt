package com.example

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Refresh
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
import kotlinx.coroutines.launch

/**
 * Екран перегляду всіх інвентарів
 * Показує матрицю: рядки = проекти, стовпці = ресурси
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AllInventoriesScreen(
    apiService: BotApiService,
    onBackClick: () -> Unit
) {
    var allInventories by remember { mutableStateOf<Map<String, List<InventoryItem>>>(emptyMap()) }
    var allResources by remember { mutableStateOf<List<String>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    // Отримуємо базовий URL з конфігурації
    val baseUrl = remember { ConnectionConfigManager(context).getHttpUrl().removeSuffix("/") }

    // Функція завантаження всіх інвентарів
    val loadAllInventories: () -> Unit = {
        scope.launch {
            isLoading = true
            errorMessage = null

            try {
                // Отримуємо список всіх проектів
                val projectNames = apiService.getProjects()

                // Завантажуємо інвентарі для кожного проекту
                val inventories = mutableMapOf<String, List<InventoryItem>>()
                val resourcesSet = mutableSetOf<String>()

                for (projectName in projectNames) {
                    try {
                        val inventory = apiService.getInventory(projectName)
                        if (inventory.data.isNotEmpty()) {
                            inventories[projectName] = inventory.data
                            // Збираємо всі унікальні ресурси
                            inventory.data.forEach { item ->
                                resourcesSet.add(item.image)
                            }
                        }
                    } catch (e: Exception) {
                        // Пропускаємо проекти без інвентаря
                        android.util.Log.d("AllInventoriesScreen", "No inventory for $projectName")
                    }
                }

                allInventories = inventories
                allResources = resourcesSet.toList().sorted()
                isLoading = false

            } catch (e: Exception) {
                errorMessage = "Помилка завантаження: ${e.message}"
                isLoading = false
                android.util.Log.e("AllInventoriesScreen", "Failed to load inventories", e)
            }
        }
    }

    // Завантаження при першому відкритті
    LaunchedEffect(Unit) {
        loadAllInventories()
    }

    Scaffold(
        topBar = {
            TopAppBar(
                modifier = androidx.compose.ui.Modifier.height(42.dp),
                
                title = {
                    Column {
                        Text(
                            text = "Всі Інвентарі",
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Bold
                        )
                        if (!isLoading && allInventories.isNotEmpty()) {
                            Text(
                                text = "${allInventories.size} акаунтів • ${allResources.size} ресурсів",
                                fontSize = 12.sp,
                                color = Color(0xFF94A3B8)
                            )
                        }
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(
                            imageVector = Icons.Default.ArrowBack,
                            contentDescription = "Назад"
                        )
                    }
                },
                actions = {
                    IconButton(onClick = loadAllInventories) {
                        Icon(
                            imageVector = Icons.Default.Refresh,
                            contentDescription = "Оновити"
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Color(0xFF0F172A),
                    titleContentColor = Color.White,
                    navigationIconContentColor = Color.White,
                    actionIconContentColor = Color.White
                )
            )
        },
        containerColor = Color(0xFF0F172A)
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            when {
                // Завантаження
                isLoading -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.Center
                        ) {
                            CircularProgressIndicator(
                                color = Color(0xFF4F46E5)
                            )
                            Spacer(modifier = Modifier.height(16.dp))
                            Text(
                                text = "Завантаження інвентарів...",
                                color = Color(0xFF94A3B8),
                                fontSize = 14.sp
                            )
                        }
                    }
                }

                // Помилка
                errorMessage != null -> {
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(32.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center
                    ) {
                        Text(
                            text = "❌",
                            fontSize = 64.sp
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(
                            text = errorMessage!!,
                            color = Color(0xFFEF4444),
                            fontSize = 16.sp,
                            textAlign = TextAlign.Center
                        )
                        Spacer(modifier = Modifier.height(24.dp))
                        Button(
                            onClick = loadAllInventories,
                            colors = ButtonDefaults.buttonColors(
                                containerColor = Color(0xFF4F46E5)
                            )
                        ) {
                            Text("Спробувати знову")
                        }
                    }
                }

                // Порожньо
                allInventories.isEmpty() -> {
                    Column(
                        modifier = Modifier.fillMaxSize(),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center
                    ) {
                        Text(
                            text = "📦",
                            fontSize = 64.sp
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(
                            text = "Немає інвентарів",
                            color = Color(0xFF94A3B8),
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "Запустіть боти з нодою сканування інвентаря",
                            color = Color(0xFF64748B),
                            fontSize = 14.sp,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.padding(horizontal = 32.dp)
                        )
                    }
                }

                // Таблиця інвентарів
                else -> {
                    InventoryMatrix(
                        inventories = allInventories,
                        resources = allResources,
                        baseUrl = baseUrl
                    )
                }
            }
        }
    }
}

/**
 * Матриця інвентарів з горизонтальним та вертикальним скролом
 */
@Composable
fun InventoryMatrix(
    inventories: Map<String, List<InventoryItem>>,
    resources: List<String>,
    baseUrl: String
) {
    val context = LocalContext.current
    val horizontalScrollState = rememberScrollState()
    val verticalScrollState = rememberScrollState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(8.dp)
    ) {
        // Заголовок з ресурсами (зафіксований зверху, скролиться горизонтально)
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(horizontalScrollState)
        ) {
            // Порожня комірка для імен проектів
            Box(
                modifier = Modifier
                    .width(80.dp)
                    .height(36.dp)
                    .background(Color(0xFF1E293B))
                    .border(1.dp, Color(0xFF334155))
                    .padding(4.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "Акаунт / Ресурс",
                    color = Color(0xFF94A3B8),
                    fontSize = 8.sp,
                    fontWeight = FontWeight.Bold,
                    textAlign = TextAlign.Center
                )
            }

            // Заголовки ресурсів з зображеннями
            resources.forEach { resource ->
                ResourceHeaderCell(resource, baseUrl, context)
            }
        }

        Spacer(modifier = Modifier.height(1.dp))

        // Рядки з даними (скролиться вертикально та горизонтально)
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(verticalScrollState)
        ) {
            inventories.forEach { (projectName, items) ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(horizontalScrollState)
                ) {
                    // Ім'я проекту (зафіксоване зліва)
                    Box(
                        modifier = Modifier
                            .width(80.dp)
                            .height(28.dp)
                            .background(Color(0xFF1E293B))
                            .border(1.dp, Color(0xFF334155))
                            .padding(4.dp),
                        contentAlignment = Alignment.CenterStart
                    ) {
                        Text(
                            text = projectName,
                            color = Color.White,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis
                        )
                    }

                    // Комірки з кількістю
                    resources.forEach { resource ->
                        val item = items.find { it.image == resource }
                        InventoryCell(item)
                    }
                }
            }
        }
    }
}

/**
 * Комірка заголовка ресурсу з зображенням
 */
@Composable
fun ResourceHeaderCell(resource: String, baseUrl: String, context: android.content.Context) {
    // Формуємо повний URL для зображення
    val imageUrl = remember(resource) {
        when {
            resource.startsWith("data:") -> resource
            resource.startsWith("http://") || resource.startsWith("https://") -> resource
            else -> "$baseUrl$resource"
        }
    }

    Box(
        modifier = Modifier
            .width(28.dp)
            .height(36.dp)
            .background(Color(0xFF1E293B))
            .border(1.dp, Color(0xFF334155))
            .padding(2.dp),
        contentAlignment = Alignment.Center
    ) {
        AsyncImage(
            model = ImageRequest.Builder(context)
                .data(imageUrl)
                .crossfade(true)
                .allowHardware(false)
                .build(),
            contentDescription = "Resource",
            contentScale = ContentScale.Fit,
            modifier = Modifier.fillMaxSize()
        )
    }
}

/**
 * Комірка з кількістю ресурсу
 */
@Composable
fun InventoryCell(item: InventoryItem?) {
    Box(
        modifier = Modifier
            .width(28.dp)
            .height(28.dp)
            .background(
                if (item != null) Color(0xFF1E293B) else Color(0xFF0F172A)
            )
            .border(
                width = 1.dp,
                color = if (item != null) Color(0xFF334155) else Color(0xFF1E293B)
            )
            .padding(1.dp),
        contentAlignment = Alignment.Center
    ) {
        if (item != null) {
            Text(
                text = when {
                    item.number >= 1000 -> "${(item.number / 1000).toInt()}K"
                    item.number % 1 == 0.0 -> item.number.toInt().toString()
                    else -> String.format("%.1f", item.number)
                },
                color = when {
                    item.number >= 100 -> Color(0xFF10B981)  // Зелений
                    item.number >= 10 -> Color(0xFFFBBF24)   // Жовтий
                    else -> Color(0xFFEF4444)                // Червоний
                },
                fontSize = 8.sp,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center
            )
        } else {
            Text(
                text = "-",
                color = Color(0xFF475569),
                fontSize = 8.sp
            )
        }
    }
}

