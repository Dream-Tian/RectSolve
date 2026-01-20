import type { Config } from '@/types';

const STORAGE_KEYS = {
  BASE_URL: 'baseUrl',
  API_KEY: 'apiKey',
  DEFAULT_MODEL: 'defaultModel',
  SYSTEM_PROMPT: 'systemPrompt',
  RESPONSE_LANGUAGE: 'responseLanguage',
  HISTORY_LIMIT: 'historyLimit'
} as const;

export async function getConfig(): Promise<Config & { systemPrompt: string; responseLanguage: string; historyLimit: number }> {
  const result = await chrome.storage.sync.get([
    STORAGE_KEYS.BASE_URL,
    STORAGE_KEYS.API_KEY,
    STORAGE_KEYS.DEFAULT_MODEL,
    STORAGE_KEYS.SYSTEM_PROMPT,
    STORAGE_KEYS.RESPONSE_LANGUAGE,
    STORAGE_KEYS.HISTORY_LIMIT
  ]);

  return {
    baseUrl: result[STORAGE_KEYS.BASE_URL] || '',
    apiKey: result[STORAGE_KEYS.API_KEY] || '',
    defaultModel: result[STORAGE_KEYS.DEFAULT_MODEL] || '',
    systemPrompt: result[STORAGE_KEYS.SYSTEM_PROMPT] || '',
    responseLanguage: result[STORAGE_KEYS.RESPONSE_LANGUAGE] || 'zh',
    historyLimit: result[STORAGE_KEYS.HISTORY_LIMIT] || 20
  };
}

export async function saveConfig(config: Partial<Config> & { historyLimit?: number }): Promise<void> {
  const toSave: Record<string, string | number> = {};

  if (config.baseUrl !== undefined) {
    toSave[STORAGE_KEYS.BASE_URL] = config.baseUrl;
  }
  if (config.apiKey !== undefined) {
    toSave[STORAGE_KEYS.API_KEY] = config.apiKey;
  }
  if (config.defaultModel !== undefined) {
    toSave[STORAGE_KEYS.DEFAULT_MODEL] = config.defaultModel;
  }
  if (config.historyLimit !== undefined) {
    toSave[STORAGE_KEYS.HISTORY_LIMIT] = config.historyLimit;
  }

  await chrome.storage.sync.set(toSave);
}

export function normalizeBaseUrl(url: string): string {
  let normalized = url.trim();

  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = 'https://' + normalized;
  }

  normalized = normalized.replace(/\/+$/, '');

  if (!normalized.endsWith('/v1')) {
    normalized += '/v1';
  }

  return normalized;
}
