"use client";
import { Bell, Search, User, Zap, Menu } from "lucide-react";
import { motion } from "framer-motion";
import { useGameStore, getBelt, getXPForNextBelt } from "@/store/useGameStore";
import { useAuthStore } from "@/store/useAuthStore";

export function Navbar({ onMenuClick }: { onMenuClick?: () => void }) {
  const { xp } = useGameStore();
  const { user } = useAuthStore();
  const belt = getBelt(xp);
  const xpProgress = getXPForNextBelt(xp);
  return (
    <header className="h-14 border-b border-border bg-background/70 backdrop-blur-xl sticky top-0 z-40 flex items-center justify-between px-4 md:px-5">
      {/* Mobile Menu Toggle */}
      <button 
        onClick={onMenuClick}
        className="p-2 -ml-2 mr-2 hover:bg-accent rounded-xl text-muted-foreground hover:text-foreground md:hidden transition-colors"
      >
        <Menu size={20} />
      </button>

      {/* Search */}
      <div className="relative hidden md:block">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Cari materi..."
          className="h-9 w-60 rounded-xl border border-border bg-accent/50 pl-9 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-all text-foreground placeholder:text-muted-foreground"
        />
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-3 ml-auto">
        {/* XP Badge */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-xl border border-primary/20 cursor-default" title={`${xpProgress.current}/${xpProgress.required} XP to next belt`}>
          <div className="w-5 h-5 rounded-md bg-primary/20 flex items-center justify-center text-xs">
            {belt.emoji}
          </div>
          <span className="text-xs font-semibold text-foreground">{belt.name}</span>
          <div className="w-16 h-1.5 bg-accent rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${xpProgress.percent}%` }}
              transition={{ duration: 1.2, delay: 0.3, ease: "easeOut" }}
              className="h-full bg-gradient-to-r from-primary to-secondary rounded-full"
            />
          </div>
          <span className="text-xs font-bold text-primary">{xp} XP</span>
        </div>

        {/* Bell */}
        <button className="relative p-2 hover:bg-accent rounded-xl transition-colors text-muted-foreground hover:text-foreground">
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-primary rounded-full" />
        </button>

        {/* Avatar */}
        <button className="relative w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-xs font-bold shrink-0">
          {user?.avatar ? (
            <img src={user.avatar} alt="Avatar" className="w-full h-full rounded-full object-cover" />
          ) : (
            <span className="uppercase">{user?.name.charAt(0) || "U"}</span>
          )}
        </button>
      </div>
    </header>
  );
}
