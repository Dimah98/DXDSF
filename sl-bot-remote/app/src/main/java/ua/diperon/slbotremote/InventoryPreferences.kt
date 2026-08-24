package ua.diperon.slbotremote

import android.content.Context
import android.content.SharedPreferences

/**
 * Менеджер для роботи з локальними налаштуваннями інвентаря (SharedPreferences).
 */
class InventoryPreferences(context: Context) {
    private val prefs: SharedPreferences = context.getSharedPreferences("inventory_prefs", Context.MODE_PRIVATE)

    companion object {
        private const val KEY_INVENTORY_ORDER = "inventory_order"
        // Значення за замовчуванням
        private const val DEFAULT_ORDER = "Золото, LV, FLOWER, Wood, Stone"
    }

    /**
     * Повертає збережений порядок предметів у вигляді списку рядків.
     */
    fun getInventoryOrder(): List<String> {
        val orderString = prefs.getString(KEY_INVENTORY_ORDER, DEFAULT_ORDER) ?: DEFAULT_ORDER
        return orderString.split(",").map { it.trim() }.filter { it.isNotEmpty() }
    }

    /**
     * Повертає збережений порядок у вигляді сирого рядка (для текстового поля).
     */
    fun getRawInventoryOrder(): String {
        return prefs.getString(KEY_INVENTORY_ORDER, DEFAULT_ORDER) ?: DEFAULT_ORDER
    }

    /**
     * Зберігає новий порядок предметів (сирий рядок).
     */
    fun saveInventoryOrder(order: String) {
        prefs.edit().putString(KEY_INVENTORY_ORDER, order).apply()
    }
}
