import { createSignal, createEffect } from 'solid-js';

export type Theme = 'light' | 'dark' | 'system';

// Get system preference
function getSystemTheme(): 'light' | 'dark' {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

// Get saved theme or default
function getInitialTheme(): Theme {
  try {
    const saved = localStorage.getItem('guardio_theme');
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      return saved;
    }
  } catch (e) {}
  return 'system';
}

const [theme, setThemeSignal] = createSignal<Theme>(getInitialTheme());
const [activeTheme, setActiveTheme] = createSignal<'light' | 'dark'>(
  getInitialTheme() === 'system' ? getSystemTheme() : getInitialTheme() as 'light' | 'dark'
);

// Apply theme to document
function applyTheme(t: 'light' | 'dark') {
  const root = document.documentElement;
  
  if (t === 'dark') {
    root.classList.add('dark');
    root.style.setProperty('--bg-primary', '#0f172a');
    root.style.setProperty('--bg-secondary', '#1e293b');
    root.style.setProperty('--bg-card', 'rgba(30, 41, 59, 0.8)');
    root.style.setProperty('--text-primary', '#f1f5f9');
    root.style.setProperty('--text-secondary', '#94a3b8');
    root.style.setProperty('--text-muted', '#64748b');
    root.style.setProperty('--border-color', 'rgba(148, 163, 184, 0.1)');
    root.style.setProperty('--glass-bg', 'rgba(30, 41, 59, 0.85)');
    root.style.setProperty('--glass-border', 'rgba(148, 163, 184, 0.15)');
    root.style.setProperty('--input-bg', 'rgba(51, 65, 85, 0.5)');
  } else {
    root.classList.remove('dark');
    root.style.setProperty('--bg-primary', '#f0f4ff');
    root.style.setProperty('--bg-secondary', '#ffffff');
    root.style.setProperty('--bg-card', 'rgba(255, 255, 255, 0.8)');
    root.style.setProperty('--text-primary', '#1e293b');
    root.style.setProperty('--text-secondary', '#64748b');
    root.style.setProperty('--text-muted', '#94a3b8');
    root.style.setProperty('--border-color', 'rgba(0, 0, 0, 0.05)');
    root.style.setProperty('--glass-bg', 'rgba(255, 255, 255, 0.7)');
    root.style.setProperty('--glass-border', 'rgba(255, 255, 255, 0.3)');
    root.style.setProperty('--input-bg', 'rgba(241, 245, 249, 0.8)');
  }
  
  // Update meta theme-color for mobile browsers
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', t === 'dark' ? '#0f172a' : '#f0f4ff');
  }
}

// Listen to system theme changes
if (typeof window !== 'undefined' && window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (theme() === 'system') {
      const newTheme = e.matches ? 'dark' : 'light';
      setActiveTheme(newTheme);
      applyTheme(newTheme);
    }
  });
}

// React to theme changes
createEffect(() => {
  const t = theme();
  let active: 'light' | 'dark';
  
  if (t === 'system') {
    active = getSystemTheme();
  } else {
    active = t;
  }
  
  setActiveTheme(active);
  applyTheme(active);
  
  try {
    localStorage.setItem('guardio_theme', t);
  } catch (e) {}
});

export function setTheme(t: Theme) {
  setThemeSignal(t);
}

export function toggleTheme() {
  const current = activeTheme();
  setTheme(current === 'dark' ? 'light' : 'dark');
}

export function isDark(): boolean {
  return activeTheme() === 'dark';
}

export { theme, activeTheme };
