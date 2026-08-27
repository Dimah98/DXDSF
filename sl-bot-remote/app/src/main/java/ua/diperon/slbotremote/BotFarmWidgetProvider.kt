package ua.diperon.slbotremote

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.util.Log
import android.widget.RemoteViews
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import ua.diperon.slbotremote.data.AppDatabase
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class BotFarmWidgetProvider : AppWidgetProvider() {

    companion object {
        private const val TAG = "BotFarmWidget"
        const val ACTION_REFRESH_WIDGET = "ua.diperon.slbotremote.ACTION_REFRESH_WIDGET"

        fun updateAllWidgets(context: Context) {
            val appWidgetManager = AppWidgetManager.getInstance(context)
            val thisWidget = ComponentName(context, BotFarmWidgetProvider::class.java)
            val appWidgetIds = appWidgetManager.getAppWidgetIds(thisWidget)
            if (appWidgetIds.isNotEmpty()) {
                val intent = Intent(context, BotFarmWidgetProvider::class.java).apply {
                    action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
                    putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, appWidgetIds)
                }
                context.sendBroadcast(intent)
            }
        }
    }

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        for (appWidgetId in appWidgetIds) {
            updateWidget(context, appWidgetManager, appWidgetId)
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action == ACTION_REFRESH_WIDGET) {
            Log.d(TAG, "Manual widget refresh requested")
            val appWidgetManager = AppWidgetManager.getInstance(context)
            val thisWidget = ComponentName(context, BotFarmWidgetProvider::class.java)
            val appWidgetIds = appWidgetManager.getAppWidgetIds(thisWidget)
            onUpdate(context, appWidgetManager, appWidgetIds)
        }
    }

    private fun updateWidget(context: Context, appWidgetManager: AppWidgetManager, appWidgetId: Int) {
        val views = RemoteViews(context.packageName, R.layout.widget_bot_farm)

        // Setup Main Click -> Open App
        val appIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        }
        val appPendingIntent = PendingIntent.getActivity(
            context, 0, appIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        views.setOnClickPendingIntent(R.id.widget_root, appPendingIntent)
        views.setOnClickPendingIntent(R.id.widget_btn_open, appPendingIntent)

        // Setup Refresh Click -> Broadcast Intent
        val refreshIntent = Intent(context, BotFarmWidgetProvider::class.java).apply {
            action = ACTION_REFRESH_WIDGET
        }
        val refreshPendingIntent = PendingIntent.getBroadcast(
            context, 1, refreshIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        views.setOnClickPendingIntent(R.id.widget_btn_refresh, refreshPendingIntent)

        // Load Cached Data first
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val db = AppDatabase.getInstance(context)
                val cachedProjects = db.dao().getProjects()
                val totalBots = cachedProjects.size
                val activeBots = cachedProjects.count { it.isRunning }
                val totalGold = cachedProjects.sumOf { it.gold ?: 0.0 }

                val timeFormat = SimpleDateFormat("HH:mm", Locale.getDefault())
                val timeStr = timeFormat.format(Date())

                withContext(Dispatchers.Main) {
                    views.setTextViewText(R.id.widget_metric_active_val, "$activeBots/$totalBots")
                    views.setTextViewText(R.id.widget_metric_gold_val, formatNumber(totalGold))
                    views.setTextViewText(R.id.widget_sync_time, timeStr)
                    val statusText = if (activeBots > 0) "🟢 Працює ботів: $activeBots" else "⚪ Усі боти зупинені"
                    views.setTextViewText(R.id.widget_status_text, statusText)
                    appWidgetManager.updateAppWidget(appWidgetId, views)
                }

                // Asynchronously fetch fresh data if network available
                val configManager = ConnectionConfigManager(context)
                val httpUrl = configManager.getHttpUrl()
                if (httpUrl.isNotBlank()) {
                    val interceptor = DynamicBaseUrlInterceptor().apply { setBaseUrl(httpUrl) }
                    val apiService = BotApiService.create(interceptor)
                    val overview = apiService.getProjectsOverview()

                    val netActive = overview.count { it.isRunning }
                    val netTotal = overview.size
                    val netGold = overview.sumOf { it.gold ?: 0.0 }

                    val notifRes = try { apiService.getNotifications() } catch (_: Exception) { null }
                    val netUnread = notifRes?.unreadCount ?: 0

                    withContext(Dispatchers.Main) {
                        views.setTextViewText(R.id.widget_metric_active_val, "$netActive/$netTotal")
                        views.setTextViewText(R.id.widget_metric_gold_val, formatNumber(netGold))
                        views.setTextViewText(R.id.widget_metric_alerts_val, "$netUnread")
                        views.setTextViewText(R.id.widget_sync_time, timeFormat.format(Date()))
                        val netStatusText = if (netActive > 0) "🟢 Працює ботів: $netActive" else "⚪ Усі боти зупинені"
                        views.setTextViewText(R.id.widget_status_text, netStatusText)
                        appWidgetManager.updateAppWidget(appWidgetId, views)
                    }
                }
            } catch (e: Exception) {
                Log.w(TAG, "Error updating widget: ${e.message}")
            }
        }
    }

    private fun formatNumber(number: Double): String {
        return when {
            number >= 1_000_000 -> String.format(Locale.US, "%.1fM", number / 1_000_000)
            number >= 1_000 -> String.format(Locale.US, "%.1fK", number / 1_000)
            else -> String.format(Locale.US, "%.0f", number)
        }
    }
}
