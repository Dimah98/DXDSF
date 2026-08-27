package ua.diperon.slbotremote

import android.graphics.Bitmap
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items as columnItems
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import ua.diperon.slbotremote.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MultiStreamWallScreen(
    viewModel: MultiStreamViewModel,
    apiService: BotApiService?,
    onBackClick: () -> Unit,
    onNavigateToMonitor: (String) -> Unit
) {
    val gridMode by viewModel.gridMode.collectAsStateWithLifecycle()
    val allProjects by viewModel.allProjects.collectAsStateWithLifecycle()
    val slots by viewModel.slots.collectAsStateWithLifecycle()

    var showProjectPickerSlot by remember { mutableStateOf<Int?>(null) }
    var showMenu by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        viewModel.loadProjects(apiService)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            text = "Відеостіна ботів",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                        Text(
                            text = "${gridMode.title} • ${slots.take(gridMode.capacity).count { it.isRunning }} активних",
                            style = MaterialTheme.typography.labelSmall,
                            color = GlassOnSurfaceDim
                        )
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Назад",
                            tint = Color.White
                        )
                    }
                },
                actions = {
                    // Refresh Active Browsers
                    IconButton(onClick = { viewModel.loadProjects(apiService) }) {
                        Icon(
                            imageVector = Icons.Default.Refresh,
                            contentDescription = "Оновити активні",
                            tint = Color(0xFF38BDF8)
                        )
                    }

                    // Grid Mode Switch Button
                    IconButton(onClick = {
                        val nextMode = when (gridMode) {
                            WallGridMode.GRID_2X2 -> WallGridMode.GRID_3X3
                            WallGridMode.GRID_3X3 -> WallGridMode.GRID_1X2
                            WallGridMode.GRID_1X2 -> WallGridMode.GRID_2X2
                        }
                        viewModel.setGridMode(nextMode)
                    }) {
                        Icon(
                            imageVector = when (gridMode) {
                                WallGridMode.GRID_2X2 -> Icons.Default.GridView
                                WallGridMode.GRID_3X3 -> Icons.Default.Apps
                                WallGridMode.GRID_1X2 -> Icons.Default.ViewAgenda
                            },
                            contentDescription = "Режим сітки",
                            tint = Color.White
                        )
                    }

                    // Overflow Menu
                    Box {
                        IconButton(onClick = { showMenu = true }) {
                            Icon(
                                imageVector = Icons.Default.MoreVert,
                                contentDescription = "Меню",
                                tint = Color.White
                            )
                        }
                        DropdownMenu(
                            expanded = showMenu,
                            onDismissRequest = { showMenu = false },
                            modifier = Modifier.background(GlassBgGradientEnd)
                        ) {
                            DropdownMenuItem(
                                text = { Text("▶ Запустити всі на екрані", color = Color(0xFF22C55E)) },
                                onClick = {
                                    viewModel.startAllVisibleBots()
                                    showMenu = false
                                }
                            )
                            DropdownMenuItem(
                                text = { Text("⏹ Зупинити всі на екрані", color = Color(0xFFEF4444)) },
                                onClick = {
                                    viewModel.stopAllVisibleBots()
                                    showMenu = false
                                }
                            )
                            HorizontalDivider(color = Color.White.copy(alpha = 0.1f))
                            DropdownMenuItem(
                                text = { Text("📡 Увімкнути всі стріми", color = Color.White) },
                                onClick = {
                                    viewModel.resumeAllStreams()
                                    showMenu = false
                                }
                            )
                            DropdownMenuItem(
                                text = { Text("⏸ Призупинити всі стріми", color = GlassOnSurfaceDim) },
                                onClick = {
                                    viewModel.pauseAllStreams()
                                    showMenu = false
                                }
                            )
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = GlassBg,
                    titleContentColor = Color.White
                )
            )
        },
        containerColor = GlassBg
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(8.dp)
        ) {
            val visibleSlots = slots.take(gridMode.capacity)

            LazyVerticalGrid(
                columns = GridCells.Fixed(gridMode.cols),
                modifier = Modifier.fillMaxSize(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(visibleSlots, key = { it.slotIndex }) { slot ->
                    StreamSlotCell(
                        slot = slot,
                        onSelectProjectClick = { showProjectPickerSlot = slot.slotIndex },
                        onToggleBot = { viewModel.toggleBot(slot.slotIndex) },
                        onToggleStream = { viewModel.toggleStream(slot.slotIndex) },
                        onOpenFullscreen = {
                            if (slot.projectName.isNotBlank()) {
                                onNavigateToMonitor(slot.projectName)
                            }
                        }
                    )
                }
            }
        }
    }

    // Project Picker Dialog
    showProjectPickerSlot?.let { slotIndex ->
        AlertDialog(
            onDismissRequest = { showProjectPickerSlot = null },
            title = { Text("Вибір бота для слота #${slotIndex + 1}", color = Color.White) },
            text = {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(max = 350.dp)
                ) {
                    if (allProjects.isEmpty()) {
                        Text("Немає доступних проектів", color = GlassOnSurfaceDim)
                    } else {
                        LazyColumn(
                            verticalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            columnItems(allProjects) { pName ->
                                val isSelected = slots.getOrNull(slotIndex)?.projectName == pName
                                Surface(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clickable {
                                            viewModel.selectProjectForSlot(slotIndex, pName)
                                            showProjectPickerSlot = null
                                        },
                                    shape = RoundedCornerShape(8.dp),
                                    color = if (isSelected) MaterialTheme.colorScheme.primary.copy(alpha = 0.2f) else Color.Transparent,
                                    border = if (isSelected) BorderStroke(1.dp, MaterialTheme.colorScheme.primary) else null
                                ) {
                                    Text(
                                        text = pName,
                                        color = if (isSelected) MaterialTheme.colorScheme.primary else Color.White,
                                        modifier = Modifier.padding(12.dp),
                                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
                                    )
                                }
                            }
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { showProjectPickerSlot = null }) {
                    Text("Закрити", color = MaterialTheme.colorScheme.primary)
                }
            },
            containerColor = GlassBgGradientEnd
        )
    }
}

@Composable
private fun StreamSlotCell(
    slot: StreamSlotData,
    onSelectProjectClick: () -> Unit,
    onToggleBot: () -> Unit,
    onToggleStream: () -> Unit,
    onOpenFullscreen: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .aspectRatio(16f / 11f),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White.copy(alpha = 0.05f)),
        border = BorderStroke(
            1.dp,
            if (slot.isRunning) Color(0xFF22C55E).copy(alpha = 0.6f)
            else Color.White.copy(alpha = 0.12f)
        )
    ) {
        if (slot.projectName.isBlank()) {
            // Empty Slot Placeholder
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .clickable(onClick = onSelectProjectClick),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(
                        imageVector = Icons.Default.Add,
                        contentDescription = null,
                        tint = GlassOnSurfaceDim,
                        modifier = Modifier.size(32.dp)
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "Додати бота",
                        style = MaterialTheme.typography.bodySmall,
                        color = GlassOnSurfaceDim
                    )
                }
            }
        } else {
            // Active Slot Content
            Box(modifier = Modifier.fillMaxSize()) {
                // Live Frame or Placeholder
                val frame = slot.frameBitmap
                if (slot.isStreaming && frame != null && !frame.isRecycled) {
                    Image(
                        bitmap = frame.asImageBitmap(),
                        contentDescription = slot.projectName,
                        modifier = Modifier
                            .fillMaxSize()
                            .clip(RoundedCornerShape(14.dp)),
                        contentScale = ContentScale.Crop
                    )
                } else {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .background(Color.Black.copy(alpha = 0.4f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(
                                imageVector = if (slot.isStreaming) Icons.Default.Tv else Icons.Default.TvOff,
                                contentDescription = null,
                                tint = Color.White.copy(alpha = 0.2f),
                                modifier = Modifier.size(24.dp)
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = when {
                                    slot.isStreaming -> "Очікування кадру..."
                                    slot.isBrowserOpen -> "Браузер відкрито"
                                    slot.isRunning -> "Бот працює"
                                    else -> "Браузер закрито"
                                },
                                style = MaterialTheme.typography.labelSmall,
                                color = Color.White.copy(alpha = 0.5f),
                                fontSize = 10.sp
                            )
                        }
                    }
                }

                // Top Header Badge
                Surface(
                    modifier = Modifier
                        .fillMaxWidth()
                        .align(Alignment.TopCenter),
                    color = Color.Black.copy(alpha = 0.75f)
                ) {
                    Row(
                        modifier = Modifier
                            .padding(horizontal = 6.dp, vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier
                                .weight(1f)
                                .clickable(onClick = onSelectProjectClick)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(7.dp)
                                    .clip(CircleShape)
                                    .background(
                                        if (slot.isRunning) Color(0xFF22C55E)
                                        else Color(0xFF94A3B8)
                                    )
                            )
                            Spacer(modifier = Modifier.width(5.dp))
                            Text(
                                text = slot.projectName,
                                style = MaterialTheme.typography.labelMedium,
                                fontWeight = FontWeight.Bold,
                                color = Color.White,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                        }

                        if (!slot.activeNodeTitle.isNullOrBlank()) {
                            Text(
                                text = slot.activeNodeTitle,
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.primary,
                                fontSize = 9.sp,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                                modifier = Modifier.padding(start = 4.dp)
                            )
                        }
                    }
                }

                // Bottom Control Bar
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .align(Alignment.BottomCenter)
                        .background(Color.Black.copy(alpha = 0.7f))
                        .padding(horizontal = 4.dp, vertical = 2.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // Bot Start/Stop
                    IconButton(
                        onClick = onToggleBot,
                        modifier = Modifier.size(26.dp)
                    ) {
                        Icon(
                            imageVector = if (slot.isRunning) Icons.Default.Stop else Icons.Default.PlayArrow,
                            contentDescription = if (slot.isRunning) "Зупинити" else "Запустити",
                            tint = if (slot.isRunning) Color(0xFFEF4444) else Color(0xFF22C55E),
                            modifier = Modifier.size(16.dp)
                        )
                    }

                    // Stream Toggle
                    IconButton(
                        onClick = onToggleStream,
                        modifier = Modifier.size(26.dp)
                    ) {
                        Icon(
                            imageVector = if (slot.isStreaming) Icons.Default.Videocam else Icons.Default.VideocamOff,
                            contentDescription = "Стрім",
                            tint = if (slot.isStreaming) MaterialTheme.colorScheme.primary else GlassOnSurfaceDim,
                            modifier = Modifier.size(16.dp)
                        )
                    }

                    // Fullscreen Zoom
                    IconButton(
                        onClick = onOpenFullscreen,
                        modifier = Modifier.size(26.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Fullscreen,
                            contentDescription = "На весь екран",
                            tint = Color.White,
                            modifier = Modifier.size(16.dp)
                        )
                    }
                }
            }
        }
    }
}
