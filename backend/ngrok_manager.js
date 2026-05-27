// Менеджер Ngrok тунелів з ротацією токенів та повідомленнями в Telegram
// При зміні URL — автоматично надсилає нове посилання власнику в Telegram

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const TOKENS_FILE = path.join(__dirname, '../ngrok_tokens.txt');
const CURRENT_URL_FILE = path.join(__dirname, 'current_url.txt');

// Telegram токен та ID власника з .env
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const OWNER_ID = process.env.TELEGRAM_OWNER_ID;

// Надсилаємо HTTP запит до Telegram API без telegraf (щоб не завантажувати важкий модуль)
async function sendTelegramMessage(text) {
    if (!BOT_TOKEN || BOT_TOKEN.includes('ваш_токен') || !OWNER_ID) {
        console.log('ℹ️  Telegram не налаштовано — пропускаємо сповіщення');
        return;
    }
    try {
        const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
        const body = JSON.stringify({
            chat_id: OWNER_ID,
            text,
            parse_mode: 'Markdown',
        });
        // Використовуємо вбудований fetch (Node.js 18+)
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
        });
        const data = await res.json();
        if (!data.ok) console.error('Telegram API помилка:', data.description);
    } catch (e) {
        console.error('Не вдалось надіслати в Telegram:', e.message);
    }
}

function getTokens() {
    const raw = fs.readFileSync(TOKENS_FILE, 'utf8');
    const tokens = raw.split('\n')
        .map(t => t.trim())
        .filter(t => t && !t.startsWith('#'));
    console.log(`🔑 Знайдено токенів: ${tokens.length}`);
    return tokens;
}

let currentTokenIndex = 0;

let currentNgrokProcess = null;

const NEXT_TOKEN_FLAG = path.join(__dirname, 'next_token.flag');

// Перевіряємо, чи бот не попросив змінити токен
setInterval(() => {
    if (fs.existsSync(NEXT_TOKEN_FLAG)) {
        try { fs.unlinkSync(NEXT_TOKEN_FLAG); } catch(e){}
        console.log(`🔄 Отримано сигнал з Telegram на ручну зміну токена!`);
        if (currentNgrokProcess) {
            // Встановлюємо прапорець ручного завершення, щоб запобігти подвійному перезапуску
            currentNgrokProcess.manualKill = true;
            // Зупиняємо поточний процес Ngrok
            currentNgrokProcess.kill();
        }
        currentTokenIndex++;
        setTimeout(startNgrok, 2000);
    }
}, 2000);

function startNgrok() {
    const tokens = getTokens();
    if (currentTokenIndex >= tokens.length) {
        console.error('❌ Всі токени вичерпані! Додайте нові в ngrok_tokens.txt. Починаю з першого...');
        currentTokenIndex = 0; // Зациклюємо токени на всяк випадок
    }

    const token = tokens[currentTokenIndex];
    console.log(`\n🚀 Запуск Ngrok з токеном #${currentTokenIndex + 1}...`);

    // Встановлюємо токен
    try {
        execSync(`npx ngrok config add-authtoken ${token}`, { stdio: 'ignore' });
    } catch (e) {
        console.error('Помилка встановлення токена');
    }

    const ngrok = spawn('npx', ['ngrok', 'http', '5173', '--log=stdout'], { shell: true });
    currentNgrokProcess = ngrok;

    ngrok.stdout.on('data', (data) => {
        const line = data.toString();

        // Шукаємо URL у виводі ngrok
        if (line.includes('url=')) {
            const urlMatch = line.match(/url=(https:\/\/[^\s]+)/);
            if (urlMatch) {
                const url = urlMatch[1];
                console.log(`✅ Тунель запущено: ${url}`);

                // Зберігаємо URL у файл (бекенд читає звідси)
                fs.writeFileSync(CURRENT_URL_FILE, url);

                // Надсилаємо нотифікацію в Telegram
                const message =
                    `🚀 *SFL Constructor запущено*\n\n` +
                    `🌐 URL: \`${url}\`\n\n` +
                    `Натисни /open щоб відкрити інтерфейс`;
                sendTelegramMessage(message);
            }
        }

        // Шукаємо помилку ліміту або зайнятого тунелю
        if (
            line.includes('ERR_NGROK_725') ||
            line.includes('bandwidth limit exceeded') ||
            line.includes('ERR_NGROK_334')
        ) {
            console.error(`⚠️ Токен #${currentTokenIndex + 1} недоступний. Перемикаюсь...`);
            // Встановлюємо прапорець ручного завершення, щоб запобігти подвійному перезапуску
            ngrok.manualKill = true;
            // Зупиняємо поточний процес Ngrok
            ngrok.kill();
            currentTokenIndex++;
            setTimeout(startNgrok, 2000);
        }
    });

    ngrok.stderr.on('data', (data) => {
        // Ігноруємо стандартний stderr ngrok (там багато неважливого)
        const line = data.toString();
        if (line.includes('ERR_NGROK')) {
            console.error(`stderr: ${line.trim()}`);
        }
    });

    ngrok.on('close', (code) => {
        // Якщо процес завершився з помилкою і це не було ручним завершенням
        if (code !== 0 && !ngrok.manualKill) {
            console.log(`Ngrok завершився з кодом ${code}. Перезапуск через 5с...`);
            setTimeout(startNgrok, 5000);
        }
    });
}

startNgrok();
