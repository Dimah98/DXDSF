package ua.diperon.slbotremote.data

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "cached_global_stats")
data class CachedGlobalStatsEntity(
    @PrimaryKey val id: Int = 1,
    val totalRuns: Int = 0,
    val successfulRuns: Int = 0,
    val failedRuns: Int = 0,
    val activeBots: Int = 0,
    val cachedAt: Long = System.currentTimeMillis()
)
