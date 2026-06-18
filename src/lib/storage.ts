import type { GameState } from './types';

const STORAGE_KEY = 'familien-reich-state-v1';
const USER_KEY = 'familien-reich-active-user-v1';

export function loadState<T>(fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function saveState(state: GameState): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function loadActiveUserId(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(USER_KEY);
}

export function saveActiveUserId(userId: string): void {
  window.localStorage.setItem(USER_KEY, userId);
}

export function resetPersistedState(): void {
  window.localStorage.removeItem(STORAGE_KEY);
  window.localStorage.removeItem(USER_KEY);
}
