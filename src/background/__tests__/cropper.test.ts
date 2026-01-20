import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cropScreenshot } from '../cropper';

// Mock Canvas API since jsdom doesn't fully support OffscreenCanvas
const mockContext = {
  drawImage: vi.fn(),
};

const mockCanvasInstance = {
  getContext: vi.fn().mockReturnValue(mockContext),
  convertToBlob: vi.fn(),
};

global.OffscreenCanvas = class {
  constructor() {
    return mockCanvasInstance;
  }
} as any;

// Mock ImageBitmap
global.createImageBitmap = vi.fn().mockResolvedValue({
  width: 1920,
  height: 1080,
  close: vi.fn(),
} as any);

// Mock fetch
global.fetch = vi.fn().mockResolvedValue({
  blob: vi.fn().mockResolvedValue(new Blob([''], { type: 'image/png' })),
} as any);

describe('cropper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should calculate correct crop coordinates', async () => {
    const rect = { x: 100, y: 100, w: 200, h: 200 };
    const dpr = 2; // High DPI

    await cropScreenshot('data:image/png;base64,fake', rect, dpr);

    expect(mockContext.drawImage).toHaveBeenCalledWith(
      expect.anything(), // image source
      200, 200, // sx, sy (100*2, 100*2)
      400, 400, // sw, sh (200*2, 200*2)
      0, 0,     // dx, dy
      400, 400  // dw, dh (no scaling down yet)
    );
  });

  it('should clamp coordinates to image bounds', async () => {
    const rect = { x: -50, y: -50, w: 3000, h: 3000 }; // Out of bounds
    const dpr = 1;

    await cropScreenshot('data:image/png;base64,fake', rect, dpr);

    expect(mockContext.drawImage).toHaveBeenCalledWith(
      expect.anything(),
      0, 0,      // sx, sy clamped to 0
      1920, 1080,// sw, sh clamped to image size
      0, 0,
      1536, 864  // dw, dh (scaled to maxDim 1536)
    );
  });

  it('should use JPEG format with 0.8 quality', async () => {
    const rect = { x: 0, y: 0, w: 100, h: 100 };
    await cropScreenshot('data:image/png;base64,fake', rect, 1);

    expect(mockCanvasInstance.convertToBlob).toHaveBeenCalledWith({
      type: 'image/jpeg',
      quality: 0.8
    });
  });
});
