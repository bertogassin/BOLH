import { createSignal, createEffect } from 'solid-js';
import { translations, languages, type LangCode } from './translations';

// Check if language actually has translations (not empty)
function hasTranslations(lang: string): boolean {
  const t = translations[lang as LangCode];
  return !!t && Object.keys(t).length > 10;
}

// Get saved language or detect from browser
function getInitialLanguage(): LangCode {
  try {
    const saved = localStorage.getItem('guardio_lang');
    if (saved && saved in languages && hasTranslations(saved)) {
      return saved as LangCode;
    }
    // Clear invalid saved language
    if (saved) localStorage.removeItem('guardio_lang');
    
    // Detect browser language
    const browserLang = navigator.language.split('-')[0];
    if (browserLang in languages && hasTranslations(browserLang)) {
      return browserLang as LangCode;
    }

    // Try Russian for CIS region browsers
    const fullLang = navigator.language.toLowerCase();
    if (['ru', 'kk', 'uk', 'uz', 'az', 'be', 'ky', 'tg'].some(l => fullLang.startsWith(l))) {
      return 'ru';
    }
  } catch (e) {
    // localStorage might not be available
  }
  
  return 'en';
}

const [currentLang, setCurrentLang] = createSignal<LangCode>(getInitialLanguage());

// Auto-fix: if saved language has no translations, reset to 'ru'
try {
  const saved = localStorage.getItem('guardio_lang');
  if (saved && !hasTranslations(saved)) {
    localStorage.setItem('guardio_lang', 'ru');
    setCurrentLang('ru' as LangCode);
  }
} catch (e) { /* ignore */ }

// Save language preference
createEffect(() => {
  try {
    localStorage.setItem('guardio_lang', currentLang());
  } catch (e) {
    // Ignore
  }
});

// Translation function — with triple fallback: current → ru → en → key
export function t(key: string): string {
  const lang = currentLang();
  return translations[lang]?.[key] || translations['ru']?.[key] || translations['en']?.[key] || key;
}

// Get current language info
export function getCurrentLanguage() {
  return {
    code: currentLang(),
    ...languages[currentLang()]
  };
}

// Check if current language is RTL
export function isRTL(): boolean {
  return languages[currentLang()]?.rtl || false;
}

// Set language (only if it has real translations)
export function setLanguage(lang: LangCode) {
  if (lang in languages && hasTranslations(lang)) {
    setCurrentLang(lang);
    document.documentElement.dir = languages[lang].rtl ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }
}

// Get only languages that have actual translations
export function getTranslatedLanguages() {
  return Object.entries(languages)
    .filter(([code]) => hasTranslations(code))
    .map(([code, info]) => ({ code: code as LangCode, ...info }));
}

// Get all available languages
export function getLanguages() {
  return Object.entries(languages).map(([code, info]) => ({
    code: code as LangCode,
    ...info
  }));
}

// Reactive language signal for components
export { currentLang };

// Export types
export type { LangCode };
export { languages };
