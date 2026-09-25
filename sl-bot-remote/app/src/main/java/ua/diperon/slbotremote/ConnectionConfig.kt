package ua.diperon.slbotremote

import android.content.Context
import android.util.Log

/**
 * Автоматично очищає та виправляє введені мережеві адреси, хости та IP:
 * - Прибирає зайві пробіли на початку/кінці
 * - Прибирає пробіли навколо крапок, двокрапок та слешів: "dxd . pp . ua" -> "dxd.pp.ua"
 * - Замінює випадкові пробіли між літерами/цифрами на крапку: "dxd pp.ua" -> "dxd.pp.ua", "192.168.1 100" -> "192.168.1.100"
 * - Видаляє будь-які залишки пробілів
 */
fun sanitizeNetworkAddress(input: String): String {
    var s = input.trim()
    if (s.isBlank()) return s

    // Якщо це повний URL, зберігаємо схему (http:// або https://)
    val scheme = when {
        s.startsWith("https://", ignoreCase = true) -> "https://"
        s.startsWith("http://", ignoreCase = true) -> "http://"
        else -> ""
    }
    val withoutScheme = if (scheme.isNotEmpty()) s.substring(scheme.length) else s

    var cleaned = withoutScheme.trim()
    // Видаляємо пробіли навколо спецсимволів
    cleaned = cleaned.replace(Regex("\\s*\\.\\s*"), ".")
                     .replace(Regex("\\s*:\\s*"), ":")
                     .replace(Regex("\\s*/\\s*"), "/")
    // Замінюємо випадковий пробіл між частинами хоста/домену на крапку ("dxd pp.ua" -> "dxd.pp.ua")
    cleaned = cleaned.replace(Regex("(?<=[a-zA-Z0-9])\\s+(?=[a-zA-Z0-9])"), ".")
    // Видаляємо будь-які залишки пробілів
    cleaned = cleaned.replace(" ", "")

    return if (scheme.isNotEmpty()) "$scheme$cleaned" else cleaned
}

/**
 * Data class representing the connection configuration parameters for the backend.
 */
data class ConnectionConfig(
    val host: String = "10.0.2.2",
    val port: String = "3001",
    val ipAddress: String = "192.168.1.100",
    val ipAddress2: String = "192.168.1.101",
    val activeIpAddress: Int = 1
)

class ConnectionConfigManager(private val context: Context) {
    private val sharedPrefs = context.getSharedPreferences("bot_connection_prefs", Context.MODE_PRIVATE)

    companion object {
        private const val KEY_HOST = "backend_host"
        private const val KEY_PORT = "backend_port"
        private const val KEY_IP_ADDRESS = "backend_ip_address"
        private const val KEY_IP_ADDRESS_2 = "backend_ip_address_2"
        private const val KEY_ACTIVE_IP_ADDRESS = "backend_active_ip_address"
        private const val TAG = "ConnectionConfigManager"
    }

    fun loadConfig(): ConnectionConfig {
        val host = sanitizeNetworkAddress(sharedPrefs.getString(KEY_HOST, "10.0.2.2") ?: "10.0.2.2")
        val rawPort = sharedPrefs.getString(KEY_PORT, "3001") ?: "3001"
        val port = rawPort.trim().filter { it.isDigit() }.ifBlank { "3001" }
        val ipAddress = sanitizeNetworkAddress(sharedPrefs.getString(KEY_IP_ADDRESS, "192.168.1.100") ?: "192.168.1.100")
        val ipAddress2 = sanitizeNetworkAddress(sharedPrefs.getString(KEY_IP_ADDRESS_2, "192.168.1.101") ?: "192.168.1.101")
        val activeIpAddress = sharedPrefs.getInt(KEY_ACTIVE_IP_ADDRESS, 1)
        return ConnectionConfig(host, port, ipAddress, ipAddress2, activeIpAddress)
    }

    fun getHttpUrl(): String {
        val config = loadConfig()
        val activeIp = if (config.activeIpAddress == 2) config.ipAddress2 else config.ipAddress
        val cleanIp = sanitizeNetworkAddress(activeIp)
        
        if (cleanIp.startsWith("http://") || cleanIp.startsWith("https://")) {
            Log.d(TAG, "Formed HTTP Base URL: $cleanIp (using exact URL)")
            return cleanIp
        }
        
        val cleanHost = cleanIp.replace("http://", "").replace("https://", "")
        val cleanPort = config.port.trim().filter { it.isDigit() }.ifBlank { "3001" }
        val url = "http://$cleanHost:$cleanPort"
        Log.d(TAG, "Formed HTTP Base URL: $url (using IP $activeIp)")
        return url
    }

    fun getWebSocketUrl(projectName: String): String {
        val config = loadConfig()
        val activeIp = if (config.activeIpAddress == 2) config.ipAddress2 else config.ipAddress
        val cleanIp = sanitizeNetworkAddress(activeIp)
        val encodedProject = android.net.Uri.encode(projectName)
        
        if (cleanIp.startsWith("http://") || cleanIp.startsWith("https://")) {
            val wsScheme = if (cleanIp.startsWith("https://")) "wss://" else "ws://"
            val hostAndPortAndPath = cleanIp.substringAfter("://")
            val cleanHostPath = hostAndPortAndPath.removeSuffix("/")
            return "$wsScheme$cleanHostPath/ws?project=$encodedProject"
        }
        
        val cleanHost = cleanIp.replace("http://", "").replace("https://", "")
        val cleanPort = config.port.trim().filter { it.isDigit() }.ifBlank { "3001" }
        return "ws://$cleanHost:$cleanPort/ws?project=$encodedProject"
    }

    fun saveConfig(config: ConnectionConfig) {
        val cleanHost = sanitizeNetworkAddress(config.host)
        val cleanPort = config.port.trim().filter { it.isDigit() }.ifBlank { "3001" }
        val cleanIp1 = sanitizeNetworkAddress(config.ipAddress)
        val cleanIp2 = sanitizeNetworkAddress(config.ipAddress2)

        sharedPrefs.edit().apply {
            putString(KEY_HOST, cleanHost)
            putString(KEY_PORT, cleanPort)
            putString(KEY_IP_ADDRESS, cleanIp1)
            putString(KEY_IP_ADDRESS_2, cleanIp2)
            putInt(KEY_ACTIVE_IP_ADDRESS, config.activeIpAddress)
            apply()
        }
        Log.d(TAG, "Saved ConnectionConfig: $cleanHost:$cleanPort")
    }

    fun getActiveIpAddress(): String {
        val config = loadConfig()
        return if (config.activeIpAddress == 2) config.ipAddress2 else config.ipAddress
    }
}
