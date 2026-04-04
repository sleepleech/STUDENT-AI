"use client";
import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "./sidebar";
import { Navbar } from "./navbar";
import { useAuthStore } from "@/store/useAuthStore";

export function MainLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuthStore();

  const isPublicPage = pathname === "/" || pathname === "/about" || pathname === "/login";

  useEffect(() => {
    // Bersihkan localStorage key lama yang bisa menyebabkan konflik state
    try {
      localStorage.removeItem('nata-sensei-material');
    } catch {}
  }, []);

  useEffect(() => {
    // Route guard
    if (!user && !isPublicPage) {
      router.push("/login");
    } else if (user && pathname === "/login") {
      router.push("/dashboard");
    }
  }, [user, pathname, isPublicPage, router]);

  // Handle flash of unauthenticated state or simply render without sidebar
  if (isPublicPage) {
    return (
      <div className="min-h-screen bg-background font-sans text-foreground">
        {children}
      </div>
    );
  }

  // Prevent rendering protected layout if not authenticated
  if (!user) return null;

  return (
    <div className="flex min-h-screen bg-background font-sans text-foreground">
      <div className="hidden md:block">
        <Sidebar open={open} setOpen={setOpen} />
      </div>
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar onMenuClick={() => setOpen(!open)} />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-muted/20 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
