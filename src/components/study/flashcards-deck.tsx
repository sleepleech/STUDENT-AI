"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { RotateCcw, ChevronRight, ChevronLeft } from "lucide-react";
import { useGameStore } from "@/store/useGameStore";

interface FlashcardProps {
  cards: { question: string; answer: string }[];
}

export function FlashcardsDeck({ cards }: FlashcardProps) {
  const [index, setIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const { incrementFlashcard } = useGameStore();

  if (!cards || cards.length === 0) return <div className="p-10 text-center">Tidak ada flashcards yang ditemukan.</div>;

  const currentCard = cards[index];

  const handleNext = () => {
    setIsFlipped(false);
    setTimeout(() => {
      setIndex((prev) => (prev + 1) % cards.length);
    }, 150);
  };

  const handlePrev = () => {
    setIsFlipped(false);
    setTimeout(() => {
      setIndex((prev) => (prev - 1 + cards.length) % cards.length);
    }, 150);
  };

  return (
    <div className="flex flex-col items-center max-w-2xl mx-auto w-full py-8">
      
      {/* ProgressBar */}
      <div className="w-full flex items-center justify-between mb-8 text-sm font-semibold text-muted-foreground">
        <span>Mastery Progress</span>
        <span>Materi {index + 1} / {cards.length}</span>
      </div>

      {/* Valid 3D Card Scene */}
      <div className="relative w-full aspect-[4/3] max-w-[500px]" style={{ perspective: 1200 }}>
        <motion.div
          className="w-full h-full cursor-pointer relative"
          style={{ transformStyle: "preserve-3d" }}
          initial={false}
          animate={{ rotateY: isFlipped ? 180 : 0 }}
          transition={{ duration: 0.6, type: "spring", stiffness: 200, damping: 20 }}
          onClick={() => {
            if (!isFlipped) incrementFlashcard();
            setIsFlipped(!isFlipped);
          }}
        >
          {/* Front of the card */}
          <div 
            className="absolute inset-0 w-full h-full bg-card border-2 border-border/50 rounded-3xl p-8 flex flex-col items-center justify-center shadow-lg backface-hidden"
            style={{ backfaceVisibility: "hidden" }}
          >
            <div className="absolute top-4 right-6 text-xs font-bold text-primary/50 tracking-widest break-words">Q U E S T I O N</div>
            <p className="text-xl md:text-2xl text-center font-bold text-foreground leading-relaxed">
              {currentCard.question}
            </p>
            <div className="absolute bottom-6 flex items-center gap-2 text-muted-foreground text-sm">
              <RotateCcw size={16} /> Tap to flip
            </div>
          </div>

          {/* Back of the card */}
          <div 
            className="absolute inset-0 w-full h-full bg-gradient-to-br from-primary/10 to-secondary/10 border-2 border-primary/30 rounded-3xl p-8 flex flex-col items-center justify-center shadow-primary/20 shadow-xl backface-hidden"
            style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
          >
            <div className="absolute top-4 right-6 text-xs font-bold text-secondary/50 tracking-widest">A N S W E R</div>
            <p className="text-lg md:text-xl text-center font-medium text-foreground leading-relaxed overflow-y-auto w-full h-full flex items-center justify-center">
              {currentCard.answer}
            </p>
          </div>
        </motion.div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-6 mt-12 w-full justify-center">
        <button 
          onClick={handlePrev}
          className="p-4 rounded-full bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
        >
          <ChevronLeft size={24} />
        </button>
        <button 
          onClick={handleNext}
          className="px-8 py-4 rounded-xl bg-primary text-primary-foreground font-bold shadow-lg shadow-primary/25 hover:bg-primary/95 transition-all flex items-center gap-2"
        >
          Next Card <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );
}
