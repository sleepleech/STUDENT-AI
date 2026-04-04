"use client";
import { useState, useMemo } from "react";
import { useGameStoreInternal, getLevel } from "@/store/useGameStore";
import { useAuthStore } from "@/store/useAuthStore";
import { Trophy, Zap, Flame, ChevronLeft, ChevronRight } from "lucide-react";

// Mock data to replicate the UI structure and fill the generic users
const MOCK_LEADERBOARD = [
  { name: "m saba sulaiman", level: 32, xp: 27025, initial: "M", color: "bg-orange-800" },
  { name: "Jonathan felix handoko", level: 30, xp: 23585, initial: "J", color: "bg-pink-600" },
  { name: "Axel Purba", level: 22, xp: 13045, initial: "A", color: "bg-cyan-600" },
  { name: "Henny Indriyani", level: 21, xp: 12085, initial: "H", color: "bg-blue-300" },
  { name: "22. Muhammad Afif", level: 20, xp: 11695, initial: "M", color: "bg-green-800" },
  { name: "Asiyah Faridi", level: 18, xp: 9125, initial: "A", color: "bg-stone-600" },
  { name: "Zek", level: 17, xp: 8990, initial: "Z", color: "bg-green-600" },
  { name: "Tania Alika", level: 17, xp: 8450, initial: "T", color: "bg-orange-600" },
  { name: "AMALIA RIFA TSUROYYA", level: 17, xp: 8400, initial: "A", color: "bg-pink-500" },
  { name: "Saphira Almahira", level: 16, xp: 8105, initial: "S", color: "bg-orange-500" },
];

export default function LeaderboardPage() {
  const { users: authUsers } = useAuthStore();
  const gameUsers = useGameStoreInternal(s => s.users);
  const [activeTab, setActiveTab] = useState<"xp" | "streak">("xp");

  const displayList = useMemo(() => {
    // 1. Gather all real users
    const realUsers = authUsers.map(u => {
      const gState = gameUsers[u.id] || { xp: 0, streak: 0 };
      return {
        id: u.id,
        name: u.name,
        level: getLevel(gState.xp),
        xp: gState.xp,
        streak: gState.streak,
        initial: u.name.charAt(0).toUpperCase(),
        avatar: u.avatar,
        color: u.role === 'admin' ? 'bg-red-600' : 'bg-primary',
        isReal: true
      };
    }).filter(u => u.xp > 0 || u.streak > 0 || u.id === useAuthStore.getState().user?.id); // ensure current user is shown

    // 2. Format mock users
    const mockUsers = MOCK_LEADERBOARD.map((m, i) => ({
      id: `mock-${i}`,
      name: m.name,
      level: m.level,
      xp: m.xp,
      streak: Math.max(1, Math.floor(m.xp / 1000)), // dummy streak calculation
      initial: m.initial,
      avatar: undefined,
      color: m.color,
      isReal: false
    }));

    // 3. Combine, filter out completely 0 XP users unless it's mock, and Sort
    const combined = [...realUsers, ...mockUsers];
    if (activeTab === 'xp') {
      combined.sort((a, b) => b.xp - a.xp);
    } else {
      combined.sort((a, b) => b.streak - a.streak);
    }

    return combined.slice(0, 10);
  }, [authUsers, gameUsers, activeTab]);

  // Helper for rank styling
  const getRankStyle = (index: number) => {
    switch(index) {
      case 0: return { border: "border-[#b8860b] bg-[#2a2010]", icon: "👑", iconColor: "text-[#b8860b]" };
      case 1: return { border: "border-border bg-card", icon: "🥈", iconColor: "text-gray-400" };
      case 2: return { border: "border-[#cd7f32] bg-[#2d1b11]", icon: "🥉", iconColor: "text-[#cd7f32]" };
      default: return { border: "border-border bg-card", icon: `${index + 1}` };
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto pb-20 pt-4">
      
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Trophy className="text-primary" size={24} /> Leaderboard
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Top 50 pelajar terbaik</p>
        </div>

        {/* Toggle Controls */}
        <div className="flex bg-card border border-border p-1 rounded-xl">
          <button 
            onClick={() => setActiveTab("xp")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === "xp" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Zap size={14} /> Total XP
          </button>
          <button 
            onClick={() => setActiveTab("streak")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === "streak" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Flame size={14} /> Streak
          </button>
        </div>
      </div>

      {/* Grid List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
        {displayList.map((user, idx) => {
          const style = getRankStyle(idx);
          
          return (
            <div 
              key={user.id}
              className={`flex items-center gap-4 p-4 rounded-xl border ${style.border} ${user.isReal ? 'ring-1 ring-primary/30 shadow-[0_0_15px_rgba(139,92,246,0.15)] bg-primary/5' : 'bg-card'} transition-all hover:-translate-y-0.5 hover:shadow-md cursor-default`}
            >
              {/* Rank */}
              <div className={`w-6 text-center font-bold text-sm ${idx < 3 ? style.iconColor : 'text-muted-foreground'}`}>
                {style.icon}
              </div>
              
              {/* Avatar */}
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shrink-0 overflow-hidden ${user.color}`}>
                {user.avatar ? (
                  <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  user.initial
                )}
              </div>
              
              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground truncate text-sm">
                  {user.name}
                </p>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Level {user.level}
                </div>
              </div>
              
              {/* Score */}
              <div className="text-right shrink-0">
                {activeTab === 'xp' ? (
                  <p className="font-bold text-primary flex items-center justify-end gap-1">
                    <Zap size={12} className="fill-primary text-primary" /> {user.xp.toLocaleString('en-US')}
                  </p>
                ) : (
                  <p className="font-bold text-orange-500 flex items-center justify-end gap-1">
                    <Flame size={12} className="fill-orange-500" /> {user.streak} Hari
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination Footer */}
      <div className="flex items-center justify-between mt-8">
        <span className="text-sm text-muted-foreground">Top 10 dari 50</span>
        
        <div className="flex items-center gap-4 bg-card border border-border rounded-xl px-2 py-1">
          <button className="p-1 px-2 text-muted-foreground hover:text-foreground disabled:opacity-50">
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-semibold">1 / 5</span>
          <button className="p-1 px-2 text-muted-foreground hover:text-foreground">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

    </div>
  );
}
