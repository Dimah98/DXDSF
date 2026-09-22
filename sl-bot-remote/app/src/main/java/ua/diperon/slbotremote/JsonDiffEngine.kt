package ua.diperon.slbotremote

import org.json.JSONArray
import org.json.JSONObject
import org.json.JSONTokener
import java.util.Locale

/**
 * Тип зміни в JSON.
 */
enum class JsonDiffType {
    ADDED,      // Додано в новому
    REMOVED,    // Видалено в новому
    MODIFIED    // Змінено значення
}

/**
 * Запис про конкретну відмінність між двома версіями.
 */
data class JsonDiffEntry(
    val path: String,
    val category: String,
    val keyName: String,
    val oldValue: String?,
    val newValue: String?,
    val diffType: JsonDiffType,
    val numericDelta: Double? = null // Різниця чисел (якщо обидва значення числові)
) {
    val deltaFormatted: String?
        get() {
            if (numericDelta == null || numericDelta.isNaN() || numericDelta.isInfinite()) return null
            return if (numericDelta > 0) {
                if (numericDelta % 1.0 == 0.0) "+${numericDelta.toLong()}" else String.format(Locale.US, "+%.2f", numericDelta)
            } else {
                if (numericDelta % 1.0 == 0.0) "${numericDelta.toLong()}" else String.format(Locale.US, "%.2f", numericDelta)
            }
        }
}

/**
 * Підсумковий результат порівняння двох файлів.
 */
data class JsonDiffResult(
    val entries: List<JsonDiffEntry>,
    val addedCount: Int,
    val removedCount: Int,
    val modifiedCount: Int,
    val totalCount: Int
) {
    val categories: List<String> by lazy {
        entries.map { it.category }.distinct().sorted()
    }
}

/**
 * Движок порівняння двох JSON файлів збереження.
 */
object JsonDiffEngine {

    private const val MAX_ENTRIES = 5000
    private const val MAX_DEPTH = 12

    fun compare(
        oldJsonStr: String,
        newJsonStr: String,
        ignorePatterns: Set<String> = emptySet()
    ): JsonDiffResult {
        return try {
            val oldObj = parseJsonRoot(oldJsonStr)
            val newObj = parseJsonRoot(newJsonStr)

            val entries = mutableListOf<JsonDiffEntry>()
            diffValues("", oldObj, newObj, entries, 0, ignorePatterns)

            // Сортуємо: спочатку за категорією, потім за шляхом
            entries.sortWith(compareBy({ it.category }, { it.path }))

            val added = entries.count { it.diffType == JsonDiffType.ADDED }
            val removed = entries.count { it.diffType == JsonDiffType.REMOVED }
            val modified = entries.count { it.diffType == JsonDiffType.MODIFIED }

            JsonDiffResult(
                entries = entries,
                addedCount = added,
                removedCount = removed,
                modifiedCount = modified,
                totalCount = entries.size
            )
        } catch (e: Exception) {
            e.printStackTrace()
            JsonDiffResult(emptyList(), 0, 0, 0, 0)
        }
    }

    private fun parseJsonRoot(jsonStr: String): Any? {
        if (jsonStr.isBlank()) return null
        return try {
            val tokener = JSONTokener(jsonStr.trim())
            tokener.nextValue()
        } catch (e: Exception) {
            null
        }
    }

    private fun diffValues(
        path: String,
        oldVal: Any?,
        newVal: Any?,
        entries: MutableList<JsonDiffEntry>,
        depth: Int,
        ignorePatterns: Set<String>
    ) {
        if (entries.size >= MAX_ENTRIES) return
        if (oldVal == null && newVal == null) return

        if (path.isNotEmpty()) {
            val key = extractKeyName(path)
            if (ProjectSaveIgnoreManager.isIgnored(path, key, ignorePatterns)) {
                return
            }
        }

        if (oldVal == null || oldVal == JSONObject.NULL) {
            if (newVal != null && newVal != JSONObject.NULL) {
                flattenAdditions(path, newVal, entries, depth, ignorePatterns)
            }
            return
        }

        if (newVal == null || newVal == JSONObject.NULL) {
            flattenRemovals(path, oldVal, entries, depth, ignorePatterns)
            return
        }

        if (depth > MAX_DEPTH) {
            if (!arePrimitivesEqual(oldVal, newVal)) {
                entries.add(createEntry(path, formatValue(oldVal), formatValue(newVal), JsonDiffType.MODIFIED))
            }
            return
        }

        when {
            oldVal is JSONObject && newVal is JSONObject -> {
                diffObjects(path, oldVal, newVal, entries, depth + 1, ignorePatterns)
            }
            oldVal is JSONArray && newVal is JSONArray -> {
                diffArrays(path, oldVal, newVal, entries, depth + 1, ignorePatterns)
            }
            else -> {
                // Примітиви або зміна типу
                if (!arePrimitivesEqual(oldVal, newVal)) {
                    val delta = calculateNumericDelta(oldVal, newVal)
                    entries.add(
                        JsonDiffEntry(
                            path = path,
                            category = extractCategory(path),
                            keyName = extractKeyName(path),
                            oldValue = formatValue(oldVal),
                            newValue = formatValue(newVal),
                            diffType = JsonDiffType.MODIFIED,
                            numericDelta = delta
                        )
                    )
                }
            }
        }
    }

    private fun diffObjects(
        basePath: String,
        oldObj: JSONObject,
        newObj: JSONObject,
        entries: MutableList<JsonDiffEntry>,
        depth: Int,
        ignorePatterns: Set<String>
    ) {
        if (entries.size >= MAX_ENTRIES) return
        val oldKeys = oldObj.keys().asSequence().toSet()
        val newKeys = newObj.keys().asSequence().toSet()

        val allKeys = (oldKeys + newKeys).toList().sorted()

        for (key in allKeys) {
            if (entries.size >= MAX_ENTRIES) break
            val nextPath = if (basePath.isEmpty()) key else "$basePath.$key"
            if (ProjectSaveIgnoreManager.isIgnored(nextPath, key, ignorePatterns)) {
                continue
            }
            val hasOld = oldObj.has(key)
            val hasNew = newObj.has(key)

            when {
                hasOld && !hasNew -> {
                    flattenRemovals(nextPath, oldObj.opt(key), entries, depth, ignorePatterns)
                }
                !hasOld && hasNew -> {
                    flattenAdditions(nextPath, newObj.opt(key), entries, depth, ignorePatterns)
                }
                else -> {
                    diffValues(nextPath, oldObj.opt(key), newObj.opt(key), entries, depth, ignorePatterns)
                }
            }
        }
    }

    private fun diffArrays(
        basePath: String,
        oldArr: JSONArray,
        newArr: JSONArray,
        entries: MutableList<JsonDiffEntry>,
        depth: Int,
        ignorePatterns: Set<String>
    ) {
        if (entries.size >= MAX_ENTRIES) return
        val maxLen = maxOf(oldArr.length(), newArr.length())

        for (i in 0 until maxLen) {
            if (entries.size >= MAX_ENTRIES) break
            val nextPath = "$basePath[$i]"
            if (ProjectSaveIgnoreManager.isIgnored(nextPath, "", ignorePatterns)) {
                continue
            }
            val hasOld = i < oldArr.length()
            val hasNew = i < newArr.length()

            when {
                hasOld && !hasNew -> {
                    flattenRemovals(nextPath, oldArr.opt(i), entries, depth, ignorePatterns)
                }
                !hasOld && hasNew -> {
                    flattenAdditions(nextPath, newArr.opt(i), entries, depth, ignorePatterns)
                }
                else -> {
                    diffValues(nextPath, oldArr.opt(i), newArr.opt(i), entries, depth, ignorePatterns)
                }
            }
        }
    }

    private fun flattenAdditions(
        path: String,
        value: Any?,
        entries: MutableList<JsonDiffEntry>,
        depth: Int,
        ignorePatterns: Set<String>
    ) {
        if (entries.size >= MAX_ENTRIES) return
        if (path.isNotEmpty()) {
            val key = extractKeyName(path)
            if (ProjectSaveIgnoreManager.isIgnored(path, key, ignorePatterns)) return
        }
        when (value) {
            is JSONObject -> {
                if (depth > MAX_DEPTH) {
                    entries.add(createEntry(path, null, "{...}", JsonDiffType.ADDED))
                    return
                }
                val keys = value.keys().asSequence().toList().sorted()
                if (keys.isEmpty()) {
                    entries.add(createEntry(path, null, "{}", JsonDiffType.ADDED))
                } else {
                    for (k in keys) {
                        if (entries.size >= MAX_ENTRIES) break
                        val nextPath = if (path.isEmpty()) k else "$path.$k"
                        if (ProjectSaveIgnoreManager.isIgnored(nextPath, k, ignorePatterns)) continue
                        flattenAdditions(nextPath, value.opt(k), entries, depth + 1, ignorePatterns)
                    }
                }
            }
            is JSONArray -> {
                if (depth > MAX_DEPTH) {
                    entries.add(createEntry(path, null, "[...]", JsonDiffType.ADDED))
                    return
                }
                if (value.length() == 0) {
                    entries.add(createEntry(path, null, "[]", JsonDiffType.ADDED))
                } else {
                    for (i in 0 until value.length()) {
                        if (entries.size >= MAX_ENTRIES) break
                        val nextPath = "$path[$i]"
                        if (ProjectSaveIgnoreManager.isIgnored(nextPath, "", ignorePatterns)) continue
                        flattenAdditions(nextPath, value.opt(i), entries, depth + 1, ignorePatterns)
                    }
                }
            }
            else -> {
                entries.add(createEntry(path, null, formatValue(value), JsonDiffType.ADDED))
            }
        }
    }

    private fun flattenRemovals(
        path: String,
        value: Any?,
        entries: MutableList<JsonDiffEntry>,
        depth: Int,
        ignorePatterns: Set<String>
    ) {
        if (entries.size >= MAX_ENTRIES) return
        if (path.isNotEmpty()) {
            val key = extractKeyName(path)
            if (ProjectSaveIgnoreManager.isIgnored(path, key, ignorePatterns)) return
        }
        when (value) {
            is JSONObject -> {
                if (depth > MAX_DEPTH) {
                    entries.add(createEntry(path, "{...}", null, JsonDiffType.REMOVED))
                    return
                }
                val keys = value.keys().asSequence().toList().sorted()
                if (keys.isEmpty()) {
                    entries.add(createEntry(path, "{}", null, JsonDiffType.REMOVED))
                } else {
                    for (k in keys) {
                        if (entries.size >= MAX_ENTRIES) break
                        val nextPath = if (path.isEmpty()) k else "$path.$k"
                        if (ProjectSaveIgnoreManager.isIgnored(nextPath, k, ignorePatterns)) continue
                        flattenRemovals(nextPath, value.opt(k), entries, depth + 1, ignorePatterns)
                    }
                }
            }
            is JSONArray -> {
                if (depth > MAX_DEPTH) {
                    entries.add(createEntry(path, "[...]", null, JsonDiffType.REMOVED))
                    return
                }
                if (value.length() == 0) {
                    entries.add(createEntry(path, "[]", null, JsonDiffType.REMOVED))
                } else {
                    for (i in 0 until value.length()) {
                        if (entries.size >= MAX_ENTRIES) break
                        val nextPath = "$path[$i]"
                        if (ProjectSaveIgnoreManager.isIgnored(nextPath, "", ignorePatterns)) continue
                        flattenRemovals(nextPath, value.opt(i), entries, depth + 1, ignorePatterns)
                    }
                }
            }
            else -> {
                entries.add(createEntry(path, formatValue(value), null, JsonDiffType.REMOVED))
            }
        }
    }

    private fun createEntry(
        path: String,
        oldVal: String?,
        newVal: String?,
        type: JsonDiffType
    ): JsonDiffEntry {
        return JsonDiffEntry(
            path = path,
            category = extractCategory(path),
            keyName = extractKeyName(path),
            oldValue = oldVal,
            newValue = newVal,
            diffType = type,
            numericDelta = null
        )
    }

    private fun arePrimitivesEqual(a: Any?, b: Any?): Boolean {
        if (a == b) return true
        if (a == null || b == null) return false

        // Числа: 10 == 10.0 == 10L
        if (a is Number && b is Number) {
            return a.toDouble() == b.toDouble()
        }

        // Рядки, що містять числа
        val aNum = a.toString().toDoubleOrNull()
        val bNum = b.toString().toDoubleOrNull()
        if (aNum != null && bNum != null) {
            return aNum == bNum
        }

        return a.toString() == b.toString()
    }

    private fun calculateNumericDelta(oldVal: Any?, newVal: Any?): Double? {
        val oldNum = when (oldVal) {
            is Number -> oldVal.toDouble()
            is String -> oldVal.toDoubleOrNull()
            else -> null
        }
        val newNum = when (newVal) {
            is Number -> newVal.toDouble()
            is String -> newVal.toDoubleOrNull()
            else -> null
        }
        return if (oldNum != null && newNum != null && !oldNum.isNaN() && !newNum.isNaN() && !oldNum.isInfinite() && !newNum.isInfinite()) {
            newNum - oldNum
        } else {
            null
        }
    }

    private fun formatValue(value: Any?): String {
        return when (value) {
            null, JSONObject.NULL -> "null"
            is JSONObject -> "{...}"
            is JSONArray -> "[...]"
            is Number -> {
                val d = value.toDouble()
                if (d % 1.0 == 0.0 && d in Long.MIN_VALUE.toDouble()..Long.MAX_VALUE.toDouble()) {
                    d.toLong().toString()
                } else {
                    value.toString()
                }
            }
            is Boolean -> value.toString()
            is String -> {
                if (value.length > 500) value.take(500) + "..." else value
            }
            else -> {
                val str = value.toString()
                if (str.length > 500) str.take(500) + "..." else str
            }
        }
    }

    private fun extractCategory(path: String): String {
        if (path.isEmpty()) return "загальне"
        val cleanPath = if (path.startsWith("visitedFarmState.")) {
            path.removePrefix("visitedFarmState.")
        } else {
            path
        }
        val clean = cleanPath.split(".").firstOrNull() ?: cleanPath
        val withoutBracket = clean.substringBefore("[")
        return if (withoutBracket.isBlank()) "загальне" else withoutBracket
    }

    private fun extractKeyName(path: String): String {
        if (path.isEmpty()) return ""
        val lastPart = path.substringAfterLast(".")
        return lastPart
    }
}
