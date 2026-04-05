import { create } from 'zustand';
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

export interface MaterialItem {
  id: string;
  ownerId?: string;
  title: string;
  sourceType: 'pdf' | 'youtube' | 'audio' | 'video';
  savedAt: string; // ISO string for cloud
  summary: any;
  flashcards: any[];
  quiz: any[];
}

interface MaterialState {
  isProcessing: boolean;
  statusText: string;
  activeMaterialId: string | null;
  materialHistory: MaterialItem[];

  fetchMaterials: () => Promise<void>;
  setProcessing: (isProcessing: boolean, statusText?: string) => void;
  setActiveMaterial: (data: any, sourceType?: MaterialItem['sourceType']) => void;
  loadMaterial: (id: string) => void;
  deleteMaterial: (id: string) => Promise<void>;
}

export const useMaterialStore = create<MaterialState>((set, get) => ({
  isProcessing: false,
  statusText: "Idle",
  activeMaterialId: null,
  materialHistory: [],

  setProcessing: (isProcessing, statusText = "Processing") => set({
    isProcessing,
    statusText: isProcessing ? statusText : "Idle",
  }),

  /**
   * Fetch from Supabase Cloud (Sync Desktop/Mobile)
   */
  fetchMaterials: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('materials')
        .select('*, flashcards(*), quizzes(*)')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error("❌ Supabase Fetch Error:", error.message);
        return;
      }

      if (data) {
        console.log("📊 Raw Materials Data:", data); // Check relationship names in console
        const items: MaterialItem[] = data.map(m => ({
          id: m.id,
          ownerId: m.owner_id,
          title: m.title,
          sourceType: m.source_type as any,
          savedAt: m.created_at,
          summary: m.summary,
          flashcards: m.flashcards || [],
          // Handle both singular and plural quiz mappings
          quiz: (m.quizzes?.[0]?.questions) || (m.quiz?.[0]?.questions) || []
        }));
        set({ materialHistory: items });
      }
    } catch (err) {
      console.error("❌ Store Sync Error:", err);
    }
  },

  setActiveMaterial: (data, sourceType = 'pdf') => {
    if (data.id) {
       set({ activeMaterialId: data.id });
       get().fetchMaterials(); 
    }
  },

  loadMaterial: (id) => set({ activeMaterialId: id }),

  deleteMaterial: async (id) => {
    await supabase.from('materials').delete().eq('id', id);
    set((state) => ({
      materialHistory: state.materialHistory.filter((m) => m.id !== id),
      activeMaterialId: state.activeMaterialId === id ? null : state.activeMaterialId,
    }));
  },
}));

export const selectActiveMaterial = (state: MaterialState): MaterialItem | null =>
  state.materialHistory.find((m) => m.id === state.activeMaterialId) ?? null;

