package ua.diperon.slbotremote

import android.content.Context
import android.content.SharedPreferences

/**
 * Менеджер правил ігнорування полів при порівнянні версій *_save.json.
 * Зберігає налаштування та патерни у SharedPreferences.
 */
object ProjectSaveIgnoreManager {

    private const val PREFS_NAME = "sl_save_diff_ignore_prefs"
    private const val KEY_CUSTOM_PATTERNS = "custom_ignore_patterns"
    private const val KEY_IGNORE_TIMESTAMPS = "ignore_timestamps"
    private const val KEY_IGNORE_COORDINATES = "ignore_coordinates"
    private const val KEY_IGNORE_SYSTEM = "ignore_system"

    val TIMESTAMP_PATTERNS = setOf(
        "createdAt", "readyAt", "plantedAt", "spawnedAt", "collectedAt",
        "startedAt", "harvestedAt", "expiresAt", "timestamp", "updatedAt",
        "magicSpawnedAt", "lastObserverCheck", "time", "*At"
    )

    val COORDINATE_PATTERNS = setOf(
        "coordinates", "x", "y"
    )

    val SYSTEM_PATTERNS = setOf(
        "sessionId", "deviceTracker", "hash", "version", "analytics",
        "announcements", "mailbox", "conversations"
    )

    private fun getPrefs(context: Context): SharedPreferences {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }

    fun isIgnoreTimestamps(context: Context): Boolean {
        // За замовчуванням увімкнено, бо таймстеми в Sunflower Land змінюються постійно
        return getPrefs(context).getBoolean(KEY_IGNORE_TIMESTAMPS, true)
    }

    fun setIgnoreTimestamps(context: Context, enabled: Boolean) {
        getPrefs(context).edit().putBoolean(KEY_IGNORE_TIMESTAMPS, enabled).apply()
    }

    fun isIgnoreCoordinates(context: Context): Boolean {
        return getPrefs(context).getBoolean(KEY_IGNORE_COORDINATES, false)
    }

    fun setIgnoreCoordinates(context: Context, enabled: Boolean) {
        getPrefs(context).edit().putBoolean(KEY_IGNORE_COORDINATES, enabled).apply()
    }

    fun isIgnoreSystem(context: Context): Boolean {
        return getPrefs(context).getBoolean(KEY_IGNORE_SYSTEM, true)
    }

    fun setIgnoreSystem(context: Context, enabled: Boolean) {
        getPrefs(context).edit().putBoolean(KEY_IGNORE_SYSTEM, enabled).apply()
    }

    fun getCustomPatterns(context: Context): Set<String> {
        return getPrefs(context).getStringSet(KEY_CUSTOM_PATTERNS, emptySet())?.toSet() ?: emptySet()
    }

    fun addCustomPattern(context: Context, pattern: String): Boolean {
        val trimmed = pattern.trim()
        if (trimmed.isEmpty()) return false
        val current = getCustomPatterns(context).toMutableSet()
        val added = current.add(trimmed)
        if (added) {
            getPrefs(context).edit().putStringSet(KEY_CUSTOM_PATTERNS, current).apply()
        }
        return added
    }

    fun removeCustomPattern(context: Context, pattern: String): Boolean {
        val current = getCustomPatterns(context).toMutableSet()
        val removed = current.remove(pattern.trim())
        if (removed) {
            getPrefs(context).edit().putStringSet(KEY_CUSTOM_PATTERNS, current).apply()
        }
        return removed
    }

    /**
     * Повний набір усіх активних патернів ігнорування (пресети + кастомні).
     */
    fun getAllActivePatterns(context: Context): Set<String> {
        val set = mutableSetOf<String>()
        if (isIgnoreTimestamps(context)) {
            set.addAll(TIMESTAMP_PATTERNS)
        }
        if (isIgnoreCoordinates(context)) {
            set.addAll(COORDINATE_PATTERNS)
        }
        if (isIgnoreSystem(context)) {
            set.addAll(SYSTEM_PATTERNS)
        }
        set.addAll(getCustomPatterns(context))
        return set
    }

    /**
     * Перевірити, чи повинен даний шлях або ключ ігноруватися.
     */
    fun isIgnored(path: String, key: String, activePatterns: Set<String>): Boolean {
        if (activePatterns.isEmpty()) return false

        for (pattern in activePatterns) {
            if (matchesPattern(path, key, pattern)) {
                return true
            }
        }
        return false
    }

    private fun matchesPattern(path: String, key: String, pattern: String): Boolean {
        val p = pattern.trim()
        if (p.isEmpty()) return false

        // Шаблон виду *At (закінчується на щось)
        if (p.startsWith("*") && p.length > 1) {
            val suffix = p.substring(1)
            if (key.endsWith(suffix, ignoreCase = true)) return true
            val lastKeyPart = path.substringAfterLast(".").substringBefore("[")
            if (lastKeyPart.endsWith(suffix, ignoreCase = true)) return true
        }

        // Точний збіг ключа
        if (key.equals(p, ignoreCase = true)) return true

        // Збіг за частиною шляху (наприклад "delivery" або "bumpkin.activity")
        if (path.equals(p, ignoreCase = true)) return true
        if (path.startsWith("$p.", ignoreCase = true)) return true
        if (path.contains(".$p.", ignoreCase = true)) return true
        if (path.endsWith(".$p", ignoreCase = true)) return true

        // Для шляхів з індексами масивів (наприклад delivery[0] або delivery.orders)
        val cleanPath = path.replace(Regex("\\[\\d+\\]"), "")
        if (cleanPath.equals(p, ignoreCase = true) ||
            cleanPath.startsWith("$p.", ignoreCase = true) ||
            cleanPath.contains(".$p.", ignoreCase = true) ||
            cleanPath.endsWith(".$p", ignoreCase = true)) {
            return true
        }

        return false
    }
}
