import { NextResponse } from 'next/server';
import { YoutubeTranscript } from 'youtube-transcript';
import { GoogleGenerativeAI } from "@google/generative-ai";

// Increase body size limit for Vercel (allow up to 10MB)
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

// Vercel Edge: increase payload size for Next.js App Router
export const maxDuration = 60; // seconds

// ====== SMART CACHE (in-memory, survives warm Vercel instances) ======
// Cache stores results for 24 hours — same URL never processed twice!
const resultCache = new Map<string, { text: string; type: string; cachedAt: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

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

// ====== PER-KEY QUOTA TRACKER ======
// Track last request time per key to enforce minimum spacing
const keyLastUsed = new Map<string, number>();
const MIN_KEY_INTERVAL_MS = 500; // min 0.5s between requests per key


// Get all keys as array
function getAllGeminiKeys(): string[] {
  const keysEnv = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || "";
  const keys = keysEnv.split(",").map((k) => k.trim()).filter(Boolean);
  if (keys.length === 0) throw new Error("Tidak ada API Key Gemini!");
  return keys;
}

function getRandomGeminiKey(): string {
  const keys = getAllGeminiKeys();
  return keys[Math.floor(Math.random() * keys.length)];
}

// Try Gemini with all keys in sequence until one works
async function geminiWithFallback(parts: any[], modelName = "gemini-1.5-flash"): Promise<string> {
  const keys = getAllGeminiKeys();
  let lastError: any;

  for (const key of keys) {
    // Throttle: ensure minimum time between requests on same key
    const lastUsed = keyLastUsed.get(key) || 0;
    const waitMs = MIN_KEY_INTERVAL_MS - (Date.now() - lastUsed);
    if (waitMs > 0) await new Promise(r => setTimeout(r, waitMs));

    try {
      keyLastUsed.set(key, Date.now());
      const genAI = new GoogleGenerativeAI(key);
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(parts);
      return result.response.text();
    } catch (err: any) {
      lastError = err;
      const msg = err?.message || '';
      // If quota/rate error, try next key after brief wait
      if (msg.includes('429') || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('rate')) {
        console.warn(`⚠️ Key quota exceeded, trying next key...`);
        await new Promise(r => setTimeout(r, 1000)); // wait 1s before next key
        continue;
      }
      throw err;
    }
  }
  throw new Error(`Semua API key habis kuota. Coba lagi dalam 1-2 menit. (${lastError?.message})`);
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    // ===== 1. YOUTUBE =====
    const youtubeUrl = formData.get('youtubeUrl') as string;
    if (youtubeUrl) {
      // ⚡ CACHE CHECK — same URL within 24h = instant result, no API call!
      const cached = getCached(youtubeUrl);
      if (cached) {
        console.log("⚡ Cache HIT for:", youtubeUrl);
        return NextResponse.json({ success: true, text: cached.text, type: cached.type, fromCache: true });
      }

      console.log("📺 Strategy 1 - Try youtube-transcript:", youtubeUrl);

      // Strategy 1: Try subtitle extraction with multiple language fallbacks
      const langs = ['id', 'id-ID', 'en', 'en-US', 'a.id', 'a.en'];
      for (const lang of langs) {
        try {
          const transcriptList = await YoutubeTranscript.fetchTranscript(youtubeUrl, { lang });
          const text = transcriptList.map(t => t.text).join(' ');
          if (text && text.trim().length > 20) {
            console.log(`✅ Transcript fetched via lang: ${lang}`);
            setCache(youtubeUrl, text, 'youtube'); // 💾 Cache result!
            return NextResponse.json({ success: true, text, type: "youtube" });
          }
        } catch (_) {
          // try next lang
        }
      }

      // Strategy 2: Use Gemini's native YouTube video understanding via fileData
      console.log("📺 Strategy 2 - Gemini native YouTube analysis...");
      try {
        const ytPrompt = `Kamu adalah asisten belajar AI. Tonton video YouTube ini dan lakukan hal berikut:
1. Transkripsi semua yang dibicarakan secara lengkap (dalam Bahasa Indonesia).
2. Jika pembicaraan dalam bahasa lain, terjemahkan ke Bahasa Indonesia.
3. Tulis secara rapi dan urut sesuai alur video.
Jangan tambahkan opini, hanya isi konten yang dibicarakan di video ini.`;

        const text = await geminiWithFallback([
          { text: ytPrompt },
          {
            fileData: {
              mimeType: "video/mp4",
              fileUri: youtubeUrl,
            }
          }
        ], "gemini-1.5-flash");

        if (text && text.trim().length > 20) {
          setCache(youtubeUrl, text, 'youtube'); // 💾 Cache Gemini result too!
          return NextResponse.json({ success: true, text, type: "youtube" });
        }
      } catch (geminiErr: any) {
        console.error("Gemini YouTube fallback error:", geminiErr.message);
      }

      throw new Error("❌ Video tidak dapat diproses. Kemungkinan video bersifat privat, tidak tersedia, atau semua API key sedang di-cooldown. Coba lagi dalam 1 menit.");
    }

    // ===== 2. TEXT (dari Tulis Catatan) =====
    const rawText = formData.get('rawText') as string;
    if (rawText) {
      if (rawText.trim().length < 50) {
        throw new Error("Catatan terlalu pendek! Minimal 50 karakter agar AI bisa merangkum.");
      }
      return NextResponse.json({ success: true, text: rawText.trim(), type: "note" });
    }

    // ===== 3. FILE (PDF / Audio / Video) =====
    const file = formData.get('file') as File;
    if (!file) {
      return NextResponse.json({ error: "Tidak ada file atau sumber yang diberikan" }, { status: 400 });
    }

    const mime = file.type;
    console.log(`📁 Processing file: ${file.name} [${mime}]`);

    // ===== PDF =====
    if (mime === 'application/pdf') {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const pdfParse = require('pdf-parse');
        const pdfData = await pdfParse(buffer);
        const text = pdfData.text || '';
        if (!text.trim()) throw new Error('PDF tidak memiliki teks yang bisa dibaca. Mungkin PDF berupa gambar/scan.');
        return NextResponse.json({ success: true, text, type: "pdf" });
      } catch (pdfErr: any) {
        throw new Error(`❌ Gagal membaca PDF: ${pdfErr.message}. Pastikan PDF berisi teks (bukan gambar scan).`);
      }
    }

    // ===== AUDIO (mp3, wav, m4a, ogg, webm) =====
    const isAudio = mime.startsWith('audio/') || ['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/ogg', 'audio/webm'].includes(mime);
    // ===== VIDEO (mp4, mov, webm, avi) =====
    const isVideo = mime.startsWith('video/');

    if (isAudio || isVideo) {
      const fileSizeMB = file.size / (1024 * 1024);
      if (fileSizeMB > 9) {
        throw new Error(`❌ File terlalu besar (${fileSizeMB.toFixed(1)}MB). Batas maksimal adalah 9MB untuk audio/video di platform ini. Coba kompres file atau gunakan YouTube.`);
      }

      console.log(`🎵 Transcribing ${isAudio ? 'audio' : 'video'} via Gemini...`);

      // Convert to base64 for Gemini inline data
      const arrayBuffer = await file.arrayBuffer();
      const base64Data = Buffer.from(arrayBuffer).toString('base64');

      const apiKey = getRandomGeminiKey();
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      const prompt = isAudio
        ? `Kamu adalah transkriptor profesional. Transkripsi seluruh isi audio ini secara lengkap dan akurat. Jangan tambahkan komentar, cukup tuliskan teks transkrip saja. Jika ada beberapa pembicara, tandai dengan "Pembicara 1:", "Pembicara 2:", dst.`
        : `Kamu adalah transkriptor profesional. Transkripsi seluruh konten yang dibicarakan dalam video ini secara lengkap. Tulis semua yang diucapkan secara verbatim. Jika ada beberapa pembicara, tandai dengan nama atau "Pembicara 1:", "Pembicara 2:", dst. Jangan tambahkan komentar lain.`;

      const result = await model.generateContent([
        { text: prompt },
        {
          inlineData: {
            mimeType: mime,
            data: base64Data,
          }
        }
      ]);

      const transcribedText = result.response.text();
      if (!transcribedText || transcribedText.length < 20) {
        throw new Error("Tidak bisa mentranskripsi file ini. Pastikan ada suara yang jelas di dalamnya.");
      }

      return NextResponse.json({
        success: true,
        text: transcribedText,
        type: isAudio ? "audio" : "video",
      });
    }

    return NextResponse.json({ error: `Format file '${mime}' tidak didukung. Gunakan PDF, MP3, WAV, MP4, atau MOV.` }, { status: 400 });

  } catch (err: any) {
    console.error("Extractor Error:", err);
    return NextResponse.json({ error: err.message || "Gagal memproses file" }, { status: 500 });
  }
}
