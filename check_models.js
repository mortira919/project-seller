require('dotenv').config();

async function checkAvailableModels() {
    const apiKey = process.env.GOOGLE_API_KEY;
    
    if (!apiKey) {
        console.error("❌ Ошибка: В файле .env не найден GOOGLE_API_KEY");
        return;
    }

    console.log("🔍 Стучусь в Google API, чтобы узнать список моделей...");

    try {
        // Делаем прямой запрос к API списка моделей
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await response.json();

        if (data.error) {
            console.error("❌ Ошибка API:", data.error.message);
            return;
        }

        if (!data.models) {
            console.log("⚠️ Модели не найдены. Странный ответ:", data);
            return;
        }

        console.log("\n✅ СПИСОК ДОСТУПНЫХ ТЕБЕ МОДЕЛЕЙ:\n");

        const chatModels = data.models.filter(m => m.supportedGenerationMethods.includes("generateContent"));

        chatModels.forEach(model => {
            // Нам нужно имя без приставки "models/"
            const cleanName = model.name.replace("models/", "");
            console.log(`🔹 Название для кода: "${cleanName}"`);
            console.log(`   (Полное имя: ${model.displayName})`);
            console.log("-------------------------------------------");
        });

        if (chatModels.length === 0) {
            console.log("❌ Нет доступных моделей для генерации текста. Проверь API ключ.");
        } else {
            console.log("\n👇 СКОПИРУЙ ЛЮБОЕ НАЗВАНИЕ В КАВЫЧКАХ И ВСТАВЬ В index.js");
        }

    } catch (error) {
        console.error("❌ Ошибка сети или кода:", error);
    }
}

checkAvailableModels();