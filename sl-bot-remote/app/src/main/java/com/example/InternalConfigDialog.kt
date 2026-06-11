package com.example

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import kotlinx.coroutines.launch

/**
 * Вікно конфігурації для увімкнення/вимкнення окремих модулів бота
 */
@Composable
fun InternalConfigDialog(
    configMap: Map<String, Int>,
    onDismiss: () -> Unit,
    onSave: (Map<String, Int>) -> Unit
) {
    // Всі потрібні ключі для модулів
    val modules = listOf(
        "початок", "поповнення", "збір і посадка", "дерево", "камень",
        "желізо", "золото", "гриби", "готовка", "доставка", "бателпас",
        "досягнення", "LOVE", "скан інвентаря", "компостек", "рибалка",
        "пошук скарбів", "мед", "квіти", "міні ігри", "допомога другу", "вихід"
    )

    // Локальний стан налаштувань для редагування
    val currentConfig = remember { mutableStateMapOf<String, Int>() }

    LaunchedEffect(configMap) {
        // Ініціалізуємо зі збережених або нулями
        modules.forEach { key ->
            currentConfig[key] = configMap[key] ?: 0
        }
    }

    Dialog(onDismissRequest = onDismiss) {
        Card(
            shape = RoundedCornerShape(24.dp),
            colors = CardDefaults.cardColors(containerColor = Color(0xFF1C1F26)),
            modifier = Modifier
                .fillMaxWidth()
                .fillMaxHeight(0.85f) // Не на весь екран
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
                    Text(
                        text = "Конфігурація модулів",
                        style = MaterialTheme.typography.titleMedium,
                        color = Color.White,
                        fontWeight = FontWeight.Bold
                    )
                    IconButton(onClick = onDismiss) {
                        Icon(Icons.Default.Close, contentDescription = "Закрити", tint = Color.White)
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // List of switches
                LazyColumn(
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(16.dp))
                        .background(Color(0xFF0F172A))
                        .padding(8.dp)
                ) {
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
                                    checkedTrackColor = Color(0xFF10B981),
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
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Text("Зберегти конфіг", fontWeight = FontWeight.Bold, color = Color.Black)
                }
            }
        }
    }
}
