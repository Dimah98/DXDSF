package ua.diperon.slbotremote

import android.content.Context
import android.util.Log
import org.json.JSONObject
import org.json.JSONArray
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Клас для управління міні-зображеннями на основі даних з JSON файлів проектів
 */
class MiniImagesManager(private val context: Context) {

    companion object {
        private const val TAG = "MiniImagesManager"
        private const val DATE_FORMAT = "yyyy-MM-dd"
    }

    private val dateFormat = SimpleDateFormat(DATE_FORMAT, Locale.getDefault())

    /**
     * Отримує список міні-зображень для проекту на основі його JSON даних
     * Повертає список пар (назва файлу, опціональне число для відображення)
     */
    fun getMiniImagesForProject(projectSaveData: Map<String, Any>?): List<Pair<String, Int?>> {
        val images = mutableListOf<Pair<String, Int?>>()

        try {
            if (projectSaveData == null) return emptyList()

            val projectJson = JSONObject(projectSaveData as Map<*, *>)

            Log.d(TAG, "Checking mini images for project with visitedFarmState: ${projectJson.has("visitedFarmState")}")

            // Острів - floatingIsland.petalPuzzleSolvedAt
            if (checkIslandCondition(projectJson)) {
                images.add(Pair("llow.png", null))
                Log.d(TAG, "Island condition met")
            } else {
                Log.d(TAG, "Island condition not met")
            }

            // Поповнення - shipments.restockedAt
            if (checkRestockCondition(projectJson)) {
                images.add(Pair("ppopow.png", null))
            }

            // Місії - delivery.orders[].completedAt
            val missionsCount = checkMissionsCondition(projectJson)
            if (missionsCount > 0) {
                images.add(Pair("mmisi.png", missionsCount))
            }

            // Кріт - minigames.games["mine-whack"].history[last].prizeClaimedAt
            if (checkMoleCondition(projectJson)) {
                images.add(Pair("mmine.png", null))
            }

            // Пам'ять - minigames.games.memory.history[last].prizeClaimedAt
            if (checkMemoryCondition(projectJson)) {
                images.add(Pair("mmemori.png", null))
            }

            // Храм - minigames.games["chaacs-temple"].history[last].prizeClaimedAt
            if (checkTempleCondition(projectJson)) {
                images.add(Pair("cchaacs.png", null))
            }

            // Скілпоїнти - bumpkin.experience, bumpkin.skills
            val skillPoints = checkSkillPointsCondition(projectJson)
            if (skillPoints > 0) {
                images.add(Pair("sskill.png", skillPoints))
            }

        } catch (e: Exception) {
            Log.e(TAG, "Error loading mini images from data: ${e.message}")
        }

        return images
    }
    
    /**
     * Перевіряє чи виконана умова для Острова (сьогодні)
     */
    private fun checkIslandCondition(json: JSONObject): Boolean {
        return try {
            val visitedFarmState = json.optJSONObject("visitedFarmState") ?: return false
            val floatingIsland = visitedFarmState.optJSONObject("floatingIsland") ?: return false
            val solvedAt = floatingIsland.optLong("petalPuzzleSolvedAt", 0)
            
            solvedAt > 0 && isToday(solvedAt)
        } catch (e: Exception) {
            Log.e(TAG, "Error checking island condition: ${e.message}")
            false
        }
    }
    
    /**
     * Перевіряє чи виконана умова для Поповнення (сьогодні)
     */
    private fun checkRestockCondition(json: JSONObject): Boolean {
        return try {
            val visitedFarmState = json.optJSONObject("visitedFarmState") ?: return false
            val shipments = visitedFarmState.optJSONObject("shipments") ?: return false
            val restockedAt = shipments.optLong("restockedAt", 0)
            
            restockedAt > 0 && isToday(restockedAt)
        } catch (e: Exception) {
            Log.e(TAG, "Error checking restock condition: ${e.message}")
            false
        }
    }
    
    /**
     * Перевіряє чи виконана умова для Місій (сьогодні та кількість)
     * Повертає кількість виконаних місій сьогодні
     */
    private fun checkMissionsCondition(json: JSONObject): Int {
        return try {
            val visitedFarmState = json.optJSONObject("visitedFarmState") ?: return 0
            val delivery = visitedFarmState.optJSONObject("delivery") ?: return 0
            val orders = delivery.optJSONArray("orders") ?: return 0

            var count = 0
            for (i in 0 until orders.length()) {
                val order = orders.optJSONObject(i) ?: continue
                val completedAt = order.optLong("completedAt", 0)
                Log.d(TAG, "Order completedAt: $completedAt, isToday: ${isToday(completedAt)}")
                if (completedAt > 0 && isToday(completedAt)) {
                    count++
                }
            }
            Log.d(TAG, "Total missions completed today: $count")
            count
        } catch (e: Exception) {
            Log.e(TAG, "Error checking missions condition: ${e.message}")
            0
        }
    }
    
    /**
     * Перевіряє чи виконана умова для Крота (останній в списку та сьогодні)
     */
    private fun checkMoleCondition(json: JSONObject): Boolean {
        return try {
            val visitedFarmState = json.optJSONObject("visitedFarmState") ?: return false
            val minigames = visitedFarmState.optJSONObject("minigames") ?: return false
            val games = minigames.optJSONObject("games") ?: return false
            val mineWhack = games.optJSONObject("mine-whack") ?: return false
            val history = mineWhack.optJSONObject("history") ?: return false
            
            // Знаходимо останню дату в історії
            val lastDateKey = getLastHistoryDateKey(history) ?: return false
            val lastEntry = history.optJSONObject(lastDateKey) ?: return false
            val prizeClaimedAt = lastEntry.optLong("prizeClaimedAt", 0)
            
            prizeClaimedAt > 0 && isToday(prizeClaimedAt)
        } catch (e: Exception) {
            Log.e(TAG, "Error checking mole condition: ${e.message}")
            false
        }
    }
    
    /**
     * Перевіряє чи виконана умова для Пам'яті (останній в списку та сьогодні)
     */
    private fun checkMemoryCondition(json: JSONObject): Boolean {
        return try {
            val visitedFarmState = json.optJSONObject("visitedFarmState") ?: return false
            val minigames = visitedFarmState.optJSONObject("minigames") ?: return false
            val games = minigames.optJSONObject("games") ?: return false
            val memory = games.optJSONObject("memory") ?: return false
            val history = memory.optJSONObject("history") ?: return false
            
            // Знаходимо останню дату в історії
            val lastDateKey = getLastHistoryDateKey(history) ?: return false
            val lastEntry = history.optJSONObject(lastDateKey) ?: return false
            val prizeClaimedAt = lastEntry.optLong("prizeClaimedAt", 0)
            
            prizeClaimedAt > 0 && isToday(prizeClaimedAt)
        } catch (e: Exception) {
            Log.e(TAG, "Error checking memory condition: ${e.message}")
            false
        }
    }
    
    /**
     * Перевіряє чи виконана умова для Храму (останній в списку та сьогодні)
     */
    private fun checkTempleCondition(json: JSONObject): Boolean {
        return try {
            val visitedFarmState = json.optJSONObject("visitedFarmState") ?: return false
            val minigames = visitedFarmState.optJSONObject("minigames") ?: return false
            val games = minigames.optJSONObject("games") ?: return false
            val chaacsTemple = games.optJSONObject("chaacs-temple") ?: return false
            val history = chaacsTemple.optJSONObject("history") ?: return false
            
            // Знаходимо останню дату в історії
            val lastDateKey = getLastHistoryDateKey(history) ?: return false
            val lastEntry = history.optJSONObject(lastDateKey) ?: return false
            val prizeClaimedAt = lastEntry.optLong("prizeClaimedAt", 0)
            
            prizeClaimedAt > 0 && isToday(prizeClaimedAt)
        } catch (e: Exception) {
            Log.e(TAG, "Error checking temple condition: ${e.message}")
            false
        }
    }
    
    /**
     * Знаходить останню дату в об'єкті історії
     */
    private fun getLastHistoryDateKey(history: JSONObject): String? {
        return try {
            val keys = history.keys()
            var lastDate: String? = null
            var lastTimestamp = 0L
            
            while (keys.hasNext()) {
                val key = keys.next()
                try {
                    val timestamp = dateFormat.parse(key)?.time ?: 0
                    if (timestamp > lastTimestamp) {
                        lastTimestamp = timestamp
                        lastDate = key
                    }
                } catch (e: Exception) {
                    // Ігноруємо неправильні формати дат
                }
            }
            lastDate
        } catch (e: Exception) {
            Log.e(TAG, "Error getting last history date: ${e.message}")
            null
        }
    }
    
    /**
     * Перевіряє чи заданий timestamp відноситься до сьогодні
     * День оновлюється о 3:00 ранку
     */
    private fun isToday(timestamp: Long): Boolean {
        return try {
            val calendar = java.util.Calendar.getInstance()
            val currentHour = calendar.get(java.util.Calendar.HOUR_OF_DAY)

            // Обчислюємо початок поточного ігрового дня (3:00 AM)
            if (currentHour < 3) {
                // Якщо зараз до 3:00, ігровий день почався вчора о 3:00
                calendar.add(java.util.Calendar.DAY_OF_MONTH, -1)
            }
            calendar.set(java.util.Calendar.HOUR_OF_DAY, 3)
            calendar.set(java.util.Calendar.MINUTE, 0)
            calendar.set(java.util.Calendar.SECOND, 0)
            calendar.set(java.util.Calendar.MILLISECOND, 0)

            val gameDayStart = calendar.timeInMillis
            val result = timestamp >= gameDayStart
            Log.d(TAG, "isToday check: timestamp=$timestamp, gameDayStart=$gameDayStart, currentHour=$currentHour, result=$result")
            result
        } catch (e: Exception) {
            Log.e(TAG, "Error checking if date is today: ${e.message}")
            false
        }
    }

    /**
     * Перевіряє кількість невикористаних скілпоїнтів
     * Повертає кількість невикористаних скілпоїнтів
     */
    private fun checkSkillPointsCondition(json: JSONObject): Int {
        return try {
            val visitedFarmState = json.optJSONObject("visitedFarmState") ?: return 0
            val bumpkin = visitedFarmState.optJSONObject("bumpkin") ?: return 0

            // Отримуємо досвід
            val experience = bumpkin.optDouble("experience", 0.0)

            // Отримуємо прокачані скіли
            val skills = bumpkin.optJSONObject("skills") ?: return 0

            // Завантажуємо дані про XP та вартість скілів
            val skillData = loadSkillPointsData() ?: return 0

            // Обчислюємо рівень на основі досвіду
            val level = calculateLevel(experience, skillData.xpTable)

            // Обчислюємо загальну кількість скілпоїнтів на цьому рівні
            val totalSkillPoints = level

            // Обчислюємо витрачені скілпоїнти
            val spentSkillPoints = calculateSpentSkillPoints(skills, skillData.skillsCost)

            val unusedSkillPoints = totalSkillPoints - spentSkillPoints

            Log.d(TAG, "Skill points: exp=$experience, level=$level, total=$totalSkillPoints, spent=$spentSkillPoints, unused=$unusedSkillPoints")

            if (unusedSkillPoints > 0) unusedSkillPoints else 0
        } catch (e: Exception) {
            Log.e(TAG, "Error checking skill points condition: ${e.message}")
            0
        }
    }

    /**
     * Завантажує дані про XP та вартість скілів з assets
     */
    private fun loadSkillPointsData(): SkillPointsData? {
        return try {
            val inputStream = context.assets.open("skill_points_data.json")
            val content = inputStream.bufferedReader().use { it.readText() }
            inputStream.close()

            val jsonData = JSONObject(content)
            val xpTableJson = jsonData.optJSONObject("xp_table") ?: return null
            val skillsCostJson = jsonData.optJSONObject("skills_cost") ?: return null

            val xpTable = mutableMapOf<Int, Long>()
            val keys = xpTableJson.keys()
            while (keys.hasNext()) {
                val key = keys.next()
                xpTable[key.toInt()] = xpTableJson.optLong(key)
            }

            val skillsCost = mutableMapOf<String, Int>()
            val skillKeys = skillsCostJson.keys()
            while (skillKeys.hasNext()) {
                val key = skillKeys.next()
                skillsCost[key] = skillsCostJson.optInt(key)
            }

            SkillPointsData(xpTable, skillsCost)
        } catch (e: Exception) {
            Log.e(TAG, "Error loading skill points data: ${e.message}")
            null
        }
    }

    /**
     * Обчислює рівень на основі досвіду
     */
    private fun calculateLevel(experience: Double, xpTable: Map<Int, Long>): Int {
        val expLong = experience.toLong()
        var level = 1
        for ((lvl, xpRequired) in xpTable) {
            if (expLong >= xpRequired) {
                level = lvl
            } else {
                break
            }
        }
        return level
    }

    /**
     * Обчислює витрачені скілпоїнти на основі прокачаних скілів
     */
    private fun calculateSpentSkillPoints(skills: JSONObject, skillsCost: Map<String, Int>): Int {
        var spent = 0
        val keys = skills.keys()
        while (keys.hasNext()) {
            val skillName = keys.next()
            val skillLevel = skills.optInt(skillName, 0)
            val cost = skillsCost[skillName] ?: 0
            spent += cost * skillLevel
        }
        return spent
    }

    /**
     * Обчислює рівень з даних збереження проекту
     */
    fun calculateLevelFromSaveData(projectSaveData: Map<String, Any>?): Int? {
        return try {
            if (projectSaveData == null) return null

            val projectJson = JSONObject(projectSaveData as Map<*, *>)
            val visitedFarmState = projectJson.optJSONObject("visitedFarmState") ?: return null
            val bumpkin = visitedFarmState.optJSONObject("bumpkin") ?: return null

            val experience = bumpkin.optDouble("experience", 0.0)
            val skillData = loadSkillPointsData() ?: return null

            calculateLevel(experience, skillData.xpTable)
        } catch (e: Exception) {
            Log.e(TAG, "Error calculating level from save data: ${e.message}")
            null
        }
    }

    /**
     * Отримує золото з даних збереження проекту
     */
    fun getGoldFromSaveData(projectSaveData: Map<String, Any>?): Double? {
        return try {
            if (projectSaveData == null) return null

            val projectJson = JSONObject(projectSaveData as Map<*, *>)
            val visitedFarmState = projectJson.optJSONObject("visitedFarmState") ?: return null

            val coins = visitedFarmState.optDouble("coins", 0.0)
            coins
        } catch (e: Exception) {
            Log.e(TAG, "Error getting gold from save data: ${e.message}")
            null
        }
    }

    /**
     * Отримує balance з даних збереження проекту
     */
    fun getBalanceFromSaveData(projectSaveData: Map<String, Any>?): Double? {
        return try {
            if (projectSaveData == null) return null

            val projectJson = JSONObject(projectSaveData as Map<*, *>)
            val visitedFarmState = projectJson.optJSONObject("visitedFarmState") ?: return null

            val balance = visitedFarmState.optDouble("balance", 0.0)
            balance
        } catch (e: Exception) {
            Log.e(TAG, "Error getting balance from save data: ${e.message}")
            null
        }
    }

    /**
     * Отримує gem з даних збереження проекту
     */
    fun getGemFromSaveData(projectSaveData: Map<String, Any>?): Double? {
        return try {
            if (projectSaveData == null) return null

            val projectJson = JSONObject(projectSaveData as Map<*, *>)
            val visitedFarmState = projectJson.optJSONObject("visitedFarmState") ?: return null
            val inventory = visitedFarmState.optJSONObject("inventory") ?: return null

            val gem = inventory.optDouble("Gem", 0.0)
            gem
        } catch (e: Exception) {
            Log.e(TAG, "Error getting gem from save data: ${e.message}")
            null
        }
    }

    /**
     * Перевіряє чи є стан fullMoon у збереженні проекту
     */
    fun checkFullMoonFromSaveData(projectSaveData: Map<String, Any>?): Boolean {
        return try {
            if (projectSaveData == null) return false

            val projectJson = JSONObject(projectSaveData as Map<*, *>)
            val visitedFarmState = projectJson.optJSONObject("visitedFarmState") ?: projectJson
            val calendar = visitedFarmState.optJSONObject("calendar") ?: return false

            if (calendar.has("fullMoon")) {
                val fullMoonObj = calendar.opt("fullMoon")
                if (fullMoonObj is Boolean) return fullMoonObj
                if (fullMoonObj != null && fullMoonObj != JSONObject.NULL && fullMoonObj != "false") return true
            }
            false
        } catch (e: Exception) {
            Log.e(TAG, "Error checking fullMoon from save data: ${e.message}")
            false
        }
    }

    /**
     * Отримує пори року з даних збереження проекту (visitedFarmState.season.season або island.type)
     */
    fun getSeasonFromSaveData(projectSaveData: Map<String, Any>?): String? {
        return try {
            if (projectSaveData == null) return null
            val projectJson = JSONObject(projectSaveData as Map<*, *>)
            val visitedFarmState = projectJson.optJSONObject("visitedFarmState")
            
            // 1. Спочатку шукаємо у visitedFarmState.season.season
            val visitedSeasonObj = visitedFarmState?.optJSONObject("season")
            val visitedSeasonStr = visitedSeasonObj?.optString("season", "")
            if (!visitedSeasonStr.isNullOrBlank()) return visitedSeasonStr.lowercase(Locale.ROOT)

            // 2. Якщо не знайдено — шукаємо у верхньому season.season
            val topSeasonObj = projectJson.optJSONObject("season")
            val topSeasonStr = topSeasonObj?.optString("season", "")
            if (!topSeasonStr.isNullOrBlank()) return topSeasonStr.lowercase(Locale.ROOT)

            // 3. Також шукаємо у visitedFarmState.island.type або island.type
            val islandType = visitedFarmState?.optJSONObject("island")?.optString("type", "")?.takeIf { it.isNotBlank() }
                ?: projectJson.optJSONObject("island")?.optString("type", "")?.takeIf { it.isNotBlank() }
            if (!islandType.isNullOrBlank()) return islandType.lowercase(Locale.ROOT)

            null
        } catch (e: Exception) {
            Log.e(TAG, "Error getting season from save data: ${e.message}")
            null
        }
    }

    /**
     * Дані про скілпоїнти
     */
    private data class SkillPointsData(
        val xpTable: Map<Int, Long>,
        val skillsCost: Map<String, Int>
    )
}