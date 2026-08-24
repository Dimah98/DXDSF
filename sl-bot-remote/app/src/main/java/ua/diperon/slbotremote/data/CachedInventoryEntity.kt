package ua.diperon.slbotremote.data

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "cached_inventories")
data class CachedInventoryEntity(
    @PrimaryKey val projectName: String,
    val itemsJson: String = "[]",
    val variablesJson: String = "{}",
    val cachedAt: Long = System.currentTimeMillis()
)
