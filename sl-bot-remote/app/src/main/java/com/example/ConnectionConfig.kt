package com.example

import android.content.Context
import android.util.Log

/**
 * Data class representing the connection configuration parameters for the backend.
 * @property host The IP address or hostname of the Sunflower Land Bot Constructor backend (e.g., "192.168.1.100").
 * @property port The port number where the backend is listening (e.g., "3001").
 * @property ipAddress The primary IP address for connection.
 * @property ipAddress2 The secondary IP address for connection (alternative).
 * @property activeIpAddress Which IP address to use for connection (1 for primary, 2 for secondary).
 */
data class ConnectionConfig(
    val host: String = "10.0.2.2", // Default to Android emulator-to-host localhost IP
    val port: String = "3001",
    val ipAddress: String = "192.168.1.100", // Primary IP address
    val ipAddress2: String = "192.168.1.101", // Secondary IP address
    val activeIpAddress: Int = 1 // Which IP to use: 1 for primary, 2 for secondary
)

/**
 * Manager class responsible for persisting and retrieving connection configuration settings in real time.
 * Uses SharedPreferences under the hood for stable, synchronous, local key-value storage.
 */
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

    /**
     * Loads the saved connection details, falling back to default values if none exist.
     */
    fun loadConfig(): ConnectionConfig {
        val host = sharedPrefs.getString(KEY_HOST, "10.0.2.2") ?: "10.0.2.2"
        val port = sharedPrefs.getString(KEY_PORT, "3001") ?: "3001"
        val ipAddress = sharedPrefs.getString(KEY_IP_ADDRESS, "192.168.1.100") ?: "192.168.1.100"
        val ipAddress2 = sharedPrefs.getString(KEY_IP_ADDRESS_2, "192.168.1.101") ?: "192.168.1.101"
        val activeIpAddress = sharedPrefs.getInt(KEY_ACTIVE_IP_ADDRESS, 1)
        return ConnectionConfig(host, port, ipAddress, ipAddress2, activeIpAddress)
    }

    /**
     * Composes and returns the absolute base HTTP URL for the REST API endpoints.
     */
    fun getHttpUrl(): String {
        val config = loadConfig()
        // Select the active IP address based on activeIpAddress field
        val activeIp = if (config.activeIpAddress == 2) config.ipAddress2 else config.ipAddress
        // Clean or trim values to handle user configuration typos gracefully
        val cleanHost = activeIp.replace("http://", "").replace("https://", "").trim()
        val cleanPort = config.port.trim()
        val url = "http://$cleanHost:$cleanPort"
        Log.d(TAG, "Formed HTTP Base URL: $url (using IP $activeIp, active: ${config.activeIpAddress})")
        return url
    }

    /**
     * Composes and returns the absolute WebSocket URL path.
     */
    fun getWebSocketUrl(projectName: String): String { // Отримуємо WebSocket URL з параметром назви проекту
        val config = loadConfig() // Завантажуємо поточну конфігурацію підключення
        // Select the active IP address based on activeIpAddress field
        val activeIp = if (config.activeIpAddress == 2) config.ipAddress2 else config.ipAddress
        val cleanHost = activeIp.replace("http://", "").replace("https://", "").trim() // Очищаємо хост від протоколів та пробілів
        val cleanPort = config.port.trim() // Очищаємо порт від пробілів
        val encodedProject = android.net.Uri.encode(projectName) // Кодуємо назву проекту для безпечної передачі в URL
        val url = "ws://$cleanHost:$cleanPort/ws?project=$encodedProject" // Формуємо фінальний URL з шляхом /ws та параметром project
        Log.d(TAG, "Formed WebSocket URL: $url (using IP $activeIp, active: ${config.activeIpAddress})") // Логуємо сформований URL
        return url // Повертаємо WebSocket URL
    } // Кінець функції getWebSocketUrl

    /**
     * Saves a new connection configuration to local storage.
     */
    fun saveConfig(config: ConnectionConfig) {
        sharedPrefs.edit().apply {
            putString(KEY_HOST, config.host.trim())
            putString(KEY_PORT, config.port.trim())
            putString(KEY_IP_ADDRESS, config.ipAddress.trim())
            putString(KEY_IP_ADDRESS_2, config.ipAddress2.trim())
            putInt(KEY_ACTIVE_IP_ADDRESS, config.activeIpAddress)
            apply()
        }
        Log.d(TAG, "Saved ConnectionConfig: host=${config.host}, port=${config.port}, ipAddress=${config.ipAddress}, ipAddress2=${config.ipAddress2}, activeIpAddress=${config.activeIpAddress}")
    }

    /**
     * Returns the currently active IP address based on the activeIpAddress setting.
     */
    fun getActiveIpAddress(): String {
        val config = loadConfig()
        return if (config.activeIpAddress == 2) config.ipAddress2 else config.ipAddress
    }
}
