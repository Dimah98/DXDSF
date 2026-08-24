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
    data class StreamFrame(val frameBase64: String) : BotWsMessage()
    object BotFinished : BotWsMessage()
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
     * Sends mouse click coordinates to interact with the Playwright browser.
     */
    fun sendMouseClick(x: Float, y: Float, width: Int, height: Int) {
        sendMessage("{\"type\": \"INTERACT_BROWSER\", \"action\": \"click\", \"x\": $x, \"y\": $y}")
    }

    /**
     * Оновлює сторінку в браузері.
     */
    fun refreshPage() {
        sendMessage("{\"type\": \"INTERACT_BROWSER\", \"action\": \"refresh\", \"x\": 0, \"y\": 0}")
    }

    /**
     * Відправляє жест прокрутки.
     */
    fun sendScroll(deltaX: Float, deltaY: Float) {
        sendMessage("{\"type\": \"INTERACT_BROWSER\", \"action\": \"scroll\", \"x\": 0, \"y\": 0, \"deltaX\": ${deltaX.toInt()}, \"deltaY\": ${deltaY.toInt()}}")
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
            // First parse the message into a generic map to determine its "type" field
            val mapAdapter = moshi.adapter(Map::class.java)
            val rawMap = mapAdapter.fromJson(jsonString) as? Map<*, *> ?: return
            
            val type = rawMap["type"] as? String ?: return
            Log.d(TAG, "Parsing WS event of type: $type")

            val message: BotWsMessage? = when (type) {
                "BOT_RUNNING_STATE" -> {
                    val isRunning = rawMap["isRunning"] as? Boolean ?: false
                    BotWsMessage.BotRunningState(isRunning)
                }
                "CONSOLE_LOG" -> {
                    val msg = rawMap["message"] as? String ?: ""
                    val logType = rawMap["logType"] as? String ?: "info"
                    BotWsMessage.ConsoleLog(msg, logType)
                }
                "STREAM_FRAME" -> {
                    val frame = rawMap["frame"] as? String ?: ""
                    BotWsMessage.StreamFrame(frame)
                }
                "BOT_FINISHED" -> {
                    BotWsMessage.BotFinished
                }
                else -> {
                    Log.w(TAG, "Unknown message type discovered: $type")
                    null
                }
            }

            message?.let {
                scope.launch {
                    _messages.emit(it)
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Crucial error occurred parsing message json: ${e.message}", e)
        }
    }
}
