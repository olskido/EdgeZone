import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { analyzeTokenWithGemini } from "./services/geminiService.js";

// 🔥 THIS loads Redis automatically because
// redisClient.js runs on import
import "./services/redisClient.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

/*
    TOKEN AI ROUTE
*/
app.post("/analyze-token", async (req, res) => {
    try {
        const token = req.body;

        if (!token) {
            return res.status(400).send("Token data missing");
        }

        let hardRisk = null;

        // HARD RISK FLAGS (do NOT return early)
        if (token.liquidity < 10000) {
            hardRisk = {
                threat: "HIGH",
                confidence: 95,
                summary: "Critically low liquidity — extreme rug risk.",
                aiExplanation: [
                    { text: "Liquidity is below $10,000 threshold", confidence: 100 },
                    { text: "Token cannot support meaningful trading volume", confidence: 95 }
                ],
                detailedReasoning: [
                    { title: "Liquidity Crisis", content: "The token has less than $10k in liquidity, making it impossible to exit with any significant size. This is a classic signature of a rug pull or dead project." }
                ]
            };
        }

        if (token.topHolder > 50) {
            hardRisk = {
                threat: "EXTREME",
                confidence: 98,
                summary: "Top holder controls majority supply.",
                aiExplanation: [
                    { text: "Top holder owns > 50% of supply", confidence: 100 },
                    { text: "Single point of failure detected", confidence: 100 }
                ],
                detailedReasoning: [
                    { title: "Centralization Risk", content: "A single wallet holds more than 50% of the token supply. They can dump at any moment, instantly draining the liquidity pool and driving the price to zero." }
                ]
            };
        }

        // ALWAYS call AI (cached + locked automatically)
        const aiResult = await analyzeTokenWithGemini(token);

        // If hard risk exists → override threat ONLY
        const finalResult = hardRisk
            ? { ...aiResult, ...hardRisk }
            : aiResult;

        res.send(finalResult);

    } catch (err) {
        console.error("🔥 AI ERROR:", err.message);
        res.status(500).send("AI analysis failed");
    }
});

app.listen(process.env.PORT || 5001, () =>
    console.log(`🔥 AI Server running on port ${process.env.PORT || 5001}`)
);
