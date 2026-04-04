"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { Sparkles, BrainCircuit, ArrowRight } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="relative w-full h-screen overflow-hidden text-white font-sans bg-black">
      {/* Video Background */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover opacity-100 pointer-events-none contrast-125 saturate-110 brightness-110"
      >
        <source src="/videos/animasi.mp4" type="video/mp4" />
      </video>

      {/* Overlay: Darken only the left side where the text belongs to make the video stand out 8k style */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/30 to-transparent z-0 mix-blend-multiply" />

      {/* Header / Navbar */}
      <header className="absolute top-0 w-full px-4 md:px-8 py-4 md:py-6 z-20 flex items-center justify-between">
        {/* Left: Logo */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 font-black text-lg md:text-xl tracking-wider"
        >
          <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-gradient-to-br from-pink-500 to-fuchsia-600 flex items-center justify-center shadow-[0_0_15px_rgba(236,72,153,0.5)]">
            <Sparkles size={16} className="text-white" />
          </div>
          <span className="hidden xs:block">NATA SENSEI</span>
        </motion.div>

        {/* Center: Navigation - Hidden on very small screens, visible on md+ */}
        <motion.nav 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="hidden md:flex items-center justify-center gap-6 lg:gap-10 font-medium text-sm text-white/80"
        >
          <Link href="/" className="text-white hover:text-pink-400 transition-colors">Home</Link>
          <Link href="/about" className="hover:text-pink-400 transition-colors">About</Link>
          <Link href="/dashboard" className="hover:text-pink-400 transition-colors">Dashboard</Link>
        </motion.nav>

        {/* Right: Actions */}
        <motion.div
           initial={{ opacity: 0, y: -20 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ delay: 0.2 }}
           className="flex items-center justify-end"
        >
          <Link href="/login" className="px-4 md:px-6 py-1.5 md:py-2 rounded-full border border-white/20 hover:bg-pink-500/20 hover:border-pink-500/50 text-white hover:text-pink-50 transition-all text-xs md:text-sm font-semibold">
            Sign up
          </Link>
        </motion.div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 w-full h-full flex flex-col justify-center px-6 md:px-16 lg:px-24">
        <motion.div
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="max-w-3xl"
        >
          <h1 className="text-4xl sm:text-6xl md:text-8xl font-black leading-[1.05] tracking-tight mb-4 md:mb-6 drop-shadow-2xl font-serif">
            <span className="text-white">Materi AI</span> <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-300 via-fuchsia-400 to-purple-500">Sekejap</span>
          </h1>
          
          <p className="text-sm md:text-lg text-pink-50/80 mb-8 md:mb-10 max-w-lg leading-relaxed drop-shadow-md">
            Pelajar menikmati kemudahan instan. Upload materi pdf, video atau youtube. Semua dikonversi dengan kecerdasan simulasi AI khusus menjadi lingkungan belajar paling gamified dan efektif.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-4">
            <Link 
              href="/login"
              className="w-full sm:w-auto text-center px-10 py-3.5 bg-gradient-to-r from-pink-600 to-fuchsia-600 hover:from-pink-500 hover:to-fuchsia-500 text-white font-bold rounded-lg transition-all shadow-[0_0_30px_rgba(236,72,153,0.4)]"
            >
              Explore
            </Link>
          </div>
        </motion.div>
      </main>

      {/* Footer Branding */}
      <footer className="absolute bottom-6 w-full text-center z-20">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="inline-flex flex-col items-center justify-center p-3 px-6 rounded-2xl bg-black/40 backdrop-blur border border-white/5 shadow-2xl"
        >
          <p className="text-xs text-pink-100/50 tracking-wider uppercase font-bold mb-1">
            powered by:
          </p>
          <p className="text-sm font-semibold text-pink-300">
            Faqih <span className="text-white/40 mx-2">|</span> Instagram : <a href="https://instagram.com/faqihwhy113" target="_blank" rel="noreferrer" className="text-white hover:text-pink-400 transition-colors">@faqihwhy113</a>
          </p>
        </motion.div>
      </footer>
    </div>
  );
}
