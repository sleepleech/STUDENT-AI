import { NextResponse } from "next/server";
import { generateJSONWithFallback } from "@/lib/ai/provider";
import { 
  generateSummaryPrompt, 
  generateFlashcardsPrompt, 
  generateQuizPrompt 
} from "@/lib/ai/prompts";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60; // Vercel Pro only (Hobby is 10s-15s)

const SYSTEM_PROMPT = `Kamu adalah Nata Sensei, asisten belajar AI terbaik. 
Tugasmu adalah membantu siswa memahami materi dengan membuat ringkasan, flashcard, dan kuis yang berkualitas tinggi.
Selalu jawab dengan format JSON yang valid sesuai instruksi.`;

// Helper: Small delay to avoid rate limits between tasks
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export async function POST(req: Request) {
  try {
    const { materialId, rawText, language = "Indonesian" } = await req.json();

    if (!rawText) {
      return NextResponse.json({ error: "rawText is required" }, { status: 400 });
    }

    console.log(`🚀 Nata Sensei AI Pipeline (Sequential Mode) → Language: ${language}`);

    // --- TASK 1: SUMMARY (Sekuensial) ---
    let summaryData;
    try {
      console.log("📝 Generating Summary...");
      summaryData = await generateJSONWithFallback(generateSummaryPrompt(rawText, language), SYSTEM_PROMPT);
    } catch (err) {
      console.error("❌ Summary Generation Failed:", err);
      summaryData = { title: "Materi Baru", summary: "Gagal memuat ringkasan otomatis.", key_points: [], cheat_sheet: "" };
    }

    await delay(500); // 0.5s pause to breathe

    // --- TASK 2: FLASHCARDS (Sekuensial) ---
    let flashcardsData = [];
    try {
      console.log("🗂️ Generating Flashcards...");
      flashcardsData = await generateJSONWithFallback(generateFlashcardsPrompt(rawText, language), SYSTEM_PROMPT);
    } catch (err) {
      console.error("❌ Flashcards Generation Failed:", err);
    }

    await delay(500); // 0.5s pause to breathe

    // --- TASK 3: QUIZ (Sekuensial) ---
    let quizData = [];
    try {
      console.log("⚔️ Generating Quiz Arena...");
      quizData = await generateJSONWithFallback(generateQuizPrompt(rawText, language), SYSTEM_PROMPT);
    } catch (err) {
      console.error("❌ Quiz Generation Failed:", err);
    }

    console.log("✅ AI Generation Sequence Completed!");

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    let finalMaterialId = materialId;

    if (user) {
      if (!finalMaterialId) {
        // Create NEW material record
        const { data: newMat, error: createError } = await supabase.from('materials').insert({
          owner_id: user.id,
          title: summaryData.title || "Materi Baru",
          summary: summaryData,
          is_processed: true,
          source_type: "pdf" 
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
        // Insert Flashcards (Clear old ones first if needed - simplified version skips)
        if (flashcardsData && flashcardsData.length > 0) {
          const mappedFlashcards = flashcardsData.map((card: any) => ({
            material_id: finalMaterialId,
            question: card.question,
            answer: card.answer
          }));
          await supabase.from('flashcards').insert(mappedFlashcards);
        }

        // Insert Quizzes (More resilient extraction)
        if (quizData) {
          let questionsToInsert = [];
          if (Array.isArray(quizData)) {
            questionsToInsert = quizData;
          } else if (typeof quizData === 'object' && quizData !== null) {
             // Handle if AI returns { quiz: [...] } or { questions: [...] }
             questionsToInsert = quizData.questions || quizData.quiz || quizData.data || [];
          }

          if (questionsToInsert && questionsToInsert.length > 0) {
            console.log(`💾 Inserting ${questionsToInsert.length} quiz questions...`);
            const { error: quizError } = await supabase.from('quizzes').insert({ 
              material_id: finalMaterialId, 
              questions: questionsToInsert 
            });
            if (quizError) console.error("❌ Error inserting quizzes:", quizError.message);
            else console.log("✅ Quizzes successfully saved!");
          } else {
            console.warn("⚠️ Quiz data was empty or invalid after processing.");
          }
        }
        console.log("💾 Pipeline sequence complete!");
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
    console.error("AI Pipeline Sequential Error:", error);
    return NextResponse.json({ 
      error: error.message || "Failed to process material" 
    }, { status: 500 });
  }
}
