// ============== LIKES (UI analytics) ==============
// Simple MVP: local-only likes stored in localStorage.
// One like per device per key; cannot be removed (by design).
import { createSignal } from 'solid-js';

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
