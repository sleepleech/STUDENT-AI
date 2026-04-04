"use client";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Home, Settings, Layers, Trophy, Flame, ChevronLeft, ChevronRight, Swords, Sparkles } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useGameStore, getBelt } from "@/store/useGameStore";

const menus = [
  { name: "Dashboard", icon: Home, path: "/dashboard" },
  { name: "Study Room", icon: BookOpen, path: "/study-room" },
  { name: "Materials", icon: Layers, path: "/materials" },
  { name: "Leaderboard", icon: Trophy, path: "/leaderboard" },
  { name: "Streaks", icon: Flame, path: "/streaks" },
  { name: "Settings", icon: Settings, path: "/settings" },
];

import { useAuthStore } from "@/store/useAuthStore";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export function Sidebar({ open, setOpen }: { open: boolean, setOpen: (open: boolean) => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { xp } = useGameStore();
  const { user, logout } = useAuthStore();
  const belt = getBelt(xp);

  const displayMenus = user?.role === 'admin' 
    ? [...menus, { name: "Admin Panel", icon: Trophy /* Using a placeholder icon that looks okay */, path: "/admin" }]
    : menus;

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <motion.aside
      animate={{ width: open ? 230 : 72 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="h-screen bg-sidebar border-r border-sidebar-border flex flex-col justify-between py-5 sticky top-0 overflow-hidden"
    >
      {/* Logo */}
      <div>
        <div className="flex items-center justify-between mb-6 px-4 h-10">
          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="flex items-center gap-2"
              >
                <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shrink-0 purple-glow">
                  <Sparkles size={14} className="text-white" />
                </div>
                <span className="text-base font-bold text-foreground whitespace-nowrap">
                  nata<span className="text-primary">sensei</span>.ai
                </span>
              </motion.div>
            )}
          </AnimatePresence>
          <button
            onClick={() => setOpen(!open)}
            className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors shrink-0 ml-auto"
          >
            {open ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
          </button>
        </div>

        {/* Nav Items */}
        <nav className="space-y-1 px-3">
          {displayMenus.map((menu) => {
            const isActive = pathname === menu.path;
            const Icon = menu.icon;
            return (
              <Link
                key={menu.name}
                href={menu.path}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative",
                  isActive
                    ? "bg-primary text-white font-semibold purple-glow"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="active-pill"
                    className="absolute inset-0 bg-primary rounded-xl"
                    style={{ zIndex: -1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
                <Icon size={20} className="shrink-0" />
                <AnimatePresence>
                  {open && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="text-sm whitespace-nowrap"
                    >
                      {menu.name}
                    </motion.span>
                  )}
                </AnimatePresence>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* User Footer */}
      <div className="px-3">
        <div className={cn(
          "flex items-center justify-between p-3 rounded-xl bg-accent/50 border border-border group",
          !open && "justify-center"
        )}>
          <div className="flex items-center gap-3 min-w-0">
            {user?.avatar ? (
              <img src={user.avatar} alt="Avatar" className="w-8 h-8 rounded-full border border-border object-cover shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center shrink-0 text-white text-xs font-bold uppercase">
                {user?.name.charAt(0) || "U"}
              </div>
            )}
            <AnimatePresence>
              {open && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="min-w-0"
                >
                  <p className="text-xs font-semibold text-foreground truncate">{user?.name || "User"}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.role === 'admin' ? "Admin" : belt.name}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          {/* Logout Button */}
          {open && (
            <button 
              onClick={handleLogout}
              className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors shrink-0"
              title="Logout"
            >
              <LogOut size={16} />
            </button>
          )}
        </div>
      </div>
    </motion.aside>
  );
}
