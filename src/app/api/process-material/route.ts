import { NextResponse } from "next/server";
import { generateJSONWithFallback } from "@/lib/ai/provider";
import { generateCombinedPrompt } from "@/lib/ai/prompts";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

const SYSTEM_PROMPT = `Kamu adalah Nata Sensei, asisten belajar AI terbaik. 
Tugasmu adalah membantu siswa memahami materi dengan membuat ringkasan, flashcard, dan kuis yang berkualitas tinggi.
PENTING: Selalu jawab HANYA dengan format JSON murni yang valid, tidak ada teks lain di luar JSON.`;

export async function POST(req: Request) {
  try {
    const { materialId, rawText, language = "Indonesian" } = await req.json();

    if (!rawText) {
      return NextResponse.json({ error: "rawText is required" }, { status: 400 });
    }

    console.log(`🚀 Nata Sensei AI Pipeline (Combined Mode) → Language: ${language}`);

    // ✅ SINGLE AI CALL: Generate everything at once to avoid timeout
    let summaryData = { title: "Materi Baru", summary: "Gagal memuat ringkasan.", key_points: [], cheat_sheet: "" };
    let flashcardsData: any[] = [];
    let quizData: any[] = [];

    try {
      const combined = await generateJSONWithFallback(generateCombinedPrompt(rawText, language), SYSTEM_PROMPT);
      console.log("✅ Combined AI generation successful!");

      // Extract each section from combined result
      summaryData = combined?.summary || summaryData;
      flashcardsData = combined?.flashcards || [];
      quizData = combined?.quiz || [];

      console.log(`📊 Got: ${flashcardsData.length} flashcards, ${quizData.length} quiz questions`);
    } catch (err) {
      console.error("❌ Combined AI Generation Failed:", err);
    }

    // Save to Supabase
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    let finalMaterialId = materialId;

    if (user) {
      if (!finalMaterialId) {
        const { data: newMat, error: createError } = await supabase.from('materials').insert({
          owner_id: user.id,
          title: summaryData.title || "Materi Baru",
          summary: summaryData,
          is_processed: true,
          source_type: "pdf"
        }).select().single();

        if (createError) console.error("Create material error:", createError);
        else finalMaterialId = newMat?.id;
      } else {
        const { error: matError } = await supabase.from('materials').update({
          title: summaryData.title || "Materi",
          summary: summaryData,
          is_processed: true
        }).eq('id', finalMaterialId);
        if (matError) console.error("Update material error:", matError);
      }

      if (finalMaterialId) {
        // Insert Flashcards
        if (flashcardsData.length > 0) {
          const mapped = flashcardsData.map((card: any) => ({
            material_id: finalMaterialId,
            question: card.question,
            answer: card.answer
          }));
          const { error: fcErr } = await supabase.from('flashcards').insert(mapped);
          if (fcErr) console.error("❌ Flashcards insert error:", fcErr.message);
          else console.log(`✅ ${flashcardsData.length} flashcards saved!`);
        }

        // Insert Quiz
        if (quizData.length > 0) {
          const { error: qErr } = await supabase.from('quizzes').insert({
            material_id: finalMaterialId,
            questions: quizData
          });
          if (qErr) console.error("❌ Quiz insert error:", qErr.message);
          else console.log(`✅ ${quizData.length} quiz questions saved!`);
        }
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
