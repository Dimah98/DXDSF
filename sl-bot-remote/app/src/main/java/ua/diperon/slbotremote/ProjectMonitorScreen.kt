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
import androidx.compose.material.icons.filled.AccessTime
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
import androidx.compose.material.icons.filled.History // Історія запусків
import androidx.compose.material.icons.filled.Description // Файл збереження
import androidx.compose.material.icons.filled.Search // Пошук
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
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.UnfoldMore
import androidx.compose.material.icons.filled.UnfoldLess
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.foundation.horizontalScroll
import androidx.compose.material.icons.filled.Send
import androidx.compose.material.icons.filled.ZoomIn
import androidx.compose.material.icons.filled.ZoomOut
import androidx.compose.material.icons.filled.RestartAlt
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material.icons.filled.TouchApp
import androidx.compose.material.icons.filled.PanTool
import androidx.compose.material.icons.filled.Mouse
import androidx.compose.material.icons.filled.PowerSettingsNew
import androidx.compose.material.icons.filled.KeyboardReturn
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import android.widget.Toast
import org.json.JSONObject
import org.json.JSONArray
import org.json.JSONTokener
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
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
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold // Фундаментальна трирівнева основа розмітки
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
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
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableLongStateOf
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
    val activeNodeTitle by viewModel.activeExecutingNodeTitle.collectAsState() // Активна нода, що виконується
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
    val projectRuns by viewModel.projectRuns.collectAsState()
    val selectedRunId by viewModel.selectedRunId.collectAsState()
    val selectedRunLogs by viewModel.selectedRunLogs.collectAsState()
    val isLoadingRuns by viewModel.isLoadingRuns.collectAsState()
    val isLoadingRunLogs by viewModel.isLoadingRunLogs.collectAsState()
    val projectSaveRawJson by viewModel.projectSaveRawJson.collectAsState()
    val isLoadingProjectSave by viewModel.isLoadingProjectSave.collectAsState()

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
        activeNodeTitle = activeNodeTitle,
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
        projectRuns = projectRuns,
        selectedRunId = selectedRunId,
        selectedRunLogs = selectedRunLogs,
        isLoadingRuns = isLoadingRuns,
        isLoadingRunLogs = isLoadingRunLogs,
        projectSaveRawJson = projectSaveRawJson,
        isLoadingProjectSave = isLoadingProjectSave,
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
        onSelectRun = { viewModel.selectRun(it) },
        onRefreshRuns = { viewModel.fetchProjectRuns() },
        onRefreshProjectSave = { viewModel.fetchProjectSaveRaw() },
        onSendMouseClick = { x, y, w, h -> viewModel.sendMouseClick(x, y, w, h) },
        onSendScroll = { dx, dy -> viewModel.sendScroll(dx, dy) },
        onSendMouseDown = { rx, ry, btn -> viewModel.sendMouseDown(rx, ry, btn) },
        onSendMouseMove = { rx, ry -> viewModel.sendMouseMove(rx, ry) },
        onSendMouseUp = { rx, ry, btn -> viewModel.sendMouseUp(rx, ry, btn) },
        onSendDoubleClick = { rx, ry -> viewModel.sendDoubleClick(rx, ry) },
        onSendRightClick = { rx, ry -> viewModel.sendRightClick(rx, ry) },
        onSendScrollUp = { viewModel.sendScrollUp() },
        onSendScrollDown = { viewModel.sendScrollDown() },
        onSendKeyPress = { key -> viewModel.sendKeyPress(key) },
        onSendTypeText = { txt, enter -> viewModel.sendTypeText(txt, enter) },
        onSendEsc = { viewModel.sendEsc() },
        onSendEnter = { viewModel.sendEnter() },
        onSendBackspace = { viewModel.sendBackspace() },
        onSendTab = { viewModel.sendTab() },
        onRefreshBrowserPage = { viewModel.refreshBrowserPage() },
        onNavigateToUrl = { url -> viewModel.navigateToUrl(url) },
        onGoBack = { viewModel.goBack() },
        onGoForward = { viewModel.goForward() },
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
    activeNodeTitle: String? = null,
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
    projectRuns: List<RunRecordItem> = emptyList(),
    selectedRunId: String? = null,
    selectedRunLogs: String? = null,
    isLoadingRuns: Boolean = false,
    isLoadingRunLogs: Boolean = false,
    projectSaveRawJson: String? = null,
    isLoadingProjectSave: Boolean = false,
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
    onSelectRun: (String?) -> Unit = {},
    onRefreshRuns: () -> Unit = {},
    onRefreshProjectSave: () -> Unit = {},
    onSendMouseClick: (Float, Float, Int, Int) -> Unit,
    onSendScroll: (Float, Float) -> Unit,
    onSendMouseDown: (Float, Float, String) -> Unit = { _, _, _ -> },
    onSendMouseMove: (Float, Float) -> Unit = { _, _ -> },
    onSendMouseUp: (Float, Float, String) -> Unit = { _, _, _ -> },
    onSendDoubleClick: (Float, Float) -> Unit = { _, _ -> },
    onSendRightClick: (Float, Float) -> Unit = { _, _ -> },
    onSendScrollUp: () -> Unit = {},
    onSendScrollDown: () -> Unit = {},
    onSendKeyPress: (String) -> Unit = {},
    onSendTypeText: (String, Boolean) -> Unit = { _, _ -> },
    onSendEsc: () -> Unit = {},
    onSendEnter: () -> Unit = {},
    onSendBackspace: () -> Unit = {},
    onSendTab: () -> Unit = {},
    onRefreshBrowserPage: () -> Unit = {},
    onNavigateToUrl: (String) -> Unit = {},
    onGoBack: () -> Unit = {},
    onGoForward: () -> Unit = {},
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
                        activeNodeTitle = activeNodeTitle,
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
                    ViewMode.RUN_HISTORY -> {
                        RunHistoryComponent(
                            modifier = bottomModeModifier,
                            projectName = projectName,
                            runs = projectRuns,
                            selectedRunId = selectedRunId,
                            selectedRunLogs = selectedRunLogs,
                            isLoadingRuns = isLoadingRuns,
                            isLoadingLogs = isLoadingRunLogs,
                            onSelectRun = onSelectRun,
                            onRefreshRuns = onRefreshRuns,
                            viewMode = viewMode,
                            onSetViewMode = onSetViewMode
                        )
                    }
                    ViewMode.SAVE_FILE -> {
                        SaveFileViewerComponent(
                            modifier = bottomModeModifier,
                            projectName = projectName,
                            rawJson = projectSaveRawJson,
                            isLoading = isLoadingProjectSave,
                            onRefresh = onRefreshProjectSave,
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
                isBrowserOpen = isBrowserOpen,
                activeNodeTitle = activeNodeTitle,
                onDismiss = { isFullScreenStream = false },
                onToggleBrowser = onToggleBrowser,
                onSendClick = { rx, ry, btn -> onSendMouseClick(rx, ry, 1, 1) },
                onSendMouseDown = onSendMouseDown,
                onSendMouseMove = onSendMouseMove,
                onSendMouseUp = onSendMouseUp,
                onSendDoubleClick = onSendDoubleClick,
                onSendRightClick = onSendRightClick,
                onSendScroll = onSendScroll,
                onSendScrollUp = onSendScrollUp,
                onSendScrollDown = onSendScrollDown,
                onSendKeyPress = onSendKeyPress,
                onSendTypeText = onSendTypeText,
                onSendEsc = onSendEsc,
                onSendEnter = onSendEnter,
                onSendBackspace = onSendBackspace,
                onSendTab = onSendTab,
                onRefreshBrowser = onRefreshBrowserPage,
                onNavigateToUrl = onNavigateToUrl,
                onGoBack = onGoBack,
                onGoForward = onGoForward
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
    activeNodeTitle: String? = null,
    onToggleStream: () -> Unit,
    onFullScreenClick: () -> Unit
) {
    val aspectRatio = remember(frameBitmap) {
        if (frameBitmap != null && !frameBitmap.isRecycled && frameBitmap.height > 0) {
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
                .clickable { if (isStreamingActive && frameBitmap != null && !frameBitmap.isRecycled) onFullScreenClick() },
            contentAlignment = Alignment.Center
        ) {
            if (isStreamingActive && frameBitmap != null && !frameBitmap.isRecycled) {
                Image(
                    bitmap = frameBitmap.asImageBitmap(),
                    contentDescription = "Пряма трансляція",
                    modifier = Modifier
                        .fillMaxWidth()
                        .aspectRatio(aspectRatio)
                        .clip(RoundedCornerShape(18.dp)),
                    contentScale = ContentScale.Fit
                )

                if (isBotRunning && !activeNodeTitle.isNullOrBlank()) {
                    Surface(
                        modifier = Modifier
                            .align(Alignment.TopStart)
                            .padding(10.dp),
                        shape = RoundedCornerShape(10.dp),
                        color = Color.Black.copy(alpha = 0.75f),
                        border = BorderStroke(1.dp, MaterialTheme.colorScheme.primary.copy(alpha = 0.5f))
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(8.dp)
                                    .clip(CircleShape)
                                    .background(Color(0xFF22C55E))
                            )
                            Text(
                                text = activeNodeTitle,
                                style = MaterialTheme.typography.labelSmall,
                                color = Color.White
                            )
                        }
                    }
                }
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

        // Історія запусків
        IconButton(
            onClick = { onSetViewMode(ViewMode.RUN_HISTORY) },
            modifier = Modifier
                .size(28.dp)
                .clip(RoundedCornerShape(8.dp))
                .background(if (viewMode == ViewMode.RUN_HISTORY) GlassGem.copy(alpha = 0.25f) else Color.Transparent)
        ) {
            Icon(
                imageVector = Icons.Default.History,
                contentDescription = "Історія запусків",
                tint = if (viewMode == ViewMode.RUN_HISTORY) GlassGem else Color.White.copy(alpha = 0.4f),
                modifier = Modifier.size(15.dp)
            )
        }

        // Файл збереження (_save.json)
        IconButton(
            onClick = { onSetViewMode(ViewMode.SAVE_FILE) },
            modifier = Modifier
                .size(28.dp)
                .clip(RoundedCornerShape(8.dp))
                .background(if (viewMode == ViewMode.SAVE_FILE) GlassGem.copy(alpha = 0.25f) else Color.Transparent)
        ) {
            Icon(
                imageVector = Icons.Default.Description,
                contentDescription = "Файл збереження",
                tint = if (viewMode == ViewMode.SAVE_FILE) GlassGem else Color.White.copy(alpha = 0.4f),
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

enum class AndroidStreamMode(val label: String) {
    DIRECT("Пряме"),
    DRAG("Перетягування"),
    CLICK("Клік"),
    SCROLL("Скрол")
}

data class StreamTouchRipple(
    val id: Long,
    val x: Float,
    val y: Float
)

@Composable
fun FullScreenStreamDialog(
    frameBitmap: android.graphics.Bitmap?,
    isBrowserOpen: Boolean,
    activeNodeTitle: String? = null,
    onDismiss: () -> Unit,
    onToggleBrowser: () -> Unit,
    onSendClick: (relX: Float, relY: Float, button: String) -> Unit,
    onSendMouseDown: (relX: Float, relY: Float, button: String) -> Unit,
    onSendMouseMove: (relX: Float, relY: Float) -> Unit,
    onSendMouseUp: (relX: Float, relY: Float, button: String) -> Unit,
    onSendDoubleClick: (relX: Float, relY: Float) -> Unit,
    onSendRightClick: (relX: Float, relY: Float) -> Unit,
    onSendScroll: (deltaX: Float, deltaY: Float) -> Unit,
    onSendScrollUp: () -> Unit,
    onSendScrollDown: () -> Unit,
    onSendKeyPress: (key: String) -> Unit,
    onSendTypeText: (text: String, pressEnter: Boolean) -> Unit,
    onSendEsc: () -> Unit,
    onSendEnter: () -> Unit,
    onSendBackspace: () -> Unit,
    onSendTab: () -> Unit,
    onRefreshBrowser: () -> Unit,
    onNavigateToUrl: (url: String) -> Unit,
    onGoBack: () -> Unit,
    onGoForward: () -> Unit
) {
    if (frameBitmap == null) return

    var mode by remember { mutableStateOf(AndroidStreamMode.DIRECT) }
    var textInput by remember { mutableStateOf("") }
    var pressEnterAfterType by remember { mutableStateOf(true) }
    var showNavToolbar by remember { mutableStateOf(false) }
    var navUrl by remember { mutableStateOf("https://sunflower-land.com/play/") }
    var lastTouchCoords by remember { mutableStateOf<Pair<Int, Int>?>(null) }
    val ripples = remember { mutableStateListOf<StreamTouchRipple>() }
    var lastDragTime by remember { mutableLongStateOf(0L) }

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
            var boxSize by remember { mutableStateOf(androidx.compose.ui.geometry.Size.Zero) }

            fun getRelCoords(touchX: Float, touchY: Float): Pair<Float, Float>? {
                val imgW = frameBitmap.width.toFloat()
                val imgH = frameBitmap.height.toFloat()
                val boxW = boxSize.width
                val boxH = boxSize.height

                if (boxW <= 0 || boxH <= 0 || imgW <= 0 || imgH <= 0) return null

                val imgAspect = imgW / imgH
                val boxAspect = boxW / boxH

                val drawW: Float
                val drawH: Float
                val offsetX: Float
                val offsetY: Float
                if (boxAspect > imgAspect) {
                    val h = boxH
                    val w = h * imgAspect
                    drawW = w; drawH = h; offsetX = (boxW - w) / 2f; offsetY = 0f
                } else {
                    val w = boxW
                    val h = w / imgAspect
                    drawW = w; drawH = h; offsetX = 0f; offsetY = (boxH - h) / 2f
                }

                val tapX = touchX - offsetX
                val tapY = touchY - offsetY

                if (drawW <= 0f || drawH <= 0f) return null

                val relX = (tapX / drawW).coerceIn(0f, 1f)
                val relY = (tapY / drawH).coerceIn(0f, 1f)
                return Pair(relX, relY)
            }

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
                    .pointerInput(mode) {
                        detectTapGestures(
                            onTap = { offset ->
                                val coords = getRelCoords(offset.x, offset.y) ?: return@detectTapGestures
                                val (relX, relY) = coords
                                lastTouchCoords = Pair((relX * 1280).toInt(), (relY * 720).toInt())
                                ripples.add(StreamTouchRipple(System.currentTimeMillis(), offset.x, offset.y))
                                onSendClick(relX, relY, "left")
                            },
                            onDoubleTap = { offset ->
                                val coords = getRelCoords(offset.x, offset.y) ?: return@detectTapGestures
                                val (relX, relY) = coords
                                onSendDoubleClick(relX, relY)
                            },
                            onLongPress = { offset ->
                                val coords = getRelCoords(offset.x, offset.y) ?: return@detectTapGestures
                                val (relX, relY) = coords
                                onSendRightClick(relX, relY)
                            }
                        )
                    }
                    .pointerInput(mode) {
                        detectDragGestures(
                            onDragStart = { offset ->
                                val coords = getRelCoords(offset.x, offset.y) ?: return@detectDragGestures
                                val (relX, relY) = coords
                                lastTouchCoords = Pair((relX * 1280).toInt(), (relY * 720).toInt())
                                if (mode == AndroidStreamMode.DIRECT || mode == AndroidStreamMode.DRAG) {
                                    onSendMouseDown(relX, relY, "left")
                                }
                            },
                            onDrag = { change, dragAmount ->
                                change.consume()
                                val coords = getRelCoords(change.position.x, change.position.y) ?: return@detectDragGestures
                                val (relX, relY) = coords
                                lastTouchCoords = Pair((relX * 1280).toInt(), (relY * 720).toInt())
                                val now = System.currentTimeMillis()
                                if (mode == AndroidStreamMode.SCROLL) {
                                    if (now - lastDragTime > 30) {
                                        lastDragTime = now
                                        onSendScroll(-dragAmount.x, -dragAmount.y)
                                    }
                                } else if (mode == AndroidStreamMode.DIRECT || mode == AndroidStreamMode.DRAG) {
                                    if (now - lastDragTime > 30) {
                                        lastDragTime = now
                                        onSendMouseMove(relX, relY)
                                    }
                                }
                            },
                            onDragEnd = {
                                if (mode == AndroidStreamMode.DIRECT || mode == AndroidStreamMode.DRAG) {
                                    val (relX, relY) = lastTouchCoords?.let {
                                        Pair(it.first / 1280f, it.second / 720f)
                                    } ?: Pair(0.5f, 0.5f)
                                    onSendMouseUp(relX, relY, "left")
                                }
                            },
                            onDragCancel = {
                                if (mode == AndroidStreamMode.DIRECT || mode == AndroidStreamMode.DRAG) {
                                    val (relX, relY) = lastTouchCoords?.let {
                                        Pair(it.first / 1280f, it.second / 720f)
                                    } ?: Pair(0.5f, 0.5f)
                                    onSendMouseUp(relX, relY, "left")
                                }
                            }
                        )
                    },
                contentScale = ContentScale.Fit
            )

            Canvas(modifier = Modifier.fillMaxSize()) {
                ripples.forEach { rip ->
                    drawCircle(
                        color = Color(0x9922C55E),
                        radius = 24.dp.toPx(),
                        center = androidx.compose.ui.geometry.Offset(rip.x, rip.y),
                        style = androidx.compose.ui.graphics.drawscope.Stroke(width = 3.dp.toPx())
                    )
                }
            }

            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .align(Alignment.TopCenter),
                color = Color(0xCC111827),
                border = BorderStroke(1.dp, Color.White.copy(alpha = 0.1f))
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 8.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Row(
                        modifier = Modifier
                            .weight(1f)
                            .horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        AndroidStreamMode.entries.forEach { m ->
                            val isSelected = mode == m
                            Surface(
                                shape = RoundedCornerShape(8.dp),
                                color = if (isSelected) Color(0xFF10B981) else Color.White.copy(alpha = 0.1f),
                                modifier = Modifier.clickable { mode = m }
                            ) {
                                Row(
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                                ) {
                                    Icon(
                                        imageVector = when (m) {
                                            AndroidStreamMode.DIRECT -> Icons.Default.TouchApp
                                            AndroidStreamMode.DRAG -> Icons.Default.PanTool
                                            AndroidStreamMode.CLICK -> Icons.Default.Mouse
                                            AndroidStreamMode.SCROLL -> Icons.Default.UnfoldMore
                                        },
                                        contentDescription = null,
                                        tint = if (isSelected) Color.White else Color.White.copy(alpha = 0.7f),
                                        modifier = Modifier.size(14.dp)
                                    )
                                    Text(
                                        text = m.label,
                                        color = if (isSelected) Color.White else Color.White.copy(alpha = 0.7f),
                                        style = MaterialTheme.typography.labelSmall
                                    )
                                }
                            }
                        }
                    }

                    Spacer(modifier = Modifier.width(8.dp))

                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = if (isBrowserOpen) Color(0xFFDC2626) else Color(0xFF16A34A),
                            modifier = Modifier.clickable { onToggleBrowser() }
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(4.dp)
                            ) {
                                Icon(
                                    imageVector = if (isBrowserOpen) Icons.Default.Stop else Icons.Default.PlayArrow,
                                    contentDescription = null,
                                    tint = Color.White,
                                    modifier = Modifier.size(14.dp)
                                )
                                Text(
                                    text = if (isBrowserOpen) "Стоп" else "Старт",
                                    color = Color.White,
                                    style = MaterialTheme.typography.labelSmall
                                )
                            }
                        }

                        IconButton(
                            onClick = onDismiss,
                            modifier = Modifier
                                .size(28.dp)
                                .background(Color.White.copy(alpha = 0.1f), CircleShape)
                        ) {
                            Icon(Icons.Default.Close, contentDescription = "Закрити", tint = Color.White, modifier = Modifier.size(16.dp))
                        }
                    }
                }
            }

            Row(
                modifier = Modifier
                    .align(Alignment.TopStart)
                    .padding(top = 56.dp, start = 12.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = Color(0xCCDC2626),
                    border = BorderStroke(1.dp, Color.White.copy(alpha = 0.2f))
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Box(modifier = Modifier.size(6.dp).clip(CircleShape).background(Color.White))
                        Text(text = "LIVE", color = Color.White, style = MaterialTheme.typography.labelSmall)
                    }
                }

                if (!activeNodeTitle.isNullOrBlank()) {
                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = Color(0xCC000000),
                        border = BorderStroke(1.dp, Color(0xFF10B981).copy(alpha = 0.6f))
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            Box(modifier = Modifier.size(6.dp).clip(CircleShape).background(Color(0xFF10B981)))
                            Text(text = activeNodeTitle, color = Color.White, style = MaterialTheme.typography.labelSmall)
                        }
                    }
                }

                lastTouchCoords?.let { coords ->
                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = Color(0x99000000)
                    ) {
                        Text(
                            text = "${coords.first}, ${coords.second}",
                            color = Color.White.copy(alpha = 0.8f),
                            style = MaterialTheme.typography.labelSmall,
                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                        )
                    }
                }
            }

            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .align(Alignment.BottomCenter),
                color = Color(0xEE111827),
                border = BorderStroke(1.dp, Color.White.copy(alpha = 0.1f))
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 8.dp, vertical = 6.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        OutlinedTextField(
                            value = textInput,
                            onValueChange = { textInput = it },
                            placeholder = {
                                Text("Введіть текст...", style = MaterialTheme.typography.bodySmall, color = Color.White.copy(alpha = 0.4f))
                            },
                            modifier = Modifier.weight(1f).height(46.dp),
                            singleLine = true,
                            shape = RoundedCornerShape(10.dp),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedTextColor = Color.White,
                                unfocusedTextColor = Color.White,
                                focusedContainerColor = Color.White.copy(alpha = 0.08f),
                                unfocusedContainerColor = Color.White.copy(alpha = 0.05f),
                                focusedBorderColor = Color(0xFF10B981),
                                unfocusedBorderColor = Color.White.copy(alpha = 0.15f)
                            ),
                            textStyle = MaterialTheme.typography.bodySmall
                        )

                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = Color.White.copy(alpha = 0.08f),
                            modifier = Modifier.clickable { pressEnterAfterType = !pressEnterAfterType }
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 6.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(2.dp)
                            ) {
                                Checkbox(
                                    checked = pressEnterAfterType,
                                    onCheckedChange = { pressEnterAfterType = it },
                                    modifier = Modifier.size(18.dp),
                                    colors = CheckboxDefaults.colors(
                                        checkedColor = Color(0xFF10B981),
                                        uncheckedColor = Color.White.copy(alpha = 0.4f)
                                    )
                                )
                                Text(text = "+↵", style = MaterialTheme.typography.labelSmall, color = Color.White.copy(alpha = 0.8f))
                            }
                        }

                        IconButton(
                            onClick = {
                                if (textInput.isNotBlank()) {
                                    onSendTypeText(textInput, pressEnterAfterType)
                                    textInput = ""
                                }
                            },
                            enabled = textInput.isNotBlank(),
                            modifier = Modifier
                                .size(40.dp)
                                .background(if (textInput.isNotBlank()) Color(0xFF10B981) else Color.White.copy(alpha = 0.1f), RoundedCornerShape(10.dp))
                        ) {
                            Icon(Icons.Default.Send, contentDescription = "Надіслати", tint = Color.White, modifier = Modifier.size(18.dp))
                        }

                        IconButton(
                            onClick = { showNavToolbar = !showNavToolbar },
                            modifier = Modifier
                                .size(40.dp)
                                .background(if (showNavToolbar) Color(0xFF4F46E5) else Color.White.copy(alpha = 0.1f), RoundedCornerShape(10.dp))
                        ) {
                            Icon(Icons.Default.Language, contentDescription = "URL", tint = Color.White, modifier = Modifier.size(18.dp))
                        }
                    }

                    AnimatedVisibility(visible = showNavToolbar) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            OutlinedTextField(
                                value = navUrl,
                                onValueChange = { navUrl = it },
                                placeholder = {
                                    Text("https://sunflower-land.com/play/", style = MaterialTheme.typography.bodySmall, color = Color.White.copy(alpha = 0.4f))
                                },
                                modifier = Modifier.weight(1f).height(46.dp),
                                singleLine = true,
                                shape = RoundedCornerShape(10.dp),
                                colors = OutlinedTextFieldDefaults.colors(
                                    focusedTextColor = Color.White,
                                    unfocusedTextColor = Color.White,
                                    focusedContainerColor = Color.White.copy(alpha = 0.08f),
                                    unfocusedContainerColor = Color.White.copy(alpha = 0.05f),
                                    focusedBorderColor = Color(0xFF4F46E5),
                                    unfocusedBorderColor = Color.White.copy(alpha = 0.15f)
                                ),
                                textStyle = MaterialTheme.typography.bodySmall
                            )
                            Button(
                                onClick = {
                                    if (navUrl.isNotBlank()) {
                                        onNavigateToUrl(navUrl)
                                    }
                                },
                                shape = RoundedCornerShape(10.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF4F46E5)),
                                modifier = Modifier.height(46.dp)
                            ) {
                                Text("Перейти", color = Color.White, style = MaterialTheme.typography.labelSmall)
                            }
                        }
                    }

                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(5.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        QuickKeyPill(text = "↵ Enter", color = Color.White.copy(alpha = 0.15f)) { onSendEnter() }
                        QuickKeyPill(text = "ESC", color = Color(0xFFE11D48)) { onSendEsc() }
                        QuickKeyPill(text = "Tab", color = Color.White.copy(alpha = 0.15f)) { onSendTab() }
                        QuickKeyPill(text = "⌫ Backspace", color = Color.White.copy(alpha = 0.15f)) { onSendBackspace() }
                        QuickKeyPill(text = "Space", color = Color.White.copy(alpha = 0.15f)) { onSendTypeText(" ", false) }

                        Box(modifier = Modifier.size(1.dp, 16.dp).background(Color.White.copy(alpha = 0.2f)))

                        QuickKeyPill(text = "←", color = Color.White.copy(alpha = 0.15f)) { onSendKeyPress("ArrowLeft") }
                        QuickKeyIconPill(icon = Icons.Default.KeyboardArrowUp) { onSendKeyPress("ArrowUp") }
                        QuickKeyIconPill(icon = Icons.Default.KeyboardArrowDown) { onSendKeyPress("ArrowDown") }
                        QuickKeyPill(text = "→", color = Color.White.copy(alpha = 0.15f)) { onSendKeyPress("ArrowRight") }

                        Box(modifier = Modifier.size(1.dp, 16.dp).background(Color.White.copy(alpha = 0.2f)))

                        QuickKeyIconPill(icon = Icons.AutoMirrored.Filled.ArrowBack, tooltip = "Назад") { onGoBack() }
                        QuickKeyIconPill(icon = Icons.AutoMirrored.Filled.ArrowForward, tooltip = "Вперед") { onGoForward() }
                        QuickKeyPill(text = "↻ Оновити", color = Color.White.copy(alpha = 0.15f)) { onRefreshBrowser() }
                        QuickKeyIconPill(icon = Icons.Default.KeyboardArrowUp, tooltip = "Скрол вгору") { onSendScrollUp() }
                        QuickKeyIconPill(icon = Icons.Default.KeyboardArrowDown, tooltip = "Скрол вниз") { onSendScrollDown() }
                    }
                }
            }
        }
    }
}

@Composable
private fun QuickKeyPill(text: String, color: Color = Color.White.copy(alpha = 0.15f), onClick: () -> Unit) {
    Surface(
        shape = RoundedCornerShape(8.dp),
        color = color,
        modifier = Modifier.clickable { onClick() }
    ) {
        Text(
            text = text,
            color = Color.White,
            style = MaterialTheme.typography.labelSmall,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 6.dp)
        )
    }
}

@Composable
private fun QuickKeyIconPill(icon: androidx.compose.ui.graphics.vector.ImageVector, tooltip: String? = null, onClick: () -> Unit) {
    Surface(
        shape = RoundedCornerShape(8.dp),
        color = Color.White.copy(alpha = 0.15f),
        modifier = Modifier.clickable { onClick() }
    ) {
        Box(modifier = Modifier.padding(6.dp), contentAlignment = Alignment.Center) {
            Icon(imageVector = icon, contentDescription = tooltip, tint = Color.White, modifier = Modifier.size(16.dp))
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
                var expandedContainerId by remember { mutableStateOf<String?>(null) }

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
                        val subNodesList = container.data["subNodes"] as? List<*>
                        val subNodesCount = subNodesList?.size ?: 0
                        val configId = container.data["configId"] as? String
                        val isExpanded = expandedContainerId == container.id

                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(GlassBg, RoundedCornerShape(12.dp))
                                .border(
                                    BorderStroke(
                                        1.dp,
                                        if (isExpanded) GlassGem.copy(alpha = 0.5f) else Color.White.copy(alpha = 0.12f)
                                    ),
                                    RoundedCornerShape(12.dp)
                                )
                        ) {
                            // Container header row
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable { expandedContainerId = if (isExpanded) null else container.id }
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
                                            .background(
                                                if (isExpanded) GlassGem.copy(alpha = 0.3f) else GlassGem.copy(alpha = 0.15f),
                                                RoundedCornerShape(10.dp)
                                            ),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Icon(
                                            imageVector = if (isExpanded) Icons.Default.KeyboardArrowDown else Icons.Default.Widgets,
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

                                Row(
                                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
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

                            // Expanded: subnodes list
                            AnimatedVisibility(visible = isExpanded) {
                                Column(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .background(Color.Black.copy(alpha = 0.3f), RoundedCornerShape(bottomStart = 12.dp, bottomEnd = 12.dp))
                                        .padding(10.dp),
                                    verticalArrangement = Arrangement.spacedBy(6.dp)
                                ) {
                                    Text(
                                        text = "Ноди контейнера",
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = GlassGem.copy(alpha = 0.9f),
                                        modifier = Modifier.padding(bottom = 4.dp)
                                    )

                                    if (subNodesList.isNullOrEmpty()) {
                                        Text(
                                            text = "Ноди відсутні або не завантажені",
                                            fontSize = 11.sp,
                                            color = Color.White.copy(alpha = 0.4f)
                                        )
                                    } else {
                                        subNodesList.forEachIndexed { idx, rawNode ->
                                            val nodeMap = rawNode as? Map<*, *>
                                            val nodeId = nodeMap?.get("id") as? String ?: "node_$idx"
                                            val nodeType = nodeMap?.get("type") as? String ?: "unknown"
                                            val nodeDataMap = nodeMap?.get("data") as? Map<*, *>
                                            val nodeLabel = nodeDataMap?.get("label") as? String
                                                ?: nodeDataMap?.get("name") as? String
                                                ?: nodeType

                                            val nodeColor = NODE_TYPES.find { it.type == nodeType }?.color ?: 0xFF6B7280

                                            Row(
                                                modifier = Modifier
                                                    .fillMaxWidth()
                                                    .background(Color.White.copy(alpha = 0.04f), RoundedCornerShape(8.dp))
                                                    .border(BorderStroke(1.dp, Color.White.copy(alpha = 0.08f)), RoundedCornerShape(8.dp))
                                                    .padding(horizontal = 10.dp, vertical = 7.dp),
                                                verticalAlignment = Alignment.CenterVertically,
                                                horizontalArrangement = Arrangement.SpaceBetween
                                            ) {
                                                Row(
                                                    verticalAlignment = Alignment.CenterVertically,
                                                    modifier = Modifier.weight(1f)
                                                ) {
                                                    Box(
                                                        modifier = Modifier
                                                            .size(8.dp)
                                                            .background(Color(nodeColor), CircleShape)
                                                    )
                                                    Spacer(Modifier.width(8.dp))
                                                    Column {
                                                        Text(
                                                            text = nodeLabel,
                                                            fontSize = 12.sp,
                                                            fontWeight = FontWeight.Medium,
                                                            color = Color.White,
                                                            maxLines = 1
                                                        )
                                                        Text(
                                                            text = nodeType,
                                                            fontSize = 10.sp,
                                                            color = Color.White.copy(alpha = 0.4f)
                                                        )
                                                    }
                                                }

                                                // Show editable fields based on node type
                                                if (nodeDataMap != null) {
                                                    val selector = nodeDataMap["selector"] as? String
                                                    val delay = nodeDataMap["delay"]
                                                    val value = nodeDataMap["value"] as? String
                                                    Row(
                                                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                                                        verticalAlignment = Alignment.CenterVertically
                                                    ) {
                                                        if (!selector.isNullOrBlank()) {
                                                            Surface(
                                                                shape = RoundedCornerShape(6.dp),
                                                                color = GlassIndigo.copy(alpha = 0.15f)
                                                            ) {
                                                                Text(
                                                                    text = selector.take(20) + if (selector.length > 20) "…" else "",
                                                                    fontSize = 9.sp,
                                                                    color = GlassIndigoLight,
                                                                    modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp),
                                                                    maxLines = 1
                                                                )
                                                            }
                                                        }
                                                        if (delay != null) {
                                                            Surface(
                                                                shape = RoundedCornerShape(6.dp),
                                                                color = Color(0xFFF59E0B).copy(alpha = 0.15f)
                                                            ) {
                                                                Text(
                                                                    text = "${delay}ms",
                                                                    fontSize = 9.sp,
                                                                    color = Color(0xFFF59E0B),
                                                                    modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp)
                                                                )
                                                            }
                                                        }
                                                        if (!value.isNullOrBlank()) {
                                                            Surface(
                                                                shape = RoundedCornerShape(6.dp),
                                                                color = GlassSuccess.copy(alpha = 0.15f)
                                                            ) {
                                                                Text(
                                                                    text = value.take(15) + if (value.length > 15) "…" else "",
                                                                    fontSize = 9.sp,
                                                                    color = GlassSuccess,
                                                                    modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp)
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
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun RunHistoryComponent(
    modifier: Modifier = Modifier,
    projectName: String,
    runs: List<RunRecordItem>,
    selectedRunId: String?,
    selectedRunLogs: String?,
    isLoadingRuns: Boolean,
    isLoadingLogs: Boolean,
    onSelectRun: (String?) -> Unit,
    onRefreshRuns: () -> Unit,
    viewMode: ViewMode = ViewMode.RUN_HISTORY,
    onSetViewMode: (ViewMode) -> Unit = {}
) {
    var isMinimalMode by remember { mutableStateOf(true) }

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
            // Header
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    if (selectedRunId != null) {
                        IconButton(
                            onClick = { onSelectRun(null) },
                            modifier = Modifier
                                .size(28.dp)
                                .clip(RoundedCornerShape(8.dp))
                                .background(Color.White.copy(alpha = 0.1f))
                        ) {
                            Icon(
                                imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                                contentDescription = "Назад",
                                tint = Color.White,
                                modifier = Modifier.size(16.dp)
                            )
                        }
                        Spacer(Modifier.width(8.dp))
                    } else {
                        Icon(
                            imageVector = Icons.Default.History,
                            contentDescription = null,
                            tint = GlassGem,
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(Modifier.width(8.dp))
                    }
                    Text(
                        text = if (selectedRunId != null) "Логи запуску" else "Історія запусків",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                    Spacer(Modifier.width(8.dp))
                    IconButton(
                        onClick = onRefreshRuns,
                        modifier = Modifier.size(24.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Refresh,
                            contentDescription = "Оновити",
                            tint = Color.White.copy(alpha = 0.7f),
                            modifier = Modifier.size(14.dp)
                        )
                    }
                }

                Row(verticalAlignment = Alignment.CenterVertically) {
                    if (selectedRunId != null) {
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .background(if (isMinimalMode) GlassIndigo.copy(alpha = 0.3f) else Color.White.copy(alpha = 0.08f))
                                .clickable { isMinimalMode = !isMinimalMode }
                                .padding(horizontal = 8.dp, vertical = 4.dp)
                        ) {
                            Text(
                                text = if (isMinimalMode) "⚡ Мінімалізм: ON" else "📄 Повні логи",
                                color = if (isMinimalMode) GlassIndigoLight else Color.White.copy(alpha = 0.6f),
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                        Spacer(Modifier.width(6.dp))
                    }
                    BottomViewModeSwitcher(viewMode = viewMode, onSetViewMode = onSetViewMode)
                }
            }

            Spacer(Modifier.height(10.dp))

            // Body
            if (selectedRunId == null) {
                // List of runs
                if (isLoadingRuns && runs.isEmpty()) {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = GlassIndigo, modifier = Modifier.size(28.dp))
                    }
                } else if (runs.isEmpty()) {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Text(
                            text = "Немає збережених запусків",
                            color = Color.White.copy(alpha = 0.4f),
                            fontSize = 12.sp,
                            fontStyle = androidx.compose.ui.text.font.FontStyle.Italic
                        )
                    }
                } else {
                    LazyColumn(
                        modifier = Modifier
                            .fillMaxWidth()
                            .weight(1f),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(runs, key = { it.runId }) { r ->
                            val startTimeStr = remember(r.startTime) {
                                val sdf = java.text.SimpleDateFormat("dd.MM.yyyy HH:mm:ss", Locale.getDefault())
                                sdf.format(java.util.Date(r.startTime))
                            }
                            val durationStr = remember(r.startTime, r.endTime) {
                                if (r.endTime != null && r.endTime > r.startTime) {
                                    val sec = (r.endTime - r.startTime) / 1000.0
                                    String.format(Locale.US, "%.1fс", sec)
                                } else null
                            }

                            val statusBg = when (r.status) {
                                "success" -> GlassSuccess.copy(alpha = 0.15f)
                                "error" -> Color(0xFFEF4444).copy(alpha = 0.15f)
                                else -> GlassIndigo.copy(alpha = 0.15f)
                            }
                            val statusColor = when (r.status) {
                                "success" -> GlassSuccess
                                "error" -> Color(0xFFEF4444)
                                else -> GlassIndigoLight
                            }

                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(Color.White.copy(alpha = 0.04f))
                                    .border(1.dp, Color.White.copy(alpha = 0.08f), RoundedCornerShape(12.dp))
                                    .clickable { onSelectRun(r.runId) }
                                    .padding(12.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = startTimeStr,
                                        color = Color.White,
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                    if (durationStr != null) {
                                        Spacer(Modifier.height(2.dp))
                                        Text(
                                            text = "Тривалість: $durationStr",
                                            color = Color.White.copy(alpha = 0.5f),
                                            fontSize = 10.sp
                                        )
                                    }
                                }

                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(6.dp))
                                        .background(statusBg)
                                        .border(1.dp, statusColor.copy(alpha = 0.3f), RoundedCornerShape(6.dp))
                                        .padding(horizontal = 8.dp, vertical = 3.dp)
                                ) {
                                    Text(
                                        text = r.status,
                                        color = statusColor,
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                            }
                        }
                    }
                }
            } else {
                // Logs of selected run
                if (isLoadingLogs) {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = GlassIndigo, modifier = Modifier.size(28.dp))
                    }
                } else if (selectedRunLogs.isNullOrBlank()) {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Text(
                            text = "Файл логів порожній",
                            color = Color.White.copy(alpha = 0.4f),
                            fontSize = 12.sp
                        )
                    }
                } else {
                    val parsedLogs = remember(selectedRunLogs) {
                        parseRunLogs(selectedRunLogs)
                    }

                    if (isMinimalMode) {
                        val minimalItems = remember(parsedLogs) {
                            buildMinimalLogItems(parsedLogs)
                        }

                        LazyColumn(
                            modifier = Modifier
                                .fillMaxWidth()
                                .weight(1f)
                                .clip(RoundedCornerShape(12.dp))
                                .background(Color.Black.copy(alpha = 0.4f))
                                .padding(10.dp),
                            verticalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            items(minimalItems, key = { it.id }) { item ->
                                when (item) {
                                    is MinimalLogItem.ContainerCard -> {
                                        Column(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .clip(RoundedCornerShape(12.dp))
                                                .background(GlassIndigo.copy(alpha = 0.1f))
                                                .border(1.dp, GlassIndigo.copy(alpha = 0.25f), RoundedCornerShape(12.dp))
                                                .padding(10.dp)
                                        ) {
                                            Row(
                                                verticalAlignment = Alignment.CenterVertically,
                                                horizontalArrangement = Arrangement.spacedBy(6.dp)
                                            ) {
                                                Box(
                                                    modifier = Modifier
                                                        .size(8.dp)
                                                        .background(GlassIndigoLight, CircleShape)
                                                )
                                                Text(
                                                    text = item.title,
                                                    color = GlassIndigoLight,
                                                    fontSize = 12.sp,
                                                    fontWeight = FontWeight.Bold
                                                )
                                            }
                                            Spacer(Modifier.height(4.dp))
                                            Row(
                                                modifier = Modifier
                                                    .fillMaxWidth()
                                                    .padding(start = 6.dp)
                                            ) {
                                                Box(
                                                    modifier = Modifier
                                                        .width(2.dp)
                                                        .height(20.dp)
                                                        .background(GlassIndigo.copy(alpha = 0.4f))
                                                )
                                                Spacer(Modifier.width(8.dp))
                                                Text(
                                                    text = item.summary,
                                                    color = if (item.isError) Color(0xFFEF4444) else Color.White.copy(alpha = 0.85f),
                                                    fontSize = 11.sp,
                                                    fontFamily = FontFamily.Monospace,
                                                    fontWeight = if (item.isError) FontWeight.Bold else FontWeight.Normal
                                                )
                                            }
                                        }
                                    }
                                    is MinimalLogItem.NodeRow -> {
                                        Row(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .clip(RoundedCornerShape(8.dp))
                                                .background(if (item.hasError) Color(0xFFEF4444).copy(alpha = 0.12f) else Color.White.copy(alpha = 0.04f))
                                                .border(
                                                    1.dp,
                                                    if (item.hasError) Color(0xFFEF4444).copy(alpha = 0.25f) else Color.White.copy(alpha = 0.06f),
                                                    RoundedCornerShape(8.dp)
                                                )
                                                .padding(horizontal = 10.dp, vertical = 7.dp),
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Row(
                                                verticalAlignment = Alignment.CenterVertically,
                                                horizontalArrangement = Arrangement.spacedBy(6.dp),
                                                modifier = Modifier.weight(1f, fill = false)
                                            ) {
                                                Text(
                                                    text = if (item.hasError) "❌" else "✅",
                                                    fontSize = 12.sp
                                                )
                                                Text(
                                                    text = item.title,
                                                    color = if (item.hasError) Color(0xFFEF4444) else GlassSuccess,
                                                    fontSize = 12.sp,
                                                    fontWeight = FontWeight.Bold
                                                )
                                                if (item.errorMsg != null) {
                                                    Text(
                                                        text = item.errorMsg,
                                                        color = Color.White.copy(alpha = 0.6f),
                                                        fontSize = 10.sp,
                                                        maxLines = 1
                                                    )
                                                }
                                            }
                                            if (item.duration != null) {
                                                Box(
                                                    modifier = Modifier
                                                        .clip(RoundedCornerShape(4.dp))
                                                        .background(Color.Black.copy(alpha = 0.3f))
                                                        .padding(horizontal = 6.dp, vertical = 2.dp)
                                                ) {
                                                    Text(
                                                        text = item.duration,
                                                        color = Color.White.copy(alpha = 0.5f),
                                                        fontSize = 10.sp,
                                                        fontFamily = FontFamily.Monospace
                                                    )
                                                }
                                            }
                                        }
                                    }
                                    is MinimalLogItem.Standalone -> {
                                        Text(
                                            text = item.message,
                                            color = Color.White.copy(alpha = 0.45f),
                                            fontSize = 11.sp,
                                            fontStyle = androidx.compose.ui.text.font.FontStyle.Italic,
                                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                        )
                                    }
                                }
                            }
                        }
                    } else {
                        // Full log mode
                        LazyColumn(
                            modifier = Modifier
                                .fillMaxWidth()
                                .weight(1f)
                                .clip(RoundedCornerShape(12.dp))
                                .background(Color.Black.copy(alpha = 0.4f))
                                .padding(10.dp),
                            verticalArrangement = Arrangement.spacedBy(2.dp)
                        ) {
                            items(parsedLogs, key = { it.id }) { log ->
                                val textColor = when {
                                    log.isError -> Color(0xFFEF4444)
                                    log.level == "SUCCESS" || log.message.contains("✅") -> GlassSuccess
                                    log.level == "WARN" || log.message.contains("⚠️") -> GlassWarning
                                    log.level == "INFO" -> GlassIndigoLight
                                    else -> Color.White.copy(alpha = 0.85f)
                                }

                                val timeStr = if (log.timestamp.isNotEmpty()) {
                                    val parts = log.timestamp.split("T")
                                    if (parts.size > 1) parts[1].replace("Z", "") else log.timestamp
                                } else ""

                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    verticalAlignment = Alignment.Top
                                ) {
                                    if (timeStr.isNotEmpty()) {
                                        Text(
                                            text = "[$timeStr] ",
                                            color = Color.White.copy(alpha = 0.35f),
                                            fontSize = 10.sp,
                                            fontFamily = FontFamily.Monospace
                                        )
                                    }
                                    Text(
                                        text = if (timeStr.isNotEmpty() && log.raw.contains("] ")) log.raw.substringAfter("] ") else log.raw,
                                        color = textColor,
                                        fontSize = 11.sp,
                                        fontFamily = FontFamily.Monospace,
                                        lineHeight = 15.sp
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

private data class ParsedRunLog(
    val id: String,
    val timestamp: String,
    val level: String,
    val container: String?,
    val node: String?,
    val message: String,
    val raw: String,
    val isError: Boolean
)

private sealed class MinimalLogItem(val id: String) {
    class Standalone(id: String, val message: String) : MinimalLogItem(id)
    class ContainerCard(id: String, val title: String, val summary: String, val isError: Boolean) : MinimalLogItem(id)
    class NodeRow(id: String, val title: String, val hasError: Boolean, val errorMsg: String?, val duration: String?) : MinimalLogItem(id)
}

private val LOG_LINE_REGEX = Regex("""^\[(.*?)\] \[(.*?)\] (?:\[(.*?)\] )?(?:  ↳ \[(.*?)\] )?(.*)$""")

private fun parseRunLogs(rawLogs: String): List<ParsedRunLog> {
    if (rawLogs.isBlank()) return emptyList()
    val lines = rawLogs.split('\n').filter { it.trim().isNotEmpty() }
    val result = mutableListOf<ParsedRunLog>()

    for (i in lines.indices) {
        val line = lines[i]
        val match = LOG_LINE_REGEX.find(line)
        if (match != null) {
            val ts = match.groupValues[1]
            val lvl = match.groupValues[2]
            var container = match.groupValues[3].ifEmpty { null }
            val node = match.groupValues[4].ifEmpty { null }
            val msg = match.groupValues[5]

            var virtualNode = node
            if (node == null && container != null) {
                if (msg.contains("↳ ⏱️ Затримка")) {
                    virtualNode = msg.replace("↳ ", "").trim()
                } else if (msg.contains("Підпрограма завершена") || msg.contains(Regex("""^🏁 \d+мс"""))) {
                    virtualNode = "$container (Завершення)"
                } else {
                    virtualNode = container
                    container = null
                }
            }

            result.add(
                ParsedRunLog(
                    id = "log_$i",
                    timestamp = ts,
                    level = lvl,
                    container = container,
                    node = virtualNode,
                    message = msg,
                    raw = line,
                    isError = lvl == "ERROR" || msg.contains("❌") || msg.contains("error", ignoreCase = true) || msg.contains("Помилка", ignoreCase = true)
                )
            )
        } else {
            result.add(
                ParsedRunLog(
                    id = "log_$i",
                    timestamp = "",
                    level = "",
                    container = null,
                    node = null,
                    message = line,
                    raw = line,
                    isError = line.contains("❌") || line.contains("error", ignoreCase = true) || line.contains("Помилка", ignoreCase = true)
                )
            )
        }
    }
    return result
}

private fun summarizeRunLogs(logs: List<ParsedRunLog>): Pair<String, Boolean> {
    val err = logs.firstOrNull { it.isError && !it.message.contains("Результат") && !it.message.contains("Конфіг") }
    if (err != null) return err.message to true

    val schedule = logs.firstOrNull { it.message.contains("📅") }
    if (schedule != null) return schedule.message to false

    val pass = logs.firstOrNull { it.message.contains("Конфіг TRUE") || it.message.contains("Конфіг «") }
    if (pass != null) {
        val countLog = logs.firstOrNull { it.message.contains("Запуск підпрограми") }
        if (countLog != null) {
            val m = Regex("""\(\d+ нод\)""").find(countLog.message)
            if (m != null) return "✅ Умови виконано — запуск ${m.value}" to false
        }
        if (pass.message.contains("TRUE")) return "✅ Умови виконано" to false
        if (pass.message.contains("FALSE")) {
            val reason = logs.firstOrNull { it.message.contains("→ false") }
            if (reason != null) return "❌ Пропущено: ${reason.message.replace(" → false", "")}" to true
            return "❌ Пропущено (умови не виконані)" to true
        }
    }

    val resLog = logs.firstOrNull { it.message.contains("Результат «") }
    if (resLog != null) {
        if (resLog.message.contains("TRUE")) return "✅ Умови виконано" to false
        if (resLog.message.contains("FALSE")) {
            val reason = logs.firstOrNull { it.message.contains("→ false") }
            if (reason != null) return "❌ Пропущено: ${reason.message.replace(" → false", "")}" to true
            return "❌ Пропущено (умови не виконані)" to true
        }
    }

    val action = logs.asReversed().firstOrNull { !it.message.contains("▶️ Старт") && !it.message.matches(Regex("""^🏁.*""")) }
    if (action != null) return action.message to action.isError

    return (logs.firstOrNull()?.message ?: "") to (logs.firstOrNull()?.isError ?: false)
}

private fun buildMinimalLogItems(parsedLogs: List<ParsedRunLog>): List<MinimalLogItem> {
    val items = mutableListOf<MinimalLogItem>()
    var currentNodeKey: String? = null
    val currentNodeLogs = mutableListOf<ParsedRunLog>()
    var isCurrentNodeContainer = false

    fun flushNode() {
        if (currentNodeLogs.isEmpty()) return
        if (isCurrentNodeContainer) {
            val (summary, isErr) = summarizeRunLogs(currentNodeLogs)
            items.add(
                MinimalLogItem.ContainerCard(
                    id = "cnt_${currentNodeLogs[0].id}",
                    title = currentNodeKey ?: "Підпрограма",
                    summary = summary,
                    isError = isErr
                )
            )
        } else {
            val hasError = currentNodeLogs.any { it.isError }
            val errorLog = currentNodeLogs.firstOrNull { it.isError }
            val durationLog = currentNodeLogs.firstOrNull { it.message.contains(Regex("""🏁 \d+мс""")) }
            var duration: String? = null
            if (durationLog != null) {
                val m = Regex("""🏁 (\d+мс)""").find(durationLog.message)
                if (m != null) duration = m.groupValues[1]
            }

            val nodeName = currentNodeKey?.split(" ↳ ")?.lastOrNull() ?: currentNodeKey ?: "Система"
            items.add(
                MinimalLogItem.NodeRow(
                    id = "node_${currentNodeLogs[0].id}",
                    title = nodeName,
                    hasError = hasError,
                    errorMsg = if (hasError) errorLog?.message else null,
                    duration = duration
                )
            )
        }
        currentNodeLogs.clear()
    }

    parsedLogs.forEach { log ->
        if (log.node == null && log.container == null) {
            flushNode()
            items.add(MinimalLogItem.Standalone(id = log.id, message = log.message))
            return@forEach
        }

        val key = if (log.container != null) "${log.container} ↳ ${log.node}" else log.node

        if (key != currentNodeKey) {
            flushNode()
            currentNodeKey = key
            isCurrentNodeContainer = (log.container == null)
        }
        currentNodeLogs.add(log)
    }
    flushNode()

    return items
}

// ----------------------------------------------------
// SAVE FILE JSON TREE VIEWER
// ----------------------------------------------------

private sealed class JsonTreeNode(
    val key: String,
    val fullPath: String
) {
    class ObjectNode(
        key: String,
        fullPath: String,
        val children: List<JsonTreeNode>
    ) : JsonTreeNode(key, fullPath)

    class ArrayNode(
        key: String,
        fullPath: String,
        val children: List<JsonTreeNode>
    ) : JsonTreeNode(key, fullPath)

    class LeafNode(
        key: String,
        fullPath: String,
        val value: Any?,
        val valueType: String
    ) : JsonTreeNode(key, fullPath)
}

private fun parseJsonTreeNode(key: String, path: String, value: Any?): JsonTreeNode {
    return when (value) {
        is Map<*, *> -> {
            val children = value.entries.mapNotNull { entry ->
                val k = entry.key?.toString() ?: return@mapNotNull null
                val childPath = if (path.isEmpty()) k else "$path.$k"
                parseJsonTreeNode(k, childPath, entry.value)
            }
            JsonTreeNode.ObjectNode(key, path, children)
        }
        is List<*> -> {
            val children = value.mapIndexed { i, item ->
                val childPath = "$path[$i]"
                parseJsonTreeNode("[$i]", childPath, item)
            }
            JsonTreeNode.ArrayNode(key, path, children)
        }
        is JSONObject -> {
            val keyList = mutableListOf<String>()
            val it = value.keys()
            while (it.hasNext()) {
                keyList.add(it.next())
            }
            val children = keyList.map { k ->
                val childPath = if (path.isEmpty()) k else "$path.$k"
                parseJsonTreeNode(k, childPath, value.opt(k))
            }
            JsonTreeNode.ObjectNode(key, path, children)
        }
        is JSONArray -> {
            val children = (0 until value.length()).map { i ->
                val childPath = "$path[$i]"
                parseJsonTreeNode("[$i]", childPath, value.opt(i))
            }
            JsonTreeNode.ArrayNode(key, path, children)
        }
        is String -> JsonTreeNode.LeafNode(key, path, value, "string")
        is Number -> {
            val formatted = if (value is Double && value % 1.0 == 0.0 && value <= Long.MAX_VALUE && value >= Long.MIN_VALUE) {
                value.toLong()
            } else {
                value
            }
            JsonTreeNode.LeafNode(key, path, formatted, "number")
        }
        is Boolean -> JsonTreeNode.LeafNode(key, path, value, "boolean")
        else -> JsonTreeNode.LeafNode(key, path, if (value == JSONObject.NULL) null else value, "null")
    }
}

private fun collectAllExpandablePaths(node: JsonTreeNode, out: MutableSet<String>) {
    when (node) {
        is JsonTreeNode.ObjectNode -> {
            if (node.fullPath.isNotEmpty()) out.add(node.fullPath)
            node.children.forEach { collectAllExpandablePaths(it, out) }
        }
        is JsonTreeNode.ArrayNode -> {
            if (node.fullPath.isNotEmpty()) out.add(node.fullPath)
            node.children.forEach { collectAllExpandablePaths(it, out) }
        }
        else -> Unit
    }
}

@Composable
fun SaveFileViewerComponent(
    modifier: Modifier = Modifier,
    projectName: String,
    rawJson: String?,
    isLoading: Boolean,
    onRefresh: () -> Unit,
    viewMode: ViewMode = ViewMode.SAVE_FILE,
    onSetViewMode: (ViewMode) -> Unit = {}
) {
    var searchQuery by remember { mutableStateOf("") }
    var isSearchOpen by remember { mutableStateOf(false) }
    val clipboardManager = LocalClipboardManager.current
    val context = LocalContext.current

    val rootNode = remember(rawJson) {
        if (rawJson.isNullOrBlank()) null
        else {
            try {
                val moshi = Moshi.Builder().addLast(KotlinJsonAdapterFactory()).build()
                val parsed = moshi.adapter(Any::class.java).fromJson(rawJson)
                parseJsonTreeNode("", "", parsed)
            } catch (e: Exception) {
                try {
                    val tokener = JSONTokener(rawJson)
                    val rootVal = tokener.nextValue()
                    parseJsonTreeNode("", "", rootVal)
                } catch (e2: Exception) {
                    null
                }
            }
        }
    }

    val expandedPaths = remember { mutableStateOf(setOf<String>()) }

    // Початкове розкриття кореневих об'єктів
    LaunchedEffect(rootNode) {
        if (rootNode != null) {
            val initialSet = mutableSetOf<String>()
            when (rootNode) {
                is JsonTreeNode.ObjectNode -> {
                    rootNode.children.forEach { child ->
                        if (child is JsonTreeNode.ObjectNode || child is JsonTreeNode.ArrayNode) {
                            initialSet.add(child.fullPath)
                        }
                    }
                }
                is JsonTreeNode.ArrayNode -> {
                    initialSet.add(rootNode.fullPath)
                }
                else -> Unit
            }
            expandedPaths.value = initialSet
        }
    }

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
            // Header
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Default.Description,
                        contentDescription = null,
                        tint = GlassGem,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(Modifier.width(8.dp))
                    Text(
                        text = "${projectName}_save.json",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                    Spacer(Modifier.width(4.dp))
                    IconButton(
                        onClick = onRefresh,
                        modifier = Modifier.size(24.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Refresh,
                            contentDescription = "Оновити",
                            tint = Color.White.copy(alpha = 0.7f),
                            modifier = Modifier.size(14.dp)
                        )
                    }
                    IconButton(
                        onClick = { isSearchOpen = !isSearchOpen },
                        modifier = Modifier.size(24.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Search,
                            contentDescription = "Пошук",
                            tint = if (isSearchOpen) GlassIndigoLight else Color.White.copy(alpha = 0.7f),
                            modifier = Modifier.size(14.dp)
                        )
                    }
                    if (rootNode != null) {
                        // Кнопка перемикання формату часу (Unix → читабельний)
                        var humanTimeFormat by remember { mutableStateOf(true) }
                        IconButton(
                            onClick = { humanTimeFormat = !humanTimeFormat },
                            modifier = Modifier.size(24.dp)
                        ) {
                            Icon(
                                imageVector = if (humanTimeFormat) Icons.Default.AccessTime else Icons.Default.Code,
                                contentDescription = if (humanTimeFormat) "Unix час" else "Читабельний час",
                                tint = if (humanTimeFormat) GlassGem else Color.White.copy(alpha = 0.7f),
                                modifier = Modifier.size(14.dp)
                            )
                        }
                        // Кнопка скачування JSON
                        IconButton(
                            onClick = {
                                try {
                                    val filename = "${projectName}_save.json"
                                    val downloadsDir = android.os.Environment.getExternalStoragePublicDirectory(android.os.Environment.DIRECTORY_DOWNLOADS)
                                    val file = java.io.File(downloadsDir, filename)
                                    file.writeText(rawJson ?: "")
                                    Toast.makeText(context, "Збережено: $filename", android.widget.Toast.LENGTH_SHORT).show()
                                } catch (e: Exception) {
                                    Toast.makeText(context, "Помилка: ${e.message}", android.widget.Toast.LENGTH_SHORT).show()
                                }
                            },
                            modifier = Modifier.size(24.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Download,
                                contentDescription = "Скачати JSON",
                                tint = Color.White.copy(alpha = 0.7f),
                                modifier = Modifier.size(14.dp)
                            )
                        }
                    }
                }

                BottomViewModeSwitcher(viewMode = viewMode, onSetViewMode = onSetViewMode)
            }

            if (isSearchOpen) {
                Spacer(Modifier.height(8.dp))
                OutlinedTextField(
                    value = searchQuery,
                    onValueChange = { searchQuery = it },
                    placeholder = { Text("Пошук по ключу або значенню...", fontSize = 11.sp) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(48.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = GlassIndigo,
                        unfocusedBorderColor = Color.White.copy(alpha = 0.15f),
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White
                    ),
                    singleLine = true
                )
            }

            Spacer(Modifier.height(10.dp))

            // Body
            if (isLoading) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = GlassIndigo, modifier = Modifier.size(28.dp))
                }
            } else if (rawJson.isNullOrBlank() || rootNode == null) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text(
                        text = "Файл збереження не знайдено або порожній",
                        color = Color.White.copy(alpha = 0.4f),
                        fontSize = 12.sp
                    )
                }
            } else {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f)
                        .clip(RoundedCornerShape(12.dp))
                        .background(Color.Black.copy(alpha = 0.45f))
                        .padding(10.dp),
                    verticalArrangement = Arrangement.spacedBy(1.dp)
                ) {
                    item {
                        JsonNodeTreeRenderer(
                            node = rootNode,
                            depth = 0,
                            expandedPaths = expandedPaths.value,
                            onToggleExpand = { path ->
                                if (expandedPaths.value.contains(path)) {
                                    expandedPaths.value = expandedPaths.value - path
                                } else {
                                    expandedPaths.value = expandedPaths.value + path
                                }
                            },
                            onCopyPath = { path ->
                                if (path.isNotEmpty()) {
                                    clipboardManager.setText(AnnotatedString(path))
                                    Toast.makeText(context, "Скопійовано шлях:\n$path", Toast.LENGTH_SHORT).show()
                                }
                            },
                            searchQuery = searchQuery
                        )
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun JsonNodeTreeRenderer(
    node: JsonTreeNode,
    depth: Int,
    expandedPaths: Set<String>,
    onToggleExpand: (String) -> Unit,
    onCopyPath: (String) -> Unit,
    searchQuery: String
) {
    val isExpanded = expandedPaths.contains(node.fullPath) || (node.fullPath.isEmpty() && depth == 0)

    val matchesSearch = remember(node, searchQuery) {
        if (searchQuery.isBlank()) true
        else {
            node.key.contains(searchQuery, ignoreCase = true) ||
            (node is JsonTreeNode.LeafNode && node.value.toString().contains(searchQuery, ignoreCase = true)) ||
            node.fullPath.contains(searchQuery, ignoreCase = true)
        }
    }

    Column(modifier = Modifier.fillMaxWidth()) {
        if (node.key.isNotEmpty() || node.fullPath.isNotEmpty()) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(start = (depth * 12).dp)
                    .clip(RoundedCornerShape(6.dp))
                    .combinedClickable(
                        onClick = {
                            if (node is JsonTreeNode.ObjectNode || node is JsonTreeNode.ArrayNode) {
                                onToggleExpand(node.fullPath)
                            }
                        },
                        onLongClick = {
                            onCopyPath(node.fullPath)
                        }
                    )
                    .background(if (searchQuery.isNotBlank() && matchesSearch) GlassIndigo.copy(alpha = 0.2f) else Color.Transparent)
                    .padding(vertical = 3.dp, horizontal = 4.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                when (node) {
                    is JsonTreeNode.ObjectNode -> {
                        Icon(
                            imageVector = if (isExpanded) Icons.Default.KeyboardArrowDown else Icons.Default.KeyboardArrowRight,
                            contentDescription = null,
                            tint = GlassIndigoLight,
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(Modifier.width(4.dp))
                        Text(
                            text = if (node.key.isNotEmpty()) "${node.key}: " else "",
                            color = GlassIndigoLight,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Monospace
                        )
                        Text(
                            text = "{ ${node.children.size} }",
                            color = Color.White.copy(alpha = 0.45f),
                            fontSize = 10.sp,
                            fontFamily = FontFamily.Monospace
                        )
                    }
                    is JsonTreeNode.ArrayNode -> {
                        Icon(
                            imageVector = if (isExpanded) Icons.Default.KeyboardArrowDown else Icons.Default.KeyboardArrowRight,
                            contentDescription = null,
                            tint = GlassIndigoLight,
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(Modifier.width(4.dp))
                        Text(
                            text = if (node.key.isNotEmpty()) "${node.key}: " else "",
                            color = GlassIndigoLight,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Monospace
                        )
                        Text(
                            text = "[ ${node.children.size} ]",
                            color = Color.White.copy(alpha = 0.45f),
                            fontSize = 10.sp,
                            fontFamily = FontFamily.Monospace
                        )
                    }
                    is JsonTreeNode.LeafNode -> {
                        Spacer(Modifier.width(20.dp))
                        Text(
                            text = "${node.key}: ",
                            color = GlassIndigoLight,
                            fontSize = 11.sp,
                            fontFamily = FontFamily.Monospace
                        )
                        val valueColor = when (node.valueType) {
                            "string" -> GlassSuccess
                            "number" -> GlassWarning
                            "boolean" -> GlassBalance
                            else -> Color.White.copy(alpha = 0.5f)
                        }
                        val displayValue = if (node.valueType == "string") "\"${node.value}\"" else "${node.value}"
                        Text(
                            text = displayValue,
                            color = valueColor,
                            fontSize = 11.sp,
                            fontFamily = FontFamily.Monospace,
                            maxLines = 3
                        )
                    }
                }
            }
        }

        if (isExpanded) {
            when (node) {
                is JsonTreeNode.ObjectNode -> {
                    node.children.forEach { child ->
                        JsonNodeTreeRenderer(
                            node = child,
                            depth = if (node.key.isNotEmpty() || node.fullPath.isNotEmpty()) depth + 1 else depth,
                            expandedPaths = expandedPaths,
                            onToggleExpand = onToggleExpand,
                            onCopyPath = onCopyPath,
                            searchQuery = searchQuery
                        )
                    }
                }
                is JsonTreeNode.ArrayNode -> {
                    node.children.forEach { child ->
                        JsonNodeTreeRenderer(
                            node = child,
                            depth = if (node.key.isNotEmpty() || node.fullPath.isNotEmpty()) depth + 1 else depth,
                            expandedPaths = expandedPaths,
                            onToggleExpand = onToggleExpand,
                            onCopyPath = onCopyPath,
                            searchQuery = searchQuery
                        )
                    }
                }
                else -> Unit
            }
        }
    }
}



