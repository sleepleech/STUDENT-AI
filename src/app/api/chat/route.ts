import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Multi-Key Rotation
function getRandomGeminiKey(): string {
  const keysEnv = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || "";
  const keys = keysEnv.split(",").map((k) => k.trim()).filter(Boolean);
  if (keys.length === 0) throw new Error("Tidak ada API Key Gemini!");
  const key = keys[Math.floor(Math.random() * keys.length)];
  console.log(`🔑 Chat Key Pool [${keys.length}] → ...${key.slice(-6)}`);
  return key;
}

export async function POST(req: Request) {
  try {
    const { messages, materialContext } = await req.json();

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: "messages is required" }, { status: 400 });
    }

    const apiKey = getRandomGeminiKey();
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // Build system instruction — aware of the study material if provided
    const systemInstruction = materialContext
      ? `You are Nata Sensei, a brilliant and encouraging AI tutor. The student is currently studying the following material:

---
MATERIAL TITLE: ${materialContext.title}
MATERIAL SUMMARY: ${materialContext.summary}
KEY POINTS: ${materialContext.key_points?.join(", ")}
---

Answer all questions based on this context. Be concise, encouraging, and use simple language. You may use emojis sparingly. If the student asks something unrelated, gently guide them back to the material.`
      : `You are Nata Sensei, a brilliant and encouraging AI tutor. Help the student learn effectively. Be concise, friendly, and use simple language. You may use emojis sparingly.`;

    // Build chat history for Gemini multi-turn
    // ⚠️ Gemini requires: history must start with 'user' role.
    // The welcome message is role 'assistant' (model) — we must exclude it from history.
    const allPrevious = messages.slice(0, -1).map((msg: any) => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.content }],
    }));

    // Drop all leading 'model' messages — find first 'user' index
    const firstUserIdx = allPrevious.findIndex((m: any) => m.role === "user");
    const history = firstUserIdx === -1 ? [] : allPrevious.slice(firstUserIdx);

    const chat = model.startChat({
      history,
      systemInstruction: { role: "system", parts: [{ text: systemInstruction }] },
    });

    const lastMessage = messages[messages.length - 1];
    const result = await chat.sendMessage(lastMessage.content);
    const responseText = result.response.text();

    return NextResponse.json({ success: true, message: responseText });

  } catch (error: any) {
    console.error("Chat API Error:", error);
    return NextResponse.json({ error: error.message || "Failed to chat" }, { status: 500 });
  }
}
