package ua.diperon.slbotremote

import android.content.Context
import androidx.compose.animation.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
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
import coil.compose.AsyncImage
import coil.request.ImageRequest
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import ua.diperon.slbotremote.ui.theme.*
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Налаштування видимості 17 секцій карток (синхронно з веб-версією)
 */
data class FarmCardDisplaySettings(
    val showTitleHeader: Boolean = true,
    val showDeliveriesActivity: Boolean = true,
    val showCrops: Boolean = true,
    val showSeasonalCropSeeds: Boolean = true,
    val showFruitTrees: Boolean = true,
    val showSeasonalFruitSeeds: Boolean = true,
    val showChickens: Boolean = true,
    val showResources: Boolean = true,
    val showTools: Boolean = true,
    val showFlowers: Boolean = true,
    val showSeasonalFlowerSeeds: Boolean = true,
    val showCooking: Boolean = true,
    val showComposters: Boolean = true,
    val showBigFruits: Boolean = true,
    val showFishing: Boolean = true,
    val showIslandUpgrade: Boolean = true,
    val showTimeline: Boolean = true
)

object FarmCardSettingsManager {
    private const val PREFS_NAME = "sf_farm_cards_prefs"

    fun load(context: Context): FarmCardDisplaySettings {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return FarmCardDisplaySettings(
            showTitleHeader = prefs.getBoolean("showTitleHeader", true),
            showDeliveriesActivity = prefs.getBoolean("showDeliveriesActivity", true),
            showCrops = prefs.getBoolean("showCrops", true),
            showSeasonalCropSeeds = prefs.getBoolean("showSeasonalCropSeeds", true),
            showFruitTrees = prefs.getBoolean("showFruitTrees", true),
            showSeasonalFruitSeeds = prefs.getBoolean("showSeasonalFruitSeeds", true),
            showChickens = prefs.getBoolean("showChickens", true),
            showResources = prefs.getBoolean("showResources", true),
            showTools = prefs.getBoolean("showTools", true),
            showFlowers = prefs.getBoolean("showFlowers", true),
            showSeasonalFlowerSeeds = prefs.getBoolean("showSeasonalFlowerSeeds", true),
            showCooking = prefs.getBoolean("showCooking", true),
            showComposters = prefs.getBoolean("showComposters", true),
            showBigFruits = prefs.getBoolean("showBigFruits", true),
            showFishing = prefs.getBoolean("showFishing", true),
            showIslandUpgrade = prefs.getBoolean("showIslandUpgrade", true),
            showTimeline = prefs.getBoolean("showTimeline", true)
        )
    }

    fun save(context: Context, settings: FarmCardDisplaySettings) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().apply {
            putBoolean("showTitleHeader", settings.showTitleHeader)
            putBoolean("showDeliveriesActivity", settings.showDeliveriesActivity)
            putBoolean("showCrops", settings.showCrops)
            putBoolean("showSeasonalCropSeeds", settings.showSeasonalCropSeeds)
            putBoolean("showFruitTrees", settings.showFruitTrees)
            putBoolean("showSeasonalFruitSeeds", settings.showSeasonalFruitSeeds)
            putBoolean("showChickens", settings.showChickens)
            putBoolean("showResources", settings.showResources)
            putBoolean("showTools", settings.showTools)
            putBoolean("showFlowers", settings.showFlowers)
            putBoolean("showSeasonalFlowerSeeds", settings.showSeasonalFlowerSeeds)
            putBoolean("showCooking", settings.showCooking)
            putBoolean("showComposters", settings.showComposters)
            putBoolean("showBigFruits", settings.showBigFruits)
            putBoolean("showFishing", settings.showFishing)
            putBoolean("showIslandUpgrade", settings.showIslandUpgrade)
            putBoolean("showTimeline", settings.showTimeline)
            apply()
        }
    }
}

/**
 * Допоміжні функції форматування часу
 */
fun formatFarmRemainingTime(ms: Long): String {
    if (ms <= 0) return "Готово"
    val totalSeconds = ms / 1000
    val hours = totalSeconds / 3600
    val minutes = (totalSeconds % 3600) / 60
    val seconds = totalSeconds % 60

    return when {
        hours > 0 -> "${hours}г ${minutes}хв"
        minutes > 0 -> "${minutes}хв ${seconds}с"
        else -> "${seconds}с"
    }
}

/**
 * Головний екран карток проектів (Farm Cards Overview) для Android
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FarmCardsScreen(
    apiService: BotApiService,
    onBackClick: () -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val baseUrl = remember { ConnectionConfigManager(context).getHttpUrl().removeSuffix("/") }

    var cards by remember { mutableStateOf<List<FarmCardData>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var isRefreshing by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    var clientFetchTime by remember { mutableLongStateOf(System.currentTimeMillis()) }
    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }

    var searchQuery by remember { mutableStateOf("") }
    var isSearchActive by remember { mutableStateOf(false) }
    var isSettingsDialogOpen by remember { mutableStateOf(false) }

    var settings by remember { mutableStateOf(FarmCardSettingsManager.load(context)) }

    // Завантаження карток з бекенду
    val loadFarmCards: () -> Unit = {
        scope.launch {
            if (cards.isEmpty()) {
                isLoading = true
            } else {
                isRefreshing = true
            }
            errorMessage = null

            try {
                val response = apiService.getAllFarmCards()
                if (response.success) {
                    cards = response.cards
                    clientFetchTime = System.currentTimeMillis()
                } else {
                    errorMessage = response.error ?: "Не вдалося отримати карточки проектів"
                }
            } catch (e: Exception) {
                errorMessage = "Помилка завантаження: ${e.localizedMessage ?: e.message}"
            } finally {
                isLoading = false
                isRefreshing = false
            }
        }
    }

    // Перше завантаження та автооновлення кожні 45 секунд
    LaunchedEffect(Unit) {
        loadFarmCards()
        while (true) {
            delay(45000)
            loadFarmCards()
        }
    }

    // Тікер секунд для плавного зворотного відліку таймерів
    LaunchedEffect(Unit) {
        while (true) {
            delay(1000)
            now = System.currentTimeMillis()
        }
    }

    val elapsedSinceFetch = now - clientFetchTime

    // Фільтрація карток за пошуковим запитом
    val filteredCards = remember(cards, searchQuery) {
        if (searchQuery.isBlank()) {
            cards
        } else {
            val q = searchQuery.trim().lowercase(Locale.ROOT)
            cards.filter {
                it.projectName.lowercase(Locale.ROOT).contains(q) ||
                it.islandType.lowercase(Locale.ROOT).contains(q)
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    if (isSearchActive) {
                        OutlinedTextField(
                            value = searchQuery,
                            onValueChange = { searchQuery = it },
                            placeholder = { Text("Пошук проекту...", fontSize = 14.sp, color = GlassOnSurfaceDim) },
                            singleLine = true,
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = GlassIndigoLight,
                                unfocusedBorderColor = Color.White.copy(alpha = 0.2f),
                                focusedTextColor = Color.White,
                                unfocusedTextColor = Color.White
                            ),
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(48.dp)
                        )
                    } else {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                text = "Карточки Проектів",
                                fontSize = 18.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color.White
                            )
                            if (cards.isNotEmpty()) {
                                Spacer(modifier = Modifier.width(8.dp))
                                Box(
                                    modifier = Modifier
                                        .background(Color(0xFF334155), RoundedCornerShape(12.dp))
                                        .border(1.dp, Color(0xFF475569), RoundedCornerShape(12.dp))
                                        .padding(horizontal = 8.dp, vertical = 2.dp)
                                ) {
                                    Text(
                                        text = "${filteredCards.size}/${cards.size}",
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        color = Color(0xFFFBBF24)
                                    )
                                }
                            }
                        }
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Назад",
                            tint = Color.White
                        )
                    }
                },
                actions = {
                    IconButton(onClick = {
                        isSearchActive = !isSearchActive
                        if (!isSearchActive) searchQuery = ""
                    }) {
                        Icon(
                            imageVector = if (isSearchActive) Icons.Default.Close else Icons.Default.Search,
                            contentDescription = "Пошук",
                            tint = if (isSearchActive) GlassIndigoLight else Color.White
                        )
                    }
                    IconButton(onClick = loadFarmCards) {
                        Icon(
                            imageVector = Icons.Default.Refresh,
                            contentDescription = "Оновити",
                            tint = if (isRefreshing) Color(0xFFFBBF24) else Color.White
                        )
                    }
                    IconButton(onClick = { isSettingsDialogOpen = true }) {
                        Icon(
                            imageVector = Icons.Default.Settings,
                            contentDescription = "Налаштування карточок",
                            tint = Color(0xFFF59E0B)
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Color(0xFF0F172A).copy(alpha = 0.95f),
                    titleContentColor = Color.White
                )
            )
        },
        containerColor = Color(0xFF020617)
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            when {
                isLoading && cards.isEmpty() -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            CircularProgressIndicator(color = Color(0xFFF59E0B))
                            Spacer(modifier = Modifier.height(16.dp))
                            Text(
                                text = "Завантаження карточок проектів...",
                                color = GlassOnSurfaceVariant,
                                fontSize = 14.sp
                            )
                        }
                    }
                }

                errorMessage != null && cards.isEmpty() -> {
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(32.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center
                    ) {
                        Text(text = "❌", fontSize = 48.sp)
                        Spacer(modifier = Modifier.height(12.dp))
                        Text(
                            text = errorMessage ?: "",
                            color = GlassError,
                            fontSize = 14.sp,
                            textAlign = TextAlign.Center
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Button(
                            onClick = loadFarmCards,
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFD97706))
                        ) {
                            Text("Спробувати знову")
                        }
                    }
                }

                filteredCards.isEmpty() -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = if (searchQuery.isNotBlank()) "Не знайдено проектів за запитом" else "Немає доступних проектів",
                            color = GlassOnSurfaceDim,
                            fontSize = 14.sp
                        )
                    }
                }

                else -> {
                    LazyColumn(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(horizontal = 8.dp, vertical = 6.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        items(filteredCards, key = { it.projectName }) { card ->
                            FarmCardItemView(
                                card = card,
                                settings = settings,
                                elapsedSinceFetch = elapsedSinceFetch,
                                baseUrl = baseUrl,
                                context = context
                            )
                        }
                    }
                }
            }
        }
    }

    // Діалог налаштування видимості секцій
    if (isSettingsDialogOpen) {
        FarmCardsSettingsDialog(
            currentSettings = settings,
            onDismiss = { isSettingsDialogOpen = false },
            onSave = { updated ->
                settings = updated
                FarmCardSettingsManager.save(context, updated)
                isSettingsDialogOpen = false
            }
        )
    }
}

/**
 * Візуальне відображення картки одного проекту
 */
@Composable
fun FarmCardItemView(
    card: FarmCardData,
    settings: FarmCardDisplaySettings,
    elapsedSinceFetch: Long,
    baseUrl: String,
    context: Context
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = Color(0xFF0F172A).copy(alpha = 0.95f)
        ),
        border = BorderStroke(1.dp, Color(0xFF334155))
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(10.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            // 1. Назва проекту, Lvl, тип та розширення острова
            if (settings.showTitleHeader) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 2.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Text(
                            text = card.projectName,
                            fontWeight = FontWeight.ExtraBold,
                            fontSize = 15.sp,
                            color = Color(0xFFFBBF24),
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                        Box(
                            modifier = Modifier
                                .background(Color(0xFFF59E0B).copy(alpha = 0.2f), RoundedCornerShape(6.dp))
                                .border(1.dp, Color(0xFFF59E0B).copy(alpha = 0.4f), RoundedCornerShape(6.dp))
                                .padding(horizontal = 6.dp, vertical = 2.dp)
                        ) {
                            Text(
                                text = "Lvl ${card.level}",
                                color = Color(0xFFFDE68A),
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }

                    Row(
                        modifier = Modifier
                            .background(Color(0xFF1E293B), RoundedCornerShape(6.dp))
                            .border(1.dp, Color(0xFF334155), RoundedCornerShape(6.dp))
                            .padding(horizontal = 6.dp, vertical = 2.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Text(
                            text = card.islandType.replaceFirstChar { it.uppercase() },
                            color = Color(0xFFCBD5E1),
                            fontSize = 10.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                        Text(text = "•", color = Color(0xFF64748B), fontSize = 10.sp)
                        Text(
                            text = "L${card.islandExpansions}",
                            color = Color(0xFF34D399),
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }

            // 2. Доставки за типами, допомога гравцям, міні-ігри
            if (settings.showDeliveriesActivity) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color(0xFF1E293B).copy(alpha = 0.5f), RoundedCornerShape(8.dp))
                        .padding(horizontal = 8.dp, vertical = 5.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // Доставки: Coins, Flower, Ticket
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        BadgePill(text = "🪙 ${card.deliveries.coins}", bgColor = Color(0xFF78350F).copy(alpha = 0.5f), textColor = Color(0xFFFDE68A))
                        BadgePill(text = "🌸 ${card.deliveries.flower}", bgColor = Color(0xFF581C87).copy(alpha = 0.5f), textColor = Color(0xFFE9D5FF))
                        BadgePill(text = "🎫 ${card.deliveries.ticket}", bgColor = Color(0xFF1E3A8A).copy(alpha = 0.5f), textColor = Color(0xFFBFDBFE))
                    }

                    // Допомога
                    Text(
                        text = "🤝 ${card.helpedPlayers.current}/${card.helpedPlayers.max}",
                        fontSize = 10.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = if (card.helpedPlayers.current >= card.helpedPlayers.max) Color(0xFF34D399) else Color(0xFFCBD5E1)
                    )

                    // Міні-ігри
                    Text(
                        text = "🎮 ${card.minigames.completed}/${card.minigames.total}",
                        fontSize = 10.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = if (card.minigames.completed >= card.minigames.total) Color(0xFF34D399) else Color(0xFFFBBF24)
                    )
                }
            }

            // 3. Рослини на грядках (що росте і врожай)
            if (settings.showCrops && card.crops.isNotEmpty()) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color(0xFF1E293B).copy(alpha = 0.5f), RoundedCornerShape(8.dp))
                        .padding(horizontal = 8.dp, vertical = 5.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    card.crops.forEach { crop ->
                        val remaining = (crop.remainingMs - elapsedSinceFetch).coerceAtLeast(0)
                        val isReady = remaining == 0L

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(5.dp)
                            ) {
                                RemoteIcon(name = crop.name, baseUrl = baseUrl, context = context, size = 16)
                                Text(text = crop.name, fontSize = 11.sp, color = Color(0xFFE2E8F0))
                                Text(
                                    text = "= ${crop.totalAmount}",
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Color(0xFFFDE68A)
                                )
                            }
                            TimerBadge(isReady = isReady, text = formatFarmRemainingTime(remaining))
                        }
                    }
                }
            }

            // 4. Насіння рослин поточного сезону в інвентарі
            if (settings.showSeasonalCropSeeds && card.seasonalCropSeeds.isNotEmpty()) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(5.dp)
                ) {
                    card.seasonalCropSeeds.forEach { seed ->
                        ItemPill(
                            iconName = seed.name,
                            text = "= ${seed.count.toInt()}",
                            textColor = Color(0xFF6EE7B7),
                            baseUrl = baseUrl,
                            context = context
                        )
                    }
                }
            }

            // 5. Фруктові дерева
            if (settings.showFruitTrees && card.fruitTrees.isNotEmpty()) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    card.fruitTrees.forEach { tree ->
                        val remaining = (tree.remainingMs - elapsedSinceFetch).coerceAtLeast(0)
                        val isDead = tree.isDead || tree.harvestsLeft <= 0
                        val isReady = !isDead && remaining == 0L

                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(2.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(36.dp)
                                    .background(Color(0xFF1E293B), RoundedCornerShape(8.dp))
                                    .border(
                                        width = 1.dp,
                                        color = when {
                                            isDead -> Color(0xFFEF4444).copy(alpha = 0.5f)
                                            isReady -> Color(0xFF10B981)
                                            else -> Color(0xFF475569)
                                        },
                                        shape = RoundedCornerShape(8.dp)
                                    )
                                    .padding(2.dp)
                            ) {
                                // Зверху зліва: скільки разів залишилось збирати
                                Text(
                                    text = tree.harvestsLeft.toString(),
                                    fontSize = 8.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Color(0xFF94A3B8),
                                    modifier = Modifier.align(Alignment.TopStart)
                                )

                                // Центр: іконка фрукта
                                Box(
                                    modifier = Modifier.fillMaxSize(),
                                    contentAlignment = Alignment.Center
                                ) {
                                    RemoteIcon(name = tree.name, baseUrl = baseUrl, context = context, size = 18)
                                }

                                // Знизу справа: урожай
                                Text(
                                    text = tree.amount.toInt().toString(),
                                    fontSize = 8.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Color(0xFFFDE68A),
                                    modifier = Modifier.align(Alignment.BottomEnd)
                                )
                            }

                            Text(
                                text = if (isDead) "Сухе" else formatFarmRemainingTime(remaining),
                                fontSize = 8.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = if (isDead) Color(0xFFF87171) else if (isReady) Color(0xFF34D399) else Color(0xFF94A3B8)
                            )
                        }
                    }
                }
            }

            // 6. Насіння фруктових дерев поточного сезону в інвентарі
            if (settings.showSeasonalFruitSeeds && !card.seasonalFruitSeeds.isNullOrEmpty()) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(5.dp)
                ) {
                    card.seasonalFruitSeeds.forEach { seed ->
                        ItemPill(
                            iconName = seed.name,
                            text = "= ${seed.count.toInt()}",
                            textColor = Color(0xFFFBBF24),
                            baseUrl = baseUrl,
                            context = context
                        )
                    }
                }
            }

            // 7. Кури в курятнику
            if (settings.showChickens && !card.chickens.isNullOrEmpty()) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    card.chickens.forEach { chicken ->
                        val sleepRemaining = (chicken.sleepRemainingMs - elapsedSinceFetch).coerceAtLeast(0)
                        val careRemaining = (chicken.careRemainingMs - elapsedSinceFetch).coerceAtLeast(0)
                        val isSleeping = sleepRemaining > 0L
                        val canCare = chicken.canCare && isSleeping

                        val borderColor = when {
                            chicken.isSick -> Color(0xFFEF4444)
                            canCare -> Color(0xFF10B981)
                            isSleeping -> Color(0xFF6366F1)
                            else -> Color(0xFFF59E0B)
                        }

                        val statusIcon = when {
                            chicken.isSick -> "🩹"
                            canCare -> "❤️"
                            isSleeping -> "💤"
                            else -> "🌾"
                        }

                        Column(
                            modifier = Modifier
                                .width(62.dp)
                                .background(Color(0xFF1E293B), RoundedCornerShape(8.dp))
                                .border(1.dp, borderColor, RoundedCornerShape(8.dp))
                                .padding(4.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(2.dp)
                        ) {
                            // Верх: Рівень та іконка
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(text = "L${chicken.level}", fontSize = 8.sp, fontWeight = FontWeight.Bold, color = Color(0xFFCBD5E1))
                                Text(text = statusIcon, fontSize = 9.sp)
                            }

                            // Центр: Курка + бажаний предмет
                            Box(modifier = Modifier.size(24.dp), contentAlignment = Alignment.Center) {
                                RemoteIcon(name = "Chicken", baseUrl = baseUrl, context = context, size = 20)
                                if (chicken.desiredItem.isNotBlank()) {
                                    Box(
                                        modifier = Modifier
                                            .align(Alignment.BottomEnd)
                                            .size(11.dp)
                                            .background(Color.Black, CircleShape)
                                            .border(0.5.dp, Color.White.copy(alpha = 0.5f), CircleShape),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        RemoteIcon(name = chicken.desiredItem, baseUrl = baseUrl, context = context, size = 9)
                                    }
                                }
                            }

                            // Таймер сну / їсти
                            Text(
                                text = if (isSleeping) formatFarmRemainingTime(sleepRemaining) else "Їсти",
                                fontSize = 8.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = if (isSleeping) Color(0xFFA5B4FC) else Color(0xFFFBBF24),
                                maxLines = 1
                            )

                            // Статус піклування
                            Text(
                                text = when {
                                    canCare -> "❤️ Увага!"
                                    isSleeping -> "❤️ Погладжено"
                                    else -> "🌾 Голодна"
                                },
                                fontSize = 7.5.sp,
                                fontWeight = FontWeight.Bold,
                                color = when {
                                    canCare -> Color(0xFF34D399)
                                    isSleeping -> Color(0xFFA5B4FC)
                                    else -> Color(0xFF64748B)
                                },
                                maxLines = 1
                            )
                        }
                    }
                }
            }

            // 8. Ресурси для збору
            if (settings.showResources && card.resources.isNotEmpty()) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    card.resources.forEach { res ->
                        val remaining = (res.remainingMs - elapsedSinceFetch).coerceAtLeast(0)
                        val allReady = res.readyCount >= res.totalCount

                        Row(
                            modifier = Modifier
                                .background(Color(0xFF1E293B), RoundedCornerShape(6.dp))
                                .border(1.dp, Color(0xFF334155), RoundedCornerShape(6.dp))
                                .padding(horizontal = 6.dp, vertical = 3.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            RemoteIcon(name = res.name, baseUrl = baseUrl, context = context, size = 14)
                            Text(
                                text = "${res.readyCount}/${res.totalCount}",
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color(0xFFE2E8F0)
                            )
                            TimerBadge(isReady = allReady, text = if (allReady) "Всі" else formatFarmRemainingTime(remaining))
                        }
                    }
                }
            }

            // 9. Інструменти (інвентар / склад)
            if (settings.showTools && card.tools.isNotEmpty()) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(5.dp)
                ) {
                    card.tools.forEach { tool ->
                        Row(
                            modifier = Modifier
                                .background(Color(0xFF1E293B), RoundedCornerShape(6.dp))
                                .border(1.dp, Color(0xFF334155), RoundedCornerShape(6.dp))
                                .padding(horizontal = 5.dp, vertical = 2.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            RemoteIcon(name = tool.name, baseUrl = baseUrl, context = context, size = 13)
                            Text(
                                text = "${tool.inventoryCount.toInt()} / ${tool.stockCount.toInt()}",
                                fontSize = 9.5.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color(0xFFFBBF24)
                            )
                        }
                    }
                }
            }

            // 10. Квіти що ростуть
            if (settings.showFlowers && card.growingFlowers.isNotEmpty()) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color(0xFF1E293B).copy(alpha = 0.5f), RoundedCornerShape(8.dp))
                        .padding(horizontal = 8.dp, vertical = 5.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    card.growingFlowers.forEach { flower ->
                        val remaining = (flower.remainingMs - elapsedSinceFetch).coerceAtLeast(0)
                        val isReady = remaining == 0L

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(5.dp)
                            ) {
                                RemoteIcon(name = flower.name, baseUrl = baseUrl, context = context, size = 15)
                                Text(text = flower.name, fontSize = 11.sp, color = Color(0xFFE2E8F0))
                            }
                            TimerBadge(isReady = isReady, text = formatFarmRemainingTime(remaining))
                        }
                    }
                }
            }

            // 11. Насіння квітів поточного сезону в інвентарі
            if (settings.showSeasonalFlowerSeeds && card.seasonalFlowerSeeds.isNotEmpty()) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(5.dp)
                ) {
                    card.seasonalFlowerSeeds.forEach { seed ->
                        ItemPill(
                            iconName = seed.name,
                            text = "= ${seed.count.toInt()}",
                            textColor = Color(0xFFD8B4FE),
                            baseUrl = baseUrl,
                            context = context
                        )
                    }
                }
            }

            // 12. Страви що готуються
            if (settings.showCooking && card.cookingDishes.isNotEmpty()) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color(0xFF1E293B).copy(alpha = 0.5f), RoundedCornerShape(8.dp))
                        .padding(horizontal = 8.dp, vertical = 5.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    card.cookingDishes.forEach { dish ->
                        val remaining = (dish.remainingMs - elapsedSinceFetch).coerceAtLeast(0)
                        val isReady = remaining == 0L

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(5.dp)
                            ) {
                                RemoteIcon(name = dish.name, baseUrl = baseUrl, context = context, size = 15)
                                Column {
                                    Text(text = dish.name, fontSize = 11.sp, fontWeight = FontWeight.Medium, color = Color(0xFFE2E8F0))
                                    Text(text = dish.buildingName, fontSize = 9.sp, color = Color(0xFF94A3B8))
                                }
                            }
                            TimerBadge(isReady = isReady, text = formatFarmRemainingTime(remaining))
                        }
                    }
                }
            }

            // 13. 3 компостери
            if (settings.showComposters && card.composters.isNotEmpty()) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceEvenly,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    card.composters.forEach { comp ->
                        val remaining = ((comp.remainingMs ?: 0L) - elapsedSinceFetch).coerceAtLeast(0)
                        val border = when (comp.status) {
                            "ready" -> Color(0xFF10B981)
                            "producing" -> Color(0xFFF59E0B)
                            "idle_missing_resources" -> Color(0xFFEF4444)
                            else -> Color(0xFF475569)
                        }

                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(2.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(34.dp)
                                    .background(Color(0xFF1E293B), RoundedCornerShape(8.dp))
                                    .border(1.5.dp, border, RoundedCornerShape(8.dp)),
                                contentAlignment = Alignment.Center
                            ) {
                                RemoteIcon(name = comp.producingItem ?: comp.name, baseUrl = baseUrl, context = context, size = 20)
                            }
                            Text(
                                text = comp.name.replace(" Composter", "").replace(" Bin", ""),
                                fontSize = 8.5.sp,
                                color = Color(0xFF94A3B8)
                            )
                        }
                    }
                }
            }

            // 14. Великі фрукти Project на острові
            if (settings.showBigFruits && card.bigFruitProjects.isNotEmpty()) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color(0xFF1E293B).copy(alpha = 0.5f), RoundedCornerShape(8.dp))
                        .padding(horizontal = 8.dp, vertical = 5.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    card.bigFruitProjects.forEach { proj ->
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(5.dp)
                            ) {
                                RemoteIcon(name = proj.name, baseUrl = baseUrl, context = context, size = 15)
                                Text(text = proj.name, fontSize = 11.sp, color = Color(0xFFE2E8F0))
                            }
                            Text(
                                text = "${proj.cheers}/${proj.goal} ${if (proj.isCompleted) "✓" else ""}",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                color = if (proj.isCompleted) Color(0xFF34D399) else Color(0xFFFBBF24)
                            )
                        }
                    }
                }
            }

            // 15. Риболовля
            if (settings.showFishing) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color(0xFF1E293B).copy(alpha = 0.5f), RoundedCornerShape(8.dp))
                        .padding(horizontal = 8.dp, vertical = 5.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "🎣 Спроби: ${card.fishing.dailyAttempts}/${card.fishing.dailyLimit}",
                        fontSize = 10.5.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = Color(0xFF38BDF8)
                    )

                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        RemoteIcon(name = "Rod", baseUrl = baseUrl, context = context, size = 13)
                        Text(
                            text = "= ${card.fishing.rodsCount.toInt()}",
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFFFDE68A)
                        )
                    }

                    if (card.fishing.baits.isNotEmpty()) {
                        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                            card.fishing.baits.take(2).forEach { bait ->
                                ItemPill(
                                    iconName = bait.name,
                                    text = "${bait.count.toInt()}",
                                    textColor = Color(0xFFFDE68A),
                                    baseUrl = baseUrl,
                                    context = context
                                )
                            }
                        }
                    }
                }
            }

            // 16. Ресурси для розширення/покращення острова
            if (settings.showIslandUpgrade && card.islandUpgrade != null) {
                val upgrade = card.islandUpgrade
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color(0xFF1E1B4B).copy(alpha = 0.5f), RoundedCornerShape(8.dp))
                        .border(1.dp, Color(0xFF4338CA).copy(alpha = 0.5f), RoundedCornerShape(8.dp))
                        .padding(horizontal = 8.dp, vertical = 5.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = upgrade.targetLabel ?: if (upgrade.isMaxLevel) "🏝️ Макс. рівень" else "🏝️ → ${upgrade.nextIslandType}",
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF818CF8)
                    )

                    if (!upgrade.isMaxLevel) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Text(
                                text = "Lvl: ${upgrade.currentLevel}/${upgrade.requiredLevel}",
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                color = if (upgrade.currentLevel >= upgrade.requiredLevel) Color(0xFF34D399) else Color(0xFFFBBF24)
                            )

                            if (!upgrade.resources.isNullOrEmpty()) {
                                upgrade.resources.forEach { res ->
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(2.dp)
                                    ) {
                                        RemoteIcon(name = res.name, baseUrl = baseUrl, context = context, size = 12)
                                        Text(
                                            text = "${res.current.toInt()}/${res.required.toInt()}",
                                            fontSize = 9.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = if (res.isReady) Color(0xFF34D399) else Color(0xFFF87171)
                                        )
                                    }
                                }
                            }

                            if (upgrade.canUpgrade) {
                                Box(
                                    modifier = Modifier
                                        .background(Color(0xFF10B981).copy(alpha = 0.2f), RoundedCornerShape(4.dp))
                                        .border(1.dp, Color(0xFF10B981), RoundedCornerShape(4.dp))
                                        .padding(horizontal = 4.dp, vertical = 1.dp)
                                ) {
                                    Text(text = "Готово!", fontSize = 8.5.sp, fontWeight = FontWeight.Bold, color = Color(0xFF6EE7B7))
                                }
                            }
                        }
                    }
                }
            }

            // 17. Часова шкала (Timeline: коли що дозріє, приготується чи відновиться)
            if (settings.showTimeline && !card.timelineEvents.isNullOrEmpty()) {
                FarmTimelineView(
                    timelineEvents = card.timelineEvents,
                    elapsedSinceFetch = elapsedSinceFetch,
                    baseUrl = baseUrl,
                    context = context
                )
            }
        }
    }
}

/**
 * Блок часової шкали подій із таймерами та кнопкою розгортання
 */
@Composable
fun FarmTimelineView(
    timelineEvents: List<FarmCardTimelineEvent>,
    elapsedSinceFetch: Long,
    baseUrl: String,
    context: Context
) {
    var isExpanded by remember { mutableStateOf(false) }

    val readyCount = remember(timelineEvents, elapsedSinceFetch) {
        timelineEvents.count { (it.remainingMs - elapsedSinceFetch).coerceAtLeast(0) == 0L }
    }

    val displayedEvents = if (isExpanded) timelineEvents else timelineEvents.take(5)
    val timeFormat = remember { SimpleDateFormat("HH:mm", Locale.getDefault()) }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color(0xFF0F172A), RoundedCornerShape(10.dp))
            .border(1.dp, Color(0xFF334155).copy(alpha = 0.8f), RoundedCornerShape(10.dp))
            .padding(8.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        // Шапка шкали
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 2.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.AccessTime,
                    contentDescription = "Часова шкала",
                    tint = Color(0xFFFBBF24),
                    modifier = Modifier.size(13.dp)
                )
                Text(
                    text = "Часова шкала",
                    fontSize = 10.5.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFFFBBF24)
                )
            }

            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                if (readyCount > 0) {
                    Box(
                        modifier = Modifier
                            .background(Color(0xFF10B981).copy(alpha = 0.2f), RoundedCornerShape(4.dp))
                            .border(1.dp, Color(0xFF10B981).copy(alpha = 0.5f), RoundedCornerShape(4.dp))
                            .padding(horizontal = 4.dp, vertical = 1.dp)
                    ) {
                        Text(
                            text = "Готово: $readyCount",
                            fontSize = 8.5.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFF6EE7B7)
                        )
                    }
                }
                Box(
                    modifier = Modifier
                        .background(Color(0xFF1E293B), RoundedCornerShape(4.dp))
                        .border(1.dp, Color(0xFF334155), RoundedCornerShape(4.dp))
                        .padding(horizontal = 4.dp, vertical = 1.dp)
                ) {
                    Text(
                        text = "${timelineEvents.size}",
                        fontSize = 8.5.sp,
                        fontWeight = FontWeight.Medium,
                        color = Color(0xFF94A3B8)
                    )
                }
            }
        }

        // Рядки подій
        displayedEvents.forEach { event ->
            val remaining = (event.remainingMs - elapsedSinceFetch).coerceAtLeast(0)
            val isReady = remaining == 0L
            val targetTime = timeFormat.format(Date(event.readyAt))

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(
                        if (isReady) Color(0xFF064E3B).copy(alpha = 0.4f) else Color(0xFF1E293B).copy(alpha = 0.4f),
                        RoundedCornerShape(6.dp)
                    )
                    .border(
                        1.dp,
                        if (isReady) Color(0xFF10B981).copy(alpha = 0.4f) else Color.White.copy(alpha = 0.05f),
                        RoundedCornerShape(6.dp)
                    )
                    .padding(horizontal = 6.dp, vertical = 3.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    modifier = Modifier.weight(1f),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(5.dp)
                ) {
                    RemoteIcon(
                        name = event.name,
                        iconUrl = event.icon,
                        baseUrl = baseUrl,
                        context = context,
                        size = 14
                    )
                    Text(
                        text = event.name,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Medium,
                        color = Color(0xFFF1F5F9),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    if (!event.details.isNullOrBlank()) {
                        Text(
                            text = event.details,
                            fontSize = 8.5.sp,
                            color = Color(0xFF94A3B8),
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Text(
                        text = targetTime,
                        fontSize = 8.5.sp,
                        color = Color(0xFF64748B)
                    )
                    TimerBadge(isReady = isReady, text = formatFarmRemainingTime(remaining))
                }
            }
        }

        // Кнопка показати більше / згорнути
        if (timelineEvents.size > 5) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { isExpanded = !isExpanded }
                    .padding(vertical = 2.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = if (isExpanded) "▲ Згорнути шкалу" else "▼ Ще +${timelineEvents.size - 5} подій...",
                    fontSize = 9.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFFFBBF24)
                )
            }
        }
    }
}

/**
 * Бейдж таймера
 */
@Composable
fun TimerBadge(isReady: Boolean, text: String) {
    Box(
        modifier = Modifier
            .background(
                if (isReady) Color(0xFF059669) else Color(0xFF334155),
                RoundedCornerShape(4.dp)
            )
            .border(
                1.dp,
                if (isReady) Color(0xFF10B981) else Color(0xFF475569),
                RoundedCornerShape(4.dp)
            )
            .padding(horizontal = 5.dp, vertical = 1.dp)
    ) {
        Text(
            text = text,
            fontSize = 8.5.sp,
            fontWeight = FontWeight.Bold,
            color = Color.White
        )
    }
}

/**
 * Компактна таблетка для доставки або лічильника
 */
@Composable
fun BadgePill(text: String, bgColor: Color, textColor: Color) {
    Box(
        modifier = Modifier
            .background(bgColor, RoundedCornerShape(4.dp))
            .padding(horizontal = 4.dp, vertical = 1.dp)
    ) {
        Text(text = text, fontSize = 9.sp, fontWeight = FontWeight.Bold, color = textColor)
    }
}

/**
 * Пігулка предмета з іконкою та текстом
 */
@Composable
fun ItemPill(
    iconName: String,
    text: String,
    textColor: Color,
    baseUrl: String,
    context: Context
) {
    Row(
        modifier = Modifier
            .background(Color(0xFF1E293B), RoundedCornerShape(6.dp))
            .border(1.dp, Color(0xFF334155), RoundedCornerShape(6.dp))
            .padding(horizontal = 4.dp, vertical = 2.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(3.dp)
    ) {
        RemoteIcon(name = iconName, baseUrl = baseUrl, context = context, size = 12)
        Text(text = text, fontSize = 9.sp, fontWeight = FontWeight.Bold, color = textColor)
    }
}

/**
 * Оптимізована іконка предмета з Coil (із резолвінгом локальних асетів)
 */
@Composable
fun RemoteIcon(
    name: String,
    iconUrl: String? = null,
    baseUrl: String,
    context: Context,
    size: Int = 16
) {
    val resolvedUrl = remember(name, iconUrl, baseUrl) {
        if (!iconUrl.isNullOrBlank()) {
            ItemImageResolver.resolveImageUrl(iconUrl, context, baseUrl)
        } else {
            ItemImageResolver.resolveImageUrl(name, context, baseUrl)
        }
    }

    AsyncImage(
        model = ImageRequest.Builder(context)
            .data(resolvedUrl)
            .size(48, 48)
            .crossfade(false)
            .allowHardware(false)
            .build(),
        contentDescription = name,
        contentScale = ContentScale.Fit,
        modifier = Modifier.size(size.dp)
    )
}

/**
 * Діалог налаштування відображення секцій карток
 */
@Composable
fun FarmCardsSettingsDialog(
    currentSettings: FarmCardDisplaySettings,
    onDismiss: () -> Unit,
    onSave: (FarmCardDisplaySettings) -> Unit
) {
    var state by remember { mutableStateOf(currentSettings) }

    Dialog(onDismissRequest = onDismiss) {
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .fillMaxHeight(0.85f),
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = Color(0xFF0F172A)),
            border = BorderStroke(1.dp, Color(0xFF334155))
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(14.dp)
            ) {
                // Заголовок
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Налаштування Карточок",
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                    IconButton(onClick = onDismiss, modifier = Modifier.size(24.dp)) {
                        Icon(imageVector = Icons.Default.Close, contentDescription = "Закрити", tint = Color.White)
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))

                // Список перемикачів
                LazyColumn(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    val toggles = listOf(
                        Triple("1. Назва проекту, Lvl, тип острова", state.showTitleHeader) { b: Boolean -> state = state.copy(showTitleHeader = b) },
                        Triple("2. Доставки за сьогодні, допомога, ігри", state.showDeliveriesActivity) { b: Boolean -> state = state.copy(showDeliveriesActivity = b) },
                        Triple("3. Рослини на грядках та таймери", state.showCrops) { b: Boolean -> state = state.copy(showCrops = b) },
                        Triple("4. Насіння рослин поточного сезону", state.showSeasonalCropSeeds) { b: Boolean -> state = state.copy(showSeasonalCropSeeds = b) },
                        Triple("5. Фруктові дерева та таймери", state.showFruitTrees) { b: Boolean -> state = state.copy(showFruitTrees = b) },
                        Triple("6. Насіння фруктових дерев сезону", state.showSeasonalFruitSeeds) { b: Boolean -> state = state.copy(showSeasonalFruitSeeds = b) },
                        Triple("7. Кури в курятнику (сон, увага, стан)", state.showChickens) { b: Boolean -> state = state.copy(showChickens = b) },
                        Triple("8. Ресурси для збору (дерево, камінь)", state.showResources) { b: Boolean -> state = state.copy(showResources = b) },
                        Triple("9. Інструменти (інвентар і склад)", state.showTools) { b: Boolean -> state = state.copy(showTools = b) },
                        Triple("10. Квіти що ростуть із таймером", state.showFlowers) { b: Boolean -> state = state.copy(showFlowers = b) },
                        Triple("11. Насіння квітів поточного сезону", state.showSeasonalFlowerSeeds) { b: Boolean -> state = state.copy(showSeasonalFlowerSeeds = b) },
                        Triple("12. Страви що готуються в будівлях", state.showCooking) { b: Boolean -> state = state.copy(showCooking = b) },
                        Triple("13. 3 компостери (статус, добрива)", state.showComposters) { b: Boolean -> state = state.copy(showComposters = b) },
                        Triple("14. Великі фрукти Project на острові", state.showBigFruits) { b: Boolean -> state = state.copy(showBigFruits = b) },
                        Triple("15. Риболовля (спроби, вудки, наживка)", state.showFishing) { b: Boolean -> state = state.copy(showFishing = b) },
                        Triple("16. Ресурси для покращення острова", state.showIslandUpgrade) { b: Boolean -> state = state.copy(showIslandUpgrade = b) },
                        Triple("17. Часова шкала (Timeline подій)", state.showTimeline) { b: Boolean -> state = state.copy(showTimeline = b) }
                    )

                    items(toggles) { (label, isChecked, setter) ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { setter(!isChecked) }
                                .background(Color(0xFF1E293B).copy(alpha = 0.5f), RoundedCornerShape(6.dp))
                                .padding(horizontal = 8.dp, vertical = 6.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = label,
                                fontSize = 11.sp,
                                color = if (isChecked) Color(0xFFF1F5F9) else Color(0xFF64748B),
                                modifier = Modifier.weight(1f)
                            )
                            Checkbox(
                                checked = isChecked,
                                onCheckedChange = { setter(it) },
                                colors = CheckboxDefaults.colors(
                                    checkedColor = Color(0xFFF59E0B),
                                    uncheckedColor = Color(0xFF475569)
                                )
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))

                // Кнопки збереження
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    TextButton(onClick = {
                        state = FarmCardDisplaySettings(
                            showTitleHeader = true,
                            showDeliveriesActivity = true,
                            showCrops = true,
                            showSeasonalCropSeeds = true,
                            showFruitTrees = true,
                            showSeasonalFruitSeeds = true,
                            showChickens = true,
                            showResources = true,
                            showTools = true,
                            showFlowers = true,
                            showSeasonalFlowerSeeds = true,
                            showCooking = true,
                            showComposters = true,
                            showBigFruits = true,
                            showFishing = true,
                            showIslandUpgrade = true,
                            showTimeline = true
                        )
                    }) {
                        Text("Увімкнути все", fontSize = 11.sp, color = Color(0xFFFBBF24))
                    }

                    Button(
                        onClick = { onSave(state) },
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFF59E0B))
                    ) {
                        Text("Зберегти", color = Color(0xFF0F172A), fontWeight = FontWeight.Bold, fontSize = 12.sp)
                    }
                }
            }
        }
    }
}
