"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, User as UserIcon, Eye, EyeOff, Sparkles, Loader2, MessageCircle } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const { login, register, isLoading } = useAuthStore();
  const [isLoginView, setIsLoginView] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [errorText, setErrorText] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [isSuccessReg, setIsSuccessReg] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText("");

    try {
      if (isLoginView) {
        if (!email || !password) {
          setErrorText("Email dan password wajib diisi.");
          return;
        }
        await login(email, password);
        router.push("/dashboard");
      } else {
        if (!email || !password || !firstName) {
          setErrorText("Kolom First Name, Email, dan Password wajib diisi.");
          return;
        }
        if (password.length < 6) {
          setErrorText("Password minimal 6 karakter.");
          return;
        }
        await register(`${firstName} ${lastName}`.trim(), email, password);
        setIsSuccessReg(true);
      }
    } catch (err: any) {
      setErrorText(err.message || "Terjadi kesalahan. Coba lagi.");
    }
  };

  const switchView = (toLogin: boolean) => {
    setIsLoginView(toLogin);
    setErrorText("");
    setEmail("");
    setPassword("");
    setFirstName("");
    setLastName("");
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

      {/* Dark overlay for readability */}
      <div className="absolute inset-0 bg-black/40 pointer-events-none" />

      {/* Top Navigation */}
      <header className="absolute top-0 w-full px-6 md:px-8 py-4 md:py-6 z-20 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 text-white/90">
          <Sparkles size={24} className="text-white" />
          <span className="text-[10px] md:text-sm font-bold leading-tight uppercase tracking-tighter">Nata<br/>Sensei</span>
        </div>

        <div className="flex items-center gap-4 md:gap-8 text-[10px] md:text-sm font-bold uppercase tracking-widest bg-white/5 backdrop-blur-md px-4 md:px-6 py-2 rounded-xl border border-white/10">
          <Link href="/" className="hover:text-orange-400 transition-colors">Home</Link>
          <Link href="/about" className="hover:text-orange-400 transition-colors">About</Link>
        </div>

        <div className="hidden lg:flex flex-col text-[10px] font-bold text-white/50 items-end gap-1">
          <span className="hover:text-white cursor-pointer transition-colors">RU</span>
          <span className="text-white flex items-center gap-1 cursor-pointer"> EN</span>
        </div>
      </header>

      {/* Main Content Form */}
      <main className="relative z-10 w-full h-full flex flex-col justify-center px-8 sm:px-16 md:px-24 max-w-2xl mt-12 md:mt-0">
        <AnimatePresence mode="wait">

          {/* ======================== SUCCESS STATE ======================== */}
          {isSuccessReg ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 30 }}
              className="bg-black/50 backdrop-blur-lg p-8 rounded-3xl border border-white/20"
            >
              <div className="w-14 h-14 rounded-2xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center mb-6">
                <Sparkles size={28} className="text-orange-400" />
              </div>
              <h2 className="text-3xl font-black mb-3 uppercase text-orange-400">Pendaftaran Berhasil!</h2>
              <p className="text-white/80 text-sm leading-relaxed mb-2 font-medium">
                Akun Anda berhasil dibuat dengan status <span className="text-orange-400 font-bold">Pending</span>.
              </p>
              <p className="text-white/60 text-xs leading-relaxed mb-8">
                Untuk mengaktifkan akun, silakan konfirmasi ke admin Nata Sensei via WhatsApp dengan menyebutkan email yang Anda daftarkan.
              </p>

              <a
                href={`https://wa.me/085143820659?text=Halo%20Admin%20Nata%20Sensei%2C%20saya%20sudah%20mendaftar%20dengan%20email%3A%20${encodeURIComponent(email)}.%20Mohon%20aktivasi%20akun%20saya.`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 w-max px-8 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-lg transition-all shadow-lg shadow-orange-500/30 mb-6 uppercase text-sm tracking-wider"
              >
                <MessageCircle size={16} />
                Konfirmasi via WhatsApp
              </a>
              <br/>
              <button
                onClick={() => { setIsSuccessReg(false); switchView(true); }}
                className="text-white/70 hover:text-white transition-colors text-sm font-bold border-b border-white/30 pb-0.5"
              >
                Kembali ke Login
              </button>
            </motion.div>

          ) : (
          /* ======================== FORM STATE ======================== */
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
                {isLoginView ? "Sign In" : "Buat Akun"}
                <div className="w-full h-0.5 bg-white/40 mt-4 relative shadow-[0_0_10px_rgba(255,255,255,0.5)]">
                  <div className="absolute top-0 left-0 h-full w-1/3 bg-white" />
                </div>
              </h1>

              {/* Belum punya akun / sudah punya akun */}
              <div className="flex flex-col gap-2 text-sm text-white font-medium mb-8 drop-shadow-md">
                {isLoginView ? (
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-white/70">Belum punya akun?</span>
                    <button
                      onClick={() => switchView(false)}
                      className="text-orange-400 font-bold hover:text-orange-300 transition-colors underline decoration-orange-400/30 underline-offset-4 ml-1"
                    >
                      Daftar Sekarang
                    </button>
                    <span className="text-white/40 text-xs hidden sm:inline ml-1">atau hubungi admin via WA</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <span className="text-white/70">Sudah punya akun?</span>
                    <button
                      onClick={() => switchView(true)}
                      className="text-orange-400 font-bold hover:text-orange-300 transition-colors underline decoration-orange-400/30 underline-offset-4 ml-1"
                    >
                      Masuk
                    </button>
                  </div>
                )}
                {!isLoginView && (
                  <p className="text-[10px] text-white/50 italic uppercase tracking-wider">
                    *Akun akan perlu diaktifkan oleh Admin sebelum bisa login.
                  </p>
                )}
              </div>

              {/* Error Message */}
              <AnimatePresence>
                {errorText && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="mb-5 p-4 rounded-xl bg-red-500/20 border border-red-500/40 text-white text-sm font-medium flex items-start gap-2"
                  >
                    <span className="mt-0.5 text-red-400">⚠</span>
                    <span>{errorText}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              <form onSubmit={handleSubmit} className="space-y-4">

                {/* Registration: First & Last Name */}
                {!isLoginView && (
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="relative w-full">
                      <label className="absolute top-2 left-4 text-[10px] uppercase font-bold text-white/70 tracking-wider">First name *</label>
                      <input
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="w-full bg-black/40 backdrop-blur-md hover:bg-black/50 focus:bg-black/60 text-white font-bold px-4 pt-6 pb-2 rounded-xl border border-white/10 focus:border-orange-500/50 outline-none transition-all placeholder-white/30"
                        placeholder="John"
                        required
                      />
                      <UserIcon size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50" />
                    </div>
                    <div className="relative w-full">
                      <label className="absolute top-2 left-4 text-[10px] uppercase font-bold text-white/70 tracking-wider">Last name</label>
                      <input
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="w-full bg-black/40 backdrop-blur-md hover:bg-black/50 focus:bg-black/60 text-white font-bold px-4 pt-6 pb-2 rounded-xl border border-white/10 focus:border-orange-500/50 outline-none transition-all placeholder-white/30"
                        placeholder="Doe"
                      />
                      <UserIcon size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50" />
                    </div>
                  </div>
                )}

                {/* Email */}
                <div className="relative w-full max-w-sm">
                  <label className="absolute top-2 left-4 text-[10px] uppercase font-bold text-white/70 tracking-wider">
                    Email *
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-black/40 backdrop-blur-md hover:bg-black/50 focus:bg-black/60 text-white font-bold px-4 pt-6 pb-2 rounded-xl border border-white/10 focus:border-orange-500/50 outline-none transition-all placeholder-white/30"
                    placeholder="email@domain.com"
                    required
                    autoComplete="email"
                  />
                  <Mail size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50" />
                </div>

                {/* Password */}
                <div className="relative w-full max-w-sm">
                  <label className="absolute top-2 left-4 text-[10px] uppercase font-bold text-white/70 tracking-wider">Password *</label>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-black/40 backdrop-blur-md hover:bg-black/50 focus:bg-black/60 text-white font-bold px-4 pt-6 pb-2 rounded-xl border border-white/10 focus:border-orange-500/50 outline-none transition-all placeholder-white/50 tracking-widest"
                    placeholder="••••••••••••"
                    required
                    autoComplete={isLoginView ? "current-password" : "new-password"}
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors"
                  >
                    {showPassword ? <Eye size={16} /> : <EyeOff size={16} />}
                  </button>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex items-center justify-center gap-2 w-full sm:w-max px-10 py-3 bg-gradient-to-r from-orange-500 to-orange-400 hover:from-orange-400 hover:to-orange-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-black text-sm uppercase tracking-wider rounded-lg transition-all shadow-[0_0_20px_rgba(249,115,22,0.4)] mt-6"
                >
                  {isLoading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Memproses...</span>
                    </>
                  ) : (
                    <span>{isLoginView ? "Login" : "Buat Akun"}</span>
                  )}
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Social Links */}
      <div className="absolute bottom-6 left-8 sm:left-16 md:left-24 z-20 flex gap-4 opacity-90">
        <a href="https://wa.me/085143820659" target="_blank" rel="noreferrer"
          className="w-11 h-11 rounded-xl bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center hover:bg-green-500/80 hover:border-green-400 hover:scale-110 cursor-pointer transition-all shadow-[0_0_15px_rgba(0,0,0,0.5)]">
          <MessageCircle size={20} className="text-white" />
        </a>
        <a href="https://instagram.com/faqihwhy113" target="_blank" rel="noreferrer"
          className="w-11 h-11 rounded-xl bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center hover:bg-pink-500/80 hover:border-pink-400 hover:scale-110 cursor-pointer transition-all shadow-[0_0_15px_rgba(0,0,0,0.5)]">
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
