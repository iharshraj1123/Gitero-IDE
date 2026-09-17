import { EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { Extension } from '@codemirror/state';
import { getSearchQuery, SearchQuery } from '@codemirror/search';
import { forEachDiagnostic, Diagnostic } from '@codemirror/lint';

const MINIMAP_WIDTH = 92;
const LINE_PITCH = 3.5; // height per line in minimap (px)
const CHAR_WIDTH = 1.4; // width per char (px)

interface LineHighlight {
  type: 'error' | 'warning' | 'search' | 'search-active';
  colStart?: number;
  colEnd?: number;
}

class MinimapPlugin {
  private readonly container: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D | null;
  private readonly slider: HTMLElement;

  private isDragging = false;
  private dragStartY = 0;
  private dragStartScrollTop = 0;
  private rafId: number | null = null;
  private scrollHandler: () => void;

  constructor(private readonly view: EditorView) {
    this.container = document.createElement('div');
    this.container.className = 'gitero-minimap';
    this.container.setAttribute('aria-hidden', 'true');

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'gitero-minimap-canvas';
    this.container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d', { alpha: true });

    this.slider = document.createElement('div');
    this.slider.className = 'gitero-minimap-slider';
    this.container.appendChild(this.slider);

    this.scrollHandler = () => this.scheduleRender();
    this.view.scrollDOM.addEventListener('scroll', this.scrollHandler, { passive: true });

    this.bindEvents();
    this.view.dom.appendChild(this.container);

    // Initial render
    this.scheduleRender();
  }

  private bindEvents() {
    // Slider dragging
    this.slider.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.isDragging = true;
      this.dragStartY = e.clientY;
      this.dragStartScrollTop = this.view.scrollDOM.scrollTop;
      this.slider.classList.add('is-dragging');
      window.addEventListener('mousemove', this.onMouseMove);
      window.addEventListener('mouseup', this.onMouseUp);
    });

    // Clicking anywhere on minimap to jump
    this.container.addEventListener('mousedown', (e) => {
      if (e.target === this.slider) return;
      e.preventDefault();

      const rect = this.container.getBoundingClientRect();
      const clickY = e.clientY - rect.top;

      const { scrollHeight, clientHeight } = this.view.scrollDOM;
      const totalLines = this.view.state.doc.lines;
      const totalMinimapHeight = totalLines * LINE_PITCH;
      const containerHeight = this.container.clientHeight || 1;

      let targetScrollTop = 0;
      if (totalMinimapHeight <= containerHeight) {
        const ratio = clickY / containerHeight;
        targetScrollTop = ratio * (scrollHeight - clientHeight);
      } else {
        const currentScrollRatio = this.view.scrollDOM.scrollTop / Math.max(1, scrollHeight - clientHeight);
        const minimapOffset = currentScrollRatio * (totalMinimapHeight - containerHeight);
        const targetDocY = clickY + minimapOffset;
        const line = Math.max(1, Math.min(totalLines, Math.round(targetDocY / LINE_PITCH)));
        const lineObj = this.view.state.doc.line(line);
        this.view.dispatch({
          selection: { anchor: lineObj.from, head: lineObj.from },
          scrollIntoView: true
        });
        this.view.focus();
        return;
      }

      this.view.scrollDOM.scrollTop = Math.max(0, Math.min(scrollHeight - clientHeight, targetScrollTop - clientHeight / 2));
      this.scheduleRender();
    });
  }

  private onMouseMove = (e: MouseEvent) => {
    if (!this.isDragging) return;
    e.preventDefault();

    const deltaY = e.clientY - this.dragStartY;
    const { scrollHeight, clientHeight } = this.view.scrollDOM;
    const containerHeight = this.container.clientHeight || 1;
    const totalLines = this.view.state.doc.lines;
    const totalMinimapHeight = totalLines * LINE_PITCH;

    let scrollDelta = 0;
    if (totalMinimapHeight <= containerHeight) {
      const sliderTrackHeight = containerHeight;
      const ratio = deltaY / sliderTrackHeight;
      scrollDelta = ratio * (scrollHeight - clientHeight);
    } else {
      const scale = (scrollHeight - clientHeight) / (containerHeight - (this.slider.clientHeight || 20));
      scrollDelta = deltaY * scale;
    }

    this.view.scrollDOM.scrollTop = Math.max(0, Math.min(scrollHeight - clientHeight, this.dragStartScrollTop + scrollDelta));
  };

  private onMouseUp = () => {
    if (this.isDragging) {
      this.isDragging = false;
      this.slider.classList.remove('is-dragging');
      window.removeEventListener('mousemove', this.onMouseMove);
      window.removeEventListener('mouseup', this.onMouseUp);
    }
  };

  public update(update: ViewUpdate) {
    let shouldUpdate = update.docChanged || update.geometryChanged || update.viewportChanged;

    if (!shouldUpdate) {
      for (const tr of update.transactions) {
        if (tr.docChanged || tr.selection) {
          shouldUpdate = true;
          break;
        }
        for (const ef of tr.effects) {
          if ((ef.value as any)?.diagnostics || (ef as any).is?.(SearchQuery as any)) {
            shouldUpdate = true;
            break;
          }
        }
        if (shouldUpdate) break;
      }
    }

    if (shouldUpdate) {
      this.scheduleRender();
    }
  }

  private scheduleRender() {
    if (this.rafId !== null) return;
    this.rafId = requestAnimationFrame(() => {
      this.rafId = null;
      this.render();
    });
  }

  private render() {
    if (!this.ctx) return;

    const width = this.container.clientWidth || MINIMAP_WIDTH;
    const height = this.container.clientHeight;
    if (width <= 0 || height <= 0) return;

    const dpr = window.devicePixelRatio || 1;
    if (this.canvas.width !== width * dpr || this.canvas.height !== height * dpr) {
      this.canvas.width = width * dpr;
      this.canvas.height = height * dpr;
      this.canvas.style.width = `${width}px`;
      this.canvas.style.height = `${height}px`;
    }

    const ctx = this.ctx;
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const doc = this.view.state.doc;
    const totalLines = doc.lines;
    const totalMinimapHeight = totalLines * LINE_PITCH;

    const { scrollTop, scrollHeight, clientHeight } = this.view.scrollDOM;
    const maxScroll = Math.max(1, scrollHeight - clientHeight);
    const scrollRatio = Math.max(0, Math.min(1, scrollTop / maxScroll));

    // Scroll minimap canvas if document is taller than viewport
    let minimapOffsetY = 0;
    if (totalMinimapHeight > height) {
      minimapOffsetY = scrollRatio * (totalMinimapHeight - height);
    }

    // Collect highlights: diagnostics & search
    const lineHighlights = new Map<number, LineHighlight[]>();

    // 1. Diagnostics (LSP & lint)
    try {
      forEachDiagnostic(this.view.state, (diag: Diagnostic, from: number) => {
        const lineNum = doc.lineAt(Math.min(doc.length, Math.max(0, from))).number;
        const highlights = lineHighlights.get(lineNum) || [];
        highlights.push({
          type: diag.severity === 'warning' ? 'warning' : 'error'
        });
        lineHighlights.set(lineNum, highlights);
      });
    } catch {}

    // 2. Search matches (whitish)
    try {
      const query = getSearchQuery(this.view.state);
      if (query && query.valid && query.search && query.search.length > 0) {
        const cursor = query.getCursor(this.view.state);
        const mainSel = this.view.state.selection.main;
        let count = 0;
        const maxMatches = 1000;

        while (count < maxMatches) {
          const item = cursor.next();
          if (item.done) break;
          const match = item.value;
          const lineObj = doc.lineAt(match.from);
          const lineNum = lineObj.number;
          const colStart = match.from - lineObj.from;
          const colEnd = match.to - lineObj.from;
          const isActive = match.from <= mainSel.from && match.to >= mainSel.to;

          const highlights = lineHighlights.get(lineNum) || [];
          highlights.push({
            type: isActive ? 'search-active' : 'search',
            colStart,
            colEnd
          });
          lineHighlights.set(lineNum, highlights);
          count++;
        }
      }
    } catch {}

    // Render code lines
    const startLine = Math.max(1, Math.floor(minimapOffsetY / LINE_PITCH));
    const endLine = Math.min(totalLines, Math.ceil((minimapOffsetY + height) / LINE_PITCH) + 1);

    for (let i = startLine; i <= endLine; i++) {
      const lineObj = doc.line(i);
      const lineY = (i - 1) * LINE_PITCH - minimapOffsetY;
      const text = lineObj.text;
      const highlights = lineHighlights.get(i);

      // Check for error/warning background strip
      if (highlights) {
        const hasError = highlights.some(h => h.type === 'error');
        const hasWarning = highlights.some(h => h.type === 'warning');
        if (hasError) {
          ctx.fillStyle = 'rgba(241, 76, 76, 0.55)';
          ctx.fillRect(0, lineY, width, LINE_PITCH);
        } else if (hasWarning) {
          ctx.fillStyle = 'rgba(204, 167, 0, 0.45)';
          ctx.fillRect(0, lineY, width, LINE_PITCH);
        }
      }

      // Draw code line representation
      if (text.length > 0) {
        // Find leading indentation
        let indent = 0;
        while (indent < text.length && (text[indent] === ' ' || text[indent] === '\t')) {
          indent += text[indent] === '\t' ? 2 : 1;
        }

        const startX = Math.min(width - 6, 2 + indent * CHAR_WIDTH);
        const codeWidth = Math.min(width - startX - 4, (text.length - indent) * CHAR_WIDTH);

        if (codeWidth > 0) {
          // Standard code silhouette
          ctx.fillStyle = 'rgba(160, 185, 220, 0.38)';
          ctx.fillRect(startX, lineY + 0.8, codeWidth, 1.8);
        }

        // Draw whitish search highlights
        if (highlights) {
          for (const hl of highlights) {
            if (hl.type === 'search' || hl.type === 'search-active') {
              const hlX = Math.min(width - 6, 2 + (hl.colStart || 0) * CHAR_WIDTH);
              const hlW = Math.max(3, Math.min(width - hlX - 2, ((hl.colEnd || 0) - (hl.colStart || 0)) * CHAR_WIDTH));

              if (hl.type === 'search-active') {
                // Active match: bright crisp white with subtle glow
                ctx.fillStyle = '#ffffff';
                ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
                ctx.shadowBlur = 4;
                ctx.fillRect(hlX - 0.5, lineY, hlW + 1, LINE_PITCH);
                ctx.shadowBlur = 0;
              } else {
                // Other matches: soft whitish / luminous silver
                ctx.fillStyle = 'rgba(240, 245, 255, 0.88)';
                ctx.fillRect(hlX, lineY + 0.2, hlW, LINE_PITCH - 0.4);
              }
            }
          }
        }
      }
    }

    ctx.restore();

    // Position viewport slider
    this.updateSlider(height, totalMinimapHeight);
  }

  private updateSlider(containerHeight: number, totalMinimapHeight: number) {
    const { scrollTop, scrollHeight, clientHeight } = this.view.scrollDOM;
    if (scrollHeight <= clientHeight) {
      this.slider.style.display = 'none';
      return;
    }
    this.slider.style.display = 'block';

    let sliderTop = 0;
    let sliderHeight = 0;

    if (totalMinimapHeight <= containerHeight) {
      const ratio = clientHeight / scrollHeight;
      sliderHeight = Math.max(16, containerHeight * ratio);
      const scrollRatio = scrollTop / (scrollHeight - clientHeight);
      sliderTop = scrollRatio * (containerHeight - sliderHeight);
    } else {
      const ratio = clientHeight / scrollHeight;
      sliderHeight = Math.max(20, containerHeight * ratio);
      const scrollRatio = scrollTop / (scrollHeight - clientHeight);
      sliderTop = scrollRatio * (containerHeight - sliderHeight);
    }

    this.slider.style.top = `${Math.round(sliderTop)}px`;
    this.slider.style.height = `${Math.round(sliderHeight)}px`;
  }

  public destroy() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.view.scrollDOM.removeEventListener('scroll', this.scrollHandler);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mouseup', this.onMouseUp);
    this.container.remove();
  }
}

export const minimapPlugin = ViewPlugin.fromClass(MinimapPlugin);

/**
 * Creates minimap extension for CodeMirror 6.
 */
export function createMinimapExtension(enabled: boolean = true): Extension {
  if (!enabled) return [];
  return [minimapPlugin];
}
