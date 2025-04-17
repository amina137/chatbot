// index.js  — ES‑module style (because "type": "module" in package.json)
import express from "express";
import cors from "cors";
import OpenAI from "openai";
import admin from "firebase-admin";

// ---------- basic middleware ----------
const app = express();
app.use(cors());           // TODO: restrict origin in production
app.use(express.json());

// ---------- Firebase Admin ----------
admin.initializeApp({
    credential: admin.credential.cert(
        JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    ),
});
const db = admin.firestore();

// ---------- OpenAI ----------
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// ---------- /chatbot endpoint ----------
app.post("/chatbot", async (req, res) => {
    try {
        const { message } = req.body;

        /* 1. Ask GPT to produce an intent JSON */
        const intentPrompt = `
      You are an assistant for a teaching institute.
      User question: "${message}"
      Respond ONLY with compact JSON, e.g.
      {"intent":"get_student_stats","parameters":{"student_id":"S001"}}
    `;

        const { choices } = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: intentPrompt }],
        });

        const intent = JSON.parse(choices[0].message.content.trim());

        /* 2. Handle intents */
        let reply;
        if (intent.intent === "get_student_stats") {
            const snap = await db
                .collection("students")
                .doc(intent.parameters.student_id)
                .get();
            reply = snap.exists ? snap.data() : { error: "Student not found" };
        } else {
            reply = { error: "Intent not supported yet." };
        }

        res.json({ reply });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
});

// ---------- start server ----------
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Chatbot listening on ${PORT}`));
