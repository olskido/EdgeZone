import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY);

export const analyzeTokenWithGemini = async (tokenData) => {

    const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
    });

    const prompt = `
You are an elite crypto risk analyst.

Analyze the token using these metrics:

Market Cap: ${tokenData.marketCap}
Liquidity: ${tokenData.liquidity}
24h Volume: ${tokenData.volume}
Token Age: ${tokenData.age}
Top Holder Percentage: ${tokenData.topHolder}

Return ONLY valid JSON.

{
 "threat": "LOW | MODERATE | HIGH | EXTREME",
 "confidence": number,
 "summary": "max 20 words"
}
`;

    const result = await model.generateContent(prompt);

    let text = result.response.text();

    // Clean accidental markdown if Gemini adds it
    text = text.replace(/```json|```/g, "").trim();

    return JSON.parse(text);
};
