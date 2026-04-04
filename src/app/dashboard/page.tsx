"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { DropzoneCard } from "@/components/upload/dropzone-card";
import { useMaterialStore, MaterialItem } from "@/store/useMaterialStore";
import { useGameStore, getBelt, getLevel, getXPForNextBelt } from "@/store/useGameStore";
import { BookOpen, Flame, Trophy, Zap, FileText, Video, Trash2, Clock } from "lucide-react";
import { motion } from "framer-motion";
import { useAuthStore } from "@/store/useAuthStore";

function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "Baru saja";
  if (mins < 60) return `${mins} menit lalu`;
  if (hours < 24) return `${hours} jam lalu`;
  return `${days} hari lalu`;
}

function MaterialCard({ item, onOpen, onDelete }: { item: MaterialItem; onOpen: () => void; onDelete: () => void }) {
  const isYoutube = item.sourceType === 'youtube';
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card rounded-2xl border border-border overflow-hidden group cursor-pointer hover:border-primary/40 transition-all duration-200"
    >
      <div onClick={onOpen} className={`h-24 relative flex items-end p-3 ${isYoutube ? "bg-gradient-to-br from-red-500/15 via-red-400/5 to-transparent" : "bg-gradient-to-br from-primary/15 via-primary/5 to-transparent"}`}>
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isYoutube ? "bg-red-500/20" : "bg-primary/20"}`}>
          {isYoutube ? <Video size={14} className="text-red-400" /> : <FileText size={14} className="text-primary" />}
        </div>
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1" onClick={onOpen}>
            <span className={`text-xs font-semibold mb-1 inline-block ${isYoutube ? "text-red-400" : "text-primary"}`}>
              {isYoutube ? "YouTube" : "PDF Material"}
            </span>
            <h3 className="text-sm font-semibold text-foreground leading-tight line-clamp-2">{item.title}</h3>
          </div>
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0 opacity-0 group-hover:opacity-100">
            <Trash2 size={13} />
          </button>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2" onClick={onOpen}>
          <span className="flex items-center gap-1"><Clock size={10} />{timeAgo(item.savedAt)}</span>
          <span>📓 {item.flashcards?.length ?? 0} Kartu</span>
          <span>❓ {item.quiz?.length ?? 0} Soal</span>
        </div>
      </div>
    </motion.div>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const { materialHistory, loadMaterial, deleteMaterial, clearExpired } = useMaterialStore();
  const { xp, streak, todayXP, totalMaterialsProcessed, checkDailyLogin } = useGameStore();
  const { user } = useAuthStore();

  const displayHistory = user?.role === 'admin'
    ? materialHistory
    : materialHistory.filter(m => m.ownerId === user?.id);

  const belt = getBelt(xp);
  const level = getLevel(xp);
  const xpProgress = getXPForNextBelt(xp);

  useEffect(() => {
    clearExpired();
    checkDailyLogin();
  }, []);

  const stats = [
    { label: "Kartu Hari Ini", value: todayXP > 0 ? `+${todayXP} XP` : "0", sub: "Hari ini", icon: BookOpen, color: "text-primary", bg: "bg-primary/10" },
    { label: "Streak", value: `${streak} hari`, sub: streak > 0 ? "🔥 Terus semangat!" : "Mulai hari ini!", icon: Flame, color: "text-orange-400", bg: "bg-orange-400/10" },
    { label: "Level", value: `Lvl ${level}`, sub: `${xp} XP total`, icon: Zap, color: "text-secondary", bg: "bg-secondary/10" },
    { label: "Materi", value: `${totalMaterialsProcessed}`, sub: "Diproses AI", icon: Trophy, color: "text-yellow-400", bg: "bg-yellow-400/10" },
  ];

  const handleOpen = (item: MaterialItem) => {
    loadMaterial(item.id);
    router.push("/study-room");
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-4xl mx-auto pb-10 pt-4 px-4 md:px-0">

      {/* Greeting - CENTERED */}
      <div className="flex flex-col items-center text-center mb-4 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-black text-foreground flex items-center justify-center gap-2 mb-2">Halo, Pelajar! 👋</h1>
        <p className="text-xs md:text-sm text-muted-foreground/80 font-medium">
          {new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      {/* Stats Row - RESPONSIVE GRID */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-card/40 backdrop-blur-md border border-border/50 rounded-3xl p-3 md:p-4 flex flex-col items-center text-center hover:border-primary/30 transition-colors">
              <div className={`w-8 h-8 md:w-10 md:h-10 rounded-xl md:rounded-2xl flex items-center justify-center mb-2 md:mb-3 ${s.bg}`}>
                <Icon size={16} className={s.color} />
              </div>
              <p className="text-[10px] md:text-xs text-muted-foreground/80 font-medium mb-0.5 md:mb-1">{s.label}</p>
              <p className="text-sm md:text-lg font-black text-foreground">{s.value}</p>
              <p className="text-[8px] md:text-[10px] text-muted-foreground mt-0.5 md:mt-1">{s.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Upload Zone */}
      <div className="bg-card/30 backdrop-blur-sm rounded-3xl border border-border/50 overflow-hidden mt-6 mb-8 max-w-3xl mx-auto w-full">
        <div className="p-6 pb-4 text-center">
          <h2 className="text-lg font-bold text-foreground flex items-center justify-center gap-2">✨ Mulai Belajar dengan AI</h2>
          <p className="text-sm text-muted-foreground/80 mt-1 max-w-lg mx-auto">Upload materi belajarmu dan biarkan AI membuat catatan, flashcard, dan kuis otomatis secara instan.</p>
        </div>
        <div className="px-6 pb-6">
          <DropzoneCard />
        </div>
      </div>

      {/* Recent Materials */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-foreground">Recent Materials</h2>
          {displayHistory.length > 0 && (
            <span className="text-xs text-muted-foreground">{displayHistory.length} materi tersimpan</span>
          )}
        </div>
        {displayHistory.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-10 flex flex-col items-center text-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
              <BookOpen size={22} className="text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Belum ada materi</p>
              <p className="text-xs text-muted-foreground mt-1">Upload PDF atau link YouTube di atas untuk mulai belajar!</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {displayHistory.map((item) => (
              <MaterialCard key={item.id} item={item} onOpen={() => handleOpen(item)} onDelete={() => deleteMaterial(item.id)} />
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
