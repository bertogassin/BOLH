// ═══════════════════════════════════════════════════════════════
// BOLH Global Store — single source of truth for app state
// ═══════════════════════════════════════════════════════════════
import { createSignal, createEffect } from 'solid-js';
import { getDepartment } from './departments';

// ── Tauri v2 invoke ──
export const tauriCoreInvoke = (cmd: string, args?: Record<string, unknown>): Promise<any> => {
  const w = window as any;
  if (w.__TAURI_INTERNALS__?.invoke) return w.__TAURI_INTERNALS__.invoke(cmd, args || {});
  return Promise.reject(new Error('Tauri internals not available'));
};

// ── Department / Worker state ──
export const [activeDepartment, setActiveDepartment] = createSignal<string | null>(null);
export const [workerSkills, setWorkerSkills] = createSignal<string[]>([]);
export const [verifiedDiplomas, setVerifiedDiplomas] = createSignal<string[]>([]);
export const [workerStatus, setWorkerStatus] = createSignal<'online' | 'busy' | 'offline'>('online');
export const [busyUntil, setBusyUntil] = createSignal<string | null>(null);
export const [autoOnlineTime, setAutoOnlineTime] = createSignal<string>('');

// ── Profile mode ──
export const [profileMode, setProfileMode] = createSignal<'worker' | 'client'>('worker');
export const [clientNeeds, setClientNeeds] = createSignal<string[]>([]);

// ── Home screen mode ──
export const [homeMode, setHomeMode] = createSignal<'search' | 'order'>('search');
export const [homeExpandedDept, setHomeExpandedDept] = createSignal<string | null>(null);
export const [homeExpandedGroup, setHomeExpandedGroup] = createSignal<string | null>(null);
export const [homeExpandedSkill, setHomeExpandedSkill] = createSignal<string | null>(null);

export const getActiveDept = () => activeDepartment() ? getDepartment(activeDepartment()!) : null;

// ══════════ MY BOARD — smart personal panel ══════════
export type BoardItem = { id: string; type: 'skill' | 'dept'; source: 'auto' | 'manual'; active: boolean; role?: 'worker' | 'client' | 'course' };
const BOARD_KEY = 'bolh_board_v2';

const _migrateBoard = (): BoardItem[] => {
  try {
    const v2 = localStorage.getItem(BOARD_KEY);
    if (v2) return JSON.parse(v2);
    const oldDepts: string[] = JSON.parse(localStorage.getItem('bolh_myboard_v1') || '[]');
    const oldSkills: string[] = JSON.parse(localStorage.getItem('bolh_myboard_skills_v1') || '[]');
    const items: BoardItem[] = [
      ...oldDepts.map(id => ({ id, type: 'dept' as const, source: 'manual' as const, active: true, role: 'worker' as const })),
      ...oldSkills.map(id => ({ id, type: 'skill' as const, source: 'manual' as const, active: true, role: 'worker' as const })),
    ];
    if (items.length) localStorage.setItem(BOARD_KEY, JSON.stringify(items));
    return items;
  } catch { return []; }
};

export const [boardItems, setBoardItems] = createSignal<BoardItem[]>(_migrateBoard());
createEffect(() => { try { localStorage.setItem(BOARD_KEY, JSON.stringify(boardItems())); } catch {} });

// Board helpers
export const boardHas = (id: string) => boardItems().some(b => b.id === id);
export const boardGet = (id: string) => boardItems().find(b => b.id === id);
export const boardIsActive = (id: string) => boardGet(id)?.active ?? false;

export const boardAdd = (id: string, type: 'skill' | 'dept', source: 'auto' | 'manual', role: 'worker' | 'client' | 'course' = 'worker') => {
  if (!boardHas(id)) setBoardItems(prev => [...prev, { id, type, source, active: true, role }]);
};
export const boardRemove = (id: string) => {
  setBoardItems(prev => prev.filter(b => b.id !== id));
};
export const boardToggleActive = (id: string) => {
  setBoardItems(prev => prev.map(b => b.id === id ? { ...b, active: !b.active } : b));
};
export const boardSetAllActive = (active: boolean) => {
  setBoardItems(prev => prev.map(b => ({ ...b, active })));
};

// Auto-sync: workerSkills and clientNeeds auto-populate board
createEffect(() => {
  const ws = workerSkills();
  const cn = clientNeeds();
  setBoardItems(prev => {
    let next = [...prev];
    for (const sid of ws) {
      if (!next.some(b => b.id === sid)) next.push({ id: sid, type: 'skill', source: 'auto', active: true, role: 'worker' });
    }
    for (const sid of cn) {
      if (!next.some(b => b.id === sid)) next.push({ id: sid, type: 'skill', source: 'auto', active: true, role: 'client' });
    }
    next = next.filter(b => {
      if (b.source !== 'auto') return true;
      if (b.role === 'worker') return ws.includes(b.id);
      if (b.role === 'client') return cn.includes(b.id);
      return true;
    });
    return next;
  });
});

// ── Legacy compat wrappers (used by pages) ──
export const pinnedDepts = () => boardItems().filter(b => b.type === 'dept').map(b => b.id);
export const pinnedSkills = () => boardItems().filter(b => b.type === 'skill').map(b => b.id);
export const togglePin = (deptId: string) => boardHas(deptId) ? boardRemove(deptId) : boardAdd(deptId, 'dept', 'manual');
export const togglePinSkill = (skillId: string) => boardHas(skillId) ? boardRemove(skillId) : boardAdd(skillId, 'skill', 'manual');

export const setPinnedDepts = (deptIds: string[]) => {
  setBoardItems(prev => [
    ...prev.filter(b => !(b.type === 'dept' && b.source === 'manual')),
    ...deptIds.map(id => ({ id, type: 'dept' as const, source: 'manual' as const, active: true, role: 'worker' as const })),
  ]);
};

// ══════════ AUTH ══════════
export interface AuthUser {
  id: string;
  name: string;
  phone: string;
  email?: string;
  avatar?: string;
}

const AUTH_KEY = 'bolh_auth_v1';
export const [authUser, setAuthUser] = createSignal<AuthUser | null>(null);
export const isAuthenticated = () => !!authUser();

export const loadAuth = () => {
  try {
    const data = localStorage.getItem(AUTH_KEY);
    if (data) setAuthUser(JSON.parse(data));
  } catch {}
};

export const saveAuth = () => {
  try { localStorage.setItem(AUTH_KEY, JSON.stringify(authUser())); } catch {}
};

export const clearAuth = () => {
  setAuthUser(null);
  try { localStorage.removeItem(AUTH_KEY); } catch {}
};

export const registerUser = async (data: { phone: string; password: string; name: string; role: string }) => {
  // Try backend API first, fall back to local auth for offline mode
  try {
    const resp = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (resp.ok) {
      const result = await resp.json();
      const user: AuthUser = {
        id: result.id || crypto.randomUUID?.() || Date.now().toString(),
        name: result.name || data.name,
        phone: result.phone || data.phone,
      };
      setAuthUser(user);
      saveAuth();
      return user;
    }
  } catch {
    // Backend unavailable — create local auth (offline-first)
  }
  const user: AuthUser = {
    id: crypto.randomUUID?.() || Date.now().toString(),
    name: data.name,
    phone: data.phone,
  };
  setAuthUser(user);
  saveAuth();
  return user;
};

// ══════════ LIKES (UI analytics) ══════════
const LIKE_COUNTS_KEY = 'bolh_like_counts_v1';
const LIKED_KEYS_KEY = 'bolh_liked_keys_v1';

const [likeCounts, setLikeCounts] = createSignal<Record<string, number>>({});
const [likedKeys, setLikedKeys] = createSignal<Record<string, 1>>({});

export const initLikes = () => {
  try {
    const counts = JSON.parse(localStorage.getItem(LIKE_COUNTS_KEY) || '{}');
    if (counts && typeof counts === 'object') setLikeCounts(counts);
  } catch {}
  try {
    const liked = JSON.parse(localStorage.getItem(LIKED_KEYS_KEY) || '{}');
    if (liked && typeof liked === 'object') setLikedKeys(liked);
  } catch {}
};

export const getLikeCount = (key: string) => likeCounts()?.[key] ?? 0;
export const hasLiked = (key: string) => !!likedKeys()?.[key];

export const likeOnce = (key: string) => {
  if (!key) return;
  if (hasLiked(key)) return;
  const nextLiked = { ...(likedKeys() || {}), [key]: 1 as const };
  const curCounts = likeCounts() || {};
  const nextCounts = { ...curCounts, [key]: (curCounts[key] || 0) + 1 };
  setLikedKeys(nextLiked);
  setLikeCounts(nextCounts);
  try { localStorage.setItem(LIKED_KEYS_KEY, JSON.stringify(nextLiked)); } catch {}
  try { localStorage.setItem(LIKE_COUNTS_KEY, JSON.stringify(nextCounts)); } catch {}
};
