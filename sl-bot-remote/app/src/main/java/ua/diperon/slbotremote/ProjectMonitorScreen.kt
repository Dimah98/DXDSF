package ua.diperon.slbotremote // Пакет нашого керуючого додатку

import java.util.Locale
import android.graphics.Bitmap // Клас бітмапів для роботи з кадрами трансляції екрану
import androidx.compose.animation.AnimatedVisibility // Анімована видимість компонентів
import androidx.compose.foundation.ExperimentalFoundationApi // Експериментальні API для пейджера
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
import androidx.compose.foundation.combinedClickable // Long press підтримка
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
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
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape // Круглий шаблон геометрії
import androidx.compose.foundation.shape.RoundedCornerShape // Шаблон округлення прямокутних кутів
import androidx.compose.material.icons.Icons // Базові матеріальні векторні значки
import androidx.compose.material.icons.automirrored.filled.ArrowBack // Стрілка назад з підтримкою RTL напрямків
import androidx.compose.material.icons.automirrored.filled.ArrowForward // Стрілка вперед з підтримкою RTL напрямків
import androidx.compose.material.icons.filled.CalendarMonth // Іконка календаря для планувальника
import androidx.compose.material.icons.outlined.*
import androidx.compose.material.icons.filled.Delete // Кошик видалення логів
import androidx.compose.material.icons.filled.Edit // Редагування
import androidx.compose.material.icons.filled.Map // Карта острова
import androidx.compose.material.icons.filled.Code
import androidx.compose.material.icons.filled.Info // Інформаційна кругла бірка
import androidx.compose.material.icons.filled.Widgets // Іконка контейнерів
import androidx.compose.material.icons.filled.Language // Іконка браузера (глобус)
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.OpenInFull
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
import androidx.compose.material3.HorizontalDivider // Горизонтальна тонка лінія розподілу
import androidx.compose.material3.ExperimentalMaterial3Api // Розблокування експериментальних UI АРІ
import androidx.compose.material3.Icon // Матеріальна векторна іконка
import androidx.compose.material3.IconButton // Кругла кнопка що оперує векторною іконкою
import androidx.compose.material3.MaterialTheme // Шкала стилістики поточної теми додатку
import androidx.compose.material3.OutlinedButton // Контурна кнопка
import androidx.compose.material3.Scaffold // Фундаментальна трирівнева основа розмітки
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
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
import ua.diperon.slbotremote.ui.theme.*

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
    onNavigateToEditor: (String) -> Unit,
    onNavigateToProject: (String) -> Unit,
    onNavigateToInventory: (String) -> Unit,
    onNavigateToMap: (String) -> Unit
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
    val viewMode by viewModel.viewMode.collectAsState() // Режим відображення нижньої панелі
    val deliveryItems by viewModel.deliveryItems.collectAsState() // Доставки проекту
    val markedDeliveries by viewModel.markedDeliveries.collectAsState() // Відмічені доставки
    val projectContainers by viewModel.projectContainers.collectAsState() // Контейнери проекту
    val isLoadingContainers by viewModel.isLoadingContainers.collectAsState() // Стан завантаження контейнерів

    val context = LocalContext.current
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

    val snackbarHostState = remember { SnackbarHostState() }
    LaunchedEffect(Unit) {
        viewModel.errorEvents.collect { message ->
            snackbarHostState.showSnackbar(message)
        }
    }

    ProjectMonitorContent(
        projectName = projectName,
        snackbarHostState = snackbarHostState,
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
        viewMode = viewMode,
        deliveryItems = deliveryItems,
        markedDeliveries = markedDeliveries,
        containers = projectContainers,
        isLoadingContainers = isLoadingContainers,
        onBackClick = onBackClick,
        onNavigateToEditor = onNavigateToEditor,
        onNavigateToMap = onNavigateToMap,
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
        onSetViewMode = { viewModel.setViewMode(it) },
        onSendMouseClick = { x, y, w, h -> viewModel.sendMouseClick(x, y, w, h) },
        onSendScroll = { dx, dy -> viewModel.sendScroll(dx, dy) },
        onToggleDeliveryMark = { deliveryId -> viewModel.toggleDeliveryMark(deliveryId) },
        onRefreshContainers = { viewModel.fetchContainers() },
        onRunContainer = { container -> viewModel.runContainer(container) }
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProjectMonitorContent(
    snackbarHostState: SnackbarHostState = remember { SnackbarHostState() },
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
    viewMode: ViewMode,
    deliveryItems: List<Delivery>,
    markedDeliveries: Set<String> = emptySet(),
    containers: List<FlowNodeData> = emptyList(),
    isLoadingContainers: Boolean = false,
    onBackClick: () -> Unit,
    onNavigateToEditor: (String) -> Unit,
    onNavigateToMap: (String) -> Unit,
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
    onSetViewMode: (ViewMode) -> Unit,
    onSendMouseClick: (Float, Float, Int, Int) -> Unit,
    onSendScroll: (Float, Float) -> Unit,
    onToggleDeliveryMark: (String) -> Unit = {},
    onRefreshContainers: () -> Unit = {},
    onRunContainer: (FlowNodeData) -> Unit = {}
) {
    // Локальні змінні тригерів для активації нових діалогових вікон
    var isFullScreenStream by remember { mutableStateOf(false) } // Діалог на весь екран
    var isFullScreenConsole by remember { mutableStateOf(false) } // Діалог консолі на весь екран

    val scrollState = androidx.compose.foundation.rememberScrollState()

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
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
                            imageVector = Icons.Outlined.Edit,
                            contentDescription = "Редагувати проект", // Перекладено
                            tint = Color.White
                        )
                    }

                    // Кнопка карти острова
                    IconButton(
                        onClick = { onNavigateToMap(projectName) },
                        modifier = Modifier.testTag("monitor_map_project")
                    ) {
                        Icon(
                            imageVector = Icons.Outlined.Map,
                            contentDescription = "Карта Острова",
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
                    containerColor = GlassBg.copy(alpha = 0.85f)
                )
            )
        },
        containerColor = MaterialTheme.colorScheme.background // Темний фокус-фон
    ) { innerPadding ->
        var dragOffsetX by remember { mutableStateOf(0f) }

        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .pointerInput(projectName) {
                    detectHorizontalDragGestures(
                        onDragEnd = {
                            if (dragOffsetX < -80f) {
                                onNextProject()
                            } else if (dragOffsetX > 80f) {
                                onPrevProject()
                            }
                            dragOffsetX = 0f
                        },
                        onDragCancel = { dragOffsetX = 0f },
                        onHorizontalDrag = { _, dragAmount ->
                            dragOffsetX += dragAmount
                        }
                    )
                }
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 16.dp)
                    .verticalScroll(scrollState),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Верхня частина - трансляція браузера (підлаштовується під точний розмір/пропорції кадру)
                AnimatedVisibility(
                    visible = isStreaming,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    LiveStreamComponent(
                        modifier = Modifier.fillMaxWidth(),
                        isStreamingActive = isStreaming,
                        frameBitmap = latestFrame,
                        isBotRunning = isRunning,
                        onToggleStream = onToggleStream,
                        onFullScreenClick = { isFullScreenStream = true }
                    )
                }

                // Середня частина (Інвентар + Контроль двигуна мають однакову висоту 140dp)
                Row(
                    modifier = Modifier.fillMaxWidth().height(140.dp),
                    horizontalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    // Середина зліва - Інвентар
                    ProjectInventoryCard(
                        modifier = Modifier.weight(1.3f).fillMaxHeight(),
                        inventoryItems = inventoryItems,
                        inventoryOrder = inventoryOrder,
                        onOpenInventory = { 
                            onNavigateToInventory(projectName)
                        }
                    )

                    // Середина зправа - Контроль двигуна
                    StatusControlCard(
                        modifier = Modifier.weight(0.7f).fillMaxHeight(),
                        isBotRunning = isRunning,
                        isBrowserOpen = isBrowserOpen,
                        onStartClick = onStartBot,
                        onStopClick = onStopBot,
                        onToggleBrowser = onToggleBrowser,
                        onPrevProject = onPrevProject,
                        onNextProject = onNextProject
                    )
                }

                // Нижня частина - розтягується до самого низу (мінімум 440dp, максимум 900dp)
                val bottomModeModifier = Modifier.fillMaxWidth().heightIn(min = 440.dp, max = 900.dp)
                when (viewMode) {
                    ViewMode.CONSOLE -> {
                        LogConsoleComponent(
                            modifier = bottomModeModifier,
                            logs = logs,
                            onClearClick = onClearLogs,
                            onLoadHistoryClick = onLoadHistory,
                            viewMode = viewMode,
                            onSetViewMode = onSetViewMode,
                            onOpenFullScreen = { isFullScreenConsole = true }
                        )
                    }
                    ViewMode.GALLERY -> {
                        ScreenshotGalleryComponent(
                            modifier = bottomModeModifier,
                            projectName = projectName,
                            screenshots = screenshots,
                            onDeleteScreenshot = onDeleteScreenshot,
                            viewMode = viewMode,
                            onSetViewMode = onSetViewMode
                        )
                    }
                    ViewMode.DELIVERY -> {
                        DeliveryComponent(
                            modifier = bottomModeModifier,
                            deliveryItems = deliveryItems,
                            inventoryItems = inventoryItems,
                            markedDeliveries = markedDeliveries,
                            viewMode = viewMode,
                            onSetViewMode = onSetViewMode,
                            onToggleMark = onToggleDeliveryMark
                        )
                    }
                    ViewMode.INFO -> {
                        ProjectInfoComponent(
                            modifier = bottomModeModifier,
                            projectName = projectName,
                            projectVariables = projectVariables,
                            viewMode = viewMode,
                            onSetViewMode = onSetViewMode
                        )
                    }
                    ViewMode.CONTAINERS -> {
                        ProjectContainersComponent(
                            modifier = bottomModeModifier,
                            projectName = projectName,
                            containers = containers,
                            isLoading = isLoadingContainers,
                            onRefreshContainers = onRefreshContainers,
                            onRunContainer = onRunContainer,
                            viewMode = viewMode,
                            onSetViewMode = onSetViewMode
                        )
                    }
                }
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

        if (isFullScreenConsole) {
            FullScreenConsoleDialog(
                logs = logs,
                onDismiss = { isFullScreenConsole = false },
                onClearClick = onClearLogs,
                onLoadHistoryClick = onLoadHistory
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
        ConnectionState.CONNECTED -> GlassSuccess to "ПІДКЛЮЧЕНО" // Перекладено
        ConnectionState.CONNECTING -> GlassWarning to "З'ЄДНАННЯ" // Перекладено
        ConnectionState.DISCONNECTED -> GlassOnSurfaceDim to "ОФЛАЙН" // Перекладено
        ConnectionState.ERROR -> GlassError to "ПОМИЛКА" // Перекладено
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
    isStreamingActive: Boolean,
    frameBitmap: Bitmap?,
    isBotRunning: Boolean,
    onToggleStream: () -> Unit,
    onFullScreenClick: () -> Unit
) {
    val aspectRatio = remember(frameBitmap) {
        if (frameBitmap != null && frameBitmap.height > 0) {
            frameBitmap.width.toFloat() / frameBitmap.height.toFloat()
        } else {
            16f / 9f
        }
    }

    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(24.dp),
        colors = CardDefaults.cardColors(
            containerColor = Color.White.copy(alpha = 0.06f)
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 8.dp),
        border = BorderStroke(
            1.dp, 
            if (isStreamingActive) MaterialTheme.colorScheme.primary.copy(alpha = 0.5f)
            else Color.White.copy(alpha = 0.12f)
        )
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .padding(8.dp)
                .clip(RoundedCornerShape(18.dp))
                .background(GlassTerminal)
                .clickable { if (isStreamingActive && frameBitmap != null) onFullScreenClick() },
            contentAlignment = Alignment.Center
        ) {
            if (isStreamingActive && frameBitmap != null) {
                Image(
                    bitmap = frameBitmap.asImageBitmap(),
                    contentDescription = "Пряма трансляція",
                    modifier = Modifier
                        .fillMaxWidth()
                        .aspectRatio(aspectRatio)
                        .clip(RoundedCornerShape(18.dp)),
                    contentScale = ContentScale.Fit
                )
            } else {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(180.dp)
                        .padding(16.dp)
                ) {
                    Icon(
                        imageVector = if (isStreamingActive) Icons.Default.Tv else Icons.Default.TvOff,
                        contentDescription = null,
                        tint = Color.White.copy(alpha = 0.15f),
                        modifier = Modifier.size(44.dp)
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = if (isStreamingActive) "Очікування кадрів..." else "Трансляцію екрану призупинено",
                        style = MaterialTheme.typography.bodySmall,
                        color = Color.White.copy(alpha = 0.4f),
                        textAlign = TextAlign.Center
                    )
                }
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
            containerColor = Color.White.copy(alpha = 0.06f)
        ),
        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.12f))
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
                        containerColor = if (isBrowserOpen) GlassError.copy(alpha = 0.2f) else Color.White.copy(alpha = 0.05f),
                        contentColor = if (isBrowserOpen) GlassError else Color.White
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
                        containerColor = if (isBotRunning) GlassError else GlassSuccess,
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
    inventoryOrder: List<String>,
    onOpenInventory: () -> Unit
) {
    val context = LocalContext.current
    var itemToCategories by remember { mutableStateOf<Map<String, List<String>>>(emptyMap()) }

    // Автоматичне завантаження розподілу категорій з сервера
    LaunchedEffect(Unit) {
        try {
            val configManager = ConnectionConfigManager(context)
            val interceptor = DynamicBaseUrlInterceptor().apply {
                setBaseUrl(configManager.getHttpUrl())
            }
            val apiService = BotApiService.create(interceptor)
            val catResponse = apiService.getInventoryCategories()
            itemToCategories = catResponse.itemToCategories
        } catch (e: Exception) {
            // Ігноруємо помилки мережі, працюємо за ключовими словами
        }
    }

    // Список назв та ключових слів для обов'язкового виключення будiвель та декору
    val excludedKeywords = remember {
        setOf(
            "house", "town center", "market", "workbench", "crop plot", "flower bed",
            "compost bin", "beehive", "water well", "fire pit", "kitchen", "aging shed",
            "fruit patch", "stone rock", "iron rock", "gold rock", "crimstone rock", "tree",
            "basic land", "bear", "wardrobe", "rug", "scarecrow", "banner", "totem",
            "beetle", "dino egg", "paint bucket", "squirrel", "scary mike", "lamp",
            "sunflorian faction banner", "time warp totem", "basic bear", "farmer bear",
            "brilliant bear", "blossombeard", "big orange", "ripped salt bag", "salt lamp",
            "salt dino egg", "yellow paint bucket", "stone beetle"
        )
    }

    // 1. Відсіюємо предмети категорій "будівлі" та "декор"
    val filteredItems = remember(inventoryItems, itemToCategories) {
        inventoryItems.filter { item ->
            val rawName = item.image.substringAfterLast("/").substringBeforeLast(".").trim()
            val lowerName = rawName.lowercase()

            // Перевірка 1: за категоріями сервера
            val userCategories = itemToCategories[rawName]
                ?: itemToCategories.entries.firstOrNull { it.key.equals(rawName, ignoreCase = true) }?.value
                ?: emptyList()

            val isExcludedCategory = userCategories.any { cat ->
                val c = cat.lowercase().trim()
                c == "будівлі" || c == "декор" || c == "будівля" || c == "building" || c == "buildings" || c == "decor" || c == "decoration"
            }
            if (isExcludedCategory) return@filter false

            // Перевірка 2: за ключовими словами
            val isExcludedKeyword = excludedKeywords.any { keyword -> lowerName.contains(keyword) }
            !isExcludedKeyword
        }
    }

    // 2. Сортуємо відфільтровані предмети згідно пріоритету та беремо перші 15
    val sortedItems = remember(filteredItems, inventoryOrder) {
        val orderMap = inventoryOrder.mapIndexed { index, name -> name.lowercase() to index }.toMap()
        filteredItems.sortedWith { a, b ->
            val nameA = a.image.substringAfterLast("/").substringBeforeLast(".").lowercase()
            val nameB = b.image.substringAfterLast("/").substringBeforeLast(".").lowercase()
            val indexA = orderMap[nameA] ?: orderMap.entries.firstOrNull { a.image.lowercase().contains(it.key) }?.value ?: Int.MAX_VALUE
            val indexB = orderMap[nameB] ?: orderMap.entries.firstOrNull { b.image.lowercase().contains(it.key) }?.value ?: Int.MAX_VALUE
            indexA.compareTo(indexB)
        }.take(15)
    }

    Card(
        modifier = modifier
            .fillMaxWidth()
            .clickable(onClick = onOpenInventory), // Весь блок є кнопкою
        shape = RoundedCornerShape(24.dp),
        colors = CardDefaults.cardColors(
            containerColor = Color.White.copy(alpha = 0.06f)
        ),
        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.12f))
    ) {
        Box(
            modifier = Modifier.padding(10.dp).fillMaxSize()
        ) {
            if (sortedItems.isEmpty()) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
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
                    modifier = Modifier.fillMaxSize(),
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
    
    val imageLoader = remember(context) { ImageLoaderProvider.getImageLoader(context) }

    Box(
        modifier = Modifier
            .aspectRatio(1f)
            .clip(RoundedCornerShape(4.dp))
            .background(Color.White.copy(alpha = 0.06f))
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
 * Компактний перемикач між Консоль, Скріншоти та Доставка (маленькі кнопки з іконками без тексту).
 */
@Composable
fun BottomViewModeSwitcher(
    viewMode: ViewMode,
    onSetViewMode: (ViewMode) -> Unit,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .clip(RoundedCornerShape(10.dp))
            .background(GlassBg)
            .border(BorderStroke(1.dp, Color.White.copy(alpha = 0.08f)), RoundedCornerShape(10.dp))
            .padding(2.dp),
        horizontalArrangement = Arrangement.spacedBy(2.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Консоль
        IconButton(
            onClick = { onSetViewMode(ViewMode.CONSOLE) },
            modifier = Modifier
                .size(28.dp)
                .clip(RoundedCornerShape(8.dp))
                .background(if (viewMode == ViewMode.CONSOLE) GlassGem.copy(alpha = 0.25f) else Color.Transparent)
        ) {
            Icon(
                imageVector = Icons.Default.Code,
                contentDescription = "Консоль",
                tint = if (viewMode == ViewMode.CONSOLE) GlassGem else Color.White.copy(alpha = 0.4f),
                modifier = Modifier.size(15.dp)
            )
        }

        // Скріншоти
        IconButton(
            onClick = { onSetViewMode(ViewMode.GALLERY) },
            modifier = Modifier
                .size(28.dp)
                .clip(RoundedCornerShape(8.dp))
                .background(if (viewMode == ViewMode.GALLERY) GlassGem.copy(alpha = 0.25f) else Color.Transparent)
        ) {
            Icon(
                imageVector = Icons.Default.Tv,
                contentDescription = "Скріншоти",
                tint = if (viewMode == ViewMode.GALLERY) GlassGem else Color.White.copy(alpha = 0.4f),
                modifier = Modifier.size(15.dp)
            )
        }

        // Доставка
        IconButton(
            onClick = { onSetViewMode(ViewMode.DELIVERY) },
            modifier = Modifier
                .size(28.dp)
                .clip(RoundedCornerShape(8.dp))
                .background(if (viewMode == ViewMode.DELIVERY) GlassGem.copy(alpha = 0.25f) else Color.Transparent)
        ) {
            Icon(
                imageVector = Icons.Default.Inventory2,
                contentDescription = "Доставка",
                tint = if (viewMode == ViewMode.DELIVERY) GlassGem else Color.White.copy(alpha = 0.4f),
                modifier = Modifier.size(15.dp)
            )
        }

        // Інформація про проект
        IconButton(
            onClick = { onSetViewMode(ViewMode.INFO) },
            modifier = Modifier
                .size(28.dp)
                .clip(RoundedCornerShape(8.dp))
                .background(if (viewMode == ViewMode.INFO) GlassGem.copy(alpha = 0.25f) else Color.Transparent)
        ) {
            Icon(
                imageVector = Icons.Outlined.Info,
                contentDescription = "Інформація",
                tint = if (viewMode == ViewMode.INFO) GlassGem else Color.White.copy(alpha = 0.4f),
                modifier = Modifier.size(15.dp)
            )
        }

        // Контейнери проекту
        IconButton(
            onClick = { onSetViewMode(ViewMode.CONTAINERS) },
            modifier = Modifier
                .size(28.dp)
                .clip(RoundedCornerShape(8.dp))
                .background(if (viewMode == ViewMode.CONTAINERS) GlassGem.copy(alpha = 0.25f) else Color.Transparent)
        ) {
            Icon(
                imageVector = Icons.Default.Widgets,
                contentDescription = "Контейнери",
                tint = if (viewMode == ViewMode.CONTAINERS) GlassGem else Color.White.copy(alpha = 0.4f),
                modifier = Modifier.size(15.dp)
            )
        }
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
    viewMode: ViewMode = ViewMode.CONSOLE,
    onSetViewMode: (ViewMode) -> Unit = {},
    onOpenFullScreen: () -> Unit = {}
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
            containerColor = Color.White.copy(alpha = 0.06f)
        ),
        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.12f)),
        elevation = CardDefaults.cardElevation(defaultElevation = 8.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(12.dp)
        ) {
            // Заголовок панелі
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Outlined.Info,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = "Консоль",
                        style = MaterialTheme.typography.labelLarge,
                        color = Color.White,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.width(10.dp))
                    BottomViewModeSwitcher(viewMode = viewMode, onSetViewMode = onSetViewMode)
                }

                Row(verticalAlignment = Alignment.CenterVertically) {
                    IconButton(
                        onClick = onOpenFullScreen,
                        modifier = Modifier
                            .size(28.dp)
                            .testTag("open_fullscreen_console_button")
                    ) {
                        Icon(
                            imageVector = Icons.Default.OpenInFull,
                            contentDescription = "Відкрити на весь екран",
                            tint = GlassGem,
                            modifier = Modifier.size(16.dp)
                        )
                    }
                    Spacer(modifier = Modifier.width(4.dp))
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
                    Spacer(modifier = Modifier.width(4.dp))
                    IconButton(
                        onClick = onClearClick,
                        modifier = Modifier
                            .size(28.dp)
                            .testTag("clear_console_button")
                    ) {
                        Icon(
                            imageVector = Icons.Default.Delete,
                            contentDescription = "Очистити консоль", // Перекладено
                            tint = Color.White.copy(alpha = 0.6f),
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
                    .background(Color.Black.copy(alpha = 0.2f))
                    .border(BorderStroke(1.dp, Color.White.copy(alpha = 0.08f)), RoundedCornerShape(16.dp))
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
    viewMode: ViewMode = ViewMode.GALLERY,
    onSetViewMode: (ViewMode) -> Unit = {}
) {
    val context = LocalContext.current
    val baseUrl = remember { ConnectionConfigManager(context).getHttpUrl().removeSuffix("/") }
    var fullscreenImageIndex by remember { mutableStateOf<Int?>(null) }

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
                    Spacer(modifier = Modifier.width(10.dp))
                    BottomViewModeSwitcher(viewMode = viewMode, onSetViewMode = onSetViewMode)
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(GlassTerminal)
                    .border(BorderStroke(1.dp, Color.White.copy(alpha = 0.12f)), RoundedCornerShape(16.dp))
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
                            val timestamp = remember { System.currentTimeMillis() }
                            val imageUrl = "$baseUrl/api/screenshots/${projectName}_screenshots/$filename?t=$timestamp"

                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(200.dp)
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(Color(0xFF1C1F26))
                                    .border(BorderStroke(1.dp, Color.White.copy(alpha = 0.05f)), RoundedCornerShape(12.dp))
                                    .clickable { fullscreenImageIndex = screenshots.indexOf(filename) }
                            ) {
                                AsyncImage(
                                    model = ImageRequest.Builder(context)
                                        .data(imageUrl)
                                        .crossfade(true)
                                        .diskCachePolicy(coil.request.CachePolicy.DISABLED)
                                        .memoryCachePolicy(coil.request.CachePolicy.DISABLED)
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
                                        imageVector = Icons.Outlined.Delete,
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

    // Fullscreen image viewer with swipe navigation
    if (fullscreenImageIndex != null && screenshots.isNotEmpty()) {
        FullscreenImageViewer(
            screenshots = screenshots,
            initialIndex = fullscreenImageIndex!!,
            projectName = projectName,
            baseUrl = baseUrl,
            onDismiss = { fullscreenImageIndex = null }
        )
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun FullscreenImageViewer(
    screenshots: List<String>,
    initialIndex: Int,
    projectName: String,
    baseUrl: String,
    onDismiss: () -> Unit
) {
    val context = LocalContext.current
    val pagerState = rememberPagerState(initialPage = initialIndex) { screenshots.size }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(
            dismissOnBackPress = true,
            dismissOnClickOutside = true,
            usePlatformDefaultWidth = false
        )
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.Black)
        ) {
            HorizontalPager(
                state = pagerState,
                modifier = Modifier.fillMaxSize()
            ) { index ->
                val timestamp = remember { System.currentTimeMillis() }
                val imageUrl = "$baseUrl/api/screenshots/${projectName}_screenshots/${screenshots[index]}?t=$timestamp"

                AsyncImage(
                    model = ImageRequest.Builder(context)
                        .data(imageUrl)
                        .crossfade(true)
                        .diskCachePolicy(coil.request.CachePolicy.DISABLED)
                        .memoryCachePolicy(coil.request.CachePolicy.DISABLED)
                        .build(),
                    contentDescription = screenshots[index],
                    modifier = Modifier.fillMaxSize(),
                    contentScale = ContentScale.Fit
                )
            }

            // Close button
            IconButton(
                onClick = onDismiss,
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .padding(16.dp)
                    .background(Color.Black.copy(alpha = 0.5f), CircleShape)
            ) {
                Icon(Icons.Default.Close, contentDescription = "Закрити", tint = Color.White)
            }

            // Image counter
            Box(
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .padding(16.dp)
                    .background(Color.Black.copy(alpha = 0.5f), RoundedCornerShape(8.dp))
                    .padding(horizontal = 12.dp, vertical = 6.dp)
            ) {
                Text(
                    text = "${pagerState.currentPage + 1} / ${screenshots.size}",
                    color = Color.White,
                    style = MaterialTheme.typography.bodyMedium
                )
            }
        }
    }
}

/**
 * Візуальне відображення рядка логування з вибором кольору згідно рівня події.
 * Текст завжди вирівняно по лівому краю для максимальної читабельності.
 */
@Composable
fun LogConsoleLineItem(log: LogEntry) {
    val (textColor, bgColor, labelText) = when (log.type.lowercase().trim()) {
        "success" -> Triple(GlassSuccess, GlassSuccess.copy(alpha = 0.08f), "[УСПІХ]")
        "error" -> Triple(GlassError, GlassError.copy(alpha = 0.08f), "[ПОМИЛКА]")
        "debug" -> Triple(GlassOnSurfaceVariant, GlassOnSurfaceVariant.copy(alpha = 0.08f), "[ВІДЛАДКА]")
        else -> Triple(GlassGem, GlassGem.copy(alpha = 0.08f), "[ІНФО]")
    }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(6.dp))
            .background(bgColor)
            .padding(horizontal = 10.dp, vertical = 6.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Start
        ) {
            Text(
                text = log.timestamp,
                color = Color.White.copy(alpha = 0.4f),
                style = MaterialTheme.typography.labelSmall,
                fontFamily = FontFamily.Monospace,
                fontSize = 10.sp
            )
            Spacer(modifier = Modifier.width(6.dp))
            Text(
                text = labelText,
                color = textColor,
                style = MaterialTheme.typography.labelSmall,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold,
                fontSize = 10.sp
            )
        }
        Spacer(modifier = Modifier.height(3.dp))
        Text(
            text = log.text,
            color = Color.White.copy(alpha = 0.95f),
            style = MaterialTheme.typography.bodySmall,
            fontFamily = FontFamily.Monospace,
            fontSize = 12.sp,
            textAlign = TextAlign.Start,
            modifier = Modifier.fillMaxWidth()
        )
    }
}

/**
 * Діалог консолі логів на весь екран з можливістю комфортного читання та очищення.
 */
@Composable
fun FullScreenConsoleDialog(
    logs: List<LogEntry>,
    onDismiss: () -> Unit,
    onClearClick: () -> Unit,
    onLoadHistoryClick: () -> Unit
) {
    val listState = rememberLazyListState()

    LaunchedEffect(logs.size) {
        if (logs.isNotEmpty()) {
            listState.animateScrollToItem(logs.size - 1)
        }
    }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(
            usePlatformDefaultWidth = false
        )
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color(0xFF0A0E1A).copy(alpha = 0.95f))
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(16.dp)
            ) {
                // Header
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Outlined.Info,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.size(20.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "Консоль логів (Повний екран)",
                            style = MaterialTheme.typography.titleMedium,
                            color = Color.White,
                            fontWeight = FontWeight.Bold
                        )
                    }

                    Row(verticalAlignment = Alignment.CenterVertically) {
                        IconButton(onClick = onLoadHistoryClick) {
                            Icon(
                                imageVector = Icons.Default.Download,
                                contentDescription = "Завантажити історію",
                                tint = Color.White.copy(alpha = 0.7f)
                            )
                        }
                        IconButton(onClick = onClearClick) {
                            Icon(
                                imageVector = Icons.Outlined.Delete,
                                contentDescription = "Очистити консоль",
                                tint = Color.White.copy(alpha = 0.7f)
                            )
                        }
                        IconButton(onClick = onDismiss) {
                            Icon(
                                imageVector = Icons.Default.Close,
                                contentDescription = "Закрити",
                                tint = Color.White
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                Box(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(GlassTerminal)
                        .border(BorderStroke(1.dp, Color.White.copy(alpha = 0.12f)), RoundedCornerShape(12.dp))
                        .padding(12.dp)
                ) {
                    if (logs.isEmpty()) {
                        Box(
                            modifier = Modifier.fillMaxSize(),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = "Очікування логів...",
                                style = MaterialTheme.typography.bodyMedium,
                                color = Color.White.copy(alpha = 0.4f),
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
            shape = RoundedCornerShape(24.dp),
            colors = CardDefaults.cardColors(
                containerColor = Color.White.copy(alpha = 0.06f) // Наш темний колір
            ),
            border = BorderStroke(1.dp, Color.White.copy(alpha = 0.12f)),
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
                    color = GlassSuccess,
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
                                color = GlassSuccess,
                                startAngle = -90f,
                                sweepAngle = successAngle,
                                useCenter = true
                            )

                            // Сектор Помилок (Червоний)
                            drawArc(
                                color = GlassError,
                                startAngle = -90f + successAngle,
                                sweepAngle = failedAngle,
                                useCenter = true
                            )
                        }
                        
                        // Декоративне внутрішнє коло для перетворення кругової діаграми на Donut Chart у футуристичному стилі
                        Box(
                            modifier = Modifier
                                .size(76.dp)
                                .background(Color.White.copy(alpha = 0.06f), CircleShape),
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
                        StatMetricLine(label = "Виконано успішно", value = "$success", color = GlassSuccess)
                        StatMetricLine(label = "Невдалі запуски (помилки)", value = "$failed", color = GlassError)
                        StatMetricLine(label = "Коефіцієнт успішності (Success Rate)", value = "$successRate%", color = GlassSuccess)

                        // Якщо маємо точну дату завершення останнього циклу
                        if (stats.lastRunTime != null) {
                            Spacer(modifier = Modifier.height(8.dp))
                            HorizontalDivider(color = Color.White.copy(alpha = 0.08f))
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
                        containerColor = GlassSuccess,
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
            viewMode = ViewMode.CONSOLE,
            deliveryItems = emptyList(),
            onBackClick = {},
            onNavigateToEditor = {},
            onNavigateToMap = {},
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
            onSetViewMode = {},
            onSendMouseClick = { _, _, _, _ -> },
            onSendScroll = { _, _ -> }
        )
    }
}

/**
 * Компонент відображення доставок
 */
@Composable
fun DeliveryComponent(
    modifier: Modifier = Modifier,
    deliveryItems: List<Delivery>,
    inventoryItems: List<InventoryItem>,
    markedDeliveries: Set<String> = emptySet(),
    viewMode: ViewMode = ViewMode.DELIVERY,
    onSetViewMode: (ViewMode) -> Unit = {},
    onToggleMark: (String) -> Unit = {}
) {
    val context = LocalContext.current
    val baseUrl = remember { ConnectionConfigManager(context).getHttpUrl().removeSuffix("/") }

    // Мапа назв NPC для спеціальних випадків
    val npcNameMap = mapOf(
        "pumpkin' pete" to "pumpkin- pete",
        "old salty" to "old salty"
    )

    // Функція для отримання імені файлу NPC
    fun getNpcFileName(npcName: String): String {
        return npcNameMap[npcName.lowercase()] ?: npcName.lowercase()
    }

    // Створюємо мапу інвентаря для швидкого пошуку
    val inventoryMap = remember(inventoryItems) {
        inventoryItems.associate {
            // Витягуємо назву предмету з URL
            val itemName = it.image.substringAfterLast("/").substringBefore(".")
            itemName.lowercase() to it.number
        }
    }

    // Сортуємо доставки: готові (оранжеві) перші, потім виконані (зелені), потім інші
    val sortedDeliveryItems = remember(deliveryItems, inventoryMap) {
        deliveryItems.sortedWith { a, b ->
            val aIsCompleted = a.completedAt != null
            val bIsCompleted = b.completedAt != null

            val aHasSufficientResources = a.items.all { (itemName, requiredAmount) ->
                val available = inventoryMap[itemName.lowercase()] ?: 0.0
                available >= requiredAmount
            }
            val bHasSufficientResources = b.items.all { (itemName, requiredAmount) ->
                val available = inventoryMap[itemName.lowercase()] ?: 0.0
                available >= requiredAmount
            }

            // Пріоритет: готові (не виконані але ресурсів достатньо) > виконані > інші
            when {
                !aIsCompleted && aHasSufficientResources && (bIsCompleted || !bHasSufficientResources) -> -1
                !bIsCompleted && bHasSufficientResources && (aIsCompleted || !aHasSufficientResources) -> 1
                aIsCompleted && !bIsCompleted -> -1
                bIsCompleted && !aIsCompleted -> 1
                else -> 0
            }
        }
    }

    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(24.dp),
        colors = CardDefaults.cardColors(
            containerColor = Color.White.copy(alpha = 0.06f)
        ),
        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.12f)),
        elevation = CardDefaults.cardElevation(defaultElevation = 8.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(12.dp)
        ) {
            // Заголовок панелі
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Default.Inventory2,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = "Доставки",
                        style = MaterialTheme.typography.labelLarge,
                        color = Color.White,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.width(10.dp))
                    BottomViewModeSwitcher(viewMode = viewMode, onSetViewMode = onSetViewMode)
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            // Сітка доставок по 3 в ряду
            if (deliveryItems.isEmpty()) {
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxWidth(),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "Доставки відсутні",
                        style = MaterialTheme.typography.bodySmall,
                        color = Color.White.copy(alpha = 0.3f)
                    )
                }
            } else {
                LazyVerticalGrid(
                    columns = GridCells.Fixed(3),
                    modifier = Modifier.fillMaxSize(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(sortedDeliveryItems, key = { it.id }) { delivery ->
                        DeliveryItemCard(
                            delivery = delivery,
                            inventoryMap = inventoryMap,
                            baseUrl = baseUrl,
                            getNpcFileName = ::getNpcFileName,
                            isMarked = markedDeliveries.contains(getNpcFileName(delivery.from)),
                            onToggleMark = { onToggleMark(getNpcFileName(delivery.from)) }
                        )
                    }
                }
            }
        }
    }
}

/**
 * Карточка однієї доставки
 */
@OptIn(androidx.compose.foundation.ExperimentalFoundationApi::class)
@Composable
fun DeliveryItemCard(
    delivery: Delivery,
    inventoryMap: Map<String, Double>,
    baseUrl: String,
    getNpcFileName: (String) -> String,
    isMarked: Boolean = false,
    onToggleMark: () -> Unit = {}
) {
    // Перевіряємо, чи достатньо ресурсів
    val hasSufficientResources = remember(delivery, inventoryMap) {
        delivery.items.all { (itemName, requiredAmount) ->
            val available = inventoryMap[itemName.lowercase()] ?: 0.0
            available >= requiredAmount
        }
    }

    // Перевіряємо, чи виконана доставка
    val isCompleted = delivery.completedAt != null

    // Визначаємо колір рамки: помічена — синя, інакше за станом
    val borderColor = when {
        isMarked -> GlassIndigo             // Фіолетова рамка для відміченої
        isCompleted -> GlassSuccess           // Зелена для виконаних
        hasSufficientResources -> GlassWarning // Оранжева для доступних
        else -> Color.White.copy(alpha = 0.12f)    // Прозора для недоступних
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
                    AsyncImage(
                        model = ImageRequest.Builder(LocalContext.current)
                            .data("file:///android_asset/im/${getNpcFileName(delivery.from)}.png")
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
                            // Міні зображення предмета
                            AsyncImage(
                                model = ImageRequest.Builder(LocalContext.current)
                                    .data("file:///android_asset/im/${itemName}.png")
                                    .crossfade(true)
                                    .build(),
                                contentDescription = itemName,
                                modifier = Modifier.size(16.dp),
                                contentScale = ContentScale.Fit
                            )
                            // Кількість: в інвентарі / потрібно
                            val available = inventoryMap[itemName.lowercase()] ?: 0.0
                            val textColor = if (available >= amount) GlassSuccess else GlassError
                            Text(
                                text = "${available.toInt()}/${amount}",
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
                        // Coins нагорода
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
                        // SFL нагорода
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
                                        text = sfl.toString(),
                                        style = MaterialTheme.typography.bodySmall,
                                        color = Color.White,
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                            }
                        }
                    } else {
                        // Порожня нагорода - показуємо Salt Rock.png
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(4.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            AsyncImage(
                                model = ImageRequest.Builder(LocalContext.current)
                                    .data("file:///android_asset/im/Salt Rock.png")
                                    .crossfade(true)
                                    .build(),
                                contentDescription = "Empty Reward",
                                modifier = Modifier.size(16.dp)
                            )
                        }
                    }
                }
            }
        }
    } // end Card

    // Значок мітки — у верхньому правому куті зовнішнього Box
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

data class ProjectInfoDetails(
    val level: Int?,
    val gold: Double?,
    val flower: Double?,
    val gem: Double?,
    val username: String?,
    val bumpkinId: String?,
    val basicLand: Any?,
    val battlepassPoints: Any?
)

fun parseProjectInfoDetails(projectVariables: Map<String, Any>?, miniImagesManager: MiniImagesManager): ProjectInfoDetails {
    if (projectVariables == null || projectVariables.isEmpty()) return ProjectInfoDetails(null, null, null, null, null, null, null, null)

    val level = miniImagesManager.calculateLevelFromSaveData(projectVariables)
    val gold = miniImagesManager.getGoldFromSaveData(projectVariables)
    val gem = miniImagesManager.getGemFromSaveData(projectVariables)

    var flower: Double? = null
    var username: String? = null
    var bumpkinId: String? = null
    var basicLand: Any? = null
    var battlepassPoints: Any? = null

    try {
        val json = org.json.JSONObject(projectVariables as Map<*, *>)
        val visited = json.optJSONObject("visitedFarmState") ?: json

        val un = visited.optString("username", "")
        if (un.isNotBlank()) username = un

        val bumpkin = visited.optJSONObject("bumpkin")
        if (bumpkin != null && bumpkin.has("id")) {
            bumpkinId = bumpkin.optString("id", "")
        }

        val inventory = visited.optJSONObject("inventory")
        if (inventory != null) {
            if (inventory.has("Flower")) {
                flower = inventory.optDouble("Flower", 0.0)
            }
            if (inventory.has("Basic Land")) {
                basicLand = inventory.opt("Basic Land")
            }
        }

        val farmActivity = visited.optJSONObject("farmActivity")
        if (farmActivity != null) {
            if (farmActivity.has("Salt Awakening Points Earned")) {
                battlepassPoints = farmActivity.opt("Salt Awakening Points Earned")
            }
        }
    } catch (e: Exception) {
        android.util.Log.e("ProjectInfo", "Error parsing info details: ${e.message}")
    }

    return ProjectInfoDetails(
        level = level,
        gold = gold,
        flower = flower,
        gem = gem,
        username = username,
        bumpkinId = bumpkinId,
        basicLand = basicLand,
        battlepassPoints = battlepassPoints
    )
}

@Composable
fun ProjectInfoComponent(
    modifier: Modifier = Modifier,
    projectName: String,
    projectVariables: Map<String, Any>?,
    viewMode: ViewMode = ViewMode.INFO,
    onSetViewMode: (ViewMode) -> Unit = {}
) {
    val context = LocalContext.current
    val miniImagesManager = remember { MiniImagesManager(context) }
    val info = remember(projectVariables) { parseProjectInfoDetails(projectVariables, miniImagesManager) }

    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(24.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White.copy(alpha = 0.06f)),
        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.12f))
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(14.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Outlined.Info,
                        contentDescription = null,
                        tint = GlassGem,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(Modifier.width(8.dp))
                    Text(
                        text = "Інформація про проект",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                }

                BottomViewModeSwitcher(viewMode = viewMode, onSetViewMode = onSetViewMode)
            }

            Spacer(Modifier.height(12.dp))

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f)
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                // Рівень (Зелене число)
                InfoRowItem(
                    label = "Рівень",
                    value = info.level?.toString() ?: "—",
                    valueColor = GlassSuccess
                )

                // Золото (Жовте число)
                InfoRowItem(
                    label = "Золото",
                    value = info.gold?.let { String.format(Locale.US, "%.0f", it) } ?: "—",
                    valueColor = GlassWarning
                )

                // Flower (Фіолетове число)
                InfoRowItem(
                    label = "Flower",
                    value = info.flower?.let { String.format(Locale.US, "%.0f", it) } ?: "—",
                    valueColor = GlassBalance
                )

                // Gem (Голубе число)
                InfoRowItem(
                    label = "Gem",
                    value = info.gem?.let { String.format(Locale.US, "%.0f", it) } ?: "—",
                    valueColor = GlassGem
                )

                HorizontalDivider(color = Color.White.copy(alpha = 0.05f))

                // Нік
                InfoRowItem(
                    label = "Нік",
                    value = info.username ?: "—",
                    valueColor = Color.White
                )

                // ID
                InfoRowItem(
                    label = "ID",
                    value = info.bumpkinId ?: "—",
                    valueColor = Color.White.copy(alpha = 0.8f)
                )

                // Острів
                InfoRowItem(
                    label = "Острів",
                    value = info.basicLand?.toString() ?: "—",
                    valueColor = Color.White.copy(alpha = 0.8f)
                )

                // Рівень бателпасу
                InfoRowItem(
                    label = "Рівень бателпасу",
                    value = info.battlepassPoints?.toString() ?: "—",
                    valueColor = GlassAccentLight
                )
            }
        }
    }
}

@Composable
private fun InfoRowItem(
    label: String,
    value: String,
    valueColor: Color
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(GlassBg, RoundedCornerShape(10.dp))
            .padding(horizontal = 12.dp, vertical = 10.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = label,
            fontSize = 13.sp,
            fontWeight = FontWeight.Medium,
            color = Color.White.copy(alpha = 0.6f)
        )
        Text(
            text = value,
            fontSize = 14.sp,
            fontWeight = FontWeight.Bold,
            color = valueColor
        )
    }
}

@Composable
fun ProjectContainersComponent(
    modifier: Modifier = Modifier,
    projectName: String,
    containers: List<FlowNodeData>,
    isLoading: Boolean,
    onRefreshContainers: () -> Unit,
    onRunContainer: (FlowNodeData) -> Unit,
    viewMode: ViewMode = ViewMode.CONTAINERS,
    onSetViewMode: (ViewMode) -> Unit = {}
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(24.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White.copy(alpha = 0.06f)),
        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.12f))
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(14.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Default.Widgets,
                        contentDescription = null,
                        tint = GlassGem,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(Modifier.width(8.dp))
                    Text(
                        text = "Контейнери проекту",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                    Spacer(Modifier.width(6.dp))
                    IconButton(
                        onClick = onRefreshContainers,
                        modifier = Modifier.size(24.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Refresh,
                            contentDescription = "Оновити",
                            tint = Color.White.copy(alpha = 0.6f),
                            modifier = Modifier.size(14.dp)
                        )
                    }
                }

                BottomViewModeSwitcher(viewMode = viewMode, onSetViewMode = onSetViewMode)
            }

            Spacer(Modifier.height(12.dp))

            if (isLoading) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(
                        color = GlassGem,
                        modifier = Modifier.size(28.dp),
                        strokeWidth = 2.5.dp
                    )
                }
            } else if (containers.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            text = "У цьому проекті немає нод-контейнерів",
                            color = Color.White.copy(alpha = 0.5f),
                            fontSize = 13.sp
                        )
                        Spacer(Modifier.height(8.dp))
                        Button(
                            onClick = onRefreshContainers,
                            colors = ButtonDefaults.buttonColors(containerColor = Color.White.copy(alpha = 0.08f)),
                            shape = RoundedCornerShape(8.dp),
                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                        ) {
                            Text("Оновити списки", fontSize = 12.sp, color = Color.White)
                        }
                    }
                }
            } else {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(containers) { container ->
                        val label = container.data["label"] as? String
                            ?: container.data["name"] as? String
                            ?: "Контейнер #${container.id.takeLast(6)}"
                        val subNodesCount = (container.data["subNodes"] as? List<*>)?.size ?: 0
                        val configId = container.data["configId"] as? String

                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(GlassBg, RoundedCornerShape(12.dp))
                                .border(BorderStroke(1.dp, Color.White.copy(alpha = 0.12f)), RoundedCornerShape(12.dp))
                                .padding(horizontal = 12.dp, vertical = 10.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(
                                modifier = Modifier.weight(1f),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(36.dp)
                                        .background(GlassGem.copy(alpha = 0.15f), RoundedCornerShape(10.dp)),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.Widgets,
                                        contentDescription = null,
                                        tint = GlassGem,
                                        modifier = Modifier.size(18.dp)
                                    )
                                }
                                Spacer(Modifier.width(10.dp))
                                Column {
                                    Text(
                                        text = label,
                                        fontSize = 14.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = Color.White
                                    )
                                    Spacer(Modifier.height(2.dp))
                                    Text(
                                        text = buildString {
                                            append("Тип: ${container.type}")
                                            if (subNodesCount > 0) append(" · $subNodesCount нод")
                                            if (!configId.isNullOrBlank()) append(" · Конфіг: $configId")
                                        },
                                        fontSize = 11.sp,
                                        color = Color.White.copy(alpha = 0.5f)
                                    )
                                }
                            }

                            Spacer(Modifier.width(8.dp))

                            Button(
                                onClick = { onRunContainer(container) },
                                colors = ButtonDefaults.buttonColors(containerColor = GlassSuccess),
                                shape = RoundedCornerShape(8.dp),
                                contentPadding = PaddingValues(horizontal = 10.dp, vertical = 6.dp)
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(
                                        imageVector = Icons.Default.PlayArrow,
                                        contentDescription = null,
                                        tint = Color.White,
                                        modifier = Modifier.size(14.dp)
                                    )
                                    Spacer(Modifier.width(4.dp))
                                    Text(
                                        text = "Запустити",
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = Color.White
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

