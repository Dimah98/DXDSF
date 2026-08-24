package ua.diperon.slbotremote.data

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "cached_project_stats")
data class CachedProjectStatsEntity(
    @PrimaryKey val projectName: String,
    val totalRuns: Int = 0,
    val successfulRuns: Int = 0,
    val failedRuns: Int = 0,
    val lastRunTime: String? = null,
    val cachedAt: Long = System.currentTimeMillis()
)
