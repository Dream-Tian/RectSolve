export class FloatingButton {
  private button: HTMLDivElement;
  private onClick: () => void;

  constructor(onClick: () => void) {
    this.onClick = onClick;
    this.button = this.createButton();
    this.bindEvents();
  }

  private createButton(): HTMLDivElement {
    const button = document.createElement('div');
    button.id = 'rectsolve-floating-btn';
    button.textContent = '截图';
    button.style.cssText = `
      position: fixed;
      right: 20px;
      bottom: 80px;
      width: 56px;
      height: 56px;
      background: #2563eb;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      cursor: pointer;
      box-shadow: 0 10px 15px -3px rgba(37, 99, 235, 0.3), 0 4px 6px -2px rgba(37, 99, 235, 0.1);
      z-index: 2147483646;
      transition: all 0.3s ease;
      user-select: none;
      font-family: KaiTi, "楷体", STKaiti, serif;
    `;

    button.addEventListener('mouseenter', () => {
      button.style.transform = 'scale(1.1) rotate(5deg)';
      button.style.boxShadow = '0 20px 25px -5px rgba(37, 99, 235, 0.4), 0 10px 10px -5px rgba(37, 99, 235, 0.2)';
    });

    button.addEventListener('mouseleave', () => {
      button.style.transform = 'scale(1) rotate(0deg)';
      button.style.boxShadow = '0 10px 15px -3px rgba(37, 99, 235, 0.3), 0 4px 6px -2px rgba(37, 99, 235, 0.1)';
    });

    return button;
  }

  private bindEvents() {
    this.button.addEventListener('click', () => {
      this.onClick();
    });
  }


  public show() {
    if (!this.button.parentNode) {
      document.body.appendChild(this.button);
    }
  }

  public hide() {
    if (this.button.parentNode) {
      this.button.parentNode.removeChild(this.button);
    }
  }
}
