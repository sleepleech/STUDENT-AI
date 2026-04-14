/**
 * Nata Sensei — File Extraction API v6
 *
 * PDF     → pdf2json (pure Node.js) → Gemini File API fallback
 * Audio   → Groq Whisper API        → Gemini File API fallback
 * Video   → Groq Whisper API        → Gemini File API fallback
 * Image   → Gemini inline (gemini-2.0-flash) → OpenRouter Claude fallback
 * YouTube → YoutubeTranscript       → DeepSeek/OpenRouter AI reconstruction
 * Text    → Direct decode
 *
 * Zero DOMMatrix, zero browser-only APIs, zero pdf-parse library.
 */

import { NextResponse } from 'next/server';
import { YoutubeTranscript } from 'youtube-transcript';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { generateWithFallback } from '@/lib/ai/provider';

export const maxDuration = 60;

// ─────────────────────────────────────────────────────────────────────────────
// CACHE
// ─────────────────────────────────────────────────────────────────────────────
const cache = new Map<string, { text: string; type: string; t: number }>();
const CACHE_TTL = 86_400_000; // 24h

function getCached(key: string) {
  const e = cache.get(key);
  if (!e) return null;
  if (Date.now() - e.t > CACHE_TTL) { cache.delete(key); return null; }
  return e;
}
function setCache(key: string, text: string, type: string) {
  cache.set(key, { text, type, t: Date.now() });
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function geminiKeys(): string[] {
  return (process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '')
    .split(',').map(k => k.trim()).filter(Boolean);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1.  PDF  ─ pdf2json (pure Node.js, NO browser APIs, NO Gemini needed)
// ─────────────────────────────────────────────────────────────────────────────
async function extractPDFLocal(buffer: Buffer): Promise<string> {
  // Dynamic require avoids ESM/CJS conflicts at build time
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const PDFParser = require('pdf2json');

  return new Promise<string>((resolve, reject) => {
    // Pass `1` as second arg → raw text mode (no HTML output)
    const parser = new PDFParser(null, 1);

    parser.on('pdfParser_dataReady', (data: any) => {
      try {
        const pages: any[] = data.Pages || [];
        const text = pages
          .map(pg =>
            (pg.Texts || [])
              .map((t: any) =>
                (t.R || []).map((r: any) => decodeURIComponent(r.T)).join('')
              )
              .join(' ')
          )
          .join('\n\n')
          .trim();

        if (!text) {
          reject(new Error('PDF tidak mengandung teks (mungkin PDF hasil scan/gambar).'));
        } else {
          resolve(text);
        }
      } catch (e: any) {
        reject(new Error(`PDF parse error: ${e.message}`));
      }
    });

    parser.on('pdfParser_dataError', (e: any) => {
      reject(new Error(`pdf2json: ${e?.parserError || JSON.stringify(e)}`));
    });

    parser.parseBuffer(buffer);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 2.  AUDIO / VIDEO  ─ Groq Whisper (free, fast, reliable)
// ─────────────────────────────────────────────────────────────────────────────
async function transcribeWithGroq(
  buffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY tidak dikonfigurasi.');

  const models = ['whisper-large-v3-turbo', 'whisper-large-v3'];

  for (const model of models) {
    try {
      console.log(`[Groq Whisper] Trying model: ${model}`);
      const blob = new Blob([new Uint8Array(buffer)], { type: mimeType });
      const form = new FormData();
      form.append('file', blob, fileName);
      form.append('model', model);
      form.append('response_format', 'text');
      // language omitted → auto-detect (supports Indonesian)

      const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText.slice(0, 150)}`);
      }

      const text = await res.text();
      if (text.trim()) {
        console.log(`✅ [Groq Whisper] Success with ${model}`);
        return text.trim();
      }
    } catch (err: any) {
      console.warn(`⚠️ [Groq Whisper] ${model} failed: ${err.message}`);
      if (model === models[models.length - 1]) throw err;
    }
  }

  throw new Error('Semua model Groq Whisper gagal.');
}

// ─────────────────────────────────────────────────────────────────────────────
// 3.  GEMINI FILE API  ─ fallback for all types (uses gemini-2.0-flash)
// ─────────────────────────────────────────────────────────────────────────────
async function uploadToGemini(
  apiKey: string,
  buffer: Buffer,
  mimeType: string,
  displayName: string
): Promise<{ fileUri: string; fileName: string }> {
  const numBytes = buffer.length;

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
    throw new Error(`Upload init ${initRes.status}: ${(await initRes.text()).slice(0, 150)}`);
  }

  const uploadUrl = initRes.headers.get('X-Goog-Upload-URL');
  if (!uploadUrl) throw new Error('No upload URL returned by Gemini');

  const uploadRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: { 'X-Goog-Upload-Offset': '0', 'X-Goog-Upload-Command': 'upload, finalize' },
    body: new Uint8Array(buffer),
  });

  if (!uploadRes.ok) {
    throw new Error(`Upload ${uploadRes.status}: ${(await uploadRes.text()).slice(0, 150)}`);
  }

  const data = (await uploadRes.json()) as any;
  const fileUri: string = data?.file?.uri;
  const fileName: string = data?.file?.name;
  let state: string = data?.file?.state ?? 'UNKNOWN';

  if (!fileUri || !fileName) {
    throw new Error(`No fileUri in response: ${JSON.stringify(data).slice(0, 150)}`);
  }

  // Poll until ACTIVE
  let attempts = 0;
  while (state !== 'ACTIVE' && state !== 'FAILED' && attempts < 20) {
    await new Promise(r => setTimeout(r, 1500));
    const poll = (await (
      await fetch(`https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${apiKey}`)
    ).json()) as any;
    state = poll?.state ?? state;
    attempts++;
  }

  if (state !== 'ACTIVE') throw new Error(`File not ready (state: ${state})`);
  return { fileUri, fileName };
}

async function generateFromFileURI(
  apiKey: string,
  fileUri: string,
  mimeType: string,
  prompt: string
): Promise<string> {
  // Try models in order — gemini-2.0-flash is current stable
  const models = ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-pro'];

  for (const model of models) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: prompt },
                { file_data: { mime_type: mimeType, file_uri: fileUri } },
              ],
            }],
            generation_config: { temperature: 0.1, max_output_tokens: 8192 },
          }),
        }
      );

      if (!res.ok) {
        const errText = await res.text();
        console.warn(`[Gemini] Model ${model} failed: ${res.status}`);
        if (res.status === 404) continue; // model not found → try next
        throw new Error(`${model} ${res.status}: ${errText.slice(0, 150)}`);
      }

      const data = (await res.json()) as any;
      const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text?.trim()) {
        console.log(`✅ [Gemini File API] Success with ${model}`);
        return text.trim();
      }
    } catch (err: any) {
      if (err.message.includes('404')) { continue; }
      throw err;
    }
  }

  throw new Error('All Gemini models returned 404 or empty response.');
}

function deleteGeminiFile(apiKey: string, fileName: string) {
  fetch(`https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${apiKey}`, {
    method: 'DELETE',
  }).catch(() => { });
}

async function extractWithGeminiFallback(
  buffer: Buffer,
  mimeType: string,
  fileName: string,
  prompt: string
): Promise<string> {
  const keys = geminiKeys();
  if (keys.length === 0) throw new Error('Tidak ada GEMINI_API_KEYS.');

  const shuffled = [...keys].sort(() => Math.random() - 0.5);
  const errors: string[] = [];

  for (const key of shuffled) {
    let fn: string | null = null;
    try {
      const { fileUri, fileName: gfn } = await uploadToGemini(key, buffer, mimeType, fileName);
      fn = gfn;
      const text = await generateFromFileURI(key, fileUri, mimeType, prompt);
      deleteGeminiFile(key, gfn);
      if (text) return text;
    } catch (err: any) {
      const msg = err.message || String(err);
      errors.push(`...${key.slice(-6)}: ${msg.slice(0, 80)}`);
      console.error(`❌ [GemFallback] ${msg.slice(0, 120)}`);
      if (fn) deleteGeminiFile(key, fn);
    }
  }

  throw new Error(`Gemini File API gagal semua key:\n${errors.join('\n')}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 4.  YOUTUBE OEMBED
// ─────────────────────────────────────────────────────────────────────────────
async function getYTTitle(url: string): Promise<string> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
    );
    if (!res.ok) return 'Video YouTube';
    const d = (await res.json()) as any;
    return d?.title || 'Video YouTube';
  } catch {
    return 'Video YouTube';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN HANDLER
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    // ══════════════════════════════════════
    // YOUTUBE
    // ══════════════════════════════════════
    const youtubeUrl = formData.get('youtubeUrl') as string;
    if (youtubeUrl) {
      const cached = getCached(youtubeUrl);
      if (cached) return NextResponse.json({ success: true, ...cached, fromCache: true });

      console.log(`[YT] ${youtubeUrl}`);

      // A: official transcript
      let transcriptText = '';
      for (const lang of ['id', 'en', 'id-ID', 'en-US', 'a.id', 'a.en']) {
        try {
          const list = await YoutubeTranscript.fetchTranscript(youtubeUrl, { lang });
          transcriptText = list.map(t => t.text).join(' ').trim();
          if (transcriptText.length > 200) break;
        } catch { /* try next lang */ }
      }

      if (transcriptText.length > 200) {
        setCache(youtubeUrl, transcriptText, 'youtube');
        return NextResponse.json({ success: true, text: transcriptText, type: 'youtube' });
      }

      // B: AI reconstruction (DeepSeek #1, OpenRouter #2, Gemini #3, ...)
      const title = await getYTTitle(youtubeUrl);
      try {
        const reconstructed = await generateWithFallback(
          `Buatlah materi belajar yang SANGAT LENGKAP dan MENDALAM (minimal 800 kata) berdasarkan video YouTube ini:\n\nJudul: "${title}"\nURL: ${youtubeUrl}\n\nInstruksi:\n1. Jelaskan konsep utama dari video secara mendalam\n2. Berikan contoh dan ilustrasi yang mudah dipahami\n3. Buat poin-poin penting yang perlu diingat\n4. Gunakan Bahasa Indonesia yang jelas\n5. Mulai dengan heading: "# Materi: ${title}"`,
          'Kamu adalah Nata Sensei, tutor AI terbaik yang membantu siswa memahami materi.'
        );
        setCache(youtubeUrl, reconstructed, 'youtube');
        return NextResponse.json({ success: true, text: reconstructed, type: 'youtube', isReconstruction: true });
      } catch (aiErr: any) {
        throw new Error(`YouTube gagal: transkrip tidak tersedia & AI gagal merekonstruksi. Coba upload file audio langsung.\nDetail: ${aiErr.message}`);
      }
    }

    // ══════════════════════════════════════
    // RAW TEXT
    // ══════════════════════════════════════
    const rawText = formData.get('rawText') as string;
    if (rawText) {
      if (rawText.trim().length < 50)
        throw new Error('Catatan terlalu pendek. Minimal 50 karakter.');
      return NextResponse.json({ success: true, text: rawText.trim(), type: 'note' });
    }

    // ══════════════════════════════════════
    // FILE
    // ══════════════════════════════════════
    const file = formData.get('file') as File;
    if (!file) return NextResponse.json({ error: 'Tidak ada file.' }, { status: 400 });

    const mime = file.type || 'application/octet-stream';
    const sizeMB = file.size / 1_048_576;
    console.log(`[File] "${file.name}" [${mime}] ${sizeMB.toFixed(2)}MB`);

    if (sizeMB > 20) throw new Error(`File terlalu besar (${sizeMB.toFixed(1)}MB). Maks 20MB.`);

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // ── PDF ────────────────────────────────
    if (mime === 'application/pdf') {
      let text = '';

      // Primary: pdf2json (pure Node.js, zero browser APIs)
      try {
        console.log('[PDF] Trying pdf2json (pure Node.js)...');
        text = await extractPDFLocal(buffer);
        console.log(`✅ [PDF] pdf2json success, ${text.length} chars`);
      } catch (pdfErr: any) {
        console.warn(`[PDF] pdf2json failed: ${pdfErr.message}. Trying Gemini fallback...`);

        // Fallback: Gemini File API
        text = await extractWithGeminiFallback(
          buffer, mime, file.name,
          `Ekstrak SEMUA teks dari PDF ini secara LENGKAP. Pertahankan struktur (heading, paragraf, tabel, daftar). Output HANYA teks dari PDF.`
        );
      }

      if (!text.trim()) throw new Error('Tidak ada teks yang dapat diekstrak dari PDF ini.');
      return NextResponse.json({ success: true, text, type: 'pdf' });
    }

    // ── IMAGE ──────────────────────────────
    if (mime.startsWith('image/')) {
      const base64 = buffer.toString('base64');
      const keys = geminiKeys();
      const shuffled = [...keys].sort(() => Math.random() - 0.5);

      for (const key of shuffled) {
        try {
          const genAI = new GoogleGenerativeAI(key);
          // Use gemini-2.0-flash (current stable model)
          const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
          const result = await model.generateContent([
            { text: 'Ekstrak semua teks dari gambar (OCR). Deskripsikan diagram/rumus jika ada. Tulis dalam Bahasa Indonesia.' },
            { inlineData: { mimeType: mime, data: base64 } },
          ]);
          const text = result.response.text();
          if (text?.trim()) return NextResponse.json({ success: true, text: text.trim(), type: 'image' });
        } catch (e: any) {
          console.warn(`[Image] Gemini key ...${key.slice(-6)} failed: ${e.message?.slice(0, 80)}`);
        }
      }

      // Fallback: Gemini File API
      const text = await extractWithGeminiFallback(
        buffer, mime, file.name,
        'Ekstrak semua teks dari gambar ini. Jika ada diagram atau rumus, deskripsikan secara detail. Tulis dalam Bahasa Indonesia.'
      );
      return NextResponse.json({ success: true, text, type: 'image' });
    }

    // ── AUDIO ──────────────────────────────
    if (mime.startsWith('audio/')) {
      if (sizeMB > 25) throw new Error('File audio maksimal 25MB.');

      let text = '';
      // Primary: Groq Whisper
      try {
        text = await transcribeWithGroq(buffer, mime, file.name);
      } catch (groqErr: any) {
        console.warn(`[Audio] Groq failed: ${groqErr.message}. Trying Gemini...`);
        text = await extractWithGeminiFallback(
          buffer, mime, file.name,
          'Transkripsi seluruh audio ini secara lengkap dalam Bahasa Indonesia. Output hanya transkripsi.'
        );
      }

      return NextResponse.json({ success: true, text, type: 'audio' });
    }

    // ── VIDEO ──────────────────────────────
    if (mime.startsWith('video/')) {
      if (sizeMB > 25) throw new Error('File video maksimal 25MB.');

      let text = '';
      // Primary: Groq Whisper (handles mp4 audio extraction natively)
      try {
        text = await transcribeWithGroq(buffer, mime, file.name);
      } catch (groqErr: any) {
        console.warn(`[Video] Groq failed: ${groqErr.message}. Trying Gemini...`);
        text = await extractWithGeminiFallback(
          buffer, mime, file.name,
          'Transkripsi semua dialog dan narasi dari video ini dalam Bahasa Indonesia. Sertakan teks layar penting dalam [layar: ...]. Output hanya transkripsi.'
        );
      }

      return NextResponse.json({ success: true, text, type: 'video' });
    }

    // ── PLAIN TEXT ─────────────────────────
    if (mime.startsWith('text/') || mime === 'application/json') {
      const text = new TextDecoder('utf-8').decode(arrayBuffer).trim();
      if (!text) throw new Error('File teks kosong.');
      return NextResponse.json({ success: true, text, type: 'text' });
    }

    throw new Error(
      `Format "${mime}" tidak didukung.\nFormat yang didukung: PDF, Gambar (PNG/JPG/WEBP), Audio (MP3/WAV/M4A), Video (MP4/MOV), Teks (TXT/MD).`
    );
  } catch (err: any) {
    const msg = err?.message || 'Terjadi kesalahan.';
    console.error(`[EXTRACT_ERROR] ${msg}`);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
