package com.example

import android.util.Base64
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
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
    var inventoryItems by remember { mutableStateOf<List<InventoryItem>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var timestamp by remember { mutableStateOf<Long?>(null) }
    val scope = rememberCoroutineScope()

    // Функція завантаження інвентаря
    fun loadInventory() {
        scope.launch {
            isLoading = true
            errorMessage = null
            try {
                val response = apiService.getInventory(projectName)
                inventoryItems = response.data
                timestamp = response.timestamp
                
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

    // Завантаження при відкритті екрану
    LaunchedEffect(projectName) {
        loadInventory()
    }

    Scaffold(
        topBar = {
            TopAppBar(
                modifier = androidx.compose.ui.Modifier.height(42.dp),
                
                title = {
                    Column {
                        Text(
                            text = "Інвентар",
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFF818CF8)
                        )
                        Text(
                            text = projectName,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Normal,
                            color = Color(0xFFCBD5E1)
                        )
                        timestamp?.let {
                            val dateFormat = SimpleDateFormat("dd.MM.yyyy HH:mm", Locale("uk", "UA"))
                            Text(
                                text = "Оновлено: ${dateFormat.format(Date(it))}",
                                fontSize = 10.sp,
                                color = Color(0xFF94A3B8)
                            )
                        }
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(
                            imageVector = Icons.Default.ArrowBack,
                            contentDescription = "Назад",
                            tint = Color(0xFF94A3B8)
                        )
                    }
                },
                actions = {
                    IconButton(onClick = { loadInventory() }) {
                        Icon(
                            imageVector = Icons.Default.Refresh,
                            contentDescription = "Оновити",
                            tint = Color(0xFF818CF8)
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Color(0xFF1E293B)
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
                // Стан завантаження
                isLoading -> {
                    Column(
                        modifier = Modifier.fillMaxSize(),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center
                    ) {
                        CircularProgressIndicator(
                            color = Color(0xFF818CF8),
                            modifier = Modifier.size(48.dp)
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(
                            text = "Завантаження інвентаря...",
                            color = Color(0xFF94A3B8),
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
                            color = Color(0xFFEF4444),
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = errorMessage ?: "",
                            color = Color(0xFF94A3B8),
                            fontSize = 14.sp,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.padding(horizontal = 32.dp)
                        )
                        Spacer(modifier = Modifier.height(24.dp))
                        Button(
                            onClick = { loadInventory() },
                            colors = ButtonDefaults.buttonColors(
                                containerColor = Color(0xFF4F46E5)
                            )
                        ) {
                            Text("Спробувати знову")
                        }
                    }
                }

                // Порожній інвентар
                inventoryItems.isEmpty() -> {
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
                            text = "Інвентар порожній",
                            color = Color(0xFF94A3B8),
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "Запустіть бота з нодою сканування інвентаря",
                            color = Color(0xFF64748B),
                            fontSize = 14.sp,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.padding(horizontal = 32.dp)
                        )
                    }
                }

                // Grid з інвентарем
                else -> {
                    LazyVerticalGrid(
                        columns = GridCells.Adaptive(minSize = 60.dp),
                        contentPadding = PaddingValues(8.dp),
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                        verticalArrangement = Arrangement.spacedBy(6.dp),
                        modifier = Modifier.fillMaxSize()
                    ) {
                        items(inventoryItems) { item ->
                            InventoryItemCard(item)
                        }
                    }
                }
            }
        }
    }
}

/**
 * Картка окремого елемента інвентаря
 */
@Composable
fun InventoryItemCard(item: InventoryItem) {
    val context = LocalContext.current
    
    // Створюємо ImageLoader з підтримкою base64 data URLs
    val imageLoader = remember {
        coil.ImageLoader.Builder(context)
            .components {
                add(Base64Fetcher.Factory())
            }
            .build()
    }
    
    // Отримуємо базовий URL з конфігурації
    val baseUrl = remember { ConnectionConfigManager(context).getHttpUrl().removeSuffix("/") }
    
    // Формуємо повний URL для зображення
    val imageUrl = remember(item.image) {
        when {
            // Якщо це data URL (base64) - залишаємо як є
            item.image.startsWith("data:") -> item.image
            // Якщо це HTTP/HTTPS URL - залишаємо як є
            item.image.startsWith("http://") || item.image.startsWith("https://") -> item.image
            // Якщо це відносний шлях - додаємо base URL
            else -> "$baseUrl${item.image}"
        }
    }
    
    Box(
        modifier = Modifier
            .aspectRatio(1f)
            .clip(RoundedCornerShape(6.dp))
            .background(Color(0xFF1E293B))
            .border(
                width = 1.dp,
                color = Color(0xFF334155),
                shape = RoundedCornerShape(6.dp)
            )
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
                .background(Color(0xFF4F46E5).copy(alpha = 0.9f))
                .border(
                    width = 0.5.dp,
                    color = Color(0xFF818CF8).copy(alpha = 0.3f),
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

