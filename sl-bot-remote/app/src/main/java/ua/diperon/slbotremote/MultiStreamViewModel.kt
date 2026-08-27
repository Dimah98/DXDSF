package ua.diperon.slbotremote

import android.app.Application
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Base64
import android.util.Log
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

enum class WallGridMode(val rows: Int, val cols: Int, val capacity: Int, val title: String) {
    GRID_2X2(2, 2, 4, "2×2 (4 боти)"),
    GRID_3X3(3, 3, 9, "3×3 (9 ботів)"),
    GRID_1X2(2, 1, 2, "1×2 (2 боти)")
}

data class StreamSlotData(
    val slotIndex: Int,
    val projectName: String = "",
    val isRunning: Boolean = false,
    val isBrowserOpen: Boolean = false,
    val activeNodeTitle: String? = null,
    val frameBitmap: Bitmap? = null,
    val isStreaming: Boolean = false,
    val connectionState: ConnectionState = ConnectionState.DISCONNECTED
)

class MultiStreamViewModel(application: Application) : AndroidViewModel(application) {

    companion object {
        private const val TAG = "MultiStreamViewModel"
    }

    private val context = application.applicationContext
    private val configManager = ConnectionConfigManager(context)

    private val _gridMode = MutableStateFlow(WallGridMode.GRID_2X2)
    val gridMode: StateFlow<WallGridMode> = _gridMode.asStateFlow()

    private val _allProjects = MutableStateFlow<List<String>>(emptyList())
    val allProjects: StateFlow<List<String>> = _allProjects.asStateFlow()

    private val _slots = MutableStateFlow<List<StreamSlotData>>(
        (0 until WallGridMode.GRID_3X3.capacity).map { StreamSlotData(slotIndex = it) }
    )
    val slots: StateFlow<List<StreamSlotData>> = _slots.asStateFlow()

    private val wsClients = mutableMapOf<Int, BotWebSocketClient>()
    private val messageJobs = mutableMapOf<Int, Job>()
    private val isDecodingMap = mutableMapOf<Int, java.util.concurrent.atomic.AtomicBoolean>()

    fun setGridMode(mode: WallGridMode) {
        _gridMode.value = mode
        adjustSlotsCapacity(mode.capacity)
    }

    fun loadProjects(apiService: BotApiService?) {
        viewModelScope.launch {
            try {
                if (apiService == null) return@launch

                // Fetch overview to find projects with open browsers
                val overview = try {
                    apiService.getProjectsOverview()
                } catch (e: Exception) {
                    val names = try { apiService.getProjects() } catch (_: Exception) { emptyList() }
                    val statusMap = try { apiService.getProjectsStatus() } catch (_: Exception) { emptyMap() }
                    names.map { n ->
                        val st = statusMap[n]
                        ProjectOverviewItem(
                            name = n,
                            isRunning = st?.isRunning ?: false,
                            isBrowserOpen = st?.isBrowserOpen ?: false,
                            activeNodeTitle = st?.activeNodeTitle
                        )
                    }
                }

                _allProjects.value = overview.map { it.name }

                // Filter ONLY projects where browser is open or bot is running
                val activeProjects = overview.filter { it.isBrowserOpen || it.isRunning }

                val currentSlots = (0 until WallGridMode.GRID_3X3.capacity).map { StreamSlotData(slotIndex = it) }.toMutableList()
                val capacity = _gridMode.value.capacity

                // Disconnect existing slots
                for (i in _slots.value.indices) {
                    disconnectSlot(i)
                }

                for (i in 0 until minOf(capacity, activeProjects.size)) {
                    val p = activeProjects[i]
                    currentSlots[i] = StreamSlotData(
                        slotIndex = i,
                        projectName = p.name,
                        isRunning = p.isRunning,
                        isBrowserOpen = p.isBrowserOpen,
                        activeNodeTitle = p.activeNodeTitle
                    )
                }

                _slots.value = currentSlots

                // Start streams ONLY for projects with open browser / running
                for (i in 0 until minOf(capacity, activeProjects.size)) {
                    if (currentSlots[i].projectName.isNotBlank()) {
                        connectSlot(i, currentSlots[i].projectName, startStreamingImmediately = true)
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error loading projects for video wall: ${e.message}")
            }
        }
    }

    fun selectProjectForSlot(slotIndex: Int, projectName: String) {
        if (slotIndex !in _slots.value.indices) return
        disconnectSlot(slotIndex)

        val updated = _slots.value.toMutableList()
        val oldBitmap = updated[slotIndex].frameBitmap
        if (oldBitmap != null && !oldBitmap.isRecycled) {
            oldBitmap.recycle()
        }
        updated[slotIndex] = StreamSlotData(slotIndex = slotIndex, projectName = projectName)
        _slots.value = updated

        if (projectName.isNotBlank()) {
            connectSlot(slotIndex, projectName, startStreamingImmediately = false)
        }
    }

    private fun connectSlot(slotIndex: Int, projectName: String, startStreamingImmediately: Boolean = false) {
        disconnectSlot(slotIndex)
        val wsUrl = configManager.getWebSocketUrl(projectName)
        val client = BotWebSocketClient()
        wsClients[slotIndex] = client
        isDecodingMap[slotIndex] = java.util.concurrent.atomic.AtomicBoolean(false)

        val job = viewModelScope.launch {
            launch {
                client.connectionState.collect { state ->
                    updateSlot(slotIndex) { it.copy(connectionState = state) }
                }
            }
            launch {
                client.messages.collect { msg ->
                    handleWsMessage(slotIndex, msg)
                }
            }
        }
        messageJobs[slotIndex] = job
        client.connect(wsUrl)
        if (startStreamingImmediately) {
            client.startStream()
            updateSlot(slotIndex) { it.copy(isStreaming = true) }
        } else {
            updateSlot(slotIndex) { it.copy(isStreaming = false) }
        }
    }

    private fun handleWsMessage(slotIndex: Int, msg: BotWsMessage) {
        when (msg) {
            is BotWsMessage.StreamFrame -> {
                decodeFrame(slotIndex, msg.frameBase64)
            }
            is BotWsMessage.BotRunningState -> {
                updateSlot(slotIndex) { it.copy(isRunning = msg.isRunning) }
            }
            is BotWsMessage.NodeExecuting -> {
                updateSlot(slotIndex) { it.copy(activeNodeTitle = msg.nodeTitle) }
            }
            is BotWsMessage.BotFinished -> {
                updateSlot(slotIndex) { it.copy(isRunning = false, activeNodeTitle = null) }
            }
            else -> {}
        }
    }

    private fun decodeFrame(slotIndex: Int, base64Str: String) {
        if (base64Str.isBlank()) return
        val isDecoding = isDecodingMap.getOrPut(slotIndex) { java.util.concurrent.atomic.AtomicBoolean(false) }
        if (!isDecoding.compareAndSet(false, true)) return

        viewModelScope.launch(Dispatchers.Default) {
            try {
                val cleanBase64 = if (base64Str.contains(",")) {
                    base64Str.substring(base64Str.indexOf(",") + 1)
                } else {
                    base64Str
                }
                val imageBytes = Base64.decode(cleanBase64, Base64.DEFAULT)
                val options = BitmapFactory.Options().apply {
                    inPreferredConfig = Bitmap.Config.RGB_565
                    inSampleSize = 1
                }
                val newBitmap = BitmapFactory.decodeByteArray(imageBytes, 0, imageBytes.size, options)
                if (newBitmap != null) {
                    withContext(Dispatchers.Main) {
                        val currentSlot = _slots.value.getOrNull(slotIndex)
                        val oldBitmap = currentSlot?.frameBitmap
                        updateSlot(slotIndex) { it.copy(frameBitmap = newBitmap) }
                        if (oldBitmap != null && oldBitmap != newBitmap && !oldBitmap.isRecycled) {
                            oldBitmap.recycle()
                        }
                    }
                }
            } catch (e: Exception) {
                Log.w(TAG, "Frame decode error in slot $slotIndex: ${e.message}")
            } finally {
                isDecoding.set(false)
            }
        }
    }

    fun toggleBot(slotIndex: Int) {
        val slot = _slots.value.getOrNull(slotIndex) ?: return
        val client = wsClients[slotIndex] ?: return
        if (slot.isRunning) {
            client.stopBot()
        } else {
            client.startBot()
        }
    }

    fun toggleStream(slotIndex: Int) {
        val slot = _slots.value.getOrNull(slotIndex) ?: return
        val client = wsClients[slotIndex] ?: return
        if (slot.isStreaming) {
            client.stopStream()
            updateSlot(slotIndex) { it.copy(isStreaming = false) }
        } else {
            client.startStream()
            updateSlot(slotIndex) { it.copy(isStreaming = true) }
        }
    }

    fun startAllVisibleBots() {
        val capacity = _gridMode.value.capacity
        for (i in 0 until capacity) {
            wsClients[i]?.startBot()
        }
    }

    fun stopAllVisibleBots() {
        val capacity = _gridMode.value.capacity
        for (i in 0 until capacity) {
            wsClients[i]?.stopBot()
        }
    }

    fun resumeAllStreams() {
        val capacity = _gridMode.value.capacity
        for (i in 0 until capacity) {
            wsClients[i]?.startStream()
            updateSlot(i) { it.copy(isStreaming = true) }
        }
    }

    fun pauseAllStreams() {
        val capacity = _gridMode.value.capacity
        for (i in 0 until capacity) {
            wsClients[i]?.stopStream()
            updateSlot(i) { it.copy(isStreaming = false) }
        }
    }

    private fun adjustSlotsCapacity(capacity: Int) {
        val current = _slots.value
        for (i in 0 until capacity) {
            val slot = current.getOrNull(i)
            if (slot != null && slot.projectName.isNotBlank() && wsClients[i] == null) {
                connectSlot(i, slot.projectName)
            }
        }
    }

    private fun disconnectSlot(slotIndex: Int) {
        messageJobs[slotIndex]?.cancel()
        messageJobs.remove(slotIndex)
        wsClients[slotIndex]?.let { client ->
            client.stopStream()
            client.disconnect()
        }
        wsClients.remove(slotIndex)
    }

    private fun updateSlot(slotIndex: Int, transform: (StreamSlotData) -> StreamSlotData) {
        val current = _slots.value.toMutableList()
        if (slotIndex in current.indices) {
            current[slotIndex] = transform(current[slotIndex])
            _slots.value = current
        }
    }

    override fun onCleared() {
        super.onCleared()
        for (i in _slots.value.indices) {
            disconnectSlot(i)
            val bm = _slots.value[i].frameBitmap
            if (bm != null && !bm.isRecycled) {
                bm.recycle()
            }
        }
    }
}
