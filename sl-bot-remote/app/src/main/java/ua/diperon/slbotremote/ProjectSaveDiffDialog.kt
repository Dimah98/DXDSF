package ua.diperon.slbotremote

import android.widget.Toast
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Difference
import androidx.compose.material.icons.filled.FilterAlt
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Tune
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import ua.diperon.slbotremote.ui.theme.*

/**
 * Діалогове вікно перегляду відмінностей між двома версіями збереження (Diff Viewer).
 */
@Composable
fun ProjectSaveDiffDialog(
    title1: String,
    date1: String? = null,
    json1: String,
    title2: String,
    date2: String? = null,
    json2: String,
    onDismiss: () -> Unit
) {
    val context = LocalContext.current
    val clipboardManager = LocalClipboardManager.current

    var ignoreTimestamps by remember { mutableStateOf(ProjectSaveIgnoreManager.isIgnoreTimestamps(context)) }
    var ignoreCoordinates by remember { mutableStateOf(ProjectSaveIgnoreManager.isIgnoreCoordinates(context)) }
    var ignoreSystem by remember { mutableStateOf(ProjectSaveIgnoreManager.isIgnoreSystem(context)) }
    var customPatterns by remember { mutableStateOf(ProjectSaveIgnoreManager.getCustomPatterns(context)) }
    var showIgnoreSettingsDialog by remember { mutableStateOf(false) }

    val activeIgnorePatterns = remember(ignoreTimestamps, ignoreCoordinates, ignoreSystem, customPatterns) {
        val set = mutableSetOf<String>()
        if (ignoreTimestamps) set.addAll(ProjectSaveIgnoreManager.TIMESTAMP_PATTERNS)
        if (ignoreCoordinates) set.addAll(ProjectSaveIgnoreManager.COORDINATE_PATTERNS)
        if (ignoreSystem) set.addAll(ProjectSaveIgnoreManager.SYSTEM_PATTERNS)
        set.addAll(customPatterns)
        set
    }

    var diffResult by remember(json1, json2, activeIgnorePatterns) { mutableStateOf<JsonDiffResult?>(null) }
    var isCalculating by remember(json1, json2, activeIgnorePatterns) { mutableStateOf(true) }

    LaunchedEffect(json1, json2, activeIgnorePatterns) {
        isCalculating = true
        diffResult = withContext(Dispatchers.Default) {
            JsonDiffEngine.compare(json1, json2, activeIgnorePatterns)
        }
        isCalculating = false
    }

    var searchQuery by remember { mutableStateOf("") }
    var selectedTypeFilter by remember { mutableStateOf<JsonDiffType?>(null) }
    var selectedCategory by remember { mutableStateOf<String?>(null) }

    val currentDiff = diffResult
    val filteredEntries = remember(currentDiff, searchQuery, selectedTypeFilter, selectedCategory) {
        if (currentDiff == null) return@remember emptyList()
        currentDiff.entries.filter { entry ->
            val matchesType = selectedTypeFilter == null || entry.diffType == selectedTypeFilter
            val matchesCategory = selectedCategory == null || entry.category.equals(selectedCategory, ignoreCase = true)
            val matchesSearch = searchQuery.isBlank() ||
                    entry.path.contains(searchQuery, ignoreCase = true) ||
                    (entry.oldValue?.contains(searchQuery, ignoreCase = true) == true) ||
                    (entry.newValue?.contains(searchQuery, ignoreCase = true) == true)
            matchesType && matchesCategory && matchesSearch
        }
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
                // ─── ВЕРХНЯ ПАНЕЛЬ (ШАПКА) ───
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
                                .background(GlassIndigo.copy(alpha = 0.2f))
                                .border(1.dp, GlassIndigo.copy(alpha = 0.4f), RoundedCornerShape(10.dp)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.Difference,
                                contentDescription = null,
                                tint = GlassIndigoLight,
                                modifier = Modifier.size(20.dp)
                            )
                        }
                        Column {
                            Text(
                                text = "Порівняння збережень",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                                color = Color.White
                            )
                            Text(
                                text = "Аналіз відмінностей у структурі save.json",
                                style = MaterialTheme.typography.bodySmall,
                                color = GlassOnSurfaceVariant,
                                fontSize = 11.sp
                            )
                        }
                    }

                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        val activeRuleCount = (if (ignoreTimestamps) 1 else 0) +
                                (if (ignoreCoordinates) 1 else 0) +
                                (if (ignoreSystem) 1 else 0) +
                                customPatterns.size

                        FilledTonalIconButton(
                            onClick = { showIgnoreSettingsDialog = true },
                            colors = IconButtonDefaults.filledTonalIconButtonColors(
                                containerColor = if (activeRuleCount > 0) GlassIndigo.copy(alpha = 0.25f) else Color.White.copy(alpha = 0.06f),
                                contentColor = if (activeRuleCount > 0) GlassIndigoLight else Color.White.copy(alpha = 0.8f)
                            ),
                            modifier = Modifier.size(32.dp)
                        ) {
                            BadgedBox(
                                badge = {
                                    if (activeRuleCount > 0) {
                                        Badge(
                                            containerColor = GlassIndigo,
                                            contentColor = Color.White
                                        ) {
                                            Text(activeRuleCount.toString(), fontSize = 9.sp)
                                        }
                                    }
                                }
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Tune,
                                    contentDescription = "Правила ігнорування",
                                    modifier = Modifier.size(17.dp)
                                )
                            }
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

                // ─── КАРТКА ПОРІВНЮВАНИХ ВЕРСІЙ (A ➔ B) ───
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(14.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White.copy(alpha = 0.04f)),
                    border = BorderStroke(1.dp, Color.White.copy(alpha = 0.08f))
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 12.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        // Версія 1 (Базова / Стара)
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = "Версія 1 (Було)",
                                fontSize = 10.sp,
                                color = GlassOnSurfaceDim,
                                fontWeight = FontWeight.SemiBold
                            )
                            Text(
                                text = title1,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color.White,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                            if (!date1.isNullOrBlank()) {
                                Text(
                                    text = date1,
                                    fontSize = 10.sp,
                                    color = GlassOnSurfaceVariant
                                )
                            }
                        }

                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowForward,
                            contentDescription = "до",
                            tint = GlassIndigoLight,
                            modifier = Modifier
                                .padding(horizontal = 8.dp)
                                .size(18.dp)
                        )

                        // Версія 2 (Порівнювана / Нова)
                        Column(
                            modifier = Modifier.weight(1f),
                            horizontalAlignment = Alignment.End
                        ) {
                            Text(
                                text = "Версія 2 (Стало)",
                                fontSize = 10.sp,
                                color = GlassOnSurfaceDim,
                                fontWeight = FontWeight.SemiBold
                            )
                            Text(
                                text = title2,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                color = GlassPrimaryLight,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                            if (!date2.isNullOrBlank()) {
                                Text(
                                    text = date2,
                                    fontSize = 10.sp,
                                    color = GlassOnSurfaceVariant
                                )
                            }
                        }
                    }
                }

                Spacer(Modifier.height(10.dp))

                if (isCalculating || currentDiff == null) {
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
                            CircularProgressIndicator(color = GlassIndigoLight, modifier = Modifier.size(36.dp))
                            Text(
                                text = "Порівняння файлів збереження...",
                                color = GlassOnSurfaceVariant,
                                fontSize = 12.sp
                            )
                        }
                    }
                } else {
                    // ─── ЛІЧИЛЬНИКИ ЗМІН (СТАТИСТИКА ТА ШВИДКИЙ ФІЛЬТР) ───
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        DiffStatChip(
                            label = "Всі (${currentDiff.totalCount})",
                            isSelected = selectedTypeFilter == null,
                            color = GlassIndigoLight,
                            onClick = { selectedTypeFilter = null },
                            modifier = Modifier.weight(1f)
                        )
                        DiffStatChip(
                            label = "~ Змінено (${currentDiff.modifiedCount})",
                            isSelected = selectedTypeFilter == JsonDiffType.MODIFIED,
                            color = GlassWarning,
                            onClick = {
                                selectedTypeFilter = if (selectedTypeFilter == JsonDiffType.MODIFIED) null else JsonDiffType.MODIFIED
                            },
                            modifier = Modifier.weight(1.1f)
                        )
                        DiffStatChip(
                            label = "+ Додано (${currentDiff.addedCount})",
                            isSelected = selectedTypeFilter == JsonDiffType.ADDED,
                            color = GlassSuccess,
                            onClick = {
                                selectedTypeFilter = if (selectedTypeFilter == JsonDiffType.ADDED) null else JsonDiffType.ADDED
                            },
                            modifier = Modifier.weight(1f)
                        )
                        DiffStatChip(
                            label = "- Видалено (${currentDiff.removedCount})",
                            isSelected = selectedTypeFilter == JsonDiffType.REMOVED,
                            color = GlassError,
                            onClick = {
                                selectedTypeFilter = if (selectedTypeFilter == JsonDiffType.REMOVED) null else JsonDiffType.REMOVED
                            },
                            modifier = Modifier.weight(1.1f)
                        )
                    }

                    Spacer(Modifier.height(8.dp))

                    // ─── ПОШУК ТА КАТЕГОРІЇ ───
                    OutlinedTextField(
                        value = searchQuery,
                        onValueChange = { searchQuery = it },
                        modifier = Modifier.fillMaxWidth(),
                        placeholder = {
                            Text(
                                "Пошук за шляхом, ключем або значенням...",
                                color = GlassOnSurfaceDim,
                                fontSize = 12.sp
                            )
                        },
                        leadingIcon = {
                            Icon(
                                Icons.Default.Search,
                                contentDescription = "Пошук",
                                tint = GlassOnSurfaceVariant,
                                modifier = Modifier.size(16.dp)
                            )
                        },
                        trailingIcon = {
                            if (searchQuery.isNotEmpty()) {
                                IconButton(onClick = { searchQuery = "" }, modifier = Modifier.size(24.dp)) {
                                Icon(Icons.Default.Clear, contentDescription = "Очистити", tint = Color.White, modifier = Modifier.size(14.dp))
                                }
                            }
                        },
                        singleLine = true,
                        shape = RoundedCornerShape(12.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedContainerColor = Color.White.copy(alpha = 0.05f),
                            unfocusedContainerColor = Color.White.copy(alpha = 0.03f),
                            focusedBorderColor = GlassIndigoLight,
                            unfocusedBorderColor = Color.White.copy(alpha = 0.12f),
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color.White
                        )
                    )

                    // Скрол категорій (якщо є різні розділи)
                    if (currentDiff.categories.isNotEmpty()) {
                        Spacer(Modifier.height(8.dp))
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .horizontalScroll(rememberScrollState()),
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            CategoryChip(
                                name = "Всі категорії",
                                count = currentDiff.totalCount,
                                isSelected = selectedCategory == null,
                                onClick = { selectedCategory = null }
                            )

                            currentDiff.categories.forEach { cat ->
                                val count = currentDiff.entries.count { it.category.equals(cat, ignoreCase = true) }
                                CategoryChip(
                                    name = cat,
                                    count = count,
                                    isSelected = selectedCategory.equals(cat, ignoreCase = true),
                                    onClick = {
                                        selectedCategory = if (selectedCategory.equals(cat, ignoreCase = true)) null else cat
                                    }
                                )
                            }
                        }
                    }

                    Spacer(Modifier.height(10.dp))

                    // ─── СПИСОК ВІДМІННОСТЕЙ ───
                    if (currentDiff.totalCount == 0) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .weight(1f),
                            contentAlignment = Alignment.Center
                        ) {
                            Column(
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.CheckCircle,
                                    contentDescription = null,
                                    tint = GlassSuccess,
                                    modifier = Modifier.size(48.dp)
                                )
                                Text(
                                    text = "Файли ідентичні!",
                                    style = MaterialTheme.typography.titleMedium,
                                    color = Color.White,
                                    fontWeight = FontWeight.Bold
                                )
                                Text(
                                    text = "Жодних відмінностей між обраними версіями не знайдено.",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = GlassOnSurfaceVariant
                                )
                            }
                        }
                    } else if (filteredEntries.isEmpty()) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .weight(1f),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = "За заданими фільтрами змін не знайдено",
                                color = GlassOnSurfaceVariant,
                                fontSize = 13.sp
                            )
                        }
                    } else {
                        LazyColumn(
                            modifier = Modifier
                                .fillMaxWidth()
                                .weight(1f),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            items(filteredEntries) { entry ->
                                DiffEntryCard(
                                    entry = entry,
                                    onCopyPath = {
                                        clipboardManager.setText(AnnotatedString(entry.path))
                                        Toast.makeText(context, "Шлях скопійовано: ${entry.path}", Toast.LENGTH_SHORT).show()
                                    },
                                    onIgnoreKey = { key ->
                                        if (ProjectSaveIgnoreManager.addCustomPattern(context, key)) {
                                            customPatterns = ProjectSaveIgnoreManager.getCustomPatterns(context)
                                            Toast.makeText(context, "Ключ '$key' додано в ігноровані", Toast.LENGTH_SHORT).show()
                                        } else {
                                            Toast.makeText(context, "Вже ігнорується", Toast.LENGTH_SHORT).show()
                                        }
                                    },
                                    onIgnorePath = { path ->
                                        if (ProjectSaveIgnoreManager.addCustomPattern(context, path)) {
                                            customPatterns = ProjectSaveIgnoreManager.getCustomPatterns(context)
                                            Toast.makeText(context, "Шлях додано в ігноровані", Toast.LENGTH_SHORT).show()
                                        } else {
                                            Toast.makeText(context, "Вже ігнорується", Toast.LENGTH_SHORT).show()
                                        }
                                    }
                                )
                            }
                        }
                    }
                }
            }
        }

        if (showIgnoreSettingsDialog) {
            IgnoreSettingsDialog(
                ignoreTimestamps = ignoreTimestamps,
                onToggleTimestamps = { enabled ->
                    ignoreTimestamps = enabled
                    ProjectSaveIgnoreManager.setIgnoreTimestamps(context, enabled)
                },
                ignoreCoordinates = ignoreCoordinates,
                onToggleCoordinates = { enabled ->
                    ignoreCoordinates = enabled
                    ProjectSaveIgnoreManager.setIgnoreCoordinates(context, enabled)
                },
                ignoreSystem = ignoreSystem,
                onToggleSystem = { enabled ->
                    ignoreSystem = enabled
                    ProjectSaveIgnoreManager.setIgnoreSystem(context, enabled)
                },
                customPatterns = customPatterns,
                onAddCustomPattern = { pattern ->
                    if (ProjectSaveIgnoreManager.addCustomPattern(context, pattern)) {
                        customPatterns = ProjectSaveIgnoreManager.getCustomPatterns(context)
                        Toast.makeText(context, "Правило додано", Toast.LENGTH_SHORT).show()
                    } else {
                        Toast.makeText(context, "Правило вже існує або порожнє", Toast.LENGTH_SHORT).show()
                    }
                },
                onRemoveCustomPattern = { pattern ->
                    if (ProjectSaveIgnoreManager.removeCustomPattern(context, pattern)) {
                        customPatterns = ProjectSaveIgnoreManager.getCustomPatterns(context)
                        Toast.makeText(context, "Правило видалено", Toast.LENGTH_SHORT).show()
                    }
                },
                onResetDefaults = {
                    ignoreTimestamps = true
                    ProjectSaveIgnoreManager.setIgnoreTimestamps(context, true)
                    ignoreCoordinates = false
                    ProjectSaveIgnoreManager.setIgnoreCoordinates(context, false)
                    ignoreSystem = true
                    ProjectSaveIgnoreManager.setIgnoreSystem(context, true)
                    Toast.makeText(context, "Скинуто до стандартних", Toast.LENGTH_SHORT).show()
                },
                onDismiss = { showIgnoreSettingsDialog = false }
            )
        }
    }
}

@Composable
private fun DiffStatChip(
    label: String,
    isSelected: Boolean,
    color: Color,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Surface(
        onClick = onClick,
        modifier = modifier,
        shape = RoundedCornerShape(10.dp),
        color = if (isSelected) color.copy(alpha = 0.25f) else Color.White.copy(alpha = 0.05f),
        border = BorderStroke(
            width = if (isSelected) 1.5.dp else 1.dp,
            color = if (isSelected) color else Color.White.copy(alpha = 0.1f)
        )
    ) {
        Box(
            modifier = Modifier.padding(vertical = 6.dp, horizontal = 4.dp),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = label,
                fontSize = 10.sp,
                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                color = if (isSelected) color else GlassOnSurfaceVariant,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}

@Composable
private fun CategoryChip(
    name: String,
    count: Int,
    isSelected: Boolean,
    onClick: () -> Unit
) {
    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(8.dp),
        color = if (isSelected) GlassGem.copy(alpha = 0.2f) else Color.White.copy(alpha = 0.04f),
        border = BorderStroke(
            1.dp,
            if (isSelected) GlassGem.copy(alpha = 0.6f) else Color.White.copy(alpha = 0.08f)
        )
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Text(
                text = name,
                fontSize = 11.sp,
                color = if (isSelected) GlassGem else GlassOnSurfaceVariant,
                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
            )
            Surface(
                shape = CircleShape,
                color = if (isSelected) GlassGem.copy(alpha = 0.3f) else Color.White.copy(alpha = 0.08f)
            ) {
                Text(
                    text = count.toString(),
                    fontSize = 9.sp,
                    color = if (isSelected) Color.White else GlassOnSurfaceDim,
                    modifier = Modifier.padding(horizontal = 4.dp, vertical = 1.dp),
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }
}

@Composable
private fun DiffEntryCard(
    entry: JsonDiffEntry,
    onCopyPath: () -> Unit,
    onIgnoreKey: ((String) -> Unit)? = null,
    onIgnorePath: ((String) -> Unit)? = null
) {
    var showMenu by remember { mutableStateOf(false) }

    val borderColor = when (entry.diffType) {
        JsonDiffType.ADDED -> GlassSuccess.copy(alpha = 0.35f)
        JsonDiffType.REMOVED -> GlassError.copy(alpha = 0.35f)
        JsonDiffType.MODIFIED -> GlassWarning.copy(alpha = 0.35f)
    }

    val typeBg = when (entry.diffType) {
        JsonDiffType.ADDED -> GlassSuccess.copy(alpha = 0.15f)
        JsonDiffType.REMOVED -> GlassError.copy(alpha = 0.15f)
        JsonDiffType.MODIFIED -> GlassWarning.copy(alpha = 0.15f)
    }

    val typeColor = when (entry.diffType) {
        JsonDiffType.ADDED -> GlassSuccess
        JsonDiffType.REMOVED -> GlassError
        JsonDiffType.MODIFIED -> GlassWarning
    }

    val typeLabel = when (entry.diffType) {
        JsonDiffType.ADDED -> "+ ДОДАНО"
        JsonDiffType.REMOVED -> "- ВИДАЛЕНО"
        JsonDiffType.MODIFIED -> "~ ЗМІНЕНО"
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White.copy(alpha = 0.035f)),
        border = BorderStroke(1.dp, borderColor)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(10.dp)
        ) {
            // Заголовок картки: Категорія + Ключ + Тип + Меню ігнорування
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    modifier = Modifier.weight(1f)
                ) {
                    Surface(
                        color = GlassGem.copy(alpha = 0.15f),
                        shape = RoundedCornerShape(6.dp),
                        border = BorderStroke(1.dp, GlassGem.copy(alpha = 0.3f))
                    ) {
                        Text(
                            text = entry.category,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            color = GlassGem,
                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                        )
                    }

                    Text(
                        text = entry.keyName.ifEmpty { entry.path },
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.Bold,
                        color = Color.White,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Surface(
                        color = typeBg,
                        shape = RoundedCornerShape(6.dp),
                        border = BorderStroke(1.dp, typeColor.copy(alpha = 0.4f))
                    ) {
                        Text(
                            text = typeLabel,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            color = typeColor,
                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                        )
                    }

                    if (onIgnoreKey != null || onIgnorePath != null) {
                        Box {
                            IconButton(
                                onClick = { showMenu = true },
                                modifier = Modifier.size(24.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.VisibilityOff,
                                    contentDescription = "Ігнорувати",
                                    tint = GlassOnSurfaceDim,
                                    modifier = Modifier.size(15.dp)
                                )
                            }

                            DropdownMenu(
                                expanded = showMenu,
                                onDismissRequest = { showMenu = false },
                                modifier = Modifier.background(Color(0xFF14192B))
                            ) {
                                if (entry.keyName.isNotBlank() && onIgnoreKey != null) {
                                    DropdownMenuItem(
                                        text = {
                                            Text(
                                                "Ігнорувати ключ '${entry.keyName}'",
                                                fontSize = 12.sp,
                                                color = Color.White
                                            )
                                        },
                                        leadingIcon = {
                                            Icon(
                                                imageVector = Icons.Default.VisibilityOff,
                                                contentDescription = null,
                                                tint = GlassIndigoLight,
                                                modifier = Modifier.size(16.dp)
                                            )
                                        },
                                        onClick = {
                                            showMenu = false
                                            onIgnoreKey(entry.keyName)
                                        }
                                    )
                                }
                                if (onIgnorePath != null) {
                                    DropdownMenuItem(
                                        text = {
                                            Text(
                                                "Ігнорувати точний шлях",
                                                fontSize = 12.sp,
                                                color = Color.White
                                            )
                                        },
                                        leadingIcon = {
                                            Icon(
                                                imageVector = Icons.Default.FilterAlt,
                                                contentDescription = null,
                                                tint = GlassIndigoLight,
                                                modifier = Modifier.size(16.dp)
                                            )
                                        },
                                        onClick = {
                                            showMenu = false
                                            onIgnorePath(entry.path)
                                        }
                                    )
                                }
                            }
                        }
                    }
                }
            }

            Spacer(Modifier.height(4.dp))

            // Повний шлях до параметра з можливістю скопіювати
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable(onClick = onCopyPath),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Text(
                    text = entry.path,
                    fontFamily = FontFamily.Monospace,
                    fontSize = 10.sp,
                    color = GlassOnSurfaceDim,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f)
                )
                Icon(
                    imageVector = Icons.Default.ContentCopy,
                    contentDescription = "Скопіювати шлях",
                    tint = GlassOnSurfaceDim,
                    modifier = Modifier.size(12.dp)
                )
            }

            Spacer(Modifier.height(8.dp))

            // Вміст значень (Було ➔ Стало)
            when (entry.diffType) {
                JsonDiffType.MODIFIED -> {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(Color.Black.copy(alpha = 0.25f), RoundedCornerShape(8.dp))
                            .padding(8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        // Старе значення
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = "Було",
                                fontSize = 9.sp,
                                color = GlassOnSurfaceDim
                            )
                            Text(
                                text = entry.oldValue ?: "null",
                                fontSize = 12.sp,
                                color = GlassError.copy(alpha = 0.85f),
                                textDecoration = TextDecoration.LineThrough,
                                fontFamily = FontFamily.Monospace,
                                maxLines = 3,
                                overflow = TextOverflow.Ellipsis
                            )
                        }

                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowForward,
                            contentDescription = null,
                            tint = GlassWarning,
                            modifier = Modifier
                                .padding(horizontal = 6.dp)
                                .size(16.dp)
                        )

                        // Нове значення
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = "Стало",
                                fontSize = 9.sp,
                                color = GlassOnSurfaceDim
                            )
                            Text(
                                text = entry.newValue ?: "null",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                color = GlassSuccessLight,
                                fontFamily = FontFamily.Monospace,
                                maxLines = 3,
                                overflow = TextOverflow.Ellipsis
                            )
                        }

                        // Різниця у числах (+250 або -15)
                        val deltaStr = entry.deltaFormatted
                        if (deltaStr != null) {
                            val isPos = (entry.numericDelta ?: 0.0) >= 0.0
                            Surface(
                                color = if (isPos) GlassSuccess.copy(alpha = 0.2f) else GlassError.copy(alpha = 0.2f),
                                shape = RoundedCornerShape(6.dp),
                                border = BorderStroke(1.dp, if (isPos) GlassSuccess.copy(alpha = 0.5f) else GlassError.copy(alpha = 0.5f)),
                                modifier = Modifier.padding(start = 6.dp)
                            ) {
                                Text(
                                    text = deltaStr,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = if (isPos) GlassSuccess else GlassError,
                                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 3.dp)
                                )
                            }
                        }
                    }
                }

                JsonDiffType.ADDED -> {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(GlassSuccess.copy(alpha = 0.08f), RoundedCornerShape(8.dp))
                            .border(1.dp, GlassSuccess.copy(alpha = 0.25f), RoundedCornerShape(8.dp))
                            .padding(8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "+ Нове значення: ",
                            fontSize = 11.sp,
                            color = GlassSuccessLight,
                            fontWeight = FontWeight.SemiBold
                        )
                        Text(
                            text = entry.newValue ?: "null",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White,
                            fontFamily = FontFamily.Monospace,
                            maxLines = 3,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }

                JsonDiffType.REMOVED -> {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(GlassError.copy(alpha = 0.08f), RoundedCornerShape(8.dp))
                            .border(1.dp, GlassError.copy(alpha = 0.25f), RoundedCornerShape(8.dp))
                            .padding(8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "- Видалено: ",
                            fontSize = 11.sp,
                            color = GlassError,
                            fontWeight = FontWeight.SemiBold
                        )
                        Text(
                            text = entry.oldValue ?: "null",
                            fontSize = 12.sp,
                            color = GlassOnSurfaceVariant,
                            textDecoration = TextDecoration.LineThrough,
                            fontFamily = FontFamily.Monospace,
                            maxLines = 3,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun IgnoreSettingsDialog(
    ignoreTimestamps: Boolean,
    onToggleTimestamps: (Boolean) -> Unit,
    ignoreCoordinates: Boolean,
    onToggleCoordinates: (Boolean) -> Unit,
    ignoreSystem: Boolean,
    onToggleSystem: (Boolean) -> Unit,
    customPatterns: Set<String>,
    onAddCustomPattern: (String) -> Unit,
    onRemoveCustomPattern: (String) -> Unit,
    onResetDefaults: () -> Unit,
    onDismiss: () -> Unit
) {
    var newPatternText by remember { mutableStateOf("") }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Card(
            modifier = Modifier
                .fillMaxWidth(0.94f)
                .fillMaxHeight(0.85f)
                .padding(vertical = 16.dp),
            shape = RoundedCornerShape(24.dp),
            colors = CardDefaults.cardColors(containerColor = Color(0xFF0F1424)),
            border = BorderStroke(1.dp, GlassBorder),
            elevation = CardDefaults.cardElevation(defaultElevation = 16.dp)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(18.dp)
            ) {
                // Шапка діалогу
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
                                .background(GlassIndigo.copy(alpha = 0.2f))
                                .border(1.dp, GlassIndigo.copy(alpha = 0.4f), RoundedCornerShape(10.dp)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.Tune,
                                contentDescription = null,
                                tint = GlassIndigoLight,
                                modifier = Modifier.size(20.dp)
                            )
                        }
                        Column {
                            Text(
                                text = "Правила ігнорування",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                                color = Color.White
                            )
                            Text(
                                text = "Виключення полів із порівняння збережень",
                                style = MaterialTheme.typography.bodySmall,
                                color = GlassOnSurfaceVariant,
                                fontSize = 11.sp
                            )
                        }
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

                Spacer(Modifier.height(14.dp))

                Column(
                    modifier = Modifier
                        .weight(1f)
                        .verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    // Секція: Стандартні пресети
                    Text(
                        text = "СТАНДАРТНІ ПРЕСЕТИ",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = GlassIndigoLight,
                        letterSpacing = 0.8.sp
                    )

                    IgnoreToggleItem(
                        title = "Мітки часу (*At, createdAt, readyAt...)",
                        subtitle = "Ігнорує дати дозрівання врожаю, таймери дій та оновлень",
                        checked = ignoreTimestamps,
                        onCheckedChange = onToggleTimestamps
                    )

                    IgnoreToggleItem(
                        title = "Координати (x, y, coordinates)",
                        subtitle = "Ігнорує переміщення та розміщення об'єктів на карті",
                        checked = ignoreCoordinates,
                        onCheckedChange = onToggleCoordinates
                    )

                    IgnoreToggleItem(
                        title = "Системні дані (sessionId, hash, version...)",
                        subtitle = "Ігнорує технічні поля сесії, хеші, версії та сповіщення",
                        checked = ignoreSystem,
                        onCheckedChange = onToggleSystem
                    )

                    HorizontalDivider(color = Color.White.copy(alpha = 0.08f), thickness = 1.dp)

                    // Секція: Користувацькі правила
                    Text(
                        text = "ВЛАСНІ ПРАВИЛА ТА ШЛЯХИ",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = GlassIndigoLight,
                        letterSpacing = 0.8.sp
                    )

                    Text(
                        text = "Введіть назву ключа (наприклад, 'Sunflower' або '*At') чи шлях (наприклад, 'inventory.Sunflower'):",
                        fontSize = 11.sp,
                        color = GlassOnSurfaceVariant
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        OutlinedTextField(
                            value = newPatternText,
                            onValueChange = { newPatternText = it },
                            modifier = Modifier.weight(1f),
                            placeholder = {
                                Text("Ключ, патерн або шлях...", color = GlassOnSurfaceDim, fontSize = 12.sp)
                            },
                            singleLine = true,
                            shape = RoundedCornerShape(12.dp),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedContainerColor = Color.White.copy(alpha = 0.05f),
                                unfocusedContainerColor = Color.White.copy(alpha = 0.03f),
                                focusedBorderColor = GlassIndigoLight,
                                unfocusedBorderColor = Color.White.copy(alpha = 0.12f),
                                focusedTextColor = Color.White,
                                unfocusedTextColor = Color.White
                            )
                        )

                        Button(
                            onClick = {
                                if (newPatternText.isNotBlank()) {
                                    onAddCustomPattern(newPatternText.trim())
                                    newPatternText = ""
                                }
                            },
                            enabled = newPatternText.isNotBlank(),
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = GlassIndigo,
                                contentColor = Color.White,
                                disabledContainerColor = Color.White.copy(alpha = 0.08f),
                                disabledContentColor = Color.White.copy(alpha = 0.3f)
                            ),
                            contentPadding = PaddingValues(horizontal = 14.dp, vertical = 12.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Add,
                                contentDescription = "Додати",
                                modifier = Modifier.size(18.dp)
                            )
                            Spacer(Modifier.width(4.dp))
                            Text("Додати", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                    }

                    // Список доданих користувацьких правил
                    if (customPatterns.isEmpty()) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(Color.White.copy(alpha = 0.03f), RoundedCornerShape(10.dp))
                                .padding(vertical = 12.dp, horizontal = 12.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = "Немає власних правил ігнорування",
                                color = GlassOnSurfaceDim,
                                fontSize = 11.sp
                            )
                        }
                    } else {
                        Column(
                            modifier = Modifier.fillMaxWidth(),
                            verticalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            customPatterns.sorted().forEach { pattern ->
                                CustomPatternChip(
                                    pattern = pattern,
                                    onDelete = { onRemoveCustomPattern(pattern) }
                                )
                            }
                        }
                    }
                }

                Spacer(Modifier.height(12.dp))

                // Нижня панель дій
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    TextButton(
                        onClick = onResetDefaults,
                        colors = ButtonDefaults.textButtonColors(contentColor = GlassOnSurfaceDim)
                    ) {
                        Icon(Icons.Default.Refresh, contentDescription = null, modifier = Modifier.size(14.dp))
                        Spacer(Modifier.width(4.dp))
                        Text("Скинути стандартні", fontSize = 11.sp)
                    }

                    Button(
                        onClick = onDismiss,
                        colors = ButtonDefaults.buttonColors(
                            containerColor = GlassIndigo,
                            contentColor = Color.White
                        ),
                        shape = RoundedCornerShape(12.dp),
                        contentPadding = PaddingValues(horizontal = 18.dp, vertical = 8.dp)
                    ) {
                        Text("Готово", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                    }
                }
            }
        }
    }
}

@Composable
private fun IgnoreToggleItem(
    title: String,
    subtitle: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit
) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        color = Color.White.copy(alpha = 0.035f),
        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.07f))
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clickable { onCheckedChange(!checked) }
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Column(
                modifier = Modifier
                    .weight(1f)
                    .padding(end = 12.dp)
            ) {
                Text(
                    text = title,
                    color = Color.White,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold
                )
                Spacer(Modifier.height(2.dp))
                Text(
                    text = subtitle,
                    color = GlassOnSurfaceVariant,
                    fontSize = 10.sp,
                    lineHeight = 14.sp
                )
            }

            Switch(
                checked = checked,
                onCheckedChange = onCheckedChange,
                colors = SwitchDefaults.colors(
                    checkedThumbColor = Color.White,
                    checkedTrackColor = GlassIndigo,
                    uncheckedThumbColor = Color.Gray,
                    uncheckedTrackColor = Color.White.copy(alpha = 0.1f)
                )
            )
        }
    }
}

@Composable
private fun CustomPatternChip(
    pattern: String,
    onDelete: () -> Unit
) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(10.dp),
        color = GlassIndigo.copy(alpha = 0.12f),
        border = BorderStroke(1.dp, GlassIndigo.copy(alpha = 0.3f))
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 10.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                text = pattern,
                fontFamily = FontFamily.Monospace,
                fontSize = 11.sp,
                color = Color.White,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f)
            )

            IconButton(
                onClick = onDelete,
                modifier = Modifier.size(24.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.Close,
                    contentDescription = "Видалити",
                    tint = GlassError.copy(alpha = 0.8f),
                    modifier = Modifier.size(16.dp)
                )
            }
        }
    }
}
