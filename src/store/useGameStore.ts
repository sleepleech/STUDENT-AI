import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useAuthStore } from './useAuthStore';

// ===== Belt Rank System =====
export interface Belt {
  name: string;
  emoji: string;
  minXP: number;
  color: string;
  bg: string;
}

export const BELTS: Belt[] = [
  { name: 'White Belt',  emoji: '🥋', minXP: 0,    color: 'text-gray-300',   bg: 'bg-gray-400/15' },
  { name: 'Yellow Belt', emoji: '🟡', minXP: 300,  color: 'text-yellow-400', bg: 'bg-yellow-400/15' },
  { name: 'Orange Belt', emoji: '🟠', minXP: 800,  color: 'text-orange-400', bg: 'bg-orange-400/15' },
  { name: 'Green Belt',  emoji: '🟢', minXP: 1500, color: 'text-green-400',  bg: 'bg-green-400/15' },
  { name: 'Blue Belt',   emoji: '🔵', minXP: 2500, color: 'text-blue-400',   bg: 'bg-blue-400/15' },
  { name: 'Brown Belt',  emoji: '🟤', minXP: 4000, color: 'text-amber-700',  bg: 'bg-amber-700/15' },
  { name: 'Black Belt',  emoji: '⬛', minXP: 6500, color: 'text-purple-300', bg: 'bg-purple-400/15' },
];

export function getBelt(xp: number): Belt {
  return [...BELTS].reverse().find((b) => xp >= b.minXP) ?? BELTS[0];
}

export function getLevel(xp: number): number {
  return Math.floor(xp / 300) + 1;
}

export function getXPForNextBelt(xp: number): { current: number; required: number; percent: number } {
  const currentBeltIdx = [...BELTS].reverse().findIndex((b) => xp >= b.minXP);
  const nextBelt = BELTS[BELTS.length - 1 - currentBeltIdx + 1];
  if (!nextBelt) return { current: xp, required: xp, percent: 100 };
  const currentBelt = getBelt(xp);
  const range = nextBelt.minXP - currentBelt.minXP;
  const progress = xp - currentBelt.minXP;
  return { current: progress, required: range, percent: Math.min(100, Math.round((progress / range) * 100)) };
}

// ===== Activity Log =====
export interface ActivityEntry {
  date: string; // YYYY-MM-DD
  xpEarned: number;
  action: string;
}

// ===== XP Actions =====
export const XP_REWARDS = {
  UPLOAD_MATERIAL: 50,
  COMPLETE_QUIZ_CORRECT: 15,
  COMPLETE_QUIZ_WRONG: 3,
  VIEW_FLASHCARD: 2,
  USE_CHAT: 1,
  DAILY_LOGIN: 20,
};

// ===== Store =====
export interface UserGameState {
  xp: number;
  streak: number;
  lastActiveDate: string | null; // YYYY-MM-DD
  todayXP: number;
  activityLog: ActivityEntry[];
  totalMaterialsProcessed: number;
  totalQuizAnswered: number;
  totalFlashcardsViewed: number;
}

interface InternalGameState {
  users: Record<string, UserGameState>;
  addXP: (userId: string, amount: number, action: string) => void;
  checkDailyLogin: (userId: string) => void;
  incrementMaterials: (userId: string) => void;
  incrementQuiz: (userId: string, correct: boolean) => void;
  incrementFlashcard: (userId: string) => void;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

const defaultUserState: UserGameState = {
  xp: 0,
  streak: 0,
  lastActiveDate: null,
  todayXP: 0,
  activityLog: [],
  totalMaterialsProcessed: 0,
  totalQuizAnswered: 0,
  totalFlashcardsViewed: 0,
};

export const useGameStoreInternal = create<InternalGameState>()(
  persist(
    (set, get) => ({
      users: {},

      addXP: (userId, amount, action) => {
        const today = todayStr();
        set((state) => {
          const userState = state.users[userId] || defaultUserState;
          
          const isNewDay = userState.lastActiveDate !== today;
          const newStreak = isNewDay
            ? userState.lastActiveDate === yesterdayStr() ? userState.streak + 1 : 1
            : userState.streak;

          const entry: ActivityEntry = { date: today, xpEarned: amount, action };
          const newLog = [entry, ...userState.activityLog].slice(0, 500);

          return {
            users: {
              ...state.users,
              [userId]: {
                ...userState,
                xp: userState.xp + amount,
                streak: newStreak,
                lastActiveDate: today,
                todayXP: isNewDay ? amount : userState.todayXP + amount,
                activityLog: newLog,
              }
            }
          };
        });
      },

      checkDailyLogin: (userId) => {
        const today = todayStr();
        const userState = get().users[userId] || defaultUserState;
        if (userState.lastActiveDate !== today) {
          get().addXP(userId, XP_REWARDS.DAILY_LOGIN, 'Login Harian');
        }
      },

      incrementMaterials: (userId) => {
        set((state) => {
          const userState = state.users[userId] || defaultUserState;
          return {
            users: {
              ...state.users,
              [userId]: { ...userState, totalMaterialsProcessed: userState.totalMaterialsProcessed + 1 }
            }
          };
        });
        get().addXP(userId, XP_REWARDS.UPLOAD_MATERIAL, 'Upload Materi');
      },

      incrementQuiz: (userId, correct) => {
        const xp = correct ? XP_REWARDS.COMPLETE_QUIZ_CORRECT : XP_REWARDS.COMPLETE_QUIZ_WRONG;
        set((state) => {
          const userState = state.users[userId] || defaultUserState;
          return {
            users: {
              ...state.users,
              [userId]: { ...userState, totalQuizAnswered: userState.totalQuizAnswered + 1 }
            }
          };
        });
        get().addXP(userId, xp, correct ? 'Quiz Benar ✅' : 'Quiz Salah');
      },

      incrementFlashcard: (userId) => {
        set((state) => {
          const userState = state.users[userId] || defaultUserState;
          return {
            users: {
              ...state.users,
              [userId]: { ...userState, totalFlashcardsViewed: userState.totalFlashcardsViewed + 1 }
            }
          };
        });
        get().addXP(userId, XP_REWARDS.VIEW_FLASHCARD, 'Lihat Flashcard');
      },
    }),
    {
      name: 'nata-sensei-game-v2', // bump version to reset state
      storage: createJSONStorage(() => localStorage),
    }
  )
);

// Wrapper Hook that maintains the exact same API as the old useGameStore
export function useGameStore() {
  const { user } = useAuthStore();
  const userId = user?.id || 'guest';
  const store = useGameStoreInternal();
  
  const userState = store.users[userId] || defaultUserState;
  
  return {
    ...userState,
    addXP: (amount: number, action: string) => store.addXP(userId, amount, action),
    checkDailyLogin: () => store.checkDailyLogin(userId),
    incrementMaterials: () => store.incrementMaterials(userId),
    incrementQuiz: (correct: boolean) => store.incrementQuiz(userId, correct),
    incrementFlashcard: () => store.incrementFlashcard(userId),
  };
}
