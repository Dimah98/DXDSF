package com.example // Пакет нашого додатку

import android.annotation.SuppressLint // Для пригнічення попереджень про JavaScript
import android.webkit.WebChromeClient // Для підтримки сучасних веб-стандартів у WebView
import android.webkit.WebView // Для вбудовування веб-сторінок
import android.webkit.WebViewClient // Для обробки подій завантаження сторінки
import androidx.compose.foundation.layout.Box // Контейнер для розміщення елементів
import androidx.compose.foundation.layout.fillMaxSize // Для заповнення всього доступного простору
import androidx.compose.foundation.layout.padding // Для відступів
import androidx.compose.foundation.layout.height
import androidx.compose.ui.unit.dp
import androidx.compose.material.icons.Icons // Іконки Material Design
import androidx.compose.material.icons.filled.ArrowBack // Іконка "Назад"
import androidx.compose.material3.ExperimentalMaterial3Api // Для експериментальних компонентів Material 3
import androidx.compose.material3.Icon // Компонент іконки
import androidx.compose.material3.IconButton // Кнопка з іконкою
import androidx.compose.material3.Scaffold // Базовий макет екрану
import androidx.compose.material3.Text // Компонент тексту
import androidx.compose.material3.TopAppBar // Верхня панель додатку
import androidx.compose.material3.TopAppBarDefaults // Налаштування кольорів для TopAppBar
import androidx.compose.runtime.Composable // Анотація для Compose-функцій
import androidx.compose.runtime.remember // Для збереження стану
import androidx.compose.ui.Modifier // Модифікатори для налаштування UI
import androidx.compose.ui.graphics.Color // Для роботи з кольорами
import androidx.compose.ui.viewinterop.AndroidView // Для інтеграції стандартних Android View в Compose

/**
 * Екран повноцінного редактора нод проекту (вбудований веб-інтерфейс).
 * Використовує WebView для завантаження React Flow редактора з бекенду.
 *
 * @param projectName Назва проекту, який потрібно редагувати
 * @param onBackClick Колбек для повернення на попередній екран
 */
import androidx.compose.ui.platform.LocalContext // Для отримання контексту

@SuppressLint("SetJavaScriptEnabled") // Дозволяємо виконання JavaScript, оскільки це необхідно для React Flow
@OptIn(ExperimentalMaterial3Api::class) // Використовуємо експериментальний TopAppBar
@Composable
fun ProjectEditorScreen(
    projectName: String, // Назва проекту
    onBackClick: () -> Unit // Функція повернення назад
) {
    // Отримуємо контекст для читання налаштувань
    val context = LocalContext.current
    
    // Отримуємо базовий URL бекенду (наприклад: http://192.168.1.100:3001)
    // Оскільки ми додали роздачу фронтенду з бекенду, цей URL відкриє редактор
    val baseUrl = remember { ConnectionConfigManager(context).getHttpUrl().removeSuffix("/") }
    
    // Формуємо URL до конкретного проекту
    val editorUrl = "$baseUrl/?project=$projectName"

    // Основний макет екрану
    Scaffold(
        topBar = {
            TopAppBar(
                modifier = androidx.compose.ui.Modifier.height(42.dp),
                
                title = { Text(text = "Редактор: $projectName", color = Color.White) }, // Назва поточного проекту
                navigationIcon = {
                    // Кнопка повернення назад
                    IconButton(onClick = onBackClick) {
                        Icon(
                            imageVector = Icons.Default.ArrowBack, // Стрілка назад
                            contentDescription = "Назад",
                            tint = Color.White
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Color(0xFF14161B) // Темний фон панелі, відповідає стилістиці додатку
                )
            )
        },
        containerColor = Color(0xFF14161B) // Темний фон для всього екрану
    ) { paddingValues ->
        // Контейнер для WebView з відступами від TopAppBar
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            // Вбудовуємо нативний WebView у Jetpack Compose
            AndroidView(
                factory = { context ->
                    WebView(context).apply {
                        // Налаштовуємо WebView для роботи складного React додатку
                        settings.javaScriptEnabled = true // Увімкнути виконання JS
                        settings.domStorageEnabled = true // Увімкнути LocalStorage для збереження локальних даних
                        settings.databaseEnabled = true // Підтримка баз даних
                        
                        // Дозволяємо зум для зручного масштабування графу нод на телефоні
                        settings.setSupportZoom(true)
                        settings.builtInZoomControls = true
                        settings.displayZoomControls = false // Приховуємо стандартні кнопки зуму
                        
                        // Налаштовуємо клієнти для правильного рендерингу та обробки посилань
                        webViewClient = WebViewClient() // Щоб посилання відкривалися всередині WebView
                        webChromeClient = WebChromeClient() // Для підтримки Alert/Confirm та консолі JavaScript
                        
                        // Завантажуємо URL з редактором та параметром проекту
                        loadUrl(editorUrl)
                    }
                },
                modifier = Modifier.fillMaxSize() // WebView займає весь екран
            )
        }
    }
}

