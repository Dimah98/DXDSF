import sys

file_path = r'd:\SF\sl-bot-remote\app\src\main\java\com\example\ProjectMonitorScreen.kt'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update the call to StatusControlCard
call_search = '''StatusControlCard(
                    modifier = Modifier.weight(1f),
                    isBotRunning = isRunning,
                    isBrowserOpen = viewModel.isBrowserOpen.collectAsState().value,
                    onStartClick = { viewModel.runBot() },
                    onStopClick = { viewModel.stopBot() },
                    onToggleBrowser = { viewModel.toggleBrowser() },
                    onRefreshPage = { viewModel.refreshPage() }
                )'''

call_replace = '''StatusControlCard(
                    modifier = Modifier.weight(1f),
                    isBotRunning = isRunning,
                    isBrowserOpen = viewModel.isBrowserOpen.collectAsState().value,
                    onStartClick = { viewModel.runBot() },
                    onStopClick = { viewModel.stopBot() },
                    onToggleBrowser = { viewModel.toggleBrowser() },
                    onRefreshPage = { viewModel.refreshPage() },
                    onPrevProject = onPrevProject,
                    onNextProject = onNextProject
                )'''

# 2. Update StatusControlCard signature and body
def_search = '''fun StatusControlCard(
    modifier: Modifier = Modifier,
    isBotRunning: Boolean,
    isBrowserOpen: Boolean,
    onStartClick: () -> Unit,
    onStopClick: () -> Unit,
    onToggleBrowser: () -> Unit,
    onRefreshPage: () -> Unit
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

            // Кнопка оновлення сторінки замість навігації
            Button(
                onClick = onRefreshPage,
                modifier = Modifier.fillMaxWidth().height(48.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = Color.White.copy(alpha = 0.1f),
                    contentColor = Color.White
                ),
                shape = RoundedCornerShape(12.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.Refresh,
                    contentDescription = null,
                    modifier = Modifier.size(20.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text("Оновити сторінку")
            }'''

def_replace = '''fun StatusControlCard(
    modifier: Modifier = Modifier,
    isBotRunning: Boolean,
    isBrowserOpen: Boolean,
    onStartClick: () -> Unit,
    onStopClick: () -> Unit,
    onToggleBrowser: () -> Unit,
    onRefreshPage: () -> Unit,
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
            // Навігація між проектами та кнопка оновлення
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = onPrevProject) {
                    Icon(imageVector = Icons.Default.ChevronLeft, contentDescription = "Попередній проект", tint = Color.White)
                }
                
                Button(
                    onClick = onRefreshPage,
                    modifier = Modifier.weight(1f).height(40.dp).padding(horizontal = 8.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color.White.copy(alpha = 0.1f),
                        contentColor = Color.White
                    ),
                    shape = RoundedCornerShape(12.dp),
                    contentPadding = PaddingValues(0.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Refresh,
                        contentDescription = null,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Оновити", fontSize = 13.sp)
                }

                IconButton(onClick = onNextProject) {
                    Icon(imageVector = Icons.Default.ChevronRight, contentDescription = "Наступний проект", tint = Color.White)
                }
            }'''

if call_search in content and def_search in content:
    content = content.replace(call_search, call_replace)
    content = content.replace(def_search, def_replace)
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Success")
else:
    print("Search failed. Let's dump snippet matching StatusControlCard")
    print("call_search matched? ", call_search in content)
    print("def_search matched? ", def_search in content)
