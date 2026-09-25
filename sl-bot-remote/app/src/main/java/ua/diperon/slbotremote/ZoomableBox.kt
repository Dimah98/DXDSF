package ua.diperon.slbotremote

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material.icons.filled.RestartAlt
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ua.diperon.slbotremote.ui.theme.GlassCard
import ua.diperon.slbotremote.ui.theme.GlassBorderSubtle

/**
 * Універсальний контейнер з підтримкою масштабування (zoom) та панорамування (pan):
 * - Жест pinch-to-zoom (двома пальцями)
 * - Подвійне натискання (double tap) для швидкого збільшення до 2.5x або повернення до 1x
 * - Перетягування (drag/pan) при збільшеному масштабі
 * - Плаваючі кнопки керування (+, -, 1x) для зручності
 */
@Composable
fun ZoomableBox(
    modifier: Modifier = Modifier,
    minScale: Float = 1f,
    maxScale: Float = 5f,
    showControls: Boolean = true,
    onSingleTap: (() -> Unit)? = null,
    content: @Composable BoxScope.(scale: Float) -> Unit
) {
    var scale by remember { mutableFloatStateOf(1f) }
    var offset by remember { mutableStateOf(Offset.Zero) }

    fun clampOffset(newOffset: Offset, currentScale: Float, boxW: Float, boxH: Float): Offset {
        if (currentScale <= 1f) return Offset.Zero
        val maxOffsetX = (boxW * (currentScale - 1f)) / 2f
        val maxOffsetY = (boxH * (currentScale - 1f)) / 2f
        return Offset(
            x = newOffset.x.coerceIn(-maxOffsetX, maxOffsetX),
            y = newOffset.y.coerceIn(-maxOffsetY, maxOffsetY)
        )
    }

    BoxWithConstraints(
        modifier = modifier
            .clipToBounds()
            .pointerInput(Unit) {
                detectTapGestures(
                    onDoubleTap = { tapOffset ->
                        if (scale > 1.05f) {
                            scale = 1f
                            offset = Offset.Zero
                        } else {
                            scale = 2.5f
                            val centerX = size.width / 2f
                            val centerY = size.height / 2f
                            val targetOffset = Offset(
                                (centerX - tapOffset.x) * 1.5f,
                                (centerY - tapOffset.y) * 1.5f
                            )
                            offset = clampOffset(targetOffset, 2.5f, size.width.toFloat(), size.height.toFloat())
                        }
                    },
                    onTap = {
                        onSingleTap?.invoke()
                    }
                )
            }
            .pointerInput(Unit) {
                detectTransformGestures { _, pan, zoom, _ ->
                    val newScale = (scale * zoom).coerceIn(minScale, maxScale)
                    val newOffset = if (newScale > 1f) {
                        clampOffset(offset + pan * newScale, newScale, size.width.toFloat(), size.height.toFloat())
                    } else {
                        Offset.Zero
                    }
                    scale = newScale
                    offset = newOffset
                }
            }
    ) {
        val boxW = constraints.maxWidth.toFloat()
        val boxH = constraints.maxHeight.toFloat()

        Box(
            modifier = Modifier
                .fillMaxSize()
                .graphicsLayer {
                    scaleX = scale
                    scaleY = scale
                    translationX = offset.x
                    translationY = offset.y
                }
        ) {
            content(scale)
        }

        // Плаваюча панель масштабування (zoom controls)
        if (showControls) {
            Surface(
                modifier = Modifier
                    .align(Alignment.BottomEnd)
                    .padding(16.dp),
                shape = RoundedCornerShape(20.dp),
                color = Color.Black.copy(alpha = 0.65f),
                border = BorderStroke(1.dp, Color.White.copy(alpha = 0.2f))
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    // Зменшити (-)
                    IconButton(
                        onClick = {
                            val newScale = (scale - 0.5f).coerceIn(minScale, maxScale)
                            scale = newScale
                            offset = clampOffset(offset, newScale, boxW, boxH)
                        },
                        modifier = Modifier.size(32.dp),
                        enabled = scale > 1f
                    ) {
                        Icon(
                            Icons.Default.Remove,
                            contentDescription = "Зменшити",
                            tint = if (scale > 1f) Color.White else Color.White.copy(alpha = 0.3f),
                            modifier = Modifier.size(18.dp)
                        )
                    }

                    // Поточний масштаб (напр. "1.0x", "2.5x")
                    Text(
                        text = "${String.format(java.util.Locale.ROOT, "%.1f", scale)}x",
                        fontSize = 11.sp,
                        color = Color.White,
                        modifier = Modifier.padding(horizontal = 4.dp)
                    )

                    // Збільшити (+)
                    IconButton(
                        onClick = {
                            val newScale = (scale + 0.5f).coerceIn(minScale, maxScale)
                            scale = newScale
                            offset = clampOffset(offset, newScale, boxW, boxH)
                        },
                        modifier = Modifier.size(32.dp),
                        enabled = scale < maxScale
                    ) {
                        Icon(
                            Icons.Default.Add,
                            contentDescription = "Збільшити",
                            tint = if (scale < maxScale) Color.White else Color.White.copy(alpha = 0.3f),
                            modifier = Modifier.size(18.dp)
                        )
                    }

                    // Скинути до 1x
                    if (scale > 1.05f) {
                        IconButton(
                            onClick = {
                                scale = 1f
                                offset = Offset.Zero
                            },
                            modifier = Modifier.size(32.dp)
                        ) {
                            Icon(
                                Icons.Default.RestartAlt,
                                contentDescription = "Скинути",
                                tint = Color(0xFF38BDF8),
                                modifier = Modifier.size(18.dp)
                            )
                        }
                    }
                }
            }
        }
    }
}
