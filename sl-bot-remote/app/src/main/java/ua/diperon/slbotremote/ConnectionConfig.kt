package ua.diperon.slbotremote

import android.content.Context
import android.util.Log

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
        val host = sharedPrefs.getString(KEY_HOST, "10.0.2.2") ?: "10.0.2.2"
        val port = sharedPrefs.getString(KEY_PORT, "3001") ?: "3001"
        val ipAddress = sharedPrefs.getString(KEY_IP_ADDRESS, "192.168.1.100") ?: "192.168.1.100"
        val ipAddress2 = sharedPrefs.getString(KEY_IP_ADDRESS_2, "192.168.1.101") ?: "192.168.1.101"
        val activeIpAddress = sharedPrefs.getInt(KEY_ACTIVE_IP_ADDRESS, 1)
        return ConnectionConfig(host, port, ipAddress, ipAddress2, activeIpAddress)
    }

    fun getHttpUrl(): String {
        val config = loadConfig()
        val activeIp = if (config.activeIpAddress == 2) config.ipAddress2 else config.ipAddress
        val cleanIp = activeIp.trim()
        
        if (cleanIp.startsWith("http://") || cleanIp.startsWith("https://")) {
            Log.d(TAG, "Formed HTTP Base URL: $cleanIp (using exact URL)")
            return cleanIp
        }
        
        val cleanHost = cleanIp.replace("http://", "").replace("https://", "")
        val cleanPort = config.port.trim()
        val url = "http://$cleanHost:$cleanPort"
        Log.d(TAG, "Formed HTTP Base URL: $url (using IP $activeIp)")
        return url
    }

    fun getWebSocketUrl(projectName: String): String {
        val config = loadConfig()
        val activeIp = if (config.activeIpAddress == 2) config.ipAddress2 else config.ipAddress
        val cleanIp = activeIp.trim()
        val encodedProject = android.net.Uri.encode(projectName)
        
        if (cleanIp.startsWith("http://") || cleanIp.startsWith("https://")) {
            val wsScheme = if (cleanIp.startsWith("https://")) "wss://" else "ws://"
            val hostAndPortAndPath = cleanIp.substringAfter("://")
            val cleanHostPath = hostAndPortAndPath.removeSuffix("/")
            return "$wsScheme$cleanHostPath/ws?project=$encodedProject"
        }
        
        val cleanHost = cleanIp.replace("http://", "").replace("https://", "")
        val cleanPort = config.port.trim()
        return "ws://$cleanHost:$cleanPort/ws?project=$encodedProject"
    }

    fun saveConfig(config: ConnectionConfig) {
        sharedPrefs.edit().apply {
            putString(KEY_HOST, config.host.trim())
            putString(KEY_PORT, config.port.trim())
            putString(KEY_IP_ADDRESS, config.ipAddress.trim())
            putString(KEY_IP_ADDRESS_2, config.ipAddress2.trim())
            putInt(KEY_ACTIVE_IP_ADDRESS, config.activeIpAddress)
            apply()
        }
        Log.d(TAG, "Saved ConnectionConfig: ${config.host}:${config.port}")
    }

    fun getActiveIpAddress(): String {
        val config = loadConfig()
        return if (config.activeIpAddress == 2) config.ipAddress2 else config.ipAddress
    }
}
