package ua.diperon.slbotremote

import android.content.Context
import android.widget.Toast // Імпорт для показу повідомлень про помилки

import android.util.Base64
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable // Імпорт для клікабельності елементів
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow // Імпорт для горизонтального списку категорій
import androidx.compose.foundation.lazy.items // Імпорт для відображення елементів у списках
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
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
import coil.decode.DataSource
import coil.decode.ImageSource
import coil.fetch.FetchResult
import coil.fetch.Fetcher
import coil.fetch.SourceResult
import coil.request.Options
import okio.Buffer
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

/**
 * Кастомний Fetcher для обробки base64 data URLs
 * Підтримує формати: data:image/png;base64,... та data:image/webp;base64,...
 */
class Base64Fetcher(
    private val data: String,
    private val options: Options
) : Fetcher {

    override suspend fun fetch(): FetchResult {
        // Парсимо data URL: "data:image/webp;base64,UklGR..."
        val base64Data = if (data.startsWith("data:")) {
            // Видаляємо prefix "data:image/webp;base64," і отримуємо сам base64
            data.substringAfter(",")
        } else {
            data
        }

        // Декодуємо base64 в байти
        val imageBytes = Base64.decode(base64Data, Base64.DEFAULT)
        
        // Конвертуємо в Okio Buffer
        val buffer = Buffer().write(imageBytes)
        
        // Повертаємо як SourceResult для подальшого декодування
        return SourceResult(
            source = ImageSource(buffer, options.context),
            mimeType = "image/webp", // Вказуємо MIME тип
            dataSource = DataSource.MEMORY
        )
    }

    class Factory : Fetcher.Factory<String> {
        override fun create(data: String, options: Options, imageLoader: coil.ImageLoader): Fetcher? {
            // Перевіряємо, чи це data URL
            return if (data.startsWith("data:image/")) {
                Base64Fetcher(data, options)
            } else {
                null
            }
        }
    }
}

/**
 * Екран відображення інвентаря проекту
 * Показує grid з елементами інвентаря (зображення + кількість)
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InventoryScreen(
    projectName: String,
    apiService: BotApiService,
    onBackClick: () -> Unit
) {
    var inventoryItems by remember { mutableStateOf<List<InventoryItem>>(emptyList()) } // Стейт для предметів інвентаря
    var categories by remember { mutableStateOf<List<String>>(emptyList()) } // Стейт для списку категорій
    var itemToCategories by remember { mutableStateOf<Map<String, List<String>>>(emptyMap()) } // Стейт зв'язків предметів з категоріями
    var selectedCategory by remember { mutableStateOf<String?>(null) } // Стейт вибраної категорії для фільтрації
    var editingItem by remember { mutableStateOf<InventoryItem?>(null) } // Предмет для редагування категорій
    var dataSource by remember { mutableStateOf("inventory") } // Стейт джерела ("inventory" або "stock")
    
    var isLoading by remember { mutableStateOf(true) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var timestamp by remember { mutableStateOf<Long?>(null) }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current // Отримуємо поточний контекст для доступу до ресурсів застосунку
    var assetFiles by remember { mutableStateOf<List<String>>(emptyList()) } // Зберігаємо список файлів в assets/im

    // Завантажуємо список файлів з папки assets/im при запуску
    LaunchedEffect(Unit) {
        try {
            assetFiles = context.assets.list("im")?.toList() ?: emptyList() // Зчитуємо файли з папки im
            android.util.Log.d("InventoryScreen", "Знайдено вшитих файлів: ${assetFiles.size}") // Логуємо кількість знайдених файлів
        } catch (e: Exception) {
            android.util.Log.e("InventoryScreen", "Помилка при читанні assets/im", e) // Логуємо помилку у разі виникнення
        } // Кінець блоку try-catch
    } // Кінець LaunchedEffect

    // Функція завантаження інвентаря та категорій
    fun loadInventory() {
        scope.launch {
            isLoading = true
            errorMessage = null
            try {
                // Паралельно намагаємось завантажити категорії та їхні зв'язки
                try {
                    val catResponse = apiService.getInventoryCategories() // Виклик API категорій
                    categories = catResponse.categories // Зберігаємо категорії
                    itemToCategories = catResponse.itemToCategories // Зберігаємо зв'язки
                } catch (catEx: Exception) {
                    android.util.Log.e("InventoryScreen", "Помилка завантаження категорій", catEx) // Логуємо помилку категорій
                }

                val response = apiService.getInventory(projectName, dataSource)
                inventoryItems = response.data
                timestamp = response.timestamp?.toLong()
                
                // Логування URL зображень для відладки
                android.util.Log.d("InventoryScreen", "Loaded ${response.data.size} items")
                response.data.forEachIndexed { index, item ->
                    android.util.Log.d("InventoryScreen", "Item $index: number=${item.number}, imageUrl=${item.image}")
                }
            } catch (e: Exception) {
                android.util.Log.e("InventoryScreen", "Error loading inventory", e)
                errorMessage = when {
                    e.message?.contains("401") == true -> "Необхідна аутентифікація"
                    e.message?.contains("404") == true -> "Інвентар не знайдено"
                    e.message?.contains("timeout") == true -> "Час очікування вичерпано"
                    else -> "Помилка завантаження: ${e.message}"
                }
            } finally {
                isLoading = false
            }
        }
    }

    // Завантаження при відкритті екрану та зміні джерела
    LaunchedEffect(projectName, dataSource) {
        loadInventory()
    }

    Scaffold(
        topBar = {
            TopAppBar(
                modifier = androidx.compose.ui.Modifier.height(42.dp),
                
                title = {
                    Column {
                        Text(
                            text = if (dataSource == "inventory") "Інвентар" else "Склад (Stock)",
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold,
                            color = GlassIndigoLight
                        )
                        Text(
                            text = projectName,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Normal,
                            color = GlassOnSurface
                        )
                        timestamp?.let {
                            val dateFormat = SimpleDateFormat("dd.MM.yyyy HH:mm", Locale("uk", "UA"))
                            Text(
                                text = "Оновлено: ${dateFormat.format(Date(it))}",
                                fontSize = 10.sp,
                                color = GlassOnSurfaceVariant
                            )
                        }
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Назад",
                            tint = GlassOnSurfaceVariant
                        )
                    }
                },
                actions = {
                    IconButton(onClick = { loadInventory() }) {
                        Icon(
                            imageVector = Icons.Default.Refresh,
                            contentDescription = "Оновити",
                            tint = GlassIndigoLight
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = GlassBg.copy(alpha = 0.85f)
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
                // Стан завантаження
                isLoading -> {
                    Column(
                        modifier = Modifier.fillMaxSize(),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center
                    ) {
                        CircularProgressIndicator(
                            color = GlassIndigoLight,
                            modifier = Modifier.size(48.dp)
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(
                            text = "Завантаження...",
                            color = GlassOnSurfaceVariant,
                            fontSize = 14.sp
                        )
                    }
                }

                // Стан помилки
                errorMessage != null -> {
                    Column(
                        modifier = Modifier.fillMaxSize(),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center
                    ) {
                        Text(
                            text = "❌",
                            fontSize = 48.sp
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(
                            text = "Помилка",
                            color = GlassError,
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = errorMessage ?: "",
                            color = GlassOnSurfaceVariant,
                            fontSize = 14.sp,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.padding(horizontal = 32.dp)
                        )
                        Spacer(modifier = Modifier.height(24.dp))
                        Button(
                            onClick = { loadInventory() },
                            colors = ButtonDefaults.buttonColors(
                                containerColor = GlassIndigo
                            )
                        ) {
                            Text("Спробувати знову")
                        }
                    }
                }

                // Порожній інвентар/склад
                inventoryItems.isEmpty() -> {
                    Column(
                        modifier = Modifier.fillMaxSize(),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center
                    ) {
                        // Перемикач джерела даних: Інвентар / Склад
                        Row(
                            modifier = Modifier.padding(bottom = 16.dp),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            FilterChip(
                                selected = (dataSource == "inventory"),
                                onClick = { dataSource = "inventory" },
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
                                onClick = { dataSource = "stock" },
                                label = { Text("🏬 Склад", fontSize = 12.sp, fontWeight = FontWeight.Bold) },
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = GlassIndigo,
                                    selectedLabelColor = Color.White,
                                    containerColor = Color.White.copy(alpha = 0.06f),
                                    labelColor = GlassOnSurfaceVariant
                                )
                            )
                        }

                        Text(
                            text = "📦",
                            fontSize = 64.sp
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(
                            text = if (dataSource == "inventory") "Інвентар порожній" else "Склад порожній",
                            color = GlassOnSurfaceVariant,
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "Немає збережених даних для $projectName",
                            color = GlassOnSurfaceDim,
                            fontSize = 14.sp,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.padding(horizontal = 32.dp)
                        )
                    }
                }

                // Grid з інвентарем / складом
                else -> {
                    Column(modifier = Modifier.fillMaxSize()) {
                        // Перемикач джерела даних: Інвентар / Склад
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 8.dp, vertical = 4.dp),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            FilterChip(
                                selected = (dataSource == "inventory"),
                                onClick = { dataSource = "inventory" },
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
                                onClick = { dataSource = "stock" },
                                label = { Text("🏬 Склад", fontSize = 12.sp, fontWeight = FontWeight.Bold) },
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = GlassIndigo,
                                    selectedLabelColor = Color.White,
                                    containerColor = Color.White.copy(alpha = 0.06f),
                                    labelColor = GlassOnSurfaceVariant
                                )
                            )
                        }
                        // Якщо категорії є, показуємо горизонтальну стрічку з кнопками категорій
                        if (categories.isNotEmpty()) {
                            LazyRow(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(horizontal = 8.dp, vertical = 4.dp),
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                // Кнопка "Всі" предмети
                                item {
                                    FilterChip(
                                        selected = selectedCategory == null, // Вибрано якщо selectedCategory порожній
                                        onClick = { selectedCategory = null }, // При кліці скидаємо категорію
                                        label = { Text("Всі", fontSize = 12.sp) }, // Текст
                                        colors = FilterChipDefaults.filterChipColors(
                                            selectedContainerColor = GlassIndigo, // Фіолетовий фон якщо вибрано
                                            selectedLabelColor = Color.White,
                                            containerColor = Color.White.copy(alpha = 0.06f),
                                            labelColor = GlassOnSurfaceVariant
                                        ),
                                        border = FilterChipDefaults.filterChipBorder(
                                            selected = selectedCategory == null,
                                            enabled = true,
                                            borderColor = Color.White.copy(alpha = 0.12f),
                                            selectedBorderColor = GlassIndigoLight
                                        )
                                    )
                                }

                                // Кнопка під кожну категорію
                                items(categories) { category ->
                                    FilterChip(
                                        selected = selectedCategory == category, // Чи вибрано цю категорію
                                        onClick = { selectedCategory = if (selectedCategory == category) null else category }, // Зміна вибору при кліці
                                        label = { Text(category, fontSize = 12.sp) },
                                        colors = FilterChipDefaults.filterChipColors(
                                            selectedContainerColor = GlassIndigo, // Фіолетовий фон якщо вибрано
                                            selectedLabelColor = Color.White,
                                            containerColor = Color.White.copy(alpha = 0.06f),
                                            labelColor = GlassOnSurfaceVariant
                                        ),
                                        border = FilterChipDefaults.filterChipBorder(
                                            selected = selectedCategory == category,
                                            enabled = true,
                                            borderColor = Color.White.copy(alpha = 0.12f),
                                            selectedBorderColor = GlassIndigoLight
                                        )
                                    )
                                }
                            }
                        }

                        // Відфільтровані предмети
                        val filteredItems = remember(inventoryItems, selectedCategory, itemToCategories) {
                            if (selectedCategory == null) {
                                inventoryItems // Якщо категорію не вибрано — показуємо все
                            } else {
                                inventoryItems.filter { item ->
                                    val itemName = item.image.substringAfterLast("/").substringBeforeLast(".") // Отримуємо назву предмета з картинки
                                    itemToCategories[itemName]?.contains(selectedCategory) == true // Перевіряємо приналежність
                                }
                            }
                        }

                        if (filteredItems.isEmpty()) {
                            // Якщо після фільтрації порожньо
                            Box(
                                modifier = Modifier
                                    .fillMaxSize()
                                    .weight(1f),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = "Немає предметів у цій категорії",
                                    color = GlassOnSurfaceDim,
                                    fontSize = 14.sp
                                )
                            }
                        } else {
                            // Сітка відфільтрованих предметів
                            LazyVerticalGrid(
                                columns = GridCells.Adaptive(minSize = 60.dp),
                                contentPadding = PaddingValues(8.dp),
                                horizontalArrangement = Arrangement.spacedBy(6.dp),
                                verticalArrangement = Arrangement.spacedBy(6.dp),
                                modifier = Modifier
                                    .fillMaxSize()
                                    .weight(1f)
                            ) {
                                items(filteredItems) { item ->
                                    InventoryItemCard(
                                        item = item, 
                                        assetFiles = assetFiles,
                                        onCardClick = { clickedItem ->
                                            editingItem = clickedItem // При кліці на картку відкриваємо діалог
                                        }
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Діалог для керування категоріями конкретного предмета
    if (editingItem != null) {
        val item = editingItem!!
        val itemName = remember(item) { item.image.substringAfterLast("/").substringBeforeLast(".") } // Отримуємо ім'я предмета
        val itemCats = itemToCategories[itemName] ?: emptyList() // Отримуємо поточні категорії предмета

        AlertDialog(
            onDismissRequest = { editingItem = null }, // Закриваємо діалог
            title = {
                Text(
                    text = "Категорії для $itemName", // Заголовок
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
                    if (categories.isEmpty()) {
                        Text(
                            text = "Немає доступних категорій. Додайте їх на екрані всіх інвентарів.", // Повідомлення, якщо категорій немає
                            color = GlassOnSurfaceVariant,
                            fontSize = 14.sp
                        )
                    } else {
                        categories.forEach { category ->
                            val isChecked = itemCats.contains(category) // Перевіряємо чи додано предмет до категорії
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable {
                                        // Оновлюємо зв'язки при кліці на рядок
                                        scope.launch {
                                            val updatedList = if (isChecked) {
                                                itemCats.filter { it != category }
                                            } else {
                                                itemCats + category
                                            }
                                            val newMapping = itemToCategories.toMutableMap()
                                            newMapping[itemName] = updatedList
                                            itemToCategories = newMapping
                                            try {
                                                apiService.saveInventoryCategories(
                                                    CategoriesResponse(categories, newMapping)
                                                ) // Зберігаємо на сервері
                                            } catch (e: Exception) {
                                                android.util.Log.e("InventoryScreen", "Помилка при збереженні категорій", e)
                                                Toast.makeText(context, "Помилка збереження: ${e.message}", Toast.LENGTH_SHORT).show()
                                            }
                                        }
                                    }
                                    .padding(vertical = 8.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Checkbox(
                                    checked = isChecked,
                                    onCheckedChange = { checked ->
                                        // Оновлюємо зв'язки при зміні стану чекбокса
                                        scope.launch {
                                            val updatedList = if (checked) {
                                                itemCats + category
                                            } else {
                                                itemCats.filter { it != category }
                                            }
                                            val newMapping = itemToCategories.toMutableMap()
                                            newMapping[itemName] = updatedList
                                            itemToCategories = newMapping
                                            try {
                                                apiService.saveInventoryCategories(
                                                    CategoriesResponse(categories, newMapping)
                                                ) // Зберігаємо на сервері
                                            } catch (e: Exception) {
                                                android.util.Log.e("InventoryScreen", "Помилка при збереженні категорій", e)
                                                Toast.makeText(context, "Помилка збереження: ${e.message}", Toast.LENGTH_SHORT).show()
                                            }
                                        }
                                    },
                                    colors = CheckboxDefaults.colors(
                                        checkedColor = GlassIndigo,
                                        uncheckedColor = Color.White.copy(alpha = 0.12f)
                                    )
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    text = category,
                                    color = Color.White,
                                    fontSize = 14.sp
                                )
                            }
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { editingItem = null }) {
                    Text(
                        text = "Готово", // Кнопка закриття
                        color = GlassIndigoLight,
                        fontWeight = FontWeight.Bold
                    )
                }
            },
            containerColor = Color(0xFF0A0E1A).copy(alpha = 0.95f),
            shape = RoundedCornerShape(24.dp)
        )
    }
}

object ImageLoaderProvider {
    @Volatile
    private var instance: coil.ImageLoader? = null

    fun getImageLoader(context: Context): coil.ImageLoader {
        return instance ?: synchronized(this) {
            instance ?: coil.ImageLoader.Builder(context.applicationContext)
                .components { add(Base64Fetcher.Factory()) }
                .build().also { instance = it }
        }
    }
}

/**
 * Картка окремого елемента інвентаря
 */
@Composable
fun InventoryItemCard(
    item: InventoryItem, 
    assetFiles: List<String>,
    onCardClick: (InventoryItem) -> Unit // Лямбда для обробки кліку
) {
    val context = LocalContext.current

    // Використовуємо синглтон ImageLoader
    val imageLoader = remember(context) { ImageLoaderProvider.getImageLoader(context) }
    
    // Отримуємо базовий URL з конфігурації
    val baseUrl = remember(context) { ConnectionConfigManager(context).getHttpUrl().removeSuffix("/") }
    
    // Формуємо повний URL для зображення
    val imageUrl = remember(item.image, assetFiles) { // Залежить також від списку файлів assets
        // Очищаємо назву предмета (наприклад, "/api/images/iron.png" -> "iron")
        val cleanName = item.image
            .substringAfterLast("/") // Беремо частину після останнього слеша
            .substringBeforeLast(".") // Видаляємо розширення файлу
            .lowercase(Locale.ROOT) // Переводимо в нижній регістр
            .trim() // Видаляємо зайві пробіли
            
        // 1. Спочатку шукаємо точний збіг назви файлу з назвою предмета
        var matchedFileName = assetFiles.firstOrNull { assetFile ->
            val assetClean = assetFile.substringBeforeLast(".").lowercase(Locale.ROOT).trim() // Очищаємо назву з assets
            // Перевіряємо точний збіг за різними стилями написання
            assetClean == cleanName || assetClean.replace(" ", "_") == cleanName || assetClean.replace("_", " ") == cleanName
        } // Кінець пошуку точного збігу

        // 2. Якщо точного збігу немає, шукаємо файл, назва якого містить назву предмета
        if (matchedFileName == null) {
            matchedFileName = assetFiles.firstOrNull { assetFile ->
                val assetClean = assetFile.substringBeforeLast(".").lowercase(Locale.ROOT).trim() // Очищаємо назву з assets
                assetClean.contains(cleanName) // Перевіряємо чи назва файлу містить назву предмета
            } // Кінець пошуку часткового збігу
        } // Кінець перевірки

        if (matchedFileName != null) { // Якщо локальний файл знайдено
            "file:///android_asset/im/$matchedFileName" // Повертаємо локальне посилання
        } else { // Якщо локальний файл не знайдено
            when {
                // Якщо це base64 дані
                item.image.startsWith("data:") -> item.image
                // Якщо це пряме HTTP посилання
                item.image.startsWith("http://") || item.image.startsWith("https://") -> item.image
                // Для відносних шляхів
                else -> "$baseUrl${item.image}"
            } // Кінець when
        } // Кінець перевірки
    } // Кінець remember
    
    Box(
        modifier = Modifier
            .aspectRatio(1f)
            .clip(RoundedCornerShape(24.dp))
            .background(Color.White.copy(alpha = 0.06f))
            .border(
                width = 1.dp,
                color = Color.White.copy(alpha = 0.12f),
                shape = RoundedCornerShape(24.dp)
            )
            .clickable { onCardClick(item) } // Обробляємо клік на картці предмета
            .padding(4.dp)
    ) {
        // Зображення
        AsyncImage(
            model = ImageRequest.Builder(context)
                .data(imageUrl)
                .crossfade(true)
                .allowHardware(false) // Вимкнути апаратне прискорення для кращої сумісності
                .memoryCacheKey(imageUrl)
                .diskCacheKey(imageUrl)
                .listener(
                    onError = { _, result ->
                        android.util.Log.e("InventoryItemCard", "Failed to load image: $imageUrl (original: ${item.image}), error: ${result.throwable.message}")
                    },
                    onSuccess = { _, _ ->
                        android.util.Log.d("InventoryItemCard", "Successfully loaded image: $imageUrl")
                    }
                )
                .error(android.R.drawable.ic_menu_report_image)
                .placeholder(android.R.drawable.ic_menu_gallery)
                .build(),
            imageLoader = imageLoader, // Використовуємо кастомний ImageLoader з підтримкою base64
            contentDescription = "Inventory item",
            contentScale = ContentScale.Fit,
            modifier = Modifier.fillMaxSize()
        )

        // Бейдж з числом зверху справа
        Box(
            modifier = Modifier
                .align(Alignment.TopEnd)
                .clip(RoundedCornerShape(3.dp))
                .background(GlassIndigo.copy(alpha = 0.9f))
                .border(
                    width = 0.5.dp,
                    color = GlassIndigoLight.copy(alpha = 0.3f),
                    shape = RoundedCornerShape(3.dp)
                )
                .padding(horizontal = 3.dp, vertical = 1.dp)
        ) {
            Text(
                text = if (item.number % 1.0 == 0.0) {
                    item.number.toInt().toString()
                } else {
                    item.number.toString()
                },
                color = Color.White,
                fontSize = 9.sp,
                fontWeight = FontWeight.Bold
            )
        }
    }
}

