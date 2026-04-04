import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { 
  generateSummaryPrompt, 
  generateFlashcardsPrompt, 
  generateQuizPrompt 
} from "@/lib/ai/prompts";
import { createClient } from "@/lib/supabase/server";

// ===== 🔑 MULTI-KEY ROTATION POOL =====
// Picks a random Gemini API key on each request — spreads the load across all keys.
function getRandomGeminiKey(): string {
  const keysEnv = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || "";
  const keys = keysEnv.split(",").map((k) => k.trim()).filter(Boolean);
  
  if (keys.length === 0) {
    throw new Error("Tidak ada API Key Gemini! Pastikan GEMINI_API_KEYS sudah diisi di .env.local");
  }

  const chosenKey = keys[Math.floor(Math.random() * keys.length)];
  console.log(`🔑 Using Key Pool [${keys.length} keys] → ...${chosenKey.slice(-6)}`);
  return chosenKey;
}

export async function POST(req: Request) {
  try {
    const { materialId, rawText, language = "Indonesian" } = await req.json();

    if (!rawText) {
      return NextResponse.json({ error: "rawText is required" }, { status: 400 });
    }

    // Pick a random key from the pool — if one is rate-limited, next request gets a fresh key!
    let apiKey: string;
    try {
      apiKey = getRandomGeminiKey();
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const geminiModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    console.log(`🚀 Nata Sensei AI Pipeline → Language: ${language}`);

    // 1. Run all 3 AI tasks in parallel
    const [summaryRes, flashcardsRes, quizRes] = await Promise.all([
      geminiModel.generateContent({
        contents: [{ role: "user", parts: [{ text: generateSummaryPrompt(rawText, language) }] }],
        generationConfig: { responseMimeType: "application/json" }
      }),
      geminiModel.generateContent({
        contents: [{ role: "user", parts: [{ text: generateFlashcardsPrompt(rawText, language) }] }],
        generationConfig: { responseMimeType: "application/json" }
      }),
      geminiModel.generateContent({
        contents: [{ role: "user", parts: [{ text: generateQuizPrompt(rawText, language) }] }],
        generationConfig: { responseMimeType: "application/json" }
      })
    ]);

    // 2. Parse results
    const summaryData = JSON.parse(summaryRes.response.text());
    const flashcardsData = JSON.parse(flashcardsRes.response.text());
    const quizData = JSON.parse(quizRes.response.text());

    console.log("✅ AI Generation Successful!");

    // 3. Save to Supabase DB (if materialId provided)
    if (materialId) {
      const supabase = await createClient();
      
      const { error: matError } = await supabase.from('materials').update({
        summary: JSON.stringify(summaryData),
        is_processed: true
      }).eq('id', materialId);
      if (matError) console.error("Update material error:", matError);

      if (flashcardsData.length > 0) {
        const mappedFlashcards = flashcardsData.map((card: any) => ({
          material_id: materialId,
          question: card.question,
          answer: card.answer
        }));
        await supabase.from('flashcards').insert(mappedFlashcards);
      }

      if (quizData.length > 0) {
        await supabase.from('quizzes').insert({ material_id: materialId, questions: quizData });
      }
      
      console.log("💾 Saved to Database!");
    }

    return NextResponse.json({
      success: true,
      data: { summary: summaryData, flashcards: flashcardsData, quiz: quizData }
    });

  } catch (error: any) {
    console.error("AI Pipeline Error:", error);
    return NextResponse.json({ error: error.message || "Failed to process material" }, { status: 500 });
  }
}
