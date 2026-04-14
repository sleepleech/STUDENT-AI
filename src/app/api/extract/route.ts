import { NextResponse } from 'next/server';
import { YoutubeTranscript } from 'youtube-transcript';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { generateWithFallback } from "@/lib/ai/provider";

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

// ====== GEMINI KEY ROTATION ======
function getGeminiKeys(): string[] {
  const keysEnv = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || "";
  return keysEnv.split(",").map((k) => k.trim()).filter(Boolean);
}

/**
 * Extract text from ANY file using Gemini (PDF, image, audio, video)
 * Gemini supports: PDF, PNG, JPG, WEBP, MP3, MP4, WAV, MOV, etc.
 * Zero external libraries — runs perfectly on Vercel serverless.
 */
async function extractWithGemini(
  base64Data: string,
  mimeType: string,
  promptText: string
): Promise<string> {
  const keys = getGeminiKeys();
  if (keys.length === 0) throw new Error("Tidak ada API Key Gemini tersedia.");

  // Shuffle keys for load balancing
  const shuffled = [...keys].sort(() => Math.random() - 0.5);

  for (const key of shuffled) {
    // Try gemini-2.0-flash-exp first (best multimodal), then flash
    const models = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-flash-latest"];
    for (const modelName of models) {
      try {
        console.log(`[GEMINI_EXTRACT] Trying ${modelName} key=...${key.slice(-6)}`);
        const genAI = new GoogleGenerativeAI(key);
        const model = genAI.getGenerativeModel({ model: modelName });

        const result = await model.generateContent([
          { text: promptText },
          { inlineData: { mimeType, data: base64Data } },
        ]);

        const text = result.response.text();
        if (text && text.trim().length > 20) {
          console.log(`[GEMINI_EXTRACT] ✅ Success with ${modelName}`);
          return text.trim();
        }
      } catch (err: any) {
        console.warn(`[GEMINI_EXTRACT] ${modelName} failed: ${err.message?.slice(0, 80)}`);
        // Continue to next model/key
      }
    }
  }

  throw new Error("Semua kunci Gemini gagal membaca file.");
}

/**
 * YouTube OEmbed metadata fallback
 */
async function getYouTubeOEmbed(url: string) {
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    const response = await fetch(oembedUrl);
    if (!response.ok) return null;
    const data = await response.json();
    return {
      title: data.title || "",
      author: data.author_name || "",
    };
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    // ===== 1. YOUTUBE EXTRACTION =====
    const youtubeUrl = formData.get('youtubeUrl') as string;
    if (youtubeUrl) {
      const cached = getCached(youtubeUrl);
      if (cached) return NextResponse.json({ success: true, text: cached.text, type: cached.type, fromCache: true });

      console.log(`[YT_PROCESS_START] ${youtubeUrl}`);

      // Strategy 1: Transcript via subtitles
      let transcriptText = "";
      const langs = ['id', 'en', 'id-ID', 'en-US', 'a.id', 'a.en'];
      for (const lang of langs) {
        try {
          const transcriptList = await YoutubeTranscript.fetchTranscript(youtubeUrl, { lang });
          transcriptText = transcriptList.map(t => t.text).join(' ');
          if (transcriptText.trim().length > 100) break;
        } catch (_) { /* try next lang */ }
      }

      if (transcriptText && transcriptText.trim().length > 100) {
        setCache(youtubeUrl, transcriptText, 'youtube');
        return NextResponse.json({ success: true, text: transcriptText, type: "youtube" });
      }

      // Strategy 2: OEmbed + AI Knowledge Reconstruction
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
        const reconstructedText = await generateWithFallback(
          fallbackPrompt,
          "Kamu adalah asisten belajar AI yang ahli dalam merekonstruksi isi konten video edukasi."
        );
        if (reconstructedText && reconstructedText.length > 200) {
          setCache(youtubeUrl, reconstructedText, 'youtube');
          return NextResponse.json({ success: true, text: reconstructedText, type: "youtube", isReconstruction: true });
        }
      } catch (aiErr: any) {
        console.error(`[YT_AI_ERROR] ${aiErr.message}`);
      }

      throw new Error(`Semua metode YouTube gagal. Coba upload file audionya langsung.`);
    }

    // ===== 2. RAW TEXT / CATATAN =====
    const rawText = formData.get('rawText') as string;
    if (rawText) {
      if (rawText.trim().length < 50) throw new Error("Catatan terlalu pendek! Minimal 50 karakter.");
      return NextResponse.json({ success: true, text: rawText.trim(), type: "note" });
    }

    // ===== 3. FILE EXTRACTION (PDF, Image, Audio, Video) =====
    const file = formData.get('file') as File;
    if (!file) return NextResponse.json({ error: "Input tidak valid." }, { status: 400 });

    const mime = file.type || "application/octet-stream";
    const fileSizeMB = file.size / (1024 * 1024);
    console.log(`📁 Processing: ${file.name} [${mime}] ${fileSizeMB.toFixed(2)}MB`);

    // Size limit: 15MB for inline data (Gemini limit)
    if (fileSizeMB > 15) {
      throw new Error(`File terlalu besar (${fileSizeMB.toFixed(1)}MB). Maksimal 15MB.`);
    }

    const arrayBuffer = await file.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString('base64');

    // ===== PDF → Gemini reads natively (no library needed!) =====
    if (mime === 'application/pdf') {
      console.log(`[PDF] Sending to Gemini for native PDF reading...`);
      const text = await extractWithGemini(
        base64Data,
        'application/pdf',
        `Ekstrak dan tuliskan SEMUA teks dari dokumen PDF ini secara lengkap dan akurat. 
Jangan ringkas, tuliskan semua konten teks yang ada di dokumen.
Jika ada tabel, pertahankan strukturnya. Jika ada heading, pertahankan.
Output HANYA teks dari PDF, tanpa komentar tambahan.`
      );
      return NextResponse.json({ success: true, text, type: "pdf" });
    }

    // ===== IMAGE → Gemini reads and describes =====
    const imageTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'image/heic'];
    if (imageTypes.includes(mime) || mime.startsWith('image/')) {
      console.log(`[IMAGE] Sending to Gemini for OCR/description...`);
      const text = await extractWithGemini(
        base64Data,
        mime,
        `Ekstrak semua teks yang ada di gambar ini (OCR). 
Jika gambar berisi diagram, grafik, atau ilustrasi, deskripsikan juga secara detail.
Jika ada rumus matematika, tuliskan dengan jelas.
Tulis dalam Bahasa Indonesia. Output HANYA konten dari gambar.`
      );
      return NextResponse.json({ success: true, text, type: "image" });
    }

    // ===== AUDIO → Gemini transcribes =====
    if (mime.startsWith('audio/')) {
      console.log(`[AUDIO] Sending to Gemini for transcription...`);
      const text = await extractWithGemini(
        base64Data,
        mime,
        `Transkripsi seluruh isi audio ini secara lengkap dan akurat dalam Bahasa Indonesia.
Jika ada bagian yang tidak jelas, tandai dengan [tidak jelas].
Output HANYA transkripsi, tanpa komentar atau penjelasan.`
      );
      return NextResponse.json({ success: true, text, type: "audio" });
    }

    // ===== VIDEO → Gemini transcribes =====
    if (mime.startsWith('video/')) {
      console.log(`[VIDEO] Sending to Gemini for transcription...`);
      const text = await extractWithGemini(
        base64Data,
        mime,
        `Transkripsi seluruh percakapan/narasi dari video ini secara lengkap dalam Bahasa Indonesia.
Jika ada teks visual penting di layar, sertakan juga.
Output HANYA transkripsi, tanpa komentar tambahan.`
      );
      return NextResponse.json({ success: true, text, type: "video" });
    }

    // ===== PLAIN TEXT / WORD-like files =====
    if (mime === 'text/plain' || mime === 'text/markdown' || mime === 'text/csv') {
      const text = new TextDecoder('utf-8').decode(arrayBuffer);
      if (!text.trim()) throw new Error("File teks kosong.");
      return NextResponse.json({ success: true, text: text.trim(), type: "text" });
    }

    throw new Error(`Format file '${mime}' tidak didukung. Format yang didukung: PDF, gambar (PNG/JPG/WEBP), audio (MP3/WAV), video (MP4), dan teks.`);

  } catch (err: any) {
    console.error(`[EXTRACT_ERROR] ${err.message}`);
    return NextResponse.json({ error: err.message || "Gagal memproses file." }, { status: 500 });
  }
}
