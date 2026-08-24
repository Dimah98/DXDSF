import re

file_path = r'd:\SF\sl-bot-remote\app\src\main\java\com\example\ProjectMonitorScreen.kt'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

new_status_card = '''@Composable
fun StatusControlCard(
    modifier: Modifier = Modifier,
    isBotRunning: Boolean,
    isBrowserOpen: Boolean,
    onStartClick: () -> Unit,
    onStopClick: () -> Unit,
    onToggleBrowser: () -> Unit,
    onPrevProject: () -> Unit,
    onNextProject: () -> Unit
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(24.dp),
        colors = CardDefaults.cardColors(
            containerColor = Color(0xFF1C1F26) // Темно-синій відтінок
        ),
        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.05f))
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Text(
                text = "Контроль двигуна",
                color = Color.White,
                fontWeight = FontWeight.Bold,
                style = MaterialTheme.typography.titleMedium
            )

            // Навігація між проектами
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(
                    onClick = onPrevProject,
                    modifier = Modifier.background(Color.White.copy(alpha = 0.1f), CircleShape)
                ) {
                    Icon(imageVector = Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Попередній", tint = Color.White)
                }
                Text("Навігація", color = Color.White.copy(alpha = 0.7f), style = MaterialTheme.typography.bodyMedium)
                IconButton(
                    onClick = onNextProject,
                    modifier = Modifier.background(Color.White.copy(alpha = 0.1f), CircleShape)
                ) {
                    Icon(imageVector = Icons.AutoMirrored.Filled.ArrowForward, contentDescription = "Наступний", tint = Color.White)
                }
            }

            HorizontalDivider(color = Color.White.copy(alpha = 0.05f))

            // Кнопки управління
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                // Кнопка браузера
                Button(
                    onClick = onToggleBrowser,
                    modifier = Modifier.weight(1f).height(48.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (isBrowserOpen) Color(0xFFEF4444).copy(alpha = 0.2f) else Color.White.copy(alpha = 0.1f),
                        contentColor = if (isBrowserOpen) Color(0xFFEF4444) else Color.White
                    ),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Icon(
                        imageVector = if (isBrowserOpen) Icons.Default.PublicOff else Icons.Default.Public,
                        contentDescription = null,
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(if (isBrowserOpen) "Закрити" else "Браузер")
                }

                // Кнопка бота
                Button(
                    onClick = if (isBotRunning) onStopClick else onStartClick,
                    modifier = Modifier.weight(1f).height(48.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (isBotRunning) Color(0xFFEF4444) else Color(0xFF10B981),
                        contentColor = Color.White
                    ),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Icon(
                        imageVector = if (isBotRunning) Icons.Default.Stop else Icons.Default.PlayArrow,
                        contentDescription = null,
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(if (isBotRunning) "Зупинити" else "Старт")
                }
            }
        }
    }
}

@Composable
fun ProjectInventoryCard(
    modifier: Modifier = Modifier,
    onOpenInventory: () -> Unit
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(24.dp),
        colors = CardDefaults.cardColors(
            containerColor = Color(0xFF1C1F26)
        ),
        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.05f))
    ) {
        Column(
            modifier = Modifier.padding(16.dp).fillMaxSize(),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Icon(
                imageVector = Icons.Default.Inventory,
                contentDescription = null,
                tint = Color(0xFF818CF8),
                modifier = Modifier.size(48.dp)
            )
            Spacer(modifier = Modifier.height(16.dp))
            Button(
                onClick = onOpenInventory,
                modifier = Modifier.fillMaxWidth().height(48.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = Color(0xFF818CF8).copy(alpha = 0.2f),
                    contentColor = Color(0xFF818CF8)
                ),
                shape = RoundedCornerShape(12.dp)
            ) {
                Text("Відкрити інвентар", fontWeight = FontWeight.Bold)
            }
        }
    }'''

pattern = re.compile(r'@Composable\nfun StatusControlCard\(.*?(?=@Composable\nfun)', re.DOTALL)
match = pattern.search(content)
if match:
    content = content[:match.start()] + new_status_card + '\n\n' + content[match.end():]
    
    # Also remove ProjectStatsCard
    pattern2 = re.compile(r'@Composable\nfun ProjectStatsCard\(.*?(?=@Composable\nfun)', re.DOTALL)
    match2 = pattern2.search(content)
    if match2:
        content = content[:match2.start()] + content[match2.end():]
        
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Replaced cards successfully")
else:
    print("Cards not found")
