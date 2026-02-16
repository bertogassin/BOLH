// ═══════════════════════════════════════════════════════════════
// Route configuration — typed page names & back-navigation map
// ═══════════════════════════════════════════════════════════════
import type { Icons } from '../ui';

export type PageId =
  | 'home' | 'myboard' | 'map' | 'wallet' | 'profile'
  | 'department' | 'urgent' | 'discover' | 'tracking' | 'orders'
  | 'blockchain' | 'referral' | 'language' | 'theme' | 'contracts'
  | 'newcontract' | 'documents' | 'verification' | 'academy'
  | 'security' | 'chat' | 'notifications' | 'rating' | 'auth'
  | 'settings' | 'skilldetail' | 'payments' | 'achievements'
  | 'analytics' | 'marketplace' | 'incident' | 'createorder'
  | 'workerdetail';

/** Pages where the bottom navigation bar should be hidden */
export const HIDE_NAV_PAGES: PageId[] = [
  'urgent', 'language', 'theme', 'newcontract', 'documents',
  'verification', 'academy', 'department', 'chat', 'notifications',
  'rating', 'auth', 'security', 'settings', 'skilldetail',
  'payments', 'achievements', 'analytics', 'marketplace', 'incident',
  'createorder', 'workerdetail', 'blockchain', 'tracking', 'referral',
];

/** Pages that need full-height (no bottom padding) */
export const FULL_HEIGHT_PAGES: PageId[] = ['tracking', 'map'];

/** Back-navigation map: page -> where "back" goes */
export const BACK_MAP: Partial<Record<PageId, PageId>> = {
  urgent: 'home',
  department: 'home',
  discover: 'home',
  map: 'home',
  orders: 'home',
  notifications: 'home',
  createorder: 'home',
  tracking: 'contracts',
  blockchain: 'wallet',
  referral: 'wallet',
  payments: 'wallet',
  language: 'profile',
  theme: 'profile',
  documents: 'profile',
  verification: 'profile',
  academy: 'profile',
  security: 'profile',
  settings: 'profile',
  skilldetail: 'profile',
  achievements: 'profile',
  analytics: 'profile',
  marketplace: 'profile',
  newcontract: 'contracts',
  chat: 'contracts',
  rating: 'contracts',
  incident: 'contracts',
  workerdetail: 'discover',
};

/** Bottom navigation items */
export const NAV_ITEMS: { id: PageId; icon: keyof typeof Icons; labelKey: string; center?: boolean }[] = [
  { id: 'home', icon: 'home', labelKey: 'nav.home' },
  { id: 'map', icon: 'map', labelKey: 'nav.map' },
  { id: 'myboard', icon: 'layers', labelKey: 'nav.myboard', center: true },
  { id: 'wallet', icon: 'creditCard', labelKey: 'nav.wallet' },
  { id: 'profile', icon: 'user', labelKey: 'nav.profile' },
];
