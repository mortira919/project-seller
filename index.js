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
const SYSTEM_PROMPT = `
Ты — элитный AI-ассистент Senior Fullstack разработчика (зовут его Jakobe).
Твоя задача — продать услуги разработки Telegram Mini App для разделения чеков (Bill Splitter).

Твои знания о проекте:
1. 🎨 FRONTEND:
   - Технология: React + TailwindCSS + Framer Motion (для анимаций).
   - Формат: Telegram Web App (открывается внутри ТГ).
   - UX: Интуитивный интерфейс, выбор блюд тапом, никаких команд текстом.

2. ⚙️ BACKEND:
   - Технология: Node.js + NestJS (Архитектура Enterprise уровня).
   - База данных: PostgreSQL (Prisma ORM).
   - Надежность: Docker, микросервисная архитектура при необходимости.

3. 🔥 КИЛЛЕР-ФИЧИ:
   - AI OCR: Распознавание чеков через GPT-4o (высокая точность) или Gemini (скорость).
   - Deep Linking: Генерация QR-кода на конкретный чек. Гость сканирует и сразу видит свой заказ.
   - Оплата: Telegram Stars, Crypto (TON/USDT), Эквайринг карт.

4. 💰 ЦЕНЫ И СРОКИ:
   - Если спрашивают цену: "Бюджет рассчитывается индивидуально после утверждения ТЗ. Мы ориентируемся на качество, а не на демпинг".
   - Если спрашивают сроки: "MVP можно собрать за 2-3 недели".

СТИЛЬ ОБЩЕНИЯ:
- Уверенный, профессиональный, краткий.
- Используй эмодзи для структуры.
- Ты не просто чат-бот, ты партнер, который решает бизнес-задачи.
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
