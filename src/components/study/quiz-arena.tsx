"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, CheckCircle, XCircle } from "lucide-react";
import { useGameStore } from "@/store/useGameStore";

interface QuizProps {
  quiz: {
    question: string;
    options: string[];
    correct_answer: string;
    explanation: string;
  }[];
}

export function QuizArena({ quiz }: QuizProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);
  const { incrementQuiz } = useGameStore();

  if (!quiz || quiz.length === 0) return <div className="p-10 text-center">Kuis belum tersedia.</div>;

  const currentQ = quiz[currentIndex];

  const handleSelect = (opt: string) => {
    if (isAnswered) return;
    setSelectedOption(opt);
    setIsAnswered(true);

    if (opt === currentQ.correct_answer) {
      setScore(score + 100);
      incrementQuiz(true);
    } else {
      incrementQuiz(false);
    }
  };

  const handleNext = () => {
    if (currentIndex < quiz.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setSelectedOption(null);
      setIsAnswered(false);
    } else {
      setQuizFinished(true);
    }
  };

  if (quizFinished) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-card rounded-3xl border border-border mt-10">
        <Trophy size={64} className="text-secondary mb-6" />
        <h2 className="text-3xl font-bold mb-2">Sensei Bangga Padamu!</h2>
        <p className="text-muted-foreground mb-8">Score Anda: {score} EXP</p>
        <button onClick={() => window.location.href='/'} className="px-8 py-3 bg-primary text-primary-foreground rounded-full font-bold shadow-lg">
          Selesai & Keluar Dojo
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto w-full py-8 space-y-6">
      
      {/* Stats */}
      <div className="flex items-center justify-between text-sm font-semibold mb-6">
        <div className="text-muted-foreground">Soal {currentIndex + 1} / {quiz.length}</div>
        <div className="text-primary bg-primary/10 px-4 py-1.5 rounded-full">{score} EXP</div>
      </div>

      {/* Question */}
      <div className="bg-card p-8 rounded-2xl border border-border/50 shadow-sm">
        <h3 className="text-xl md:text-2xl font-bold leading-relaxed">
          {currentQ.question}
        </h3>
      </div>

      {/* Options */}
      <div className="grid grid-cols-1 gap-4">
        {currentQ.options.map((opt, idx) => {
          
          let optionStyle = "border-border hover:border-primary/50 bg-card hover:bg-muted/30";
          
          if (isAnswered) {
             if (opt === currentQ.correct_answer) {
                optionStyle = "border-green-500 bg-green-500/10 text-green-700 dark:text-green-400";
             } else if (opt === selectedOption) {
                optionStyle = "border-red-500 bg-red-500/10 text-red-700 dark:text-red-400";
             } else {
                optionStyle = "border-border opacity-50 bg-card";
             }
          } else if (selectedOption === opt) {
             optionStyle = "border-primary bg-primary/10";
          }

          return (
            <button
              key={idx}
              onClick={() => handleSelect(opt)}
              disabled={isAnswered}
              className={`text-left p-6 rounded-xl border-2 transition-all font-medium ${optionStyle}`}
            >
              <div className="flex justify-between items-center">
                <span>{opt}</span>
                {isAnswered && opt === currentQ.correct_answer && <CheckCircle className="text-green-500" />}
                {isAnswered && opt === selectedOption && opt !== currentQ.correct_answer && <XCircle className="text-red-500" />}
              </div>
            </button>
          )
        })}
      </div>

      {/* Explanation Banner */}
      <AnimatePresence>
        {isAnswered && (
          <motion.div
            initial={{ opacity: 0, y: 10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            className="bg-muted p-6 rounded-xl mt-6 border-l-4 border-primary"
          >
            <h4 className="font-bold mb-2">Penjelasan Sensei:</h4>
            <p className="text-muted-foreground">{currentQ.explanation}</p>
            <button 
              onClick={handleNext}
              className="mt-6 px-6 py-2.5 bg-foreground text-background font-bold rounded-lg hover:opacity-90 w-full"
            >
              {currentIndex < quiz.length - 1 ? 'Soal Berikutnya' : 'Lihat Hasil Akhir'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
