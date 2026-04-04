import { NextResponse } from 'next/server';
import { YoutubeTranscript } from 'youtube-transcript';
import { GoogleGenerativeAI } from "@google/generative-ai";

// Multi-Key Rotation
function getRandomGeminiKey(): string {
  const keysEnv = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || "";
  const keys = keysEnv.split(",").map((k) => k.trim()).filter(Boolean);
  if (keys.length === 0) throw new Error("Tidak ada API Key Gemini!");
  return keys[Math.floor(Math.random() * keys.length)];
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    // ===== 1. YOUTUBE =====
    const youtubeUrl = formData.get('youtubeUrl') as string;
    if (youtubeUrl) {
      console.log("📺 Analyzing Youtube Video:", youtubeUrl);
      const transcriptList = await YoutubeTranscript.fetchTranscript(youtubeUrl);
      const text = transcriptList.map(t => t.text).join(' ');
      if (!text) throw new Error("Video ini tidak memiliki subtitle/transkrip. Coba video lain!");
      return NextResponse.json({ success: true, text, type: "youtube" });
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
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      if (typeof global !== "undefined" && !global.DOMMatrix) {
        (global as any).DOMMatrix = class DOMMatrix {};
      }

      const { PDFParse } = require('pdf-parse');
      const parser = new PDFParse({ data: buffer });
      const pdfData = await parser.getText();
      await parser.destroy();

      return NextResponse.json({ success: true, text: pdfData.text, type: "pdf" });
    }

    // ===== AUDIO (mp3, wav, m4a, ogg, webm) =====
    const isAudio = mime.startsWith('audio/') || ['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/ogg', 'audio/webm'].includes(mime);
    // ===== VIDEO (mp4, mov, webm, avi) =====
    const isVideo = mime.startsWith('video/');

    if (isAudio || isVideo) {
      const fileSizeMB = file.size / (1024 * 1024);
      if (fileSizeMB > 50) {
        throw new Error(`File terlalu besar (${fileSizeMB.toFixed(1)}MB). Maksimal 50MB untuk audio/video.`);
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
