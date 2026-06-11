import sys

file_path = r'd:\SF\sl-bot-remote\app\src\main\java\com\example\ProjectMonitorScreen.kt'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Add imports
imports = """import androidx.compose.material.icons.filled.ChevronLeft
import androidx.compose.material.icons.filled.ChevronRight"""

if "import androidx.compose.material.icons.filled.ChevronLeft" not in content:
    content = content.replace("import androidx.compose.material.icons.filled.Close", 
                              "import androidx.compose.material.icons.filled.Close\n" + imports)

# Update StatusControlCard invocation
call_search = """StatusControlCard(
                    modifier = Modifier.weight(1f),
                    isBotRunning = isRunning,
                    isBrowserOpen = viewModel.isBrowserOpen.collectAsState().value,
                    onStartClick = { viewModel.runBot() },
                    onStopClick = { viewModel.stopBot() },
                    onToggleBrowser = { viewModel.toggleBrowser() },
                    onRefreshPage = { viewModel.refreshPage() },
                    onPrevProject = onPrevProject,
                    onNextProject = onNextProject
                )"""

call_replace = """StatusControlCard(
                    modifier = Modifier.weight(1f),
                    isBotRunning = isRunning,
                    isBrowserOpen = viewModel.isBrowserOpen.collectAsState().value,
                    onStartClick = { viewModel.runBot() },
                    onStopClick = { viewModel.stopBot() },
                    onToggleBrowser = { viewModel.toggleBrowser() },
                    onRefreshPage = { viewModel.refreshPage() },
                    onPrevProject = { viewModel.navigateProject(-1, onNavigateToProject) },
                    onNextProject = { viewModel.navigateProject(1, onNavigateToProject) }
                )"""

if call_search in content:
    content = content.replace(call_search, call_replace)
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Successfully patched")
else:
    print("Could not find call_search")

