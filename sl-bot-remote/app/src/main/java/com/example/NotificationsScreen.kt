package com.example

import android.app.Application
import android.util.Log
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.DoneAll
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

/**
 * ViewModel для панелі сповіщень.
 */
class NotificationsViewModel(application: Application) : AndroidViewModel(application) {
    private val context = application.applicationContext
    private val configManager = ConnectionConfigManager(context)
    private var apiService: BotApiService? = null

    private val _notifications = MutableStateFlow<List<NotificationItem>>(emptyList())
    val notifications: StateFlow<List<NotificationItem>> = _notifications.asStateFlow()

    private val _unreadCount = MutableStateFlow(0)
    val unreadCount: StateFlow<Int> = _unreadCount.asStateFlow()

    init {
        val url = configManager.getHttpUrl()
        apiService = BotApiService.create(url)
        fetchNotifications()
    }

    /**
     * Отримує список сповіщень.
     */
    fun fetchNotifications() {
        val service = apiService ?: return
        viewModelScope.launch {
            try {
                val data = service.getNotifications()
                _notifications.value = data.notifications
                _unreadCount.value = data.unreadCount
            } catch (e: Exception) {
                Log.e("NotificationsVM", "Error fetching notifications: ${e.message}")
            }
        }
    }

    /**
     * Позначає всі сповіщення прочитаними.
     */
    fun markAllAsRead() {
        val service = apiService ?: return
        viewModelScope.launch {
            try {
                service.markAllNotificationsRead()
                fetchNotifications() // Оновлення списку
            } catch (e: Exception) {
                Log.e("NotificationsVM", "Error marking all read: ${e.message}")
            }
        }
    }

    /**
     * Позначає одне сповіщення прочитаним.
     */
    fun markAsRead(id: String) {
        val service = apiService ?: return
        viewModelScope.launch {
            try {
                service.markNotificationRead(id)
                fetchNotifications()
            } catch (e: Exception) {
                Log.e("NotificationsVM", "Error marking read: ${e.message}")
            }
        }
    }

    /**
     * Видаляє сповіщення.
     */
    fun deleteNotification(id: String) {
        val service = apiService ?: return
        viewModelScope.launch {
            try {
                service.deleteNotification(id)
                fetchNotifications()
            } catch (e: Exception) {
                Log.e("NotificationsVM", "Error deleting notification: ${e.message}")
            }
        }
    }
}

/**
 * Екран сповіщень.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NotificationsScreen(onBackClick: () -> Unit) {
    val viewModel: NotificationsViewModel = viewModel()
    val notifications by viewModel.notifications.collectAsState()

    // Автоматичне оновлення кожні 5 секунд
    LaunchedEffect(Unit) {
        while (true) {
            delay(5000)
            viewModel.fetchNotifications()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                modifier = androidx.compose.ui.Modifier.height(42.dp),
                
                title = {
                    Text(
                        "Сповіщення", // Назва екрану
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Назад", // Перекладено
                            tint = Color.White
                        )
                    }
                },
                actions = {
                    IconButton(onClick = { viewModel.markAllAsRead() }) {
                        Icon(
                            imageVector = Icons.Default.DoneAll,
                            contentDescription = "Позначити всі прочитаними", // Перекладено
                            tint = MaterialTheme.colorScheme.primary
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Color(0xFF14161B) // Темний фон
                )
            )
        },
        containerColor = Color(0xFF0A0C10) // Темний фон екрану
    ) { padding ->
        if (notifications.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text(
                    text = "Немає нових сповіщень", // Перекладено
                    color = Color.White.copy(alpha = 0.4f)
                )
            }
        } else {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .padding(horizontal = 16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                item { Spacer(modifier = Modifier.height(8.dp)) }
                items(notifications, key = { it.id }) { notification ->
                    NotificationItemCard(
                        notification = notification,
                        onMarkRead = { if (!notification.read) viewModel.markAsRead(notification.id) },
                        onDelete = { viewModel.deleteNotification(notification.id) }
                    )
                }
                item { Spacer(modifier = Modifier.height(16.dp)) }
            }
        }
    }
}

/**
 * Картка сповіщення.
 */
@Composable
fun NotificationItemCard(
    notification: NotificationItem,
    onMarkRead: () -> Unit,
    onDelete: () -> Unit
) {
    val bgColor = if (!notification.read) Color(0xFFD97706).copy(alpha = 0.15f) else Color(0xFF1C1F26)
    val iconColor = if (!notification.read) Color(0xFFF59E0B) else Color.White.copy(alpha = 0.4f)

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onMarkRead),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = bgColor)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.Top
        ) {
            // Іконка
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(CircleShape)
                    .background(iconColor.copy(alpha = 0.2f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.Notifications,
                    contentDescription = null,
                    tint = iconColor,
                    modifier = Modifier.size(20.dp)
                )
            }

            Spacer(modifier = Modifier.width(12.dp))

            // Текст
            Column(modifier = Modifier.weight(1f)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = notification.projectName, // Проект
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                    
                    val sdf = SimpleDateFormat("HH:mm", Locale.getDefault())
                    val timeStr = sdf.format(Date(notification.timestamp))
                    Text(
                        text = timeStr, // Час
                        style = MaterialTheme.typography.labelSmall,
                        color = Color.White.copy(alpha = 0.5f)
                    )
                }
                
                Spacer(modifier = Modifier.height(4.dp))
                
                Text(
                    text = notification.message, // Повідомлення
                    style = MaterialTheme.typography.bodySmall,
                    color = Color.White.copy(alpha = 0.8f),
                    lineHeight = 16.sp
                )
            }

            Spacer(modifier = Modifier.width(8.dp))

            // Видалення
            IconButton(
                onClick = onDelete,
                modifier = Modifier.size(24.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.Delete,
                    contentDescription = "Видалити", // Перекладено
                    tint = Color.White.copy(alpha = 0.3f),
                    modifier = Modifier.size(16.dp)
                )
            }
        }
    }
}

