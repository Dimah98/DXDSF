
package ua.diperon.slbotremote

import android.app.Application
import android.util.Log
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.outlined.*
import androidx.compose.material.icons.filled.DoneAll
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.launch
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import ua.diperon.slbotremote.data.AppDatabase
import ua.diperon.slbotremote.data.CachedNotificationEntity
import java.text.SimpleDateFormat
import java.util.*
import ua.diperon.slbotremote.ui.theme.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.BorderStroke
import androidx.compose.ui.graphics.Color

class NotificationsViewModel(application: Application) : AndroidViewModel(application) {
    private val context = application.applicationContext
    private val configManager = ConnectionConfigManager(context)
    private val interceptor = DynamicBaseUrlInterceptor()
    private val apiService: BotApiService = BotApiService.create(interceptor)
    private val db = AppDatabase.getInstance(context)
    private val dao = db.dao()

    private val _notifications = MutableStateFlow<List<NotificationItem>>(emptyList())
    val notifications: StateFlow<List<NotificationItem>> = _notifications.asStateFlow()

    private val _unreadCount = MutableStateFlow(0)
    val unreadCount: StateFlow<Int> = _unreadCount.asStateFlow()

    private val _errorEvents = MutableSharedFlow<String>(extraBufferCapacity = 1)
    val errorEvents: SharedFlow<String> = _errorEvents.asSharedFlow()

    init {
        interceptor.setBaseUrl(configManager.getHttpUrl())
        loadCacheAndFetch()
    }

    private fun loadCacheAndFetch() {
        viewModelScope.launch {
            try {
                val cached = dao.observeNotifications().collect { list ->
                    _notifications.value = list.map {
                        NotificationItem(
                            id = it.id,
                            projectName = it.projectName,
                            message = it.message,
                            timestamp = it.timestamp,
                            read = it.read
                        )
                    }
                    _unreadCount.value = list.count { !it.read }
                }
            } catch (e: Exception) {
                Log.w("NotificationsVM", "Cache error: ${e.message}")
            }
            fetchNotifications()
        }
    }

    fun fetchNotifications() {
        viewModelScope.launch {
            try {
                val data = apiService.getNotifications()
                _notifications.value = data.notifications
                _unreadCount.value = data.unreadCount
                dao.insertNotifications(data.notifications.map {
                    CachedNotificationEntity(
                        id = it.id,
                        projectName = it.projectName,
                        message = it.message,
                        timestamp = it.timestamp,
                        read = it.read,
                        cachedAt = System.currentTimeMillis()
                    )
                })
            } catch (e: Exception) {
                Log.e("NotificationsVM", "Error fetching notifications: ${e.message}")
                _errorEvents.emit("Помилка сповіщень: ${e.localizedMessage}")
            }
        }
    }

    fun markAllAsRead() {
        viewModelScope.launch {
            try {
                apiService.markAllNotificationsRead()
                fetchNotifications()
            } catch (e: Exception) {
                Log.e("NotificationsVM", "Error marking all read: ${e.message}")
                _errorEvents.emit("Помилка: ${e.localizedMessage}")
            }
        }
    }

    fun markAsRead(id: String) {
        viewModelScope.launch {
            try {
                apiService.markNotificationRead(id)
                fetchNotifications()
            } catch (e: Exception) {
                Log.e("NotificationsVM", "Error marking read: ${e.message}")
                _errorEvents.emit("Помилка: ${e.localizedMessage}")
            }
        }
    }

    fun deleteNotification(id: String) {
        viewModelScope.launch {
            try {
                apiService.deleteNotification(id)
                fetchNotifications()
            } catch (e: Exception) {
                Log.e("NotificationsVM", "Error deleting: ${e.message}")
                _errorEvents.emit("Помилка: ${e.localizedMessage}")
            }
        }
    }

    fun deleteAllNotifications() {
        viewModelScope.launch {
            try {
                apiService.deleteAllNotifications()
                dao.clearNotifications()
                fetchNotifications()
            } catch (e: Exception) {
                Log.e("NotificationsVM", "Error deleting all: ${e.message}")
                _errorEvents.emit("Помилка: ${e.localizedMessage}")
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NotificationsScreen(
    onBackClick: () -> Unit,
    viewModel: NotificationsViewModel = viewModel()
) {
    val notifications by viewModel.notifications.collectAsState()
    val unreadCount by viewModel.unreadCount.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }
    var showDeleteConfirmDialog by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        viewModel.errorEvents.collect { message ->
            snackbarHostState.showSnackbar(message)
        }
    }

    if (showDeleteConfirmDialog) {
        AlertDialog(
            onDismissRequest = { showDeleteConfirmDialog = false },
            title = { Text("Очистити всі сповіщення?") },
            text = { Text("Ви впевнені, що хочете видалити всі збережені сповіщення?") },
            confirmButton = {
                TextButton(
                    onClick = {
                        showDeleteConfirmDialog = false
                        viewModel.deleteAllNotifications()
                    }
                ) {
                    Text("Видалити", color = Color(0xFFEF4444))
                }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteConfirmDialog = false }) {
                    Text("Скасувати")
                }
            }
        )
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        containerColor = GlassBg,
        topBar = {
            TopAppBar(
                title = { Text("Сповіщення (${unreadCount})") },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Назад"
                        )
                    }
                },
                actions = {
                    IconButton(onClick = { viewModel.markAllAsRead() }) {
                        Icon(
                            imageVector = Icons.Default.DoneAll,
                            contentDescription = "Прочитати все"
                        )
                    }
                    IconButton(onClick = { showDeleteConfirmDialog = true }) {
                        Icon(
                            imageVector = Icons.Default.Delete,
                            contentDescription = "Видалити всі сповіщення",
                            tint = Color(0xFFEF4444)
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = GlassBg.copy(alpha = 0.85f)
                )
            )
        }
    ) { paddingValues ->
        LazyColumn(
            modifier = Modifier.padding(paddingValues),
            contentPadding = PaddingValues(8.dp)
        ) {
            items(notifications) { notification ->
                Card(
                    modifier = Modifier
                        .padding(vertical = 4.dp)
                        .fillMaxWidth(),
                    shape = RoundedCornerShape(24.dp),
                    colors = CardDefaults.cardColors(
                        containerColor = if (notification.read) Color.White.copy(alpha = 0.06f)
                        else GlassIndigo.copy(alpha = 0.1f)
                    ),
                    border = BorderStroke(1.dp, Color.White.copy(alpha = 0.12f))
                ) {
                    Row(
                        modifier = Modifier
                            .padding(12.dp)
                            .fillMaxWidth(),
                        verticalAlignment = androidx.compose.ui.Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = notification.projectName,
                                style = MaterialTheme.typography.labelMedium
                            )
                            Text(
                                text = notification.message,
                                style = MaterialTheme.typography.bodyMedium
                            )
                            Text(
                                text = SimpleDateFormat("dd.MM HH:mm", Locale.getDefault())
                                    .format(Date(notification.timestamp)),
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                        IconButton(onClick = { viewModel.deleteNotification(notification.id) }) {
                            Icon(
                                imageVector = Icons.Outlined.Delete,
                                contentDescription = "Видалити",
                                tint = GlassError
                            )
                        }
                    }
                }
            }
            if (notifications.isEmpty()) {
                item {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(32.dp),
                        contentAlignment = androidx.compose.ui.Alignment.Center
                    ) {
                        Text("Немає сповіщень", style = MaterialTheme.typography.bodyLarge)
                    }
                }
            }
        }
    }
}
