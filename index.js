require('dotenv').config();
const { Telegraf } = require('telegraf');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const bot = new Telegraf(process.env.BOT_TOKEN);
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Храним режимы для каждого юзера
const userModes = {}; 

// --- ПРОМПТЫ ---
const PROMPTS = {
    default: `Ты — AI-Partner студии WorkWorkStudio. Твоя цель — продавать разработку софта (React, Node.js). 
    Главное УТП: Работаем БЕЗ ПРЕДОПЛАТЫ берем оплату по частям работы.
    Веди себя как эксперт.`,
    
    wolf: `Ты — "Волк с Уолл-стрит" в мире AI. Твоя задача — ПРОДАТЬ пользователю любой предмет, который он назовет.
    Используй агрессивные техники продаж, NLP, триггеры жадности и эксклюзивности.
    Если юзер пишет "ручка", ты должен так описать эту ручку, чтобы он захотел отдать за нее жизнь.
    Используй эмодзи, капс (умеренно) и харизму.`,
    
    oracle: `Ты — Мистический Бизнес-Оракул. Ты предсказываешь будущее бизнеса.
    Тон: Загадочный, космический, но с переходом на продажу IT-услуг.
    Пример: "Вижу... тучи сгущаются над твоими конкурентами. Звезды говорят, что без мобильного приложения твой денежный поток иссякнет в 2025 году..."
    В конце всегда подводи к тому, что WorkWorkStudio спасет карму бизнеса.`
};

app.post('/api/chat', async (req, res) => {
    const { message, userId, mode } = req.body; // mode приходит с фронта
    
    // Если режим сменился или сессии нет
    const currentMode = mode || 'default';
    
    try {
        // Формируем историю с НУЖНЫМ промптом
        const history = [
            { role: "user", parts: [{ text: PROMPTS[currentMode] }] },
            { role: "model", parts: [{ text: "Режим активирован. Я готов." }] }
        ];

        // Добавляем текущий вопрос
        const chat = model.startChat({ history });
        const result = await chat.sendMessage(message);
        const responseText = result.response.text();

        res.json({ reply: responseText });
    } catch (error) {
        console.error("AI Error:", error);
        res.status(500).json({ reply: "⚠️ Нейросеть перегружена эмоциями. Повторите..." });
    }
});

// Бот-заглушка
bot.start((ctx) => {
    ctx.reply("Жми кнопку меню!", {
        reply_markup: {
            inline_keyboard: [[{ text: "🚀 Открыть", web_app: { url: process.env.WEB_APP_URL } }]]
        }
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server on ${PORT}`));
bot.launch();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));