package ua.diperon.slbotremote

/**
 * Глобальний кеш оперативної пам'яті для миттєвого (0 мс) відкриття екранів:
 * - «Всі доставки» (AllDeliveriesScreen)
 * - «Всі інвентарі» (AllInventoriesScreen)
 * 
 * Реалізує патерн Stale-While-Revalidate: екран показує закешовані дані відразу,
 * а у фоні тихо робить 1 швидкий пакетний запит до бекенду для актуалізації.
 */
object AppMemoryCache {
    // ─── Кеш доставок ───
    @Volatile
    var deliveriesData: Map<String, List<Delivery>>? = null

    @Volatile
    var deliveriesInventory: Map<String, List<InventoryItem>>? = null

    @Volatile
    var markedDeliveries: Map<String, Set<String>>? = null

    @Volatile
    var allProjectData: Map<String, ProjectData?>? = null

    @Volatile
    var deliveriesTimestamp: Long = 0L

    // ─── Кеш інвентарів та складів ───
    @Volatile
    var inventoriesData: Map<String, List<InventoryItem>>? = null

    @Volatile
    var stockData: Map<String, List<InventoryItem>>? = null

    @Volatile
    var categories: List<String>? = null

    @Volatile
    var itemToCategories: Map<String, List<String>>? = null

    @Volatile
    var allResources: List<String>? = null

    @Volatile
    var inventoriesTimestamp: Long = 0L

    fun clearAll() {
        deliveriesData = null
        deliveriesInventory = null
        markedDeliveries = null
        allProjectData = null
        deliveriesTimestamp = 0L
        inventoriesData = null
        stockData = null
        categories = null
        itemToCategories = null
        allResources = null
        inventoriesTimestamp = 0L
    }
}
