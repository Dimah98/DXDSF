package ua.diperon.slbotremote

import android.widget.Toast
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import kotlinx.coroutines.launch
import ua.diperon.slbotremote.ui.theme.*

private data class DiffLaunchData(
    val title1: String,
    val date1: String?,
    val json1: String,
    val title2: String,
    val date2: String?,
    val json2: String
)

/**
 * Діалогове вікно перегляду збережених версій *_save.json,
 * вибору версій для порівняння та завантаження їх у переглядач.
 */
@Composable
fun ProjectSaveHistoryDialog(
    projectName: String,
    currentRawJson: String?,
    onDismiss: () -> Unit,
    onLoadSnapshotToViewer: (snapshot: ProjectSaveSnapshot, content: String) -> Unit
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()

    var snapshots by remember { mutableStateOf<List<ProjectSaveSnapshot>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    val selectedIds = remember { mutableStateListOf<String>() }

    var diffLaunchData by remember { mutableStateOf<DiffLaunchData?>(null) }
    var snapshotToRename by remember { mutableStateOf<ProjectSaveSnapshot?>(null) }
    var renameText by remember { mutableStateOf("") }
    var snapshotToDelete by remember { mutableStateOf<ProjectSaveSnapshot?>(null) }
    var showCreateDialog by remember { mutableStateOf(false) }
    var newSnapshotLabel by remember { mutableStateOf("") }

    // Завантаження списку знімків
    fun refreshSnapshots() {
        isLoading = true
        coroutineScope.launch {
            snapshots = ProjectSaveSnapshotManager.getSnapshots(context, projectName)
            isLoading = false
        }
    }

    LaunchedEffect(projectName) {
        refreshSnapshots()
    }

    // Якщо відкрито Diff діалог
    if (diffLaunchData != null) {
        ProjectSaveDiffDialog(
            title1 = diffLaunchData!!.title1,
            date1 = diffLaunchData!!.date1,
            json1 = diffLaunchData!!.json1,
            title2 = diffLaunchData!!.title2,
            date2 = diffLaunchData!!.date2,
            json2 = diffLaunchData!!.json2,
            onDismiss = { diffLaunchData = null }
        )
    }

    // Діалог перейменування
    if (snapshotToRename != null) {
        AlertDialog(
            onDismissRequest = { snapshotToRename = null },
            title = { Text("Перейменувати збереження", color = Color.White) },
            text = {
                OutlinedTextField(
                    value = renameText,
                    onValueChange = { renameText = it },
                    label = { Text("Назва версії") },
                    singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White
                    )
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        val target = snapshotToRename ?: return@Button
                        coroutineScope.launch {
                            ProjectSaveSnapshotManager.renameSnapshot(context, projectName, target.id, renameText)
                            snapshotToRename = null
                            refreshSnapshots()
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = GlassIndigo)
                ) {
                    Text("Зберегти", color = Color.White)
                }
            },
            dismissButton = {
                TextButton(onClick = { snapshotToRename = null }) {
                    Text("Скасувати", color = GlassOnSurfaceVariant)
                }
            },
            containerColor = Color(0xFF13192B)
        )
    }

    // Діалог підтвердження видалення
    if (snapshotToDelete != null) {
        AlertDialog(
            onDismissRequest = { snapshotToDelete = null },
            title = { Text("Видалити збереження?", color = Color.White) },
            text = {
                Text(
                    "Ви впевнені, що хочете видалити версію \"${snapshotToDelete?.label}\"? Цю дію неможливо скасувати.",
                    color = GlassOnSurfaceVariant
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        val target = snapshotToDelete ?: return@Button
                        coroutineScope.launch {
                            ProjectSaveSnapshotManager.deleteSnapshot(context, projectName, target.id)
                            selectedIds.remove(target.id)
                            snapshotToDelete = null
                            refreshSnapshots()
                            Toast.makeText(context, "Збереження видалено", Toast.LENGTH_SHORT).show()
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = GlassError)
                ) {
                    Text("Видалити", color = Color.White)
                }
            },
            dismissButton = {
                TextButton(onClick = { snapshotToDelete = null }) {
                    Text("Скасувати", color = GlassOnSurfaceVariant)
                }
            },
            containerColor = Color(0xFF13192B)
        )
    }

    // Діалог швидкого створення нового збереження
    if (showCreateDialog) {
        AlertDialog(
            onDismissRequest = { showCreateDialog = false },
            title = { Text("Створити нове збереження", color = Color.White) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        "Зберегти поточний файл ${projectName}_save.json у внутрішній архів застосунку:",
                        color = GlassOnSurfaceVariant,
                        fontSize = 12.sp
                    )
                    OutlinedTextField(
                        value = newSnapshotLabel,
                        onValueChange = { newSnapshotLabel = it },
                        placeholder = { Text("Наприклад: Перед посадкою гарбузів") },
                        singleLine = true,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color.White
                        )
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        if (currentRawJson.isNullOrBlank()) {
                            Toast.makeText(context, "Поточний файл порожній", Toast.LENGTH_SHORT).show()
                            return@Button
                        }
                        coroutineScope.launch {
                            ProjectSaveSnapshotManager.saveSnapshot(
                                context = context,
                                projectName = projectName,
                                label = newSnapshotLabel,
                                jsonContent = currentRawJson
                            )
                            showCreateDialog = false
                            newSnapshotLabel = ""
                            refreshSnapshots()
                            Toast.makeText(context, "Версію успішно збережено!", Toast.LENGTH_SHORT).show()
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = GlassPrimary)
                ) {
                    Text("Зберегти", color = Color.White)
                }
            },
            dismissButton = {
                TextButton(onClick = { showCreateDialog = false }) {
                    Text("Скасувати", color = GlassOnSurfaceVariant)
                }
            },
            containerColor = Color(0xFF13192B)
        )
    }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Card(
            modifier = Modifier
                .fillMaxWidth(0.96f)
                .fillMaxHeight(0.92f)
                .padding(vertical = 12.dp),
            shape = RoundedCornerShape(24.dp),
            colors = CardDefaults.cardColors(containerColor = Color(0xFF0C101C)),
            border = BorderStroke(1.dp, GlassBorder),
            elevation = CardDefaults.cardElevation(defaultElevation = 16.dp)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(16.dp)
            ) {
                // ─── ШАПКА ───
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(36.dp)
                                .clip(RoundedCornerShape(10.dp))
                                .background(GlassGem.copy(alpha = 0.2f))
                                .border(1.dp, GlassGem.copy(alpha = 0.4f), RoundedCornerShape(10.dp)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.History,
                                contentDescription = null,
                                tint = GlassGem,
                                modifier = Modifier.size(20.dp)
                            )
                        }
                        Column {
                            Text(
                                text = "Версії ${projectName}_save.json",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                                color = Color.White
                            )
                            Text(
                                text = "Збережені копії та порівняння змін",
                                style = MaterialTheme.typography.bodySmall,
                                color = GlassOnSurfaceVariant,
                                fontSize = 11.sp
                            )
                        }
                    }

                    Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        IconButton(
                            onClick = { showCreateDialog = true },
                            modifier = Modifier
                                .size(32.dp)
                                .background(GlassPrimary.copy(alpha = 0.2f), CircleShape)
                        ) {
                            Icon(
                                imageVector = Icons.Default.BookmarkAdd,
                                contentDescription = "Зберегти поточну",
                                tint = GlassPrimaryLight,
                                modifier = Modifier.size(18.dp)
                            )
                        }

                        IconButton(
                            onClick = onDismiss,
                            modifier = Modifier
                                .size(32.dp)
                                .background(Color.White.copy(alpha = 0.06f), CircleShape)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Close,
                                contentDescription = "Закрити",
                                tint = Color.White.copy(alpha = 0.8f),
                                modifier = Modifier.size(18.dp)
                            )
                        }
                    }
                }

                Spacer(Modifier.height(12.dp))

                // ─── ПІДСКАЗКА ЩОДО ПОРІВНЯННЯ ───
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    color = GlassIndigo.copy(alpha = 0.12f),
                    border = BorderStroke(1.dp, GlassIndigo.copy(alpha = 0.3f))
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(
                            Icons.Default.Info,
                            contentDescription = null,
                            tint = GlassIndigoLight,
                            modifier = Modifier.size(16.dp)
                        )
                        Text(
                            text = when (selectedIds.size) {
                                0 -> "Виберіть 1 або 2 версії нижче для порівняння відмінностей."
                                1 -> "Обрано 1 версію. Можна порівняти її з поточним активним станом або обрати другу версію."
                                2 -> "Обрано 2 версії! Натисніть кнопку порівняння нижче."
                                else -> ""
                            },
                            fontSize = 11.sp,
                            color = Color.White.copy(alpha = 0.9f)
                        )
                    }
                }

                Spacer(Modifier.height(10.dp))

                // ─── СПИСОК ЗНІМКІВ ───
                if (isLoading) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .weight(1f),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator(color = GlassIndigoLight, modifier = Modifier.size(36.dp))
                    }
                } else if (snapshots.isEmpty()) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .weight(1f),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Icon(
                                Icons.Default.BookmarkBorder,
                                contentDescription = null,
                                tint = GlassOnSurfaceDim,
                                modifier = Modifier.size(48.dp)
                            )
                            Text(
                                text = "Немає збережених версій",
                                color = Color.White,
                                fontWeight = FontWeight.Bold,
                                fontSize = 15.sp
                            )
                            Text(
                                text = "Натисніть кнопку нижче, щоб зберегти поточний стан файлу для цього проекту.",
                                color = GlassOnSurfaceVariant,
                                fontSize = 12.sp,
                                modifier = Modifier.padding(horizontal = 24.dp)
                            )
                            Button(
                                onClick = { showCreateDialog = true },
                                colors = ButtonDefaults.buttonColors(containerColor = GlassPrimary),
                                shape = RoundedCornerShape(12.dp)
                            ) {
                                Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(16.dp))
                                Spacer(Modifier.width(6.dp))
                                Text("Зберегти поточну версію")
                            }
                        }
                    }
                } else {
                    val uniqueSnapshots = remember(snapshots) { snapshots.distinctBy { it.id } }
                    LazyColumn(
                        modifier = Modifier
                            .fillMaxWidth()
                            .weight(1f),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(uniqueSnapshots) { snapshot ->
                            val isSelected = selectedIds.contains(snapshot.id)
                            SnapshotItemCard(
                                snapshot = snapshot,
                                isSelected = isSelected,
                                onToggleSelect = {
                                    if (isSelected) {
                                        selectedIds.remove(snapshot.id)
                                    } else {
                                        if (selectedIds.size >= 2) {
                                            // Якщо вже було 2, знімаємо першу і додаємо нову
                                            selectedIds.removeAt(0)
                                        }
                                        selectedIds.add(snapshot.id)
                                    }
                                },
                                onOpenViewer = {
                                    coroutineScope.launch {
                                        val content = ProjectSaveSnapshotManager.loadSnapshotContent(context, projectName, snapshot.id)
                                        if (content != null) {
                                            onLoadSnapshotToViewer(snapshot, content)
                                            onDismiss()
                                        } else {
                                            Toast.makeText(context, "Не вдалося відкрити файл збереження", Toast.LENGTH_SHORT).show()
                                        }
                                    }
                                },
                                onRename = {
                                    snapshotToRename = snapshot
                                    renameText = snapshot.label
                                },
                                onDelete = {
                                    snapshotToDelete = snapshot
                                }
                            )
                        }
                    }
                }

                // ─── НИЖНЯ ПАНЕЛЬ ДІЙ (КНОПКА ПОРІВНЯННЯ) ───
                if (selectedIds.isNotEmpty()) {
                    Spacer(Modifier.height(10.dp))
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(14.dp),
                        colors = CardDefaults.cardColors(containerColor = GlassCardActive),
                        border = BorderStroke(1.dp, GlassIndigoLight.copy(alpha = 0.5f))
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(10.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                text = "Обрано: ${selectedIds.size} / 2",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color.White
                            )

                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                if (selectedIds.size == 1) {
                                    Button(
                                        onClick = {
                                            val sId = selectedIds[0]
                                            val s = snapshots.find { it.id == sId } ?: return@Button
                                            if (currentRawJson.isNullOrBlank()) {
                                                Toast.makeText(context, "Поточний файл порожній", Toast.LENGTH_SHORT).show()
                                                return@Button
                                            }
                                            coroutineScope.launch {
                                                val sJson = ProjectSaveSnapshotManager.loadSnapshotContent(context, projectName, s.id)
                                                if (sJson != null) {
                                                    diffLaunchData = DiffLaunchData(
                                                        title1 = s.label,
                                                        date1 = s.formattedDate,
                                                        json1 = sJson,
                                                        title2 = "Поточний активний стан",
                                                        date2 = "Зараз",
                                                        json2 = currentRawJson
                                                    )
                                                } else {
                                                    Toast.makeText(context, "Не вдалося відкрити файл збереження", Toast.LENGTH_SHORT).show()
                                                }
                                            }
                                        },
                                        colors = ButtonDefaults.buttonColors(containerColor = GlassIndigo),
                                        shape = RoundedCornerShape(10.dp),
                                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                                    ) {
                                        Icon(Icons.Default.Difference, contentDescription = null, modifier = Modifier.size(16.dp))
                                        Spacer(Modifier.width(6.dp))
                                        Text("Порівняти з поточним", fontSize = 12.sp)
                                    }
                                } else if (selectedIds.size == 2) {
                                    Button(
                                        onClick = {
                                            val s1 = snapshots.find { it.id == selectedIds[0] } ?: return@Button
                                            val s2 = snapshots.find { it.id == selectedIds[1] } ?: return@Button
                                            // Впорядковуємо: старіший знімок зліва (версія 1), новіший справа (версія 2)
                                            val (older, newer) = if (s1.timestamp <= s2.timestamp) Pair(s1, s2) else Pair(s2, s1)

                                            coroutineScope.launch {
                                                val json1 = ProjectSaveSnapshotManager.loadSnapshotContent(context, projectName, older.id)
                                                val json2 = ProjectSaveSnapshotManager.loadSnapshotContent(context, projectName, newer.id)
                                                if (json1 != null && json2 != null) {
                                                    diffLaunchData = DiffLaunchData(
                                                        title1 = older.label,
                                                        date1 = older.formattedDate,
                                                        json1 = json1,
                                                        title2 = newer.label,
                                                        date2 = newer.formattedDate,
                                                        json2 = json2
                                                    )
                                                } else {
                                                    Toast.makeText(context, "Не вдалося прочитати файли збережень", Toast.LENGTH_SHORT).show()
                                                }
                                            }
                                        },
                                        colors = ButtonDefaults.buttonColors(containerColor = GlassIndigo),
                                        shape = RoundedCornerShape(10.dp),
                                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                                    ) {
                                        Icon(Icons.Default.Difference, contentDescription = null, modifier = Modifier.size(16.dp))
                                        Spacer(Modifier.width(6.dp))
                                        Text("Порівняти 2 версії", fontSize = 12.sp)
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
private fun SnapshotItemCard(
    snapshot: ProjectSaveSnapshot,
    isSelected: Boolean,
    onToggleSelect: () -> Unit,
    onOpenViewer: () -> Unit,
    onRename: () -> Unit,
    onDelete: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onToggleSelect),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (isSelected) GlassIndigo.copy(alpha = 0.18f) else Color.White.copy(alpha = 0.04f)
        ),
        border = BorderStroke(
            1.dp,
            if (isSelected) GlassIndigoLight else Color.White.copy(alpha = 0.08f)
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            // Чекбокс вибору для порівняння
            Checkbox(
                checked = isSelected,
                onCheckedChange = { onToggleSelect() },
                colors = CheckboxDefaults.colors(
                    checkedColor = GlassIndigoLight,
                    uncheckedColor = Color.White.copy(alpha = 0.4f)
                ),
                modifier = Modifier.size(24.dp)
            )

            Spacer(Modifier.width(8.dp))

            // Інформація про знімок
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(2.dp)
            ) {
                Text(
                    text = snapshot.label,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Bold,
                    color = Color.White,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(
                        text = snapshot.formattedDate,
                        fontSize = 11.sp,
                        color = GlassOnSurfaceVariant
                    )
                    Text(
                        text = "•",
                        fontSize = 11.sp,
                        color = GlassOnSurfaceDim
                    )
                    Text(
                        text = snapshot.formattedSize,
                        fontSize = 11.sp,
                        color = GlassGem
                    )
                }
            }

            // Кнопки швидких дій
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                // Відкрити у переглядачі дерева
                IconButton(
                    onClick = onOpenViewer,
                    modifier = Modifier.size(30.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.RemoveRedEye,
                        contentDescription = "Переглянути в дереві",
                        tint = GlassPrimaryLight,
                        modifier = Modifier.size(16.dp)
                    )
                }

                // Перейменувати
                IconButton(
                    onClick = onRename,
                    modifier = Modifier.size(30.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Edit,
                        contentDescription = "Перейменувати",
                        tint = GlassOnSurfaceVariant,
                        modifier = Modifier.size(16.dp)
                    )
                }

                // Видалити
                IconButton(
                    onClick = onDelete,
                    modifier = Modifier.size(30.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Delete,
                        contentDescription = "Видалити",
                        tint = GlassError.copy(alpha = 0.8f),
                        modifier = Modifier.size(16.dp)
                    )
                }
            }
        }
    }
}
