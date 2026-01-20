import type { Rect } from '@/types';

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export async function cropScreenshot(
  dataUrl: string,
  rect: Rect,
  dpr: number,
  maxDim = 1536
): Promise<Blob> {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);

  const sx = clamp(Math.round(rect.x * dpr), 0, bitmap.width - 1);
  const sy = clamp(Math.round(rect.y * dpr), 0, bitmap.height - 1);
  const sw = clamp(Math.round(rect.w * dpr), 1, bitmap.width - sx);
  const sh = clamp(Math.round(rect.h * dpr), 1, bitmap.height - sy);

  if (sw <= 0 || sh <= 0) {
    throw new Error("Invalid crop region");
  }

  const scale = Math.min(1, maxDim / Math.max(sw, sh));
  const outW = Math.max(1, Math.round(sw * scale));
  const outH = Math.max(1, Math.round(sh * scale));

  const canvas = new OffscreenCanvas(outW, outH);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("OffscreenCanvas not supported");
  }

  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, outW, outH);

  // Use JPEG with 0.8 quality for better compression
  return canvas.convertToBlob({ 
    type: "image/jpeg", 
    quality: 0.8 
  });
}
