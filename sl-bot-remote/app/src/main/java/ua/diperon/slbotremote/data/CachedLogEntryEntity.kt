package ua.diperon.slbotremote.data

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "cached_logs")
data class CachedLogEntryEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val projectName: String = "",
    val text: String = "",
    val type: String = "info",
    val timestamp: String = "",
    val cachedAt: Long = System.currentTimeMillis()
)
