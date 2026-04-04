"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMaterialStore, selectActiveMaterial } from "@/store/useMaterialStore";
import { FlashcardsDeck } from "@/components/study/flashcards-deck";
import { QuizArena } from "@/components/study/quiz-arena";
import { ChatPanel } from "@/components/study/chat-panel";
import { BookOpen, Layers, Swords, ArrowLeft, MessageSquare, Upload } from "lucide-react";
import Link from "next/link";

type Tab = "summary" | "flashcards" | "quiz" | "chat";

const tabs = [
  { id: "summary" as Tab, label: "Summary", icon: BookOpen, color: "text-primary" },
  { id: "flashcards" as Tab, label: "Flashcards", icon: Layers, color: "text-secondary" },
  { id: "quiz" as Tab, label: "Quiz Arena", icon: Swords, color: "text-destructive" },
  { id: "chat" as Tab, label: "Tanya Sensei", icon: MessageSquare, color: "text-green-400" },
];

export default function StudyRoomPage() {
  const router = useRouter();
  const activeMaterial = useMaterialStore(selectActiveMaterial);
  const { deleteMaterial, clearExpired } = useMaterialStore();
  const [tab, setTab] = useState<Tab>("summary");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    clearExpired();
  }, []);

  // Show empty state if no material loaded
  if (!mounted) return null;

  if (!activeMaterial) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center">
        <div className="w-20 h-20 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center purple-glow">
          <BookOpen size={36} className="text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Ruang Belajar Kosong</h1>
          <p className="text-muted-foreground text-sm max-w-xs">
            Upload materi dari Dashboard dulu agar Nata Sensei bisa menyiapkan modul belajarmu!
          </p>
        </div>
        <Link
          href="/"
          className="flex items-center gap-2 bg-primary text-white font-semibold px-6 py-3 rounded-2xl hover:bg-primary/90 transition-all purple-glow"
        >
          <Upload size={16} /> Upload Materi
        </Link>
      </div>
    );
  }

  const { summary, flashcards, quiz } = activeMaterial;

  return (
    <div className="flex flex-col w-full max-w-5xl mx-auto pb-20">

      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/" className="p-2 bg-accent hover:bg-accent/80 rounded-xl transition-colors text-muted-foreground hover:text-foreground">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold text-primary tracking-widest mb-0.5 uppercase">
            Nata Sensei's Dojo
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground truncate">
            {summary?.title || "Materi Pembelajaran"}
          </h1>
        </div>
        {/* Saved timestamp + clear button */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          {activeMaterial.savedAt && (
            <span className="text-xs text-muted-foreground">
              💾 {new Date(activeMaterial.savedAt).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          <button
            onClick={() => { deleteMaterial(activeMaterial.id); router.push("/"); }}
            className="text-xs text-destructive hover:text-destructive/80 transition-colors"
          >
            Hapus materi
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex p-1 bg-accent/50 rounded-2xl border border-border mb-6 overflow-x-auto gap-1">
        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap flex-1 justify-center ${
                isActive
                  ? "bg-card shadow-sm text-foreground border border-border"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
            >
              <Icon size={15} className={isActive ? t.color : ""} />
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="w-full">

        {/* SUMMARY */}
        {tab === "summary" && summary && (
          <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-400">
            <div className="bg-card p-6 rounded-2xl border border-border">
              <h2 className="text-lg font-bold mb-3 text-foreground">Ringkasan Materi</h2>
              <p className="text-muted-foreground leading-relaxed">{summary.summary}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="bg-primary/5 p-5 rounded-2xl border border-primary/20">
                <h3 className="font-bold text-primary mb-3 flex items-center gap-2 text-sm">
                  <span className="w-2 h-2 rounded-full bg-primary" /> Key Takeaways
                </h3>
                <ul className="space-y-2.5">
                  {summary.key_points?.map((pt: string, i: number) => (
                    <li key={i} className="flex gap-2.5 text-sm text-muted-foreground">
                      <span className="text-primary font-bold shrink-0">{i + 1}.</span>
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-secondary/5 p-5 rounded-2xl border border-secondary/20">
                <h3 className="font-bold text-secondary mb-3 flex items-center gap-2 text-sm">
                  <span className="w-2 h-2 rounded-full bg-secondary" /> Ultimate Cheat Sheet
                </h3>
                <div className="text-sm text-muted-foreground italic leading-relaxed bg-background/50 p-3 rounded-xl border border-border">
                  "{summary.cheat_sheet}"
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/20 rounded-2xl p-5 flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-foreground text-sm">Ada yang kurang jelas?</p>
                <p className="text-xs text-muted-foreground mt-0.5">Tanya langsung ke Nata Sensei AI!</p>
              </div>
              <button
                onClick={() => setTab("chat")}
                className="px-4 py-2 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 transition-all purple-glow shrink-0"
              >
                💬 Tanya Sensei
              </button>
            </div>
          </div>
        )}

        {/* FLASHCARDS */}
        {tab === "flashcards" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-400">
            <FlashcardsDeck cards={flashcards} />
          </div>
        )}

        {/* QUIZ */}
        {tab === "quiz" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-400">
            <QuizArena quiz={quiz} />
          </div>
        )}

        {/* CHAT */}
        {tab === "chat" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-400">
            <ChatPanel materialContext={summary} />
          </div>
        )}

      </div>
    </div>
  );
}
