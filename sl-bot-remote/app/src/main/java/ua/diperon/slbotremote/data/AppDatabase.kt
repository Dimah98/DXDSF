package ua.diperon.slbotremote.data

import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import android.content.Context

@Database(
    entities = [
        CachedProjectEntity::class,
        CachedProjectStatsEntity::class,
        CachedGlobalStatsEntity::class,
        CachedInventoryEntity::class,
        CachedNotificationEntity::class,
        CachedScheduleEntity::class,
        CachedLogEntryEntity::class,
        CachedDeliveryEntity::class
    ],
    version = 6,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun dao(): AppDao

    companion object {
        @Volatile
        private var INSTANCE: AppDatabase? = null

        fun getInstance(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "sl_bot_remote_cache.db"
                )
                .fallbackToDestructiveMigration(true)
                .build().also { INSTANCE = it }
            }
        }
    }
}
