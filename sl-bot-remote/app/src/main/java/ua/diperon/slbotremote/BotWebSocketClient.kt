package ua.diperon.slbotremote

import android.util.Log
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import okio.ByteString

/**
 * Represents the current connection state of the WebSocket client.
 */
enum class ConnectionState {
    DISCONNECTED,
    CONNECTING,
    CONNECTED,
    ERROR
}

/**
 * Sealed class hierarchy mapping to the structures received from the WebSocket backend.
 */
sealed class BotWsMessage {
    data class BotRunningState(val isRunning: Boolean) : BotWsMessage()
    data class ConsoleLog(val message: String, val logType: String) : BotWsMessage()
    data class StreamFrame(
        val frameBase64: String,
        val deviceWidth: Int? = null,
        val deviceHeight: Int? = null
    ) : BotWsMessage()
    data class NodeExecuting(val nodeId: String, val nodeTitle: String? = null) : BotWsMessage()
    data class NodeDataUpdate(val nodeId: String, val data: Map<String, Any?>) : BotWsMessage()
    data class GlobalVariablesUpdate(val variables: Map<String, Any?>) : BotWsMessage()
    data class ScreenshotSaved(val filename: String, val projectName: String) : BotWsMessage()
    data class BotFinished(val status: String? = null, val error: String? = null) : BotWsMessage()
}

/**
 * A highly resilient and reactive WebSocket client for bidirectional communication in real time.
 */
class BotWebSocketClient {
    private val client = OkHttpClient()
    private var webSocket: WebSocket? = null
    
    private val scope = CoroutineScope(Dispatchers.IO)
    private val moshi = Moshi.Builder().addLast(KotlinJsonAdapterFactory()).build()

    // Status flows to notify UI of states and incoming data payloads
    private val _connectionState = MutableStateFlow(ConnectionState.DISCONNECTED)
    val connectionState: StateFlow<ConnectionState> = _connectionState

    private val _messages = MutableSharedFlow<BotWsMessage>(replay = 0, extraBufferCapacity = 64)
    val messages: SharedFlow<BotWsMessage> = _messages

    companion object {
        private const val TAG = "BotWebSocketClient"
    }

    /**
     * Initializes and opens a new WebSocket connection to the requested server.
     */
    fun connect(url: String) {
        if (_connectionState.value == ConnectionState.CONNECTED || _connectionState.value == ConnectionState.CONNECTING) {
            Log.d(TAG, "Connection already active or pending. Skipping.")
            return
        }

        Log.d(TAG, "Initiating WebSocket connection to $url")
        _connectionState.value = ConnectionState.CONNECTING

        val request = Request.Builder().url(url).build()
        webSocket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                Log.d(TAG, "WebSocket connection successfully opened")
                _connectionState.value = ConnectionState.CONNECTED
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                Log.v(TAG, "Received message payload: size=${text.length}")
                parseMessage(text)
            }

            override fun onMessage(webSocket: WebSocket, bytes: ByteString) {
                Log.v(TAG, "Received binary payload: size=${bytes.size}")
            }

            override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
                Log.d(TAG, "WebSocket closing: code=$code, reason=$reason")
                _connectionState.value = ConnectionState.DISCONNECTED
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                Log.d(TAG, "WebSocket closed: code=$code, reason=$reason")
                _connectionState.value = ConnectionState.DISCONNECTED
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                Log.e(TAG, "WebSocket exception occurred: ${t.message}", t)
                _connectionState.value = ConnectionState.ERROR
            }
        })
    }

    /**
     * Gracefully terminates the established WebSocket connection.
     */
    fun disconnect() {
        Log.d(TAG, "Explicit disconnection requested")
        webSocket?.close(1000, "User exited screen")
        webSocket = null
        _connectionState.value = ConnectionState.DISCONNECTED
    }

    /**
     * Sends action command to start execution of the complete bot script on backend.
     */
    fun startBot() {
        sendMessage("{\"type\": \"RUN_BOT\"}")
    }

    /**
     * Sends action command to immediately halt the bot operation.
     */
    fun stopBot() {
        sendMessage("{\"type\": \"STOP_BOT\"}")
    }

    /**
     * Sends WebSocket command to run a specific container / group node.
     */
    fun runContainerGroup(
        nodeId: String,
        nodeType: String = "groupNode",
        subNodes: Any? = null,
        subEdges: Any? = null
    ) {
        try {
            val json = org.json.JSONObject()
            json.put("type", "RUN_GROUP")
            json.put("nodeId", nodeId)

            val nodeObj = org.json.JSONObject()
            nodeObj.put("id", nodeId)
            nodeObj.put("type", nodeType)
            json.put("node", nodeObj)

            if (subNodes is List<*> && subNodes.isNotEmpty()) {
                val moshi = com.squareup.moshi.Moshi.Builder().add(com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory()).build()
                val listType = com.squareup.moshi.Types.newParameterizedType(List::class.java, Any::class.java)
                val jsonAdapter = moshi.adapter<List<Any>>(listType)
                val str = jsonAdapter.toJson(subNodes as List<Any>)
                json.put("nodes", org.json.JSONArray(str))
            }

            if (subEdges is List<*> && subEdges.isNotEmpty()) {
                val moshi = com.squareup.moshi.Moshi.Builder().add(com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory()).build()
                val listType = com.squareup.moshi.Types.newParameterizedType(List::class.java, Any::class.java)
                val jsonAdapter = moshi.adapter<List<Any>>(listType)
                val str = jsonAdapter.toJson(subEdges as List<Any>)
                json.put("edges", org.json.JSONArray(str))
            }

            sendMessage(json.toString())
        } catch (e: Exception) {
            Log.e(TAG, "Error sending RUN_GROUP: ${e.message}")
            sendMessage("{\"type\":\"RUN_GROUP\",\"nodeId\":\"$nodeId\",\"node\":{\"id\":\"$nodeId\"}}")
        }
    }

    /**
     * Sends WebSocket command to run a single node.
     */
    fun runSingleNode(nodeId: String) {
        sendMessage("{\"type\":\"RUN_SINGLE_NODE\",\"nodeId\":\"$nodeId\",\"node\":{\"id\":\"$nodeId\"}}")
    }

    /**
     * Sends WebSocket command to close all open browsers on computer.
     */
    fun closeAllBrowsers() {
        sendMessage("{\"type\":\"CLOSE_ALL_BROWSERS\"}")
    }

    /**
     * Sends message requesting the backend to begin transferring base64 screenshots.
     */
    fun startStream() {
        sendMessage("{\"type\": \"START_STREAM\"}")
    }

    /**
     * Sends message requesting the backend to stop streaming screenshots.
     */
    fun stopStream() {
        sendMessage("{\"type\": \"STOP_STREAM\"}")
    }

    /**
     * Generic method to send any browser interaction payload.
     */
    fun sendBrowserInteraction(
        action: String,
        relX: Float? = null,
        relY: Float? = null,
        x: Float? = null,
        y: Float? = null,
        button: String = "left",
        deltaX: Float? = null,
        deltaY: Float? = null,
        key: String? = null,
        text: String? = null,
        url: String? = null
    ) {
        val payload = mutableMapOf<String, Any>(
            "type" to "INTERACT_BROWSER",
            "action" to action
        )
        relX?.let { payload["relX"] = it }
        relY?.let { payload["relY"] = it }
        x?.let { payload["x"] = it }
        y?.let { payload["y"] = it }
        payload["button"] = button
        deltaX?.let { payload["deltaX"] = it }
        deltaY?.let { payload["deltaY"] = it }
        key?.let { payload["key"] = it }
        text?.let { payload["text"] = it }
        url?.let { payload["url"] = it }

        val json = moshi.adapter(Map::class.java).toJson(payload)
        sendMessage(json)
    }

    /**
     * Sends mouse click coordinates to interact with the Playwright browser.
     */
    fun sendMouseClick(relX: Float, relY: Float, button: String = "left") {
        sendBrowserInteraction("click", relX = relX, relY = relY, button = button)
    }

    fun sendMouseDown(relX: Float, relY: Float, button: String = "left") {
        sendBrowserInteraction("mousedown", relX = relX, relY = relY, button = button)
    }

    fun sendMouseMove(relX: Float, relY: Float) {
        sendBrowserInteraction("mousemove", relX = relX, relY = relY)
    }

    fun sendMouseUp(relX: Float, relY: Float, button: String = "left") {
        sendBrowserInteraction("mouseup", relX = relX, relY = relY, button = button)
    }

    fun sendDoubleClick(relX: Float, relY: Float) {
        sendBrowserInteraction("double_click", relX = relX, relY = relY)
    }

    fun sendRightClick(relX: Float, relY: Float) {
        sendBrowserInteraction("right_click", relX = relX, relY = relY)
    }

    fun sendScroll(deltaX: Float, deltaY: Float) {
        sendBrowserInteraction("scroll", deltaX = deltaX, deltaY = deltaY)
    }

    fun sendScrollUp(delta: Int = 500) {
        sendBrowserInteraction("scroll_up", deltaY = delta.toFloat())
    }

    fun sendScrollDown(delta: Int = 500) {
        sendBrowserInteraction("scroll_down", deltaY = delta.toFloat())
    }

    fun sendKeyPress(key: String) {
        sendBrowserInteraction("keypress", key = key)
    }

    fun sendTypeText(text: String, pressEnter: Boolean = false) {
        sendBrowserInteraction("type_text", text = text)
        if (pressEnter) {
            sendBrowserInteraction("enter")
        }
    }

    fun sendEsc() {
        sendBrowserInteraction("esc")
    }

    fun sendEnter() {
        sendBrowserInteraction("enter")
    }

    fun sendBackspace() {
        sendBrowserInteraction("backspace")
    }

    fun sendTab() {
        sendBrowserInteraction("tab")
    }

    fun refreshPage() {
        sendBrowserInteraction("reload")
    }

    fun navigateToUrl(url: String) {
        sendBrowserInteraction("navigate", url = url)
    }

    fun goBack() {
        sendBrowserInteraction("go_back")
    }

    fun goForward() {
        sendBrowserInteraction("go_forward")
    }

    /**
     * Backward-compatible helper with absolute coordinates.
     */
    fun sendMouseClick(x: Float, y: Float, width: Int, height: Int) {
        val relX = if (width > 0) x / width.toFloat() else 0f
        val relY = if (height > 0) y / height.toFloat() else 0f
        sendMouseClick(relX, relY)
    }

    /**
     * Internal helper to safely send string messages through OkHttp.
     */
    private fun sendMessage(text: String) {
        webSocket?.let { ws ->
            val success = ws.send(text)
            Log.d(TAG, "Sent raw message: '$text', success=$success")
        } ?: Log.e(TAG, "Cannot send message, WebSocket is not initialized")
    }

    /**
     * Parses the incoming JSON string and emits the parsed message variant.
     */
    private fun parseMessage(jsonString: String) {
        try {
            val jsonObject = org.json.JSONObject(jsonString)
            val type = jsonObject.optString("type")
            if (type.isBlank()) return

            val message: BotWsMessage? = when (type) {
                "STREAM_FRAME" -> {
                    val frame = jsonObject.optString("frame", "")
                    val meta = jsonObject.optJSONObject("metadata")
                    val deviceWidth = meta?.optInt("deviceWidth")?.takeIf { it > 0 }
                    val deviceHeight = meta?.optInt("deviceHeight")?.takeIf { it > 0 }
                    BotWsMessage.StreamFrame(frame, deviceWidth, deviceHeight)
                }
                "BOT_RUNNING_STATE" -> {
                    val isRunning = jsonObject.optBoolean("isRunning", false)
                    BotWsMessage.BotRunningState(isRunning)
                }
                "CONSOLE_LOG" -> {
                    val msg = jsonObject.optString("message", "")
                    val logType = jsonObject.optString("logType", "info")
                    BotWsMessage.ConsoleLog(msg, logType)
                }
                "NODE_EXECUTING" -> {
                    val nodeId = jsonObject.optString("nodeId", "")
                    val nodeTitle = jsonObject.optString("nodeTitle", "").takeIf { it.isNotBlank() }
                    BotWsMessage.NodeExecuting(nodeId, nodeTitle)
                }
                "NODE_DATA_UPDATE", "UPDATE_NODE_DATA" -> {
                    val nodeId = jsonObject.optString("nodeId", "")
                    val dataObj = jsonObject.optJSONObject("newData") ?: jsonObject.optJSONObject("data")
                    val map = mutableMapOf<String, Any?>()
                    dataObj?.let { obj ->
                        val keys = obj.keys()
                        while (keys.hasNext()) {
                            val k = keys.next()
                            map[k] = obj.opt(k)
                        }
                    }
                    BotWsMessage.NodeDataUpdate(nodeId, map)
                }
                "GLOBAL_VARIABLES_UPDATE" -> {
                    val varsObj = jsonObject.optJSONObject("variables")
                    val map = mutableMapOf<String, Any?>()
                    varsObj?.let { obj ->
                        val keys = obj.keys()
                        while (keys.hasNext()) {
                            val k = keys.next()
                            map[k] = obj.opt(k)
                        }
                    }
                    BotWsMessage.GlobalVariablesUpdate(map)
                }
                "SCREENSHOT_SAVED" -> {
                    val filename = jsonObject.optString("filename", "")
                    val projectName = jsonObject.optString("projectName", "")
                    BotWsMessage.ScreenshotSaved(filename, projectName)
                }
                "BOT_FINISHED" -> {
                    val status = jsonObject.optString("status", "").takeIf { it.isNotBlank() }
                    val error = jsonObject.optString("error", "").takeIf { it.isNotBlank() }
                    BotWsMessage.BotFinished(status, error)
                }
                else -> {
                    Log.w(TAG, "Unknown message type discovered: $type")
                    null
                }
            }

            message?.let {
                if (!_messages.tryEmit(it)) {
                    scope.launch {
                        _messages.emit(it)
                    }
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Crucial error occurred parsing message json: ${e.message}", e)
        }
    }
}
