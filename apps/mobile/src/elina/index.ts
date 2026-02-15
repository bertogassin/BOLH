/**
 * Elina AI — Public API
 * 
 * Re-exports the engine + convenience wrappers for App.tsx
 */

export { getElinaEngine, ElinaEngine } from './engine';
export type { ElinaMessage, ElinaEmotion, ElinaAction, ElinaContext, ElinaResponse, ElinaProvider } from './engine';

import { getElinaEngine, type ElinaContext, type ElinaAction } from './engine';

// Legacy-compatible wrapper used by App.tsx
export interface LegacyElinaMessage {
  id: number;
  from: 'user' | 'elina';
  text: string;
  time: string;
  emotion?: string;
  action?: ElinaAction;
}

/** Ask Elina a question — returns response text */
export async function askElina(input: string, _ctx?: Partial<ElinaContext>): Promise<string> {
  const engine = getElinaEngine();
  if (_ctx) engine.updateContext(_ctx as Partial<ElinaContext>);
  const res = await engine.processMessage(input);
  return res.text;
}

/** Add personality trait (future expansion) */
export function addPersonality(_trait: string): void {
  // Future: engine.addPersonalityTrait(trait)
}

/** Create a fresh Elina context */
export function createElinaContext(overrides?: Partial<ElinaContext>): ElinaContext {
  const base: ElinaContext = {
    currentPage: 'home',
    userMode: 'client',
    language: 'ru',
    timeOfDay: getTimeOfDay(),
    messageHistory: [],
    userPreferences: {},
  };
  return { ...base, ...overrides };
}

/** Update the engine's internal context */
export function updateContext(partial: Partial<ElinaContext>): void {
  getElinaEngine().updateContext(partial);
}

function getTimeOfDay(): 'morning' | 'afternoon' | 'evening' | 'night' {
  const h = new Date().getHours();
  if (h < 6) return 'night';
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
}
