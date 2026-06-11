package com.example // Пакет нашого керуючого проекту

import androidx.compose.animation.AnimatedVisibility // Анімована видимість компонентів
import androidx.compose.animation.fadeIn // Плавне згасання при появі
import androidx.compose.animation.fadeOut // Плавне згасання при закритті
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
import androidx.compose.material.icons.filled.Dashboard // Символ панелі інструментів
import androidx.compose.material.icons.filled.PlayArrow // Трикутник запуску бота
import androidx.compose.material.icons.filled.Refresh // Бірка ручної синхронізації
import androidx.compose.material.icons.filled.Settings // Шестерня перенаправлення до налаштувань
import androidx.compose.material.icons.filled.Stop // Квадрат зупинки проекту
import androidx.compose.material.icons.filled.Tune // Іконка конфігурації
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.BarChart
import androidx.compose.material.icons.filled.Notifications
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
import com.example.ui.theme.MyApplicationTheme

/**
 * Головний екран інформаційної панелі платформи.
 * Повністю переведений тільки на українську мову.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardScreen(
    viewModel: DashboardViewModel, // Керуюча ViewModel
    onNavigateToSettings: () -> Unit, // Навігація в налаштування адреси
    onNavigateToProject: (String) -> Unit, // Навігація на екран прямого відеомоніторингу бота
    onNavigateToSchedule: () -> Unit, // Навігація в розклад
    onNavigateToStatistics: () -> Unit, // Навігація в статистику
    onNavigateToNotifications: () -> Unit, // Навігація в сповіщення
    // Навігація в інвентар проекту
    onNavigateToAllInventories: () -> Unit = {} // Навігація в перегляд всіх інвентарів
) {
    // Отримання потоків станів від нашої ViewModel
    val projects by viewModel.projects.collectAsState() // Список виявлених Playwright-інструкцій
    val isLoading by viewModel.isLoading.collectAsState() // Стан прогресу завантаження даних мережею
    val errorMessage by viewModel.errorMessage.collectAsState() // Повідомлення про проблеми зв'язку
    val notificationCount by viewModel.notificationCount.collectAsState() // Лічильник сповіщень
    val internalConfig by viewModel.internalConfig.collectAsState()

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
        onRefreshData = { viewModel.refreshData() },
        onUpdateInternalConfig = { viewModel.updateInternalConfig(it) },
        onStartProject = { viewModel.startProject(it) },
        onStopProject = { viewModel.stopProject(it) },
        onNavigateToSettings = onNavigateToSettings,
        onNavigateToProject = onNavigateToProject,
        onNavigateToSchedule = onNavigateToSchedule,
        onNavigateToStatistics = onNavigateToStatistics,
        onNavigateToNotifications = onNavigateToNotifications,
        onNavigateToAllInventories = onNavigateToAllInventories
    )
}

/**
 * Вміст головного екрану інформаційної панелі.
 * Використовується для підтримки Previews та відокремлення логіки від UI.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardScreenContent(
    projects: List<ProjectModel>,
    isLoading: Boolean,
    errorMessage: String?,
    notificationCount: Int,
    internalConfig: Map<String, Int>,
    onRefreshData: () -> Unit,
    onUpdateInternalConfig: (Map<String, Int>) -> Unit,
    onStartProject: (String) -> Unit,
    onStopProject: (String) -> Unit,
    onNavigateToSettings: () -> Unit,
    onNavigateToProject: (String) -> Unit,
    onNavigateToSchedule: () -> Unit,
    onNavigateToStatistics: () -> Unit,
    onNavigateToNotifications: () -> Unit,
    onNavigateToAllInventories: () -> Unit
) {
    var showConfigDialog by remember { mutableStateOf(false) }

    if (showConfigDialog) {
        InternalConfigDialog(
            configMap = internalConfig,
            onDismiss = { showConfigDialog = false },
            onSave = { newConfig -> onUpdateInternalConfig(newConfig) }
        )
    }

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
                            text = "Панель Sunflower Land",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                    }
                },
                actions = {
                    IconButton(
                        onClick = { showConfigDialog = true },
                        modifier = Modifier.testTag("dashboard_config_button")
                    ) {
                        Icon(
                            imageVector = Icons.Default.Tune,
                            contentDescription = "Конфігурація модулів",
                            tint = Color.White
                        )
                    }

                    IconButton(
                        onClick = onRefreshData,
                        modifier = Modifier.testTag("dashboard_refresh_button")
                    ) {
                        Icon(
                            imageVector = Icons.Default.Refresh,
                            contentDescription = "Синхронізувати",
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
                DashboardNavButton(
                    modifier = Modifier.weight(1f),
                    title = "Розклад",
                    icon = Icons.Default.CalendarMonth,
                    onClick = onNavigateToSchedule
                )

                DashboardNavButton(
                    modifier = Modifier.weight(1f),
                    title = "Статистика",
                    icon = Icons.Default.BarChart,
                    onClick = onNavigateToStatistics
                )

                DashboardNavButton(
                    modifier = Modifier.weight(1f),
                    title = "Сповіщення",
                    icon = Icons.Default.Notifications,
                    badgeCount = notificationCount,
                    onClick = onNavigateToNotifications
                )
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                DashboardNavButton(
                    modifier = Modifier.weight(1f),
                    title = "Всі Інвентарі",
                    icon = Icons.Default.GridView,
                    onClick = onNavigateToAllInventories
                )
            }

            Text(
                text = "Виявлені проекти ботів",
                style = MaterialTheme.typography.titleMedium,
                color = Color.White,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(top = 8.dp)
            )

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
                            onCardClick = { onNavigateToProject(project.name) },
                            onStartClick = { onStartProject(project.name) },
                            onStopClick = { onStopProject(project.name) }
                        )
                    }
                }
            }
        }
    }
}

/**
 * Кнопка навігації для головного екрану
 */
@Composable
fun DashboardNavButton(
    modifier: Modifier = Modifier,
    title: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    badgeCount: Int = 0,
    onClick: () -> Unit
) {
    Card(
        modifier = modifier
            .height(80.dp)
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFF1C1F26)),
        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.05f))
    ) {
        Box(modifier = Modifier.fillMaxSize()) {
            Column(
                modifier = Modifier.fillMaxSize(),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(24.dp)
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = title,
                    style = MaterialTheme.typography.labelMedium,
                    color = Color.White,
                    fontWeight = FontWeight.Bold
                )
            }
            
            // Бейдж кількості (наприклад, для сповіщень)
            if (badgeCount > 0) {
                Box(
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(8.dp)
                        .size(20.dp)
                        .background(Color(0xFFEF4444), CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = if (badgeCount > 99) "99+" else badgeCount.toString(),
                        color = Color.White,
                        fontSize = 10.sp,
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
    onCardClick: () -> Unit,
    onStartClick: () -> Unit,
    onStopClick: () -> Unit
) {
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
                modifier = Modifier.weight(1.2f)
            ) {
                // Пульсуючий або зафіксований маркер
                Box(
                    modifier = Modifier
                        .size(10.dp)
                        .background(
                            color = if (project.isRunning) Color(0xFF10B981) else Color(0xFF64748B),
                            shape = CircleShape
                        )
                )
                
                Spacer(modifier = Modifier.width(12.dp))

                Column {
                    Text(
                        text = project.name,
                        style = MaterialTheme.typography.bodyLarge,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                    Text(
                        text = if (project.isRunning) {
                            if (project.activeNodeTitle != null) "Активна нода: ${project.activeNodeTitle}" else "Автоматизація виконується..."
                        } else if (project.nextRun != null || project.plannedNodeRun != null) {
                            val format = java.text.SimpleDateFormat("dd.MM HH:mm", java.util.Locale.getDefault())
                            val parts = mutableListOf<String>()
                            if (project.nextRun != null) {
                                parts.add("Розклад: ${format.format(java.util.Date(project.nextRun))}")
                            }
                            if (project.plannedNodeRun != null) {
                                parts.add("Нода: ${format.format(java.util.Date(project.plannedNodeRun))}")
                            }
                            "Наступний запуск: " + parts.joinToString(" | ")
                        } else {
                            "Очікує / Готовий"
                        },
                        style = MaterialTheme.typography.labelSmall,
                        color = if (project.isRunning) Color(0xFF10B981) else Color.White.copy(alpha = 0.4f)
                    )
                }
            }

            // Швидкі кнопки запуску/зупинки автоматизатора не заходячи у пряму трансляцію
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
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
                            contentDescription = "Зупинити", // Переклад
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
                            contentDescription = "Запустити", // Переклад
                            tint = Color(0xFF10B981),
                            modifier = Modifier.size(16.dp)
                        )
                    }
                }

                // Перехід в розширений режим моніторингу
                IconButton(
                    onClick = onCardClick,
                    modifier = Modifier.size(32.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.ChevronRight,
                        contentDescription = "Відкрити панель детального моніторингу", // Переклад
                        tint = Color.White.copy(alpha = 0.3f)
                    )
                }
            }
        }
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
            onNavigateToSchedule = {},
            onNavigateToStatistics = {},
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
            onNavigateToSchedule = {},
            onNavigateToStatistics = {},
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
            onNavigateToSchedule = {},
            onNavigateToStatistics = {},
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
            title = "Розклад",
            icon = Icons.Default.CalendarMonth,
            onClick = {}
        )
    }
}

@Preview(showBackground = true)
@Composable
fun PreviewDashboardNavButtonWithBadge() {
    MyApplicationTheme {
        DashboardNavButton(
            title = "Сповіщення",
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
