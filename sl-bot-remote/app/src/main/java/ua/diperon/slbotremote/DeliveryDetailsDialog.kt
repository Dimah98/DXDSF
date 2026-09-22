package ua.diperon.slbotremote

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bookmark
import androidx.compose.material.icons.filled.BookmarkBorder
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.OutdoorGrill
import androidx.compose.material.icons.filled.Restaurant
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import coil.compose.AsyncImage
import coil.request.ImageRequest
import ua.diperon.slbotremote.ui.theme.*
import java.util.Locale

/**
 * Модель рецепту страви у Sunflower Land
 */
data class Recipe(
    val name: String,
    val building: String,
    val ingredients: Map<String, Double>
)

/**
 * Рецепти всіх кухонних будівель Sunflower Land
 */
object SunflowerLandRecipes {
    val ALL_RECIPES = listOf(
        // Fire Pit / Багаття
        Recipe("Furikake Sprinkle", "Багаття", mapOf("Fish Flake" to 1.0, "Seaweed" to 1.0)),
        Recipe("Mashed Potato", "Багаття", mapOf("Potato" to 8.0)),
        Recipe("Pumpkin Soup", "Багаття", mapOf("Pumpkin" to 10.0)),
        Recipe("Reindeer Carrot", "Багаття", mapOf("Carrot" to 5.0)),
        Recipe("Mushroom Soup", "Багаття", mapOf("Wild Mushroom" to 5.0)),
        Recipe("Popcorn", "Багаття", mapOf("Sunflower" to 100.0, "Corn" to 5.0)),
        Recipe("Bumpkin Broth", "Багаття", mapOf("Carrot" to 10.0, "Cabbage" to 5.0)),
        Recipe("Cabbers n Mash", "Багаття", mapOf("Mashed Potato" to 10.0, "Cabbage" to 20.0)),
        Recipe("Boiled Eggs", "Багаття", mapOf("Egg" to 10.0)),
        Recipe("Kale Stew", "Багаття", mapOf("Kale" to 10.0)),
        Recipe("Kale Omelette", "Багаття", mapOf("Egg" to 40.0, "Kale" to 5.0)),
        Recipe("Gumbo", "Багаття", mapOf("Potato" to 50.0, "Pumpkin" to 30.0, "Carrot" to 20.0, "Red Snapper" to 3.0)),
        Recipe("Rapid Roast", "Багаття", mapOf("Magic Mushroom" to 1.0, "Pumpkin" to 40.0)),
        Recipe("Fried Tofu", "Багаття", mapOf("Soybean" to 15.0, "Sunflower" to 200.0)),
        Recipe("Rice Bun", "Багаття", mapOf("Rice" to 2.0, "Wheat" to 50.0)),
        Recipe("Antipasto", "Багаття", mapOf("Olive" to 2.0, "Grape" to 2.0)),
        Recipe("Pizza Margherita", "Багаття", mapOf("Tomato" to 30.0, "Cheese" to 5.0, "Wheat" to 20.0)),
        Recipe("Rhubarb Tart", "Багаття", mapOf("Rhubarb" to 3.0)),

        // Kitchen / Кухня
        Recipe("Surimi Rice Bowl", "Кухня", mapOf("Fish Stick" to 1.0, "Rice" to 1.0, "Onion" to 1.0)),
        Recipe("Creamy Crab Bite", "Кухня", mapOf("Crab Stick" to 1.0, "Cheese" to 3.0)),
        Recipe("Crimstone Infused Fish Oil", "Кухня", mapOf("Fish Oil" to 1.0, "Crimstone" to 1.0)),
        Recipe("Sunflower Crunch", "Кухня", mapOf("Sunflower" to 300.0)),
        Recipe("Mushroom Jacket Potatoes", "Кухня", mapOf("Wild Mushroom" to 10.0, "Potato" to 5.0)),
        Recipe("Fruit Salad", "Кухня", mapOf("Apple" to 1.0, "Orange" to 1.0, "Blueberry" to 1.0)),
        Recipe("Pancakes", "Кухня", mapOf("Wheat" to 10.0, "Egg" to 10.0, "Honey" to 6.0)),
        Recipe("Roast Veggies", "Кухня", mapOf("Cauliflower" to 15.0, "Carrot" to 10.0)),
        Recipe("Cauliflower Burger", "Кухня", mapOf("Cauliflower" to 15.0, "Wheat" to 5.0)),
        Recipe("Club Sandwich", "Кухня", mapOf("Sunflower" to 100.0, "Carrot" to 25.0, "Wheat" to 5.0)),
        Recipe("Bumpkin Salad", "Кухня", mapOf("Beetroot" to 20.0, "Parsnip" to 10.0)),
        Recipe("Bumpkin ganoush", "Кухня", mapOf("Eggplant" to 30.0, "Potato" to 50.0, "Parsnip" to 10.0)),
        Recipe("Goblin's Treat", "Кухня", mapOf("Pumpkin" to 10.0, "Radish" to 20.0, "Cabbage" to 10.0)),
        Recipe("Chowder", "Кухня", mapOf("Beetroot" to 10.0, "Wheat" to 10.0, "Parsnip" to 5.0, "Anchovy" to 3.0)),
        Recipe("Bumpkin Roast", "Кухня", mapOf("Mashed Potato" to 20.0, "Roast Veggies" to 5.0)),
        Recipe("Goblin Brunch", "Кухня", mapOf("Boiled Eggs" to 5.0, "Goblin's Treat" to 1.0)),
        Recipe("Beetroot Blaze", "Кухня", mapOf("Magic Mushroom" to 2.0, "Beetroot" to 50.0)),
        Recipe("Steamed Red Rice", "Кухня", mapOf("Rice" to 3.0, "Beetroot" to 50.0)),
        Recipe("Tofu Scramble", "Кухня", mapOf("Soybean" to 20.0, "Egg" to 20.0, "Cauliflower" to 10.0)),
        Recipe("Fried Calamari", "Кухня", mapOf("Sunflower" to 200.0, "Wheat" to 15.0, "Squid" to 1.0)),
        Recipe("Fish Burger", "Кухня", mapOf("Beetroot" to 10.0, "Wheat" to 10.0, "Horse Mackerel" to 1.0)),
        Recipe("Fish Omelette", "Кухня", mapOf("Egg" to 40.0, "Surgeonfish" to 1.0, "Butterflyfish" to 2.0)),
        Recipe("Ocean's Olive", "Кухня", mapOf("Olive Flounder" to 1.0, "Olive" to 2.0)),
        Recipe("Seafood Basket", "Кухня", mapOf("Blowfish" to 2.0, "Napoleanfish" to 2.0, "Sunfish" to 2.0)),
        Recipe("Fish n Chips", "Кухня", mapOf("Fancy Fries" to 1.0, "Halibut" to 1.0)),
        Recipe("Sushi Roll", "Кухня", mapOf("Angelfish" to 1.0, "Seaweed" to 1.0, "Rice" to 2.0)),
        Recipe("Caprese Salad", "Кухня", mapOf("Cheese" to 1.0, "Tomato" to 25.0, "Kale" to 20.0)),
        Recipe("Spaghetti al Limone", "Кухня", mapOf("Wheat" to 10.0, "Lemon" to 15.0, "Cheese" to 3.0)),

        // Deli / Делікатеси
        Recipe("Shroom Syrup", "Делікатеси", mapOf("Magic Mushroom" to 3.0, "Honey" to 20.0)),
        Recipe("Blue Cheese", "Делікатеси", mapOf("Cheese" to 2.0, "Blueberry" to 10.0)),
        Recipe("Honey Cheddar", "Делікатеси", mapOf("Cheese" to 3.0, "Honey" to 5.0)),
        Recipe("Fermented Fish", "Делікатеси", mapOf("Tuna" to 6.0)),
        Recipe("Blueberry Jam", "Делікатеси", mapOf("Blueberry" to 5.0)),
        Recipe("Fancy Fries", "Делікатеси", mapOf("Sunflower" to 500.0, "Potato" to 500.0)),
        Recipe("Sauerkraut", "Делікатеси", mapOf("Cabbage" to 20.0)),
        Recipe("Fermented Carrots", "Делікатеси", mapOf("Carrot" to 20.0)),
        Recipe("Cheese", "Делікатеси", mapOf("Milk" to 3.0)),

        // Smoothie Shack / Смузі-бар
        Recipe("Grape Juice", "Смузі-бар", mapOf("Grape" to 5.0, "Radish" to 20.0)),
        Recipe("Sour Shake", "Смузі-бар", mapOf("Lemon" to 20.0)),
        Recipe("Purple Smoothie", "Смузі-бар", mapOf("Blueberry" to 5.0, "Cabbage" to 10.0)),
        Recipe("Power Smoothie", "Смузі-бар", mapOf("Blueberry" to 10.0, "Kale" to 5.0)),
        Recipe("Orange Juice", "Смузі-бар", mapOf("Orange" to 5.0)),
        Recipe("Apple Juice", "Смузі-бар", mapOf("Apple" to 5.0)),
        Recipe("Bumpkin Detox", "Смузі-бар", mapOf("Apple" to 5.0, "Orange" to 5.0, "Carrot" to 10.0)),
        Recipe("The Lot", "Смузі-бар", mapOf("Blueberry" to 1.0, "Orange" to 1.0, "Grape" to 1.0, "Apple" to 1.0, "Banana" to 1.0)),
        Recipe("Banana Blast", "Смузі-бар", mapOf("Banana" to 10.0, "Egg" to 10.0)),
        Recipe("Slow Juice", "Смузі-бар", mapOf("Grape" to 10.0, "Kale" to 100.0)),
        Recipe("Carrot Juice", "Смузі-бар", mapOf("Carrot" to 30.0)),
        Recipe("Quick Juice", "Смузі-бар", mapOf("Sunflower" to 50.0, "Pumpkin" to 40.0)),

        // Bakery / Пекарня
        Recipe("Lemon Cheesecake", "Пекарня", mapOf("Lemon" to 20.0, "Cheese" to 5.0, "Egg" to 40.0)),
        Recipe("Honey Cake", "Пекарня", mapOf("Honey" to 10.0, "Wheat" to 10.0, "Egg" to 20.0)),
        Recipe("Orange Cake", "Пекарня", mapOf("Orange" to 5.0, "Egg" to 30.0, "Wheat" to 10.0)),
        Recipe("Apple Pie", "Пекарня", mapOf("Apple" to 5.0, "Wheat" to 10.0, "Egg" to 20.0)),
        Recipe("Kale & Mushroom Pie", "Пекарня", mapOf("Wild Mushroom" to 10.0, "Kale" to 5.0, "Wheat" to 5.0)),
        Recipe("Sunflower Cake", "Пекарня", mapOf("Sunflower" to 1000.0, "Wheat" to 10.0, "Egg" to 30.0)),
        Recipe("Potato Cake", "Пекарня", mapOf("Potato" to 500.0, "Wheat" to 10.0, "Egg" to 30.0)),
        Recipe("Pumpkin Cake", "Пекарня", mapOf("Pumpkin" to 130.0, "Wheat" to 10.0, "Egg" to 30.0)),
        Recipe("Eggplant Cake", "Пекарня", mapOf("Eggplant" to 30.0, "Wheat" to 10.0, "Egg" to 30.0)),
        Recipe("Carrot Cake", "Пекарня", mapOf("Carrot" to 120.0, "Wheat" to 10.0, "Egg" to 30.0)),
        Recipe("Cabbage Cake", "Пекарня", mapOf("Cabbage" to 90.0, "Wheat" to 10.0, "Egg" to 30.0)),
        Recipe("Beetroot Cake", "Пекарня", mapOf("Beetroot" to 100.0, "Wheat" to 10.0, "Egg" to 30.0)),
        Recipe("Parsnip Cake", "Пекарня", mapOf("Parsnip" to 45.0, "Wheat" to 10.0, "Egg" to 30.0)),
        Recipe("Cauliflower Cake", "Пекарня", mapOf("Cauliflower" to 60.0, "Wheat" to 10.0, "Egg" to 30.0)),
        Recipe("Cornbread", "Пекарня", mapOf("Corn" to 15.0, "Wheat" to 5.0, "Egg" to 10.0)),
        Recipe("Radish Cake", "Пекарня", mapOf("Radish" to 25.0, "Wheat" to 10.0, "Egg" to 30.0)),
        Recipe("Wheat Cake", "Пекарня", mapOf("Wheat" to 35.0, "Egg" to 30.0))
    )

    fun findRecipe(name: String): Recipe? {
        val clean = name.trim().lowercase()
        return ALL_RECIPES.find { it.name.trim().lowercase() == clean }
    }
}

/**
 * Отримує кількість предмета в інвентарі з урахуванням різних регістрів і форматів
 */
fun getDeliveryInventoryAmount(inventoryMap: Map<String, Double>, itemName: String): Double {
    val clean = itemName.lowercase().trim()
    val cleanUnderscore = clean.replace(" ", "_")
    val cleanSpace = clean.replace("_", " ")
    return inventoryMap[itemName]
        ?: inventoryMap[clean]
        ?: inventoryMap[cleanUnderscore]
        ?: inventoryMap[cleanSpace]
        ?: 0.0
}

/**
 * Форматування кількості
 */
fun formatDeliveryAmount(value: Double): String {
    return if (value % 1.0 == 0.0) {
        value.toInt().toString()
    } else {
        String.format(Locale.US, "%.1f", value)
    }
}

/**
 * Формування посилання на картинку предмета
 */
fun getDeliveryItemImageUrl(baseUrl: String, itemName: String): String {
    val clean = itemName.lowercase().trim().replace(" ", "_")
    return if (baseUrl.isNotBlank()) {
        "$baseUrl/api/im/$clean.png"
    } else {
        "file:///android_asset/im/$clean.png"
    }
}

/**
 * Модель вимоги до інгредієнта
 */
data class IngredientRequirement(
    val name: String,
    val neededPerUnit: Double,
    val totalNeeded: Double,
    val inInventory: Double,
    val isAvailable: Boolean,
    val subRecipe: Recipe? = null
)

/**
 * Інформація про страву, якої не вистачає
 */
data class MissingDishInfo(
    val dishName: String,
    val building: String,
    val missingCount: Double,
    val ingredients: List<IngredientRequirement>,
    val canCookAll: Boolean
)

/**
 * Діалогове вікно детальної інформації про доставку та необхідні інгредієнти
 */
@Composable
fun DeliveryDetailsDialog(
    delivery: Delivery,
    projectName: String,
    inventoryMap: Map<String, Double>,
    baseUrl: String = "",
    isMarked: Boolean = false,
    onToggleMark: (() -> Unit)? = null,
    onDismiss: () -> Unit
) {
    val context = LocalContext.current
    val isCompleted = delivery.completedAt != null

    // Перевіряємо статус доступності кожного предмета
    val deliveryItemsStatus = remember(delivery, inventoryMap) {
        delivery.items.map { (itemName, requiredAmount) ->
            val available = getDeliveryInventoryAmount(inventoryMap, itemName)
            val isSufficient = available >= requiredAmount
            val missing = (requiredAmount - available).coerceAtLeast(0.0)
            Triple(itemName, requiredAmount, Pair(available, missing))
        }
    }

    val hasSufficientResources = remember(deliveryItemsStatus) {
        deliveryItemsStatus.all { it.third.first >= it.second }
    }

    // Аналізуємо страви, яких не вистачає, та їхні рецепти
    val missingDishes = remember(delivery, inventoryMap) {
        val list = mutableListOf<MissingDishInfo>()
        delivery.items.forEach { (itemName, requiredAmount) ->
            val available = getDeliveryInventoryAmount(inventoryMap, itemName)
            val missingCount = requiredAmount - available
            if (missingCount > 0) {
                val recipe = SunflowerLandRecipes.findRecipe(itemName)
                if (recipe != null) {
                    val ingredients = recipe.ingredients.map { (ingName, perUnit) ->
                        val totalNeeded = perUnit * missingCount
                        val inInv = getDeliveryInventoryAmount(inventoryMap, ingName)
                        val subRecipe = SunflowerLandRecipes.findRecipe(ingName)
                        IngredientRequirement(
                            name = ingName,
                            neededPerUnit = perUnit,
                            totalNeeded = totalNeeded,
                            inInventory = inInv,
                            isAvailable = inInv >= totalNeeded,
                            subRecipe = subRecipe
                        )
                    }
                    val canCook = ingredients.all { it.isAvailable }
                    list.add(
                        MissingDishInfo(
                            dishName = itemName,
                            building = recipe.building,
                            missingCount = missingCount,
                            ingredients = ingredients,
                            canCookAll = canCook
                        )
                    )
                }
            }
        }
        list
    }

    // Загальний колір теми вікна
    val statusColor = when {
        isMarked -> GlassIndigo
        isCompleted -> GlassSuccess
        hasSufficientResources -> GlassWarning
        else -> GlassError
    }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Card(
            modifier = Modifier
                .fillMaxWidth(0.94f)
                .fillMaxHeight(0.88f)
                .padding(vertical = 16.dp),
            shape = RoundedCornerShape(24.dp),
            colors = CardDefaults.cardColors(
                containerColor = Color(0xFF0D121F)
            ),
            border = BorderStroke(1.5.dp, statusColor.copy(alpha = 0.8f)),
            elevation = CardDefaults.cardElevation(defaultElevation = 12.dp)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(16.dp)
            ) {
                // ─── ШАПКА ДІАЛОГУ ───
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                        modifier = Modifier.weight(1f)
                    ) {
                        // Аватар NPC
                        Box(
                            modifier = Modifier
                                .size(54.dp)
                                .clip(RoundedCornerShape(14.dp))
                                .background(Color.White.copy(alpha = 0.08f))
                                .border(1.dp, Color.White.copy(alpha = 0.15f), RoundedCornerShape(14.dp)),
                            contentAlignment = Alignment.Center
                        ) {
                            val npcFile = getNpcFileName(delivery.from)
                            val npcImgUrl = if (baseUrl.isNotBlank()) "$baseUrl/api/im/$npcFile.png" else "file:///android_asset/im/$npcFile.png"
                            AsyncImage(
                                model = ImageRequest.Builder(context)
                                    .data(npcImgUrl)
                                    .crossfade(true)
                                    .build(),
                                contentDescription = delivery.from,
                                modifier = Modifier
                                    .size(46.dp)
                                    .padding(2.dp),
                                contentScale = ContentScale.Fit
                            )
                        }

                        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                // Назва проекту
                                Surface(
                                    color = MaterialTheme.colorScheme.primary.copy(alpha = 0.2f),
                                    shape = RoundedCornerShape(6.dp),
                                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.primary.copy(alpha = 0.4f))
                                ) {
                                    Text(
                                        text = projectName,
                                        style = MaterialTheme.typography.labelSmall,
                                        color = MaterialTheme.colorScheme.primary,
                                        fontWeight = FontWeight.Bold,
                                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                                        fontSize = 10.sp
                                    )
                                }

                                // Статус бейдж
                                val (statusText, badgeBg, badgeTextColor) = when {
                                    isCompleted -> Triple("Виконано", GlassSuccess.copy(alpha = 0.2f), GlassSuccess)
                                    hasSufficientResources -> Triple("Готово до здачі", GlassWarning.copy(alpha = 0.2f), GlassWarning)
                                    else -> Triple("Потрібні ресурси", GlassError.copy(alpha = 0.2f), GlassError)
                                }
                                Surface(
                                    color = badgeBg,
                                    shape = RoundedCornerShape(6.dp),
                                    border = BorderStroke(1.dp, badgeTextColor.copy(alpha = 0.4f))
                                ) {
                                    Text(
                                        text = statusText,
                                        style = MaterialTheme.typography.labelSmall,
                                        color = badgeTextColor,
                                        fontWeight = FontWeight.Bold,
                                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                                        fontSize = 10.sp
                                    )
                                }
                            }

                            // Ім'я NPC
                            Text(
                                text = delivery.from.replaceFirstChar { if (it.isLowerCase()) it.titlecase(Locale.getDefault()) else it.toString() },
                                style = MaterialTheme.typography.titleMedium,
                                color = Color.White,
                                fontWeight = FontWeight.Bold,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                        }
                    }

                    // Кнопка закрити
                    IconButton(
                        onClick = onDismiss,
                        modifier = Modifier
                            .size(32.dp)
                            .background(Color.White.copy(alpha = 0.08f), CircleShape)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Close,
                            contentDescription = "Закрити",
                            tint = Color.White.copy(alpha = 0.8f),
                            modifier = Modifier.size(18.dp)
                        )
                    }
                }

                HorizontalDivider(
                    modifier = Modifier.padding(vertical = 12.dp),
                    color = Color.White.copy(alpha = 0.08f)
                )

                // ─── ОСНОВНЕ ТІЛО (СКРОЛЛ) ───
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    // 1. Потрібні предмети для доставки
                    Card(
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = Color.White.copy(alpha = 0.04f)),
                        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.08f))
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(12.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Text(
                                text = "ЗАМОВЛЕНІ ПРЕДМЕТИ",
                                style = MaterialTheme.typography.labelSmall,
                                color = GlassOnSurfaceVariant,
                                fontWeight = FontWeight.Bold,
                                letterSpacing = 1.sp,
                                fontSize = 11.sp
                            )

                            deliveryItemsStatus.forEach { (itemName, reqAmount, invData) ->
                                val (available, missing) = invData
                                val isOk = available >= reqAmount

                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .background(
                                            if (isOk) GlassSuccess.copy(alpha = 0.07f) else GlassError.copy(alpha = 0.07f),
                                            RoundedCornerShape(10.dp)
                                        )
                                        .border(
                                            1.dp,
                                            if (isOk) GlassSuccess.copy(alpha = 0.25f) else GlassError.copy(alpha = 0.25f),
                                            RoundedCornerShape(10.dp)
                                        )
                                        .padding(horizontal = 10.dp, vertical = 8.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                                        modifier = Modifier.weight(1f)
                                    ) {
                                        AsyncImage(
                                            model = ImageRequest.Builder(context)
                                                .data(getDeliveryItemImageUrl(baseUrl, itemName))
                                                .crossfade(true)
                                                .build(),
                                            contentDescription = itemName,
                                            modifier = Modifier.size(26.dp),
                                            contentScale = ContentScale.Fit
                                        )
                                        Column {
                                            Text(
                                                text = itemName,
                                                style = MaterialTheme.typography.bodyMedium,
                                                color = Color.White,
                                                fontWeight = FontWeight.SemiBold,
                                                fontSize = 13.sp
                                            )
                                            val recipe = SunflowerLandRecipes.findRecipe(itemName)
                                            if (recipe != null) {
                                                Text(
                                                    text = "Страва (${recipe.building})",
                                                    style = MaterialTheme.typography.labelSmall,
                                                    color = GlassIndigoLight,
                                                    fontSize = 10.sp
                                                )
                                            }
                                        }
                                    }

                                    // Наявність / Вимога
                                    Column(horizontalAlignment = Alignment.End) {
                                        Row(
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                                        ) {
                                            Text(
                                                text = "${formatDeliveryAmount(available)} / ${formatDeliveryAmount(reqAmount)}",
                                                style = MaterialTheme.typography.bodyMedium,
                                                color = if (isOk) GlassSuccess else GlassError,
                                                fontWeight = FontWeight.Bold,
                                                fontSize = 13.sp
                                            )
                                            if (isOk) {
                                                Icon(
                                                    imageVector = Icons.Default.Check,
                                                    contentDescription = "Є",
                                                    tint = GlassSuccess,
                                                    modifier = Modifier.size(16.dp)
                                                )
                                            }
                                        }
                                        if (!isOk) {
                                            Text(
                                                text = "Бракує: ${formatDeliveryAmount(missing)}",
                                                style = MaterialTheme.typography.labelSmall,
                                                color = GlassError,
                                                fontSize = 10.sp,
                                                fontWeight = FontWeight.Bold
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // 2. Секція приготування відсутніх страв (якщо є)
                    if (missingDishes.isNotEmpty()) {
                        Card(
                            shape = RoundedCornerShape(16.dp),
                            colors = CardDefaults.cardColors(containerColor = Color.White.copy(alpha = 0.04f)),
                            border = BorderStroke(1.dp, GlassIndigo.copy(alpha = 0.3f))
                        ) {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(12.dp),
                                verticalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.Restaurant,
                                        contentDescription = null,
                                        tint = GlassIndigoLight,
                                        modifier = Modifier.size(16.dp)
                                    )
                                    Text(
                                        text = "РЕЦЕПТИ ДЛЯ ПРИГОТУВАННЯ",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = GlassIndigoLight,
                                        fontWeight = FontWeight.Bold,
                                        letterSpacing = 1.sp,
                                        fontSize = 11.sp
                                    )
                                }

                                missingDishes.forEach { dish ->
                                    val dishBorderColor = if (dish.canCookAll) GlassSuccess.copy(alpha = 0.4f) else GlassError.copy(alpha = 0.4f)
                                    val dishBgColor = if (dish.canCookAll) GlassSuccess.copy(alpha = 0.05f) else GlassError.copy(alpha = 0.05f)

                                    Card(
                                        shape = RoundedCornerShape(12.dp),
                                        colors = CardDefaults.cardColors(containerColor = dishBgColor),
                                        border = BorderStroke(1.dp, dishBorderColor),
                                        modifier = Modifier.fillMaxWidth()
                                    ) {
                                        Column(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .padding(10.dp),
                                            verticalArrangement = Arrangement.spacedBy(8.dp)
                                        ) {
                                            // Заголовок страви
                                            Row(
                                                modifier = Modifier.fillMaxWidth(),
                                                verticalAlignment = Alignment.CenterVertically,
                                                horizontalArrangement = Arrangement.SpaceBetween
                                            ) {
                                                Row(
                                                    verticalAlignment = Alignment.CenterVertically,
                                                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                                                ) {
                                                    AsyncImage(
                                                        model = ImageRequest.Builder(context)
                                                            .data(getDeliveryItemImageUrl(baseUrl, dish.dishName))
                                                            .crossfade(true)
                                                            .build(),
                                                        contentDescription = dish.dishName,
                                                        modifier = Modifier.size(24.dp),
                                                        contentScale = ContentScale.Fit
                                                    )
                                                    Text(
                                                        text = dish.dishName,
                                                        style = MaterialTheme.typography.titleSmall,
                                                        color = Color.White,
                                                        fontWeight = FontWeight.Bold,
                                                        fontSize = 13.sp
                                                    )
                                                    Surface(
                                                        color = GlassIndigo.copy(alpha = 0.25f),
                                                        shape = RoundedCornerShape(4.dp)
                                                    ) {
                                                        Text(
                                                            text = dish.building,
                                                            color = GlassIndigoLight,
                                                            fontSize = 9.sp,
                                                            fontWeight = FontWeight.Bold,
                                                            modifier = Modifier.padding(horizontal = 4.dp, vertical = 1.dp)
                                                        )
                                                    }
                                                }

                                                Surface(
                                                    color = if (dish.canCookAll) GlassSuccess.copy(alpha = 0.2f) else GlassError.copy(alpha = 0.2f),
                                                    shape = RoundedCornerShape(6.dp)
                                                ) {
                                                    Text(
                                                        text = if (dish.canCookAll) "Можна зварити ✓" else "Бракує складників ✗",
                                                        color = if (dish.canCookAll) GlassSuccess else GlassError,
                                                        fontSize = 10.sp,
                                                        fontWeight = FontWeight.Bold,
                                                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                                    )
                                                }
                                            }

                                            Text(
                                                text = "Треба приготувати: ${formatDeliveryAmount(dish.missingCount)} шт.",
                                                style = MaterialTheme.typography.bodySmall,
                                                color = Color.White.copy(alpha = 0.7f),
                                                fontSize = 11.sp
                                            )

                                            // Список інгредієнтів
                                            Column(
                                                verticalArrangement = Arrangement.spacedBy(4.dp),
                                                modifier = Modifier.fillMaxWidth()
                                            ) {
                                                dish.ingredients.forEach { ing ->
                                                    Row(
                                                        modifier = Modifier
                                                            .fillMaxWidth()
                                                            .background(Color.Black.copy(alpha = 0.2f), RoundedCornerShape(6.dp))
                                                            .padding(horizontal = 8.dp, vertical = 5.dp),
                                                        verticalAlignment = Alignment.CenterVertically,
                                                        horizontalArrangement = Arrangement.SpaceBetween
                                                    ) {
                                                        Row(
                                                            verticalAlignment = Alignment.CenterVertically,
                                                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                                                        ) {
                                                            AsyncImage(
                                                                model = ImageRequest.Builder(context)
                                                                    .data(getDeliveryItemImageUrl(baseUrl, ing.name))
                                                                    .crossfade(true)
                                                                    .build(),
                                                                contentDescription = ing.name,
                                                                modifier = Modifier.size(18.dp),
                                                                contentScale = ContentScale.Fit
                                                            )
                                                            Text(
                                                                text = ing.name,
                                                                style = MaterialTheme.typography.bodySmall,
                                                                color = Color.White,
                                                                fontSize = 11.sp
                                                            )
                                                        }

                                                        Row(
                                                            verticalAlignment = Alignment.CenterVertically,
                                                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                                                        ) {
                                                            Text(
                                                                text = "треба: ${formatDeliveryAmount(ing.totalNeeded)}",
                                                                style = MaterialTheme.typography.bodySmall,
                                                                color = Color.White.copy(alpha = 0.6f),
                                                                fontSize = 10.sp
                                                            )
                                                            Text(
                                                                text = "в наявності: ${formatDeliveryAmount(ing.inInventory)}",
                                                                style = MaterialTheme.typography.bodySmall,
                                                                color = if (ing.isAvailable) GlassSuccess else GlassError,
                                                                fontWeight = FontWeight.Bold,
                                                                fontSize = 10.sp
                                                            )
                                                            if (ing.isAvailable) {
                                                                Icon(
                                                                    imageVector = Icons.Default.Check,
                                                                    contentDescription = "Вистачає",
                                                                    tint = GlassSuccess,
                                                                    modifier = Modifier.size(14.dp)
                                                                )
                                                            } else {
                                                                Text(
                                                                    text = "(-${formatDeliveryAmount(ing.totalNeeded - ing.inInventory)})",
                                                                    color = GlassError,
                                                                    fontSize = 9.sp,
                                                                    fontWeight = FontWeight.Bold
                                                                )
                                                            }
                                                        }
                                                    }

                                                    // Підказка, якщо цей інгредієнт сам є стравою
                                                    if (ing.subRecipe != null && !ing.isAvailable) {
                                                        Row(
                                                            modifier = Modifier
                                                                .fillMaxWidth()
                                                                .padding(start = 24.dp, bottom = 2.dp),
                                                            verticalAlignment = Alignment.CenterVertically
                                                        ) {
                                                            Text(
                                                                text = "↳ Готується в «${ing.subRecipe.building}»: ${ing.subRecipe.ingredients.entries.joinToString { "${formatDeliveryAmount(it.value * (ing.totalNeeded - ing.inInventory))} ${it.key}" }}",
                                                                style = MaterialTheme.typography.labelSmall,
                                                                color = GlassWarningLight,
                                                                fontSize = 9.sp
                                                            )
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    } else if (hasSufficientResources) {
                        Card(
                            shape = RoundedCornerShape(14.dp),
                            colors = CardDefaults.cardColors(containerColor = GlassSuccess.copy(alpha = 0.08f)),
                            border = BorderStroke(1.dp, GlassSuccess.copy(alpha = 0.3f))
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(12.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Check,
                                    contentDescription = null,
                                    tint = GlassSuccess,
                                    modifier = Modifier.size(20.dp)
                                )
                                Text(
                                    text = "Всі необхідні страви та ресурси вже є в інвентарі! Можна здавати замовлення.",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = Color.White.copy(alpha = 0.9f),
                                    fontSize = 11.sp
                                )
                            }
                        }
                    } else if (!isCompleted) {
                        Card(
                            shape = RoundedCornerShape(14.dp),
                            colors = CardDefaults.cardColors(containerColor = Color.White.copy(alpha = 0.04f)),
                            border = BorderStroke(1.dp, Color.White.copy(alpha = 0.08f))
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(12.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Info,
                                    contentDescription = null,
                                    tint = GlassWarning,
                                    modifier = Modifier.size(18.dp)
                                )
                                Text(
                                    text = "Відсутні предмети є культурами чи ресурсами (не потребують приготування).",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = Color.White.copy(alpha = 0.7f),
                                    fontSize = 11.sp
                                )
                            }
                        }
                    }

                    // 3. Нагорода
                    val reward = delivery.reward
                    val hasCoins = (reward?.coins != null && reward.coins > 0)
                    val hasSfl = (reward?.sfl != null && reward.sfl > 0)
                    val hasItems = !reward?.items.isNullOrEmpty()

                    if (hasCoins || hasSfl || hasItems) {
                        Card(
                            shape = RoundedCornerShape(16.dp),
                            colors = CardDefaults.cardColors(containerColor = Color.White.copy(alpha = 0.04f)),
                            border = BorderStroke(1.dp, Color.White.copy(alpha = 0.08f))
                        ) {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(12.dp),
                                verticalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Text(
                                    text = "НАГОРОДА ЗА ВИКОНАННЯ",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = GlassOnSurfaceVariant,
                                    fontWeight = FontWeight.Bold,
                                    letterSpacing = 1.sp,
                                    fontSize = 11.sp
                                )

                                Row(
                                    horizontalArrangement = Arrangement.spacedBy(16.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    if (hasCoins) {
                                        Row(
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                                        ) {
                                            AsyncImage(
                                                model = ImageRequest.Builder(context)
                                                    .data("file:///android_asset/im/coins.png")
                                                    .crossfade(true)
                                                    .build(),
                                                contentDescription = "Монети",
                                                modifier = Modifier.size(20.dp)
                                            )
                                            val coinsVal = reward?.coins ?: 0.0
                                            Text(
                                                text = "${formatDeliveryAmount(coinsVal)} Coins",
                                                style = MaterialTheme.typography.bodyMedium,
                                                color = GlassWarning,
                                                fontWeight = FontWeight.Bold,
                                                fontSize = 13.sp
                                            )
                                        }
                                    }

                                    if (hasSfl) {
                                        Row(
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                                        ) {
                                            AsyncImage(
                                                model = ImageRequest.Builder(context)
                                                    .data("file:///android_asset/im/sfl.png")
                                                    .crossfade(true)
                                                    .build(),
                                                contentDescription = "SFL",
                                                modifier = Modifier.size(20.dp)
                                            )
                                            Text(
                                                text = "${String.format(Locale.US, "%.2f", reward?.sfl ?: 0.0)} SFL",
                                                style = MaterialTheme.typography.bodyMedium,
                                                color = GlassWarning,
                                                fontWeight = FontWeight.Bold,
                                                fontSize = 13.sp
                                            )
                                        }
                                    }

                                    if (hasItems) {
                                        reward?.items?.forEach { (itName, count) ->
                                            val countStr = when (count) {
                                                is Number -> {
                                                    val d = count.toDouble()
                                                    if (d % 1.0 == 0.0) d.toLong().toString() else String.format(Locale.US, "%.1f", d)
                                                }
                                                else -> count.toString()
                                            }
                                            Row(
                                                verticalAlignment = Alignment.CenterVertically,
                                                horizontalArrangement = Arrangement.spacedBy(4.dp)
                                            ) {
                                                AsyncImage(
                                                    model = ImageRequest.Builder(context)
                                                        .data(getDeliveryItemImageUrl(baseUrl, itName))
                                                        .crossfade(true)
                                                        .build(),
                                                    contentDescription = itName,
                                                    modifier = Modifier.size(18.dp)
                                                )
                                                Text(
                                                    text = "$countStr $itName",
                                                    style = MaterialTheme.typography.bodyMedium,
                                                    color = Color.White,
                                                    fontWeight = FontWeight.SemiBold,
                                                    fontSize = 12.sp
                                                )
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                HorizontalDivider(
                    modifier = Modifier.padding(vertical = 10.dp),
                    color = Color.White.copy(alpha = 0.08f)
                )

                // ─── ФУТЕР З КНОПКАМИ ───
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    if (onToggleMark != null) {
                        OutlinedButton(
                            onClick = onToggleMark,
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(12.dp),
                            border = BorderStroke(
                                1.dp,
                                if (isMarked) GlassIndigo else Color.White.copy(alpha = 0.2f)
                            ),
                            colors = ButtonDefaults.outlinedButtonColors(
                                containerColor = if (isMarked) GlassIndigo.copy(alpha = 0.2f) else Color.Transparent
                            )
                        ) {
                            Icon(
                                imageVector = if (isMarked) Icons.Default.Bookmark else Icons.Default.BookmarkBorder,
                                contentDescription = null,
                                tint = if (isMarked) GlassIndigoLight else Color.White.copy(alpha = 0.7f),
                                modifier = Modifier.size(16.dp)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = if (isMarked) "Відмічено" else "Поставити мітку",
                                color = if (isMarked) GlassIndigoLight else Color.White.copy(alpha = 0.8f),
                                fontSize = 12.sp,
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                    }

                    Button(
                        onClick = onDismiss,
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = MaterialTheme.colorScheme.primary
                        )
                    ) {
                        Text(
                            text = "Закрити",
                            color = Color.Black,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        }
    }
}
