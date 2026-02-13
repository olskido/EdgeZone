import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { analyzeTokenWithGemini } from "./services/geminiService.js";

// 🔥 THIS loads Redis automatically because
// redisClient.js runs on import
import "./services/redisClient.js";

dotenv.config();

const app = express();
// const PORT removed here, defined at bottom


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

        const riskFactors = [];

        // HARD RISK FLAGS (Passed to AI context, NOT overriding)
        if (token.liquidity < 10000) {
            riskFactors.push(`CRITICAL WARNING: LOW LIQUIDITY DETECTED ($${token.liquidity}). This is extremely dangerous. Warn the user about potential rug pull or inability to sell.`);
        }

        if (token.topHolder > 50) {
            riskFactors.push(`CRITICAL WARNING: CENTRALIZATION RISK. Top holder owns ${token.topHolder}% of supply. This is a single point of failure.`);
        }

        // ALWAYS call AI with Risk Context
        const aiResult = await analyzeTokenWithGemini(token, riskFactors);

        res.send(aiResult);

        res.send(finalResult);

    } catch (err) {
        console.error("🔥 AI ERROR:", err.message);
        res.status(500).send("AI analysis failed");
    }
});

const PORT = process.env.PORT || 10000;

app.listen(PORT, "0.0.0.0", () => {
    console.log(`🔥 AI Server running on port ${PORT}`);
});
