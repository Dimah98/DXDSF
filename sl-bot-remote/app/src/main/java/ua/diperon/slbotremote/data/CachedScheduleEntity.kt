package ua.diperon.slbotremote.data

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "cached_schedules")
data class CachedScheduleEntity(
    @PrimaryKey val projectName: String,
    val mode: String = "none",
    val nextRun: Long? = null,
    val lastRun: Long = 0,
    val settingsJson: String = "{}",
    val plannedRunsJson: String = "[]",
    val cachedAt: Long = System.currentTimeMillis()
)
