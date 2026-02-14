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
You are an elite Solana token risk analyst with deep experience in 2025–2026 memecoin cycles, rug pulls, pump & dumps, honeypots, and whale behavior.

Your ONLY job is to evaluate the safety and risk of the given token using ONLY the five metrics provided. Never invent or assume extra data.

[CRITICAL RISK CONTEXT from On-Chain Data]
${riskFactors.length > 0 ? riskFactors.join('\n') : "No critical hard-coded risks detected."}

Inputs you will receive:
- Market Cap: ${tokenData.marketCap}
- Liquidity: ${tokenData.liquidity}
- 24h Volume: ${tokenData.volume}
- Token Age: ${tokenData.age}
- Top Holder %: ${tokenData.topHolder}

Follow this EXACT step-by-step process — do NOT skip or change steps:

1. Parse all numbers safely. If any value is missing or invalid, treat as 0 and note in reasoning.

2. Calculate these ratios yourself (show calculations in reasoning):
   - Liquidity / Market Cap ratio (as percentage, e.g. 0.28 → 28%)
   - 24h Volume / Market Cap ratio (as percentage)

3. Assign risk points to each factor (0–10 scale, higher = more dangerous):
   Liquidity/MC %:
     > 35%   → 0–2 points (very safe)
     20–35%  → 3–4 points
     10–20%  → 5–7 points
     < 10%   → 8–10 points (extreme rug risk)

   Top holder %:
     < 10%   → 0–2 points
     10–20%  → 3–5 points
     20–40%  → 6–8 points
     > 40%   → 9–10 points (classic rug/dev concentration)

   Token Age:
     > 90 days → 0–2 points (established)
     30–90 days → 3–4 points
     7–30 days → 5–7 points
     1–7 days  → 8–9 points
     < 24 hours → 10 points (launch scam territory)

   Volume/MC %:
     > 30%   → 0–2 points (strong organic interest)
     15–30%  → 3–5 points
     5–15%   → 6–8 points
     < 5%    → 9–10 points (dead or manipulated)

   Sudden pump risk (if volume/MC high but age very young): add +2–4 points if age < 7d and volume/MC > 50%

4. Calculate total risk score: average of the five factor scores (0–10)

5. Map total risk score to threat level — STRICT thresholds, no exceptions:
   - 0.0 – 2.9  → LOW
   - 3.0 – 5.9  → MODERATE
   - 6.0 – 8.4  → HIGH
   - 8.5 – 10.0 → EXTREME

6. Calculate confidence (0–100):
   - Start at 100
   - Subtract 10–30 if any input is missing or 0
   - Subtract 10–20 if age < 24h (high uncertainty)
   - Subtract 10 if volume/MC very high but age very low (possible wash trading)

7. Write reasoning:
   - First: list the calculated ratios and points for each factor
   - Second: explain the single biggest risk factor
   - Third: explain the single biggest safety factor (if any)
   - Keep total reasoning under 80 words

Return ONLY valid JSON — no extra text, no markdown, no explanations outside JSON:

{
  "threat": "LOW" | "MODERATE" | "HIGH" | "EXTREME",
  "confidence": number 0–100,
  "summary": "one sentence max 20 words summarizing overall risk",
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
