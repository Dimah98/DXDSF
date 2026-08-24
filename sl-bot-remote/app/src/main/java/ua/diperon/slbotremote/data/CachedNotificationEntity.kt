package ua.diperon.slbotremote.data

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "cached_notifications")
data class CachedNotificationEntity(
    @PrimaryKey val id: String,
    val projectName: String = "",
    val message: String = "",
    val timestamp: Long = 0,
    val read: Boolean = false,
    val cachedAt: Long = System.currentTimeMillis()
)
