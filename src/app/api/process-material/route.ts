import { NextResponse } from "next/server";
import { generateJSONWithFallback } from "@/lib/ai/provider";
import { 
  generateSummaryPrompt, 
  generateFlashcardsPrompt, 
  generateQuizPrompt 
} from "@/lib/ai/prompts";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

const SYSTEM_PROMPT = `Kamu adalah Nata Sensei, asisten belajar AI terbaik. 
Tugasmu adalah membantu siswa memahami materi dengan membuat ringkasan, flashcard, dan kuis yang berkualitas tinggi.
Selalu jawab dengan format JSON yang valid sesuai instruksi.`;

export async function POST(req: Request) {
  try {
    const { materialId, rawText, language = "Indonesian" } = await req.json();

    if (!rawText) {
      return NextResponse.json({ error: "rawText is required" }, { status: 400 });
    }

    console.log(`🚀 Nata Sensei AI Pipeline → Language: ${language}`);

    // Run all 3 AI tasks in parallel, but with individual try-catch for resilience
    const [summaryData, flashcardsData, quizData] = await Promise.all([
      // Task 1: Summary (Critical)
      (async () => {
        try {
          return await generateJSONWithFallback(generateSummaryPrompt(rawText, language), SYSTEM_PROMPT);
        } catch (err) {
          console.error("❌ Summary Generation Failed:", err);
          return { title: "Materi Baru", summary: "Gagal memuat ringkasan.", key_points: [], cheat_sheet: "" };
        }
      })(),
      
      // Task 2: Flashcards (Optional)
      (async () => {
        try {
          return await generateJSONWithFallback(generateFlashcardsPrompt(rawText, language), SYSTEM_PROMPT);
        } catch (err) {
          console.error("❌ Flashcards Generation Failed:", err);
          return [];
        }
      })(),
      
      // Task 3: Quiz (Optional)
      (async () => {
        try {
          return await generateJSONWithFallback(generateQuizPrompt(rawText, language), SYSTEM_PROMPT);
        } catch (err) {
          console.error("❌ Quiz Generation Failed:", err);
          return [];
        }
      })(),
    ]);

    console.log("✅ AI Generation Successful!");

    // Save to Supabase DB (if materialId provided)
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
    return NextResponse.json({ 
      error: error.message || "Failed to process material" 
    }, { status: 500 });
  }
}
