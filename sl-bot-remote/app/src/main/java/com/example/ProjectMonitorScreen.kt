package com.example // Пакет нашого керуючого додатку

import android.graphics.Bitmap // Клас бітмапів для роботи з кадрами трансляції екрану
import androidx.compose.animation.AnimatedVisibility // Анімована видимість компонентів
import androidx.compose.animation.animateColorAsState // Анімація кольорів
import androidx.compose.animation.core.RepeatMode // Режим повторення анімацій
import androidx.compose.animation.core.animateFloat // Анімація числових значень float
import androidx.compose.animation.core.infiniteRepeatable // Безкінечний цикл анімації
import androidx.compose.animation.core.rememberInfiniteTransition // Запам'ятовування циклічних переходів
import androidx.compose.animation.core.tween // Тривалість та форма кривої анімації
import androidx.compose.animation.fadeIn // Плавна поява елементів
import androidx.compose.animation.fadeOut // Плавне зникнення елементів
import androidx.compose.foundation.BorderStroke // Параметри обводки (бордюра)
import androidx.compose.foundation.Canvas // Елемент розширеного малювання фігур
import androidx.compose.foundation.Image // Елемент відображення растрових картинок
import androidx.compose.foundation.background // Задній фон
import androidx.compose.foundation.border // Рамка елементів
import androidx.compose.foundation.clickable // Клікабельність елементів
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectTapGestures // Визначення жестів натискання
import androidx.compose.ui.input.pointer.pointerInput // Ввід жестів
import androidx.compose.ui.layout.onGloballyPositioned // Розмір елементів
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.Arrangement // Вирівнювання структури елементів Row/Column
import androidx.compose.foundation.layout.Box // Контейнер для пошарового макетування
import androidx.compose.foundation.layout.Column // Вертикальна колонка розміщення
import androidx.compose.foundation.layout.PaddingValues // Об'єкт конфігурацій відступів
import androidx.compose.foundation.layout.Row // Горизонтальний рядок елементів
import androidx.compose.foundation.layout.Spacer // Роздільник порожнього простору
import androidx.compose.foundation.layout.aspectRatio // Форматне співвідношення сторін картинки
import androidx.compose.foundation.layout.fillMaxHeight // Розтягнути у повну висоту
import androidx.compose.foundation.layout.fillMaxSize // Розтягнути у повні розміри екрану
import androidx.compose.foundation.layout.fillMaxWidth // Розтягнути у повну ширину
import androidx.compose.foundation.layout.height // Фіксована висота компонента
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding // Маргінальні внутрішні відступи
import androidx.compose.foundation.layout.size // Геометричні лінійні розміри
import androidx.compose.foundation.layout.width // Фіксована ширина компонента
import androidx.compose.foundation.lazy.LazyColumn // Високопродуктивний прокручувальний вертикальний список
import androidx.compose.foundation.lazy.items // Ітератор наповнення елементів для лінивого списку
import androidx.compose.foundation.lazy.rememberLazyListState // Кешування станів прокрутки списку
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.CircleShape // Круглий шаблон геометрії
import androidx.compose.foundation.shape.RoundedCornerShape // Шаблон округлення прямокутних кутів
import androidx.compose.material.icons.Icons // Базові матеріальні векторні значки
import androidx.compose.material.icons.automirrored.filled.ArrowBack // Стрілка назад з підтримкою RTL напрямків
import androidx.compose.material.icons.automirrored.filled.ArrowForward // Стрілка вперед з підтримкою RTL напрямків
import androidx.compose.material.icons.filled.CalendarMonth // Іконка календаря для планувальника
import androidx.compose.material.icons.filled.Delete // Кошик видалення логів
import androidx.compose.material.icons.filled.Edit // Редагування
import androidx.compose.material.icons.filled.Info // Інформаційна кругла бірка
import androidx.compose.material.icons.filled.Language // Іконка браузера (глобус)
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.ChevronLeft
import androidx.compose.material.icons.filled.ChevronRight // Іконка закриття браузера
import androidx.compose.material.icons.filled.Inventory2 // Іконка інвентаря
import androidx.compose.material.icons.filled.PlayArrow // Символ запуску (трикутник відтворення)
import androidx.compose.material.icons.filled.Refresh // Кнопка синхронізації метрик
import androidx.compose.material.icons.filled.Stop // Квадрат термінового зупинення двигуна
import androidx.compose.material.icons.filled.Download // Завантаження історії
import androidx.compose.material.icons.filled.Tv // Екран увімкненої трансляції
import androidx.compose.material.icons.filled.TvOff // Екран вимкненої трансляції
import androidx.compose.material3.Button // Класична кнопка у Material 3
import androidx.compose.material3.ButtonDefaults // Властивості кнопок (колір, висота)
import androidx.compose.material3.Card // Картка блочного відображення Material 3
import androidx.compose.material3.CardDefaults // Стильові налаштування блоку картки
import androidx.compose.material3.CircularProgressIndicator // Обертовий спінер завантаження
import androidx.compose.material3.Divider // Горизонтальна тонка лінія розподілу
import androidx.compose.material3.ExperimentalMaterial3Api // Розблокування експериментальних UI АРІ
import androidx.compose.material3.Icon // Матеріальна векторна іконка
import androidx.compose.material3.IconButton // Кругла кнопка що оперує векторною іконкою
import androidx.compose.material3.MaterialTheme // Шкала стилістики поточної теми додатку
import androidx.compose.material3.OutlinedButton // Контурна кнопка
import androidx.compose.material3.Scaffold // Фундаментальна трирівнева основа розмітки
import androidx.compose.material3.Text // Рендерер текстових полів
import androidx.compose.material3.TopAppBar // Комплект верхнього шапкового меню дій
import androidx.compose.material3.TopAppBarDefaults // Кольори оформлення шапки екрану
import androidx.compose.runtime.Composable // Будівельник UI декларацій Jetpack Compose
import androidx.compose.runtime.DisposableEffect // Слідкувач знищення композиції
import androidx.compose.runtime.LaunchedEffect // Запуск побічних процесів у корутинах
import androidx.compose.runtime.collectAsState // Метод перетворення Flow потоків у Compose-стейт
import androidx.compose.runtime.getValue // Спрощення зчитування змінних
import androidx.compose.runtime.mutableStateOf // Метод декларації локальних змінних
import androidx.compose.runtime.remember // Органайзер збереження значень під час рекомпозицій
import androidx.compose.runtime.setValue // Спрощення перезапису локальних змінних
import androidx.compose.ui.Alignment // Вирівнювання вкладених дочірніх компонентів
import androidx.compose.ui.Modifier // Основна шина налаштувань властивостей елемента
import androidx.compose.ui.draw.alpha // Прозорість елемента
import androidx.compose.ui.draw.clip // Обрізання об'єктів за контурними формами
import androidx.compose.ui.graphics.Color // Формувальник кольорів (ARGB)
import androidx.compose.ui.graphics.asImageBitmap // Конвертер Bitmaps під платформу Jetpack Canvas
import androidx.compose.ui.layout.ContentScale // Конфігурація масштабування фонових зображень
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.platform.testTag // Магічне кріплення тегу тестування
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.PlatformTextStyle
import androidx.compose.ui.text.font.FontFamily // Керування сімейством шрифтів
import androidx.compose.ui.text.font.FontWeight // Керування товщиною літер (Bold/Normal)
import androidx.compose.ui.text.style.TextAlign // Вирівнювання (по центру, зліва)
import androidx.compose.ui.unit.dp // Виміри для макетів (діпі)
import androidx.compose.ui.unit.sp // Виміри для текстових розмірів (шрифтовий пункт)
import androidx.compose.ui.window.Dialog // Системна Compose опора для показу поп-апів
import androidx.compose.ui.window.DialogProperties
import androidx.compose.ui.tooling.preview.Preview
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.example.ui.theme.MyApplicationTheme

/**
 * Головний Compose екран моніторингу конкретного проекту бота в реальному часі.
 * Повністю переведений тільки на українську мову.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProjectMonitorScreen(
    projectName: String, // Конструкторське ім'я вибраного проекту бота
    viewModel: ProjectMonitorViewModel, // Керуюча ViewModel для моніторингу
    onBackClick: () -> Unit, // Клік по стрілці назад
    onNavigateToEditor: (String) -> Unit = {}, // Навігація до веб-редактора нод
    onNavigateToProject: (String) -> Unit = {}, // Навігація до сусіднього проекту
    onNavigateToInventory: (String) -> Unit = {} // Навігація до інвентаря проекту
) {
    // Збір реактивних потоків даних із нашої ViewModel
    val currentProjectName by viewModel.projectName.collectAsState() // Стейт поточного імені проекту у роботі
    val isRunning by viewModel.isBotRunning.collectAsState() // Стейт роботи скрипта бота в реальному часі
    val isStreaming by viewModel.isStreamingGrid.collectAsState() // Стейт активності трансляції потокового відео
    val latestFrame by viewModel.latestFrame.collectAsState() // Стейт останнього графічного фрейма трансляції
    val logs by viewModel.consoleLogs.collectAsState() // Стейт списку логів командного рядка
    val connectionState by viewModel.connectionState.collectAsState() // Стейт з'єднання клієнта по WebSocket
    val isBrowserOpen by viewModel.isBrowserOpen.collectAsState() // Стейт відкритості браузера
    val inventoryItems by viewModel.inventoryItems.collectAsState() // Предмети інвентаря
    val projectVariables by viewModel.projectVariables.collectAsState() // Змінні проекту
    val screenshots by viewModel.screenshots.collectAsState() // Скріншоти проекту
    val showGallery by viewModel.showGallery.collectAsState() // Стейт відображення галереї скріншотів

    val context = androidx.compose.ui.platform.LocalContext.current
    val inventoryPrefs = remember { InventoryPreferences(context) }
    // Кешуємо поточний порядок
    val inventoryOrder = remember(inventoryPrefs) { inventoryPrefs.getInventoryOrder() }

    // Налаштувати та запустити підключення WebSocket при переході на цей екран
    LaunchedEffect(projectName) {
        viewModel.selectProject(projectName)
    }

    // Безпечне закриття та деактивація трансляцій при виході з екрану для звільнення трафіку
    DisposableEffect(Unit) {
        onDispose {
            viewModel.onExit()
        }
    }

    ProjectMonitorContent(
        projectName = projectName,
        currentProjectName = currentProjectName,
        isRunning = isRunning,
        isStreaming = isStreaming,
        isBrowserOpen = isBrowserOpen,
        latestFrame = latestFrame,
        logs = logs,
        connectionState = connectionState,
        inventoryItems = inventoryItems,
        projectVariables = projectVariables,
        inventoryOrder = inventoryOrder,
        screenshots = screenshots,
        showGallery = showGallery,
        onBackClick = onBackClick,
        onNavigateToEditor = onNavigateToEditor,
        onRefreshStats = { viewModel.fetchRestStats() },
        onToggleStream = { viewModel.toggleStream() },
        onStartBot = { viewModel.runBot() },
        onStopBot = { viewModel.stopBot() },
        onToggleBrowser = { viewModel.toggleBrowser() },
        onPrevProject = { viewModel.navigateProject(-1, onNavigateToProject) },
        onNextProject = { viewModel.navigateProject(1, onNavigateToProject) },
        onClearLogs = { viewModel.clearConsole() },
        onLoadHistory = { viewModel.fetchHistoricLogs() },
        onNavigateToInventory = onNavigateToInventory,
        onDeleteScreenshot = { viewModel.deleteScreenshot(it) },
        onToggleGallery = { viewModel.toggleGallery() },
        onSendMouseClick = { x, y, w, h -> viewModel.sendMouseClick(x, y, w, h) },
        onSendScroll = { dx, dy -> viewModel.sendScroll(dx, dy) }
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProjectMonitorContent(
    projectName: String,
    currentProjectName: String,
    isRunning: Boolean,
    isStreaming: Boolean,
    isBrowserOpen: Boolean,
    latestFrame: Bitmap?,
    logs: List<LogEntry>,
    connectionState: ConnectionState,
    inventoryItems: List<InventoryItem>,
    projectVariables: Map<String, Any>,
    inventoryOrder: List<String>,
    screenshots: List<String>,
    showGallery: Boolean,
    onBackClick: () -> Unit,
    onNavigateToEditor: (String) -> Unit,
    onRefreshStats: () -> Unit,
    onToggleStream: () -> Unit,
    onStartBot: () -> Unit,
    onStopBot: () -> Unit,
    onToggleBrowser: () -> Unit,
    onPrevProject: () -> Unit,
    onNextProject: () -> Unit,
    onClearLogs: () -> Unit,
    onLoadHistory: () -> Unit,
    onNavigateToInventory: (String) -> Unit,
    onDeleteScreenshot: (String) -> Unit,
    onToggleGallery: () -> Unit,
    onSendMouseClick: (Float, Float, Int, Int) -> Unit,
    onSendScroll: (Float, Float) -> Unit
) {
    // Локальні змінні тригерів для активації нових діалогових вікон
    var isFullScreenStream by remember { mutableStateOf(false) } // Діалог на весь екран

    val scrollState = androidx.compose.foundation.rememberScrollState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            text = "Проект", // Перекладено
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                        Text(
                            text = currentProjectName, // Назва поточного бота
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.primary,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                },
                navigationIcon = {
                    IconButton(
                        onClick = onBackClick,
                        modifier = Modifier.testTag("monitor_back_button")
                    ) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Назад до панелі", // Перекладено
                            tint = Color.White
                        )
                    }
                },
                actions = {
                    // Кнопка редагування проекту (відкриває веб-редактор нод)
                    IconButton(
                        onClick = { onNavigateToEditor(projectName) },
                        modifier = Modifier.testTag("monitor_edit_project")
                    ) {
                        Icon(
                            imageVector = Icons.Default.Edit,
                            contentDescription = "Редагувати проект", // Перекладено
                            tint = Color.White
                        )
                    }
                    
                    // Кнопка швидкого оновлення метрик статистики
                    IconButton(
                        onClick = onRefreshStats,
                        modifier = Modifier.testTag("monitor_refresh_stats")
                    ) {
                        Icon(
                            imageVector = Icons.Default.Refresh,
                            contentDescription = "Оновити метрики", // Перекладено
                            tint = Color.White
                        )
                    }
                    
                    // Віджет-бейдж підключення WebSocket у реальному часі
                    ConnectionBadge(connectionState = connectionState)
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Color(0xFF14161B) // Темна шапка
                )
            )
        },
        containerColor = MaterialTheme.colorScheme.background // Темний фокус-фон
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(horizontal = 16.dp)
                .then(if (showGallery) Modifier.verticalScroll(scrollState) else Modifier),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Верхня частина - трансляція браузера
            LiveStreamComponent(
                modifier = if (showGallery) Modifier.fillMaxWidth().height(280.dp) else Modifier.fillMaxWidth().weight(1.5f),
                isStreamingActive = isStreaming,
                frameBitmap = latestFrame,
                isBotRunning = isRunning,
                onToggleStream = onToggleStream,
                onFullScreenClick = { isFullScreenStream = true }
            )

            // Середня частина
            Row(
                modifier = if (showGallery) Modifier.fillMaxWidth().height(130.dp) else Modifier.fillMaxWidth().weight(1f),
                horizontalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Середина зліва - Інвентар
                ProjectInventoryCard(
                    modifier = Modifier.weight(1.3f),
                    inventoryItems = inventoryItems,
                    projectVariables = projectVariables,
                    inventoryOrder = inventoryOrder,
                    onOpenInventory = { 
                        onNavigateToInventory(projectName)
                    }
                )

                // Середина зправа - Контроль двигуна
                StatusControlCard(
                    modifier = Modifier.weight(0.7f),
                    isBotRunning = isRunning,
                    isBrowserOpen = isBrowserOpen,
                    onStartClick = onStartBot,
                    onStopClick = onStopBot,
                    onToggleBrowser = onToggleBrowser,
                    onPrevProject = onPrevProject,
                    onNextProject = onNextProject
                )
            }

            // Нижня частина - Консоль або Галерея
            if (!showGallery) {
                LogConsoleComponent(
                    modifier = Modifier.weight(1f),
                    logs = logs,
                    onClearClick = onClearLogs,
                    onLoadHistoryClick = onLoadHistory,
                    onToggleGallery = onToggleGallery
                )
            } else {
                ScreenshotGalleryComponent(
                    modifier = Modifier.fillMaxWidth().height(500.dp),
                    projectName = projectName,
                    screenshots = screenshots,
                    onDeleteScreenshot = onDeleteScreenshot,
                    onToggleConsole = onToggleGallery
                )
                Spacer(modifier = Modifier.height(16.dp))
            }
        }

        if (isFullScreenStream) {
            FullScreenStreamDialog(
                frameBitmap = latestFrame,
                onDismiss = { isFullScreenStream = false },
                onSendClick = onSendMouseClick,
                onSendScroll = onSendScroll
            )
        }
    }
}

/**
 * Віджет відображення сокет-з'єднання з сервером.
 * Переведений на українську.
 */
@Composable
fun ConnectionBadge(connectionState: ConnectionState) {
    val (color, text) = when (connectionState) {
        ConnectionState.CONNECTED -> Color(0xFF10B981) to "ПІДКЛЮЧЕНО" // Перекладено
        ConnectionState.CONNECTING -> Color(0xFFF59E0B) to "З'ЄДНАННЯ" // Перекладено
        ConnectionState.DISCONNECTED -> Color(0xFF64748B) to "ОФЛАЙН" // Перекладено
        ConnectionState.ERROR -> Color(0xFFEF4444) to "ПОМИЛКА" // Перекладено
    }

    Row(
        modifier = Modifier
            .padding(end = 12.dp)
            .border(BorderStroke(1.dp, color.copy(alpha = 0.5f)), RoundedCornerShape(12.dp))
            .background(color.copy(alpha = 0.1f), RoundedCornerShape(12.dp))
            .padding(horizontal = 10.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(8.dp)
                .background(color, CircleShape)
        )
        Spacer(modifier = Modifier.width(6.dp))
        Text(
            text = text,
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.Bold,
            color = color,
            fontSize = 9.sp
        )
    }
}

/**
 * Візуальне вікно трансляції віртуального сеансу Google Chrome (Playwright).
 */
@Composable
fun LiveStreamComponent(
    modifier: Modifier = Modifier,
    isStreamingActive: Boolean, // Стан запущеної ретрансляції картинок
    frameBitmap: Bitmap?, // Наявний бітмап фрейма
    isBotRunning: Boolean, // Стан активності скрипта бота
    onToggleStream: () -> Unit, // Метод включення/виключення стріму
    onFullScreenClick: () -> Unit // Клік на весь екран
) {
    val infiniteTransition = rememberInfiniteTransition(label = "pulse")
    val pulseAlpha by infiniteTransition.animateFloat(
        initialValue = 0.4f,
        targetValue = 1.0f,
        animationSpec = infiniteRepeatable(
            animation = tween(1200),
            repeatMode = RepeatMode.Reverse
        ),
        label = "pulse_animation"
    )

    Card(
        modifier = modifier.fillMaxHeight(),
        shape = RoundedCornerShape(32.dp),
        colors = CardDefaults.cardColors(
            containerColor = Color(0xFF1C1F26)
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 8.dp),
        border = BorderStroke(
            1.dp, 
            if (isStreamingActive) MaterialTheme.colorScheme.primary.copy(alpha = 0.5f)
            else Color.White.copy(alpha = 0.05f)
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(12.dp)
        ) {
            // Лицьовий хедер блока
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Default.Tv,
                        contentDescription = null,
                        tint = if (isStreamingActive) MaterialTheme.colorScheme.primary else Color.White.copy(alpha = 0.6f),
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "Вікно браузера", // Перекладено
                        style = MaterialTheme.typography.labelLarge,
                        color = Color.White,
                        fontWeight = FontWeight.Bold
                    )
                }

                // Пульсуючий маркер активності трансляції екрану
                if (isStreamingActive) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.alpha(pulseAlpha)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(6.dp)
                                .background(Color(0xFFEF4444), CircleShape)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = "ТРАНСЛЯЦІЯ", // Перекладено
                            style = MaterialTheme.typography.labelSmall,
                            color = Color(0xFFEF4444),
                            fontWeight = FontWeight.Bold,
                            fontSize = 9.sp
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            // Полотно виводу зображення або замінник
            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(24.dp))
                    .background(Color(0xFF050505))
                    .border(BorderStroke(1.dp, Color.White.copy(alpha = 0.05f)), RoundedCornerShape(24.dp))
                    .clickable { if (isStreamingActive && frameBitmap != null) onFullScreenClick() },
                contentAlignment = Alignment.Center
            ) {
                if (isStreamingActive && frameBitmap != null) {
                    // Малювання отриманого з бекенду знімку екрана Google Chrome
                    Image(
                        bitmap = frameBitmap.asImageBitmap(),
                        contentDescription = "Пряма трансляція headless браузера Playwright",
                        modifier = Modifier.fillMaxSize(),
                        contentScale = ContentScale.Fit
                    )
                } else {
                    // Альтернативний вигляд при деактивованій трансляції
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center,
                        modifier = Modifier.padding(16.dp)
                    ) {
                        Icon(
                            imageVector = if (isStreamingActive) Icons.Default.Tv else Icons.Default.TvOff,
                            contentDescription = null,
                            tint = Color.White.copy(alpha = 0.15f),
                            modifier = Modifier.size(48.dp)
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = if (isStreamingActive) "Очікування кадрів від Playwright..." else "Трансляцію екрану призупинено", // Перекладено
                            style = MaterialTheme.typography.bodySmall,
                            color = Color.White.copy(alpha = 0.4f),
                            textAlign = TextAlign.Center
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            // Кнопка включення/виключення трансляції екрану
            Button(
                onClick = onToggleStream,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(44.dp)
                    .testTag("stream_toggle_button"),
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (isStreamingActive) Color(0xFFEF4444) else MaterialTheme.colorScheme.primary,
                    contentColor = if (isStreamingActive) Color.White else Color.Black
                ),
                shape = RoundedCornerShape(10.dp),
                contentPadding = PaddingValues(0.dp)
            ) {
                Icon(
                    imageVector = if (isStreamingActive) Icons.Default.TvOff else Icons.Default.Tv,
                    contentDescription = null,
                    modifier = Modifier.size(16.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = if (isStreamingActive) "Зупинити трансляцію" else "Транслювати екран браузера", // Перекладено
                    style = MaterialTheme.typography.labelLarge,
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }
}

/**
 * Пульт керування механізмом симуляції дій.
 */
@Composable
fun StatusControlCard(
    modifier: Modifier = Modifier,
    isBotRunning: Boolean,
    isBrowserOpen: Boolean,
    onStartClick: () -> Unit,
    onStopClick: () -> Unit,
    onToggleBrowser: () -> Unit,
    onPrevProject: () -> Unit,
    onNextProject: () -> Unit
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(24.dp),
        colors = CardDefaults.cardColors(
            containerColor = Color(0xFF1C1F26) // Темно-синій відтінок
        ),
        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.05f))
    ) {
        Column(
            modifier = Modifier.padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            // Ряд 1: Навігація (Попередній / Наступний)
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Button(
                    onClick = onPrevProject,
                    modifier = Modifier.weight(1f).height(54.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color.White.copy(alpha = 0.05f),
                        contentColor = Color.White
                    ),
                    shape = RoundedCornerShape(16.dp),
                    contentPadding = PaddingValues(0.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.ChevronLeft,
                        contentDescription = "Попередній проект",
                        modifier = Modifier.size(24.dp)
                    )
                }

                Button(
                    onClick = onNextProject,
                    modifier = Modifier.weight(1f).height(54.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color.White.copy(alpha = 0.05f),
                        contentColor = Color.White
                    ),
                    shape = RoundedCornerShape(16.dp),
                    contentPadding = PaddingValues(0.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.ChevronRight,
                        contentDescription = "Наступний проект",
                        modifier = Modifier.size(24.dp)
                    )
                }
            }

            // Ряд 2: Керування (Браузер / Бот)
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                // Кнопка браузера
                Button(
                    onClick = onToggleBrowser,
                    modifier = Modifier.weight(1f).height(54.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (isBrowserOpen) Color(0xFFEF4444).copy(alpha = 0.2f) else Color.White.copy(alpha = 0.05f),
                        contentColor = if (isBrowserOpen) Color(0xFFEF4444) else Color.White
                    ),
                    shape = RoundedCornerShape(16.dp),
                    contentPadding = PaddingValues(0.dp)
                ) {
                    Icon(
                        imageVector = if (isBrowserOpen) Icons.Default.Close else Icons.Default.Language,
                        contentDescription = null,
                        modifier = Modifier.size(22.dp)
                    )
                }

                // Кнопка бота
                Button(
                    onClick = if (isBotRunning) onStopClick else onStartClick,
                    modifier = Modifier.weight(1f).height(54.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (isBotRunning) Color(0xFFEF4444) else Color(0xFF10B981),
                        contentColor = Color.White
                    ),
                    shape = RoundedCornerShape(16.dp),
                    contentPadding = PaddingValues(0.dp)
                ) {
                    Icon(
                        imageVector = if (isBotRunning) Icons.Default.Stop else Icons.Default.PlayArrow,
                        contentDescription = null,
                        modifier = Modifier.size(22.dp)
                    )
                }
            }
        }
    }
}

@Composable
fun VariableItem(
    iconRes: Int,
    value: String,
    color: Color,
    modifier: Modifier = Modifier
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        modifier = modifier
    ) {
        Icon(
            painter = painterResource(id = iconRes),
            contentDescription = null,
            modifier = Modifier.size(16.dp),
            tint = Color.Unspecified
        )
        Text(
            text = value,
            color = color,
            fontWeight = FontWeight.Bold,
            fontSize = 12.sp
        )
    }
}

@Composable
fun ProjectInventoryCard(
    modifier: Modifier = Modifier,
    inventoryItems: List<InventoryItem>,
    projectVariables: Map<String, Any>,
    inventoryOrder: List<String>,
    onOpenInventory: () -> Unit
) {
    // Сортуємо предмети згідно збереженого порядку (пріоритетні спочатку)
    val sortedItems = remember(inventoryItems, inventoryOrder) {
        val orderMap = inventoryOrder.mapIndexed { index, name -> name.lowercase() to index }.toMap()
        inventoryItems.sortedWith { a, b ->
            // Витягуємо назву предмета з URL, наприклад "Blueberry" або залишаємо весь рядок
            val nameA = a.image.substringAfterLast("/").substringBeforeLast(".").lowercase()
            val nameB = b.image.substringAfterLast("/").substringBeforeLast(".").lowercase()

            // Якщо точний збіг не знайдено, перевіряємо, чи містить URL частину з пріоритетного списку
            val indexA = orderMap[nameA] ?: orderMap.entries.firstOrNull { a.image.lowercase().contains(it.key) }?.value ?: Int.MAX_VALUE
            val indexB = orderMap[nameB] ?: orderMap.entries.firstOrNull { b.image.lowercase().contains(it.key) }?.value ?: Int.MAX_VALUE

            indexA.compareTo(indexB)
        }.take(15) // Беремо тільки перші 15
    }

    // Витягуємо змінні. Якщо їх немає, буде "0"
    val lv = projectVariables["LV"]?.toString() ?: "0"
    val goldValue = projectVariables["Золото"]
    val goldNum = if (goldValue is Number) goldValue.toInt() else (goldValue?.toString()?.toDoubleOrNull()?.toInt() ?: 0)
    val flower = projectVariables["FLOWER"]?.toString() ?: "0"

    Card(
        modifier = modifier
            .fillMaxWidth()
            .clickable(onClick = onOpenInventory), // Весь блок є кнопкою
        shape = RoundedCornerShape(24.dp),
        colors = CardDefaults.cardColors(
            containerColor = Color(0xFF1C1F26)
        ),
        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.05f))
    ) {
        Column(
            modifier = Modifier.padding(12.dp).fillMaxSize(),
            verticalArrangement = Arrangement.Top
        ) {
            // Верхній ряд із даними змінних
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                VariableItem(
                    iconRes = R.drawable.ic_xp_arrow,
                    value = lv,
                    color = Color(0xFF818CF8)
                )
                VariableItem(
                    iconRes = R.drawable.ic_coins,
                    value = goldNum.toString(),
                    color = Color(0xFFFBBF24)
                )
                VariableItem(
                    iconRes = R.drawable.ic_sfl_flower,
                    value = flower,
                    color = Color(0xFF6615C2)
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Нижня частина з сіткою інвентаря (до 15 предметів)
            if (sortedItems.isEmpty()) {
                Box(modifier = Modifier.fillMaxSize().weight(1f), contentAlignment = Alignment.Center) {
                    Icon(
                        imageVector = Icons.Default.Inventory2,
                        contentDescription = null,
                        tint = Color.White.copy(alpha = 0.1f),
                        modifier = Modifier.size(32.dp)
                    )
                }
            } else {
                LazyVerticalGrid(
                    columns = GridCells.Adaptive(minSize = 36.dp),
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                    modifier = Modifier.fillMaxWidth().weight(1f),
                    userScrollEnabled = false // Вимикаємо скрол, щоб не заважав кліку по картці
                ) {
                    items(sortedItems) { item ->
                        MiniInventoryItemCard(item)
                    }
                }
            }
        }
    }
}

/**
 * Міні-картка окремого елемента інвентаря
 */
@Composable
fun MiniInventoryItemCard(item: InventoryItem) {
    val context = LocalContext.current
    
    // Отримуємо базовий URL з конфігурації
    val baseUrl = remember { ConnectionConfigManager(context).getHttpUrl().removeSuffix("/") }
    
    // Формуємо повний URL для зображення
    val imageUrl = remember(item.image) {
        when {
            item.image.startsWith("data:") -> item.image
            item.image.startsWith("http://") || item.image.startsWith("https://") -> item.image
            else -> "$baseUrl${item.image}"
        }
    }
    
    val imageLoader = remember {
        coil.ImageLoader.Builder(context)
            .components {
                add(Base64Fetcher.Factory())
            }
            .build()
    }

    Box(
        modifier = Modifier
            .aspectRatio(1f)
            .clip(RoundedCornerShape(4.dp))
            .background(Color(0xFF1E293B))
            .border(
                width = 0.5.dp,
                color = Color(0xFF334155),
                shape = RoundedCornerShape(4.dp)
            )
            .padding(2.dp)
    ) {
        // Зображення
        AsyncImage(
            model = ImageRequest.Builder(context)
                .data(imageUrl)
                .crossfade(true)
                .allowHardware(false)
                .build(),
            imageLoader = imageLoader,
            contentDescription = null,
            contentScale = ContentScale.Fit,
            modifier = Modifier.fillMaxSize()
        )

        // Бейдж з числом зверху справа
        Box(
            modifier = Modifier
                .align(Alignment.TopEnd)
                .clip(RoundedCornerShape(2.dp))
                .background(Color(0xFF0F0B4F).copy(alpha = 1f))
                .padding(horizontal = 2.dp, vertical = 0.dp)
        ) {
            Text(
                text = if (item.number % 1.0 == 0.0) {
                    item.number.toInt().toString()
                } else {
                    item.number.toString()
                },
                color = Color.White,
                fontSize = 7.sp,
                fontWeight = FontWeight.Bold,
                style = TextStyle(
                    platformStyle = PlatformTextStyle(includeFontPadding = false),
                    lineHeight = 6.sp
                ),
                modifier = Modifier.offset(y = (-0.5).dp)
            )
        }
    }
}

@Composable
fun StatMetricLine(label: String, value: String, color: Color = Color.White) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelMedium,
            color = Color.White.copy(alpha = 0.5f)
        )
        Text(
            text = value,
            style = MaterialTheme.typography.labelLarge,
            color = color,
            fontWeight = FontWeight.Bold
        )
    }
}

/**
 * Візуальне відображення системного консольного терміналу подій розробника.
 */
@Composable
fun LogConsoleComponent(
    modifier: Modifier = Modifier,
    logs: List<LogEntry>,
    onClearClick: () -> Unit,
    onLoadHistoryClick: () -> Unit,
    onToggleGallery: () -> Unit
) {
    val listState = rememberLazyListState()

    // Плавна автоматична прокрутка до найсвіжіших лог-записів знизу
    LaunchedEffect(logs.size) {
        if (logs.isNotEmpty()) {
            listState.animateScrollToItem(logs.size - 1)
        }
    }

    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(24.dp),
        colors = CardDefaults.cardColors(
            containerColor = Color(0xFF1C1F26)
        ),
        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.05f)),
        elevation = CardDefaults.cardElevation(defaultElevation = 8.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(12.dp)
        ) {
            // Заголовок панелі та кнопка стирання кешу
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Default.Info,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = "Консоль", // Перекладено
                        style = MaterialTheme.typography.labelLarge,
                        color = Color.White,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    IconButton(
                        onClick = onToggleGallery,
                        modifier = Modifier.size(24.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Tv, // Використовуємо Tv як іконку галереї/скрінів
                            contentDescription = "Показати скріншоти",
                            tint = Color.White.copy(alpha = 0.5f),
                            modifier = Modifier.size(16.dp)
                        )
                    }
                }

                Row {
                    IconButton(
                        onClick = onLoadHistoryClick,
                        modifier = Modifier
                            .size(28.dp)
                            .testTag("load_history_button")
                    ) {
                        Icon(
                            imageVector = Icons.Default.Download,
                            contentDescription = "Завантажити історію", // Перекладено
                            tint = Color.White.copy(alpha = 0.5f),
                            modifier = Modifier.size(16.dp)
                        )
                    }
                    Spacer(modifier = Modifier.width(8.dp))
                    IconButton(
                        onClick = onClearClick,
                        modifier = Modifier
                            .size(28.dp)
                            .testTag("clear_console_button")
                    ) {
                        Icon(
                            imageVector = Icons.Default.Delete,
                            contentDescription = "Очистити консоль", // Перекладено
                            tint = Color.White.copy(alpha = 0.5f),
                            modifier = Modifier.size(16.dp)
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            // Тіло консолі
            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(Color(0xFF050505))
                    .border(BorderStroke(1.dp, Color.White.copy(alpha = 0.05f)), RoundedCornerShape(16.dp))
                    .padding(12.dp)
            ) {
                if (logs.isEmpty()) {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "Очікування логів від Playwright...", // Перекладено
                            style = MaterialTheme.typography.bodySmall,
                            color = Color.White.copy(alpha = 0.3f),
                            fontFamily = FontFamily.Monospace
                        )
                    }
                } else {
                    LazyColumn(
                        state = listState,
                        modifier = Modifier.fillMaxSize(),
                        verticalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        items(logs, key = { logItem -> logItem.id }) { logItem ->
                            LogConsoleLineItem(log = logItem)
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun ScreenshotGalleryComponent(
    modifier: Modifier = Modifier,
    projectName: String,
    screenshots: List<String>,
    onDeleteScreenshot: (String) -> Unit,
    onToggleConsole: () -> Unit
) {
    val context = LocalContext.current
    val baseUrl = remember { ConnectionConfigManager(context).getHttpUrl().removeSuffix("/") }

    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(24.dp),
        colors = CardDefaults.cardColors(
            containerColor = Color(0xFF1C1F26)
        ),
        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.05f)),
        elevation = CardDefaults.cardElevation(defaultElevation = 8.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(12.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Default.Tv,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = "Скріншоти",
                        style = MaterialTheme.typography.labelLarge,
                        color = Color.White,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    IconButton(
                        onClick = onToggleConsole,
                        modifier = Modifier.size(24.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Info,
                            contentDescription = "Показати консоль",
                            tint = Color.White.copy(alpha = 0.5f),
                            modifier = Modifier.size(16.dp)
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(Color(0xFF050505))
                    .border(BorderStroke(1.dp, Color.White.copy(alpha = 0.05f)), RoundedCornerShape(16.dp))
            ) {
                if (screenshots.isEmpty()) {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "Скріншоти відсутні",
                            style = MaterialTheme.typography.bodySmall,
                            color = Color.White.copy(alpha = 0.3f),
                            fontFamily = FontFamily.Monospace
                        )
                    }
                } else {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(8.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(screenshots) { filename ->
                            val imageUrl = "$baseUrl/api/screenshots/${projectName}_screenshots/$filename"

                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(200.dp)
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(Color(0xFF1C1F26))
                                    .border(BorderStroke(1.dp, Color.White.copy(alpha = 0.05f)), RoundedCornerShape(12.dp))
                            ) {
                                AsyncImage(
                                    model = ImageRequest.Builder(context)
                                        .data(imageUrl)
                                        .crossfade(true)
                                        .build(),
                                    contentDescription = filename,
                                    modifier = Modifier.fillMaxSize(),
                                    contentScale = ContentScale.Crop
                                )

                                IconButton(
                                    onClick = { onDeleteScreenshot(filename) },
                                    modifier = Modifier
                                        .align(Alignment.TopEnd)
                                        .padding(4.dp)
                                        .size(28.dp)
                                        .background(Color.Black.copy(alpha = 0.5f), CircleShape)
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.Delete,
                                        contentDescription = "Видалити",
                                        tint = Color.White,
                                        modifier = Modifier.size(16.dp)
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

/**
 * Візуальне відображення рядка логування з вибором кольору згідно рівня події.
 */
@Composable
fun LogConsoleLineItem(log: LogEntry) {
    val (textColor, bgColor, labelText) = when (log.type.lowercase().trim()) {
        "success" -> Triple(Color(0xFF10B981), Color(0xFF10B981).copy(alpha = 0.08f), "[УСПІХ]") // Перекладено
        "error" -> Triple(Color(0xFFEF4444), Color(0xFFEF4444).copy(alpha = 0.08f), "[ПОМИЛКА]") // Перекладено
        "debug" -> Triple(Color(0xFF94A3B8), Color(0xFF94A3B8).copy(alpha = 0.08f), "[ВІДЛАДКА]") // Перекладено
        else -> Triple(Color(0xFF38BDF8), Color(0xFF38BDF8).copy(alpha = 0.08f), "[ІНФО]") // Перекладено
    }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(4.dp))
            .background(bgColor)
            .padding(horizontal = 8.dp, vertical = 6.dp),
        verticalAlignment = Alignment.Top
    ) {
        // Час формування події
        Text(
            text = log.timestamp,
            color = Color.White.copy(alpha = 0.35f),
            style = MaterialTheme.typography.bodySmall,
            fontFamily = FontFamily.Monospace,
            fontSize = 11.sp,
            modifier = Modifier.padding(end = 8.dp)
        )

        // Тег рівня події
        Text(
            text = labelText,
            color = textColor,
            style = MaterialTheme.typography.bodySmall,
            fontFamily = FontFamily.Monospace,
            fontWeight = FontWeight.Bold,
            fontSize = 11.sp,
            modifier = Modifier.padding(end = 8.dp)
        )

        // Текст логування
        Text(
            text = log.text,
            color = Color.White.copy(alpha = 0.9f),
            style = MaterialTheme.typography.bodySmall,
            fontFamily = FontFamily.Monospace,
            fontSize = 11.sp,
            modifier = Modifier.weight(1f)
        )
    }
}

/**
 * Діалог повної статистики запуску проекту з реальним круговим графіком на Canvas.
 */
@Composable
fun StatsDetailsDialog(
    projectName: String, // Назва бота
    stats: ProjectStats?, // Модель даних статистики
    onDismiss: () -> Unit // Закрити діалогове вікно
) {
    Dialog(onDismissRequest = onDismiss) {
        Card(
            shape = RoundedCornerShape(28.dp),
            colors = CardDefaults.cardColors(
                containerColor = Color(0xFF1C1F26) // Наш темний колір
            ),
            border = BorderStroke(1.dp, Color.White.copy(alpha = 0.08f)),
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = "ДЕТАЛЬНА СТАТИСТИКА", // Заголовок в українській локалізації
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFF10B981),
                    letterSpacing = 1.5.sp
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = projectName,
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                )

                Spacer(modifier = Modifier.height(24.dp))

                if (stats == null || stats.totalRuns == 0) {
                    // Якщо бот ще жодного разу не запускався
                    Text(
                        text = "Метрики запусків відсутні.\nЗапустіть процес автоматизації принаймні один раз, щоб сформувати графіки успішності.",
                        fontSize = 13.sp,
                        color = Color.White.copy(alpha = 0.4f),
                        textAlign = TextAlign.Center,
                        modifier = Modifier.padding(vertical = 32.dp)
                    )
                } else {
                    val total = stats.totalRuns
                    val success = stats.successfulRuns
                    val failed = stats.failedRuns
                    val successRate = (success.toFloat() / total.toFloat() * 100f).toInt() // Відсоток успішності

                    // Кругова крута діаграма (Pie Chart / Donut Chart) побудована напряму на Canvas з Material 3 контрастами
                    Box(
                        contentAlignment = Alignment.Center,
                        modifier = Modifier.size(140.dp)
                    ) {
                        Canvas(modifier = Modifier.size(120.dp)) {
                            val successAngle = (success.toFloat() / total.toFloat()) * 360f
                            val failedAngle = (failed.toFloat() / total.toFloat()) * 360f

                            // Сектор Успішно (Зелений)
                            drawArc(
                                color = Color(0xFF10B981),
                                startAngle = -90f,
                                sweepAngle = successAngle,
                                useCenter = true
                            )

                            // Сектор Помилок (Червоний)
                            drawArc(
                                color = Color(0xFFEF4444),
                                startAngle = -90f + successAngle,
                                sweepAngle = failedAngle,
                                useCenter = true
                            )
                        }
                        
                        // Декоративне внутрішнє коло для перетворення кругової діаграми на Donut Chart у футуристичному стилі
                        Box(
                            modifier = Modifier
                                .size(76.dp)
                                .background(Color(0xFF1C1F26), CircleShape),
                            contentAlignment = Alignment.Center
                        ) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Text(
                                    text = "$successRate%",
                                    fontSize = 18.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Color.White
                                )
                                Text(
                                    text = "успіху", // Маленький текст успішності
                                    fontSize = 9.sp,
                                    color = Color.White.copy(alpha = 0.5f)
                                )
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(24.dp))

                    // Структуроване відображення числових значень під графіком
                    Column(
                        modifier = Modifier.fillMaxWidth(),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        StatMetricLine(label = "Загальна кількість запусків", value = "$total")
                        StatMetricLine(label = "Виконано успішно", value = "$success", color = Color(0xFF10B981))
                        StatMetricLine(label = "Невдалі запуски (помилки)", value = "$failed", color = Color(0xFFEF4444))
                        StatMetricLine(label = "Коефіцієнт успішності (Success Rate)", value = "$successRate%", color = Color(0xFF10B981))

                        // Якщо маємо точну дату завершення останнього циклу
                        if (stats.lastRunTime != null) {
                            Spacer(modifier = Modifier.height(8.dp))
                            Divider(color = Color.White.copy(alpha = 0.08f))
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = "Останній запуск: ${stats.lastRunTime}",
                                style = MaterialTheme.typography.labelSmall,
                                color = Color.White.copy(alpha = 0.4f),
                                fontSize = 11.sp,
                                modifier = Modifier.fillMaxWidth(),
                                textAlign = TextAlign.Center
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(24.dp))

                Button(
                    onClick = onDismiss,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(46.dp),
                    shape = RoundedCornerShape(16.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color(0xFF10B981),
                        contentColor = Color.Black
                    )
                ) {
                    Text("OK", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                }
            }
        }
    }
}

@Composable
fun FullScreenStreamDialog(
    frameBitmap: android.graphics.Bitmap?,
    onDismiss: () -> Unit,
    onSendClick: (x: Float, y: Float, width: Int, height: Int) -> Unit,
    onSendScroll: (deltaX: Float, deltaY: Float) -> Unit
) {
    if (frameBitmap == null) return

    Dialog(
        onDismissRequest = onDismiss,
        properties = androidx.compose.ui.window.DialogProperties(
            usePlatformDefaultWidth = false,
            dismissOnBackPress = true,
            dismissOnClickOutside = true
        )
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.Black)
        ) {
            var boxSize by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf(androidx.compose.ui.geometry.Size.Zero) }

            Image(
                bitmap = frameBitmap.asImageBitmap(),
                contentDescription = "Full Screen Stream",
                modifier = Modifier
                    .fillMaxSize()
                    .onGloballyPositioned { coordinates ->
                        boxSize = androidx.compose.ui.geometry.Size(
                            coordinates.size.width.toFloat(),
                            coordinates.size.height.toFloat()
                        )
                    }
                    .pointerInput(Unit) {
                        detectTapGestures(
                            onTap = { offset ->
                                val imgW = frameBitmap.width.toFloat()
                                val imgH = frameBitmap.height.toFloat()
                                val boxW = boxSize.width
                                val boxH = boxSize.height

                                if (boxW <= 0 || boxH <= 0) return@detectTapGestures

                                val imgAspect = imgW / imgH
                                val boxAspect = boxW / boxH

                                var drawW = boxW
                                var drawH = boxH
                                var offsetX = 0f
                                var offsetY = 0f

                                if (boxAspect > imgAspect) {
                                    // letterbox: чорні смуги зліва/справа
                                    drawH = boxH
                                    drawW = drawH * imgAspect
                                    offsetX = (boxW - drawW) / 2f
                                } else {
                                    // pillarbox: чорні смуги зверху/знизу
                                    drawW = boxW
                                    drawH = drawW / imgAspect
                                    offsetY = (boxH - drawH) / 2f
                                }

                                val tapX = offset.x - offsetX
                                val tapY = offset.y - offsetY

                                if (tapX >= 0 && tapX <= drawW && tapY >= 0 && tapY <= drawH) {
                                    val relX = tapX / drawW
                                    val relY = tapY / drawH

                                    val finalX = relX * imgW
                                    val finalY = relY * imgH

                                    onSendClick(finalX, finalY, imgW.toInt(), imgH.toInt())
                                }
                            }
                        )
                    }
                    .pointerInput(Unit) {
                        detectDragGestures { change, dragAmount ->
                            change.consume()
                            // Передача жестів прокрутки. Playwright scroll delta:
                            onSendScroll(-dragAmount.x, -dragAmount.y)
                        }
                    },
                contentScale = ContentScale.Fit
            )

            // Кнопка закриття
            IconButton(
                onClick = onDismiss,
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .padding(16.dp)
                    .background(Color.Black.copy(alpha = 0.5f), CircleShape)
            ) {
                Icon(Icons.Default.Close, contentDescription = "Закрити", tint = Color.White)
            }
        }
    }
}

@Preview(showBackground = true, backgroundColor = 0xFF14161B)
@Composable
fun ProjectMonitorPreview() {
    val sampleLogs = listOf(
        LogEntry(text = "Initializing real-time monitor panel for: Project Alpha", type = "info", timestamp = "14:20:01"),
        LogEntry(text = "System Connection Established with WebSocket Server", type = "success", timestamp = "14:20:03"),
        LogEntry(text = "Starting browser session...", type = "info", timestamp = "14:20:05"),
        LogEntry(text = "Bot Activity Status Synced: RUNNING", type = "info", timestamp = "14:20:08"),
        LogEntry(text = "Failed to load dynamic resource: /img/missing.png", type = "error", timestamp = "14:20:12")
    )

    val sampleInventory = listOf(
        InventoryItem(image = "https://sunflower-land.com/play/assets/resources/sunflower.png", number = 145.0),
        InventoryItem(image = "https://sunflower-land.com/play/assets/resources/potato.png", number = 42.0),
        InventoryItem(image = "https://sunflower-land.com/play/assets/resources/gold_ingot.png", number = 12.0)
    )

    val sampleVariables = mapOf(
        "LV" to "15",
        "Золото" to 1250,
        "FLOWER" to "320"
    )
    
    val sampleScreenshots = listOf("shot1", "shot2", "shot3", "shot4")

    MyApplicationTheme {
        ProjectMonitorContent(
            projectName = "Project Alpha",
            currentProjectName = "Project Alpha",
            isRunning = true,
            isStreaming = true,
            isBrowserOpen = true,
            latestFrame = null,
            logs = sampleLogs,
            connectionState = ConnectionState.CONNECTED,
            inventoryItems = sampleInventory,
            projectVariables = sampleVariables,
            inventoryOrder = emptyList(),
            screenshots = sampleScreenshots,
            showGallery = false,
            onBackClick = {},
            onNavigateToEditor = {},
            onRefreshStats = {},
            onToggleStream = {},
            onStartBot = {},
            onStopBot = {},
            onToggleBrowser = {},
            onPrevProject = {},
            onNextProject = {},
            onClearLogs = {},
            onLoadHistory = {},
            onNavigateToInventory = {},
            onDeleteScreenshot = {},
            onToggleGallery = {},
            onSendMouseClick = { _, _, _, _ -> },
            onSendScroll = { _, _ -> }
        )
    }
}

@Preview(showBackground = true, backgroundColor = 0xFF14161B)
@Composable
fun StatsDetailsDialogPreview() {
    val sampleStats = ProjectStats(
        projectName = "Project Alpha",
        totalRuns = 150,
        successfulRuns = 120,
        failedRuns = 30,
        lastRunTime = "2023-10-27 14:30"
    )
    
    MyApplicationTheme {
        StatsDetailsDialog(
            projectName = "Project Alpha",
            stats = sampleStats,
            onDismiss = {}
        )
    }
}

