package ua.diperon.slbotremote

import android.content.Context
import java.util.Locale

/**
 * Утиліта для резолвінгу URL зображень предметів інвентаря, складів та ресурсів.
 * Спершу шукає серед локально вшитих асетів (assets/im/), що забезпечує миттєве завантаження без Інтернету.
 * Якщо в асетах не знайдено — генерує правильний серверний URL.
 */
object ItemImageResolver {
    @Volatile
    private var cachedAssetFiles: List<String>? = null

    fun getAssetFiles(context: Context): List<String> {
        val cached = cachedAssetFiles
        if (cached != null) return cached
        val list = try {
            context.assets.list("im")?.toList() ?: emptyList()
        } catch (_: Exception) {
            emptyList()
        }
        cachedAssetFiles = list
        return list
    }

    /**
     * Повертає URL (file:///android_asset/im/... або http://...) для відображення іконки
     */
    fun resolveImageUrl(
        rawImage: String,
        context: Context,
        baseUrl: String
    ): String {
        val trimmed = rawImage.trim()
        if (trimmed.isEmpty()) return ""
        if (trimmed.startsWith("data:")) return trimmed
        if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed

        val assetFiles = getAssetFiles(context)
        val cleanName = trimmed
            .substringAfterLast("/")
            .substringBeforeLast(".")
            .lowercase(Locale.ROOT)
            .trim()

        if (cleanName.isNotEmpty() && assetFiles.isNotEmpty()) {
            // 1. Точний збіг назви (враховуючи пробіли/підкреслення)
            var matched = assetFiles.firstOrNull { assetFile ->
                val assetClean = assetFile.substringBeforeLast(".").lowercase(Locale.ROOT).trim()
                assetClean == cleanName || 
                    assetClean.replace(" ", "_") == cleanName || 
                    assetClean.replace("_", " ") == cleanName
            }

            // 2. Частковий збіг, якщо точного немає
            if (matched == null) {
                matched = assetFiles.firstOrNull { assetFile ->
                    val assetClean = assetFile.substringBeforeLast(".").lowercase(Locale.ROOT).trim()
                    assetClean.contains(cleanName) || cleanName.contains(assetClean)
                }
            }

            if (matched != null) {
                return "file:///android_asset/im/$matched"
            }
        }

        // 3. Фолбек на мережевий URL сервера
        val cleanBase = baseUrl.trimEnd('/')
        return when {
            trimmed.startsWith("/api/images/") || trimmed.startsWith("/api/im/") -> {
                if (cleanBase.isNotEmpty()) "$cleanBase$trimmed" else trimmed
            }
            trimmed.startsWith("/") -> {
                if (cleanBase.isNotEmpty()) "$cleanBase$trimmed" else trimmed
            }
            cleanName.isNotEmpty() -> {
                if (cleanBase.isNotEmpty()) "$cleanBase/api/im/$cleanName.png" else "/api/im/$cleanName.png"
            }
            else -> {
                if (cleanBase.isNotEmpty()) "$cleanBase/$trimmed" else "/$trimmed"
            }
        }
    }
}
