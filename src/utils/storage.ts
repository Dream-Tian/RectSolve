import type { Config } from '@/types';

const STORAGE_KEYS = {
  BASE_URL: 'baseUrl',
  API_KEY: 'apiKey',
  DEFAULT_MODEL: 'defaultModel'
} as const;

export async function getConfig(): Promise<Config> {
  const result = await chrome.storage.sync.get([
    STORAGE_KEYS.BASE_URL,
    STORAGE_KEYS.API_KEY,
    STORAGE_KEYS.DEFAULT_MODEL
  ]);

  return {
    baseUrl: result[STORAGE_KEYS.BASE_URL] || '',
    apiKey: result[STORAGE_KEYS.API_KEY] || '',
    defaultModel: result[STORAGE_KEYS.DEFAULT_MODEL] || ''
  };
}

export async function saveConfig(config: Partial<Config>): Promise<void> {
  const toSave: Record<string, string> = {};

  if (config.baseUrl !== undefined) {
    toSave[STORAGE_KEYS.BASE_URL] = config.baseUrl;
  }
  if (config.apiKey !== undefined) {
    toSave[STORAGE_KEYS.API_KEY] = config.apiKey;
  }
  if (config.defaultModel !== undefined) {
    toSave[STORAGE_KEYS.DEFAULT_MODEL] = config.defaultModel;
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
