package ua.diperon.slbotremote.data

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface AppDao {

    @Query("SELECT * FROM cached_projects")
    fun observeProjects(): Flow<List<CachedProjectEntity>>

    @Query("SELECT * FROM cached_projects")
    suspend fun getProjects(): List<CachedProjectEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertProjects(items: List<CachedProjectEntity>)

    @Query("DELETE FROM cached_projects")
    suspend fun clearProjects()

    @Query("SELECT * FROM cached_project_stats WHERE projectName = :name")
    suspend fun getProjectStats(name: String): CachedProjectStatsEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertProjectStats(item: CachedProjectStatsEntity)

    @Query("SELECT * FROM cached_global_stats WHERE id = 1")
    suspend fun getGlobalStats(): CachedGlobalStatsEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertGlobalStats(item: CachedGlobalStatsEntity)

    @Query("SELECT * FROM cached_inventories WHERE projectName = :name")
    suspend fun getInventory(name: String): CachedInventoryEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertInventory(item: CachedInventoryEntity)

    @Query("SELECT * FROM cached_notifications ORDER BY timestamp DESC")
    fun observeNotifications(): Flow<List<CachedNotificationEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertNotifications(items: List<CachedNotificationEntity>)

    @Query("DELETE FROM cached_notifications")
    suspend fun clearNotifications()

    @Query("SELECT * FROM cached_schedules")
    suspend fun getSchedules(): List<CachedScheduleEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertSchedules(items: List<CachedScheduleEntity>)

    @Query("DELETE FROM cached_schedules")
    suspend fun clearSchedules()

    @Query("SELECT * FROM cached_logs WHERE projectName = :name ORDER BY id DESC LIMIT 200")
    suspend fun getLogs(name: String): List<CachedLogEntryEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertLogs(items: List<CachedLogEntryEntity>)

    @Query("DELETE FROM cached_logs WHERE projectName = :name")
    suspend fun clearLogs(name: String)

    @Query("SELECT * FROM cached_deliveries WHERE projectName = :name")
    suspend fun getDeliveries(name: String): CachedDeliveryEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertDeliveries(items: List<CachedDeliveryEntity>)
}
