"use client";
import { useState, useRef, useEffect } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { Camera, Save, Lock, Mail, User as UserIcon, AlertCircle } from "lucide-react";

export default function SettingsPage() {
  const { user, updateProfile } = useAuthStore();
  
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user?.avatar) {
      setAvatarPreview(user.avatar);
    }
  }, [user]);

  if (!user) return null;

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setMessage({ type: 'error', text: 'Ukuran gambar maksimal 2MB' });
        return;
      }
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
        setMessage(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    setMessage(null);
    setIsSaving(true);
    
    // Validate passwords if user wants to change it
    if (password || confirmPassword) {
      if (password !== confirmPassword) {
        setMessage({ type: 'error', text: 'Password dan Konfirmasi Password tidak cocok!' });
        setIsSaving(false);
        return;
      }
      if (password.length < 6) {
        setMessage({ type: 'error', text: 'Password min. 6 karakter!' });
        setIsSaving(false);
        return;
      }
    }

    // Process save
    setTimeout(() => {
      const updates: { avatar?: string; password?: string } = {};
      if (avatarPreview && avatarPreview !== user.avatar) {
        updates.avatar = avatarPreview;
      }
      if (password) {
        updates.password = password; // dummy store
      }
      
      updateProfile(updates);
      setPassword("");
      setConfirmPassword("");
      setMessage({ type: 'success', text: 'Profil berhasil diperbarui!' });
      setIsSaving(false);
      
      // Auto-hide success message
      setTimeout(() => setMessage(null), 3000);
    }, 800);
  };

  return (
    <div className="w-full max-w-2xl mx-auto pb-20 pt-4">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Pengaturan Akun</h1>
        <p className="text-sm text-muted-foreground mt-1">Kelola preferensi dan profil akun Anda.</p>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        
        {/* Avatar Section */}
        <div className="p-8 flex flex-col items-center justify-center border-b border-border/50 relative bg-gradient-to-b from-primary/10 to-transparent">
          <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
            <div className="w-24 h-24 rounded-full bg-accent border-4 border-card flex items-center justify-center overflow-hidden shadow-xl mb-2">
              {avatarPreview ? (
                <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl font-bold text-muted-foreground uppercase">{user.name.charAt(0)}</span>
              )}
            </div>
            
            <div className="absolute inset-0 w-24 h-24 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white transition-opacity border-4 border-transparent">
              <Camera size={24} />
              <span className="text-[10px] font-bold mt-1 uppercase tracking-wider">Ubah</span>
            </div>
          </div>
          
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*" 
            onChange={handleImageChange}
          />
          <p className="text-xs text-muted-foreground">Klik foto untuk mengganti avatar</p>
        </div>

        {/* Form Section */}
        <div className="p-6 md:p-8 space-y-6">
          
          {message && (
            <div className={`p-4 rounded-xl flex items-center gap-3 text-sm ${message.type === 'error' ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-green-500/10 text-green-500 border border-green-500/20'}`}>
              <AlertCircle size={18} />
              <span>{message.text}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Nama Lengkap</label>
              <div className="relative">
                <UserIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input 
                  type="text" 
                  value={user.name} 
                  disabled 
                  className="w-full pl-10 pr-4 py-2.5 bg-accent/50 border border-border rounded-xl text-sm text-foreground/70 cursor-not-allowed opacity-80"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Alamat Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input 
                  type="text" 
                  value={user.email} 
                  disabled 
                  className="w-full pl-10 pr-4 py-2.5 bg-accent/50 border border-border rounded-xl text-sm text-foreground/70 cursor-not-allowed opacity-80"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-border/50 space-y-6">
            <h3 className="text-sm font-bold text-foreground">Keamanan Akun</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Password Baru</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input 
                    type="password" 
                    placeholder="Kosongkan jika tidak diubah"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground focus:border-primary/50 outline-none transition-all"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Konfirmasi Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input 
                    type="password" 
                    placeholder="Ulangi password baru"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground focus:border-primary/50 outline-none transition-all"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 bg-muted/20 border-t border-border flex items-center justify-end">
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-2.5 bg-primary hover:bg-primary/90 disabled:opacity-50 text-white font-bold rounded-xl transition-all shadow-md shadow-primary/20"
          >
            {isSaving ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Save size={18} />
            )}
            Simpan Perubahan
          </button>
        </div>

      </div>
    </div>
  );
}
