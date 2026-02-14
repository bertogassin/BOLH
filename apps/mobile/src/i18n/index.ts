import { createSignal, createEffect } from 'solid-js';
import { translations, languages, type LangCode } from './translations';

// Get saved language or detect from browser
function getInitialLanguage(): LangCode {
  try {
    const saved = localStorage.getItem('guardio_lang');
    if (saved && saved in languages) {
      return saved as LangCode;
    }
    
    // Detect browser language
    const browserLang = navigator.language.split('-')[0];
    if (browserLang in languages) {
      return browserLang as LangCode;
    }
  } catch (e) {
    // localStorage might not be available
  }
  
  return 'en'; // Default — English
}

const [currentLang, setCurrentLang] = createSignal<LangCode>(getInitialLanguage());

// Save language preference
createEffect(() => {
  try {
    localStorage.setItem('guardio_lang', currentLang());
  } catch (e) {
    // Ignore
  }
});

// Translation function
export function t(key: string): string {
  const lang = currentLang();
  return translations[lang]?.[key] || translations['en']?.[key] || key;
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

// Set language
export function setLanguage(lang: LangCode) {
  if (lang in languages) {
    setCurrentLang(lang);
    
    // Update document direction for RTL
    document.documentElement.dir = languages[lang].rtl ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }
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
