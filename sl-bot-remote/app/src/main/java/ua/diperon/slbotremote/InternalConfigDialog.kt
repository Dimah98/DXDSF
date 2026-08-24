package ua.diperon.slbotremote

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import ua.diperon.slbotremote.ui.theme.*
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog

data class SystemSettingItem(
    val key: String,
    val title: String,
    val subtitle: String,
    val iconEmoji: String
)

/**
 * Вікно конфігурації для налаштування глобальних режимів та модулів бота
 */
@Composable
fun InternalConfigDialog(
    configMap: Map<String, Int>,
    onDismiss: () -> Unit,
    onSave: (Map<String, Int>) -> Unit
) {
    val systemSettings = listOf(
        SystemSettingItem("queueMode", "Режим черги", "Чекати завершення працюючих проектів перед запуском", "🚦"),
        SystemSettingItem("timeout10mMode", "Режим 10хв", "Автомачне закриття браузера якщо працює >10хв", "⏱️"),
        SystemSettingItem("disableImages", "Вимкнути завантаження картинок", "Економія мережевого трафіку", "🖼️"),
        SystemSettingItem("photoDebug", "Фото-дебаг", "Збереження скріншотів під час кроків", "📷"),
        SystemSettingItem("headless", "Невидимий режим браузера", "Запуск у невидимому режимі (Headless)", "👁️")
    )

    val modules = listOf(
        "початок", "поповнення", "збір і посадка", "дерево", "камень",
        "желізо", "золото", "гриби", "готовка", "доставка", "бателпас",
        "досягнення", "LOVE", "скан інвентаря", "компостек", "рибалка",
        "пошук скарбів", "мед", "квіти", "міні ігри", "допомога другу", "вихід"
    )

    val currentConfig = remember { mutableStateMapOf<String, Int>() }

    LaunchedEffect(configMap) {
        systemSettings.forEach { item ->
            if (item.key == "photoDebug") {
                currentConfig[item.key] = configMap[item.key] ?: 1
            } else {
                currentConfig[item.key] = configMap[item.key] ?: 0
            }
        }
        currentConfig["maxParallelProjects"] = configMap["maxParallelProjects"] ?: 1
        modules.forEach { key ->
            currentConfig[key] = configMap[key] ?: 0
        }
    }

    Dialog(onDismissRequest = onDismiss) {
        Card(
            shape = RoundedCornerShape(24.dp),
            colors = CardDefaults.cardColors(containerColor = Color(0xFF0A0E1A).copy(alpha = 0.95f)),
            modifier = Modifier
                .fillMaxWidth()
                .fillMaxHeight(0.85f)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(20.dp)
            ) {
                // Header
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            text = "Налаштування та конфігурація",
                            style = MaterialTheme.typography.titleMedium,
                            color = Color.White,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "Глобальні режими та модулі ботів",
                            style = MaterialTheme.typography.bodySmall,
                            color = Color.Gray
                        )
                    }
                    IconButton(onClick = onDismiss) {
                        Icon(Icons.Default.Close, contentDescription = "Закрити", tint = Color.White)
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                // Scrollable content
                LazyColumn(
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(24.dp))
                        .background(Color(0xFF0F172A))
                        .padding(8.dp)
                ) {
                    // --- SECTION 1: System Settings ---
                    item {
                        Text(
                            text = "ГЛОБАЛЬНІ НАЛАШТУВАННЯ БОТІВ",
                            color = GlassSuccess,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(start = 8.dp, top = 8.dp, bottom = 4.dp)
                        )
                    }

                    items(systemSettings) { item ->
                        val isEnabled = currentConfig[item.key] == 1
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 4.dp, horizontal = 8.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier.weight(1f)
                            ) {
                                Text(text = item.iconEmoji, fontSize = 16.sp)
                                Spacer(modifier = Modifier.width(8.dp))
                                Column {
                                    Text(
                                        text = item.title,
                                        color = Color.White,
                                        fontWeight = FontWeight.Medium,
                                        style = MaterialTheme.typography.bodyMedium
                                    )
                                    Text(
                                        text = item.subtitle,
                                        color = Color.Gray,
                                        fontSize = 10.sp
                                    )
                                }
                            }
                            Switch(
                                checked = isEnabled,
                                onCheckedChange = { checked ->
                                    currentConfig[item.key] = if (checked) 1 else 0
                                },
                                colors = SwitchDefaults.colors(
                                    checkedThumbColor = Color.White,
                                    checkedTrackColor = GlassSuccess,
                                    uncheckedThumbColor = Color.LightGray,
                                    uncheckedTrackColor = Color.DarkGray
                                )
                            )
                        }

                        if (item.key == "queueMode" && isEnabled) {
                            val maxParallel = currentConfig["maxParallelProjects"] ?: 1
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(start = 32.dp, end = 8.dp, top = 2.dp, bottom = 6.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text(
                                    text = "Макс. одночасних проектів:",
                                    color = GlassOnSurface,
                                    fontSize = 11.sp
                                )
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                                ) {
                                    IconButton(
                                        onClick = {
                                            if (maxParallel > 1) {
                                                currentConfig["maxParallelProjects"] = maxParallel - 1
                                            }
                                        },
                                        modifier = Modifier.size(28.dp)
                                    ) {
                                        Text("-", color = Color.White, fontWeight = FontWeight.Bold)
                                    }
                                    Text(
                                        text = maxParallel.toString(),
                                        color = GlassSuccess,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 14.sp,
                                        modifier = Modifier.padding(horizontal = 4.dp)
                                    )
                                    IconButton(
                                        onClick = {
                                            currentConfig["maxParallelProjects"] = maxParallel + 1
                                        },
                                        modifier = Modifier.size(28.dp)
                                    ) {
                                        Text("+", color = Color.White, fontWeight = FontWeight.Bold)
                                    }
                                }
                            }
                        }
                    }

                    item {
                        HorizontalDivider(
                            color = Color.White.copy(alpha = 0.1f),
                            modifier = Modifier.padding(vertical = 8.dp)
                        )
                        Text(
                            text = "МОДУЛІ БОТА",
                            color = Color(0xFF3B82F6),
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(start = 8.dp, bottom = 4.dp)
                        )
                    }

                    // --- SECTION 2: Modules ---
                    items(modules) { moduleName ->
                        val isEnabled = currentConfig[moduleName] == 1
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 4.dp, horizontal = 8.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                text = moduleName.replaceFirstChar { if (it.isLowerCase()) it.titlecase(java.util.Locale.getDefault()) else it.toString() },
                                color = Color.White,
                                style = MaterialTheme.typography.bodyMedium
                            )
                            Switch(
                                checked = isEnabled,
                                onCheckedChange = { checked ->
                                    currentConfig[moduleName] = if (checked) 1 else 0
                                },
                                colors = SwitchDefaults.colors(
                                    checkedThumbColor = Color.White,
                                    checkedTrackColor = Color(0xFF3B82F6),
                                    uncheckedThumbColor = Color.LightGray,
                                    uncheckedTrackColor = Color.DarkGray
                                )
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Save button
                Button(
                    onClick = { onSave(currentConfig.toMap()) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(48.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary),
                    shape = RoundedCornerShape(24.dp)
                ) {
                    Text("Зберегти конфігурацію", fontWeight = FontWeight.Bold, color = Color.Black)
                }
            }
        }
    }
}
