"use client";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Bot, User, Sparkles, Loader2, RotateCcw } from "lucide-react";
import { useGameStore, XP_REWARDS } from "@/store/useGameStore";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatPanelProps {
  materialContext?: {
    title: string;
    summary: string;
    key_points?: string[];
  };
}

const SUGGESTED_PROMPTS = [
  "Jelaskan materi ini dengan bahasa sederhana",
  "Apa poin terpenting dari materi ini?",
  "Buat analogi sederhana untuk memudahkan pemahaman",
  "Apa yang harus aku pelajari lebih dalam?",
];

export function ChatPanel({ materialContext }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: materialContext
        ? `Halo! 👋 Aku **Nata Sensei**, asisten AI-mu. Aku sudah membaca materi **"${materialContext.title}"** dan siap membantu kamu memahaminya lebih dalam. Ada yang ingin kamu tanyakan?`
        : "Halo! 👋 Aku **Nata Sensei**. Tanyakan apa saja, aku siap membantu belajarmu! 🎓",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { addXP } = useGameStore();

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isLoading]);

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: content.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages,
          materialContext,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setMessages([...newMessages, { role: "assistant", content: data.message }]);
      addXP(XP_REWARDS.USE_CHAT, 'Diskusi dengan Sensei');
    } catch (err: any) {
      setMessages([
        ...newMessages,
        { role: "assistant", content: `❌ Maaf, terjadi kesalahan: ${err.message}. Coba lagi ya!` },
      ]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const clearChat = () => {
    setMessages([
      {
        role: "assistant",
        content: materialContext
          ? `Chat direset! 🔄 Aku masih ingat materi **"${materialContext.title}"**. Ada yang mau ditanyakan?`
          : "Chat direset! 🔄 Ada yang mau ditanyakan?",
      },
    ]);
  };

  // Simple markdown-like formatting
  const formatText = (text: string) => {
    return text
      .split("\n")
      .map((line, i) => {
        // Bold
        line = line.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
        // Italic
        line = line.replace(/\*(.*?)\*/g, "<em>$1</em>");
        // Code inline
        line = line.replace(/`(.*?)`/g, '<code class="bg-muted px-1 py-0.5 rounded text-xs font-mono">$1</code>');
        return <p key={i} className="mb-1 last:mb-0" dangerouslySetInnerHTML={{ __html: line || "&nbsp;" }} />;
      });
  };

  return (
    <div className="flex flex-col h-[600px] bg-card rounded-2xl border border-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-card/80 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-primary/20 flex items-center justify-center purple-glow">
            <Sparkles size={15} className="text-primary" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">Nata Sensei Chat</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
              Online • Gemini 2.5 Flash
            </p>
          </div>
        </div>
        <button
          onClick={clearChat}
          className="p-2 rounded-xl hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          title="Reset Chat"
        >
          <RotateCcw size={15} />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth">
        {/* Suggested prompts — only show when only 1 message (welcome) */}
        {messages.length === 1 && (
          <div className="flex flex-wrap gap-2 pb-2">
            {SUGGESTED_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                onClick={() => sendMessage(prompt)}
                className="text-xs px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
            >
              {/* Avatar */}
              <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                msg.role === "user"
                  ? "bg-gradient-to-br from-primary to-secondary"
                  : "bg-primary/15 border border-primary/20"
              }`}>
                {msg.role === "user"
                  ? <User size={13} className="text-white" />
                  : <Bot size={13} className="text-primary" />
                }
              </div>

              {/* Bubble */}
              <div className={`max-w-[78%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-primary text-white rounded-tr-sm"
                  : "bg-accent text-foreground rounded-tl-sm border border-border"
              }`}>
                <div className="space-y-1">
                  {formatText(msg.content)}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Loading indicator */}
        {isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-3"
          >
            <div className="w-7 h-7 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0">
              <Bot size={13} className="text-primary" />
            </div>
            <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-accent border border-border">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Input Area */}
      <div className="px-4 py-3 border-t border-border bg-card/80 shrink-0">
        <div className="flex items-end gap-2 bg-accent/50 rounded-2xl border border-border px-4 py-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Tanya Nata Sensei... (Enter untuk kirim)"
            rows={1}
            disabled={isLoading}
            className="flex-1 bg-transparent resize-none outline-none text-sm text-foreground placeholder:text-muted-foreground max-h-32 py-1.5 disabled:opacity-50"
            style={{ minHeight: "36px" }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isLoading}
            className="p-2 rounded-xl bg-primary text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90 transition-all purple-glow shrink-0"
          >
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
        <p className="text-xs text-muted-foreground text-center mt-2">
          AI bisa salah. Verifikasi informasi penting.
        </p>
      </div>
    </div>
  );
}
