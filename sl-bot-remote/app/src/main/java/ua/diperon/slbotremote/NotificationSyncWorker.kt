package ua.diperon.slbotremote

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import java.util.concurrent.TimeUnit

class NotificationSyncWorker(
    private val context: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(context, workerParams) {

    companion object {
        private const val TAG = "NotificationSyncWorker"
        private const val CHANNEL_ID = "bot_alerts_channel"
        private const val WORK_NAME = "BotNotificationPeriodicSync"
        private const val PREFS_NAME = "notification_worker_prefs"
        private const val KEY_LAST_TIMESTAMP = "last_notified_timestamp"

        fun schedule(context: Context) {
            val workRequest = PeriodicWorkRequestBuilder<NotificationSyncWorker>(
                15, TimeUnit.MINUTES,
                5, TimeUnit.MINUTES
            ).build()

            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                WORK_NAME,
                ExistingPeriodicWorkPolicy.KEEP,
                workRequest
            )
            Log.d(TAG, "Scheduled periodic notification sync worker")
        }
    }

    override suspend fun doWork(): Result {
        return try {
            val configManager = ConnectionConfigManager(context)
            val httpUrl = configManager.getHttpUrl()
            if (httpUrl.isBlank()) {
                return Result.success()
            }

            val interceptor = DynamicBaseUrlInterceptor().apply {
                setBaseUrl(httpUrl)
            }
            val apiService = BotApiService.create(interceptor)

            val response = apiService.getNotifications()
            val notifications = response.notifications
            if (notifications.isEmpty()) {
                return Result.success()
            }

            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val lastTimestamp = prefs.getLong(KEY_LAST_TIMESTAMP, 0L)

            val newUnread = notifications.filter { !it.read && it.timestamp > lastTimestamp }
            if (newUnread.isNotEmpty()) {
                createNotificationChannel()
                var maxTimestamp = lastTimestamp

                newUnread.forEachIndexed { index, item ->
                    if (item.timestamp > maxTimestamp) {
                        maxTimestamp = item.timestamp
                    }
                    showSystemNotification(item, index)
                }

                prefs.edit().putLong(KEY_LAST_TIMESTAMP, maxTimestamp).apply()
            }

            BotFarmWidgetProvider.updateAllWidgets(context)

            Result.success()
        } catch (e: Exception) {
            Log.w(TAG, "Background sync failed: ${e.message}")
            Result.retry()
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val name = "Bot Alerts"
            val descriptionText = "Notifications for bot status, errors and updates"
            val importance = NotificationManager.IMPORTANCE_DEFAULT
            val channel = NotificationChannel(CHANNEL_ID, name, importance).apply {
                description = descriptionText
            }
            val notificationManager: NotificationManager =
                context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }

    private fun showSystemNotification(item: NotificationItem, notifId: Int) {
        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        }
        val pendingIntent: PendingIntent = PendingIntent.getActivity(
            context,
            notifId,
            intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val builder = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle("SL Bot: ${item.projectName}")
            .setContentText(item.message)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)

        try {
            NotificationManagerCompat.from(context).notify(item.id.hashCode(), builder.build())
        } catch (e: SecurityException) {
            Log.w(TAG, "Notification permission not granted: ${e.message}")
        }
    }
}
