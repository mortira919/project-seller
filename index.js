require('dotenv').config();
const { Telegraf, Markup, session } = require('telegraf');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

// --- НАСТРОЙКИ ---
const bot = new Telegraf(process.env.BOT_TOKEN);
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-preview-09-2025" });
// Хранилище сессий (истории диалога) в памяти
const userSessions = {};

const app = express();
app.use(cors());
app.use(bodyParser.json());
// Эта строка позволит раздавать фронтенд, если ты закинешь его билд в папку public
app.use(express.static('public'));

// Хранилище сессий (истории диалога)
// --- МОЗГИ БОТА (СИСТЕМНЫЙ ПРОМПТ) ---
// --- МОЗГИ (СИСТЕМНЫЙ ПРОМПТ WorkWorkStudio) ---
const SYSTEM_PROMPT = `
Ты — AI-Partner студии разработки **WorkWorkStudio**.
Твоя цель: Продать наши услуги партнеру (Артуру) и его клиентам.

💎 НАШЕ ГЛАВНОЕ ПРЕИМУЩЕСТВО (УТП):
**МЫ НЕ БЕРЕМ ПРЕДОПЛАТУ.**
Мы уверены в качестве, поэтому оплата происходит только ПОСЛЕ демонстрации финального результата. Клиент ничем не рискует.

🛠 НАШИ КОМПЕТЕНЦИИ:
1. **Мобильная разработка:** Создаем приложения для iOS и Android (React Native, Flutter). Быстро, кроссплатформенно, с идеальным UI.
2. **Веб-сервисы:** Разрабатываем сложные платформы, CRM, SaaS-решения и маркетплейсы (React, Next.js, Node.js).
3. **Автоматизация (No-Code/Low-Code):** Мастерски владеем **n8n**. Связываем CRM, мессенджеры и AI, избавляя бизнес от рутины.

СТИЛЬ ОБЩЕНИЯ:
Деловой, экспертный, но доступный.
Ты должен звучать как Senior Tech Lead, который умеет решать проблемы бизнеса.
Используй Markdown для форматирования (жирный шрифт, списки).
`;


// --- УНИВЕРСАЛЬНАЯ ФУНКЦИЯ ОБЩЕНИЯ С AI ---
async function askAI(sessionId, message) {
    // Инициализация сессии, если её нет
    if (!userSessions[sessionId]) {
        userSessions[sessionId] = [
            { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
            { role: "model", parts: [{ text: "Принято. Я готов к работе." }] }
        ];
    }

    // Добавляем сообщение юзера
    userSessions[sessionId].push({ role: "user", parts: [{ text: message }] });

    try {
        const chat = model.startChat({ history: userSessions[sessionId] });
        const result = await chat.sendMessage(message);
        const responseText = result.response.text();

        // Сохраняем ответ
        userSessions[sessionId].push({ role: "model", parts: [{ text: responseText }] });
        return responseText;
    } catch (e) {
        console.error("AI Error:", e);
        return "⚠️ Мозговой центр перегружен. Попробуйте переформулировать вопрос.";
    }
}

// ==========================================
// 🌐 API ДЛЯ MINI APP (REACT)
// ==========================================
app.post('/api/chat', async (req, res) => {
    const { message, userId } = req.body;
    
    // Используем тот же askAI, что и в телеграме
    // userId придет с фронтенда
    const reply = await askAI("web_" + userId, message);
    
    res.json({ reply });
});

// ==========================================
// 🤖 ЛОГИКА TELEGRAM БОТА
// ==========================================

// Главное меню
const mainMenu = Markup.inlineKeyboard([
    // КНОПКА ОТКРЫТИЯ MINI APP (Главная фича)
    [Markup.button.webApp("🚀 Открыть TechVision Hub", process.env.WEB_APP_URL || "https://google.com")],
    
    // Обычные кнопки (как запасной вариант)
    [Markup.button.callback('🛠 Стек', 'btn_stack'), Markup.button.callback('💸 Оплата', 'btn_pay')],
    [Markup.button.callback('🧹 Сброс', 'btn_clear')]
]);

bot.start((ctx) => {
    userSessions[ctx.from.id] = null; // Сброс при старте
    ctx.reply(
        `👋 *Приветствую! Я — AI-ассистент Jakobe.*\n\n` +
        `Я работаю в двух режимах:\n` +
        `1. Прямо здесь в чате.\n` +
        `2. В красивом *Mini App* интерфейсе (рекомендую!).\n\n` +
        `👇 Нажми кнопку ниже, чтобы увидеть демо:`,
        { parse_mode: 'Markdown', ...mainMenu }
    );
});

// Обработка кнопок меню
bot.action('btn_stack', async (ctx) => {
    await ctx.answerCbQuery();
    ctx.sendChatAction('typing');
    const answer = await askAI(ctx.from.id, "Кратко опиши стек (Frontend/Backend).");
    ctx.reply(answer, { parse_mode: 'Markdown' });
});

bot.action('btn_pay', async (ctx) => {
    await ctx.answerCbQuery();
    ctx.sendChatAction('typing');
    const answer = await askAI(ctx.from.id, "Какие способы оплаты поддерживаются?");
    ctx.reply(answer, { parse_mode: 'Markdown' });
});

bot.action('btn_clear', (ctx) => {
    userSessions[ctx.from.id] = null;
    ctx.reply("🧹 Контекст сброшен.", mainMenu);
});

// Обработка текстовых сообщений в чате
bot.on('text', async (ctx) => {
    ctx.sendChatAction('typing');
    const answer = await askAI(ctx.from.id, ctx.message.text);
    ctx.reply(answer, { parse_mode: 'Markdown' });
});

// --- ЗАПУСК ВСЕГО ---
const PORT = 3000;

// 1. Запускаем API сервер
app.listen(PORT, () => {
    console.log(`🌍 API Сервер запущен: http://localhost:${PORT}`);
});

// 2. Запускаем Бота
bot.launch().then(() => {
    console.log('🤖 Telegram Бот запущен!');
});

// Graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
