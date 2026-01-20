import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Define chrome mock before importing i18n
const mockStorage = {
  get: vi.fn(),
  set: vi.fn(),
};

const mockI18nAPI = {
  getUILanguage: vi.fn().mockReturnValue('en-US'),
};

global.chrome = {
  storage: {
    sync: mockStorage, // Add sync mock just in case
    local: mockStorage,
  },
  i18n: mockI18nAPI,
} as any;

// Use inline import to control when the singleton starts
describe('i18n', () => {
  let i18nModule: any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules(); // Reset modules to re-instantiate singleton
  });

  it('should auto-detect language from browser', async () => {
    mockStorage.get.mockImplementation((key, cb) => cb({})); // No stored lang
    mockI18nAPI.getUILanguage.mockReturnValue('zh-CN');

    i18nModule = await import('../i18n');
    // Allow constructor callback to run
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(i18nModule.i18n.language).toBe('zh');
  });

  it('should auto-detect English for non-zh browser lang', async () => {
    mockStorage.get.mockImplementation((key, cb) => cb({}));
    mockI18nAPI.getUILanguage.mockReturnValue('fr-FR');

    i18nModule = await import('../i18n');
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(i18nModule.i18n.language).toBe('en');
  });

  it('should load language from storage', async () => {
    mockStorage.get.mockImplementation((key, cb) => cb({ rectsolve_ui_language: 'en' }));
    
    i18nModule = await import('../i18n');
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(i18nModule.i18n.language).toBe('en');
  });

  it('should translate keys correctly', async () => {
    mockStorage.get.mockImplementation((key, cb) => cb({ rectsolve_ui_language: 'zh' }));
    i18nModule = await import('../i18n');
    await new Promise(resolve => setTimeout(resolve, 0));
    
    // Assuming 'settings' is a valid key in zh locale
    const translation = i18nModule.i18n.t('settings');
    expect(translation).toBe('设置'); // Verify against expected zh value
  });
  
  it('should update language and persist to storage', async () => {
    mockStorage.get.mockImplementation((key, cb) => cb({}));
    i18nModule = await import('../i18n');
    await new Promise(resolve => setTimeout(resolve, 0));

    i18nModule.i18n.setLanguage('en');

    expect(mockStorage.set).toHaveBeenCalledWith({ rectsolve_ui_language: 'en' });
    expect(i18nModule.i18n.language).toBe('en');
  });
});
