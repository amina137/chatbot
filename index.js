// index.js — ES‑module style ("type": "module" in package.json)
import express from "express";
import cors from "cors";
// If you removed node-fetch from package.json, delete the next line.
// import fetch from "node-fetch";
import admin from "firebase-admin";

// ---------- basic middleware ----------
const app = express();
app.use(cors({ origin: "https://tarkizplus.web.app" }));   // tighten CORS here
app.use(express.json());

// ---------- Firebase Admin ----------
admin.initializeApp({
    credential: admin.credential.cert(
        JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    ),
});
const db = admin.firestore();

// ---------- Hugging Face helper ----------
async function askLLM(prompt) {
    const res = await fetch(
        "https://api-inference.huggingface.co/models/google/flan-t5-large",
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${process.env.HF_TOKEN}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                inputs: prompt,
                parameters: { temperature: 0.2, max_new_tokens: 128 },
            }),
        }
    );

    if (!res.ok) {
        throw new Error(`HF error ${res.status}: ${await res.text()}`);
    }

    const data = await res.json(); // [{ generated_text: "..." }]
    return data[0].generated_text;
}

// ---------- /chatbot endpoint ----------
app.post("/chatbot", async (req, res) => {
    try {
        const { message } = req.body;

        /* 1. Ask the LLM to produce intent JSON */
        const intentPrompt = `
      You are an assistant for a teaching institute.
      User question: "${message}"
      Respond ONLY with compact JSON, e.g.
      {"intent":"get_student_stats","parameters":{"student_id":"S001"}}
    `;

        const intentJSON = await askLLM(intentPrompt);
        const intent = JSON.parse(intentJSON.trim());

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
