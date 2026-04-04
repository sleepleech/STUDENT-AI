"use client";
import { useState, useCallback, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import {
  UploadCloud, Video, FileText, Loader2, Link as LinkIcon,
  Mic, PenLine, Clapperboard, Send
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMaterialStore } from "@/store/useMaterialStore";
import { useGameStore } from "@/store/useGameStore";

type TabType = "file" | "youtube" | "audio" | "video" | "note";

const SOURCE_TYPES: Record<TabType, "pdf" | "youtube" | "audio" | "video"> = {
  file: "pdf",
  youtube: "youtube",
  audio: "audio",
  video: "video",
  note: "pdf", // notes treated as pdf-like source
};

export function DropzoneCard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("file");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [noteText, setNoteText] = useState("");
  const [language, setLanguage] = useState<"Indonesian" | "English">("Indonesian");
  const { isProcessing, setProcessing, statusText, setActiveMaterial } = useMaterialStore();
  const { incrementMaterials } = useGameStore();

  // ===== PDF Drop =====
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    setProcessing(true, "Membaca dokumen PDF...");
    const formData = new FormData();
    formData.append("file", file);
    await processIngestion(formData, "pdf");
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
    disabled: isProcessing,
  });

  // ===== Audio Drop =====
  const onDropAudio = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    setProcessing(true, "Mengunggah audio untuk ditranskripsi...");
    const formData = new FormData();
    formData.append("file", file);
    await processIngestion(formData, "audio");
  }, []);

  const { getRootProps: getAudioRootProps, getInputProps: getAudioInputProps, isDragActive: isAudioDragActive } = useDropzone({
    onDrop: onDropAudio,
    accept: { "audio/*": [".mp3", ".wav", ".m4a", ".ogg", ".webm"] },
    maxFiles: 1,
    disabled: isProcessing,
  });

  // ===== Video Drop =====
  const onDropVideo = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    setProcessing(true, "Mengunggah video untuk ditranskripsi...");
    const formData = new FormData();
    formData.append("file", file);
    await processIngestion(formData, "video");
  }, []);

  const { getRootProps: getVideoRootProps, getInputProps: getVideoInputProps, isDragActive: isVideoDragActive } = useDropzone({
    onDrop: onDropVideo,
    accept: { "video/*": [".mp4", ".mov", ".webm", ".avi"] },
    maxFiles: 1,
    disabled: isProcessing,
  });

  // ===== YouTube =====
  const handleYoutubeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!youtubeUrl) return;
    setProcessing(true, "Menarik transkrip dari YouTube...");
    const formData = new FormData();
    formData.append("youtubeUrl", youtubeUrl);
    await processIngestion(formData, "youtube");
  };

  // ===== Tulis Catatan =====
  const handleNoteSubmit = async () => {
    if (!noteText.trim()) return;
    setProcessing(true, "Memproses catatanmu...");
    const formData = new FormData();
    formData.append("rawText", noteText);
    await processIngestion(formData, "pdf");
  };

  // ===== Core Ingestion Logic =====
  const processIngestion = async (formData: FormData, sourceType: "pdf" | "youtube" | "audio" | "video") => {
    try {
      const extractRes = await fetch("/api/extract", { method: "POST", body: formData });
      const extractData = await extractRes.json();
      if (!extractRes.ok) throw new Error(extractData.error);

      setProcessing(true, `✨ AI meracik materi dalam bahasa ${language}...`);
      const aiRes = await fetch("/api/process-material", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText: extractData.text, language }),
      });
      const aiData = await aiRes.json();
      if (!aiRes.ok) throw new Error(aiData.error);

      setActiveMaterial(aiData.data, sourceType);
      incrementMaterials();
      setProcessing(false, "Selesai!");
      router.push("/study-room");
    } catch (err: any) {
      alert("Gagal: " + err.message);
      setProcessing(false, "Gagal");
    }
  };

  const inputSources = [
    { id: "file" as TabType, label: "Upload File", icon: UploadCloud, desc: "PDF, DOCX, PPT", color: "text-primary" },
    { id: "youtube" as TabType, label: "YouTube", icon: Video, desc: "Video Link", color: "text-red-400" },
    { id: "audio" as TabType, label: "Audio", icon: Mic, desc: "MP3, WAV", color: "text-green-400" },
    { id: "video" as TabType, label: "Video", icon: Clapperboard, desc: "MP4, MOV", color: "text-blue-400" },
    { id: "note" as TabType, label: "Tulis Catatan", icon: PenLine, desc: "Mulai dari nol", color: "text-yellow-400" },
  ];

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden w-full">
      {/* Quick Action Bar */}
      <div className="px-6 pt-5 pb-3 border-b border-border">
        <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Buat baru:</p>
        <div className="flex flex-wrap gap-2">
          {inputSources.map((src) => {
            const Icon = src.icon;
            const isActive = activeTab === src.id;
            return (
              <button
                key={src.id}
                onClick={() => setActiveTab(src.id)}
                disabled={isProcessing}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                  isActive
                    ? "bg-primary/15 border-primary/40 text-primary"
                    : "border-border hover:border-accent hover:bg-accent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon size={15} className={isActive ? "text-primary" : src.color} />
                {src.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content Area */}
      <div className="p-6">
        <AnimatePresence mode="wait">

          {/* Processing State */}
          {isProcessing ? (
            <motion.div key="processing" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-14"
            >
              <div className="relative mb-6">
                <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center purple-glow">
                  <Loader2 className="animate-spin text-primary" size={28} />
                </div>
                <div className="absolute -inset-1 rounded-2xl bg-primary/10 animate-ping" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-1">System Processing</h3>
              <p className="text-sm text-muted-foreground">{statusText}</p>
            </motion.div>

          /* PDF Tab */
          ) : activeTab === "file" ? (
            <motion.div key="file" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 ${
                  isDragActive ? "border-primary bg-primary/10 scale-[1.01] purple-glow" : "border-border hover:border-primary/40 hover:bg-accent/30"
                }`}
              >
                <input {...getInputProps()} />
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                  <UploadCloud className="text-primary" size={26} />
                </div>
                <p className="text-sm font-semibold text-foreground mb-1">Drag & drop file PDF ke sini</p>
                <p className="text-xs text-muted-foreground">Atau klik untuk memilih lewat Explorer</p>
              </div>
            </motion.div>

          /* YouTube Tab */
          ) : activeTab === "youtube" ? (
            <motion.div key="youtube" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="py-4">
              <form onSubmit={handleYoutubeSubmit} className="flex flex-col gap-4">
                <div className="flex items-center gap-3 bg-accent/50 p-4 rounded-xl border border-border">
                  <LinkIcon className="text-muted-foreground shrink-0" size={20} />
                  <input type="url" required value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="flex-1 bg-transparent border-none outline-none text-sm text-foreground placeholder:text-muted-foreground"
                  />
                </div>
                <button type="submit" className="bg-primary hover:bg-primary/90 text-white font-semibold py-3 rounded-xl transition-all purple-glow">
                  ✨ Proses Video Ini
                </button>
              </form>
            </motion.div>

          /* Audio Tab */
          ) : activeTab === "audio" ? (
            <motion.div key="audio" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div
                {...getAudioRootProps()}
                className={`border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 ${
                  isAudioDragActive ? "border-green-400 bg-green-400/10 scale-[1.01]" : "border-border hover:border-green-400/40 hover:bg-accent/30"
                }`}
              >
                <input {...getAudioInputProps()} />
                <div className="w-14 h-14 rounded-2xl bg-green-400/10 flex items-center justify-center mb-4">
                  <Mic className="text-green-400" size={26} />
                </div>
                <p className="text-sm font-semibold text-foreground mb-1">Drag & drop file Audio ke sini</p>
                <p className="text-xs text-muted-foreground">MP3, WAV, M4A, OGG • Maks 50MB</p>
                <div className="mt-4 px-4 py-2 rounded-xl bg-green-400/10 border border-green-400/20">
                  <p className="text-xs text-green-400 font-medium">🎤 AI akan mentranskripsi audio lalu membuat ringkasan, flashcard & quiz!</p>
                </div>
              </div>
            </motion.div>

          /* Video Tab */
          ) : activeTab === "video" ? (
            <motion.div key="video" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div
                {...getVideoRootProps()}
                className={`border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 ${
                  isVideoDragActive ? "border-blue-400 bg-blue-400/10 scale-[1.01]" : "border-border hover:border-blue-400/40 hover:bg-accent/30"
                }`}
              >
                <input {...getVideoInputProps()} />
                <div className="w-14 h-14 rounded-2xl bg-blue-400/10 flex items-center justify-center mb-4">
                  <Clapperboard className="text-blue-400" size={26} />
                </div>
                <p className="text-sm font-semibold text-foreground mb-1">Drag & drop file Video ke sini</p>
                <p className="text-xs text-muted-foreground">MP4, MOV, WebM • Maks 50MB</p>
                <div className="mt-4 px-4 py-2 rounded-xl bg-blue-400/10 border border-blue-400/20">
                  <p className="text-xs text-blue-400 font-medium">🎬 AI akan menonton & mentranskripsi video lalu mengubahnya jadi modul belajar!</p>
                </div>
              </div>
            </motion.div>

          /* Tulis Catatan Tab */
          ) : activeTab === "note" ? (
            <motion.div key="note" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-col gap-4">
              <div className="relative">
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder={`Tulis atau tempel catatan / teks apapun di sini...\n\nContoh:\n• Tulis ringkasan dari buku yang kamu baca\n• Tempel artikel atau teks dari internet\n• Ketik materi dari buku teks\n\nNata Sensei akan mengubahnya jadi Flashcard & Quiz! ✨`}
                  className="w-full h-48 bg-accent/50 border border-border rounded-xl p-4 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-2 focus:ring-yellow-400/40 focus:border-yellow-400/50 resize-none transition-all leading-relaxed"
                />
                <div className="absolute bottom-3 right-3 text-xs text-muted-foreground">
                  {noteText.length} karakter
                </div>
              </div>
              <button
                onClick={handleNoteSubmit}
                disabled={noteText.trim().length < 50}
                className="flex items-center justify-center gap-2 bg-yellow-500 hover:bg-yellow-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-semibold py-3 rounded-xl transition-all"
              >
                <Send size={16} />
                {noteText.trim().length < 50 ? `Tulis minimal 50 karakter (${50 - noteText.trim().length} lagi)` : "✨ Proses Catatan Ini"}
              </button>
            </motion.div>
          ) : null}

        </AnimatePresence>
      </div>

      {/* Language Selector */}
      <div className="px-6 pb-5 flex items-center gap-3">
        <span className="text-xs font-semibold text-muted-foreground">Target Language:</span>
        <div className="flex bg-accent/50 p-1 rounded-full border border-border">
          {(["Indonesian", "English"] as const).map((lang) => (
            <button
              key={lang}
              onClick={() => setLanguage(lang)}
              className={`px-4 py-1 text-xs font-bold transition-all rounded-full ${
                language === lang
                  ? "bg-primary text-white shadow-sm purple-glow"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {lang === "Indonesian" ? "🇮🇩 Indonesian" : "🇬🇧 English"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
