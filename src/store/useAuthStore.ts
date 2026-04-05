import { create } from 'zustand';
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'student';
  status: 'active' | 'pending' | 'suspended';
  joined: string;
  avatar?: string;   // maps to avatar_url in DB
  xp?: number;
  streak?: number;
  beltRank?: string;
}

interface AuthState {
  user: User | null;
  users: User[];
  isLoading: boolean;

  // Cloud Actions
  login: (email: string, password?: string) => Promise<void>;
  register: (name: string, email: string, password?: string) => Promise<void>;
  logout: () => Promise<void>;
  syncProfile: () => Promise<void>;
  fetchAllProfiles: () => Promise<void>;

  // Admin Actions
  toggleUserStatus: (id: string, currentStatus: string) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;

  // Profile Actions
  updateProfile: (updates: { avatar?: string; password?: string; name?: string }) => Promise<void>;
}

// Helper: terjemahkan pesan error Supabase ke Bahasa Indonesia
function translateError(msg: string): string {
  if (msg.includes('Invalid login credentials'))
    return 'Email atau password salah. Coba lagi.';
  if (msg.includes('Email not confirmed'))
    return 'Email belum dikonfirmasi. Hubungi admin untuk mengaktifkan akun.';
  if (msg.includes('User already registered'))
    return 'Email ini sudah terdaftar. Silakan login.';
  if (msg.includes('Password should be at least'))
    return 'Password minimal 6 karakter.';
  if (msg.includes('Unable to validate email address'))
    return 'Format email tidak valid.';
  if (msg.includes('signup is disabled'))
    return 'Pendaftaran sedang dinonaktifkan. Hubungi admin.';
  return msg;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  users: [],
  isLoading: false,

  updateProfile: async (updates) => {
    const user = get().user;
    if (!user) return;

    if (updates.password) {
      const { error } = await supabase.auth.updateUser({ password: updates.password });
      if (error) throw new Error(translateError(error.message));
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        name: updates.name || user.name,
        avatar_url: updates.avatar,
      })
      .eq('id', user.id);

    if (error) throw new Error(translateError(error.message));
    await get().syncProfile();
  },

  /**
   * Login dengan Supabase + Admin Approval Guard
   */
  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password || '12345678',
      });
      if (error) throw new Error(translateError(error.message));

      // Ambil profil dari database
      const { data: profile, error: profErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (profErr || !profile) {
        await supabase.auth.signOut();
        throw new Error('Profil akun tidak ditemukan. Hubungi admin.');
      }

      // Guard: cek status akun (kecuali admin)
      if (profile.role !== 'admin') {
        if (profile.status === 'pending') {
          await supabase.auth.signOut();
          throw new Error('Akun Anda sedang menunggu persetujuan admin. Hubungi admin via WhatsApp.');
        }
        if (profile.status === 'suspended') {
          await supabase.auth.signOut();
          throw new Error('Akun Anda telah dinonaktifkan oleh admin.');
        }
      }

      set({
        user: {
          id: data.user.id,
          name: profile.name,
          email: profile.email,
          role: profile.role as any,
          status: profile.status as any,
          joined: profile.joined_at,
          xp: profile.xp ?? 0,
          streak: profile.streak ?? 0,
          avatar: profile.avatar_url,
          beltRank: profile.belt_rank,
        },
        isLoading: false
      });
    } catch (err: any) {
      set({ isLoading: false });
      throw err;
    }
  },

  /**
   * Registrasi dengan status 'pending' (butuh persetujuan admin)
   */
  register: async (name, email, password) => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password || '12345678',
        options: { data: { name } }
      });

      if (error) throw new Error(translateError(error.message));
      if (!data.user) throw new Error('Gagal mendaftar. Coba lagi.');

      // Buat profil dengan status pending (butuh aktivasi admin)
      const { error: profErr } = await supabase.from('profiles').upsert({
        id: data.user.id,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role: 'student',
        status: 'pending',
        joined_at: new Date().toISOString(),
        xp: 0,
        streak: 0,
        belt_rank: 'White Belt',
      }, { onConflict: 'id' });

      if (profErr) throw new Error('Akun dibuat, namun gagal menyimpan profil. Hubungi admin.');

      set({ isLoading: false });
    } catch (err: any) {
      set({ isLoading: false });
      throw err;
    }
  },

  logout: async () => {
    await supabase.auth.signOut();
    set({ user: null, users: [] });
  },

  /**
   * Sinkronisasi profil dari cloud (dipanggil saat page load)
   */
  syncProfile: async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        set({ user: null });
        return;
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (error || !profile) {
        // Auth user ada tapi profil belum ada — mungkin belum confirmed
        set({ user: null });
        return;
      }

      set({
        user: {
          id: authUser.id,
          name: profile.name,
          email: profile.email,
          role: profile.role as any,
          status: profile.status as any,
          joined: profile.joined_at,
          xp: profile.xp ?? 0,
          streak: profile.streak ?? 0,
          avatar: profile.avatar_url,
          beltRank: profile.belt_rank,
        }
      });
    } catch {
      set({ user: null });
    }
  },

  /**
   * ADMIN: Ambil semua user dari cloud
   */
  fetchAllProfiles: async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('joined_at', { ascending: false });

    if (!error && data) {
      set({
        users: data.map(p => ({
          id: p.id,
          name: p.name,
          email: p.email,
          role: p.role as any,
          status: p.status as any,
          joined: p.joined_at,
          xp: p.xp ?? 0,
          streak: p.streak ?? 0,
          avatar: p.avatar_url,
          beltRank: p.belt_rank,
        }))
      });
    }
  },

  toggleUserStatus: async (id, currentStatus) => {
    const next = currentStatus === 'active' ? 'suspended' : 'active';
    const { error } = await supabase.from('profiles').update({ status: next }).eq('id', id);
    if (!error) await get().fetchAllProfiles();
  },

  deleteUser: async (id) => {
    // Hapus profil dari tabel profiles
    const { error } = await supabase.from('profiles').delete().eq('id', id);
    if (!error) await get().fetchAllProfiles();
  }
}));
