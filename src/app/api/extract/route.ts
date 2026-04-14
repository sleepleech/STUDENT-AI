/**
 * Nata Sensei — File Extraction API
 * 
 * Supports: PDF, Images (PNG/JPG/WEBP), Audio (MP3/WAV/M4A), Video (MP4/MOV), YouTube, Plain Text
 * 
 * PDF/Audio/Video strategy: Gemini File API (upload → process)
 *   - Bypasses ALL DOMMatrix / browser-API issues
 *   - More reliable than inline data for large files
 *   - Official recommended approach by Google
 * 
 * Images strategy: Gemini inline data (small files, fast)
 * YouTube strategy: youtubeTranscript → AI reconstruction fallback
 */

import { NextResponse } from 'next/server';
import { YoutubeTranscript } from 'youtube-transcript';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { generateWithFallback } from "@/lib/ai/provider";

export const maxDuration = 60;

// ── Cache ────────────────────────────────────────────────────────────────────
const resultCache = new Map<string, { text: string; type: string; cachedAt: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000;

function getCached(key: string) {
  const e = resultCache.get(key);
  if (!e) return null;
  if (Date.now() - e.cachedAt > CACHE_TTL) { resultCache.delete(key); return null; }
  return e;
}
function setCache(key: string, text: string, type: string) {
  resultCache.set(key, { text, type, cachedAt: Date.now() });
}

// ── Gemini Key Pool ───────────────────────────────────────────────────────────
function getGeminiKeys(): string[] {
  return (process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '')
    .split(',').map(k => k.trim()).filter(Boolean);
}

// ── Gemini File API — Step 1: Upload ─────────────────────────────────────────
/**
 * Upload a file to Gemini Files API via resumable upload.
 * Returns { fileUri, fileName } when the file is ACTIVE and ready.
 * 
 * Docs: https://ai.google.dev/gemini-api/docs/file-prompting-strategies
 */
async function uploadToGeminiFiles(
  apiKey: string,
  buffer: Buffer,
  mimeType: string,
  displayName: string
): Promise<{ fileUri: string; fileName: string }> {
  const numBytes = buffer.length;

  // ── Init resumable upload ──
  const initRes = await fetch(
    `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'X-Goog-Upload-Protocol': 'resumable',
        'X-Goog-Upload-Command': 'start',
        'X-Goog-Upload-Header-Content-Length': String(numBytes),
        'X-Goog-Upload-Header-Content-Type': mimeType,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ file: { display_name: displayName } }),
    }
  );

  if (!initRes.ok) {
    const errBody = await initRes.text();
    throw new Error(`Upload init failed (${initRes.status}): ${errBody.slice(0, 200)}`);
  }

  const uploadUrl = initRes.headers.get('X-Goog-Upload-URL');
  if (!uploadUrl) throw new Error('Gemini returned no upload URL in headers');

  // ── Upload file bytes ──
  const uploadRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'X-Goog-Upload-Offset': '0',
      'X-Goog-Upload-Command': 'upload, finalize',
    },
    body: new Uint8Array(buffer),
  });

  if (!uploadRes.ok) {
    const errBody = await uploadRes.text();
    throw new Error(`File upload failed (${uploadRes.status}): ${errBody.slice(0, 200)}`);
  }

  const fileData = (await uploadRes.json()) as any;
  const fileUri: string = fileData?.file?.uri;
  const fileName: string = fileData?.file?.name;
  let state: string = fileData?.file?.state ?? 'UNKNOWN';

  if (!fileUri || !fileName) {
    throw new Error(`No file URI/name in Gemini response: ${JSON.stringify(fileData).slice(0, 200)}`);
  }

  // ── Wait for ACTIVE state (usually instant for PDF/audio) ──
  let attempts = 0;
  while (state !== 'ACTIVE' && state !== 'FAILED' && attempts < 20) {
    await new Promise(r => setTimeout(r, 1500));
    const pollRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${apiKey}`
    );
    const pollData = (await pollRes.json()) as any;
    state = pollData?.state ?? state;
    attempts++;
    console.log(`[GeminiFile] State: ${state} (attempt ${attempts})`);
  }

  if (state !== 'ACTIVE') {
    throw new Error(`File not ready after ${attempts} polls (state: ${state})`);
  }

  return { fileUri, fileName };
}

// ── Gemini File API — Step 2: Generate ───────────────────────────────────────
async function generateFromFile(
  apiKey: string,
  fileUri: string,
  mimeType: string,
  prompt: string
): Promise<string> {
  // Use gemini-1.5-flash — proven to support all media types including PDF
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { file_data: { mime_type: mimeType, file_uri: fileUri } }
          ]
        }],
        generation_config: { temperature: 0.1, max_output_tokens: 8192 }
      }),
    }
  );

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Gemini generate failed (${res.status}): ${errBody.slice(0, 200)}`);
  }

  const data = (await res.json()) as any;
  const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    const blockReason = data?.promptFeedback?.blockReason;
    if (blockReason) throw new Error(`Content blocked by Gemini: ${blockReason}`);
    throw new Error(`Gemini returned empty content. Response: ${JSON.stringify(data).slice(0, 150)}`);
  }

  return text;
}

// ── Cleanup ───────────────────────────────────────────────────────────────────
function deleteGeminiFile(apiKey: string, fileName: string) {
  fetch(`https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${apiKey}`, {
    method: 'DELETE'
  }).catch(() => { /* always safe to ignore */ });
}

// ── Main Extraction (File API with key rotation) ──────────────────────────────
async function extractWithFileAPI(
  buffer: Buffer,
  mimeType: string,
  originalName: string,
  prompt: string
): Promise<string> {
  const keys = getGeminiKeys();
  if (keys.length === 0) {
    throw new Error('GEMINI_API_KEYS tidak dikonfigurasi di environment variables.');
  }

  const shuffled = [...keys].sort(() => Math.random() - 0.5);
  const errors: string[] = [];

  for (const key of shuffled) {
    let fileName: string | null = null;
    try {
      const sizeMB = (buffer.length / 1048576).toFixed(2);
      console.log(`[Extract] Uploading "${originalName}" (${sizeMB}MB, ${mimeType}) → Gemini key ...${key.slice(-6)}`);

      const upload = await uploadToGeminiFiles(key, buffer, mimeType, originalName);
      fileName = upload.fileName;

      const text = await generateFromFile(key, upload.fileUri, mimeType, prompt);
      deleteGeminiFile(key, upload.fileName); // cleanup async

      if (text.trim().length > 10) {
        console.log(`✅ [Extract] Success with key ...${key.slice(-6)}`);
        return text.trim();
      }

      console.warn(`[Extract] Empty response from key ...${key.slice(-6)}`);
    } catch (err: any) {
      const msg: string = err?.message || String(err);
      console.error(`❌ [Extract] key ...${key.slice(-6)}: ${msg.slice(0, 200)}`);
      errors.push(`...${key.slice(-6)}: ${msg.slice(0, 100)}`);
      if (fileName) deleteGeminiFile(key, fileName);
    }
  }

  throw new Error(`Semua ${keys.length} kunci Gemini gagal. Errors:\n${errors.join('\n')}`);
}

// ── YouTube OEmbed ────────────────────────────────────────────────────────────
async function getYouTubeTitle(url: string): Promise<string> {
  try {
    const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
    if (!res.ok) return 'Video YouTube';
    const data = (await res.json()) as any;
    return data?.title || 'Video YouTube';
  } catch {
    return 'Video YouTube';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN ROUTE HANDLER
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    // ════════════════════════════════════════
    // 1. YOUTUBE
    // ════════════════════════════════════════
    const youtubeUrl = formData.get('youtubeUrl') as string;
    if (youtubeUrl) {
      const cached = getCached(youtubeUrl);
      if (cached) {
        return NextResponse.json({ success: true, ...cached, fromCache: true });
      }

      console.log(`[YouTube] Processing: ${youtubeUrl}`);

      // Strategy A: Official transcript API
      let transcriptText = '';
      const langs = ['id', 'en', 'id-ID', 'en-US', 'a.id', 'a.en'];
      for (const lang of langs) {
        try {
          const list = await YoutubeTranscript.fetchTranscript(youtubeUrl, { lang });
          transcriptText = list.map(t => t.text).join(' ').trim();
          if (transcriptText.length > 200) {
            console.log(`[YouTube] Transcript found (lang=${lang}, ${transcriptText.length} chars)`);
            break;
          }
        } catch { /* try next lang */ }
      }

      if (transcriptText.length > 200) {
        setCache(youtubeUrl, transcriptText, 'youtube');
        return NextResponse.json({ success: true, text: transcriptText, type: 'youtube' });
      }

      // Strategy B: AI knowledge reconstruction (uses DeepSeek/OpenRouter/Gemini)
      console.log(`[YouTube] No transcript found. Using AI reconstruction...`);
      const title = await getYouTubeTitle(youtubeUrl);

      try {
        const reconstructed = await generateWithFallback(
          `Buatlah konten belajar yang SANGAT LENGKAP dan MENDALAM (minimal 800 kata) berdasarkan video YouTube ini:

Judul: "${title}"
URL: ${youtubeUrl}

Instruksi:
1. Jika kamu mengenali video ini, jelaskan isinya secara akurat dan mendalam
2. Jika tidak, buat materi belajar berkualitas tinggi berdasarkan topik dari judulnya
3. Sertakan: penjelasan konsep, contoh, poin-poin penting, dan kesimpulan
4. Gunakan Bahasa Indonesia yang jelas dan mudah dipahami siswa
5. Mulai dengan heading: "# Materi: ${title}"`,
          "Kamu adalah Nata Sensei, tutor AI terbaik yang membantu siswa memahami materi dengan cara yang menarik."
        );
        setCache(youtubeUrl, reconstructed, 'youtube');
        return NextResponse.json({ success: true, text: reconstructed, type: 'youtube', isReconstruction: true });
      } catch (aiErr: any) {
        throw new Error(`Gagal memproses video YouTube. Transkrip tidak tersedia dan AI gagal: ${aiErr.message}. Coba upload file audio/video langsung.`);
      }
    }

    // ════════════════════════════════════════
    // 2. RAW TEXT / CATATAN
    // ════════════════════════════════════════
    const rawText = formData.get('rawText') as string;
    if (rawText) {
      if (rawText.trim().length < 50) {
        throw new Error("Catatan terlalu pendek. Minimal 50 karakter agar AI bisa memproses.");
      }
      return NextResponse.json({ success: true, text: rawText.trim(), type: 'note' });
    }

    // ════════════════════════════════════════
    // 3. FILE UPLOAD
    // ════════════════════════════════════════
    const file = formData.get('file') as File;
    if (!file) {
      return NextResponse.json({ error: "Tidak ada file yang diterima." }, { status: 400 });
    }

    const mime = file.type || 'application/octet-stream';
    const sizeMB = file.size / 1048576;
    console.log(`[File] "${file.name}" [${mime}] ${sizeMB.toFixed(2)}MB`);

    if (sizeMB > 20) {
      throw new Error(`File terlalu besar (${sizeMB.toFixed(1)}MB). Maksimal 20MB.`);
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // ── PDF ──────────────────────────────────
    if (mime === 'application/pdf') {
      const text = await extractWithFileAPI(
        buffer, mime, file.name,
        `Kamu adalah sistem ekstraksi teks profesional.

Tugas: Ekstrak SEMUA teks dari dokumen PDF ini secara LENGKAP dan AKURAT.

Aturan:
- Salin semua teks apa adanya, jangan ringkas
- Pertahankan struktur: heading, paragraf, daftar, tabel
- Jika ada tabel, tampilkan dalam format yang rapi
- Jika ada rumus/persamaan, tuliskan dengan jelas
- Jangan tambahkan komentar atau penjelasan, hanya teks dari PDF

Mulai ekstraksi:`
      );
      return NextResponse.json({ success: true, text, type: 'pdf' });
    }

    // ── IMAGES ───────────────────────────────
    if (mime.startsWith('image/')) {
      // Images are typically small → use inline data (faster than File API)
      const keys = getGeminiKeys();
      const shuffled = [...keys].sort(() => Math.random() - 0.5);
      const base64 = buffer.toString('base64');

      for (const key of shuffled) {
        try {
          const genAI = new GoogleGenerativeAI(key);
          const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
          const result = await model.generateContent([
            {
              text: `Ekstrak semua teks dari gambar ini.
Jika ada diagram atau ilustrasi, deskripsikan secara detail.
Jika ada rumus matematika/fisika/kimia, tuliskan dengan jelas.
Tulis output dalam Bahasa Indonesia.`
            },
            { inlineData: { mimeType: mime, data: base64 } }
          ]);
          const text = result.response.text();
          if (text?.trim()) {
            return NextResponse.json({ success: true, text: text.trim(), type: 'image' });
          }
        } catch (e: any) {
          console.warn(`[Image] Key ...${key.slice(-6)} failed: ${e.message?.slice(0, 80)}`);
        }
      }

      // Fallback: try File API for images too
      const text = await extractWithFileAPI(
        buffer, mime, file.name,
        "Ekstrak semua teks dari gambar ini. Deskripsikan diagram/grafik jika ada. Tulis dalam Bahasa Indonesia."
      );
      return NextResponse.json({ success: true, text, type: 'image' });
    }

    // ── AUDIO ────────────────────────────────
    if (mime.startsWith('audio/')) {
      const text = await extractWithFileAPI(
        buffer, mime, file.name,
        `Transkripsi seluruh audio ini secara LENGKAP dan AKURAT dalam Bahasa Indonesia.

Aturan:
- Tuliskan semua yang diucapkan
- Jika ada bagian tidak jelas, tulis [tidak jelas] atau [...]
- Pertahankan pemisah kalimat yang natural
- Jangan ringkas — tuliskan semua

Output hanya transkripsi:`
      );
      return NextResponse.json({ success: true, text, type: 'audio' });
    }

    // ── VIDEO ────────────────────────────────
    if (mime.startsWith('video/')) {
      const text = await extractWithFileAPI(
        buffer, mime, file.name,
        `Transkripsi semua percakapan dan narasi dari video ini dalam Bahasa Indonesia.

Aturan:
- Tuliskan semua dialog dan narasi yang diucapkan
- Jika ada teks penting di layar (judul slide, caption), sertakan dalam [layar: ...]
- Pertahankan urutan dan konteks
- Jangan ringkas

Output hanya transkripsi:`
      );
      return NextResponse.json({ success: true, text, type: 'video' });
    }

    // ── PLAIN TEXT ───────────────────────────
    const textMimes = ['text/plain', 'text/markdown', 'text/csv', 'application/json'];
    if (textMimes.includes(mime) || mime.startsWith('text/')) {
      const text = new TextDecoder('utf-8').decode(arrayBuffer);
      if (!text.trim()) throw new Error("File teks kosong.");
      return NextResponse.json({ success: true, text: text.trim(), type: 'text' });
    }

    // ── UNSUPPORTED ──────────────────────────
    throw new Error(
      `Format "${mime}" tidak didukung.\n\nFormat yang didukung:\n• PDF (application/pdf)\n• Gambar: PNG, JPG, WEBP, GIF\n• Audio: MP3, WAV, M4A, OGG\n• Video: MP4, MOV, AVI, MKV\n• Teks: TXT, MD, CSV`
    );

  } catch (err: any) {
    const message = err?.message || 'Terjadi kesalahan internal.';
    console.error(`[EXTRACT_FINAL_ERROR] ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
