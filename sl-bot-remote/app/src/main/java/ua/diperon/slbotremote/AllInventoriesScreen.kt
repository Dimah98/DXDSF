package ua.diperon.slbotremote

import android.widget.Toast // Імпорт для показу спливаючих повідомлень про помилки

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable // Імпорт для обробки кліків
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow // Імпорт для горизонтальної стрічки категорій
import androidx.compose.foundation.lazy.items // Імпорт для відображення категорій у стрічці
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.ui.window.Dialog
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.outlined.*
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Settings // Іконка налаштувань для керування категоріями
import androidx.compose.material.icons.filled.Delete // Іконка видалення для категорій
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
import androidx.compose.ui.tooling.preview.Preview
import ua.diperon.slbotremote.ui.theme.*
import coil.compose.AsyncImage
import coil.request.ImageRequest
import kotlinx.coroutines.launch
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope

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
    var categories by remember { mutableStateOf<List<String>>(emptyList()) } // Стейт для збереження категорій
    var itemToCategories by remember { mutableStateOf<Map<String, List<String>>>(emptyMap()) } // Стейт зв'язків предметів
    var selectedCategory by remember { mutableStateOf<String?>(null) } // Вибрана категорія для фільтрації колонок
    var dataSource by remember { mutableStateOf("inventory") } // Стейт джерела ("inventory" або "stock")
    
    var isLoading by remember { mutableStateOf(true) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    // Отримуємо базовий URL з конфігурації
    val baseUrl = remember { ConnectionConfigManager(context).getHttpUrl().removeSuffix("/") }

    // Функція завантаження всіх інвентарів/складів та категорій
    val loadAllInventories: () -> Unit = {
        scope.launch {
            isLoading = true
            errorMessage = null

            try {
                // Паралельно завантажуємо категорії
                try {
                    val catResponse = apiService.getInventoryCategories() // Отримуємо категорії з сервера
                    categories = catResponse.categories // Записуємо категорії
                    itemToCategories = catResponse.itemToCategories // Записуємо зв'язки
                } catch (catEx: Exception) {
                    android.util.Log.e("AllInventoriesScreen", "Помилка завантаження категорій", catEx)
                }

                // Отримуємо список всіх проектів
                val projectNames = apiService.getProjects()

                // Паралельно завантажуємо інвентарі або склади для всіх проектів
                val results: List<Pair<String, List<InventoryItem>>?> = coroutineScope {
                    projectNames.map { projectName ->
                        async {
                            try {
                                val inventory = apiService.getInventory(projectName, dataSource)
                                if (inventory.data.isNotEmpty()) Pair(projectName, inventory.data) else null
                            } catch (e: Exception) {
                                android.util.Log.d("AllInventoriesScreen", "No data for $projectName")
                                null
                            }
                        }
                    }.awaitAll()
                }

                val inventories = mutableMapOf<String, List<InventoryItem>>()
                val resourcesSet = mutableSetOf<String>()

                results.filterNotNull().forEach { (name, data) ->
                    inventories[name] = data
                    data.forEach { item ->
                        resourcesSet.add(item.image)
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

    // Завантаження при першому відкритті та зміні джерела
    LaunchedEffect(dataSource) {
        loadAllInventories()
    }

    AllInventoriesContent(
        allInventories = allInventories,
        allResources = allResources,
        categories = categories,
        itemToCategories = itemToCategories,
        selectedCategory = selectedCategory,
        onSelectedCategoryChange = { selectedCategory = it },
        dataSource = dataSource,
        onDataSourceChange = { dataSource = it },
        isLoading = isLoading,
        errorMessage = errorMessage,
        baseUrl = baseUrl,
        onBackClick = onBackClick,
        onRefresh = loadAllInventories,
        onSaveCategories = { updatedCategories, updatedMapping ->
            scope.launch {
                try {
                    apiService.saveInventoryCategories(
                        CategoriesResponse(updatedCategories, updatedMapping)
                    )
                    categories = updatedCategories
                    itemToCategories = updatedMapping
                } catch (e: Exception) {
                    android.util.Log.e("AllInventoriesScreen", "Помилка при збереженні категорій", e)
                    Toast.makeText(context, "Помилка збереження: ${e.message}", Toast.LENGTH_SHORT).show()
                }
            }
        }
    )
}

@OptIn(ExperimentalMaterial3Api::class, ExperimentalFoundationApi::class)
@Composable
fun AllInventoriesContent(
    allInventories: Map<String, List<InventoryItem>>,
    allResources: List<String>,
    categories: List<String>,
    itemToCategories: Map<String, List<String>>,
    selectedCategory: String?,
    onSelectedCategoryChange: (String?) -> Unit,
    dataSource: String = "inventory",
    onDataSourceChange: (String) -> Unit = {},
    isLoading: Boolean,
    errorMessage: String?,
    baseUrl: String,
    onBackClick: () -> Unit,
    onRefresh: () -> Unit,
    onSaveCategories: (List<String>, Map<String, List<String>>) -> Unit
) {
    var isManageDialogOpen by remember { mutableStateOf(false) } // Чи відкритий діалог налаштування категорій
    var editingResourcePath by remember { mutableStateOf<String?>(null) } // Стейт для ресурсу, який наразі редагується (категорії)
    var fullscreenImageIndex by remember { mutableStateOf<Int?>(null) } // Стейт для індексу повноекранного зображення
    val context = LocalContext.current

    // Фільтруємо ресурси (колонки) відповідно до обраної категорії
    val filteredResources = remember(allResources, selectedCategory, itemToCategories) {
        if (selectedCategory == null) {
            allResources // Якщо категорія не вибрана — показуємо всі ресурси
        } else {
            allResources.filter { resource ->
                val itemName = resource.substringAfterLast("/").substringBeforeLast(".") // Назва ресурсу
                itemToCategories[itemName]?.contains(selectedCategory) == true // Перевіряємо приналежність
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                modifier = androidx.compose.ui.Modifier.height(56.dp),
                
                title = {
                    Column {
                        Text(
                            text = if (dataSource == "inventory") "Всі Інвентарі" else "Всі Склади (Stock)",
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Bold
                        )
                        if (!isLoading && allInventories.isNotEmpty()) {
                            Text(
                                text = "${allInventories.size} акаунтів • ${allResources.size} ресурсів",
                                fontSize = 12.sp,
                                color = GlassOnSurfaceVariant
                            )
                        }
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Назад"
                        )
                    }
                },
                actions = {
                    IconButton(onClick = onRefresh) {
                        Icon(
                            imageVector = Icons.Default.Refresh,
                            contentDescription = "Оновити"
                        )
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
                                color = GlassIndigo
                            )
                            Spacer(modifier = Modifier.height(16.dp))
                            Text(
                                text = "Завантаження інвентарів...",
                                color = GlassOnSurfaceVariant,
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
                            text = errorMessage,
                            color = GlassError,
                            fontSize = 16.sp,
                            textAlign = TextAlign.Center
                        )
                        Spacer(modifier = Modifier.height(24.dp))
                        Button(
                            onClick = onRefresh,
                            colors = ButtonDefaults.buttonColors(
                                containerColor = GlassIndigo
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
                            color = GlassOnSurfaceVariant,
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "Запустіть боти з нодою сканування інвентаря",
                            color = GlassOnSurfaceDim,
                            fontSize = 14.sp,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.padding(horizontal = 32.dp)
                        )
                    }
                }

                // Таблиця інвентарів / складів
                else -> {
                    Column(modifier = Modifier.fillMaxSize()) {
                        // Перемикач джерела даних (📦 Інвентар / 🏬 Склад)
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 8.dp, vertical = 4.dp),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            FilterChip(
                                selected = (dataSource == "inventory"),
                                onClick = { onDataSourceChange("inventory") },
                                label = { Text("📦 Інвентар", fontSize = 12.sp, fontWeight = FontWeight.Bold) },
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = GlassIndigo,
                                    selectedLabelColor = Color.White,
                                    containerColor = Color.White.copy(alpha = 0.06f),
                                    labelColor = GlassOnSurfaceVariant
                                )
                            )
                            FilterChip(
                                selected = (dataSource == "stock"),
                                onClick = { onDataSourceChange("stock") },
                                label = { Text("🏬 Склад", fontSize = 12.sp, fontWeight = FontWeight.Bold) },
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = GlassIndigo,
                                    selectedLabelColor = Color.White,
                                    containerColor = Color.White.copy(alpha = 0.06f),
                                    labelColor = GlassOnSurfaceVariant
                                )
                            )
                        }

                        // Верхній рядок керування категоріями та фільтрації
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 8.dp, vertical = 4.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            // Кнопка відкриття діалогу керування категоріями
                            IconButton(
                                onClick = { isManageDialogOpen = true },
                                modifier = Modifier
                                    .size(32.dp)
                                    .background(Color.White.copy(alpha = 0.06f), RoundedCornerShape(24.dp))
                                    .border(1.dp, Color.White.copy(alpha = 0.12f), RoundedCornerShape(24.dp))
                            ) {
                                Icon(
                                    imageVector = Icons.Outlined.Settings,
                                    contentDescription = "Керувати категоріями",
                                    tint = GlassIndigoLight,
                                    modifier = Modifier.size(16.dp)
                                )
                            }
                            
                            Spacer(modifier = Modifier.width(8.dp))

                            // Горизонтальна стрічка категорій для швидкої фільтрації колонок
                            LazyRow(
                                modifier = Modifier.weight(1f),
                                horizontalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                item {
                                    FilterChip(
                                        selected = selectedCategory == null, // Вибрано якщо selectedCategory порожня
                                        onClick = { onSelectedCategoryChange(null) }, // При кліці скидаємо категорію
                                        label = { Text("Всі", fontSize = 10.sp) },
                                        colors = FilterChipDefaults.filterChipColors(
                                            selectedContainerColor = GlassIndigo, // Фіолетовий якщо вибрано
                                            selectedLabelColor = Color.White,
                                            containerColor = Color.White.copy(alpha = 0.06f),
                                            labelColor = GlassOnSurfaceVariant
                                        ),
                                        border = FilterChipDefaults.filterChipBorder(
                                            selected = selectedCategory == null,
                                            enabled = true,
                                            borderColor = Color.White.copy(alpha = 0.12f),
                                            selectedBorderColor = GlassIndigoLight
                                        ),
                                        modifier = Modifier.height(28.dp)
                                    )
                                }

                                items(categories) { category ->
                                    FilterChip(
                                        selected = selectedCategory == category, // Чи вибрано цю категорію
                                        onClick = { onSelectedCategoryChange(if (selectedCategory == category) null else category) }, // Зміна вибору при кліці
                                        label = { Text(category, fontSize = 10.sp) },
                                        colors = FilterChipDefaults.filterChipColors(
                                            selectedContainerColor = GlassIndigo, // Фіолетовий якщо вибрано
                                            selectedLabelColor = Color.White,
                                            containerColor = Color.White.copy(alpha = 0.06f),
                                            labelColor = GlassOnSurfaceVariant
                                        ),
                                        border = FilterChipDefaults.filterChipBorder(
                                            selected = selectedCategory == category,
                                            enabled = true,
                                            borderColor = Color.White.copy(alpha = 0.12f),
                                            selectedBorderColor = GlassIndigoLight
                                        ),
                                        modifier = Modifier.height(28.dp)
                                    )
                                }
                            }
                        }

                        if (filteredResources.isEmpty()) {
                            Box(
                                modifier = Modifier
                                    .fillMaxSize()
                                    .weight(1f),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = "Немає ресурсів у цій категорії",
                                    color = GlassOnSurfaceDim,
                                    fontSize = 14.sp
                                )
                            }
                        } else {
                            Box(modifier = Modifier.weight(1f)) {
                                InventoryMatrix( // Рендеримо матрицю інвентарів
                                    inventories = allInventories, // Дані інвентарів
                                    resources = filteredResources, // Передаємо тільки відфільтровані стовпці ресурсів
                                    baseUrl = baseUrl, // Базовий URL
                                    onResourceClick = { fullscreenImageIndex = it } // Обробник кліку на заголовок ресурсу для повноекранного перегляду
                                ) // Кінець InventoryMatrix
                            }
                        }
                    }
                }
            }
        }
    }

    // Діалог налаштування та створення/видалення категорій
    if (isManageDialogOpen) {
        var newCategoryName by remember { mutableStateOf("") } // Стейт для імені нової категорії

        AlertDialog(
            onDismissRequest = { isManageDialogOpen = false }, // Закриття діалогу
            title = {
                Text(
                    text = "Налаштування категорій", // Заголовок
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                )
            },
            text = {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 8.dp)
                ) {
                    // Рядок додавання нової категорії
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        OutlinedTextField(
                            value = newCategoryName,
                            onValueChange = { newCategoryName = it },
                            placeholder = { Text("Нова категорія...", color = GlassOnSurfaceDim) },
                            modifier = Modifier.weight(1f),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = GlassIndigoLight,
                                unfocusedBorderColor = Color.White.copy(alpha = 0.12f),
                                focusedTextColor = Color.White,
                                unfocusedTextColor = Color.White
                            ),
                            singleLine = true
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Button(
                            onClick = {
                                val trimmed = newCategoryName.trim()
                                if (trimmed.isNotEmpty() && !categories.contains(trimmed)) {
                                    val updated = categories + trimmed
                                    onSaveCategories(updated, itemToCategories)
                                    newCategoryName = "" // Очищаємо поле введення
                                }
                            },
                            colors = ButtonDefaults.buttonColors(
                                containerColor = GlassIndigo
                            )
                        ) {
                            Text("Додати", fontSize = 12.sp)
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    // Заголовок списку категорій
                    Text(
                        text = "Існуючі категорії:",
                        color = GlassOnSurfaceVariant,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold
                    )
                    
                    Spacer(modifier = Modifier.height(8.dp))

                    // Вертикальний список категорій
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .heightIn(max = 200.dp)
                            .verticalScroll(rememberScrollState())
                    ) {
                        categories.forEach { category ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 4.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = category,
                                    color = Color.White,
                                    fontSize = 14.sp
                                )
                                IconButton(
                                    onClick = {
                                        // Видалення категорії з масиву та з мапінгу предметів
                                        val updated = categories.filter { it != category }
                                        val updatedMapping = itemToCategories.toMutableMap()
                                        updatedMapping.forEach { (key, value) ->
                                            updatedMapping[key] = value.filter { it != category }
                                        }
                                        onSaveCategories(updated, updatedMapping)
                                        if (selectedCategory == category) {
                                            onSelectedCategoryChange(null)
                                        }
                                    }
                                ) {
                                    Icon(
                                        imageVector = Icons.Outlined.Delete,
                                        contentDescription = "Видалити",
                                        tint = GlassError
                                    )
                                }
                            }
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { isManageDialogOpen = false }) {
                    Text("Закрити", color = GlassIndigoLight, fontWeight = FontWeight.Bold)
                }
            },
            containerColor = Color(0xFF0A0E1A).copy(alpha = 0.95f),
            shape = RoundedCornerShape(24.dp)
        ) // Кінець AlertDialog
    } // Кінець перевірки isManageDialogOpen

    // Діалог для керування категоріями конкретного предмета
    if (editingResourcePath != null) { // Перевіряємо чи вибрано ресурс
        val resourcePath = editingResourcePath!! // Отримуємо шлях до картинки
        val itemName = remember(resourcePath) { resourcePath.substringAfterLast("/").substringBeforeLast(".") } // Отримуємо чисте ім'я
        val itemCats = itemToCategories[itemName] ?: emptyList() // Отримуємо поточні категорії предмета

        AlertDialog( // Відображаємо діалог налаштування категорій
            onDismissRequest = { editingResourcePath = null }, // Закриваємо діалог при кліці поза ним
            title = { // Заголовок діалогу
                Row(verticalAlignment = Alignment.CenterVertically) { // Вирівнюємо іконку та текст по центру
                    val imageUrl = remember(resourcePath, baseUrl) { // Формуємо повний URL для зображення
                        when { // Перевіряємо формат шляху зображення
                            resourcePath.startsWith("data:") -> resourcePath // Залишаємо data URL як є
                            resourcePath.startsWith("http://") || resourcePath.startsWith("https://") -> resourcePath // HTTP URL
                            else -> {
                                val path = if (resourcePath.startsWith("/")) resourcePath else "/$resourcePath"
                                "$baseUrl$path"
                            }
                        } // Кінець перевірки
                    } // Кінець формування URL
                    AsyncImage( // Завантажуємо зображення
                        model = ImageRequest.Builder(context) // Будуємо запит
                            .data(imageUrl) // Встановлюємо URL
                            .crossfade(true) // Включаємо плавний перехід
                            .allowHardware(false) // Вимикаємо апаратне декодування для стабільності
                            .build(), // Будуємо запит
                        contentDescription = itemName, // Опис зображення
                        contentScale = ContentScale.Fit, // Масштабуємо за пропорціями
                        modifier = Modifier.size(24.dp) // Встановлюємо розмір 24dp
                    ) // Кінець AsyncImage
                    Spacer(modifier = Modifier.width(8.dp)) // Відступ
                    Text( // Заголовок діалогу
                        text = "Категорії для $itemName", // Текст заголовка
                        fontSize = 18.sp, // Розмір тексту 18sp
                        fontWeight = FontWeight.Bold, // Жирне накреслення
                        color = Color.White // Білий колір
                    ) // Кінець Text
                } // Кінець Row
            }, // Кінець title
            text = { // Тіло діалогу
                Column( // Стовпець для списку категорій
                    modifier = Modifier // Модифікатор
                        .fillMaxWidth() // На всю ширину
                        .padding(vertical = 8.dp) // Вертикальний відступ
                ) { // Початок Column
                    if (categories.isEmpty()) { // Якщо немає створених категорій
                        Text( // Показуємо повідомлення
                            text = "Немає доступних категорій. Додайте їх за допомогою кнопки ⚙️.", // Текст
                            color = GlassOnSurfaceVariant, // Сірий колір
                            fontSize = 14.sp // Розмір тексту 14sp
                        ) // Кінець Text
                    } else { // Якщо категорії існують
                        categories.forEach { category -> // Проходимося по всіх категоріях
                            val isChecked = itemCats.contains(category) // Перевіряємо чи додано предмет
                            Row( // Рядок для однієї категорії
                                modifier = Modifier // Модифікатор
                                    .fillMaxWidth() // На всю ширину
                                    .clickable { // Обробка кліку на весь рядок
                                        val updatedList = if (isChecked) { // Якщо вже вибрано
                                            itemCats.filter { it != category } // Видаляємо
                                        } else { // Якщо не вибрано
                                            itemCats + category // Додаємо
                                        } // Кінець перевірки
                                        val newMapping = itemToCategories.toMutableMap() // Створюємо копію мапи
                                        newMapping[itemName] = updatedList // Оновлюємо список категорій предмета
                                        onSaveCategories(categories, newMapping)
                                    } // Кінець clickable
                                    .padding(vertical = 8.dp), // Відступ 8dp
                                verticalAlignment = Alignment.CenterVertically // Вирівнюємо по вертикалі
                            ) { // Вміст рядка категорії
                                Checkbox( // Чекбокс вибору
                                    checked = isChecked, // Стан
                                    onCheckedChange = { checked -> // Обробка зміни стану
                                        val updatedList = if (checked) { // Якщо вибрано
                                            itemCats + category // Додаємо
                                        } else { // Якщо знято
                                            itemCats.filter { it != category } // Видаляємо
                                        } // Кінець перевірки
                                        val newMapping = itemToCategories.toMutableMap() // Створюємо копію мапи
                                        newMapping[itemName] = updatedList // Оновлюємо список
                                        onSaveCategories(categories, newMapping)
                                    }, // Кінець onCheckedChange
                                    colors = CheckboxDefaults.colors( // Налаштовуємо кольори
                                        checkedColor = GlassIndigo, // Фіолетовий якщо вибрано
                                        uncheckedColor = Color.White.copy(alpha = 0.12f) // Сірий якщо не вибрано
                                    ) // Кінець colors
                                ) // Кінець Checkbox
                                Spacer(modifier = Modifier.width(8.dp)) // Відступ
                                Text( // Текст назви категорії
                                    text = category, // Назва
                                    color = Color.White, // Колір тексту
                                    fontSize = 14.sp // Розмір тексту 14sp
                                ) // Кінець Text
                            } // Кінець Row
                        } // Кінець forEach
                    } // Кінець if
                } // Кінець Column
            }, // Кінець text
            confirmButton = { // Кнопка підтвердження
                TextButton(onClick = { editingResourcePath = null }) { // Закриваємо діалог
                    Text( // Текст кнопки
                        text = "Готово", // Готово
                        color = GlassIndigoLight, // Світло-фіолетовий
                        fontWeight = FontWeight.Bold // Жирний
                    ) // Кінець Text
                } // Кінець TextButton
            }, // Кінець confirmButton
            containerColor = Color(0xFF0A0E1A).copy(alpha = 0.95f),
            shape = RoundedCornerShape(24.dp)
        ) // Кінець AlertDialog
    }

    // Повноекранний переглядач зображень ресурсів
    if (fullscreenImageIndex != null) {
        val pagerState = rememberPagerState(
            initialPage = fullscreenImageIndex!!,
            pageCount = { filteredResources.size }
        )

        Dialog(onDismissRequest = { fullscreenImageIndex = null }) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color.Black),
                contentAlignment = Alignment.Center
            ) {
                HorizontalPager(
                    state = pagerState,
                    modifier = Modifier.fillMaxSize()
                ) { index ->
                    val resource = filteredResources[index]
                    val imageUrl = remember(resource, baseUrl) {
                        when {
                            resource.startsWith("data:") -> resource
                            resource.startsWith("http://") || resource.startsWith("https://") -> resource
                            else -> {
                                val path = if (resource.startsWith("/")) resource else "/$resource"
                                "$baseUrl$path"
                            }
                        }
                    }

                    AsyncImage(
                        model = ImageRequest.Builder(context)
                            .data(imageUrl)
                            .crossfade(true)
                            .allowHardware(false)
                            .build(),
                        contentDescription = "Resource image",
                        contentScale = ContentScale.Fit,
                        modifier = Modifier.fillMaxSize()
                    )
                }

                // Кнопка закриття
                IconButton(
                    onClick = { fullscreenImageIndex = null },
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(16.dp)
                        .size(48.dp)
                        .background(Color.Black.copy(alpha = 0.5f), CircleShape)
                ) {
                    Icon(
                        imageVector = Icons.Default.Close,
                        contentDescription = "Закрити",
                        tint = Color.White,
                        modifier = Modifier.size(24.dp)
                    )
                }

                // Лічильник зображень
                Box(
                    modifier = Modifier
                        .align(Alignment.BottomCenter)
                        .padding(16.dp)
                        .background(Color.Black.copy(alpha = 0.5f), RoundedCornerShape(8.dp))
                        .padding(horizontal = 12.dp, vertical = 6.dp)
                ) {
                    Text(
                        text = "${pagerState.currentPage + 1} / ${filteredResources.size}",
                        color = Color.White,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold
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
    baseUrl: String,
    onResourceClick: (Int) -> Unit // Передаємо індекс ресурсу при кліку
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
                    .background(Color.White.copy(alpha = 0.06f))
                    .border(1.dp, Color.White.copy(alpha = 0.12f))
                    .padding(4.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "Акаунт / Ресурс",
                    color = GlassOnSurfaceVariant,
                    fontSize = 8.sp,
                    fontWeight = FontWeight.Bold,
                    textAlign = TextAlign.Center
                )
            }

            // Заголовки ресурсів з зображеннями
            resources.forEachIndexed { index, resource -> // Цикл по ресурсах з індексом
                ResourceHeaderCell(resource, index, baseUrl, context, onResourceClick = { onResourceClick(it) }) // Рендер комірки заголовка з обробником кліку
            } // Кінець циклу
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
                            .background(Color.White.copy(alpha = 0.06f))
                            .border(1.dp, Color.White.copy(alpha = 0.12f))
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
fun ResourceHeaderCell(
    resource: String,
    index: Int,
    baseUrl: String,
    context: android.content.Context,
    onResourceClick: (Int) -> Unit // Отримуємо обробник події кліку з індексом
) {
    // Формуємо повний URL для зображення
    val imageUrl = remember(resource, baseUrl) {
        when {
            resource.startsWith("data:") -> resource
            resource.startsWith("http://") || resource.startsWith("https://") -> resource
            else -> {
                val path = if (resource.startsWith("/")) resource else "/$resource"
                "$baseUrl$path"
            }
        }
    }

    Box(
        modifier = Modifier
            .width(28.dp)
            .height(36.dp)
            .background(Color.White.copy(alpha = 0.06f))
            .border(1.dp, Color.White.copy(alpha = 0.12f))
            .clickable { onResourceClick(index) } // Обробка події кліку по заголовку ресурсу
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
                if (item != null) Color.White.copy(alpha = 0.06f) else GlassBg
            )
            .border(
                width = 1.dp,
                color = if (item != null) Color.White.copy(alpha = 0.12f) else Color.White.copy(alpha = 0.06f)
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
                    item.number >= 100 -> GlassSuccess  // Зелений
                    item.number >= 10 -> Color(0xFFFBBF24)   // Жовтий
                    else -> GlassError                // Червоний
                },
                fontSize = 8.sp,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center
            )
        } else {
            Text(
                text = "-",
                color = Color.White.copy(alpha = 0.12f),
                fontSize = 8.sp
            )
        }
    }
}

@Preview(showBackground = true, backgroundColor = 0xFF0F172A)
@Composable
fun AllInventoriesScreenPreview() {
    val sampleInventories = mapOf(
        "Project Alpha" to listOf(
            InventoryItem(image = "https://sunflower-land.com/play/assets/resources/sunflower.png", number = 145.0),
            InventoryItem(image = "https://sunflower-land.com/play/assets/resources/potato.png", number = 42.0)
        ),
        "Project Beta" to listOf(
            InventoryItem(image = "https://sunflower-land.com/play/assets/resources/sunflower.png", number = 10.0),
            InventoryItem(image = "https://sunflower-land.com/play/assets/resources/gold_ingot.png", number = 5.0)
        )
    )
    val sampleResources = listOf(
        "https://sunflower-land.com/play/assets/resources/sunflower.png",
        "https://sunflower-land.com/play/assets/resources/potato.png",
        "https://sunflower-land.com/play/assets/resources/gold_ingot.png"
    )
    val sampleCategories = listOf("Seeds", "Crops", "Resources")
    val sampleItemToCategories = mapOf(
        "sunflower" to listOf("Seeds", "Crops"),
        "potato" to listOf("Seeds", "Crops"),
        "gold_ingot" to listOf("Resources")
    )

    MyApplicationTheme {
        AllInventoriesContent(
            allInventories = sampleInventories,
            allResources = sampleResources,
            categories = sampleCategories,
            itemToCategories = sampleItemToCategories,
            selectedCategory = null,
            onSelectedCategoryChange = {},
            isLoading = false,
            errorMessage = null,
            baseUrl = "https://sunflower-land.com",
            onBackClick = {},
            onRefresh = {},
            onSaveCategories = { _, _ -> }
        )
    }
}
