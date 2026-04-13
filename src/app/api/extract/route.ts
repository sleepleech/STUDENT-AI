import { NextResponse } from 'next/server';
import { YoutubeTranscript } from 'youtube-transcript';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { generateWithFallback } from "@/lib/ai/provider";

// Body size limits in App Router are handled by the platform (Vercel) automatically.
export const maxDuration = 60; // seconds

// ====== SMART CACHING (In-Memory) ======
const resultCache = new Map<string, { text: string; type: string; cachedAt: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function getCached(key: string) {
  const entry = resultCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
    resultCache.delete(key);
    return null;
  }
  return entry;
}

function setCache(key: string, text: string, type: string) {
  resultCache.set(key, { text, type, cachedAt: Date.now() });
}

/**
 * Strategy 2: Official YouTube oEmbed (Reliable Metadata)
 * Does not get blocked easily like HTML scraping.
 */
async function getYouTubeOEmbed(url: string) {
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    const response = await fetch(oembedUrl);
    
    if (!response.ok) {
      console.warn(`[YT_OEMBED_FAILED] HTTP ${response.status} for ${url}`);
      return null;
    }
    
    const data = await response.json();
    return {
      title: data.title || "",
      author: data.author_name || "",
      thumbnail: data.thumbnail_url || ""
    };
  } catch (err) {
    console.error("[YT_OEMBED_ERROR]", err);
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    // ===== 1. YOUTUBE EXTRACTION =====
    const youtubeUrl = formData.get('youtubeUrl') as string;
    if (youtubeUrl) {
      // ⚡ CACHE CHECK
      const cached = getCached(youtubeUrl);
      if (cached) return NextResponse.json({ success: true, text: cached.text, type: cached.type, fromCache: true });

      console.log(`[YT_PROCESS_START] ${youtubeUrl}`);

      // Strategy 1: YouTube Transcript (Subtitles)
      let transcriptText = "";
      try {
        // Try multiple language attempts
        const langs = ['id', 'en', 'id-ID', 'en-US', 'a.id', 'a.en'];
        for (const lang of langs) {
          try {
            const transcriptList = await YoutubeTranscript.fetchTranscript(youtubeUrl, { lang });
            transcriptText = transcriptList.map(t => t.text).join(' ');
            if (transcriptText.trim().length > 100) break;
          } catch (_) {}
        }
      } catch (transcriptErr) {
        console.warn(`[YT_TRANSCRIPT_FAILED] Trying metadata...`);
      }

      if (transcriptText && transcriptText.trim().length > 100) {
        console.log(`[YT_TRANSCRIPT_SUCCESS] Length: ${transcriptText.length}`);
        setCache(youtubeUrl, transcriptText, 'youtube');
        return NextResponse.json({ success: true, text: transcriptText, type: "youtube" });
      }

      // Strategy 2: OEmbed Metadata + AI Knowledge Fallback
      console.log(`[YT_FALLBACK_MODE] Accessing OEmbed...`);
      const meta = await getYouTubeOEmbed(youtubeUrl);
      
      const title = meta?.title || "Video Unknown";
      const author = meta?.author || "Channel Unknown";

      const fallbackPrompt = `
Judul Video: "${title}"
Channel: "${author}"
URL: "${youtubeUrl}"

Metode pengambilan transkrip standar gagal. Sebagai asisten belajar yang sangat cerdas, gunakan basis pengetahuan (knowledge base) internal kamu untuk merekonstruksi isi materi video ini. 

Jika kamu mengenali video ini, ceritakan secara mendalam apa saja poin-poin yang dibahas. 
Jika kamu tidak spesifik mengenali transkripnya, buatlah ringkasan materi belajar yang sangat berkualitas berdasarkan Judul dan Topik yang relevan dengan video tersebut (dalam Bahasa Indonesia).

Pastikan teks rekonstruksi ini panjang (minimal 500-800 kata), edukatif, dan siap dipelajari oleh siswa. 
Beri judul: "Rekonstruksi Materi: ${title}"`;

      try {
        console.log(`[YT_AI_RECONSTRUCTION] Calling generateWithFallback...`);
        const reconstructedText = await generateWithFallback(
          fallbackPrompt, 
          "Kamu adalah asisten belajar AI yang ahli dalam merekonstruksi isi konten video edukasi."
        );
        
        if (reconstructedText && reconstructedText.length > 200) {
          console.log(`[YT_FINISH] Success via AI Reconstruction`);
          setCache(youtubeUrl, reconstructedText, 'youtube');
          return NextResponse.json({ success: true, text: reconstructedText, type: "youtube", isReconstruction: true });
        }
      } catch (aiErr: any) {
        console.error(`[YT_AI_ERROR] ${aiErr.message}`);
      }

      throw new Error(`❌ Semua metode gagal. Judul video: "${title}". Akses ke transkrip diblokir oleh YouTube. Coba upload file audionya langsung.`);
    }

    // ===== 2. TEXT EXTRACTION =====
    const rawText = formData.get('rawText') as string;
    if (rawText) {
      if (rawText.trim().length < 50) throw new Error("Catatan terlalu pendek!");
      return NextResponse.json({ success: true, text: rawText.trim(), type: "note" });
    }

    // ===== 3. FILE EXTRACTION =====
    const file = formData.get('file') as File;
    if (!file) return NextResponse.json({ error: "Input tidak valid" }, { status: 400 });

    const mime = file.type;
    console.log(`📁 Processing file: ${file.name} [${mime}]`);

    // PDF 
    if (mime === 'application/pdf') {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        // Use lib path directly to avoid pdf-parse test file that references DOMMatrix (browser-only API)
        const pdfParse = require('pdf-parse/lib/pdf-parse.js');
        const pdfData = await pdfParse(buffer);
        const text = pdfData.text || '';
        if (!text.trim()) throw new Error('PDF tidak terbaca.');
        return NextResponse.json({ success: true, text, type: "pdf" });
      } catch (err: any) {
        throw new Error(`Gagal membaca PDF: ${err.message}`);
      }
    }

    // Audio/Video Transcription via Gemini (with KEY ROTATION)
    if (mime.startsWith('audio/') || mime.startsWith('video/')) {
      const fileSizeMB = file.size / (1024 * 1024);
      if (fileSizeMB > 10) throw new Error("File maksimal 10MB!");

      const arrayBuffer = await file.arrayBuffer();
      const base64Data = Buffer.from(arrayBuffer).toString('base64');
      
      const apiKeyEnv = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || "";
      const keys = apiKeyEnv.split(",").map(k => k.trim()).filter(Boolean);
      
      let transcribedText = "";
      let lastError: any = null;

      // Try all available Gemini keys
      for (let i = 0; i < keys.length; i++) {
        try {
          console.log(`🎙️ Transcribing via Gemini Key #${i + 1}...`);
          const genAI = new GoogleGenerativeAI(keys[i]);
          const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

          const prompt = `Transkripsi seluruh isi file ini dalam Bahasa Indonesia.`;
          const result = await model.generateContent([
            { text: prompt },
            { inlineData: { mimeType: mime, data: base64Data } }
          ]);

          transcribedText = result.response.text();
          if (transcribedText) break;
        } catch (err: any) {
          lastError = err;
          console.warn(`⚠️ Gemini Key #${i + 1} failed: ${err.message}`);
          continue;
        }
      }

      if (!transcribedText) {
        throw new Error(`Gagal transkripsi file: ${lastError?.message || "Semua kunci Gemini gagal"}`);
      }

      return NextResponse.json({ success: true, text: transcribedText, type: mime.startsWith('audio') ? "audio" : "video" });
    }

    throw new Error(`Format '${mime}' tidak didukung.`);

  } catch (err: any) {
    console.error(`[EXTRACTION_FINAL_ERROR] ${err.message}`);
    return NextResponse.json({ error: err.message || "Gagal memproses" }, { status: 500 });
  }
}
