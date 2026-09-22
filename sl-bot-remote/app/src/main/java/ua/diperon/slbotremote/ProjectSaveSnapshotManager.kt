package ua.diperon.slbotremote

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.UUID

/**
 * Метадані збереженої версії файлу збереження гри (*_save.json).
 */
data class ProjectSaveSnapshot(
    val id: String,
    val projectName: String,
    val label: String,
    val timestamp: Long,
    val sizeBytes: Long
) {
    val formattedDate: String
        get() {
            val sdf = SimpleDateFormat("dd.MM.yyyy HH:mm:ss", Locale.getDefault())
            return sdf.format(Date(timestamp))
        }

    val formattedSize: String
        get() {
            return when {
                sizeBytes >= 1024 * 1024 -> String.format(Locale.US, "%.2f MB", sizeBytes / (1024.0 * 1024.0))
                sizeBytes >= 1024 -> String.format(Locale.US, "%.1f KB", sizeBytes / 1024.0)
                else -> "$sizeBytes B"
            }
        }
}

/**
 * Менеджер для локального збереження, завантаження та видалення версій *_save.json.
 * Зберігає файли у context.filesDir/snapshots/<projectName>/
 */
object ProjectSaveSnapshotManager {

    private fun getSnapshotsDir(context: Context, projectName: String): File {
        val safeProjectName = projectName.replace(Regex("[^a-zA-Z0-9._-]"), "_")
        val dir = File(context.filesDir, "snapshots/$safeProjectName")
        if (!dir.exists()) {
            dir.mkdirs()
        }
        return dir
    }

    private fun getIndexFile(context: Context, projectName: String): File {
        return File(getSnapshotsDir(context, projectName), "index.json")
    }

    /**
     * Отримати список усіх збережених версій для проекту (відсортованих від нових до старих).
     */
    suspend fun getSnapshots(context: Context, projectName: String): List<ProjectSaveSnapshot> = withContext(Dispatchers.IO) {
        val indexFile = getIndexFile(context, projectName)
        val snapshots = mutableListOf<ProjectSaveSnapshot>()

        if (indexFile.exists()) {
            try {
                val content = indexFile.readText()
                val jsonArray = JSONArray(content)
                for (i in 0 until jsonArray.length()) {
                    val obj = jsonArray.getJSONObject(i)
                    val id = obj.getString("id")
                    val file = File(getSnapshotsDir(context, projectName), "$id.json")
                    if (file.exists()) {
                        snapshots.add(
                            ProjectSaveSnapshot(
                                id = id,
                                projectName = obj.optString("projectName", projectName),
                                label = obj.optString("label", "Знімок $id"),
                                timestamp = obj.optLong("timestamp", file.lastModified()),
                                sizeBytes = if (obj.has("sizeBytes")) obj.getLong("sizeBytes") else file.length()
                            )
                        )
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }

        // Якщо в індексі порожньо або файли не синхронізовані, скануємо директорію
        if (snapshots.isEmpty()) {
            val dir = getSnapshotsDir(context, projectName)
            val files = dir.listFiles { f -> f.extension == "json" && f.name != "index.json" } ?: emptyArray()
            for (file in files) {
                val id = file.nameWithoutExtension
                snapshots.add(
                    ProjectSaveSnapshot(
                        id = id,
                        projectName = projectName,
                        label = "Збереження ${SimpleDateFormat("dd.MM HH:mm", Locale.getDefault()).format(Date(file.lastModified()))}",
                        timestamp = file.lastModified(),
                        sizeBytes = file.length()
                    )
                )
            }
            if (snapshots.isNotEmpty()) {
                saveIndex(context, projectName, snapshots)
            }
        }

        snapshots.distinctBy { it.id }.sortedByDescending { it.timestamp }
    }

    /**
     * Зберегти нову версію save.json
     */
    suspend fun saveSnapshot(
        context: Context,
        projectName: String,
        label: String,
        jsonContent: String
    ): ProjectSaveSnapshot = withContext(Dispatchers.IO) {
        val id = UUID.randomUUID().toString().take(8) + "_" + System.currentTimeMillis()
        val dir = getSnapshotsDir(context, projectName)
        val file = File(dir, "$id.json")
        file.writeText(jsonContent)

        val finalLabel = label.trim().ifEmpty {
            val nowStr = SimpleDateFormat("dd.MM.yyyy HH:mm:ss", Locale.getDefault()).format(Date())
            "Знімок ($nowStr)"
        }

        val snapshot = ProjectSaveSnapshot(
            id = id,
            projectName = projectName,
            label = finalLabel,
            timestamp = System.currentTimeMillis(),
            sizeBytes = file.length()
        )

        val currentList = getSnapshots(context, projectName).filter { it.id != id }.toMutableList()
        currentList.add(0, snapshot)
        saveIndex(context, projectName, currentList)

        snapshot
    }

    /**
     * Завантажити вміст JSON файлу конкретного знімка
     */
    suspend fun loadSnapshotContent(
        context: Context,
        projectName: String,
        snapshotId: String
    ): String? = withContext(Dispatchers.IO) {
        val file = File(getSnapshotsDir(context, projectName), "$snapshotId.json")
        if (file.exists()) {
            try {
                file.readText()
            } catch (e: Exception) {
                null
            }
        } else {
            null
        }
    }

    /**
     * Видалити знімок
     */
    suspend fun deleteSnapshot(
        context: Context,
        projectName: String,
        snapshotId: String
    ): Boolean = withContext(Dispatchers.IO) {
        val file = File(getSnapshotsDir(context, projectName), "$snapshotId.json")
        val deleted = if (file.exists()) file.delete() else true

        val currentList = getSnapshots(context, projectName).toMutableList()
        val found = currentList.removeAll { it.id == snapshotId }
        if (found) {
            saveIndex(context, projectName, currentList)
        }
        deleted
    }

    /**
     * Перейменувати знімок
     */
    suspend fun renameSnapshot(
        context: Context,
        projectName: String,
        snapshotId: String,
        newLabel: String
    ): Boolean = withContext(Dispatchers.IO) {
        val currentList = getSnapshots(context, projectName).toMutableList()
        val index = currentList.indexOfFirst { it.id == snapshotId }
        if (index != -1) {
            val old = currentList[index]
            currentList[index] = old.copy(label = newLabel.trim().ifEmpty { old.label })
            saveIndex(context, projectName, currentList)
            true
        } else {
            false
        }
    }

    private fun saveIndex(context: Context, projectName: String, snapshots: List<ProjectSaveSnapshot>) {
        try {
            val jsonArray = JSONArray()
            for (s in snapshots.distinctBy { it.id }) {
                val obj = JSONObject()
                obj.put("id", s.id)
                obj.put("projectName", s.projectName)
                obj.put("label", s.label)
                obj.put("timestamp", s.timestamp)
                obj.put("sizeBytes", s.sizeBytes)
                jsonArray.put(obj)
            }
            getIndexFile(context, projectName).writeText(jsonArray.toString(2))
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }
}
