import type { Config } from '@/types';

export type ChatMessage =
  | { role: "system" | "user" | "assistant"; content: string }
  | {
      role: "user";
      content: Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
      >;
    };

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string; type?: string; code?: string };
};

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isRetryableError(error: Error, statusCode?: number): boolean {
  // Network errors
  if (error.message.includes('Failed to fetch') || error.message.includes('Network')) {
    return true;
  }

  // Timeout errors
  if (error.message.includes('timeout') || error.message.includes('AbortError')) {
    return true;
  }

  // Server errors (5xx)
  if (statusCode && statusCode >= 500 && statusCode < 600) {
    return true;
  }

  // Rate limiting (429)
  if (statusCode === 429) {
    return true;
  }

  return false;
}

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Check if we should retry
      const statusMatch = lastError.message.match(/HTTP (\d+)/);
      const statusCode = statusMatch ? parseInt(statusMatch[1]) : undefined;

      if (attempt < maxRetries && isRetryableError(lastError, statusCode)) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`[API] Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
        await sleep(delay);
        continue;
      }

      // Don't retry or max retries reached
      throw lastError;
    }
  }

  throw lastError || new Error('Unknown error');
}

export async function callVisionChatCompletion(
  config: Config,
  imageDataUrl: string,
  prompt: string,
  timeoutMs = 60000
): Promise<string> {
  return retryWithBackoff(async () => {
    const url = config.baseUrl + "/chat/completions";
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const messages: ChatMessage[] = [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: imageDataUrl } },
        ],
      },
    ];

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.defaultModel,
          messages,
        }),
        signal: controller.signal,
      });

      const data = (await res.json()) as ChatCompletionResponse;
      if (!res.ok) {
        const msg = data?.error?.message || res.statusText || "API error";
        throw new Error(`HTTP ${res.status}: ${msg}`);
      }
      const content = data?.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error("Empty response");
      }
      return content;
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        throw new Error("Request timeout");
      }
      throw e instanceof Error ? e : new Error("API request failed");
    } finally {
      clearTimeout(timer);
    }
  }, 3, 1000);
}

export async function callMultiTurnChatCompletion(
  config: Config,
  messages: ChatMessage[],
  timeoutMs = 60000
): Promise<string> {
  return retryWithBackoff(async () => {
    const url = config.baseUrl + "/chat/completions";
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.defaultModel,
          messages,
        }),
        signal: controller.signal,
      });

      const data = (await res.json()) as ChatCompletionResponse;
      if (!res.ok) {
        const msg = data?.error?.message || res.statusText || "API error";
        throw new Error(`HTTP ${res.status}: ${msg}`);
      }
      const content = data?.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error("Empty response");
      }
      return content;
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        throw new Error("Request timeout");
      }
      throw e instanceof Error ? e : new Error("API request failed");
    } finally {
      clearTimeout(timer);
    }
  }, 3, 1000);
}
