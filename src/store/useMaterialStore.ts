import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

const TTL_MS = 24 * 60 * 60 * 1000; // 24 jam

export interface MaterialItem {
  id: string;
  ownerId?: string; // Add ownerId for privacy
  title: string;
  sourceType: 'pdf' | 'youtube' | 'audio' | 'video';
  savedAt: number;
  summary: any;
  flashcards: any[];
  quiz: any[];
}

interface MaterialState {
  isProcessing: boolean;
  statusText: string;
  activeMaterialId: string | null;
  materialHistory: MaterialItem[];

  setProcessing: (isProcessing: boolean, statusText?: string) => void;
  setActiveMaterial: (data: any, sourceType?: MaterialItem['sourceType']) => void;
  loadMaterial: (id: string) => void;
  deleteMaterial: (id: string) => void;
  clearExpired: () => void;
}

export const useMaterialStore = create<MaterialState>()(
  persist(
    (set) => ({
      isProcessing: false,
      statusText: "Idle",
      activeMaterialId: null,
      materialHistory: [],

      setProcessing: (isProcessing, statusText = "Processing") => set({
        isProcessing,
        statusText: isProcessing ? statusText : "Idle",
      }),

      setActiveMaterial: (data, sourceType = 'pdf') => {
        // Fallback import so we don't have circular dependency issues if any
        const { useAuthStore } = require('./useAuthStore');
        const currentUser = useAuthStore.getState().user;

        const newItem: MaterialItem = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          ownerId: currentUser?.id,
          title: data.summary?.title || 'Materi Tanpa Judul',
          sourceType,
          savedAt: Date.now(),
          summary: data.summary,
          flashcards: data.flashcards || [],
          quiz: data.quiz || [],
        };

        set((state) => ({
          materialHistory: [newItem, ...state.materialHistory].slice(0, 100), // increased from 10 to 100 to support multi-user history
          activeMaterialId: newItem.id,
        }));
      },

      loadMaterial: (id) => set({ activeMaterialId: id }),

      deleteMaterial: (id) => set((state) => ({
        materialHistory: state.materialHistory.filter((m) => m.id !== id),
        activeMaterialId: state.activeMaterialId === id ? null : state.activeMaterialId,
      })),

      clearExpired: () => set((state) => ({
        materialHistory: state.materialHistory.filter(
          (m) => Date.now() - m.savedAt < TTL_MS
        ),
      })),
    }),
    {
      name: 'nata-sensei-material-v2',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        materialHistory: state.materialHistory,
        activeMaterialId: state.activeMaterialId,
      }),
    }
  )
);

// ✅ Selector — gunakan ini di komponen untuk mendapatkan materi aktif
export const selectActiveMaterial = (state: MaterialState): MaterialItem | null =>
  state.materialHistory.find((m) => m.id === state.activeMaterialId) ?? null;
