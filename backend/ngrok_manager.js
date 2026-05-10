const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const TOKENS_FILE = path.join(__dirname, '../ngrok_tokens.txt');
const CURRENT_URL_FILE = path.join(__dirname, 'current_url.txt');

function getTokens() {
    const raw = fs.readFileSync(TOKENS_FILE, 'utf8');
    console.log(`Debug: Файл зчитано, довжина ${raw.length} символів`);
    const tokens = raw.split('\n')
        .map(t => t.trim())
        .filter(t => t && !t.startsWith('#'));
    console.log(`Debug: Знайдено токенів: ${tokens.length}`);
    return tokens;
}

let currentTokenIndex = 0;

function startNgrok() {
    const tokens = getTokens();
    if (currentTokenIndex >= tokens.length) {
        console.error('❌ Всі токени вичерпані! Додайте нові в ngrok_tokens.txt');
        process.exit(1);
    }

    const token = tokens[currentTokenIndex];
    console.log(`\n🚀 Запуск Ngrok з токеном #${currentTokenIndex + 1}...`);

    // Встановлюємо токен
    try {
        execSync(`npx ngrok config add-authtoken ${token}`);
    } catch (e) {
        console.error('Помилка встановлення токена');
    }

    const ngrok = spawn('npx', ['ngrok', 'http', '5173', '--log=stdout'], { shell: true });

    ngrok.stdout.on('data', (data) => {
        const line = data.toString();
        
        // Шукаємо URL
        if (line.includes('url=')) {
            const urlMatch = line.match(/url=(https:\/\/[^\s]+)/);
            if (urlMatch) {
                const url = urlMatch[1];
                console.log(`✅ Тунель запущено: ${url}`);
                fs.writeFileSync(CURRENT_URL_FILE, url);
                // Тут можна було б автоматично перезапускати бекенд, але краще бекенд буде сам читати цей файл
            }
        }

        // Шукаємо помилку ліміту або вже запущеного тунелю
        if (line.includes('ERR_NGROK_725') || line.includes('bandwidth limit exceeded') || line.includes('ERR_NGROK_334')) {
            console.error(`⚠️ Токен #${currentTokenIndex + 1} недоступний (ліміт або зайнятий). Перемикаюсь...`);
            ngrok.kill();
            currentTokenIndex++;
            setTimeout(startNgrok, 2000);
        }
    });

    ngrok.stderr.on('data', (data) => {
        console.error(`stderr: ${data}`);
    });

    ngrok.on('close', (code) => {
        if (code !== 0 && !ngrok.killed) {
            console.log(`Ngrok завершився з кодом ${code}. Перезапуск...`);
            setTimeout(startNgrok, 5000);
        }
    });
}

startNgrok();
