package com.example // Пакет нашого додатку

import androidx.compose.animation.AnimatedVisibility // Анімація видимості елементів
import androidx.compose.animation.expandVertically // Анімація розкриття по вертикалі
import androidx.compose.animation.fadeIn // Анімація появи (плавне згасання)
import androidx.compose.animation.fadeOut // Анімація зникнення
import androidx.compose.animation.shrinkVertically // Анімація згортання по вертикалі
import androidx.compose.foundation.BorderStroke // Параметри рамки елементів
import androidx.compose.foundation.background // Задній фон
import androidx.compose.foundation.border // Рамка для об'єктів
import androidx.compose.foundation.layout.Arrangement // Вирівнювання в контейнерах
import androidx.compose.foundation.layout.Box // Контейнер вільного накладання шарів
import androidx.compose.foundation.layout.Column // Вертикальний контейнер
import androidx.compose.foundation.layout.Row // Горизонтальний контейнер
import androidx.compose.foundation.layout.Spacer // Розділювач простору
import androidx.compose.foundation.layout.fillMaxSize // Заповнити весь екран
import androidx.compose.foundation.layout.fillMaxWidth // Розтягнути по всій ширині
import androidx.compose.foundation.layout.height // Фіксована висота
import androidx.compose.foundation.layout.padding // Внутрішні відступи
import androidx.compose.foundation.layout.size // Фіксовані геометричні розміри
import androidx.compose.foundation.layout.width // Фіксована ширина
import androidx.compose.foundation.rememberScrollState // Менеджер прокрутки списку
import androidx.compose.foundation.shape.RoundedCornerShape // Закруглена форма для кутів
import androidx.compose.foundation.text.KeyboardOptions // Параметри віртуальної клавіатури
import androidx.compose.foundation.verticalScroll // Дозволити вертикальну прокрутку
import androidx.compose.material.icons.Icons // Колекція іконок
import androidx.compose.material.icons.automirrored.filled.ArrowBack // Іконка повернення назад
import androidx.compose.material.icons.filled.CheckCircle // Іконка успіху
import androidx.compose.material.icons.filled.CompassCalibration // Іконка тестування з'єднання
import androidx.compose.material.icons.filled.Error // Іконка помилки
import androidx.compose.material.icons.filled.Hub // Іконка порту (ланка)
import androidx.compose.material.icons.filled.Info // Іконка інформації
import androidx.compose.material.icons.filled.Lan // Іконка проводової мережі (хост)
import androidx.compose.material.icons.filled.Settings // Іконка налаштувань
import androidx.compose.material3.Button // Кнопка Material 3
import androidx.compose.material3.ButtonDefaults // Кольори та стилі кнопки
import androidx.compose.material3.Card // Картка Material 3
import androidx.compose.material3.CardDefaults // Стилі картки
import androidx.compose.material3.CircularProgressIndicator // Круговий індикатор прогресу
import androidx.compose.material3.ExperimentalMaterial3Api // Експериментальні АРІ Material 3
import androidx.compose.material3.Icon // Компонент векторного зображення
import androidx.compose.material3.IconButton // Кругла кнопка з іконкою
import androidx.compose.material3.MaterialTheme // Системні теми та стилі оформлення
import androidx.compose.material3.OutlinedTextField // Текстове поле введення з рамкою
import androidx.compose.material3.OutlinedTextFieldDefaults // Стилі поля введення
import androidx.compose.material3.Scaffold // Структурний каркас екрану
import androidx.compose.material3.Text // Компонент тексту
import androidx.compose.material3.TopAppBar // Верхня панель дій
import androidx.compose.material3.TopAppBarDefaults // Колірні стилі верхньої панелі
import androidx.compose.runtime.Composable // Визначає Compose-функцію
import androidx.compose.runtime.DisposableEffect // Життєвий цикл при закритті екрану
import androidx.compose.runtime.LaunchedEffect // Ефект запуску процесу
import androidx.compose.runtime.collectAsState // Приведення корутин-потоків у стейт
import androidx.compose.runtime.getValue // Делегація зчитування значень
import androidx.compose.runtime.mutableStateOf // Декларація змінної станів
import androidx.compose.runtime.remember // Кешування станів композиції
import androidx.compose.runtime.setValue // Делегація запису значень
import androidx.compose.ui.Alignment // Точки вирівнювання
import androidx.compose.ui.Modifier // Модифікатор властивостей розширень
import androidx.compose.ui.graphics.Brush // Побудова колірних градієнтів
import androidx.compose.ui.graphics.Color // Модель встановлення значень кольорів
import androidx.compose.ui.platform.testTag // Теги автоматичного тестування
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Екран налаштування підключення до сервера автоматизації з'єднання з NodeJS бекендом.
 * Переведений виключно на українську мову.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ConnectionSettingsScreen(
    viewModel: DashboardViewModel, // Використання ViewModel головної панелі для налаштування
    canGoBack: Boolean, // Чи можна повернутися на попередній крок
    onBackClick: () -> Unit, // Колбек обробника натискання назад
    onSaveSuccess: () -> Unit // Колбек успішного збереження даних
) {
    // Отримання збереженого з SharedPrefs конфігу від потоку станів у ViewModel
    val savedConfig by viewModel.connectionConfig.collectAsState()
    // Спостереження результату тестового підключення до сервера
    val testResult by viewModel.testResult.collectAsState()

    // Внутрішній буфер збереження текстових полів введення
    var hostInput by remember { mutableStateOf("") }
    var portInput by remember { mutableStateOf("") }
    var inventoryOrderInput by remember { mutableStateOf("") }

    val context = LocalContext.current
    val inventoryPrefs = remember { InventoryPreferences(context) }

    // Автоматичне підставлення збереженої адреси при першому відображенні
    LaunchedEffect(savedConfig) {
        hostInput = savedConfig.host
        portInput = savedConfig.port
        inventoryOrderInput = inventoryPrefs.getRawInventoryOrder()
    }

    // Скидання результатів минулих тестів та звільнення пам'яті перед виходом
    DisposableEffect(Unit) {
        onDispose {
            viewModel.resetTestResult() // Очистити стейт тестування
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                modifier = androidx.compose.ui.Modifier.height(42.dp),
                
                title = {
                    Text(
                        text = "Налаштування з'єднання", // Переклад заголовка панелі дій
                        fontWeight = FontWeight.Bold,
                        color = Color.White,
                        style = MaterialTheme.typography.titleMedium
                    )
                },
                navigationIcon = {
                    if (canGoBack) {
                        IconButton(
                            onClick = onBackClick,
                            modifier = Modifier.testTag("settings_back_button") // Тег для тестів
                        ) {
                            Icon(
                                imageVector = Icons.AutoMirrored.Filled.ArrowBack, // Напрямок стрілки назад
                                contentDescription = "Назад",
                                tint = Color.White
                            )
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Color(0xFF14161B) // Робочий графітовий колір верхньої панелі
                )
            )
        },
        containerColor = MaterialTheme.colorScheme.background // Темний фон підкладки нашого застосунку
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(
                    top = innerPadding.calculateTopPadding(),
                    bottom = innerPadding.calculateBottomPadding(),
                    start = 20.dp,
                    end = 20.dp
                )
                .verticalScroll(rememberScrollState()), // Дозволяє контенту прокручуватися на дрібних екранах
            verticalArrangement = Arrangement.spacedBy(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Візуальний брендований банер налаштування
            SettingsBrandingHeader()

            // Форма введення хосту та порту підключення
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(24.dp), // Сучасне округлення кутів
                colors = CardDefaults.cardColors(
                    containerColor = Color(0xFF1C1F26) // Колір картки з темного дизайну
                ),
                border = BorderStroke(1.dp, Color.White.copy(alpha = 0.05f)), // Рівномірна тонка темна обводка
                elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
            ) {
                Column(
                    modifier = Modifier.padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    Text(
                        text = "Адреса бекенду NodeJS", // Перекладено
                        style = MaterialTheme.typography.labelLarge,
                        color = MaterialTheme.colorScheme.primary,
                        fontWeight = FontWeight.Bold
                    )

                    // Текстове поле введення IP-адреси / імені хоста
                    OutlinedTextField(
                        value = hostInput,
                        onValueChange = { hostInput = it },
                        label = { Text("IP-адреса / Хост") }, // Перекладено
                        placeholder = { Text("напр. 192.168.1.100") }, // Перекладено
                        leadingIcon = {
                            Icon(
                                imageVector = Icons.Default.Lan, // Сітьова іконка
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.primary
                            )
                        },
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color.White,
                            focusedBorderColor = MaterialTheme.colorScheme.primary, // Ізумрудна рамка при фокусі
                            unfocusedBorderColor = Color.White.copy(alpha = 0.15f),
                            focusedLabelColor = MaterialTheme.colorScheme.primary,
                            unfocusedLabelColor = Color.White.copy(alpha = 0.5f)
                        ),
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("settings_host_input"),
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Text,
                            imeAction = ImeAction.Next // Перехід на наступний інпут при кліку "Next"
                        ),
                        singleLine = true // Один рядок
                    )

                    // Текстове поле введення мережевого порту
                    OutlinedTextField(
                        value = portInput,
                        onValueChange = { portInput = it },
                        label = { Text("Порт") }, // Перекладено
                        placeholder = { Text("напр. 3001") }, // Перекладено
                        leadingIcon = {
                            Icon(
                                imageVector = Icons.Default.Hub, // Іконка порту
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.primary
                            )
                        },
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color.White,
                            focusedBorderColor = MaterialTheme.colorScheme.primary,
                            unfocusedBorderColor = Color.White.copy(alpha = 0.15f),
                            focusedLabelColor = MaterialTheme.colorScheme.primary,
                            unfocusedLabelColor = Color.White.copy(alpha = 0.5f)
                        ),
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("settings_port_input"),
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Number, // Клавіатура для числових символів
                            imeAction = ImeAction.Done // Приховати клавіатуру при закінченні вводу
                        ),
                        singleLine = true
                    )

                    Spacer(modifier = Modifier.height(4.dp))

                    // Рядок кнопок дій: Тестувати з'єднання та Зберегти
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        // Кнопка тестування з'єднання
                        Button(
                            onClick = { viewModel.testConnection(hostInput, portInput) },
                            modifier = Modifier
                                .weight(1f)
                                .height(46.dp)
                                .testTag("settings_test_button"),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = Color(0xFF14161B), // Стильний темний сірий колір
                                contentColor = Color.White
                            ),
                            border = BorderStroke(1.dp, Color.White.copy(alpha = 0.1f)),
                            shape = RoundedCornerShape(16.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.CompassCalibration,
                                contentDescription = null,
                                tint = Color.White,
                                modifier = Modifier.size(16.dp)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = "Тестувати", // Перекладено
                                fontWeight = FontWeight.Bold,
                                fontSize = 13.sp
                            )
                        }

                        // Кнопка негайного збереження конфігурації
                        Button(
                            onClick = {
                                if (hostInput.isNotBlank() && portInput.isNotBlank()) {
                                    viewModel.saveSettings(hostInput, portInput)
                                    inventoryPrefs.saveInventoryOrder(inventoryOrderInput)
                                    onSaveSuccess() // Повернення на головний екран при успіху
                                }
                            },
                            enabled = hostInput.isNotBlank() && portInput.isNotBlank(), // Активна лише за наявності даних
                            modifier = Modifier
                                .weight(1f)
                                .height(46.dp)
                                .testTag("settings_save_button"),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = MaterialTheme.colorScheme.primary, // Зелень яскрава
                                contentColor = Color.Black,
                                disabledContainerColor = Color(0xFF1C1F26).copy(alpha = 0.4f),
                                disabledContentColor = Color.White.copy(alpha = 0.2f)
                            ),
                            shape = RoundedCornerShape(16.dp)
                        ) {
                            Text(
                                text = "Зберегти", // Перекладено
                                fontWeight = FontWeight.Bold,
                                color = if (hostInput.isNotBlank() && portInput.isNotBlank()) Color.Black else Color.White.copy(alpha = 0.2f),
                                fontSize = 13.sp
                            )
                        }
                    }
                }
            }

            // Налаштування інвентаря
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(24.dp),
                colors = CardDefaults.cardColors(
                    containerColor = Color(0xFF1C1F26)
                ),
                border = BorderStroke(1.dp, Color.White.copy(alpha = 0.05f))
            ) {
                Column(
                    modifier = Modifier.padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    Text(
                        text = "Налаштування інвентаря",
                        style = MaterialTheme.typography.labelLarge,
                        color = MaterialTheme.colorScheme.primary,
                        fontWeight = FontWeight.Bold
                    )

                    OutlinedTextField(
                        value = inventoryOrderInput,
                        onValueChange = { inventoryOrderInput = it },
                        label = { Text("Порядок предметів (через кому)") },
                        placeholder = { Text("LV, Золото, FLOWER, Wood...") },
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color.White,
                            focusedBorderColor = MaterialTheme.colorScheme.primary,
                            unfocusedBorderColor = Color.White.copy(alpha = 0.15f),
                            focusedLabelColor = MaterialTheme.colorScheme.primary,
                            unfocusedLabelColor = Color.White.copy(alpha = 0.5f)
                        ),
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.fillMaxWidth(),
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Text,
                            imeAction = ImeAction.Done
                        ),
                        singleLine = false,
                        maxLines = 5
                    )
                }
            }

            // Інформація про хід і результати запущеного тестування з'єднання
            AnimatedVisibility(
                visible = testResult != TestConnectionResult.Idle,
                enter = fadeIn() + expandVertically(),
                exit = fadeOut() + shrinkVertically(),
                modifier = Modifier.fillMaxWidth()
            ) {
                TestResultCard(testResult = testResult)
            }

            // Допоміжні підказки по локальному розгортанню для розробника
            LocalDeviceHelpTip()
        }
    }
}

/**
 * Верхній брендований промо-блок з іконкою великого шестеренчатого механізму.
 */
@Composable
fun SettingsBrandingHeader() {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 12.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Box(
            modifier = Modifier
                .size(64.dp)
                .background(
                    Brush.radialGradient(
                        colors = listOf(
                            MaterialTheme.colorScheme.primary.copy(alpha = 0.25f),
                            Color.Transparent
                        )
                    )
                ),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = Icons.Default.Settings,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary,
                modifier = Modifier.size(40.dp)
            )
        }
        Spacer(modifier = Modifier.height(10.dp))
        Text(
            text = "Менеджер з'єднання з ботом", // Перекладено українською
            style = MaterialTheme.typography.titleMedium,
            color = Color.White,
            fontWeight = FontWeight.Bold
        )
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = "Налаштуйте параметри для з'єднання з вашим локальним або хмарним сервером запусків Node Playwright.", // Перекладено
            style = MaterialTheme.typography.bodySmall,
            color = Color.White.copy(alpha = 0.5f),
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(horizontal = 16.dp)
        )
    }
}

/**
 * Компонент візуалізації результатів перевірки зв'язку у реальному часі.
 */
@Composable
fun TestResultCard(testResult: TestConnectionResult) {
    // Структурування даних кольорів та іконок згідно результатів тесту
    val (bgColor, borderColor, icon, isTesting) = when (testResult) {
        TestConnectionResult.Testing -> Quadruple(Color(0xFF334155).copy(alpha = 0.2f), Color(0xFF64748B), null, true)
        is TestConnectionResult.Success -> Quadruple(Color(0xFF10B981).copy(alpha = 0.1f), Color(0xFF10B981), Icons.Default.CheckCircle, false)
        is TestConnectionResult.Failure -> Quadruple(Color(0xFFEF4444).copy(alpha = 0.1f), Color(0xFFEF4444), Icons.Default.Error, false)
        TestConnectionResult.Idle -> Quadruple(Color.Transparent, Color.Transparent, null, false)
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = bgColor),
        border = BorderStroke(1.dp, borderColor.copy(alpha = 0.4f))
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            if (isTesting) {
                // Кругова анімація очікування мережевої відповіді
                CircularProgressIndicator(
                    modifier = Modifier.size(24.dp),
                    strokeWidth = 2.dp,
                    color = MaterialTheme.colorScheme.primary
                )
            } else if (icon != null) {
                // Відображення іконки успіху або помилки
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = borderColor,
                    modifier = Modifier.size(24.dp)
                )
            }

            Spacer(modifier = Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = when (testResult) {
                        TestConnectionResult.Testing -> "Тестування підключення до бекенду..." // Перекладено
                        is TestConnectionResult.Success -> "Зв'язок встановлено!" // Перекладено
                        is TestConnectionResult.Failure -> "Помилка встановлення зв'язку" // Перекладено
                        else -> ""
                    },
                    style = MaterialTheme.typography.bodySmall,
                    color = Color.White,
                    fontWeight = FontWeight.Bold
                )

                // Детальний опис помилки або відкритих проектів від сервера
                val detailsText = when (testResult) {
                    is TestConnectionResult.Success -> testResult.message
                    is TestConnectionResult.Failure -> testResult.error
                    else -> "Надсилаються транзитні мережеві пакети..." // Перекладено
                }

                Spacer(modifier = Modifier.height(2.dp))
                
                Text(
                    text = detailsText,
                    style = MaterialTheme.typography.labelSmall,
                    color = Color.White.copy(alpha = 0.6f)
                )
            }
        }
    }
}

/**
 * Чотиримісний допоміжний кортеж даних для параметризації інтерфейсу.
 */
data class Quadruple<A, B, C, D>(val first: A, val second: B, val third: C, val fourth: D)

/**
 * Інструкція для спрощення налаштувань розробниками.
 */
@Composable
fun LocalDeviceHelpTip() {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = Color(0xFF1E293B).copy(alpha = 0.4f)
        ),
        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.05f))
    ) {
        Row(
            modifier = Modifier.padding(14.dp),
            verticalAlignment = Alignment.Top
        ) {
            Icon(
                imageVector = Icons.Default.Info,
                contentDescription = null,
                tint = Color.White.copy(alpha = 0.4f),
                modifier = Modifier.size(16.dp)
            )
            Spacer(modifier = Modifier.width(10.dp))
            Column {
                Text(
                    text = "Підказка по розробці", // Перекладено
                    style = MaterialTheme.typography.labelSmall,
                    color = Color.White,
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.height(2.dp))
                Text(
                    text = "Якщо бекенд Sunflower запущено на вашому комп'ютері, а додаток у цьому емуляторі, використовуйте хост '10.0.2.2' (aliases до локального хоста комп'ютера). Якщо ж запуск відбувається на реальному мобільному пристрої, переконайтеся, що обидва пристрої підключені до однієї локальної мережі Wi-Fi, та вкажіть IPv4 адресу комп'ютера (наприклад, 192.168.1...).", // Перекладено
                    style = MaterialTheme.typography.labelSmall,
                    color = Color.White.copy(alpha = 0.4f),
                    lineHeight = 14.sp
                )
            }
        }
    }
}

