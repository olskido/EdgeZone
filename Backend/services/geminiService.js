import { GoogleGenerativeAI } from "@google/generative-ai";
import { getOrSetCacheLocked } from "./redisClient.js";
import dotenv from "dotenv";

dotenv.config();

export const analyzeTokenWithGemini = async (tokenData, riskFactors = []) => {

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        throw new Error("GEMINI_API_KEY missing");
    }

    const cacheKey = `gemini:${tokenData.address}:v1`;

    return await getOrSetCacheLocked(cacheKey, async () => {

        const genAI = new GoogleGenerativeAI(apiKey);

        const model = genAI.getGenerativeModel({
            model: "gemini-flash-latest"
        });

        const prompt = `
You are an elite crypto risk analyst.

[CRITICAL RISK CONTEXT from On-Chain Data]
${riskFactors.length > 0 ? riskFactors.join('\n') : "No critical hard-coded risks detected."}

Analyze this token:

Market Cap: ${tokenData.marketCap}
Liquidity: ${tokenData.liquidity}
24h Volume: ${tokenData.volume}
Token Age: ${tokenData.age}
Top Holder %: ${tokenData.topHolder}

Return ONLY valid JSON with this EXACT structure:

{
 "threat": "LOW | MODERATE | HIGH | EXTREME",
 "confidence": number (0-100),
 "summary": "max 20 words",
 "aiExplanation": [
   { "text": "Key point 1", "confidence": number },
   { "text": "Key point 2", "confidence": number }
 ],
 "detailedReasoning": [
   { "title": "Liquidity Analysis", "content": "..." },
   { "title": "Holder Analysis", "content": "..." },
   { "title": "Volume Analysis", "content": "..." }
 ]
}
`;

        // ✅ TIMEOUT PROTECTION
        const result = await Promise.race([

            model.generateContent(prompt),

            new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Gemini timeout")), 15000)
            )
        ]);

        let text = result.response.text();

        // Gemini sometimes wraps JSON
        text = text.replace(/```json|```/g, "").trim();

        return JSON.parse(text);

    });
};
