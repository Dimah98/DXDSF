package ua.diperon.slbotremote.data

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "cached_deliveries")
data class CachedDeliveryEntity(
    @PrimaryKey val projectName: String,
    val dataJson: String = "[]",
    val cachedAt: Long = System.currentTimeMillis()
)
