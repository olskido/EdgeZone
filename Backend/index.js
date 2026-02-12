import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { analyzeTokenWithGemini } from "./services/geminiService.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.post("/analyze-token", async (req, res) => {
    try {

        const token = req.body;

        // 🔥 HARD RISK LAYER (prevents AI stupidity)

        if (token.liquidity < 10000) {
            return res.send({
                threat: "HIGH",
                confidence: 95,
                summary: "Critically low liquidity — extreme rug risk."
            });
        }

        if (token.topHolder > 50) {
            return res.send({
                threat: "EXTREME",
                confidence: 98,
                summary: "Top holder controls majority supply."
            });
        }

        const aiResult = await analyzeTokenWithGemini(token);

        res.send(aiResult);

    } catch (err) {

        console.error("AI ERROR:", err);

        res.status(500).send("AI analysis failed");
    }
});

app.listen(process.env.PORT, () =>
    console.log(`🔥 AI Server running on port ${process.env.PORT}`)
);
