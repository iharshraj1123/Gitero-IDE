import { isNative } from '../services/neutralino';
import { fsService } from '../services/fs';

export class MediaViewerComponent {
  private container: HTMLElement;
  private currentZoom: number = 1.0;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public async renderImage(filePath: string) {
    this.currentZoom = 1.0;
    const fileName = filePath.split(/[/\\]/).pop() || filePath;
    const ext = fileName.split('.').pop()?.toLowerCase() || 'png';

    this.container.innerHTML = `
      <div class="media-viewer-container">
        <div class="media-viewer-toolbar">
          <div class="media-meta">
            <span class="media-name">${fileName}</span>
            <span class="media-dims" id="media-dims">Loading dimensions...</span>
          </div>
          <div class="media-zoom-controls">
            <button class="btn btn-secondary btn-sm" id="btn-zoom-out" title="Zoom Out">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
            <span class="zoom-level-text" id="zoom-level-text">100%</span>
            <button class="btn btn-secondary btn-sm" id="btn-zoom-in" title="Zoom In">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
            <button class="btn btn-secondary btn-sm" id="btn-zoom-reset" title="Reset Zoom">Reset</button>
          </div>
        </div>
        <div class="media-viewport-content checkerboard-bg">
          <img class="media-preview-img" id="media-img" alt="${fileName}" />
        </div>
      </div>
    `;

    const imgEl = this.container.querySelector('#media-img') as HTMLImageElement;
    const dimsEl = this.container.querySelector('#media-dims') as HTMLElement;
    const zoomText = this.container.querySelector('#zoom-level-text') as HTMLElement;

    imgEl.onload = () => {
      dimsEl.textContent = `${imgEl.naturalWidth} × ${imgEl.naturalHeight} px`;
    };

    const updateZoom = (nextZoom: number) => {
      this.currentZoom = Math.max(0.1, Math.min(5.0, nextZoom));
      imgEl.style.transform = `scale(${this.currentZoom})`;
      zoomText.textContent = `${Math.round(this.currentZoom * 100)}%`;
    };

    this.container.querySelector('#btn-zoom-in')?.addEventListener('click', () => {
      updateZoom(this.currentZoom + 0.25);
    });

    this.container.querySelector('#btn-zoom-out')?.addEventListener('click', () => {
      updateZoom(this.currentZoom - 0.25);
    });

    this.container.querySelector('#btn-zoom-reset')?.addEventListener('click', () => {
      updateZoom(1.0);
    });

    try {
      if (ext === 'svg') {
        const svgContent = await fsService.readFile(filePath);
        imgEl.src = `data:image/svg+xml;utf8,${encodeURIComponent(svgContent)}`;
      } else if (isNative()) {
        const mime = ext === 'ico' ? 'image/x-icon' : `image/${ext}`;
        const buffer = await window.Neutralino.filesystem.readBinaryFile(filePath);
        const bytes = new Uint8Array(buffer);
        let binary = '';
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = window.btoa(binary);
        imgEl.src = `data:${mime};base64,${base64}`;
      } else {
        imgEl.src = filePath;
      }
    } catch (err) {
      dimsEl.textContent = 'Failed to load image';
      console.error('Failed to load image preview:', err);
    }
  }

  public renderBinary(filePath: string) {
    const fileName = filePath.split(/[/\\]/).pop() || filePath;

    this.container.innerHTML = `
      <div class="binary-guard-container">
        <div class="binary-guard-card">
          <div class="binary-guard-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
              <polyline points="14 2 14 8 20 8"/>
              <path d="M8 13h8"/>
              <path d="M8 17h8"/>
            </svg>
          </div>
          <h2 class="binary-guard-title">${fileName}</h2>
          <p class="binary-guard-desc">
            The file is not displayed in the text editor because it is either binary or uses an unsupported text encoding.
          </p>
          <div class="binary-guard-actions">
            <button class="btn btn-secondary" id="btn-binary-reveal">Reveal in File Explorer</button>
            <button class="btn btn-primary" id="btn-binary-open-ext">Open in Default Program</button>
          </div>
        </div>
      </div>
    `;

    this.container.querySelector('#btn-binary-reveal')?.addEventListener('click', () => {
      fsService.revealInExplorer(filePath);
    });

    this.container.querySelector('#btn-binary-open-ext')?.addEventListener('click', async () => {
      if (isNative()) {
        try {
          await window.Neutralino.os.open(filePath);
        } catch (e) {
          console.warn('Failed to open external file:', e);
        }
      }
    });
  }
}
