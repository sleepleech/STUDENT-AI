import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'student';
  status: 'active' | 'pending' | 'suspended';
  joined: string;
  avatar?: string;
}

interface AuthState {
  user: User | null;
  users: User[];
  login: (email: string, role: 'admin' | 'student', name?: string) => void;
  logout: () => void;
  register: (name: string, email: string) => void;
  toggleUserStatus: (id: string) => void;
  deleteUser: (id: string) => void;
  updateProfile: (updates: { avatar?: string; password?: string }) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      users: [
        { id: "1", name: "Ali Rahman", email: "ali@gmail.com", role: "student", status: "active", joined: "2026-04-01" },
        { id: "2", name: "Siti Amelia", email: "siti.a@yahoo.com", role: "student", status: "pending", joined: "2026-04-02" },
        { id: "3", name: "Kevin Wijaya", email: "kevinw@ui.ac.id", role: "student", status: "active", joined: "2026-04-03" },
        { id: "admin-1", name: "Faqih Admin", email: "sleepy", role: "admin", status: "active", joined: "2026-01-01" },
      ],

      login: (email, role, name) => set((state) => {
        // If it's a known user, log them in
        const existingUser = state.users.find(u => u.email === email);
        if (existingUser) {
          return { user: existingUser };
        }
        
        // Otherwise mock a session for the UI if forced
        return {
          user: {
            id: `${Date.now()}`,
            name: name || "User",
            email,
            role,
            status: 'active',
            joined: new Date().toISOString().slice(0, 10),
          }
        };
      }),

      logout: () => {
        set({ user: null });
      },

      register: (name, email) => set((state) => {
        const newUser: User = {
          id: `${Date.now()}`,
          name,
          email,
          role: 'student',
          status: 'pending',
          joined: new Date().toISOString().slice(0, 10),
        };
        return { users: [newUser, ...state.users] };
      }),

      toggleUserStatus: (id) => set((state) => ({
        users: state.users.map(u => 
          u.id === id 
            ? { ...u, status: u.status === 'active' ? 'suspended' : 'active' } 
            : u
        )
      })),

      deleteUser: (id) => set((state) => ({
        users: state.users.filter(u => u.id !== id)
      })),

      updateProfile: (updates) => set((state) => {
        if (!state.user) return state;
        
        const updatedUser = { ...state.user, ...updates };
        
        return {
          user: updatedUser,
          users: state.users.map(u => u.id === state.user!.id ? updatedUser : u),
        };
      }),
    }),
    {
      name: 'nata-sensei-auth',
      storage: createJSONStorage(() => localStorage),
    }
  )
);

