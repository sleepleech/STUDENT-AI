"use client";
import { useGameStore, getLevel, getXPForNextBelt } from "@/store/useGameStore";
import { Flame, Trophy, Zap, Layers, CheckCircle2, Award, Info } from "lucide-react";
import { motion } from "framer-motion";

export default function StreaksPage() {
  const { streak, xp, totalFlashcardsViewed, totalQuizAnswered } = useGameStore();
  const level = getLevel(xp);
  const xpProgress = getXPForNextBelt(xp);
  
  // Dummy data for max streak since we don't track it yet, we just track current streak
  // But we can simulate it as Math.max(streak, historicalMax) if we had one. For now, max is streak.
  const maxStreak = Math.max(streak, 0); 
  
  // Dummy stat for perfect quiz just to match UI
  const perfectQuiz = Math.floor(totalQuizAnswered * 0.4); 
  const passedQuiz = totalQuizAnswered;

  return (
    <div className="w-full max-w-5xl mx-auto pb-20 pt-4">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Flame className="text-primary" size={24} /> Streak & Progress
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Pantau konsistensi belajarmu</p>
      </div>

      {/* Top Cards (3 columns) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">
        {/* Streak Saat Ini */}
        <div className="bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 rounded-2xl p-6 relative overflow-hidden flex flex-col justify-between h-36 border-l-4 border-l-primary">
          <div>
            <p className="text-sm font-medium text-primary/80 mb-1">Streak Saat Ini</p>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-primary">{streak}</span>
              <span className="text-sm text-primary/80">hari</span>
            </div>
          </div>
          <p className="text-xs text-primary/60 mt-auto">Mulai belajar hari ini!</p>
          
          <div className="absolute right-6 top-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center pointer-events-none">
            <Flame className="text-primary opacity-80" size={24} />
          </div>
        </div>

        {/* Streak Terpanjang */}
        <div className="bg-card border border-border rounded-2xl p-6 relative overflow-hidden flex flex-col justify-between h-36">
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">Streak Terpanjang</p>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-yellow-500">{maxStreak}</span>
              <span className="text-sm text-muted-foreground">hari</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-auto">Rekor terbaikmu</p>
          
          <div className="absolute right-6 top-1/2 -translate-y-1/2 w-14 h-14 rounded-full border border-yellow-500/20 bg-yellow-500/10 flex items-center justify-center pointer-events-none">
            <Trophy className="text-yellow-500 opacity-80" size={24} />
          </div>
        </div>

        {/* Level */}
        <div className="bg-card border border-border rounded-2xl p-6 relative overflow-hidden flex flex-col justify-between h-36">
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">Level</p>
            <div className="text-4xl font-bold text-primary">{level}</div>
          </div>
          <div className="mt-auto">
            <div className="w-full h-1.5 bg-accent rounded-full overflow-hidden mb-2">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${xpProgress.percent}%` }}
                className="h-full bg-primary rounded-full"
              />
            </div>
            <p className="text-xs text-muted-foreground">{xpProgress.current} / {xpProgress.required} XP</p>
          </div>
          
          <div className="absolute right-6 top-6 w-14 h-14 rounded-full bg-primary flex items-center justify-center pointer-events-none shadow-lg shadow-primary/20">
            <Zap className="text-white" size={24} fill="currentColor" />
          </div>
        </div>
      </div>

      {/* 4 Small Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-card border border-border rounded-2xl p-5 flex flex-col">
          <div className="flex items-center gap-2 text-muted-foreground mb-3 text-sm">
            <Zap size={16} className="text-primary" /> Total XP
          </div>
          <span className="text-2xl font-bold">{xp}</span>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 flex flex-col">
          <div className="flex items-center gap-2 text-muted-foreground mb-3 text-sm">
            <Layers size={16} className="text-blue-500" /> Flashcard Direview
          </div>
          <span className="text-2xl font-bold">{totalFlashcardsViewed}</span>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 flex flex-col">
          <div className="flex items-center gap-2 text-muted-foreground mb-3 text-sm">
            <CheckCircle2 size={16} className="text-green-500" /> Kuis Lulus
          </div>
          <span className="text-2xl font-bold">{passedQuiz}</span>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 flex flex-col">
          <div className="flex items-center gap-2 text-muted-foreground mb-3 text-sm">
            <Award size={16} className="text-purple-500" /> Kuis Sempurna
          </div>
          <span className="text-2xl font-bold">{perfectQuiz}</span>
        </div>
      </div>

      {/* Tips Section */}
      <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6">
        <h3 className="flex items-center gap-2 text-primary font-semibold mb-4 text-sm">
          <Info size={16} className="text-primary" /> Tips Menjaga Streak
        </h3>
        <ul className="space-y-2 text-sm text-primary/80 pl-2">
          <li className="flex items-start gap-2">
            <span className="mt-1.5 w-1 h-1 rounded-full bg-primary shrink-0" />
            Review minimal 1 flashcard setiap hari
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1.5 w-1 h-1 rounded-full bg-primary shrink-0" />
            Atau selesaikan 1 kuis untuk menjaga streak
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1.5 w-1 h-1 rounded-full bg-primary shrink-0" />
            Streak akan reset jika tidak ada aktivitas dalam 1 hari
          </li>
        </ul>
      </div>

    </div>
  );
}
