import { createStore } from 'solid-js/store';
import { createContext, useContext, createEffect } from 'solid-js';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeState {
  mode: ThemeMode;
  resolvedMode: 'light' | 'dark';
}

const getSystemTheme = (): 'light' | 'dark' => {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const getResolvedMode = (mode: ThemeMode): 'light' | 'dark' => {
  if (mode === 'system') {
    return getSystemTheme();
  }
  return mode;
};

const storedMode = (typeof localStorage !== 'undefined' 
  ? localStorage.getItem('theme_mode') as ThemeMode 
  : null) || 'system';

const initialState: ThemeState = {
  mode: storedMode,
  resolvedMode: getResolvedMode(storedMode),
};

const [state, setState] = createStore<ThemeState>(initialState);

export const themeStore = {
  get state() {
    return state;
  },

  setMode(mode: ThemeMode) {
    setState('mode', mode);
    setState('resolvedMode', getResolvedMode(mode));
    localStorage.setItem('theme_mode', mode);
    this.applyTheme();
  },

  toggle() {
    const newMode = state.resolvedMode === 'light' ? 'dark' : 'light';
    this.setMode(newMode);
  },

  applyTheme() {
    if (typeof document === 'undefined') return;
    
    const root = document.documentElement;
    if (state.resolvedMode === 'dark') {
      root.classList.add('dark');
      root.setAttribute('data-theme', 'dark');
    } else {
      root.classList.remove('dark');
      root.setAttribute('data-theme', 'light');
    }
  },

  init() {
    this.applyTheme();

    // Listen for system theme changes
    if (typeof window !== 'undefined') {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (state.mode === 'system') {
          setState('resolvedMode', e.matches ? 'dark' : 'light');
          this.applyTheme();
        }
      });
    }
  },
};

export const ThemeContext = createContext(themeStore);

export function useTheme() {
  return useContext(ThemeContext);
}
