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

ПРАВИЛА ОТВЕТА:
1. Отвечай ВСЕГДА **одним цельным сообщением**.
2. Используй **Markdown** для структуры:
   - Выделяй главное **жирным**.
   - Используй списки (• Пункт), чтобы текст было легко читать.
   - Делай пустые строки между абзацами.
3. Не пиши слишком длинно, но раскрывай суть полностью.

УТП: Мы работаем БЕЗ ПРЕДОПЛАТЫ.
`;

const sessions = {};

app.post('/api/chat', async (req, res) => {
    const { message, userId, voiceMode } = req.body;
    
    try {
        if (!sessions[userId]) {
            sessions[userId] = [
                { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
                { role: "model", parts: [{ text: "Принято." }] }
            ];
        }

        sessions[userId].push({ role: "user", parts: [{ text: message }] });

        const chat = model.startChat({ history: sessions[userId] });
        const result = await chat.sendMessage(message);
        const fullText = result.response.text();

        sessions[userId].push({ role: "model", parts: [{ text: fullText }] });

        // 🔥 ИСПРАВЛЕНИЕ: Всегда отправляем массив из ОДНОГО элемента
        // Фронтенд получит [fullText] и покажет один красивый баббл.
        res.json({ reply: [fullText], isVoice: voiceMode });

    } catch (error) {
        console.error("AI Error:", error);
        res.status(500).json({ reply: ["⚠️ Сервер занят. Попробуйте позже."] });
    }
});

// Бот
bot.start((ctx) => {
    ctx.reply("Запускай:", {
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