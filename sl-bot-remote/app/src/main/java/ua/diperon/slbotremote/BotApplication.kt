package ua.diperon.slbotremote

import android.app.Application
import coil.ImageLoader
import coil.ImageLoaderFactory
import coil.decode.SvgDecoder
import coil.util.DebugLogger
import okhttp3.OkHttpClient
import java.util.concurrent.TimeUnit

/**
 * Кастомний Application клас для налаштування Coil ImageLoader
 * з підтримкою SVG та покращеними налаштуваннями мережі
 */
class BotApplication : Application(), ImageLoaderFactory {
    
    override fun newImageLoader(): ImageLoader {
        return ImageLoader.Builder(this)
            .components {
                // Додаємо підтримку SVG
                add(SvgDecoder.Factory())
            }
            .okHttpClient {
                OkHttpClient.Builder()
                    .connectTimeout(30, TimeUnit.SECONDS)
                    .readTimeout(30, TimeUnit.SECONDS)
                    .writeTimeout(30, TimeUnit.SECONDS)
                    .build()
            }
            .crossfade(true)
            .respectCacheHeaders(false) // Ігноруємо cache headers для кращого кешування
            .logger(DebugLogger()) // Додаємо логування для відладки
            .build()
    }
}
