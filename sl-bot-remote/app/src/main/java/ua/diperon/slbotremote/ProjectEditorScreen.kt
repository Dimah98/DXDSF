package ua.diperon.slbotremote

import android.util.Log
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.RequestBody.Companion.toRequestBody
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import ua.diperon.slbotremote.ui.theme.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.launch
import kotlin.math.roundToInt

private const val TAG = "ProjectEditor"

// ===== ViewModel =====

class ProjectEditorViewModel(
    private val apiService: BotApiService,
    private val projectName: String
) : ViewModel() {

    val nodes = mutableStateListOf<EditorNode>()
    val edges = mutableStateListOf<EditorEdge>()
    var variables by mutableStateOf<Map<String, Any>>(emptyMap())
        private set
    var isLoading by mutableStateOf(false)
        private set
    var error by mutableStateOf<String?>(null)
        private set
    var isSaving by mutableStateOf(false)
        private set

    fun loadProject() {
        viewModelScope.launch {
            isLoading = true
            error = null
            try {
                Log.d(TAG, "Loading project raw JSON: $projectName")
                val responseBody = apiService.getProjectRaw(projectName)
                val jsonStr = responseBody.string()
                Log.d(TAG, "Got response, length=${jsonStr.length}")
                val root = org.json.JSONObject(jsonStr)
                val success = root.optBoolean("success", false)
                if (!success) {
                    error = root.optString("error", "Помилка завантаження")
                    Log.e(TAG, "Server error: $error")
                    return@launch
                }
                val data = root.optJSONObject("data") ?: run {
                    error = "Порожні дані проекту"
                    return@launch
                }
                val nodesArr = data.optJSONArray("nodes") ?: org.json.JSONArray()
                val edgesArr = data.optJSONArray("edges") ?: org.json.JSONArray()

                nodes.clear()
                nodes.addAll((0 until nodesArr.length()).map { i ->
                    val n = nodesArr.getJSONObject(i)
                    val pos = n.optJSONObject("position")
                    val nodeData = n.optJSONObject("data")?.let { jsonObjToMap(it) } ?: mutableMapOf()
                    EditorNode(
                        id = n.optString("id"),
                        type = n.optString("type"),
                        x = pos?.optDouble("x", 0.0)?.toFloat() ?: 0f,
                        y = pos?.optDouble("y", 0.0)?.toFloat() ?: 0f,
                        data = nodeData,
                        miniCollapsed = nodeData["miniCollapsed"] as? Boolean ?: false
                    )
                })
                edges.clear()
                edges.addAll((0 until edgesArr.length()).map { i ->
                    val e = edgesArr.getJSONObject(i)
                    EditorEdge(
                        id = e.optString("id"),
                        source = e.optString("source"),
                        target = e.optString("target"),
                        sourceHandle = e.optString("sourceHandle").takeIf { it.isNotBlank() },
                        targetHandle = e.optString("targetHandle").takeIf { it.isNotBlank() }
                    )
                })
                Log.d(TAG, "Parsed ${nodes.size} nodes, ${edges.size} edges")
            } catch (e: Exception) {
                Log.e(TAG, "Load project exception", e)
                error = "${e.javaClass.simpleName}: ${e.message}"
            } finally {
                isLoading = false
            }
        }
    }

    private fun jsonObjToMap(obj: org.json.JSONObject): MutableMap<String, Any?> {
        val map = mutableMapOf<String, Any?>()
        for (key in obj.keys()) {
            map[key] = when (val v = obj.get(key)) {
                is org.json.JSONObject -> jsonObjToMap(v)
                is org.json.JSONArray -> jsonArrToList(v)
                org.json.JSONObject.NULL -> null
                else -> v
            }
        }
        return map
    }

    private fun jsonArrToList(arr: org.json.JSONArray): List<Any?> {
        return (0 until arr.length()).map { i ->
            when (val v = arr.get(i)) {
                is org.json.JSONObject -> jsonObjToMap(v)
                is org.json.JSONArray -> jsonArrToList(v)
                org.json.JSONObject.NULL -> null
                else -> v
            }
        }
    }

    fun saveProject(onSuccess: () -> Unit = {}) {
        viewModelScope.launch {
            isSaving = true
            try {
                // Будуємо JSON вручну
                val nodesArr = org.json.JSONArray()
                nodes.forEach { n ->
                    val nd = org.json.JSONObject()
                    nd.put("id", n.id)
                    nd.put("type", n.type)
                    nd.put("position", org.json.JSONObject().apply {
                        put("x", n.x)
                        put("y", n.y)
                    })
                    nd.put("data", mapToJsonObj(n.data))
                    nodesArr.put(nd)
                }
                val edgesArr = org.json.JSONArray()
                edges.forEach { e ->
                    val ed = org.json.JSONObject()
                    ed.put("id", e.id)
                    ed.put("source", e.source)
                    ed.put("target", e.target)
                    ed.put("sourceHandle", e.sourceHandle ?: "")
                    ed.put("targetHandle", e.targetHandle ?: "")
                    ed.put("type", "default")
                    edgesArr.put(ed)
                }
                val payload = org.json.JSONObject()
                payload.put("name", projectName)
                payload.put("data", org.json.JSONObject().apply {
                    put("nodes", nodesArr)
                    put("edges", edgesArr)
                })
                val mediaType = "application/json; charset=utf-8".toMediaTypeOrNull()
                val body = payload.toString().toRequestBody(mediaType)
                apiService.saveProjectRaw(body)
                onSuccess()
            } catch (e: Exception) {
                Log.e(TAG, "Save project failed", e)
                error = e.message ?: "Помилка збереження"
            } finally {
                isSaving = false
            }
        }
    }

    @Suppress("UNCHECKED_CAST")
    private fun mapToJsonObj(map: Map<String, Any?>): org.json.JSONObject {
        val obj = org.json.JSONObject()
        map.forEach { (k, v) ->
            when (v) {
                null -> obj.put(k, org.json.JSONObject.NULL)
                is Map<*, *> -> obj.put(k, mapToJsonObj(v as Map<String, Any?>))
                is List<*> -> obj.put(k, listToJsonArr(v))
                else -> obj.put(k, v)
            }
        }
        return obj
    }

    @Suppress("UNCHECKED_CAST")
    private fun listToJsonArr(list: List<Any?>): org.json.JSONArray {
        val arr = org.json.JSONArray()
        list.forEach { v ->
            when (v) {
                null -> arr.put(org.json.JSONObject.NULL)
                is Map<*, *> -> arr.put(mapToJsonObj(v as Map<String, Any?>))
                is List<*> -> arr.put(listToJsonArr(v))
                else -> arr.put(v)
            }
        }
        return arr
    }

    fun addNode(type: String, x: Float, y: Float) {
        val id = "node_${System.currentTimeMillis()}_${(0..9999).random()}"
        val config = getNodeConfig(type)
        val newNode = EditorNode(
            id = id,
            type = type,
            x = x,
            y = y,
            data = mutableMapOf<String, Any?>("label" to config.label)
        )
        nodes.add(newNode)
    }

    fun removeNode(nodeId: String) {
        if (nodeId == "start_node") return // Захист стартової ноди
        nodes.removeAll { it.id == nodeId }
        edges.removeAll { it.source == nodeId || it.target == nodeId }
    }

    fun updateNode(nodeId: String, data: Map<String, Any?>) {
        val idx = nodes.indexOfFirst { it.id == nodeId }
        if (idx != -1) {
            val n = nodes[idx]
            val newData = n.data.toMutableMap()
            data.forEach { (k, v) ->
                if (v != null) newData[k] = v else newData.remove(k)
            }
            nodes[idx] = n.copy(data = newData)
        }
    }

    fun updateNodePosition(nodeId: String, x: Float, y: Float) {
        val idx = nodes.indexOfFirst { it.id == nodeId }
        if (idx != -1) {
            nodes[idx] = nodes[idx].copy(x = x, y = y)
        }
    }

    fun toggleMiniCollapsed(nodeId: String) {
        val idx = nodes.indexOfFirst { it.id == nodeId }
        if (idx != -1) {
            nodes[idx] = nodes[idx].copy(miniCollapsed = !nodes[idx].miniCollapsed)
        }
    }

    fun addEdge(source: String, target: String, sourceHandle: String? = null, targetHandle: String? = null) {
        if (source == target) return
        if (edges.any { it.source == source && it.target == target && it.sourceHandle == sourceHandle }) return
        val id = "edge_${System.currentTimeMillis()}_${(0..9999).random()}"
        edges.add(EditorEdge(id = id, source = source, target = target, sourceHandle = sourceHandle, targetHandle = targetHandle))
    }

    fun removeEdge(edgeId: String) {
        edges.removeAll { it.id == edgeId }
    }
}

// ===== Data Models =====

data class EditorNode(
    val id: String,
    val type: String,
    var x: Float,
    var y: Float,
    val data: MutableMap<String, Any?> = mutableMapOf(),
    val miniCollapsed: Boolean = false
) {
    val label: String get() = data["label"] as? String ?: getNodeConfig(type).label
    val nodeColor: Color get() = Color(getNodeConfig(type).color)
}

data class EditorEdge(
    val id: String,
    val source: String,
    val target: String,
    val sourceHandle: String? = null,
    val targetHandle: String? = null
)

// ===== Constants =====
private val NODE_WIDTH_DP = 220.dp
private val NODE_COLLAPSED_WIDTH_DP = 120.dp
private val NODE_HEADER_HEIGHT = 36.dp
private val PORT_RADIUS = 7.dp

// ===== Main Screen =====

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProjectEditorScreen(
    projectName: String,
    apiService: BotApiService,
    onBackClick: () -> Unit
) {
    val factory = remember(projectName, apiService) {
        object : androidx.lifecycle.ViewModelProvider.Factory {
            @Suppress("UNCHECKED_CAST")
            override fun <T : ViewModel> create(modelClass: Class<T>): T {
                return ProjectEditorViewModel(apiService, projectName) as T
            }
        }
    }
    val viewModel: ProjectEditorViewModel = androidx.lifecycle.viewmodel.compose.viewModel(factory = factory)

    LaunchedEffect(Unit) {
        viewModel.loadProject()
    }

    val nodes = viewModel.nodes
    val edges = viewModel.edges

    var selectedNode by remember { mutableStateOf<EditorNode?>(null) }
    var showSidebar by remember { mutableStateOf(false) }
    var showNodeSheet by remember { mutableStateOf(false) }
    var connectSource by remember { mutableStateOf<String?>(null) }
    var connectSourceHandle by remember { mutableStateOf<String?>(null) }
    var viewportCenter by remember { mutableStateOf(Pair(150f, 250f)) }
    var resetCenterTrigger by remember { mutableIntStateOf(0) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text("Редактор: $projectName", fontSize = 14.sp, color = Color.White)
                },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, null, tint = Color.White)
                    }
                },
                actions = {
                    Text(
                        text = if (viewModel.error != null) "Помилка: ${viewModel.error}" else "${nodes.size} нод",
                        color = if (viewModel.error != null) Color.Red else Color.White.copy(alpha = 0.5f),
                        fontSize = 10.sp,
                        modifier = Modifier.padding(end = 16.dp)
                    )
                    IconButton(onClick = { resetCenterTrigger++ }) {
                        Icon(Icons.Default.CenterFocusStrong, "Центрувати", tint = GlassGem)
                    }
                    IconButton(onClick = { showSidebar = !showSidebar }) {
                        Icon(Icons.Default.Menu, null, tint = Color.White)
                    }
                    IconButton(
                        onClick = { viewModel.saveProject() },
                        enabled = !viewModel.isSaving
                    ) {
                        if (viewModel.isSaving) {
                            CircularProgressIndicator(modifier = Modifier.size(20.dp), color = Color.White, strokeWidth = 2.dp)
                        } else {
                            Icon(Icons.Default.Save, null, tint = GlassSuccess)
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = GlassBg.copy(alpha = 0.85f))
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = { showSidebar = true },
                containerColor = GlassGem
            ) {
                Icon(Icons.Default.Add, null, tint = Color.White)
            }
        },
        containerColor = GlassBg
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            if (viewModel.isLoading) {
                Column(
                    modifier = Modifier.align(Alignment.Center),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    CircularProgressIndicator(color = GlassGem)
                    Spacer(Modifier.height(8.dp))
                    Text("Завантаження $projectName...", color = Color.White.copy(alpha = 0.5f), fontSize = 12.sp)
                }
            } else if (viewModel.error != null && nodes.isEmpty()) {
                Column(
                    modifier = Modifier.align(Alignment.Center).padding(32.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Icon(Icons.Default.Warning, null, tint = GlassError, modifier = Modifier.size(48.dp))
                    Spacer(Modifier.height(8.dp))
                    Text(viewModel.error!!, color = GlassError, fontSize = 14.sp)
                    Spacer(Modifier.height(16.dp))
                    Button(onClick = { viewModel.loadProject() }) {
                        Text("Повторити")
                    }
                }
            } else {
                NodeCanvas(
                    nodes = nodes,
                    edges = edges,
                    connectSource = connectSource,
                    resetCenterTrigger = resetCenterTrigger,
                    onViewportCenterChanged = { cx, cy ->
                        viewportCenter = Pair(cx, cy)
                    },
                    onNodeTap = { node ->
                        if (connectSource != null) {
                            if (connectSource != node.id) {
                                viewModel.addEdge(connectSource!!, node.id, connectSourceHandle, null)
                            }
                            connectSource = null
                            connectSourceHandle = null
                        } else {
                            selectedNode = node
                            showNodeSheet = true
                        }
                    },
                    onNodeLongPress = { node ->
                        connectSource = node.id
                        connectSourceHandle = null
                    },
                    onNodeDrag = { nodeId, dx, dy ->
                        val node = nodes.find { it.id == nodeId } ?: return@NodeCanvas
                        viewModel.updateNodePosition(nodeId, node.x + dx, node.y + dy)
                    },
                    onCanvasTap = {
                        connectSource = null
                        connectSourceHandle = null
                    },
                    onPortTap = { nodeId, portId, isInput ->
                        if (!isInput) {
                            connectSource = nodeId
                            connectSourceHandle = portId
                        } else if (connectSource != null) {
                            viewModel.addEdge(connectSource!!, nodeId, connectSourceHandle, portId)
                            connectSource = null
                            connectSourceHandle = null
                        }
                    },
                    onToggleMini = { nodeId ->
                        viewModel.toggleMiniCollapsed(nodeId)
                    },
                    onDeleteNode = { nodeId ->
                        viewModel.removeNode(nodeId)
                    },
                    onDataChange = { nodeId, data ->
                        viewModel.updateNode(nodeId, data)
                    }
                )

                // З'єднання підказка
                if (connectSource != null) {
                    Box(
                        modifier = Modifier
                            .align(Alignment.TopCenter)
                            .padding(top = 8.dp)
                            .background(GlassWarning.copy(alpha = 0.2f), RoundedCornerShape(8.dp))
                            .border(1.dp, GlassWarning, RoundedCornerShape(8.dp))
                            .padding(horizontal = 12.dp, vertical = 6.dp)
                    ) {
                        Text(
                            "Тапніть на цільову ноду або порт",
                            color = GlassWarning,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }

            // Сайдбар з типами нод
            AnimatedVisibility(
                visible = showSidebar,
                enter = slideInHorizontally { -it },
                exit = slideOutHorizontally { -it },
                modifier = Modifier.align(Alignment.CenterStart)
            ) {
                NodeTypeSidebar(
                    onSelectType = { type ->
                        viewModel.addNode(type, viewportCenter.first, viewportCenter.second)
                        showSidebar = false
                    },
                    onClose = { showSidebar = false }
                )
            }
        }
    }

    // BottomSheet для детального редагування
    if (showNodeSheet && selectedNode != null) {
        NodeEditSheet(
            node = selectedNode!!,
            onDismiss = { showNodeSheet = false },
            onUpdate = { data ->
                viewModel.updateNode(selectedNode!!.id, data)
            },
            onDelete = {
                viewModel.removeNode(selectedNode!!.id)
                showNodeSheet = false
            },
            onConnect = {
                connectSource = selectedNode!!.id
                connectSourceHandle = null
                showNodeSheet = false
            }
        )
    }
}

// ===== Canvas =====

@Composable
private fun NodeCanvas(
    nodes: List<EditorNode>,
    edges: List<EditorEdge>,
    connectSource: String?,
    resetCenterTrigger: Int = 0,
    onViewportCenterChanged: (Float, Float) -> Unit = { _, _ -> },
    onNodeTap: (EditorNode) -> Unit,
    onNodeLongPress: (EditorNode) -> Unit,
    onNodeDrag: (String, Float, Float) -> Unit,
    onCanvasTap: () -> Unit,
    onPortTap: (String, String, Boolean) -> Unit,
    onToggleMini: (String) -> Unit,
    onDeleteNode: (String) -> Unit,
    onDataChange: (String, Map<String, Any?>) -> Unit
) {
    val density = LocalDensity.current
    val nodeWidthPx = with(density) { NODE_WIDTH_DP.toPx() }
    val collapsedWidthPx = with(density) { NODE_COLLAPSED_WIDTH_DP.toPx() }
    val headerHeightPx = with(density) { NODE_HEADER_HEIGHT.toPx() }
    val portRadiusPx = with(density) { PORT_RADIUS.toPx() }

    var offsetX by remember { mutableFloatStateOf(0f) }
    var offsetY by remember { mutableFloatStateOf(0f) }
    var scale by remember { mutableFloatStateOf(1f) }

    var hasCentered by remember { mutableStateOf(false) }



    BoxWithConstraints(
        modifier = Modifier
            .fillMaxSize()
            .pointerInput(Unit) {
                detectTransformGestures { _, pan, zoom, _ ->
                    scale = (scale * zoom).coerceIn(0.15f, 3f)
                    offsetX += pan.x
                    offsetY += pan.y
                }
            }
            .pointerInput(Unit) {
                detectTapGestures(onTap = { onCanvasTap() })
            }
    ) {
        val screenW = with(density) { maxWidth.toPx() }
        val screenH = with(density) { maxHeight.toPx() }

        LaunchedEffect(resetCenterTrigger) {
            if (resetCenterTrigger > 0 && nodes.isNotEmpty()) {
                val minX = nodes.minOf { it.x }
                val maxX = nodes.maxOf { it.x }
                val minY = nodes.minOf { it.y }
                val maxY = nodes.maxOf { it.y }
                val graphW = (maxX - minX + 250f).coerceAtLeast(300f)
                val graphH = (maxY - minY + 200f).coerceAtLeast(300f)

                val autoScale = minOf(screenW / graphW, screenH / graphH).coerceIn(0.2f, 1f)
                scale = autoScale
                offsetX = -minX * autoScale + 30f
                offsetY = -minY * autoScale + 30f
            }
        }

        LaunchedEffect(nodes.isNotEmpty()) {
            if (!hasCentered && nodes.isNotEmpty()) {
                val minX = nodes.minOf { it.x }
                val maxX = nodes.maxOf { it.x }
                val minY = nodes.minOf { it.y }
                val maxY = nodes.maxOf { it.y }
                val graphW = (maxX - minX + 250f).coerceAtLeast(300f)
                val graphH = (maxY - minY + 200f).coerceAtLeast(300f)

                val autoScale = minOf(screenW / graphW, screenH / graphH).coerceIn(0.2f, 1f)
                scale = autoScale
                offsetX = -minX * autoScale + 30f
                offsetY = -minY * autoScale + 30f
                hasCentered = true
            }
        }

        LaunchedEffect(offsetX, offsetY, scale, screenW, screenH) {
            val cx = (-offsetX + screenW / 2f) / scale
            val cy = (-offsetY + screenH / 2f) / scale
            onViewportCenterChanged(cx, cy)
        }
        // Малюємо лінії (edges) з урахуванням портів
        Canvas(modifier = Modifier.fillMaxSize()) {
            edges.forEach { edge ->
                val src = nodes.find { it.id == edge.source } ?: return@forEach
                val tgt = nodes.find { it.id == edge.target } ?: return@forEach
                val srcConfig = getNodeConfig(src.type)
                val tgtConfig = getNodeConfig(tgt.type)

                val srcW = if (src.miniCollapsed) collapsedWidthPx else nodeWidthPx
                val tgtW = if (tgt.miniCollapsed) collapsedWidthPx else nodeWidthPx

                // Визначаємо Y порту за індексом
                val srcOutputs = srcConfig.outputs
                val srcPortIdx = srcOutputs.indexOfFirst { it.id == edge.sourceHandle }.takeIf { it >= 0 } ?: 0
                val srcPortY = if (src.miniCollapsed) headerHeightPx / 2
                    else headerHeightPx + portRadiusPx + srcPortIdx * (portRadiusPx * 3)

                val tgtInputs = tgtConfig.inputs
                val tgtPortIdx = tgtInputs.indexOfFirst { it.id == edge.targetHandle }.takeIf { it >= 0 } ?: 0
                val tgtPortY = if (tgt.miniCollapsed) headerHeightPx / 2
                    else headerHeightPx + portRadiusPx + tgtPortIdx * (portRadiusPx * 3)

                val startX = (src.x + srcW) * scale + offsetX
                val startY = (src.y + srcPortY) * scale + offsetY
                val endX = tgt.x * scale + offsetX
                val endY = (tgt.y + tgtPortY) * scale + offsetY

                // Малюємо криву Безьє
                val portColor = srcOutputs.getOrNull(srcPortIdx)?.color ?: GlassOnSurfaceDim
                drawBezierEdge(startX, startY, endX, endY, portColor.copy(alpha = 0.6f))
            }

            // Підсвітка джерела при з'єднанні
            if (connectSource != null) {
                val src = nodes.find { it.id == connectSource } ?: return@Canvas
                val srcW = if (src.miniCollapsed) collapsedWidthPx else nodeWidthPx
                drawCircle(
                    color = GlassWarning.copy(alpha = 0.2f),
                    radius = 60f * scale,
                    center = Offset(
                        (src.x + srcW / 2) * scale + offsetX,
                        (src.y + headerHeightPx / 2) * scale + offsetY
                    )
                )
            }
        }

        // Рендеримо ноди
        nodes.forEach { node ->
            NodeCardV2(
                node = node,
                offsetX = offsetX,
                offsetY = offsetY,
                scale = scale,
                isHighlighted = connectSource == node.id,
                onTap = { onNodeTap(node) },
                onLongPress = { onNodeLongPress(node) },
                onDrag = { dx, dy -> onNodeDrag(node.id, dx / scale, dy / scale) },
                onPortTap = { portId, isInput -> onPortTap(node.id, portId, isInput) },
                onToggleMini = { onToggleMini(node.id) },
                onDeleteNode = { onDeleteNode(node.id) },
                onDataChange = { data -> onDataChange(node.id, data) }
            )
        }
    }
}

// ===== Bezier Edge Drawing =====

private fun DrawScope.drawBezierEdge(x1: Float, y1: Float, x2: Float, y2: Float, color: Color) {
    val dx = kotlin.math.abs(x2 - x1) * 0.5f
    val path = Path().apply {
        moveTo(x1, y1)
        cubicTo(x1 + dx, y1, x2 - dx, y2, x2, y2)
    }
    drawPath(path, color, style = Stroke(width = 2f))

    // Стрілка
    val angle = kotlin.math.atan2(y2 - y1, x2 - x1)
    val arrowLen = 10f
    val arrowAngle = 0.5f
    drawLine(
        color = color,
        start = Offset(x2, y2),
        end = Offset(x2 - arrowLen * kotlin.math.cos(angle - arrowAngle), y2 - arrowLen * kotlin.math.sin(angle - arrowAngle)),
        strokeWidth = 2f
    )
    drawLine(
        color = color,
        start = Offset(x2, y2),
        end = Offset(x2 - arrowLen * kotlin.math.cos(angle + arrowAngle), y2 - arrowLen * kotlin.math.sin(angle + arrowAngle)),
        strokeWidth = 2f
    )
}

// ===== Node Card V2 =====

@Composable
private fun NodeCardV2(
    node: EditorNode,
    offsetX: Float,
    offsetY: Float,
    scale: Float,
    isHighlighted: Boolean,
    onTap: () -> Unit,
    onLongPress: () -> Unit,
    onDrag: (Float, Float) -> Unit,
    onPortTap: (String, Boolean) -> Unit,
    onToggleMini: () -> Unit,
    onDeleteNode: () -> Unit,
    onDataChange: (Map<String, Any?>) -> Unit
) {
    val density = LocalDensity.current
    val config = getNodeConfig(node.type)
    val nodeColor = Color(config.color)

    val xPx = (node.x * scale + offsetX)
    val yPx = (node.y * scale + offsetY)
    val widthDp = if (node.miniCollapsed) NODE_COLLAPSED_WIDTH_DP else NODE_WIDTH_DP

    Box(
        modifier = Modifier
            .offset { IntOffset(xPx.roundToInt(), yPx.roundToInt()) }
            .width(widthDp * scale)
            .wrapContentHeight()
            .pointerInput(Unit) {
                detectDragGestures { change, dragAmount ->
                    change.consume()
                    onDrag(dragAmount.x, dragAmount.y)
                }
            }
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(
                    if (isHighlighted) nodeColor.copy(alpha = 0.15f) else Color.White.copy(alpha = 0.06f),
                    RoundedCornerShape(24.dp)
                )
                .border(
                    width = if (isHighlighted) 2.dp else 1.dp,
                    color = if (isHighlighted) GlassWarning else nodeColor.copy(alpha = 0.4f),
                    shape = RoundedCornerShape(24.dp)
                )
                .clickable(onClick = onTap)
                // Кольорова смужка зліва (як на фронтенді)
                .drawBehind {
                    drawRect(
                        color = nodeColor.copy(alpha = 0.7f),
                        topLeft = Offset(0f, 0f),
                        size = androidx.compose.ui.geometry.Size(4.dp.toPx(), size.height)
                    )
                }
        ) {
            // ── Заголовок ──
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(nodeColor.copy(alpha = 0.15f), RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp))
                    .padding(horizontal = 8.dp, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Кольорова крапка
                Box(
                    modifier = Modifier
                        .size(8.dp)
                        .background(nodeColor, CircleShape)
                )
                Spacer(Modifier.width(6.dp))
                // Тип ноди
                Text(
                    config.label,
                    fontSize = (8 * scale).coerceIn(6f, 10f).sp,
                    color = nodeColor,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f)
                )

                if (!node.miniCollapsed) {
                    // Кнопка згорнути
                    Box(
                        modifier = Modifier
                            .size(18.dp)
                            .clickable { onToggleMini() }
                            .background(Color.White.copy(alpha = 0.1f), CircleShape),
                        contentAlignment = Alignment.Center
                    ) {
                        Text("−", fontSize = 10.sp, color = Color.White.copy(alpha = 0.7f))
                    }
                } else {
                    // Кнопка розгорнути
                    Box(
                        modifier = Modifier
                            .size(18.dp)
                            .clickable { onToggleMini() }
                            .background(Color.White.copy(alpha = 0.1f), CircleShape),
                        contentAlignment = Alignment.Center
                    ) {
                        Text("+", fontSize = 10.sp, color = Color.White.copy(alpha = 0.7f))
                    }
                }
            }

            // ── Тіло (приховується при miniCollapsed) ──
            if (!node.miniCollapsed) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(8.dp)
                ) {
                    // Назва ноди
                    Text(
                        node.label,
                        fontSize = (10 * scale).coerceIn(8f, 13f).sp,
                        color = Color.White,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )

                    // Inline поля залежно від типу
                    NodeInlineFields(node = node, config = config, scale = scale, onDataChange = onDataChange)

                    Spacer(Modifier.height(4.dp))

                    // Порти
                    NodePorts(config = config, scale = scale, onPortTap = onPortTap)
                }
            }
        }

        // Зовнішні порти (кружки зліва/справа ноди) — завжди видимі
        if (!node.miniCollapsed) {
            // Вхідні порти (зліва)
            config.inputs.forEachIndexed { idx, port ->
                val portY = NODE_HEADER_HEIGHT + PORT_RADIUS + (PORT_RADIUS * 3) * idx
                Box(
                    modifier = Modifier
                        .offset(x = (-PORT_RADIUS) * scale, y = portY * scale)
                        .size(PORT_RADIUS * 2 * scale)
                        .background(port.color, CircleShape)
                        .border(1.5.dp, Color.White.copy(alpha = 0.3f), CircleShape)
                        .clickable { onPortTap(port.id, true) }
                )
            }
            // Вихідні порти (справа)
            config.outputs.forEachIndexed { idx, port ->
                val portY = NODE_HEADER_HEIGHT + PORT_RADIUS + (PORT_RADIUS * 3) * idx
                Box(
                    modifier = Modifier
                        .offset(x = widthDp * scale - PORT_RADIUS * scale, y = portY * scale)
                        .size(PORT_RADIUS * 2 * scale)
                        .background(port.color, CircleShape)
                        .border(1.5.dp, Color.White.copy(alpha = 0.3f), CircleShape)
                        .clickable { onPortTap(port.id, false) }
                )
            }
        }
    }
}

// ===== Inline Fields =====

@Composable
private fun NodeInlineFields(
    node: EditorNode,
    config: NodeTypeConfig,
    scale: Float,
    onDataChange: (Map<String, Any?>) -> Unit
) {
    val fontSize = (9 * scale).coerceIn(7f, 11f).sp
    val labelSize = (7 * scale).coerceIn(6f, 9f).sp

    when (node.type) {
        "actionNode" -> {
            InlineField("Селектор", node.data["selector"] as? String ?: "", fontSize, labelSize) {
                onDataChange(mapOf("selector" to it))
            }
        }
        "selectorCheckNode" -> {
            InlineField("Селектор", node.data["selector"] as? String ?: "", fontSize, labelSize) {
                onDataChange(mapOf("selector" to it))
            }
        }
        "variableNode" -> {
            InlineField("Ім'я", node.data["varName"] as? String ?: "", fontSize, labelSize) {
                onDataChange(mapOf("varName" to it))
            }
            InlineField("Значення", node.data["setValue"] as? String ?: "", fontSize, labelSize) {
                onDataChange(mapOf("setValue" to it))
            }
        }
        "apiNode" -> {
            InlineField("URL", node.data["url"] as? String ?: "", fontSize, labelSize) {
                onDataChange(mapOf("url" to it))
            }
        }
        "keyboardNode" -> {
            InlineField("Текст", node.data["value"] as? String ?: "", fontSize, labelSize) {
                onDataChange(mapOf("value" to it))
            }
        }
        "browserNode" -> {
            InlineField("URL", node.data["url"] as? String ?: "", fontSize, labelSize) {
                onDataChange(mapOf("url" to it))
            }
        }
        "commentNode" -> {
            InlineField("Коментар", node.data["label"] as? String ?: "", fontSize, labelSize) {
                onDataChange(mapOf("label" to it))
            }
        }
        "compareNode" -> {
            val leftVar = node.data["leftVar"] as? String ?: ""
            val op = node.data["operator"] as? String ?: ">"
            val rightValue = node.data["rightValue"] as? String ?: ""
            Text(
                "$leftVar $op $rightValue",
                fontSize = fontSize,
                color = Color.White.copy(alpha = 0.7f),
                fontFamily = FontFamily.Monospace,
                maxLines = 1
            )
        }
        "randomDelayNode" -> {
            val min = (node.data["min"] as? Number)?.toString() ?: "1000"
            val max = (node.data["max"] as? Number)?.toString() ?: "3000"
            Text(
                "$min – $max мс",
                fontSize = fontSize,
                color = Color.White.copy(alpha = 0.7f),
                maxLines = 1
            )
        }
        "groupNode" -> {
            val subNodesCount = (node.data["subNodes"] as? List<*>)?.size ?: 0
            Text(
                "$subNodesCount нод всередині",
                fontSize = fontSize,
                color = Color.White.copy(alpha = 0.5f)
            )
        }
        "cooldownNode" -> {
            val duration = (node.data["duration"] as? Number)?.toString() ?: "20"
            val unit = node.data["unit"] as? String ?: "minutes"
            Text(
                "$duration $unit",
                fontSize = fontSize,
                color = Color.White.copy(alpha = 0.7f)
            )
        }
        "notifyNode" -> {
            val message = node.data["message"] as? String ?: ""
            if (message.isNotEmpty()) {
                Text(message, fontSize = fontSize, color = Color.White.copy(alpha = 0.5f), maxLines = 2, overflow = TextOverflow.Ellipsis)
            }
        }
        else -> {
            // Показуємо селектор якщо є
            val selector = node.data["selector"] as? String
            if (!selector.isNullOrBlank()) {
                Text(
                    selector,
                    fontSize = (8 * scale).coerceIn(6f, 10f).sp,
                    color = Color.White.copy(alpha = 0.4f),
                    fontFamily = FontFamily.Monospace,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }
    }
}

@Composable
private fun InlineField(
    label: String,
    value: String,
    fontSize: androidx.compose.ui.unit.TextUnit,
    labelSize: androidx.compose.ui.unit.TextUnit,
    onValueChange: (String) -> Unit
) {
    var text by remember(value) { mutableStateOf(value) }
    Column(modifier = Modifier.padding(vertical = 2.dp)) {
        Text(label, fontSize = labelSize, color = Color.White.copy(alpha = 0.4f), fontWeight = FontWeight.Bold)
        BasicTextField(
            value = text,
            onValueChange = {
                text = it
                onValueChange(it)
            },
            textStyle = TextStyle(
                fontSize = fontSize,
                color = Color.White,
                fontFamily = FontFamily.Monospace
            ),
            modifier = Modifier
                .fillMaxWidth()
                .background(Color.White.copy(alpha = 0.05f), RoundedCornerShape(4.dp))
                .padding(horizontal = 6.dp, vertical = 3.dp),
            singleLine = true
        )
    }
}

// ===== Node Ports (inside node body) =====

@Composable
private fun NodePorts(
    config: NodeTypeConfig,
    scale: Float,
    onPortTap: (String, Boolean) -> Unit
) {
    if (config.outputs.size > 1) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 4.dp),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            config.outputs.forEach { port ->
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier
                        .clickable { onPortTap(port.id, false) }
                        .background(port.color.copy(alpha = 0.1f), RoundedCornerShape(4.dp))
                        .padding(horizontal = 4.dp, vertical = 2.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .size(6.dp)
                            .background(port.color, CircleShape)
                    )
                    Spacer(Modifier.width(3.dp))
                    Text(
                        port.label,
                        fontSize = (7 * scale).coerceIn(6f, 9f).sp,
                        color = port.color,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }
    }
}

// ===== Sidebar =====

@Composable
private fun NodeTypeSidebar(
    onSelectType: (String) -> Unit,
    onClose: () -> Unit
) {
    Column(
        modifier = Modifier
            .width(210.dp)
            .fillMaxHeight()
            .background(GlassBg.copy(alpha = 0.97f))
            .border(1.dp, Color.White.copy(alpha = 0.1f), RoundedCornerShape(topEnd = 16.dp, bottomEnd = 16.dp))
            .padding(8.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text("Типи нод", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = Color.White)
            IconButton(onClick = onClose, modifier = Modifier.size(32.dp)) {
                Icon(Icons.Default.Close, null, tint = Color.White.copy(alpha = 0.6f))
            }
        }
        Spacer(Modifier.height(4.dp))

        LazyColumn(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            val sortedTypes = NODE_PORT_CONFIG.values.toList()
            items(sortedTypes) { typeInfo ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onSelectType(typeInfo.type) }
                        .background(Color.White.copy(alpha = 0.05f), RoundedCornerShape(8.dp))
                        .padding(horizontal = 8.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(10.dp)
                            .background(Color(typeInfo.color), CircleShape)
                    )
                    Spacer(Modifier.width(8.dp))
                    Column {
                        Text(typeInfo.label, fontSize = 11.sp, color = Color.White, fontWeight = FontWeight.Bold)
                        if (typeInfo.description.isNotEmpty()) {
                            Text(typeInfo.description, fontSize = 8.sp, color = Color.White.copy(alpha = 0.4f))
                        }
                    }
                }
            }
        }
    }
}

// ===== Node Edit BottomSheet =====

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun NodeEditSheet(
    node: EditorNode,
    onDismiss: () -> Unit,
    onUpdate: (Map<String, Any?>) -> Unit,
    onDelete: () -> Unit,
    onConnect: () -> Unit
) {
    val config = getNodeConfig(node.type)
    var label by remember(node.id) { mutableStateOf(node.label) }
    var selector by remember(node.id) { mutableStateOf(node.data["selector"] as? String ?: "") }
    var value by remember(node.id) { mutableStateOf(node.data["value"] as? String ?: "") }
    var delay by remember(node.id) { mutableStateOf((node.data["delay"] as? Number)?.toString() ?: "") }
    var url by remember(node.id) { mutableStateOf(node.data["url"] as? String ?: "") }
    var varName by remember(node.id) { mutableStateOf(node.data["varName"] as? String ?: "") }
    var setValue by remember(node.id) { mutableStateOf(node.data["setValue"] as? String ?: "") }
    var message by remember(node.id) { mutableStateOf(node.data["message"] as? String ?: "") }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = Color(0xFF0A0E1A).copy(alpha = 0.95f),
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 16.dp)
                .verticalScroll(rememberScrollState())
        ) {
            // Заголовок
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(modifier = Modifier.size(12.dp).background(Color(config.color), CircleShape))
                    Spacer(Modifier.width(8.dp))
                    Text(config.label, fontSize = 16.sp, fontWeight = FontWeight.Bold, color = Color.White)
                }
                Row {
                    IconButton(onClick = onConnect) {
                        Icon(Icons.Default.Link, null, tint = GlassWarning)
                    }
                    IconButton(onClick = onDelete) {
                        Icon(Icons.Default.Delete, null, tint = GlassError)
                    }
                }
            }

            if (config.description.isNotEmpty()) {
                Spacer(Modifier.height(4.dp))
                Text(config.description, fontSize = 11.sp, color = Color.White.copy(alpha = 0.4f))
            }

            Spacer(Modifier.height(16.dp))

            // Поля
            SheetField("Назва ноди", label, Color(config.color)) { label = it }

            if (node.type in listOf("actionNode", "selectorCheckNode", "searchAndClickNode", "searchInNode", "inventoryScannerNode", "infoNode", "nestedCheckNode")) {
                SheetField("CSS селектор", selector, Color(config.color), mono = true) { selector = it }
            }

            if (node.type in listOf("actionNode", "variableNode", "keyboardNode")) {
                SheetField("Значення", value, Color(config.color)) { value = it }
            }

            if (node.type in listOf("variableNode")) {
                SheetField("Ім'я змінної", varName, Color(config.color)) { varName = it }
                SheetField("Встановити значення", setValue, Color(config.color)) { setValue = it }
            }

            if (node.type in listOf("apiNode", "browserNode")) {
                SheetField("URL", url, Color(config.color), mono = true) { url = it }
            }

            if (node.type in listOf("notifyNode")) {
                SheetField("Повідомлення", message, Color(config.color)) { message = it }
            }

            if (node.type in listOf("delayNode", "actionNode")) {
                SheetField("Затримка (мс)", delay, Color(config.color)) { delay = it }
            }

            // Порти інформація
            if (config.inputs.isNotEmpty() || config.outputs.isNotEmpty()) {
                Spacer(Modifier.height(12.dp))
                Text("Порти", fontSize = 12.sp, color = Color.White.copy(alpha = 0.5f), fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(4.dp))
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Column {
                        config.inputs.forEach { port ->
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Box(modifier = Modifier.size(8.dp).background(port.color, CircleShape))
                                Spacer(Modifier.width(4.dp))
                                Text("← ${port.label}", fontSize = 10.sp, color = port.color)
                            }
                        }
                    }
                    Column(horizontalAlignment = Alignment.End) {
                        config.outputs.forEach { port ->
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text("${port.label} →", fontSize = 10.sp, color = port.color)
                                Spacer(Modifier.width(4.dp))
                                Box(modifier = Modifier.size(8.dp).background(port.color, CircleShape))
                            }
                        }
                    }
                }
            }

            Spacer(Modifier.height(16.dp))

            Button(
                onClick = {
                    val updates = mutableMapOf<String, Any?>("label" to label.takeIf { it.isNotBlank() })
                    if (selector.isNotBlank()) updates["selector"] = selector
                    if (value.isNotBlank()) updates["value"] = value
                    if (delay.isNotBlank()) updates["delay"] = delay.toIntOrNull()
                    if (url.isNotBlank()) updates["url"] = url
                    if (varName.isNotBlank()) updates["varName"] = varName
                    if (setValue.isNotBlank()) updates["setValue"] = setValue
                    if (message.isNotBlank()) updates["message"] = message
                    onUpdate(updates)
                    onDismiss()
                },
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(containerColor = Color(config.color))
            ) {
                Text("Зберегти", fontWeight = FontWeight.Bold)
            }

            Spacer(Modifier.height(32.dp))
        }
    }
}

@Composable
private fun SheetField(
    label: String,
    value: String,
    color: Color,
    mono: Boolean = false,
    onValueChange: (String) -> Unit
) {
    Spacer(Modifier.height(8.dp))
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label) },
        modifier = Modifier.fillMaxWidth(),
        textStyle = TextStyle(
            color = Color.White,
            fontFamily = if (mono) FontFamily.Monospace else FontFamily.Default
        ),
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = color,
            unfocusedBorderColor = Color.White.copy(alpha = 0.2f),
            focusedLabelColor = color,
            unfocusedLabelColor = Color.White.copy(alpha = 0.5f)
        )
    )
}
