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

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    let finalMaterialId = materialId;

    // Save to Supabase DB (Essential for Cloud Sync)
    if (user) {
      if (!finalMaterialId) {
        // Create NEW material record
        const { data: newMat, error: createError } = await supabase.from('materials').insert({
          owner_id: user.id,
          title: summaryData.title || "Materi Baru",
          summary: summaryData,
          is_processed: true,
          source_type: "pdf" // default, updated by client if needed
        }).select().single();
        
        if (createError) console.error("Create material error:", createError);
        else finalMaterialId = newMat.id;
      } else {
        // Update EXISTING material record
        const { error: matError } = await supabase.from('materials').update({
          summary: summaryData,
          is_processed: true
        }).eq('id', finalMaterialId);
        if (matError) console.error("Update material error:", matError);
      }

      if (finalMaterialId) {
        // Insert Flashcards
        if (flashcardsData.length > 0) {
          const mappedFlashcards = flashcardsData.map((card: any) => ({
            material_id: finalMaterialId,
            question: card.question,
            answer: card.answer
          }));
          await supabase.from('flashcards').insert(mappedFlashcards);
        }

        // Insert Quizzes
        if (quizData.length > 0) {
          await supabase.from('quizzes').insert({ 
            material_id: finalMaterialId, 
            questions: quizData 
          });
        }
        console.log("💾 Saved to Database (Cloud Sync Active)!");
      }
    }

    return NextResponse.json({
      success: true,
      data: { 
        id: finalMaterialId,
        summary: summaryData, 
        flashcards: flashcardsData, 
        quiz: quizData 
      }
    });

  } catch (error: any) {
    console.error("AI Pipeline Error:", error);
    return NextResponse.json({ 
      error: error.message || "Failed to process material" 
    }, { status: 500 });
  }
}
