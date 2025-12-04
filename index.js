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

const SYSTEM_PROMPT = `
Ты — Интеллектуальный AI-Partner студии WorkWorkStudio.
Твоя цель: Продать разработку (Mobile, Web, Automation).

ПРАВИЛА:
1. Пиши живым, естественным языком.
2. Твои ответы должны быть емкими, но ПОЛНЫМИ. Не дроби мысль на кучу мелких фраз.
3. Используй двойной перенос строки (Enter), чтобы разделить разные мысли (например, приветствие и вопрос).

ГЛАВНОЕ: Мы работаем БЕЗ ПРЕДОПЛАТЫ.
`;


const sessions = {};

app.post('/api/chat', async (req, res) => {
    const { message, userId, voiceMode } = req.body; // voiceMode - если клиент хочет голос
    
    try {
        if (!sessions[userId]) {
            sessions[userId] = [
                { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
                { role: "model", parts: [{ text: "Принято. Отвечаю кратко." }] }
            ];
        }


       


        sessions[userId].push({ role: "user", parts: [{ text: message }] });

        const chat = model.startChat({ history: sessions[userId] });
        const result = await chat.sendMessage(message);
        const fullText = result.response.text();

        // Сохраняем в историю
        sessions[userId].push({ role: "model", parts: [{ text: fullText }] });

        // --- ЛОГИКА РАЗБИЕНИЯ ТЕКСТА ---
        // Разбиваем ответ на предложения, чтобы отправлять "пузырями"
        // Это костыль, но рабочий для демо.
         const bubbles = fullText
            .split(/\n\n+/)  // <--- БЫЛО \n+, СТАЛО \n\n+
            .map(s => s.trim())
            .filter(s => s.length > 0);

        res.json({ reply: bubbles, isVoice: voiceMode });

    } catch (error) {
        console.error("AI Error:", error);
        res.status(500).json({ reply: ["⚠️ Сервер занят.", "Попробуйте позже."] });
    }
});

// Бот
bot.start((ctx) => {
    ctx.reply("Запускай WorkWork Hub:", {
        reply_markup: {
            inline_keyboard: [[{ text: "🚀 Открыть", web_app: { url: process.env.WEB_APP_URL } }]]
        }
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
bot.launch();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));