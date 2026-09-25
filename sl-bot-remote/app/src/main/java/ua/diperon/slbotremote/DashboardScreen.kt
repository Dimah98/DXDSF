package ua.diperon.slbotremote // Пакет нашого керуючого проекту

import androidx.compose.animation.AnimatedVisibility // Анімована видимість компонентів
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn // Плавне згасання при появі
import androidx.compose.animation.fadeOut // Плавне згасання при закритті
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.foundation.Canvas
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.runtime.saveable.rememberSaveable
import coil.compose.AsyncImage
import coil.request.ImageRequest
import androidx.compose.foundation.BorderStroke // Параметри обводи (бордюрів) блок-карт
import androidx.compose.foundation.background // Фонове заповнення
import androidx.compose.foundation.border // Рамки обводки компонентів
import androidx.compose.foundation.clickable // Обробник дотиків для будь-якого елемента
import androidx.compose.foundation.layout.Arrangement // Вирівнювання структури
import androidx.compose.foundation.layout.Box // Шари об'єктів
import androidx.compose.foundation.layout.Column // Вертикальна колонка розміщення
import androidx.compose.foundation.layout.Row // Горизонтальний ряд
import androidx.compose.foundation.layout.Spacer // Візуальний розділювач
import androidx.compose.foundation.layout.fillMaxSize // На весь екран
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth // На всю ширину
import androidx.compose.foundation.layout.height // Фіксована висота
import androidx.compose.foundation.layout.padding // Внутрішні відступи
import androidx.compose.foundation.layout.size // Геометричні лінійні розміри
import androidx.compose.foundation.layout.width // Фіксована ширина
import androidx.compose.foundation.lazy.LazyColumn // Оптимальний прокручувальний вертикальний список
import androidx.compose.foundation.lazy.items // Ітератор елементів для списку
import androidx.compose.foundation.shape.CircleShape // Кругла геометрія для іконок/маркерів
import androidx.compose.foundation.shape.RoundedCornerShape // Геометрія округлення кутів карт
import androidx.compose.material.icons.Icons // Колекція системних іконок
import androidx.compose.material.icons.filled.BugReport // Жук помилки для відображення збоїв зв'язку
import androidx.compose.material.icons.filled.ChevronRight // Значок стрілки переходу вправо
import androidx.compose.material.icons.filled.CloudQueue // Іконка хмари (серверу)
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Dashboard // Символ панелі інструментів
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.List // Трикутник запуску бота
import androidx.compose.material.icons.filled.Refresh // Бірка ручної синхронізації
import androidx.compose.material.icons.filled.Settings // Шестерня перенаправлення до налаштувань
import androidx.compose.material.icons.filled.Stop // Квадрат зупинки проекту
import androidx.compose.material.icons.filled.Tune // Іконка конфігурації
import androidx.compose.material.icons.filled.Calculate // Іконка калькулятора/формули
import androidx.compose.material.icons.filled.HourglassTop // Іконка черги
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.BarChart
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.Restaurant
import androidx.compose.material.icons.filled.LocalShipping
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.compose.material.icons.filled.PhotoLibrary
import androidx.compose.material.icons.filled.Inventory2
import androidx.compose.material.icons.filled.GridView // Іконка матриці/таблиці
import androidx.compose.material3.Button // Кнопка дій Material 3
import androidx.compose.material3.ButtonDefaults // Стандарти кнопок налаштування кольорів
import androidx.compose.material3.Card // Матеріальна інфо-картка
import androidx.compose.material3.CardDefaults // Стилі оформлення інфо-картки
import androidx.compose.material3.CircularProgressIndicator // Спінер завантаження даних
import androidx.compose.material3.ExperimentalMaterial3Api // Шлюз експериментальних UI АРІ
import androidx.compose.material3.Icon // Компонент малювання векторних іконок
import androidx.compose.material3.IconButton // Іконка загорнута в кнопку дотику
import androidx.compose.material3.MaterialTheme // Колірна гама нашої теми оформлення
import androidx.compose.material3.Scaffold // Структурна підкладка екрану
import androidx.compose.material3.Surface
import androidx.compose.material3.Text // Рендерер текстових полів
import androidx.compose.material3.TopAppBar // Лицьова панель дій
import androidx.compose.material3.TopAppBarDefaults // Стандарти підкладки верхніх панелей
import androidx.compose.runtime.Composable // Будівельник UI декларацій Jetpack Compose
import androidx.compose.runtime.LaunchedEffect // Запуск відкладених процесів
import androidx.compose.runtime.collectAsState // Перетворювач Flow-потоків у стейт
import androidx.compose.runtime.getValue // Спрощення зчитування властивостей
import androidx.compose.runtime.mutableStateOf // Стан змінення
import androidx.compose.runtime.remember // Збереження стану
import androidx.compose.runtime.setValue // Встановлення стану
import androidx.compose.ui.Alignment // Точки вирівнювання об'єктів
import androidx.compose.ui.Modifier // Додаткові налаштування стилів
import androidx.compose.ui.draw.clip // Обрізання форм
import androidx.compose.ui.graphics.Color // Модель встановлення значень кольорів
import androidx.compose.ui.platform.testTag // Тег для автоматичних тестів
import androidx.compose.ui.text.font.FontWeight // Вага шрифтів
import androidx.compose.ui.text.style.TextAlign // Вирівнювання текста
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp // Одиниці виміру для верстки (діпі)
import androidx.compose.ui.unit.sp // Одиниці виміру для шрифтів (сп)
import ua.diperon.slbotremote.ui.theme.MyApplicationTheme
import ua.diperon.slbotremote.ui.theme.GlassIndigoLight
import ua.diperon.slbotremote.ui.theme.GlassSuccess
import ua.diperon.slbotremote.ui.theme.GlassWarning
import ua.diperon.slbotremote.ui.theme.GlassBalance
import ua.diperon.slbotremote.ui.theme.GlassGem
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.combinedClickable
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.material.icons.filled.EditCalendar
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import android.content.Context
import java.util.concurrent.TimeUnit
import java.util.Locale

/**
 * Головний екран інформаційної панелі платформи.
 * Повністю переведений тільки на українську мову.
 */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalFoundationApi::class)
@Composable
fun DashboardScreen(
    viewModel: DashboardViewModel,
    onNavigateToSettings: () -> Unit,
    onNavigateToProject: (String) -> Unit,
    onNavigateToNotifications: () -> Unit,
    onNavigateToAllInventories: () -> Unit = {},
    onNavigateToAllScreenshots: () -> Unit = {},
    onNavigateToAllDeliveries: () -> Unit = {},
    onNavigateToConfigs: () -> Unit = {},
    onNavigateToMassScheduler: () -> Unit = {},
    onNavigateToVideoWall: () -> Unit = {}
) {
    // Отримання потоків станів від нашої ViewModel
    val projects by viewModel.projects.collectAsState() // Список виявлених Playwright-інструкцій
    val isLoading by viewModel.isLoading.collectAsState() // Стан прогресу завантаження даних мережею
    val errorMessage by viewModel.errorMessage.collectAsState() // Повідомлення про проблеми зв'язку
    val notificationCount by viewModel.notificationCount.collectAsState() // Лічильник сповіщень
    val internalConfig by viewModel.internalConfig.collectAsState()
    val activeQueue by viewModel.activeQueue.collectAsState()

    // Оновити дані з сервера при відкритті екрану
    LaunchedEffect(Unit) {
        viewModel.loadConfigAndRefresh()
    }

    DashboardScreenContent(
        projects = projects,
        isLoading = isLoading,
        errorMessage = errorMessage,
        notificationCount = notificationCount,
        internalConfig = internalConfig,
        activeQueue = activeQueue,
        onRefreshData = { viewModel.refreshData() },
        onUpdateInternalConfig = { viewModel.updateInternalConfig(it) },
        onStartProject = { viewModel.startProject(it) },
        onStopProject = { viewModel.stopProject(it) },
        onNavigateToSettings = onNavigateToSettings,
        onNavigateToProject = onNavigateToProject,
        onNavigateToNotifications = onNavigateToNotifications,
        onNavigateToAllInventories = onNavigateToAllInventories,
        onNavigateToAllScreenshots = onNavigateToAllScreenshots,
        onNavigateToAllDeliveries = onNavigateToAllDeliveries,
        onNavigateToConfigs = onNavigateToConfigs,
        onNavigateToMassScheduler = onNavigateToMassScheduler,
        onNavigateToVideoWall = onNavigateToVideoWall,
        onChangeNextRun = { proj, runAt -> viewModel.setNextRun(proj, runAt) }
    )
}

/**
 * Вміст головного екрану інформаційної панелі.
 * Використовується для підтримки Previews та відокремлення логіки від UI.
 */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalFoundationApi::class)
@Composable
fun DashboardScreenContent(
    projects: List<ProjectModel>,
    isLoading: Boolean,
    errorMessage: String?,
    notificationCount: Int,
    internalConfig: Map<String, Int> = emptyMap(),
    activeQueue: List<String> = emptyList(),
    onRefreshData: () -> Unit,
    onUpdateInternalConfig: (Map<String, Int>) -> Unit = {},
    onStartProject: (String) -> Unit,
    onStopProject: (String) -> Unit,
    onNavigateToSettings: () -> Unit,
    onNavigateToProject: (String) -> Unit,
    onNavigateToNotifications: () -> Unit,
    onNavigateToAllInventories: () -> Unit,
    onNavigateToAllScreenshots: () -> Unit = {},
    onNavigateToAllDeliveries: () -> Unit = {},
    onNavigateToConfigs: () -> Unit = {},
    onNavigateToMassScheduler: () -> Unit = {},
    onNavigateToVideoWall: () -> Unit = {},
    onChangeNextRun: (String, Long?) -> Unit = { _, _ -> }
) {
    val infiniteTransition = rememberInfiniteTransition(label = "refresh_spin")
    val rotationAngle by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 1000, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "refresh_rotation"
    )

    val refreshIconColor = when {
        isLoading -> Color.White
        errorMessage != null -> Color(0xFFEF4444)
        else -> Color(0xFF10B981)
    }

    val context = LocalContext.current
    val prefs = remember { context.getSharedPreferences("app_prefs", Context.MODE_PRIVATE) }
    var isSideButtonVisible by rememberSaveable { mutableStateOf(false) }
    var isFlowerGemFormulaMode by rememberSaveable { mutableStateOf(false) }
    var flowerMultiplier by rememberSaveable { mutableFloatStateOf(prefs.getFloat("flower_multiplier", 10.0f)) }
    var showMultiplierDialog by rememberSaveable { mutableStateOf(false) }
    var isQueueDialogOpen by rememberSaveable { mutableStateOf(false) }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .pointerInput(Unit) {
                detectHorizontalDragGestures { _, dragAmount ->
                    if (dragAmount < -25f) {
                        isSideButtonVisible = true
                    } else if (dragAmount > 25f) {
                        isSideButtonVisible = false
                    }
                }
            }
    ) {
        Scaffold(
            topBar = {
                TopAppBar(
                    title = {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Default.Dashboard,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.primary,
                                modifier = Modifier.size(24.dp)
                            )
                            Spacer(modifier = Modifier.width(10.dp))
                            Text(
                                text = "SF",
                                style = MaterialTheme.typography.titleLarge,
                                fontWeight = FontWeight.Bold,
                                color = Color.White
                            )
                        }
                    },
                    actions = {
                        IconButton(
                            onClick = onRefreshData,
                            modifier = Modifier.testTag("dashboard_refresh_button")
                        ) {
                            Icon(
                                imageVector = Icons.Default.Refresh,
                                contentDescription = "Синхронізувати",
                                tint = refreshIconColor,
                                modifier = if (isLoading) {
                                    Modifier.graphicsLayer { rotationZ = rotationAngle }
                                } else {
                                    Modifier
                                }
                            )
                        }

                        IconButton(
                            onClick = onNavigateToVideoWall,
                            modifier = Modifier.testTag("dashboard_video_wall_button")
                        ) {
                            Icon(
                                imageVector = Icons.Default.GridView,
                                contentDescription = "Відеостіна",
                                tint = Color(0xFF38BDF8)
                            )
                        }

                        Box {
                            IconButton(
                                onClick = onNavigateToNotifications,
                                modifier = Modifier.testTag("dashboard_notifications_button")
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Notifications,
                                    contentDescription = "Сповіщення",
                                    tint = Color.White
                                )
                            }
                            if (notificationCount > 0) {
                                Box(
                                    modifier = Modifier
                                        .align(Alignment.TopEnd)
                                        .padding(top = 6.dp, end = 6.dp)
                                        .size(16.dp)
                                        .background(Color(0xFFEF4444), CircleShape),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text(
                                        text = if (notificationCount > 99) "99+" else notificationCount.toString(),
                                        color = Color.White,
                                        fontSize = 9.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                            }
                        }

                        IconButton(
                            onClick = onNavigateToMassScheduler,
                            modifier = Modifier.testTag("dashboard_mass_scheduler_button")
                        ) {
                            Icon(
                                imageVector = Icons.Default.CalendarMonth,
                                contentDescription = "Масовий планувальник",
                                tint = Color.White
                            )
                        }

                        IconButton(
                            onClick = onNavigateToSettings,
                            modifier = Modifier.testTag("dashboard_settings_button")
                        ) {
                            Icon(
                                imageVector = Icons.Default.Settings,
                                contentDescription = "Налаштування з'єднання",
                                tint = Color.White
                            )
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(
                        containerColor = Color(0xFF14161B)
                    )
                )
            },
            containerColor = MaterialTheme.colorScheme.background
        ) { innerPadding ->
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
                    .padding(horizontal = 16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                AnimatedVisibility(
                    visible = errorMessage != null,
                    enter = fadeIn(),
                    exit = fadeOut()
                ) {
                    errorMessage?.let { error ->
                        ErrorStripComponent(errorMessage = error, onFixSettingsClick = onNavigateToSettings)
                    }
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    DashboardNavButton(modifier = Modifier.weight(1f), icon = Icons.Default.Inventory2, onClick = onNavigateToAllInventories)
                    DashboardNavButton(modifier = Modifier.weight(1f), icon = Icons.Default.PhotoLibrary, onClick = onNavigateToAllScreenshots)
                    DashboardNavButton(modifier = Modifier.weight(1f), icon = Icons.Default.LocalShipping, onClick = onNavigateToAllDeliveries)
                    DashboardNavButton(modifier = Modifier.weight(1f), icon = Icons.Default.Tune, onClick = onNavigateToConfigs)
                }

                if (isLoading && projects.isEmpty()) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .weight(1f),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
                    }
                } else if (projects.isEmpty()) {
                    EmptyStateLayout(onSettingsClick = onNavigateToSettings)
                } else {
                    LazyColumn(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxWidth(),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        items(projects.filter { !it.name.endsWith("_inventory") }, key = { it.name }) { project ->
                            ProjectItemCard(
                                project = project,
                                isFormulaMode = isFlowerGemFormulaMode,
                                flowerMultiplier = flowerMultiplier,
                                onCardClick = { onNavigateToProject(project.name) },
                                onStartClick = { onStartProject(project.name) },
                                onStopClick = { onStopProject(project.name) },
                            )
                        }
                    }
                }
            }
        }

        // Висувний блок кнопок з правої сторони
        AnimatedVisibility(
            visible = isSideButtonVisible,
            enter = slideInHorizontally(initialOffsetX = { it }) + fadeIn(),
            exit = slideOutHorizontally(targetOffsetX = { it }) + fadeOut(),
            modifier = Modifier
                .align(Alignment.CenterEnd)
                .padding(end = 4.dp)
        ) {
            Column(
                verticalArrangement = Arrangement.spacedBy(8.dp),
                horizontalAlignment = Alignment.End
            ) {
                // Кнопка 1: Формула (Flower * multiplier + Gem)
                val multText = if (flowerMultiplier % 1.0f == 0f) flowerMultiplier.toInt().toString() else flowerMultiplier.toString()
                Surface(
                    shape = RoundedCornerShape(topStart = 16.dp, bottomStart = 16.dp, topEnd = 6.dp, bottomEnd = 6.dp),
                    color = if (isFlowerGemFormulaMode) Color(0xFF7C3AED) else Color(0xFF1E293B),
                    border = BorderStroke(
                        1.5.dp,
                        if (isFlowerGemFormulaMode) Color(0xFFC084FC) else Color.White.copy(alpha = 0.2f)
                    ),
                    shadowElevation = 10.dp,
                    modifier = Modifier.combinedClickable(
                        onClick = {
                            isFlowerGemFormulaMode = !isFlowerGemFormulaMode
                        },
                        onLongClick = {
                            showMultiplierDialog = true
                        }
                    )
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Calculate,
                            contentDescription = "Flower * $multText + Gem",
                            tint = if (isFlowerGemFormulaMode) Color.White else Color(0xFF94A3B8),
                            modifier = Modifier.size(20.dp)
                        )
                        Text(
                            text = if (isFlowerGemFormulaMode) "F×$multText+G ON" else "F×$multText+G",
                            color = if (isFlowerGemFormulaMode) Color.White else Color(0xFFCBD5E1),
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }

                // Кнопка 2: Черга проектів
                Surface(
                    onClick = {
                        isQueueDialogOpen = true
                    },
                    shape = RoundedCornerShape(topStart = 16.dp, bottomStart = 16.dp, topEnd = 6.dp, bottomEnd = 6.dp),
                    color = Color(0xFF1E293B),
                    border = BorderStroke(
                        1.5.dp,
                        Color(0xFF38BDF8).copy(alpha = 0.4f)
                    ),
                    shadowElevation = 10.dp
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.HourglassTop,
                            contentDescription = "Черга проектів",
                            tint = Color(0xFF38BDF8),
                            modifier = Modifier.size(20.dp)
                        )
                        Text(
                            text = "Черга",
                            color = Color(0xFFCBD5E1),
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        }
    }

    if (showMultiplierDialog) {
        MultiplierDialog(
            initialMultiplier = flowerMultiplier,
            onDismiss = { showMultiplierDialog = false },
            onConfirm = { newMult ->
                flowerMultiplier = newMult
                prefs.edit().putFloat("flower_multiplier", newMult).apply()
                showMultiplierDialog = false
            }
        )
    }

    if (isQueueDialogOpen) {
        QueueProjectsDialog(
            projects = projects,
            activeQueue = activeQueue,
            onDismiss = { isQueueDialogOpen = false },
            onStartProject = onStartProject,
            onNavigateToProject = onNavigateToProject,
            onChangeNextRun = onChangeNextRun
        )
    }
}

/**
 * Кнопка навігації для головного екрану (компактна з іконкою)
 */
@Composable
fun DashboardNavButton(
    modifier: Modifier = Modifier,
    title: String = "",
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    badgeCount: Int = 0,
    onClick: () -> Unit
) {
    Card(
        modifier = modifier
            .height(48.dp)
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFF1C1F26)),
        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.05f))
    ) {
        Box(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = icon,
                contentDescription = title.ifBlank { null },
                tint = MaterialTheme.colorScheme.primary,
                modifier = Modifier.size(24.dp)
            )
            
            // Бейдж кількості (наприклад, для сповіщень)
            if (badgeCount > 0) {
                Box(
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(4.dp)
                        .size(16.dp)
                        .background(Color(0xFFEF4444), CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = if (badgeCount > 99) "99+" else badgeCount.toString(),
                        color = Color.White,
                        fontSize = 9.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }
    }
}

/**
 * Картка конкретного бота автоматизації Playwright у списку.
 */
@Composable
fun ProjectItemCard(
    project: ProjectModel,
    isFormulaMode: Boolean = false,
    flowerMultiplier: Float = 10f,
    onCardClick: () -> Unit,
    onStartClick: () -> Unit,
    onStopClick: () -> Unit,
) {
    val currentTime = System.currentTimeMillis()

    val seasonImageName = when (project.season?.lowercase()?.trim()) {
        "autumn" -> "Fautumn.png"
        "winter" -> "Fwinter.png"
        "summer" -> "Fsummer.png"
        "spring" -> "Fspring.png"
        else -> null
    }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onCardClick)
            .testTag("project_item_${project.name}"),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(
            containerColor = Color(0xFF1C1F26)
        ),
        border = BorderStroke(
            1.dp,
            if (project.isRunning) Color(0xFF10B981).copy(alpha = 0.5f)
            else Color.White.copy(alpha = 0.05f)
        )
    ) {
        Box(modifier = Modifier.fillMaxWidth()) {
            if (seasonImageName != null) {
                AsyncImage(
                    model = ImageRequest.Builder(LocalContext.current)
                        .data("file:///android_asset/im/$seasonImageName")
                        .crossfade(true)
                        .build(),
                    contentDescription = null,
                    modifier = Modifier.matchParentSize(),
                    contentScale = ContentScale.Crop
                )
            }

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
            // Назва та робочий статус
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .weight(1f)
                    .padding(end = 12.dp)
            ) {
                // Круговий індикатор стану та щоденних відміток
                ProjectStatusIndicator(project = project)
                
                Spacer(modifier = Modifier.width(12.dp))

                Column(
                    modifier = Modifier.weight(1f)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                            modifier = Modifier.weight(1f, fill = false)
                        ) {
                            Column(
                                verticalArrangement = Arrangement.spacedBy(1.dp)
                            ) {
                                // Час з оновлення сейву проекту (напр. 1:23)
                                project.lastSaveUpdate?.let { updateTime ->
                                    if (updateTime > 0) {
                                        val elapsedMs = maxOf(0L, currentTime - updateTime)
                                        val totalMinutes = elapsedMs / (60 * 1000L)
                                        val hours = totalMinutes / 60
                                        val minutes = totalMinutes % 60
                                        val timeAgoText = String.format(Locale.US, "%d:%02d", hours, minutes)
                                        Text(
                                            text = timeAgoText,
                                            fontSize = 9.sp,
                                            fontWeight = FontWeight.Medium,
                                            color = Color(0xFF94A3B8),
                                            lineHeight = 10.sp
                                        )
                                    }
                                }

                                Text(
                                    text = project.name,
                                    style = MaterialTheme.typography.bodyLarge,
                                    fontWeight = FontWeight.Bold,
                                    color = Color.White
                                )

                                // Зірочки виконаних доставок проекту
                                if (project.completedDeliveryTypes.isNotEmpty()) {
                                    Row(
                                        horizontalArrangement = Arrangement.spacedBy(1.dp),
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        project.completedDeliveryTypes.forEach { type ->
                                            val starColor = when (type.lowercase()) {
                                                "coins", "money", "gold" -> Color(0xFFFFD700)
                                                "flower", "sfl" -> Color(0xFFC084FC)
                                                else -> Color(0xFF94A3B8)
                                            }
                                            Text(
                                                text = "★",
                                                fontSize = 10.sp,
                                                color = starColor,
                                                lineHeight = 11.sp
                                            )
                                        }
                                    }
                                } else if (project.completedDeliveries > 0) {
                                    Text(
                                        text = "★".repeat(project.completedDeliveries),
                                        fontSize = 10.sp,
                                        color = Color(0xFFFFD700),
                                        lineHeight = 11.sp,
                                        letterSpacing = 1.sp
                                    )
                                }
                            }

                            // Рівень (зелений)
                            project.level?.let { lvl ->
                                Text(
                                    text = "$lvl",
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    color = GlassSuccess
                                )
                            }

                            // Золото (жовтий)
                            project.gold?.let { gld ->
                                Text(
                                    text = String.format(Locale.US, "%.0f", gld),
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    color = GlassWarning
                                )
                            }

                            if (isFormulaMode) {
                                // Об'єднане число за формулою ("Flower" * multiplier + "Gem")
                                val flw = project.balance ?: 0.0
                                val gm = project.gem ?: 0.0
                                val combined = (flw * flowerMultiplier.toDouble()) + gm
                                val combinedText = if (combined % 1.0 == 0.0) String.format(Locale.US, "%.0f", combined) else String.format(Locale.US, "%.1f", combined)
                                Text(
                                    text = combinedText,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    color = GlassBalance
                                )
                            } else {
                                // Flower (фіолетовий)
                                project.balance?.let { flw ->
                                    val flwText = if (flw % 1.0 == 0.0) String.format(Locale.US, "%.0f", flw) else String.format(Locale.US, "%.1f", flw)
                                    Text(
                                        text = flwText,
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        color = GlassBalance
                                    )
                                }

                                // Gem (голубий)
                                project.gem?.let { gm ->
                                    Text(
                                        text = String.format(Locale.US, "%.0f", gm),
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        color = GlassGem
                                    )
                                }
                            }
                        }

                        // Час через скільки запуститься проект (в кінці рядка, без "г" і "хв", сірий колір)
                        if (!project.isRunning) {
                            val upcomingRuns = listOfNotNull(project.nextRun, project.plannedNodeRun)
                                .filter { it > currentTime }
                            val targetRun = if (upcomingRuns.isNotEmpty()) {
                                upcomingRuns.minOrNull()
                            } else {
                                listOfNotNull(project.nextRun, project.plannedNodeRun).minOrNull()
                            }

                            if (targetRun != null) {
                                val remainingMs = targetRun - currentTime
                                val timeText = if (remainingMs > 0) {
                                    val totalMinutes = (remainingMs + 59999) / 60000
                                    val hours = totalMinutes / 60
                                    val minutes = totalMinutes % 60
                                    String.format(Locale.US, "%d:%02d", hours, minutes)
                                } else if (remainingMs > -3600000L) {
                                    "0:00"
                                } else {
                                    null
                                }
                                if (timeText != null) {
                                    Text(
                                        text = timeText,
                                        style = MaterialTheme.typography.bodyMedium,
                                        fontWeight = FontWeight.Medium,
                                        color = Color(0xFF94A3B8)
                                    )
                                }
                            }
                        }
                    }

                    if (project.isRunning) {
                        Text(
                            text = if (project.activeNodeTitle != null) "Активна нода: ${project.activeNodeTitle}" else "Автоматизація виконується...",
                            style = MaterialTheme.typography.labelSmall,
                            color = Color(0xFF10B981)
                        )
                    }
                }
            }

            // Швидкі кнопки запуску/зупинки автоматизатора
            if (project.isRunning) {
                IconButton(
                    onClick = onStopClick,
                    modifier = Modifier
                        .size(34.dp)
                        .background(Color(0xFFEF4444).copy(alpha = 0.15f), CircleShape)
                        .testTag("quick_stop_${project.name}")
                ) {
                    Icon(
                        imageVector = Icons.Default.Stop,
                        contentDescription = "Зупинити",
                        tint = Color(0xFFEF4444),
                        modifier = Modifier.size(16.dp)
                    )
                }
            } else {
                IconButton(
                    onClick = onStartClick,
                    modifier = Modifier
                        .size(34.dp)
                        .background(Color(0xFF10B981).copy(alpha = 0.15f), CircleShape)
                        .testTag("quick_run_${project.name}")
                ) {
                    Icon(
                        imageVector = Icons.Default.PlayArrow,
                        contentDescription = "Запустити",
                        tint = Color(0xFF10B981),
                        modifier = Modifier.size(16.dp)
                    )
                }
            }
        }
    }
}
}

/**
 * Круговий індикатор стану бота та щоденних відміток.
 * - Зелене свічення по центру: коли відкритий браузер (isBrowserOpen).
 * - Біла дуга зверху (180°..360°): visitedFarmState.dailyRewards.chest.collectedAt == сьогодні.
 * - Біла дуга знизу (0°..180°): visitedFarmState.shipments.restockedAt == сьогодні.
 * - Червоне коло зовні: visitedFarmState.floatingIsland.petalPuzzleSolvedAt == сьогодні.
 */
@Composable
fun ProjectStatusIndicator(
    project: ProjectModel,
    modifier: Modifier = Modifier
) {
    val density = LocalDensity.current
    val strokeWidthPx = with(density) { 2.5.dp.toPx() }

    Box(
        modifier = modifier.size(18.dp),
        contentAlignment = Alignment.Center
    ) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            val center = Offset(size.width / 2f, size.height / 2f)
            val baseRadius = size.minDimension / 2f

            // 1. Центральне коло (браузер / робота / неактивний)
            val centerRadius = 4.5.dp.toPx()
            val centerColor = when {
                project.isBrowserOpen -> Color(0xFF10B981) // Світиться яскраво-зеленим коли браузер відкритий
                project.isRunning -> Color(0xFF10B981).copy(alpha = 0.6f)
                else -> Color(0xFF64748B)
            }

            // М'яке свічення навколо центру якщо відкритий браузер
            if (project.isBrowserOpen) {
                drawCircle(
                    color = Color(0xFF10B981).copy(alpha = 0.35f),
                    radius = centerRadius + 2.5.dp.toPx(),
                    center = center
                )
            }

            drawCircle(
                color = centerColor,
                radius = centerRadius,
                center = center
            )

            // 2. Радіус для білих дуг скрині та доставки
            val arcRadius = 6.5.dp.toPx()
            val arcSize = Size(arcRadius * 2, arcRadius * 2)
            val arcTopLeft = Offset(center.x - arcRadius, center.y - arcRadius)

            // Верхня дуга: visitedFarmState.dailyRewards.chest.collectedAt (180°..360°)
            if (project.hasChestCollectedToday) {
                drawArc(
                    color = Color.White,
                    startAngle = 180f,
                    sweepAngle = 180f,
                    useCenter = false,
                    topLeft = arcTopLeft,
                    size = arcSize,
                    style = Stroke(width = strokeWidthPx, cap = StrokeCap.Round)
                )
            }

            // Нижня дуга: visitedFarmState.shipments.restockedAt (0°..180°)
            if (project.hasShipmentRestockedToday) {
                drawArc(
                    color = Color.White,
                    startAngle = 0f,
                    sweepAngle = 180f,
                    useCenter = false,
                    topLeft = arcTopLeft,
                    size = arcSize,
                    style = Stroke(width = strokeWidthPx, cap = StrokeCap.Round)
                )
            }

            // 3. Червоне зовнішнє коло: visitedFarmState.floatingIsland.petalPuzzleSolvedAt
            if (project.hasPetalPuzzleSolvedToday) {
                val outerRadius = baseRadius - (strokeWidthPx / 2f)
                drawCircle(
                    color = Color(0xFFEF4444),
                    radius = outerRadius,
                    center = center,
                    style = Stroke(width = strokeWidthPx)
                )
            }
        }
    }
}

/**
 * Діалог налаштування множника формули Flower * multiplier + Gem
 */
@Composable
fun MultiplierDialog(
    initialMultiplier: Float,
    onDismiss: () -> Unit,
    onConfirm: (Float) -> Unit
) {
    var textValue by remember { mutableStateOf(if (initialMultiplier % 1.0f == 0f) initialMultiplier.toInt().toString() else initialMultiplier.toString()) }

    Dialog(onDismissRequest = onDismiss) {
        Card(
            modifier = Modifier
                .fillMaxWidth(0.92f)
                .padding(16.dp),
            shape = RoundedCornerShape(20.dp),
            colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
            border = BorderStroke(1.dp, Color(0xFF7C3AED).copy(alpha = 0.5f))
        ) {
            Column(
                modifier = Modifier.padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Зміна множника F×X+G",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                    IconButton(onClick = onDismiss, modifier = Modifier.size(24.dp)) {
                        Icon(imageVector = Icons.Default.Close, contentDescription = null, tint = Color.Gray)
                    }
                }

                Text(
                    text = "Оберіть або введіть множник для підрахунку квітів (Flower):",
                    style = MaterialTheme.typography.bodySmall,
                    color = Color(0xFF94A3B8)
                )

                // Швидкі кнопки
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    listOf(5f, 10f, 15f, 20f).forEach { mult ->
                        val label = mult.toInt().toString()
                        val isSelected = textValue == label
                        Surface(
                            onClick = { textValue = label },
                            shape = RoundedCornerShape(10.dp),
                            color = if (isSelected) Color(0xFF7C3AED) else Color(0xFF334155),
                            modifier = Modifier.weight(1f)
                        ) {
                            Box(
                                modifier = Modifier.padding(vertical = 8.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = "×$label",
                                    color = Color.White,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 13.sp
                                )
                            }
                        }
                    }
                }

                OutlinedTextField(
                    value = textValue,
                    onValueChange = { textValue = it },
                    label = { Text("Власний множник") },
                    singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White,
                        focusedBorderColor = Color(0xFF7C3AED),
                        unfocusedBorderColor = Color(0xFF475569)
                    ),
                    modifier = Modifier.fillMaxWidth()
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Button(
                        onClick = onDismiss,
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF334155))
                    ) {
                        Text("Скасувати", color = Color.White)
                    }
                    Button(
                        onClick = {
                            val parsed = textValue.replace(',', '.').toFloatOrNull() ?: 10f
                            onConfirm(parsed)
                        },
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF7C3AED))
                    ) {
                        Text("Зберегти", color = Color.White, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

/**
 * Діалог швидкої зміни або встановлення часу наступного запуску проекту.
 */
@Composable
fun ChangeNextRunDialog(
    projectName: String,
    currentNextRun: Long?,
    onDismiss: () -> Unit,
    onConfirm: (Long?) -> Unit
) {
    val now = System.currentTimeMillis()
    var customMinutesText by remember { mutableStateOf("") }

    val currentFormatted = if (currentNextRun != null && currentNextRun > 0) {
        val df = java.text.SimpleDateFormat("dd.MM HH:mm", Locale.getDefault())
        df.format(java.util.Date(currentNextRun))
    } else {
        "Не встановлено"
    }

    Dialog(onDismissRequest = onDismiss) {
        Card(
            modifier = Modifier
                .fillMaxWidth(0.94f)
                .padding(16.dp),
            shape = RoundedCornerShape(20.dp),
            colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
            border = BorderStroke(1.dp, Color(0xFF38BDF8).copy(alpha = 0.4f))
        ) {
            Column(
                modifier = Modifier.padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            text = "Час запуску: $projectName",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                        Text(
                            text = "Поточний: $currentFormatted",
                            style = MaterialTheme.typography.bodySmall,
                            color = Color(0xFF38BDF8)
                        )
                    }
                    IconButton(onClick = onDismiss, modifier = Modifier.size(24.dp)) {
                        Icon(imageVector = Icons.Default.Close, contentDescription = null, tint = Color.Gray)
                    }
                }

                Text(
                    text = "Швидке відкладення / запуск:",
                    style = MaterialTheme.typography.labelMedium,
                    color = Color(0xFF94A3B8)
                )

                // Кнопки швидкого вибору
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    listOf(
                        Pair("+15 хв", 15L),
                        Pair("+30 хв", 30L),
                        Pair("+1 год", 60L),
                        Pair("+2 год", 120L)
                    ).forEach { (label, mins) ->
                        Surface(
                            onClick = {
                                onConfirm(now + mins * 60 * 1000L)
                            },
                            shape = RoundedCornerShape(10.dp),
                            color = Color(0xFF334155),
                            modifier = Modifier.weight(1f)
                        ) {
                            Box(
                                modifier = Modifier.padding(vertical = 8.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = label,
                                    color = Color.White,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                    }
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedTextField(
                        value = customMinutesText,
                        onValueChange = { customMinutesText = it },
                        label = { Text("Через N хв") },
                        singleLine = true,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color.White,
                            focusedBorderColor = Color(0xFF38BDF8),
                            unfocusedBorderColor = Color(0xFF475569)
                        ),
                        modifier = Modifier.weight(1f)
                    )
                    Button(
                        onClick = {
                            val mins = customMinutesText.toLongOrNull()
                            if (mins != null && mins > 0) {
                                onConfirm(now + mins * 60 * 1000L)
                            }
                        },
                        modifier = Modifier.align(Alignment.CenterVertically),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF0284C7))
                    ) {
                        Text("ОК", color = Color.White, fontWeight = FontWeight.Bold)
                    }
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Button(
                        onClick = { onConfirm(now) },
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF10B981))
                    ) {
                        Text("Зараз", color = Color.White, fontWeight = FontWeight.Bold)
                    }
                    Button(
                        onClick = { onConfirm(null) },
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFEF4444).copy(alpha = 0.8f))
                    ) {
                        Text("Скинути", color = Color.White)
                    }
                }
            }
        }
    }
}

/**
 * Діалогове вікно з переліком проєктів у черзі очікування та запланованих запусків.
 */
@Composable
fun QueueProjectsDialog(
    projects: List<ProjectModel>,
    activeQueue: List<String>,
    onDismiss: () -> Unit,
    onStartProject: (String) -> Unit,
    onNavigateToProject: (String) -> Unit,
    onChangeNextRun: (String, Long?) -> Unit = { _, _ -> }
) {
    var currentTime by remember { mutableStateOf(System.currentTimeMillis()) }
    var projectToChangeNextRun by remember { mutableStateOf<ProjectModel?>(null) }

    LaunchedEffect(Unit) {
        while (true) {
            kotlinx.coroutines.delay(1000L)
            currentTime = System.currentTimeMillis()
        }
    }

    // 1. Проєкти, які очікують завершення інших проєктів (в активній черзі або час запуску вже настав/минув)
    val waitingProjects = remember(projects, activeQueue, currentTime) {
        val nonInventory = projects.filter { !it.isRunning && !it.name.endsWith("_inventory") }
        val inActiveQueueNames = activeQueue.toSet()

        nonInventory.filter { p ->
            val targetRun = p.plannedNodeRun ?: p.nextRun
            val isDue = targetRun != null && targetRun <= currentTime
            inActiveQueueNames.contains(p.name) || isDue
        }.sortedBy { it.plannedNodeRun ?: it.nextRun ?: 0L }
    }

    // 2. Проєкти за розкладом на майбутнє (targetRun > currentTime) і не у waitingProjects
    val scheduledProjects = remember(projects, waitingProjects, currentTime) {
        val waitingNames = waitingProjects.map { it.name }.toSet()
        projects.filter { p ->
            if (p.isRunning || p.name.endsWith("_inventory") || waitingNames.contains(p.name)) return@filter false
            val upcomingRuns = listOfNotNull(p.nextRun, p.plannedNodeRun).filter { it > currentTime }
            upcomingRuns.isNotEmpty()
        }.map { p ->
            val upcoming = listOfNotNull(p.nextRun, p.plannedNodeRun).filter { it > currentTime }.minOrNull()!!
            Pair(p, upcoming)
        }.sortedBy { it.second }
    }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Card(
            modifier = Modifier
                .fillMaxWidth(0.94f)
                .fillMaxHeight(0.85f),
            shape = RoundedCornerShape(24.dp),
            colors = CardDefaults.cardColors(containerColor = Color(0xFF14161B)),
            border = BorderStroke(1.dp, Color.White.copy(alpha = 0.1f))
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(20.dp)
            ) {
                // Заголовок
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(38.dp)
                                .background(Color(0xFF38BDF8).copy(alpha = 0.15f), CircleShape),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.HourglassTop,
                                contentDescription = null,
                                tint = Color(0xFF38BDF8),
                                modifier = Modifier.size(22.dp)
                            )
                        }
                        Column {
                            Text(
                                text = "Черга на запуск",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                                color = Color.White
                            )
                            Text(
                                text = "Проєкти в черзі та за розкладом",
                                style = MaterialTheme.typography.bodySmall,
                                color = Color(0xFF94A3B8)
                            )
                        }
                    }

                    IconButton(onClick = onDismiss) {
                        Icon(
                            imageVector = Icons.Default.Close,
                            contentDescription = "Закрити",
                            tint = Color(0xFF94A3B8)
                        )
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Список проєктів
                if (waitingProjects.isEmpty() && scheduledProjects.isEmpty()) {
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxWidth(),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.HourglassTop,
                                contentDescription = null,
                                tint = Color(0xFF64748B),
                                modifier = Modifier.size(48.dp)
                            )
                            Text(
                                text = "Черга порожня",
                                style = MaterialTheme.typography.bodyLarge,
                                fontWeight = FontWeight.SemiBold,
                                color = Color(0xFF94A3B8)
                            )
                            Text(
                                text = "Наразі немає проєктів у черзі або за розкладом",
                                style = MaterialTheme.typography.bodySmall,
                                color = Color(0xFF64748B)
                            )
                        }
                    }
                } else {
                    LazyColumn(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxWidth(),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        // 1. Якщо є проекти, що очікують вільний слот / завершення інших
                        if (waitingProjects.isNotEmpty()) {
                            item {
                                Text(
                                    text = "🚦 Очікують запуск / завершення (${waitingProjects.size})",
                                    style = MaterialTheme.typography.labelMedium,
                                    fontWeight = FontWeight.Bold,
                                    color = Color(0xFFF59E0B),
                                    modifier = Modifier.padding(vertical = 4.dp)
                                )
                            }

                            items(waitingProjects, key = { it.name }) { project ->
                                val targetRun = project.plannedNodeRun ?: project.nextRun
                                val targetTimeText = if (targetRun != null && targetRun > 0) {
                                    " (було заплановано о " + java.text.SimpleDateFormat("HH:mm", Locale.getDefault()).format(java.util.Date(targetRun)) + ")"
                                } else ""

                                Card(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clickable { 
                                            onDismiss()
                                            onNavigateToProject(project.name) 
                                        },
                                    shape = RoundedCornerShape(14.dp),
                                    colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
                                    border = BorderStroke(1.dp, Color(0xFFF59E0B).copy(alpha = 0.3f))
                                ) {
                                    Row(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(12.dp),
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.SpaceBetween
                                    ) {
                                        Row(
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.spacedBy(10.dp),
                                            modifier = Modifier.weight(1f)
                                        ) {
                                            Box(
                                                modifier = Modifier
                                                    .size(26.dp)
                                                    .background(Color(0xFFF59E0B).copy(alpha = 0.2f), CircleShape),
                                                contentAlignment = Alignment.Center
                                            ) {
                                                Text(
                                                    text = "#${waitingProjects.indexOf(project) + 1}",
                                                    color = Color(0xFFF59E0B),
                                                    fontSize = 11.sp,
                                                    fontWeight = FontWeight.Bold
                                                )
                                            }
                                            Column {
                                                Text(
                                                    text = project.name,
                                                    style = MaterialTheme.typography.bodyMedium,
                                                    fontWeight = FontWeight.Bold,
                                                    color = Color.White
                                                )
                                                Text(
                                                    text = "Очікує вільний слот$targetTimeText",
                                                    style = MaterialTheme.typography.labelSmall,
                                                    color = Color(0xFFF59E0B)
                                                )
                                            }
                                        }

                                        Row(
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                                        ) {
                                            // Кнопка редагування часу
                                            IconButton(
                                                onClick = { projectToChangeNextRun = project },
                                                modifier = Modifier
                                                    .size(32.dp)
                                                    .background(Color(0xFF38BDF8).copy(alpha = 0.15f), CircleShape)
                                            ) {
                                                Icon(
                                                    imageVector = Icons.Default.EditCalendar,
                                                    contentDescription = "Змінити час",
                                                    tint = Color(0xFF38BDF8),
                                                    modifier = Modifier.size(16.dp)
                                                )
                                            }

                                            // Кнопка примусового запуску
                                            IconButton(
                                                onClick = { onStartProject(project.name) },
                                                modifier = Modifier
                                                    .size(32.dp)
                                                    .background(Color(0xFF10B981).copy(alpha = 0.15f), CircleShape)
                                            ) {
                                                Icon(
                                                    imageVector = Icons.Default.PlayArrow,
                                                    contentDescription = "Запустити зараз",
                                                    tint = Color(0xFF10B981),
                                                    modifier = Modifier.size(18.dp)
                                                )
                                            }
                                        }
                                    }
                                }
                            }

                            item {
                                Spacer(modifier = Modifier.height(6.dp))
                            }
                        }

                        // 2. Заплановані запуски за розкладом
                        if (scheduledProjects.isNotEmpty()) {
                            item {
                                Text(
                                    text = "⏰ Очікують за розкладом (${scheduledProjects.size})",
                                    style = MaterialTheme.typography.labelMedium,
                                    fontWeight = FontWeight.Bold,
                                    color = Color(0xFF38BDF8),
                                    modifier = Modifier.padding(vertical = 4.dp)
                                )
                            }

                            items(scheduledProjects, key = { it.first.name }) { (project, targetRun) ->
                                val remainingMs = targetRun - currentTime
                                val totalMinutes = (remainingMs + 59999) / 60000
                                val hours = totalMinutes / 60
                                val minutes = totalMinutes % 60
                                val timeRemainingText = String.format(Locale.US, "%d:%02d", hours, minutes)
                                val exactTimeText = java.text.SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(java.util.Date(targetRun))

                                Card(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clickable { 
                                            onDismiss()
                                            onNavigateToProject(project.name) 
                                        },
                                    shape = RoundedCornerShape(14.dp),
                                    colors = CardDefaults.cardColors(containerColor = Color(0xFF1C1F26)),
                                    border = BorderStroke(1.dp, Color.White.copy(alpha = 0.08f))
                                ) {
                                    Row(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(12.dp),
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.SpaceBetween
                                    ) {
                                        Row(
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.spacedBy(10.dp),
                                            modifier = Modifier.weight(1f)
                                        ) {
                                            Box(
                                                modifier = Modifier
                                                    .size(8.dp)
                                                    .background(Color(0xFF38BDF8), CircleShape)
                                            )
                                            Column {
                                                Text(
                                                    text = project.name,
                                                    style = MaterialTheme.typography.bodyMedium,
                                                    fontWeight = FontWeight.Bold,
                                                    color = Color.White
                                                )
                                                Text(
                                                    text = "Запуск о $exactTimeText",
                                                    style = MaterialTheme.typography.labelSmall,
                                                    color = Color(0xFF94A3B8)
                                                )
                                            }
                                        }

                                        Row(
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                                        ) {
                                            Text(
                                                text = timeRemainingText,
                                                style = MaterialTheme.typography.titleSmall,
                                                fontWeight = FontWeight.Bold,
                                                color = Color(0xFF38BDF8),
                                                modifier = Modifier.padding(end = 4.dp)
                                            )

                                            // Кнопка редагування часу
                                            IconButton(
                                                onClick = { projectToChangeNextRun = project },
                                                modifier = Modifier
                                                    .size(32.dp)
                                                    .background(Color(0xFF38BDF8).copy(alpha = 0.15f), CircleShape)
                                            ) {
                                                Icon(
                                                    imageVector = Icons.Default.EditCalendar,
                                                    contentDescription = "Змінити час",
                                                    tint = Color(0xFF38BDF8),
                                                    modifier = Modifier.size(16.dp)
                                                )
                                            }

                                            // Кнопка запуску зараз
                                            IconButton(
                                                onClick = { onStartProject(project.name) },
                                                modifier = Modifier
                                                    .size(32.dp)
                                                    .background(Color(0xFF10B981).copy(alpha = 0.15f), CircleShape)
                                            ) {
                                                Icon(
                                                    imageVector = Icons.Default.PlayArrow,
                                                    contentDescription = "Запустити зараз",
                                                    tint = Color(0xFF10B981),
                                                    modifier = Modifier.size(18.dp)
                                                )
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                // Кнопка закрити
                Button(
                    onClick = onDismiss,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF1E293B))
                ) {
                    Text(
                        text = "Закрити",
                        color = Color.White,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }
    }

    // Діалог редагування часу для вибраного проєкту
    if (projectToChangeNextRun != null) {
        val p = projectToChangeNextRun!!
        ChangeNextRunDialog(
            projectName = p.name,
            currentNextRun = p.plannedNodeRun ?: p.nextRun,
            onDismiss = { projectToChangeNextRun = null },
            onConfirm = { newRunAt ->
                val targetName = p.name
                projectToChangeNextRun = null
                onChangeNextRun(targetName, newRunAt)
            }
        )
    }
}

/**
 * Плашка відображення винятків мережевої передачі.
 */
@Composable
fun ErrorStripComponent(errorMessage: String, onFixSettingsClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(Color(0xFFEF4444).copy(alpha = 0.08f))
            .border(BorderStroke(1.dp, Color(0xFFEF4444).copy(alpha = 0.2f)), RoundedCornerShape(16.dp))
            .clickable(onClick = onFixSettingsClick)
            .padding(14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Row(
            modifier = Modifier.weight(1f),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = Icons.Default.BugReport,
                contentDescription = null,
                tint = Color(0xFFEF4444),
                modifier = Modifier.size(18.dp)
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = errorMessage,
                style = MaterialTheme.typography.bodySmall,
                color = Color(0xFFFCA5A5),
                fontWeight = FontWeight.Medium
            )
        }

        Icon(
            imageVector = Icons.Default.Settings,
            contentDescription = "Виправити налаштування", // Переклад
            tint = Color(0xFFEF4444),
            modifier = Modifier.size(18.dp)
        )
    }
}

/**
 * Рендерер порожнього стану списку.
 */
@Composable
fun EmptyStateLayout(onSettingsClick: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 40.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Box(
            modifier = Modifier
                .size(72.dp)
                .background(Color(0xFF1C1F26), CircleShape),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = Icons.Default.CloudQueue,
                contentDescription = null,
                tint = Color.White.copy(alpha = 0.15f),
                modifier = Modifier.size(40.dp)
            )
        }
        Spacer(modifier = Modifier.height(14.dp))
        Text(
            text = "Проекти не синхронізовано", // Переклад
            style = MaterialTheme.typography.titleMedium,
            color = Color.White,
            fontWeight = FontWeight.Bold
        )
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = "Бекенд офлайн, або на сервері Sunflower ще не зареєстровано жодного бота-автоматизатора.", // Переклад
            style = MaterialTheme.typography.bodySmall,
            color = Color.White.copy(alpha = 0.4f),
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(horizontal = 32.dp)
        )
        Spacer(modifier = Modifier.height(16.dp))
        Button(
            onClick = onSettingsClick,
            colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary),
            shape = RoundedCornerShape(10.dp)
        ) {
            Text("Змінити налаштування") // Переклад
        }
    }
}

@Preview(showBackground = true)
@Composable
fun PreviewProjectItemCardRunning() {
    MyApplicationTheme {
        ProjectItemCard(
            project = ProjectModel(
                name = "Active Bot",
                isRunning = true,
                activeNodeTitle = "Harvesting Sunflowers"
            ),
            onCardClick = {},
            onStartClick = {},
            onStopClick = {}
        )
    }
}

@Preview(showBackground = true)
@Composable
fun PreviewDashboardScreen() {
    MyApplicationTheme {
        DashboardScreenContent(
            projects = listOf(
                ProjectModel(name = "Бот Фермер", isRunning = true, activeNodeTitle = "Збір врожаю"),
                ProjectModel(name = "Бот Шахтар", isRunning = false, nextRun = System.currentTimeMillis() + 3600000),
                ProjectModel(name = "Бот Лісоруб", isRunning = false)
            ),
            isLoading = false,
            errorMessage = null,
            notificationCount = 5,
            internalConfig = emptyMap(),
            onRefreshData = {},
            onUpdateInternalConfig = {},
            onStartProject = {},
            onStopProject = {},
            onNavigateToSettings = {},
            onNavigateToProject = {},
            onNavigateToNotifications = {},
            onNavigateToAllInventories = {}
        )
    }
}

@Preview(showBackground = true)
@Composable
fun PreviewDashboardScreenLoading() {
    MyApplicationTheme {
        DashboardScreenContent(
            projects = emptyList(),
            isLoading = true,
            errorMessage = null,
            notificationCount = 0,
            internalConfig = emptyMap(),
            onRefreshData = {},
            onUpdateInternalConfig = {},
            onStartProject = {},
            onStopProject = {},
            onNavigateToSettings = {},
            onNavigateToProject = {},
            onNavigateToNotifications = {},
            onNavigateToAllInventories = {}
        )
    }
}

@Preview(showBackground = true)
@Composable
fun PreviewDashboardScreenError() {
    MyApplicationTheme {
        DashboardScreenContent(
            projects = emptyList(),
            isLoading = false,
            errorMessage = "Неможливо з'єднатися з сервером. Перевірте налаштування.",
            notificationCount = 0,
            internalConfig = emptyMap(),
            onRefreshData = {},
            onUpdateInternalConfig = {},
            onStartProject = {},
            onStopProject = {},
            onNavigateToSettings = {},
            onNavigateToProject = {},
            onNavigateToNotifications = {},
            onNavigateToAllInventories = {}
        )
    }
}

@Preview(showBackground = true)
@Composable
fun PreviewDashboardNavButton() {
    MyApplicationTheme {
        DashboardNavButton(
            icon = Icons.Default.Inventory2,
            onClick = {}
        )
    }
}

@Preview(showBackground = true)
@Composable
fun PreviewDashboardNavButtonWithBadge() {
    MyApplicationTheme {
        DashboardNavButton(
            icon = Icons.Default.Notifications,
            badgeCount = 12,
            onClick = {}
        )
    }
}

@Preview(showBackground = true)
@Composable
fun PreviewErrorStripComponent() {
    MyApplicationTheme {
        ErrorStripComponent(
            errorMessage = "Неможливо з'єднатися з сервером",
            onFixSettingsClick = {}
        )
    }
}
