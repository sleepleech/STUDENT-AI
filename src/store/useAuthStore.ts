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
  avatar?: string;
  xp?: number;
  streak?: number;
}

interface AuthState {
  user: User | null;
  users: User[]; // Full list for admin
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

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  users: [],
  isLoading: false,

  updateProfile: async (updates) => {
    const user = get().user;
    if (!user) return;

    if (updates.password) {
      await supabase.auth.updateUser({ password: updates.password });
    }

    const { error } = await supabase
      .from('profiles')
      .update({ 
        name: updates.name || user.name,
        avatar: updates.avatar
      })
      .eq('id', user.id);

    if (!error) await get().syncProfile();
  },

  /**
   * Real Supabase Login with Admin Approval Guard
   */
  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: password || '12345678',
      });
      if (error) throw error;

      // Fetch profile from central database
      const { data: profile, error: profErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (profErr) throw profErr;

      // --- ADMIN APPROVAL GUARD ---
      if (profile.role !== 'admin') {
        if (profile.status === 'pending') {
          await supabase.auth.signOut();
          throw new Error("Akun Anda sedang menunggu persetujuan Admin Berwenang.");
        }
        if (profile.status === 'suspended') {
          await supabase.auth.signOut();
          throw new Error("Akun Anda telah dinonaktifkan oleh Admin.");
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
          xp: profile.xp,
          streak: profile.streak,
        },
        isLoading: false
      });
    } catch (err: any) {
      set({ isLoading: false });
      throw err;
    }
  },

  /**
   * Real Supabase Registration with Default 'pending' Status
   */
  register: async (name, email, password) => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password: password || '12345678',
        options: { data: { name } }
      });
      if (error) throw error;
      if (!data.user) throw new Error("Gagal mendaftar.");

      // Create central profile with PENDING status
      const { error: profErr } = await supabase.from('profiles').insert({
        id: data.user.id,
        name,
        email,
        role: 'student',
        status: 'pending', // Wajib diatur admin untuk aktif
      });
      if (profErr) throw profErr;

      set({ isLoading: false });
    } catch (err: any) {
      set({ isLoading: false });
      throw err;
    }
  },

  logout: async () => {
    await supabase.auth.signOut();
    set({ user: null });
  },

  /**
   * Keep Session in Sync (Auto-load on refresh)
   */
  syncProfile: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profile) {
      set({
        user: {
          id: user.id,
          name: profile.name,
          email: profile.email,
          role: profile.role as any,
          status: profile.status as any,
          joined: profile.joined_at,
          xp: profile.xp,
          streak: profile.streak,
        }
      });
    }
  },

  /**
   * ADMIN: Fetch all registered users from Cloud
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
          xp: p.xp,
          streak: p.streak
        }))
      });
    }
  },

  toggleUserStatus: async (id, currentStatus) => {
    const next = currentStatus === 'active' ? 'suspended' : 'active';
    await supabase.from('profiles').update({ status: next }).eq('id', id);
    await get().fetchAllProfiles();
  },

  deleteUser: async (id) => {
    await supabase.from('profiles').delete().eq('id', id);
    await get().fetchAllProfiles();
  }
}));
