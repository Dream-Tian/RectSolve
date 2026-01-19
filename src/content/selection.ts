import type { Rect } from '@/types';

type SelectionOverlayOptions = {
  minSize?: number;
  onComplete: (rect: Rect) => void;
  onCancel?: () => void;
};

export class SelectionOverlay {
  private overlayEl: HTMLDivElement | null = null;
  private boxEl: HTMLDivElement | null = null;
  private labelEl: HTMLDivElement | null = null;
  private startX = 0;
  private startY = 0;
  private isDragging = false;
  private options: SelectionOverlayOptions;
  private keyHandler?: (ev: KeyboardEvent) => void;

  constructor(options: SelectionOverlayOptions) {
    this.options = options;
  }

  mount(): void {
    if (this.overlayEl) return;

    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      left: 0;
      top: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0,0,0,0.3);
      cursor: crosshair;
      z-index: 2147483646;
      user-select: none;
    `;

    const box = document.createElement('div');
    box.style.cssText = `
      position: fixed;
      border: 2px dashed #3b82f6;
      box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.4);
      display: none;
      pointer-events: none;
    `;

    const label = document.createElement('div');
    label.style.cssText = `
      position: fixed;
      padding: 3px 8px;
      background: rgba(59, 130, 246, 0.9);
      color: white;
      border-radius: 3px;
      font-size: 11px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      pointer-events: none;
      display: none;
      font-weight: 500;
      letter-spacing: 0.5px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    `;

    overlay.appendChild(box);
    overlay.appendChild(label);
    document.documentElement.appendChild(overlay);

    this.overlayEl = overlay;
    this.boxEl = box;
    this.labelEl = label;

    overlay.addEventListener('mousedown', this.onMouseDown);
    overlay.addEventListener('mousemove', this.onMouseMove);
    overlay.addEventListener('mouseup', this.onMouseUp);

    this.keyHandler = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        ev.preventDefault();
        this.cancel();
      }
    };
    window.addEventListener('keydown', this.keyHandler, true);
  }

  unmount(): void {
    if (!this.overlayEl) return;
    this.overlayEl.removeEventListener('mousedown', this.onMouseDown);
    this.overlayEl.removeEventListener('mousemove', this.onMouseMove);
    this.overlayEl.removeEventListener('mouseup', this.onMouseUp);
    this.overlayEl.remove();
    this.overlayEl = null;
    this.boxEl = null;
    this.labelEl = null;
    if (this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler, true);
    }
  }

  private onMouseDown = (ev: MouseEvent): void => {
    if (!this.boxEl || !this.labelEl) return;
    if (ev.button !== 0) return;
    ev.preventDefault();
    this.isDragging = true;
    this.startX = ev.clientX;
    this.startY = ev.clientY;
    this.boxEl.style.display = 'block';
    // 不立即显示标签，等拖拽一定距离后再显示
    this.updateBox(this.startX, this.startY, 0, 0);
  };

  private onMouseMove = (ev: MouseEvent): void => {
    if (!this.isDragging) return;
    ev.preventDefault();
    const rect = this.computeRect(this.startX, this.startY, ev.clientX, ev.clientY);
    this.updateBox(rect.x, rect.y, rect.w, rect.h);
  };

  private onMouseUp = (ev: MouseEvent): void => {
    if (!this.isDragging) return;
    ev.preventDefault();
    this.isDragging = false;
    const rect = this.computeRect(this.startX, this.startY, ev.clientX, ev.clientY);
    this.finish(rect);
  };

  private computeRect(x1: number, y1: number, x2: number, y2: number): Rect {
    const x = Math.min(x1, x2);
    const y = Math.min(y1, y2);
    const w = Math.abs(x2 - x1);
    const h = Math.abs(y2 - y1);
    return { x, y, w, h };
  }

  private updateBox(x: number, y: number, w: number, h: number): void {
    if (!this.boxEl || !this.labelEl) return;
    this.boxEl.style.left = `${x}px`;
    this.boxEl.style.top = `${y}px`;
    this.boxEl.style.width = `${w}px`;
    this.boxEl.style.height = `${h}px`;

    // 只在选择框有一定大小时才显示标签
    if (w > 10 || h > 10) {
      this.labelEl.style.display = 'block';
      this.labelEl.textContent = `${w} × ${h}`;
      this.labelEl.style.left = `${x}px`;
      this.labelEl.style.top = `${Math.max(0, y - 30)}px`;
    } else {
      this.labelEl.style.display = 'none';
    }
  }

  private finish(rect: Rect): void {
    const minSize = this.options.minSize ?? 20;
    if (rect.w < minSize || rect.h < minSize) {
      this.cancel();
      return;
    }
    this.unmount();
    this.options.onComplete(rect);
  }

  private cancel(): void {
    this.unmount();
    this.options.onCancel?.();
  }
}
