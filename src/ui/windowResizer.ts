import { isNative } from '../services/neutralino';

export class WindowResizer {
  private handles: HTMLElement[] = [];
  private isResizing: boolean = false;

  constructor() {
    this.createHandles();
  }

  private createHandles() {
    const directions = ['n', 's', 'e', 'w', 'nw', 'ne', 'sw', 'se'];

    directions.forEach(dir => {
      const el = document.createElement('div');
      el.className = `win-resize-handle win-resize-${dir}`;
      el.setAttribute('data-direction', dir);
      document.body.appendChild(el);
      this.handles.push(el);

      el.addEventListener('mousedown', (e) => {
        this.startResize(e, dir);
      });
    });
  }

  private async startResize(e: MouseEvent, direction: string) {
    if (e.button !== 0) return;
    if (document.body.classList.contains('window-maximized')) return;
    if (!isNative()) return;

    e.preventDefault();
    e.stopPropagation();

    this.isResizing = true;
    const startMouseX = e.screenX;
    const startMouseY = e.screenY;

    let startW = window.innerWidth;
    let startH = window.innerHeight;
    let startX = 0;
    let startY = 0;

    try {
      const size = await window.Neutralino?.window?.getSize();
      if (size?.width && size?.height) {
        startW = size.width;
        startH = size.height;
      }
      const pos = await window.Neutralino?.window?.getPosition();
      if (pos) {
        startX = pos.x;
        startY = pos.y;
      }
    } catch {
      // Fallback to window properties
    }

    const minW = 720;
    const minH = 480;

    let rafId: number | null = null;
    let targetW = startW;
    let targetH = startH;
    let targetX = startX;
    let targetY = startY;

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!this.isResizing) return;
      const dx = moveEvent.screenX - startMouseX;
      const dy = moveEvent.screenY - startMouseY;

      let nextW = startW;
      let nextH = startH;
      let nextX = startX;
      let nextY = startY;

      // Horizontal resize
      if (direction.includes('e')) {
        nextW = Math.max(minW, startW + dx);
      } else if (direction.includes('w')) {
        nextW = Math.max(minW, startW - dx);
        nextX = startX + (startW - nextW);
      }

      // Vertical resize
      if (direction.includes('s')) {
        nextH = Math.max(minH, startH + dy);
      } else if (direction.includes('n')) {
        nextH = Math.max(minH, startH - dy);
        nextY = startY + (startH - nextH);
      }

      targetW = Math.round(nextW);
      targetH = Math.round(nextH);
      targetX = Math.round(nextX);
      targetY = Math.round(nextY);

      if (rafId === null) {
        rafId = requestAnimationFrame(async () => {
          rafId = null;
          try {
            await window.Neutralino?.window?.setSize({ width: targetW, height: targetH });
            if (direction.includes('w') || direction.includes('n')) {
              await window.Neutralino?.window?.move(targetX, targetY);
            }
          } catch {
            // Ignore in-flight frame error
          }
        });
      }
    };

    const onMouseUp = () => {
      this.isResizing = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }
}
