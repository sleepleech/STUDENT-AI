"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";

export default function AboutPage() {
  return (
    <div className="relative w-full h-screen overflow-hidden text-white font-sans bg-black">
      {/* Video Background - HD 8K Setup */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover opacity-100 pointer-events-none contrast-125 saturate-110 brightness-110"
      >
        <source src="/videos/animasi2.mp4" type="video/mp4" />
      </video>

      {/* Darken the extreme left and right sides so the text is fully readable, keeping the center vivid */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-transparent to-black/90 z-0 mix-blend-multiply" />
      
      {/* Soft global overlay to soften extreme highlights if necessary */}
      <div className="absolute inset-0 bg-black/10 z-0" />

      {/* Header / Top Right Branding */}
      <header className="absolute top-0 w-full px-8 py-8 z-20 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-white/70 hover:text-white transition-colors uppercase text-xs font-bold tracking-widest">
          <ArrowLeft size={16} /> Home
        </Link>
        <a href="https://instagram.com/faqihwhy113" target="_blank" rel="noreferrer" className="text-xs font-medium tracking-widest text-white/90 hover:text-primary transition-colors">
          Instagram.com/faqihwhy113
        </a>
      </header>

      {/* Main UI Overlay - "CHARACTER SELECT" Layout */}
      <main className="relative z-10 w-full h-full flex items-center justify-between px-8 md:px-16 lg:px-24">
        
        {/* Left Panel - Hero Info */}
        <motion.div 
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="w-full md:w-2/5 flex flex-col justify-center"
        >
          <h1 className="text-5xl lg:text-7xl font-black leading-[1.1] tracking-tight mb-4 uppercase drop-shadow-xl text-white">
            TENTANG <br /> SENSEI
          </h1>
          
          <div className="w-20 h-[2px] bg-white/40 mb-6 drop-shadow-md" />
          
          <p className="text-sm md:text-base text-white/90 leading-relaxed font-light mb-12 drop-shadow-md">
            Nata Sensei diciptakan dengan nilai fundamental: memecah kompleksitas informasi menjadi pemahaman murni. Ditenagai oleh 
            kecerdasan simulasi AI terdepan (<i>Generative Learning</i>), platform ini dirancang untuk membaca ratusan halaman dokumen 
            maupun merangkum menit video menjadi flashcard dan kuis dalam hitungan milidetik.
            <br className="mb-4" />
            Visi kami adalah menjadikan efisiensi belajar bukan lagi pengecualian, melainkan standar kehidupan.
          </p>

          <Link href="/dashboard" className="flex items-center gap-4 group cursor-pointer w-max">
            <div className="w-12 h-[1px] bg-white group-hover:w-20 transition-all duration-300" />
            <span className="text-sm font-bold uppercase tracking-wider group-hover:text-primary transition-colors">Coba Sekarang</span>
          </Link>
        </motion.div>

        {/* Right Panel - UI Callouts */}
        <motion.div 
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
          className="hidden md:flex w-full md:w-1/3 flex-col justify-center gap-16 items-end text-right"
        >
          {/* Feature 1 */}
          <div className="relative group w-full flex flex-col items-end">
            {/* The Cyberpunk-style HUD Line pointing inward (to the left) */}
            <div className="absolute top-4 -left-12 xl:-left-24 w-12 xl:w-24 h-[1px] bg-white/30 group-hover:bg-primary transition-colors hidden lg:block" />
            <div className="absolute top-[13.5px] -left-12 xl:-left-24 w-1.5 h-1.5 rounded-full bg-white group-hover:bg-primary hidden lg:block" />
            
            <h3 className="text-lg font-bold text-white mb-2 uppercase tracking-wider">AI Extraction</h3>
            <p className="text-xs text-white/70 font-light max-w-xs leading-relaxed">
              Mampu mengekstrak konteks dari PDF berat maupun link YouTube secara instan.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="relative group w-full flex flex-col items-end">
            <div className="absolute top-4 -left-20 xl:-left-32 w-20 xl:w-32 h-[1px] bg-white/30 group-hover:bg-primary transition-colors hidden lg:block" />
            <div className="absolute top-[13.5px] -left-20 xl:-left-32 w-1.5 h-1.5 rounded-full bg-white group-hover:bg-primary hidden lg:block" />
            
            <h3 className="text-lg font-bold text-white mb-2 uppercase tracking-wider">Active Recall System</h3>
            <p className="text-xs text-white/70 font-light max-w-xs leading-relaxed">
              Sistem ujian adaptif dan manajemen flashcards terdesentralisasi terbukti mengakselerasi pemahaman.
            </p>
          </div>

          {/* Feature 3 (Rating) */}
          <div className="relative group w-full flex flex-col items-end mt-4">
            <div className="absolute top-3 -left-8 xl:-left-12 w-8 xl:w-12 h-[1px] bg-white/30 group-hover:bg-primary transition-colors hidden lg:block" />
            
            <h3 className="text-base font-bold text-white mb-1 uppercase tracking-widest">Rate :</h3>
            <div className="flex items-center gap-1 text-white">
              <span className="text-sm">★</span>
              <span className="text-sm">★</span>
              <span className="text-sm">★</span>
              <span className="text-sm">★</span>
              <span className="text-sm">★</span>
            </div>
          </div>
        </motion.div>

      </main>
    </div>
  );
}
