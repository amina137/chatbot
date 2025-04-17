import express from "express";
import cors from "cors";
import { Configuration, OpenAIApi } from "openai";
import admin from "firebase-admin";

const app = express();
app.use(cors());                  // allow requests from your site
app.use(express.json());

// --- Firebase Admin ----------------------------
admin.initializeApp({
    credential: admin.credential.cert(
        JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    ),
});
const db = admin.firestore();

// --- OpenAI ------------------------------------
const openai = new OpenAIApi(
    new Configuration({ apiKey: process.env.OPENAI_API_KEY })
);

// --- Chatbot endpoint --------------------------
app.post("/chatbot", async (req, res) => {
    try {
        const { message } = req.body;

        // 1) Let GPT figure out the intent
        const intentPrompt = `
      You are an assistant for a teaching institute.  
      User question: "${message}".  
      Respond ONLY with compact JSON, e.g.  
      {"intent":"get_student_stats","parameters":{"student_id":"S001"}}
    `;

        const intentJSON = (
            await openai.createChatCompletion({
                model: "gpt-3.5-turbo",
                messages: [{ role: "user", content: intentPrompt }],
            })
        ).data.choices[0].message.content.trim();

        const intent = JSON.parse(intentJSON);

        // 2) Handle the intents (expand as you add features)
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

// --- Start local dev server --------------------
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Chatbot listening on ${PORT}`));
