import sys

file_path = r'd:\SF\sl-bot-remote\app\src\main\java\com\example\ProjectMonitorScreen.kt'
with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_content = """                            Divider(color = Color.White.copy(alpha = 0.08f))
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = "Останній запуск: ${stats.lastRunTime}",
                                style = MaterialTheme.typography.labelSmall,
                                color = Color.White.copy(alpha = 0.4f),
                                fontSize = 11.sp,
                                modifier = Modifier.fillMaxWidth(),
                                textAlign = TextAlign.Center
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(24.dp))

                Button(
                    onClick = onDismiss,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(46.dp),
                    shape = RoundedCornerShape(16.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color(0xFF10B981),
                        contentColor = Color.Black
                    )
                ) {
                    Text("OK", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                }
            }
        }
    }
}

@Composable
fun FullScreenStreamDialog(
    frameBitmap: android.graphics.Bitmap?,
    onDismiss: () -> Unit,
    onSendClick: (x: Float, y: Float, width: Int, height: Int) -> Unit,
    onSendScroll: (deltaX: Float, deltaY: Float) -> Unit
) {
    if (frameBitmap == null) return

    Dialog(
        onDismissRequest = onDismiss,
        properties = androidx.compose.ui.window.DialogProperties(
            usePlatformDefaultWidth = false,
            dismissOnBackPress = true,
            dismissOnClickOutside = true
        )
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.Black)
        ) {
            var boxSize by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf(androidx.compose.ui.geometry.Size.Zero) }

"""

# Lines are 0-indexed in python.
# Lines 937 to 994 correspond to index 936 to 994 (i.e. lines[936:994]).
del lines[936:994]
lines.insert(936, new_content)

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(lines)
