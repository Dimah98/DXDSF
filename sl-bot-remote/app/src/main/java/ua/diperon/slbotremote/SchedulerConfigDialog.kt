package ua.diperon.slbotremote // Пакет нашого додатку

import androidx.compose.foundation.BorderStroke // Клас рамки елементів
import androidx.compose.foundation.background // Функція встановлення заднього фону
import androidx.compose.foundation.border // Рамка для елементів UI
import androidx.compose.foundation.clickable // Обробник натискань
import androidx.compose.foundation.layout.* // Контейнери розмітки (Row, Column, Box)
import androidx.compose.foundation.shape.CircleShape // Кругла форма для елементів
import androidx.compose.foundation.shape.RoundedCornerShape // Скруглена прямокутна форма
import androidx.compose.foundation.text.BasicTextField // Компонент простого текстового поля
import androidx.compose.foundation.text.KeyboardOptions // Параметри клавіатури введення
import androidx.compose.material.icons.Icons // Стандартна колекція іконок
import androidx.compose.material.icons.filled.* // Конкретні матеріальні іконки
import androidx.compose.material3.* // Компоненти Material Design 3
import androidx.compose.runtime.* // Організатори станів Jetpack Compose
import androidx.compose.ui.Alignment // Вирівнювання об'єктів у контейнерах
import androidx.compose.ui.Modifier // Модифікатори розмірів та стилів
import androidx.compose.ui.draw.clip // Кліпування об'єктів за формою
import androidx.compose.ui.graphics.Color // Модель керування кольорами
import androidx.compose.ui.platform.LocalFocusManager // Керування фокусом клавіатури
import androidx.compose.ui.text.TextStyle // Клас опису стилю тексту
import androidx.compose.ui.text.font.FontWeight // Вага шрифтів (напівжирний тощо)
import androidx.compose.ui.text.input.KeyboardType // Варіант віртуальної клавіатури
import androidx.compose.ui.text.style.TextAlign // Вирівнювання тексту
import androidx.compose.ui.unit.dp // Пікселі незалежні від щільності екрану
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.lifecycle.viewmodel.compose.viewModel
import ua.diperon.slbotremote.ui.theme.*

/**
 * Діалогове вікно управління розкладом та інтервалами автоматизації проектів бота.
 * Спроектовано відповідно до "Immersive UI" концепту.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SchedulerConfigDialog(
    projectName: String, // Назва проекту, для якого редагуємо розклад
    onDismiss: () -> Unit, // Колбек для закриття діалогу без збереження
    viewModel: SchedulerSettingsViewModel = viewModel() // ViewModel для зберігання та надсилання налаштувань
) {
    // Реактивне завантаження налаштувань в момент появи діалогу
    LaunchedEffect(projectName) {
        viewModel.initForProject(projectName)
    }

    // Підписка на поточні реактивні стани з нашої ViewModel
    val settings by viewModel.launchSettings.collectAsState() // Стейт налаштувань запуску
    val isLoading by viewModel.isLoading.collectAsState() // Прапорець завантаження запитів
    val errorMessage by viewModel.errorMessage.collectAsState() // Повідомлення про мережеву помилку
    val saveSuccess by viewModel.saveSuccess.collectAsState() // Стейт успішності збереження конфігу

    // Фокус-менеджер для закриття клавіатури при переході
    val focusManager = LocalFocusManager.current

    // Обробник успішного завершення операції запису
    LaunchedEffect(saveSuccess) {
        if (saveSuccess) {
            viewModel.resetSaveSuccess() // Скинути прапорець успіху на майбутнє
            onDismiss() // Закрити діалогове вікно
        }
    }

    // Головний системний контейнер діалогу Android Compose
    Dialog(onDismissRequest = onDismiss) {
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 16.dp),
            shape = RoundedCornerShape(24.dp),
            colors = CardDefaults.cardColors(
                containerColor = Color.White.copy(alpha = 0.06f)
            ),
            border = BorderStroke(1.dp, Color.White.copy(alpha = 0.12f)),
            elevation = CardDefaults.cardElevation(defaultElevation = 12.dp) // М'яка тінь для об'ємності
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(24.dp), // Внутрішні відступи картки
                horizontalAlignment = Alignment.CenterHorizontally // Вирівнювання елементів по центру
            ) {
                // Заголовок діалогу з назвою проекту
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            text = "ПЛАНУВАЛЬНИК",
                            fontSize = 11.sp, // Малий акцентний шрифт
                            fontWeight = FontWeight.Bold,
                            color = GlassSuccess, // Фірмовий ізумрудний колір
                            letterSpacing = 1.5.sp // Широкі інтервали між літерами
                        )
                        Spacer(modifier = Modifier.height(2.dp))
                        Text(
                            text = projectName, // Відображаємо назву проекту бота
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White // Білий контрастний колір
                        )
                    }
                    // Кнопка швидкого закриття
                    IconButton(
                        onClick = onDismiss,
                        modifier = Modifier.size(36.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Close,
                            contentDescription = "Закрити",
                            tint = Color.White.copy(alpha = 0.6f)
                        )
                    }
                }

                Spacer(modifier = Modifier.height(20.dp))

                if (isLoading) {
                    // Красивий круговий індикатор під час завантаження конфігурації
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(220.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator(
                            color = GlassSuccess,
                            trackColor = Color.White.copy(alpha = 0.1f)
                        )
                    }
                } else {
                    // Контейнер налаштувань, коли дані завантажено
                    Column(modifier = Modifier.fillMaxWidth()) {
                        
                        // Повідомлення про помилку у разі її наявності
                        errorMessage?.let { error ->
                            Text(
                                text = error,
                                color = GlassError, // Червоний колір для помилки
                                fontSize = 12.sp,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(bottom = 12.dp),
                                textAlign = TextAlign.Center
                            )
                        }

                        // Секція: Вибір режиму (Інтервальний vs За розкладом)
                        Text(
                            text = "Режим автоматизації",
                            style = MaterialTheme.typography.labelMedium,
                            color = Color.White.copy(alpha = 0.5f), // Світло-сірий блідий підпис
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(bottom = 8.dp)
                        )

                        // Перемикач режимів у вигляді горизонтального таб-бару
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(46.dp)
                                .clip(RoundedCornerShape(12.dp)) // Весь перемикач має закруглені кути
                                .background(GlassTerminal) // Глибокий чорний фон підкладки
                                .border(BorderStroke(1.dp, Color.White.copy(alpha = 0.05f)), RoundedCornerShape(12.dp))
                                .padding(3.dp)
                        ) {
                            // Кнопка "Інтервальний"
                            val modeIntervalActive = settings.mode == "interval"
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .fillMaxHeight()
                                    .clip(RoundedCornerShape(9.dp))
                                    .background(
                                        if (modeIntervalActive) GlassSuccess else Color.Transparent
                                    )
                                    .clickable {
                                        focusManager.clearFocus()
                                        viewModel.updateMode("interval")
                                    },
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = "Інтервальний",
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = if (modeIntervalActive) Color.Black else Color.White.copy(alpha = 0.7f)
                                )
                            }

                            // Кнопка "За розкладом"
                            val modeScheduleActive = settings.mode == "schedule"
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .fillMaxHeight()
                                    .clip(RoundedCornerShape(9.dp))
                                    .background(
                                        if (modeScheduleActive) GlassSuccess else Color.Transparent
                                    )
                                    .clickable {
                                        focusManager.clearFocus()
                                        viewModel.updateMode("schedule")
                                    },
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = "За розкладом",
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = if (modeScheduleActive) Color.Black else Color.White.copy(alpha = 0.7f)
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(20.dp))

                        // Умовне відображення в залежності від обраного режиму
                        if (settings.mode == "interval") {
                            // Секція налаштувань інтервалу
                            Text(
                                text = "Параметри інтервалу запусків",
                                style = MaterialTheme.typography.labelMedium,
                                color = Color.White.copy(alpha = 0.5f),
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(bottom = 8.dp)
                            )

                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(12.dp)
                            ) {
                                // Поле введення самого числового значення
                                OutlinedTextField(
                                    value = if (settings.intervalValue == 0) "" else settings.intervalValue.toString(),
                                    onValueChange = { newVal ->
                                        val filteredString = newVal.filter { it.isDigit() }
                                        val parsedInt = filteredString.toIntOrNull() ?: 0
                                        viewModel.updateIntervalValue(parsedInt.coerceIn(0, 9999))
                                    },
                                    modifier = Modifier.weight(1f),
                                    textStyle = TextStyle(
                                        color = Color.White,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 16.sp
                                    ),
                                    shape = RoundedCornerShape(12.dp),
                                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                    singleLine = true,
                                    colors = OutlinedTextFieldDefaults.colors(
                                        focusedTextColor = Color.White,
                                        unfocusedTextColor = Color.White,
                                        focusedBorderColor = GlassSuccess,
                                        unfocusedBorderColor = Color.White.copy(alpha = 0.12f),
                                        focusedContainerColor = GlassTerminal,
                                        unfocusedContainerColor = GlassTerminal
                                    ),
                                    placeholder = {
                                        Text("Значення", color = Color.White.copy(alpha = 0.3f), fontSize = 14.sp)
                                    }
                                )

                                // Вибір одиниці виміру часу (Хвилини / Години)
                                Row(
                                    modifier = Modifier
                                        .width(160.dp)
                                        .height(52.dp)
                                        .clip(RoundedCornerShape(12.dp))
                                        .background(GlassTerminal)
                                        .border(BorderStroke(1.dp, Color.White.copy(alpha = 0.05f)), RoundedCornerShape(12.dp))
                                        .padding(3.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    val isMinutes = settings.intervalUnit == "minutes"
                                    
                                    // Кнопка "хв"
                                    Box(
                                        modifier = Modifier
                                            .weight(1f)
                                            .fillMaxHeight()
                                            .clip(RoundedCornerShape(8.dp))
                                            .background(if (isMinutes) GlassSuccess.copy(alpha = 0.15f) else Color.Transparent)
                                             .clickable { viewModel.updateIntervalUnit("minutes") },
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Text(
                                            text = "хв",
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 12.sp,
                                            color = if (isMinutes) GlassSuccess else Color.White.copy(alpha = 0.6f)
                                        )
                                    }

                                    // Кнопка "год"
                                    Box(
                                        modifier = Modifier
                                            .weight(1f)
                                            .fillMaxHeight()
                                            .clip(RoundedCornerShape(8.dp))
                                            .background(if (!isMinutes) GlassSuccess.copy(alpha = 0.15f) else Color.Transparent)
                                            .clickable { viewModel.updateIntervalUnit("hours") },
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Text(
                                            text = "год",
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 12.sp,
                                            color = if (!isMinutes) GlassSuccess else Color.White.copy(alpha = 0.6f)
                                        )
                                    }
                                }
                            }
                        } else {
                            // Секція налаштувань режиму "За розкладом"
                            Text(
                                text = "Час та дні виконання",
                                style = MaterialTheme.typography.labelMedium,
                                color = Color.White.copy(alpha = 0.5f),
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(bottom = 8.dp)
                            )

                            // Поле вибору часу у форматі HH:MM
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(16.dp))
                                    .background(GlassTerminal)
                                    .border(BorderStroke(1.dp, Color.White.copy(alpha = 0.05f)), RoundedCornerShape(16.dp))
                                    .padding(14.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.Center
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Schedule,
                                    contentDescription = "Час",
                                    tint = GlassSuccess,
                                    modifier = Modifier.size(20.dp)
                                )
                                Spacer(modifier = Modifier.width(10.dp))
                                
                                // Просте поле введення та редагування часу HH:MM із валідацією
                                var timeText by remember { mutableStateOf("") }
                                LaunchedEffect(settings.scheduleTime) {
                                    timeText = settings.scheduleTime
                                }
                                
                                BasicTextField(
                                    value = timeText,
                                    onValueChange = { newVal ->
                                        // Дозволяємо лише введення чисел та двокрапки
                                        val filteredText = newVal.filter { it.isDigit() || it == ':' }
                                        if (filteredText.length <= 5) {
                                            timeText = filteredText
                                            // Якщо формат правильний HH:MM, передаємо у ViewModel
                                            if (filteredText.matches(Regex("^[0-2][0-9]:[0-5][0-9]$"))) {
                                                viewModel.updateScheduleTime(filteredText)
                                            }
                                        }
                                    },
                                    textStyle = TextStyle(
                                        color = Color.White,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 18.sp,
                                        textAlign = TextAlign.Center
                                    ),
                                    modifier = Modifier.width(80.dp),
                                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
                                    singleLine = true
                                )
                                
                                Spacer(modifier = Modifier.width(10.dp))
                                Text(
                                    text = "(формат ЧЧ:ХХ)",
                                    fontSize = 11.sp,
                                    color = Color.White.copy(alpha = 0.3f)
                                )
                            }

                            Spacer(modifier = Modifier.height(16.dp))

                            // Вибір днів тижня у вигляді круглих бірок-кнопок
                            Text(
                                text = "Дні тижня",
                                style = MaterialTheme.typography.labelMedium,
                                color = Color.White.copy(alpha = 0.5f),
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(bottom = 8.dp)
                            )

                            // Масив назв днів тижня (українською) та їх числових ідентифікаторів
                            val daysOfWeek = listOf(
                                Pair(1, "Пн"),
                                Pair(2, "Вт"),
                                Pair(3, "Ср"),
                                Pair(4, "Чт"),
                                Pair(5, "Пт"),
                                Pair(6, "Сб"),
                                Pair(7, "Нд")
                            )

                            // Розміщуємо дні в один рядок
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                daysOfWeek.forEach { (dayId, dayName) ->
                                    val isSelected = settings.scheduleDays.contains(dayId)
                                    Box(
                                        modifier = Modifier
                                            .size(38.dp)
                                            .clip(CircleShape)
                                            .background(
                                                if (isSelected) GlassSuccess else GlassTerminal
                                            )
                                            .border(
                                                BorderStroke(
                                                    1.dp,
                                                    if (isSelected) Color.Transparent else Color.White.copy(alpha = 0.08f)
                                                ),
                                                CircleShape
                                            )
                                             .clickable {
                                                viewModel.toggleScheduleDay(dayId)
                                            },
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Text(
                                            text = dayName,
                                            fontSize = 12.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = if (isSelected) Color.Black else Color.White.copy(alpha = 0.7f)
                                        )
                                    }
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(28.dp))

                        // Нижні керуючі кнопки: Зберегти та Скасувати
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            // Кнопка закриття (Скасувати)
                            OutlinedButton(
                                onClick = onDismiss,
                                modifier = Modifier
                                    .weight(1f)
                                    .height(48.dp),
                                shape = RoundedCornerShape(16.dp),
                                colors = ButtonDefaults.outlinedButtonColors(
                                    contentColor = Color.White.copy(alpha = 0.6f)
                                ),
                                border = BorderStroke(1.dp, Color.White.copy(alpha = 0.08f))
                            ) {
                                Text("Скасувати", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                            }

                            // Кнопка запису на сервер (Зберегти розклад)
                            Button(
                                onClick = {
                                    focusManager.clearFocus()
                                    viewModel.saveConfig(projectName) { success ->
                                        // Колбек буде опрацьовано автоматично через LaunchedEffect
                                    }
                                },
                                modifier = Modifier
                                    .weight(1.3f)
                                    .height(48.dp),
                                shape = RoundedCornerShape(16.dp),
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = GlassSuccess,
                                    contentColor = Color.Black
                                )
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Save,
                                    contentDescription = null,
                                    tint = Color.Black,
                                    modifier = Modifier.size(16.dp)
                                )
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("Зберегти", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                            }
                        }
                    }
                }
            }
        }
    }
}
