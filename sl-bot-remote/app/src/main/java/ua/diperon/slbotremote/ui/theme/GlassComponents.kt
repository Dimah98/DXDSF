package ua.diperon.slbotremote.ui.theme

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

// ══════════════════════════════════════════════════════════
// Glass Card — основний контейнер для Glassmorphism
// ══════════════════════════════════════════════════════════

@Composable
fun GlassCard(
    modifier: Modifier = Modifier,
    glowColor: Color? = null,
    borderAlpha: Float = 0.12f,
    fillAlpha: Float = 0.06f,
    cornerRadius: Dp = 24.dp,
    onClick: (() -> Unit)? = null,
    content: @Composable () -> Unit
) {
    val shape = RoundedCornerShape(cornerRadius)

    val effectiveBorder = if (glowColor != null) {
        BorderStroke(1.5.dp, glowColor.copy(alpha = 0.5f))
    } else {
        BorderStroke(1.dp, Color.White.copy(alpha = borderAlpha))
    }

    val bgColor = Color.White.copy(alpha = fillAlpha)

    Card(
        modifier = modifier
            .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier),
        shape = shape,
        colors = CardDefaults.cardColors(containerColor = bgColor),
        border = effectiveBorder,
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
    ) {
        content()
    }
}

// ══════════════════════════════════════════════════════════
// Pressable Glass Card — з анімацією scale при натисканні
// ══════════════════════════════════════════════════════════

@Composable
fun PressableGlassCard(
    modifier: Modifier = Modifier,
    glowColor: Color? = null,
    cornerRadius: Dp = 24.dp,
    onClick: () -> Unit,
    content: @Composable () -> Unit
) {
    val interactionSource = remember { MutableInteractionSource() }
    val isPressed by interactionSource.collectIsPressedAsState()
    val scale by animateFloatAsState(
        targetValue = if (isPressed) 0.97f else 1f,
        animationSpec = tween(durationMillis = 100),
        label = "pressScale"
    )

    val shape = RoundedCornerShape(cornerRadius)
    val effectiveBorder = if (glowColor != null) {
        BorderStroke(1.5.dp, glowColor.copy(alpha = 0.5f))
    } else {
        BorderStroke(1.dp, Color.White.copy(alpha = 0.12f))
    }

    Card(
        modifier = modifier
            .graphicsLayer {
                scaleX = scale
                scaleY = scale
            }
            .clickable(
                interactionSource = interactionSource,
                indication = null,
                onClick = onClick
            ),
        shape = shape,
        colors = CardDefaults.cardColors(containerColor = Color.White.copy(alpha = 0.06f)),
        border = effectiveBorder,
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
    ) {
        content()
    }
}

// ══════════════════════════════════════════════════════════
// Glass TopAppBar — прозорий з легким тонуванням
// ══════════════════════════════════════════════════════════

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GlassTopAppBar(
    title: @Composable () -> Unit,
    modifier: Modifier = Modifier,
    navigationIcon: @Composable () -> Unit = {},
    actions: @Composable RowScope.() -> Unit = {}
) {
    TopAppBar(
        title = title,
        modifier = modifier,
        navigationIcon = navigationIcon,
        actions = actions,
        colors = TopAppBarDefaults.topAppBarColors(
            containerColor = GlassBg.copy(alpha = 0.85f),
            scrolledContainerColor = GlassBg.copy(alpha = 0.95f),
            navigationIconContentColor = GlassOnSurface,
            titleContentColor = GlassOnSurface,
            actionIconContentColor = GlassOnSurface
        )
    )
}

// ══════════════════════════════════════════════════════════
// Glass Button — кнопка зі скляним ефектом
// ══════════════════════════════════════════════════════════

@Composable
fun GlassButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    text: String,
    accentColor: Color = GlassPrimary,
    enabled: Boolean = true
) {
    Button(
        onClick = onClick,
        modifier = modifier,
        enabled = enabled,
        shape = RoundedCornerShape(16.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = accentColor.copy(alpha = 0.2f),
            contentColor = accentColor,
            disabledContainerColor = Color.White.copy(alpha = 0.04f),
            disabledContentColor = GlassOnSurfaceVariant.copy(alpha = 0.4f)
        ),
        border = BorderStroke(1.dp, accentColor.copy(alpha = 0.3f)),
        elevation = ButtonDefaults.buttonElevation(defaultElevation = 0.dp)
    ) {
        Text(
            text = text,
            style = MaterialTheme.typography.labelLarge
        )
    }
}

// ══════════════════════════════════════════════════════════
// Glass Icon Button — іконка-кнопка зі скляним ореолом
// ══════════════════════════════════════════════════════════

@Composable
fun GlassIconButton(
    onClick: () -> Unit,
    icon: ImageVector,
    contentDescription: String?,
    modifier: Modifier = Modifier,
    tint: Color = GlassOnSurface,
    size: Dp = 40.dp,
    iconSize: Dp = 20.dp,
    backgroundColor: Color = Color.White.copy(alpha = 0.06f),
    borderColor: Color = Color.White.copy(alpha = 0.1f)
) {
    IconButton(
        onClick = onClick,
        modifier = modifier
            .size(size)
            .background(
                color = backgroundColor,
                shape = CircleShape
            )
            .border(
                width = 1.dp,
                color = borderColor,
                shape = CircleShape
            )
    ) {
        Icon(
            imageVector = icon,
            contentDescription = contentDescription,
            tint = tint,
            modifier = Modifier.size(iconSize)
        )
    }
}

// ══════════════════════════════════════════════════════════
// Animated Glow Border — для running/active проектів
// ══════════════════════════════════════════════════════════

@Composable
fun GlowingBorderCard(
    modifier: Modifier = Modifier,
    glowColor: Color = GlassPrimary,
    cornerRadius: Dp = 24.dp,
    content: @Composable () -> Unit
) {
    val infiniteTransition = rememberInfiniteTransition(label = "glowPulse")
    val glowAlpha by infiniteTransition.animateFloat(
        initialValue = 0.3f,
        targetValue = 0.7f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 1500, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "glowAlpha"
    )

    val shape = RoundedCornerShape(cornerRadius)

    Card(
        modifier = modifier,
        shape = shape,
        colors = CardDefaults.cardColors(containerColor = Color.White.copy(alpha = 0.06f)),
        border = BorderStroke(1.5.dp, glowColor.copy(alpha = glowAlpha)),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
    ) {
        content()
    }
}

// ══════════════════════════════════════════════════════════
// Shimmer Effect — для завантаження
// ══════════════════════════════════════════════════════════

@Composable
fun ShimmerBox(
    modifier: Modifier = Modifier,
    cornerRadius: Dp = 12.dp
) {
    val infiniteTransition = rememberInfiniteTransition(label = "shimmer")
    val translateAnim by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 1000f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 1200, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "shimmerTranslate"
    )

    val shimmerBrush = Brush.linearGradient(
        colors = listOf(
            Color.White.copy(alpha = 0.03f),
            Color.White.copy(alpha = 0.08f),
            Color.White.copy(alpha = 0.03f),
        ),
        start = Offset(translateAnim - 200f, translateAnim - 200f),
        end = Offset(translateAnim, translateAnim)
    )

    Box(
        modifier = modifier
            .clip(RoundedCornerShape(cornerRadius))
            .background(shimmerBrush)
    )
}

// ══════════════════════════════════════════════════════════
// Status Dot — маркер стану з glow
// ══════════════════════════════════════════════════════════

@Composable
fun StatusDot(
    color: Color,
    modifier: Modifier = Modifier,
    size: Dp = 10.dp,
    animated: Boolean = false
) {
    if (animated) {
        val infiniteTransition = rememberInfiniteTransition(label = "dotPulse")
        val alpha by infiniteTransition.animateFloat(
            initialValue = 0.5f,
            targetValue = 1.0f,
            animationSpec = infiniteRepeatable(
                animation = tween(durationMillis = 1000, easing = LinearEasing),
                repeatMode = RepeatMode.Reverse
            ),
            label = "dotAlpha"
        )
        Box(
            modifier = modifier
                .size(size)
                .background(color.copy(alpha = alpha), CircleShape)
                .border(1.dp, color.copy(alpha = 0.3f), CircleShape)
        )
    } else {
        Box(
            modifier = modifier
                .size(size)
                .background(color, CircleShape)
        )
    }
}

// ══════════════════════════════════════════════════════════
// Glass Gradient Background — фоновий градієнт сторінки
// ══════════════════════════════════════════════════════════

fun Modifier.glassBackground(): Modifier = this.drawBehind {
    drawRect(
        brush = Brush.verticalGradient(
            colors = listOf(
                GlassBg,
                GlassBgGradientEnd,
                GlassBg
            )
        )
    )
    // Subtle radial glow at top
    drawCircle(
        brush = Brush.radialGradient(
            colors = listOf(
                GlassPrimary.copy(alpha = 0.04f),
                Color.Transparent
            ),
            center = Offset(size.width / 2, 0f),
            radius = size.width * 0.8f
        )
    )
}
