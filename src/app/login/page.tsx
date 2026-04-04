"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, User as UserIcon, Eye, EyeOff, Sparkles, Home, LogIn, MessageCircle } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const { login, register } = useAuthStore();
  const [isLoginView, setIsLoginView] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [errorText, setErrorText] = useState("");
  
  // States
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [isSuccessReg, setIsSuccessReg] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText("");

    if (isLoginView) {
      // Admin hardcoded
      if (email === "sleepy" && password === "13071997") {
        login("Admin Faqih", "admin");
        router.push("/dashboard");
        return;
      }
      
      // Ambil daftar users dari store — hanya yang aktif boleh login
      const users = useAuthStore.getState().users;
      const matchedUser = users.find(
        (u) => u.email.toLowerCase() === email.toLowerCase() && u.role !== 'admin'
      );

      if (!matchedUser) {
        setErrorText("Email tidak ditemukan. Silakan daftar terlebih dahulu.");
        return;
      }

      if (matchedUser.status === 'pending') {
        setErrorText("Akun Anda belum aktif. Hubungi admin di WA 085143820659.");
        return;
      }

      if (matchedUser.status === 'suspended') {
        setErrorText("Akun Anda telah dinonaktifkan. Hubungi admin.");
        return;
      }

      // Password check: password disimpan sebagai field, atau fallback ke nama
      const storedPassword = (matchedUser as any).password;
      if (storedPassword && storedPassword !== password) {
        setErrorText("Password salah. Silakan coba lagi.");
        return;
      }

      login(matchedUser.email, matchedUser.role, matchedUser.name);
      router.push("/dashboard");
    } else {
      if (email && password && firstName) {
        register(`${firstName} ${lastName}`.trim(), email, password);
        setIsSuccessReg(true);
      } else {
        setErrorText("Kolom wajib (First name, Email, Password) harus diisi.");
      }
    }
  };

  return (
    <div className="relative w-full h-screen font-sans flex text-white overflow-hidden bg-black">
      {/* Video Background */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover opacity-100 pointer-events-none contrast-110 brightness-110"
      >
        <source src="/videos/animasi3.mp4" type="video/mp4" />
      </video>

      {/* Top Navigation */}
      <header className="absolute top-0 w-full px-8 py-6 z-20 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Left: Branding */}
        <div className="flex flex-col items-center md:items-start text-white/90">
          <Sparkles size={32} className="mb-1 text-white" />
          <span className="text-sm font-bold leading-tight">Nata<br/>Sensei</span>
        </div>

        {/* Center: Tabs */}
        <div className="flex items-center gap-8 text-sm font-bold uppercase tracking-widest bg-white/5 backdrop-blur-md px-6 py-2 rounded-xl border border-white/10">
          <Link href="/" className="flex items-center gap-2 hover:text-orange-400 transition-colors">
            <Home size={16} /> Home
          </Link>
          <Link href="/about" className="flex items-center gap-2 hover:text-orange-400 transition-colors">
            <LogIn size={16} /> About
          </Link>
        </div>

        {/* Right: Language (Dummy to match UI) */}
        <div className="hidden md:flex flex-col text-[10px] font-bold text-white/50 items-end gap-1">
          <span className="hover:text-white cursor-pointer transition-colors">RU</span>
          <span className="hover:text-white cursor-pointer transition-colors">FR</span>
          <span className="text-white flex items-center gap-1 cursor-pointer"><ArrowRightSmall /> EN</span>
        </div>
      </header>

      {/* Main Content Form */}
      <main className="relative z-10 w-full h-full flex flex-col justify-center px-8 sm:px-16 md:px-24 max-w-2xl mt-12 md:mt-0">
        <AnimatePresence mode="wait">
          {isSuccessReg ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 30 }}
              className="bg-white/10 backdrop-blur-lg p-8 rounded-3xl border border-white/20"
            >
              <h2 className="text-3xl font-black mb-4 uppercase text-orange-400">Registration Successful!</h2>
              <p className="text-white/80 text-sm leading-relaxed mb-8 font-medium">
                Akun Anda berhasil dibuat. Untuk mengaktifkannya, silakan hubungi admin Nata Sensei via WhatsApp.
              </p>
              
              <a 
                href="https://wa.me/085143820659?text=Halo%20Admin%2C%20saya%20sudah%20mendaftar%20di%20Nata%20Sensei%20dengan%20email%3A%20" 
                target="_blank" 
                rel="noreferrer"
                className="inline-flex w-max px-8 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-lg transition-all shadow-lg shadow-orange-500/30 mb-6 uppercase text-sm tracking-wider"
              >
                Kirim Konfirmasi via WA
              </a>
              <br/>
              <button 
                onClick={() => { setIsSuccessReg(false); setIsLoginView(true); }}
                className="text-white/70 hover:text-white transition-colors text-sm font-bold border-b border-white/30 pb-0.5"
              >
                Back to Login
              </button>
            </motion.div>
          ) : (
            <motion.div
              key={isLoginView ? "login" : "register"}
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 30 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="w-full"
            >
              <h3 className="text-xs font-bold uppercase tracking-widest text-white/90 drop-shadow-md mb-2">
                Start for free
              </h3>
              <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight text-white mb-6 drop-shadow-xl">
                {isLoginView ? "Sign In" : "Create New Account"}
                <div className="w-full h-0.5 bg-white/40 mt-4 relative shadow-[0_0_10px_rgba(255,255,255,0.5)]">
                  <div className="absolute top-0 left-0 h-full w-1/3 bg-white" />
                </div>
              </h1>

              <div className="flex items-center gap-1 text-sm text-white font-medium mb-8 drop-shadow-md">
                {isLoginView ? "Don't have an Account?" : "Already A Member?"}
                <button 
                  type="button"
                  onClick={() => setIsLoginView(!isLoginView)}
                  className="text-orange-400 font-bold hover:text-orange-300 transition-colors underline decoration-orange-400/30 underline-offset-4 ml-1 drop-shadow-md"
                >
                  {isLoginView ? "Create Account" : "Log In"}
                </button>
              </div>

              {errorText && (
                <div className="mb-6 p-4 rounded-xl bg-red-500/20 border border-red-500/30 text-white text-sm font-medium">
                  {errorText}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                
                {/* Registration Fields */}
                {!isLoginView && (
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="relative w-full">
                      <label className="absolute top-2 left-4 text-[10px] uppercase font-bold text-white/70 tracking-wider">First name</label>
                      <input 
                        type="text" 
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="w-full bg-black/40 backdrop-blur-md hover:bg-black/50 focus:bg-black/60 text-white font-bold px-4 pt-6 pb-2 rounded-xl border border-white/10 outline-none transition-all placeholder-white/30"
                        placeholder="John"
                      />
                      <UserIcon size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50" />
                    </div>
                    <div className="relative w-full">
                      <label className="absolute top-2 left-4 text-[10px] uppercase font-bold text-white/70 tracking-wider">Last name</label>
                      <input 
                        type="text" 
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="w-full bg-black/40 backdrop-blur-md hover:bg-black/50 focus:bg-black/60 text-white font-bold px-4 pt-6 pb-2 rounded-xl border border-white/10 outline-none transition-all placeholder-white/30"
                        placeholder="Doe"
                      />
                      <UserIcon size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50" />
                    </div>
                  </div>
                )}

                {/* Email / Username */}
                <div className="relative w-[100%] max-w-sm">
                  <label className="absolute top-2 left-4 text-[10px] uppercase font-bold text-white/70 tracking-wider">
                    {isLoginView ? "Email or Username" : "Email"}
                  </label>
                  <input 
                    type={isLoginView ? "text" : "email"}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-black/40 backdrop-blur-md hover:bg-black/50 focus:bg-black/60 text-white font-bold px-4 pt-6 pb-2 rounded-xl border border-white/10 outline-none transition-all placeholder-white/30"
                    placeholder={isLoginView ? "admin: sleepy" : "email@domain.com"}
                  />
                  <Mail size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50" />
                </div>

                {/* Password */}
                <div className="relative w-[100%] max-w-sm">
                  <label className="absolute top-2 left-4 text-[10px] uppercase font-bold text-white/70 tracking-wider">Password</label>
                  <input 
                    type={showPassword ? "text" : "password"} 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-black/40 backdrop-blur-md hover:bg-black/50 focus:bg-black/60 text-white font-bold px-4 pt-6 pb-2 rounded-xl border border-white/10 outline-none transition-all placeholder-white/50 tracking-widest"
                    placeholder="••••••••••••"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors"
                  >
                    {showPassword ? <Eye size={16} /> : <EyeOff size={16} />}
                  </button>
                </div>

                {/* Action Button */}
                <button 
                  type="submit"
                  className="w-max px-10 py-3 bg-gradient-to-r from-orange-500 to-orange-400 hover:from-orange-400 hover:to-orange-500 text-white font-black text-sm uppercase tracking-wider rounded-lg transition-all shadow-[0_0_20px_rgba(249,115,22,0.4)] mt-6"
                >
                  {isLoginView ? "Login" : "Create Account"}
                </button>
              </form>

            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Floating social links at bottom roughly matching UI */}
      <div className="absolute bottom-6 left-8 sm:left-16 md:left-24 z-20 flex gap-4 opacity-90">
         <a href="https://wa.me/085143820659" target="_blank" rel="noreferrer" className="w-11 h-11 rounded-xl bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center hover:bg-green-500/80 hover:border-green-400 hover:scale-110 cursor-pointer transition-all shadow-[0_0_15px_rgba(0,0,0,0.5)]">
            <MessageCircle size={20} className="text-white" />
         </a>
         <a href="https://instagram.com/faqihwhy113" target="_blank" rel="noreferrer" className="w-11 h-11 rounded-xl bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center hover:bg-pink-500/80 hover:border-pink-400 hover:scale-110 cursor-pointer transition-all shadow-[0_0_15px_rgba(0,0,0,0.5)]">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
              <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
              <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
              <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
            </svg>
         </a>
      </div>
    </div>
  );
}

function ArrowRightSmall() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 12H20M20 12L14 6M20 12L14 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
