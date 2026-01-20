import { translations, Language, TranslationKey } from './locales';

class I18n {
  private currentLang: Language = 'zh';
  private listeners: (() => void)[] = [];

  constructor() {
    // Initial load sync attempt (best effort, actual load is async)
    chrome.storage.local.get('rectsolve_ui_language', (result) => {
      if (result.rectsolve_ui_language) {
        this.currentLang = result.rectsolve_ui_language as Language;
      } else {
        // Auto-detect
        const browserLang = chrome.i18n.getUILanguage();
        this.currentLang = browserLang.startsWith('zh') ? 'zh' : 'en';
      }
      this.notify();
    });
  }

  public async init() {
    const result = await chrome.storage.local.get('rectsolve_ui_language');
    if (result.rectsolve_ui_language) {
      this.currentLang = result.rectsolve_ui_language as Language;
    } else {
      const browserLang = chrome.i18n.getUILanguage();
      this.currentLang = browserLang.startsWith('zh') ? 'zh' : 'en';
    }
  }

  public get language(): Language {
    return this.currentLang;
  }

  public setLanguage(lang: Language) {
    this.currentLang = lang;
    chrome.storage.local.set({ rectsolve_ui_language: lang });
    this.notify();
  }

  public t(key: TranslationKey): string {
    return translations[this.currentLang][key] || key;
  }

  public onChange(callback: () => void) {
    this.listeners.push(callback);
  }

  private notify() {
    this.listeners.forEach(cb => cb());
  }
}

export const i18n = new I18n();
