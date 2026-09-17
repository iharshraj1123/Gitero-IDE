import { EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { Extension } from '@codemirror/state';
import { getSearchQuery, SearchQuery } from '@codemirror/search';
import { forEachDiagnostic, Diagnostic } from '@codemirror/lint';

export interface OverviewMarker {
  type: 'error' | 'warning' | 'info' | 'search' | 'search-active';
  line: number;
  from: number;
  to: number;
  message?: string;
}

class OverviewRulerPlugin {
  private readonly rulerDom: HTMLElement;
  private readonly markersContainer: HTMLElement;
  private tooltipEl: HTMLElement | null = null;
  private rafId: number | null = null;
  private markers: OverviewMarker[] = [];

  constructor(private readonly view: EditorView) {
    this.rulerDom = document.createElement('div');
    this.rulerDom.className = 'gitero-overview-ruler';
    this.rulerDom.setAttribute('aria-hidden', 'true');

    this.markersContainer = document.createElement('div');
    this.markersContainer.className = 'gitero-overview-ruler-markers';
    this.rulerDom.appendChild(this.markersContainer);

    this.bindEvents();

    // Attach to editor DOM
    this.view.dom.appendChild(this.rulerDom);
    this.scheduleRender();
  }

  private bindEvents() {
    this.markersContainer.addEventListener('click', (e) => {
      const target = (e.target as HTMLElement).closest('.gitero-ruler-marker') as HTMLElement;
      if (target) {
        const from = Number(target.dataset.from);
        const to = Number(target.dataset.to);
        if (!isNaN(from)) {
          this.view.dispatch({
            selection: { anchor: from, head: to || from },
            scrollIntoView: true
          });
          this.view.focus();
        }
        return;
      }

      // Clicking on the ruler track jumps to that vertical percentage
      const rect = this.markersContainer.getBoundingClientRect();
      if (rect.height <= 0) return;
      const clickY = e.clientY - rect.top;
      const ratio = Math.max(0, Math.min(1, clickY / rect.height));
      const totalLines = this.view.state.doc.lines;
      const targetLine = Math.max(1, Math.min(totalLines, Math.round(ratio * totalLines)));
      const lineObj = this.view.state.doc.line(targetLine);
      this.view.dispatch({
        selection: { anchor: lineObj.from, head: lineObj.from },
        scrollIntoView: true
      });
      this.view.focus();
    });

    this.markersContainer.addEventListener('mouseover', (e) => {
      const target = (e.target as HTMLElement).closest('.gitero-ruler-marker') as HTMLElement;
      if (target && target.dataset.tooltip) {
        this.showTooltip(target, target.dataset.tooltip);
      }
    });

    this.markersContainer.addEventListener('mouseout', (e) => {
      const target = (e.target as HTMLElement).closest('.gitero-ruler-marker') as HTMLElement;
      if (target) {
        this.hideTooltip();
      }
    });
  }

  private showTooltip(target: HTMLElement, text: string) {
    if (!this.tooltipEl) {
      this.tooltipEl = document.createElement('div');
      this.tooltipEl.className = 'gitero-ruler-tooltip';
      document.body.appendChild(this.tooltipEl);
    }
    this.tooltipEl.textContent = text;
    this.tooltipEl.style.display = 'block';

    const rect = target.getBoundingClientRect();
    const tooltipRect = this.tooltipEl.getBoundingClientRect();
    let top = rect.top + rect.height / 2 - tooltipRect.height / 2;
    let right = window.innerWidth - rect.left + 8;

    if (top < 8) top = 8;
    if (top + tooltipRect.height > window.innerHeight - 8) {
      top = window.innerHeight - tooltipRect.height - 8;
    }

    this.tooltipEl.style.top = `${top}px`;
    this.tooltipEl.style.right = `${right}px`;
  }

  private hideTooltip() {
    if (this.tooltipEl) {
      this.tooltipEl.style.display = 'none';
    }
  }

  public update(update: ViewUpdate) {
    let shouldUpdate = update.docChanged || update.geometryChanged || update.viewportChanged;

    if (!shouldUpdate) {
      for (const tr of update.transactions) {
        if (tr.docChanged || tr.selection) {
          shouldUpdate = true;
          break;
        }
        for (const ef of tr.effects) {
          // Detect diagnostic updates and search query changes
          if ((ef.value as any)?.diagnostics || (ef as any).is?.(SearchQuery as any) || (ef as any).is?.(getSearchQuery as any)) {
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

  private collectMarkers(): OverviewMarker[] {
    const markers: OverviewMarker[] = [];
    const doc = this.view.state.doc;
    const totalLines = doc.lines;
    if (totalLines <= 0) return markers;

    // 1. Collect diagnostics from @codemirror/lint
    try {
      forEachDiagnostic(this.view.state, (diag: Diagnostic, from: number, to: number) => {
        const safeFrom = Math.min(doc.length, Math.max(0, from));
        const line = doc.lineAt(safeFrom).number;
        let type: 'error' | 'warning' | 'info' = 'error';
        if (diag.severity === 'warning') type = 'warning';
        else if (diag.severity === 'info' || diag.severity === 'hint') type = 'info';

        markers.push({
          type,
          line,
          from: safeFrom,
          to: Math.min(doc.length, Math.max(safeFrom, to)),
          message: diag.message
        });
      });
    } catch {}

    // 2. Collect search matches from active SearchQuery
    try {
      const query = getSearchQuery(this.view.state);
      if (query && query.valid && query.search && query.search.length > 0) {
        const cursor = query.getCursor(this.view.state);
        const mainSel = this.view.state.selection.main;
        let count = 0;
        const maxMatches = 1500;

        while (count < maxMatches) {
          const item = cursor.next();
          if (item.done) break;
          const match = item.value;
          const line = doc.lineAt(match.from).number;
          const isActive = match.from <= mainSel.from && match.to >= mainSel.to;

          markers.push({
            type: isActive ? 'search-active' : 'search',
            line,
            from: match.from,
            to: match.to,
            message: `Search match: "${query.search}"`
          });
          count++;
        }
      }
    } catch {}

    return markers;
  }

  private render() {
    const rulerHeight = this.rulerDom.clientHeight;
    if (rulerHeight <= 10) return;

    this.markers = this.collectMarkers();
    const totalLines = Math.max(1, this.view.state.doc.lines);

    // Build DOM fragments
    const fragment = document.createDocumentFragment();

    for (const marker of this.markers) {
      const ratio = (marker.line - 1) / Math.max(1, totalLines - 1);
      const markerEl = document.createElement('div');
      markerEl.className = `gitero-ruler-marker gitero-ruler-${marker.type}`;
      markerEl.dataset.from = String(marker.from);
      markerEl.dataset.to = String(marker.to);

      let tooltip = '';
      if (marker.type === 'error') {
        tooltip = `Error (Line ${marker.line}): ${marker.message || 'Syntax or Type Error'}`;
      } else if (marker.type === 'warning') {
        tooltip = `Warning (Line ${marker.line}): ${marker.message || 'Diagnostic Warning'}`;
      } else if (marker.type === 'info') {
        tooltip = `Info (Line ${marker.line}): ${marker.message || 'Diagnostic Info'}`;
      } else if (marker.type === 'search-active') {
        tooltip = `Current match (Line ${marker.line}): ${marker.message || ''}`;
      } else {
        tooltip = `Match (Line ${marker.line}): ${marker.message || ''}`;
      }
      markerEl.dataset.tooltip = tooltip;

      const topPx = Math.round(ratio * (rulerHeight - 4));
      markerEl.style.top = `${topPx}px`;

      fragment.appendChild(markerEl);
    }

    this.markersContainer.innerHTML = '';
    this.markersContainer.appendChild(fragment);
  }

  public destroy() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.hideTooltip();
    if (this.tooltipEl) {
      this.tooltipEl.remove();
      this.tooltipEl = null;
    }
    this.rulerDom.remove();
  }
}

export const overviewRulerPlugin = ViewPlugin.fromClass(OverviewRulerPlugin);

/**
 * Creates overview ruler extension for CodeMirror 6.
 */
export function createOverviewRulerExtension(enabled: boolean = true): Extension {
  if (!enabled) return [];
  return [overviewRulerPlugin];
}
