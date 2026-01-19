import type { Rect } from '@/types';

type SelectionOverlayOptions = {
  minSize?: number;
  smartSelectionEnabled?: boolean;
  onComplete: (rect: Rect) => void;
  onCancel?: () => void;
};

export class SelectionOverlay {
  // ... existing properies ...
  private overlayEl: HTMLDivElement | null = null;
  private boxEl: HTMLDivElement | null = null;
  private labelEl: HTMLDivElement | null = null;
  private hoverBoxEl: HTMLDivElement | null = null;
  private startX = 0;
  private startY = 0;
  private isDragging = false;
  private dragThreshold = 5;
  private hoveredRect: Rect | null = null;
  private options: SelectionOverlayOptions;
  private keyHandler?: (ev: KeyboardEvent) => void;

  constructor(options: SelectionOverlayOptions) {
    this.options = options;
  }

  public mount(): void {
    if (this.overlayEl) return;

    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      left: 0;
      top: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0,0,0,0.1); /* Lighter background for better visibility */
      cursor: crosshair;
      z-index: 2147483646;
      user-select: none;
    `;

    const box = document.createElement('div');
    box.style.cssText = `
      position: fixed;
      border: 2px dashed #2563eb;
      box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.3);
      display: none;
      pointer-events: none;
      z-index: 2;
    `;

    // Hover box for smart selection
    const hoverBox = document.createElement('div');
    hoverBox.style.cssText = `
      position: fixed;
      border: 2px solid rgba(37, 99, 235, 0.5);
      background: rgba(37, 99, 235, 0.05);
      display: none;
      pointer-events: none;
      z-index: 1;
      transition: all 0.1s ease-out;
    `;

    const label = document.createElement('div');
    label.style.cssText = `
      position: fixed;
      padding: 3px 8px;
      background: rgba(37, 99, 235, 0.9);
      color: white;
      border-radius: 3px;
      font-size: 11px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      pointer-events: none;
      display: none;
      font-weight: 500;
      letter-spacing: 0.5px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      z-index: 3;
    `;

    overlay.appendChild(hoverBox);
    overlay.appendChild(box);
    overlay.appendChild(label);
    document.documentElement.appendChild(overlay);

    this.overlayEl = overlay;
    this.boxEl = box;
    this.hoverBoxEl = hoverBox;
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
  
  // ... mount/unmount methods ...

  // ... onMouseDown ...

  private onMouseMove = (ev: MouseEvent): void => {
    ev.preventDefault();

    if (this.isDragging) {
      // Manual Dragging Mode
      const rect = this.computeRect(this.startX, this.startY, ev.clientX, ev.clientY);
      this.updateBox(rect.x, rect.y, rect.w, rect.h);
    } else if (this.options.smartSelectionEnabled !== false) {
      // Smart Hover Mode (only if enabled)
      this.updateHoverBox(ev.clientX, ev.clientY);
    }
  };

  private onMouseUp = (ev: MouseEvent): void => {
    if (!this.isDragging) return;
    ev.preventDefault();
    this.isDragging = false;

    const dx = Math.abs(ev.clientX - this.startX);
    const dy = Math.abs(ev.clientY - this.startY);

    // If moved significantly, use manual selection
    if (dx > this.dragThreshold || dy > this.dragThreshold) {
      const rect = this.computeRect(this.startX, this.startY, ev.clientX, ev.clientY);
      this.finish(rect);
    } else {
       // It was a click! Use the smart hovered element if enabled
       if (this.options.smartSelectionEnabled !== false && this.hoveredRect) {
         this.finish(this.hoveredRect);
       } else {
         // Clicked on nothing/void? Cancel or just reset
         this.cancel();
       }
    }
  };



  unmount(): void {
    if (!this.overlayEl) return;
    this.overlayEl.removeEventListener('mousedown', this.onMouseDown);
    this.overlayEl.removeEventListener('mousemove', this.onMouseMove);
    this.overlayEl.removeEventListener('mouseup', this.onMouseUp);
    this.overlayEl.remove();
    this.overlayEl = null;
    this.boxEl = null;
    this.hoverBoxEl = null;
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

    // Build initial box (invisible until moved)
    this.boxEl.style.display = 'block';
    this.updateBox(this.startX, this.startY, 0, 0);
    
    // Hide hover box while dragging
    if (this.hoverBoxEl) {
        this.hoverBoxEl.style.display = 'none';
    }
  };



  private updateHoverBox(x: number, y: number): void {
      if (!this.hoverBoxEl) return;

      // Disable pointer events on overlay temporarily to pierce through
      if (this.overlayEl) this.overlayEl.style.pointerEvents = 'none';
      
      const elements = document.elementsFromPoint(x, y);
      
      // Re-enable pointer events
      if (this.overlayEl) this.overlayEl.style.pointerEvents = 'auto';

      // Find the best candidate
      let target: Element | null = null;
      for (const el of elements) {
          // Skip our own UI elements
          if (el === this.overlayEl || el === this.boxEl || el === this.hoverBoxEl || el === this.labelEl) continue;
          // Skip structural roots if they are huge
          if (el.tagName === 'HTML' || el.tagName === 'BODY') continue;
          
          target = el;
          break;
      }

      if (target) {
          const rect = target.getBoundingClientRect();
          this.hoveredRect = {
              x: rect.left,
              y: rect.top,
              w: rect.width,
              h: rect.height
          };

          this.hoverBoxEl.style.display = 'block';
          this.hoverBoxEl.style.left = `${rect.left}px`;
          this.hoverBoxEl.style.top = `${rect.top}px`;
          this.hoverBoxEl.style.width = `${rect.width}px`;
          this.hoverBoxEl.style.height = `${rect.height}px`;
      } else {
          this.hoveredRect = null;
          this.hoverBoxEl.style.display = 'none';
      }
  }

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

    if (w > 10 || h > 10) {
      this.labelEl.style.display = 'block';
      this.labelEl.textContent = `${Math.round(w)} × ${Math.round(h)}`;
      this.labelEl.style.left = `${x}px`;
      this.labelEl.style.top = `${Math.max(0, y - 25)}px`;
    } else {
      this.labelEl.style.display = 'none';
    }
  }

  private finish(rect: Rect): void {
    const minSize = this.options.minSize ?? 10;
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
