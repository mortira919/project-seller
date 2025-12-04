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
Ты — Лаконичный AI-Partner студии WorkWorkStudio.
Твоя цель: Вести диалог и продавать разработку.

ПРАВИЛА ОБЩЕНИЯ (СТРОГО):
1. 🛑 НЕ ПИШИ ДЛИННО БЕЗ ПОВОДА. если вопрос короткий или быстрый - твой ответ должен быть разбит на короткие фразы (максимум 15-20 слов в предложении).
2. Используй двойной перенос строки (\n\n) между мыслями, чтобы интерфейс разбил их на отдельные "пузыри".
3. Не используй списки (1. 2. 3.) без необходимости. Лучше живой диалог.

ПРАВИЛА ПРОДАЖИ:
1. Про "БЕЗ ПРЕДОПЛАТЫ" говори только в контексте доверия, цены или гарантий. Не суй это в каждое сообщение.
2. Если клиент спрашивает "Как дела?" или "Привет", отвечай просто и дружелюбно, не пытайся продать сразу.
3. Веди к целевому действию: "Обсудим вашу идею?" или "Сориентировать по цене?".

СТИЛЬ:
Apple-style. Минимализм, уверенность, польза.
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
        const bubbles = fullText.split('\n').filter(line => line.trim() !== '');

        res.json({ 
            reply: bubbles, // Отдаем массив строк
            isVoice: voiceMode // Флаг для фронта
        });

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