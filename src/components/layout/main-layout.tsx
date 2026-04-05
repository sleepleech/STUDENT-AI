"use client";
import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "./sidebar";
import { Navbar } from "./navbar";
import { useAuthStore } from "@/store/useAuthStore";
import { cn } from "@/lib/utils";

export function MainLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  const pathname = usePathname();
  const router = useRouter();
  const { user, syncProfile } = useAuthStore();
  const [isSyncing, setIsSyncing] = useState(true);

  const isPublicPage = pathname === "/" || pathname === "/about" || pathname === "/login";

  useEffect(() => {
    const initAuth = async () => {
      await syncProfile();
      setIsSyncing(false);
    };
    initAuth();

    // Cleanup old storage
    try {
      localStorage.removeItem('nata-sensei-material');
    } catch { }
  }, [syncProfile]);

  useEffect(() => {
    if (isSyncing) return; // Wait for cloud sync

    // Route guard
    if (!user && !isPublicPage) {
      router.push("/login");
    } else if (user && pathname === "/login") {
      router.push("/dashboard");
    }
  }, [user, pathname, isPublicPage, router, isSyncing]);

  // Handle flash of unauthenticated state or simply render without sidebar
  if (isPublicPage) {
    return (
      <div className="min-h-screen bg-background font-sans text-foreground">
        {children}
      </div>
    );
  }

  // Prevent rendering protected layout if not authenticated
  if (!user && !isSyncing) return null;

  return (
    <div className="flex min-h-screen bg-background font-sans text-foreground overflow-x-hidden">
      {/* Mobile Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar - Positioned fixed on mobile, sticky on desktop */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 md:sticky md:block transition-transform duration-300 transform",
        open ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        <Sidebar open={open} setOpen={setOpen} />
      </div>

      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        <Navbar onMenuClick={() => setOpen(!open)} />
        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          <div className="max-w-6xl mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

