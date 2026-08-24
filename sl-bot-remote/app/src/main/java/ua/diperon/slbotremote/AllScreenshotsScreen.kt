package ua.diperon.slbotremote

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.grid.itemsIndexed
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.window.Dialog
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.outlined.*
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
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

/**
 * Екран перегляду всіх скріншотів
 * Дозволяє вибрати назву файлу і побачити цей файл для всіх проектів
 */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalFoundationApi::class)
@Composable
fun AllScreenshotsScreen(
    apiService: BotApiService,
    onBackClick: () -> Unit
) {
    var allScreenshots by remember { mutableStateOf<Map<String, List<String>>>(emptyMap()) }
    var uniqueFilenames by remember { mutableStateOf<List<String>>(emptyList()) }
    var selectedFilename by remember { mutableStateOf<String?>(null) }
    var refreshTimestamp by remember { mutableLongStateOf(System.currentTimeMillis()) }
    var isLoading by remember { mutableStateOf(true) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var fullscreenImageIndex by remember { mutableStateOf<Int?>(null) } // Стейт для індексу повноекранного зображення
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    // Отримуємо базовий URL з конфігурації
    val baseUrl = remember { ConnectionConfigManager(context).getHttpUrl().removeSuffix("/") }

    val loadData = {
        scope.launch {
            isLoading = true
            errorMessage = null
            refreshTimestamp = System.currentTimeMillis() // Оновлюємо мітку часу для обходу кешу
            try {
                val projectNames = apiService.getProjects()
                val screenshotMap = mutableMapOf<String, List<String>>()
                val allFiles = mutableSetOf<String>()

                for (name in projectNames) {
                    try {
                        val shots = apiService.getScreenshots(name)
                        if (shots.isNotEmpty()) {
                            screenshotMap[name] = shots
                            allFiles.addAll(shots)
                        }
                    } catch (e: Exception) {
                        // Skip projects without screenshots
                    }
                }

                allScreenshots = screenshotMap
                uniqueFilenames = allFiles.toList().sorted()
                if (selectedFilename == null && uniqueFilenames.isNotEmpty()) {
                    selectedFilename = uniqueFilenames.first()
                }
                isLoading = false
            } catch (e: Exception) {
                errorMessage = "Помилка: ${e.message}"
                isLoading = false
            }
        }
    }

    LaunchedEffect(Unit) {
        loadData()
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("Всі Скріншоти", fontWeight = FontWeight.Bold, fontSize = 18.sp)
                        if (uniqueFilenames.isNotEmpty()) {
                            Text(
                                text = "${uniqueFilenames.size} унікальних назв",
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
            } else if (uniqueFilenames.isEmpty()) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text("Скріншоти не знайдено", color = Color.White.copy(alpha = 0.5f))
                }
            } else {
                // Список назв файлів (горизонтальний вибір)
                ScrollableTabRow(
                    selectedTabIndex = uniqueFilenames.indexOf(selectedFilename).coerceAtLeast(0),
                    containerColor = GlassBg,
                    contentColor = MaterialTheme.colorScheme.primary,
                    edgePadding = 16.dp,
                    divider = {}
                ) {
                    uniqueFilenames.forEach { filename ->
                        Tab(
                            selected = selectedFilename == filename,
                            onClick = { selectedFilename = filename },
                            text = { 
                                Text(
                                    text = filename,
                                    fontSize = 12.sp,
                                    maxLines = 1
                                )
                            }
                        )
                    }
                }

                // Відображення скріншотів для вибраної назви
                selectedFilename?.let { filename ->
                    val projectsWithThisFile = allScreenshots.filter { it.value.contains(filename) }.keys.toList()
                    
                    if (projectsWithThisFile.isEmpty()) {
                        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            Text("Немає зображень з такою назвою", color = Color.White.copy(alpha = 0.5f))
                        }
                    } else {
                        LazyVerticalGrid(
                            columns = GridCells.Fixed(2),
                            contentPadding = PaddingValues(12.dp),
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                            verticalArrangement = Arrangement.spacedBy(12.dp),
                            modifier = Modifier.fillMaxSize()
                        ) {
                            itemsIndexed(projectsWithThisFile) { index, projectName ->
                                ScreenshotItem(
                                    projectName = projectName,
                                    filename = filename,
                                    index = index,
                                    baseUrl = baseUrl,
                                    timestamp = refreshTimestamp,
                                    onImageClick = { fullscreenImageIndex = it }
                                )
                            }
                        }
                    }
                }
            }
        }
    }

    // Повноекранний переглядач зображень скріншотів
    if (fullscreenImageIndex != null && selectedFilename != null) {
        val projectsWithThisFile = allScreenshots.filter { it.value.contains(selectedFilename) }.keys.toList()

        val pagerState = rememberPagerState(
            initialPage = fullscreenImageIndex!!,
            pageCount = { projectsWithThisFile.size }
        )

        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.Black)
                .clickable { fullscreenImageIndex = null },
            contentAlignment = Alignment.Center
        ) {
            HorizontalPager(
                state = pagerState,
                modifier = Modifier.fillMaxSize()
            ) { index ->
                val projectName = projectsWithThisFile[index]
                val imageUrl = "$baseUrl/api/screenshots/${projectName}_screenshots/$selectedFilename?t=$refreshTimestamp"

                AsyncImage(
                    model = ImageRequest.Builder(context)
                        .data(imageUrl)
                        .crossfade(true)
                        .diskCachePolicy(coil.request.CachePolicy.DISABLED)
                        .memoryCachePolicy(coil.request.CachePolicy.DISABLED)
                        .build(),
                    contentDescription = "Screenshot image",
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
                    .clickable { } // Запобігає кліку через лічильник
            ) {
                Text(
                    text = "${pagerState.currentPage + 1} / ${projectsWithThisFile.size}",
                    color = Color.White,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }
}

@Composable
fun ScreenshotItem(
    projectName: String,
    filename: String,
    index: Int,
    baseUrl: String,
    timestamp: Long,
    onImageClick: (Int) -> Unit
) {
    val context = LocalContext.current
    // Додаємо timestamp до URL щоб Coil не брав картинку з кешу
    val imageUrl = "$baseUrl/api/screenshots/${projectName}_screenshots/$filename?t=$timestamp"

    Card(
        shape = RoundedCornerShape(24.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White.copy(alpha = 0.06f)),
        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.12f)),
        modifier = Modifier.clickable { onImageClick(index) }
    ) {
        Column {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .aspectRatio(1.5f)
                    .background(Color.Black)
            ) {
                AsyncImage(
                    model = ImageRequest.Builder(context)
                        .data(imageUrl)
                        .crossfade(true)
                        .diskCachePolicy(coil.request.CachePolicy.DISABLED)
                        .memoryCachePolicy(coil.request.CachePolicy.DISABLED)
                        .build(),
                    contentDescription = null,
                    modifier = Modifier.fillMaxSize(),
                    contentScale = ContentScale.Fit
                )
            }

            Text(
                text = projectName,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(8.dp),
                style = MaterialTheme.typography.labelSmall,
                color = Color.White.copy(alpha = 0.3f), // Ледь помітний підпис
                textAlign = TextAlign.Center,
                fontWeight = FontWeight.Light,
                maxLines = 1
            )
        }
    }
}
