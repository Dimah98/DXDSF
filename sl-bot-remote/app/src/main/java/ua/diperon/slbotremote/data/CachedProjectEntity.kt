package ua.diperon.slbotremote.data

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "cached_projects")
data class CachedProjectEntity(
    @PrimaryKey val name: String,
    val isRunning: Boolean = false,
    val isBrowserOpen: Boolean = false,
    val activeNodeTitle: String? = null,
    val nextRun: Long? = null,
    val plannedNodeRun: Long? = null,
    val miniImagesJson: String = "[]",
    val level: Int? = null,
    val gold: Double? = null,
    val balance: Double? = null,
    val gem: Double? = null,
    val isFullMoon: Boolean = false,
    val season: String? = null,
    val hasChestCollectedToday: Boolean = false,
    val hasShipmentRestockedToday: Boolean = false,
    val hasPetalPuzzleSolvedToday: Boolean = false,
    val cachedAt: Long = System.currentTimeMillis()
)
