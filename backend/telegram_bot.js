// Telegram-бот для SFL Bot Constructor
// Надсилає посилання на інтерфейс через Ngrok WebApp кнопку
// Тільки власник може відкрити (захист за TELEGRAM_OWNER_ID)

const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const CURRENT_URL_FILE = path.join(__dirname, 'current_url.txt');
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const OWNER_ID = parseInt(process.env.TELEGRAM_OWNER_ID || '0');

// Перевірка наявності токену
if (!BOT_TOKEN || BOT_TOKEN.includes('ваш_токен')) {
    console.error('❌ Вкажіть TELEGRAM_BOT_TOKEN у файлі backend/.env');
    process.exit(1);
}

if (!OWNER_ID) {
    console.error('❌ Вкажіть TELEGRAM_OWNER_ID у файлі backend/.env');
    process.exit(1);
}

// Читаємо поточний Ngrok URL
function getCurrentUrl() {
    try {
        return fs.readFileSync(CURRENT_URL_FILE, 'utf8').trim();
    } catch {
        return null;
    }
}

const bot = new Telegraf(BOT_TOKEN);

// Middleware: перевіряємо що повідомлення від власника
bot.use((ctx, next) => {
    const userId = ctx.from?.id;
    if (userId !== OWNER_ID) {
        // Мовчки ігноруємо повідомлення від сторонніх
        console.log(`⚠️ Відхилено запит від userId: ${userId}`);
        return;
    }
    return next();
});

// Команда /start — вітальне повідомлення
bot.command('start', async (ctx) => {
    await ctx.reply(
        '🌻 *SFL Bot Constructor*\n\nКерування ботом для Sunflower Land',
        {
            parse_mode: 'Markdown',
            ...Markup.keyboard([
                ['🖥️ Відкрити інтерфейс'],
                ['🔗 Оновити посилання', '📊 Статус'],
                ['🔄 Змінити токен Ngrok']
            ]).resize()
        }
    );
});

// Кнопка або команда /open — надсилаємо WebApp кнопку
bot.hears('🖥️ Відкрити інтерфейс', sendWebAppLink);
bot.command('open', sendWebAppLink);

async function sendWebAppLink(ctx) {
    const url = getCurrentUrl();

    if (!url) {
        await ctx.reply('❌ Ngrok тунель ще не запущено. Запустіть `start_all.bat`', { parse_mode: 'Markdown' });
        return;
    }

    // Надсилаємо повідомлення з inline WebApp кнопкою
    await ctx.reply(
        `🌐 *Поточний URL:*\n\`${url}\`\n\n👆 Натисни кнопку щоб відкрити інтерфейс:`,
        {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                // WebApp кнопка — відкриває сайт прямо в Telegram
                [Markup.button.webApp('🖥️ Відкрити SFL Constructor', url)],
                // Звичайне посилання як резервний варіант
                [Markup.button.url('🔗 Відкрити в браузері', url)],
            ])
        }
    );
}

// Кнопка "Оновити посилання" — перечитує current_url.txt
bot.hears('🔗 Оновити посилання', async (ctx) => {
    const url = getCurrentUrl();
    if (!url) {
        await ctx.reply('❌ URL не знайдено. Ngrok не запущено?');
        return;
    }
    await ctx.reply(
        `✅ Актуальний URL:\n\`${url}\``,
        {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [Markup.button.webApp('🖥️ Відкрити', url)],
                [Markup.button.url('🔗 В браузері', url)],
            ])
        }
    );
});

// Кнопка "Змінити токен Ngrok"
bot.hears('🔄 Змінити токен Ngrok', async (ctx) => {
    // Створюємо файл-прапорець, який зчитає ngrok_manager.js
    fs.writeFileSync(path.join(__dirname, 'next_token.flag'), '1');
    await ctx.reply('⏳ Команда відправлена! Ngrok перезапуститься з новим токеном.\nЗачекайте декілька секунд на нове посилання...');
});

// Кнопка "Статус"
bot.hears('📊 Статус', async (ctx) => {
    const url = getCurrentUrl();
    const status = url ? `✅ Активний\n${url}` : '❌ Тунель не запущено';

    await ctx.reply(
        `📊 *Статус системи*\n\n🌐 Ngrok: ${status}`,
        { parse_mode: 'Markdown' }
    );
});

// Запуск бота
bot.launch()
    .then(() => {
        console.log(`🤖 Telegram-бот запущено (owner: ${OWNER_ID})`);
    })
    .catch(err => {
        console.error('❌ Помилка запуску/polling бота:', err.message);
        console.error('Деталі помилки:', err);
        // Не виходимо з процесу - дозволяємо bot.catch() обробляти помилки
    });

// Обробник помилок бота
bot.catch((err, ctx) => {
    console.error(`❌ Telegram bot error for update ${ctx.updateType}:`, err.message);
});

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

// Експортуємо функцію для виклику з ngrok_manager
module.exports = { notifyNewUrl };

// Надсилаємо повідомлення власнику коли змінився URL
async function notifyNewUrl(url) {
    try {
        await bot.telegram.sendMessage(
            OWNER_ID,
            `🔄 *Новий Ngrok URL*\n\`${url}\``,
            {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                    [Markup.button.webApp('🖥️ Відкрити інтерфейс', url)],
                    [Markup.button.url('🔗 В браузері', url)],
                ])
            }
        );
    } catch (e) {
        console.error('Помилка надсилання в Telegram:', e.message);
    }
}
