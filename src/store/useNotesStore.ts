import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface Note {
  id: string;
  subjectId: string;
  title: string;
  content: string;
  isPinned: boolean;
  createdAt: number;
  updatedAt: number;
  linkedMaterialId?: string; // Optional: link to an AI material
}

export interface Subject {
  id: string;
  name: string;
  emoji: string;
  color: string; // tailwind color class
  createdAt: number;
}

const SUBJECT_COLORS = [
  { bg: 'bg-violet-500/20', border: 'border-violet-500/30', text: 'text-violet-400', dot: 'bg-violet-500' },
  { bg: 'bg-blue-500/20', border: 'border-blue-500/30', text: 'text-blue-400', dot: 'bg-blue-500' },
  { bg: 'bg-green-500/20', border: 'border-green-500/30', text: 'text-green-400', dot: 'bg-green-500' },
  { bg: 'bg-orange-500/20', border: 'border-orange-500/30', text: 'text-orange-400', dot: 'bg-orange-500' },
  { bg: 'bg-pink-500/20', border: 'border-pink-500/30', text: 'text-pink-400', dot: 'bg-pink-500' },
  { bg: 'bg-cyan-500/20', border: 'border-cyan-500/30', text: 'text-cyan-400', dot: 'bg-cyan-500' },
  { bg: 'bg-yellow-500/20', border: 'border-yellow-500/30', text: 'text-yellow-400', dot: 'bg-yellow-500' },
  { bg: 'bg-red-500/20', border: 'border-red-500/30', text: 'text-red-400', dot: 'bg-red-500' },
];

export const COLORS = SUBJECT_COLORS;

interface NotesState {
  subjects: Subject[];
  notes: Note[];
  activeSubjectId: string | null;
  
  addSubject: (name: string, emoji: string) => void;
  deleteSubject: (id: string) => void;
  setActiveSubject: (id: string | null) => void;
  
  addNote: (subjectId: string, title: string) => string;
  updateNote: (id: string, fields: Partial<Pick<Note, 'title' | 'content' | 'isPinned'>>) => void;
  deleteNote: (id: string) => void;
  
  getNotesForSubject: (subjectId: string) => Note[];
  searchNotes: (query: string) => Note[];
}

export const useNotesStore = create<NotesState>()(
  persist(
    (set, get) => ({
      subjects: [],
      notes: [],
      activeSubjectId: null,

      addSubject: (name, emoji) => {
        const colorIndex = get().subjects.length % SUBJECT_COLORS.length;
        const newSubject: Subject = {
          id: `subj-${Date.now()}`,
          name,
          emoji,
          color: colorIndex.toString(),
          createdAt: Date.now(),
        };
        set((state) => ({ subjects: [...state.subjects, newSubject] }));
      },

      deleteSubject: (id) => set((state) => ({
        subjects: state.subjects.filter((s) => s.id !== id),
        notes: state.notes.filter((n) => n.subjectId !== id),
        activeSubjectId: state.activeSubjectId === id ? null : state.activeSubjectId,
      })),

      setActiveSubject: (id) => set({ activeSubjectId: id }),

      addNote: (subjectId, title) => {
        const id = `note-${Date.now()}`;
        const newNote: Note = {
          id,
          subjectId,
          title: title || 'Catatan Baru',
          content: '',
          isPinned: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set((state) => ({ notes: [newNote, ...state.notes] }));
        return id;
      },

      updateNote: (id, fields) => set((state) => ({
        notes: state.notes.map((n) =>
          n.id === id ? { ...n, ...fields, updatedAt: Date.now() } : n
        ),
      })),

      deleteNote: (id) => set((state) => ({
        notes: state.notes.filter((n) => n.id !== id),
      })),

      getNotesForSubject: (subjectId) => {
        const { notes } = get();
        const subjectNotes = notes.filter((n) => n.subjectId === subjectId);
        return [
          ...subjectNotes.filter((n) => n.isPinned),
          ...subjectNotes.filter((n) => !n.isPinned),
        ];
      },

      searchNotes: (query) => {
        if (!query.trim()) return [];
        const q = query.toLowerCase();
        return get().notes.filter(
          (n) => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)
        );
      },
    }),
    {
      name: 'nata-sensei-notes',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
