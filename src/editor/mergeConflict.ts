/**
 * Merge Conflict Resolution Lens for CodeMirror
 *
 * When a file contains unresolved git merge conflict markers
 * (<<<<<<<, =======, >>>>>>>), renders:
 *   - Inline action buttons above each conflict block (Accept Current / Accept Incoming / Accept Both)
 *   - Subtle tint highlight on current-branch lines (green) and incoming-branch lines (blue)
 *   - A "separator" tint on the ======= line
 *
 * All operations are pure in-editor text transactions — no git subprocess calls needed.
 */

import {
  EditorView,
  Decoration,
  DecorationSet,
  WidgetType,
  ViewPlugin,
  ViewUpdate
} from '@codemirror/view';
import {
  EditorState,
  StateField,
  StateEffect,
  Transaction,
  Extension
} from '@codemirror/state';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConflictRegion {
  /** 1-based line number of the <<<<<<< marker line */
  markerStartLine: number;
  /** 1-based line number of the ======= separator line */
  separatorLine: number;
  /** 1-based line number of the >>>>>>> marker line */
  markerEndLine: number;
  /** The branch/label from the >>>>>>> line (e.g. "feature-branch") */
  incomingLabel: string;
}

// ---------------------------------------------------------------------------
// Conflict scanner
// ---------------------------------------------------------------------------

function findConflictRegions(state: EditorState): ConflictRegion[] {
  const text = state.doc.toString();
  if (!text.includes('<<<<<<<')) return [];

  const regions: ConflictRegion[] = [];
  const lines = state.doc.lines;

  let i = 1;
  while (i <= lines) {
    const lineText = state.doc.line(i).text;

    if (lineText.startsWith('<<<<<<<')) {
      // Found start marker — search for separator and end marker
      let sepLine = -1;
      let endLine = -1;
      let incomingLabel = '';

      for (let j = i + 1; j <= lines; j++) {
        const jText = state.doc.line(j).text;
        if (jText.startsWith('=======') && sepLine === -1) {
          sepLine = j;
        } else if (jText.startsWith('>>>>>>>') && sepLine !== -1) {
          endLine = j;
          incomingLabel = jText.slice(7).trim();
          break;
        }
        // Another <<<<<<< before >>>>>>> → malformed / nested, skip
        if (jText.startsWith('<<<<<<<') && sepLine === -1) {
          break;
        }
      }

      if (sepLine !== -1 && endLine !== -1) {
        regions.push({
          markerStartLine: i,
          separatorLine: sepLine,
          markerEndLine: endLine,
          incomingLabel
        });
        i = endLine + 1;
        continue;
      }
    }
    i++;
  }

  return regions;
}

// ---------------------------------------------------------------------------
// Action resolution helpers
// ---------------------------------------------------------------------------

function resolveConflict(
  view: EditorView,
  region: ConflictRegion,
  action: 'current' | 'incoming' | 'both'
): void {
  const doc = view.state.doc;

  const startMarkerLine = doc.line(region.markerStartLine);
  const sepLine = doc.line(region.separatorLine);
  const endMarkerLine = doc.line(region.markerEndLine);

  const endOfEndMarker = endMarkerLine.to;

  // Helper: safe line end (handles last line without trailing newline)
  const lineEndWithNewline = (l: typeof startMarkerLine) =>
    l.to < doc.length ? l.to + 1 : l.to;

  let changes: { from: number; to: number; insert: string }[] = [];

  if (action === 'current') {
    // Keep lines between <<<<<<< and =======, remove everything else (markers + incoming)
    const keepFrom = lineEndWithNewline(startMarkerLine); // start after <<<<<<< line
    const keepTo = sepLine.from;                          // up to (not including) ======= line
    const currentContent = doc.sliceString(keepFrom, keepTo);

    changes = [
      { from: startMarkerLine.from, to: endOfEndMarker < doc.length ? endOfEndMarker + 1 : endOfEndMarker, insert: currentContent }
    ];
  } else if (action === 'incoming') {
    // Keep lines between ======= and >>>>>>>, remove everything else (markers + current)
    const keepFrom = lineEndWithNewline(sepLine);         // start after ======= line
    const keepTo = endMarkerLine.from;                    // up to (not including) >>>>>>> line
    const incomingContent = doc.sliceString(keepFrom, keepTo);

    changes = [
      { from: startMarkerLine.from, to: endOfEndMarker < doc.length ? endOfEndMarker + 1 : endOfEndMarker, insert: incomingContent }
    ];
  } else {
    // Keep both — only remove the three marker lines
    const afterStartMarker = lineEndWithNewline(startMarkerLine);
    const sepTo = lineEndWithNewline(sepLine);
    const afterEnd = endOfEndMarker < doc.length ? endOfEndMarker + 1 : endOfEndMarker;

    const currentContent = doc.sliceString(afterStartMarker, sepLine.from);
    const incomingContent = doc.sliceString(sepTo, endMarkerLine.from);
    const combined = currentContent + incomingContent;

    changes = [
      { from: startMarkerLine.from, to: afterEnd, insert: combined }
    ];
  }

  view.dispatch(view.state.update({ changes, userEvent: 'merge-conflict.resolve' }));
}

// ---------------------------------------------------------------------------
// Conflict Lens Widget
// ---------------------------------------------------------------------------

class ConflictLensWidget extends WidgetType {
  constructor(
    private view: EditorView,
    private region: ConflictRegion
  ) {
    super();
  }

  eq(other: ConflictLensWidget): boolean {
    return (
      other.region.markerStartLine === this.region.markerStartLine &&
      other.region.separatorLine === this.region.separatorLine &&
      other.region.markerEndLine === this.region.markerEndLine
    );
  }

  toDOM(): HTMLElement {
    const bar = document.createElement('div');
    bar.className = 'cm-conflict-lens';
    bar.contentEditable = 'false';

    const makeBtn = (label: string, action: 'current' | 'incoming' | 'both') => {
      const btn = document.createElement('button');
      btn.className = 'cm-conflict-btn';
      btn.textContent = label;
      btn.type = 'button';
      btn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        resolveConflict(this.view, this.region, action);
      });
      return btn;
    };

    bar.appendChild(makeBtn('Accept Current', 'current'));
    bar.appendChild(makeBtn('Accept Incoming', 'incoming'));
    bar.appendChild(makeBtn('Accept Both', 'both'));

    const label = document.createElement('span');
    label.className = 'cm-conflict-label';
    label.textContent = this.region.incomingLabel
      ? `Incoming: ${this.region.incomingLabel}`
      : 'Merge conflict';
    bar.appendChild(label);

    return bar;
  }

  ignoreEvent() {
    return true;
  }
}

// ---------------------------------------------------------------------------
// Decoration builder
// ---------------------------------------------------------------------------

function buildConflictDecorations(view: EditorView): DecorationSet {
  const regions = findConflictRegions(view.state);
  if (regions.length === 0) return Decoration.none;

  const widgets: { from: number; decoration: Decoration }[] = [];
  const marks: { from: number; to: number; decoration: Decoration }[] = [];

  const currentLineDeco = Decoration.line({ class: 'cm-conflict-current-line' });
  const incomingLineDeco = Decoration.line({ class: 'cm-conflict-incoming-line' });
  const markerLineDeco = Decoration.line({ class: 'cm-conflict-marker-line' });

  for (const region of regions) {
    const startLine = view.state.doc.line(region.markerStartLine);

    // Widget above the <<<<<<< line
    widgets.push({
      from: startLine.from,
      decoration: Decoration.widget({
        widget: new ConflictLensWidget(view, region),
        side: -1,
        block: true
      })
    });

    // Line decorations (tint backgrounds)
    for (let ln = region.markerStartLine; ln <= region.markerEndLine; ln++) {
      const line = view.state.doc.line(ln);
      if (ln === region.markerStartLine || ln === region.markerEndLine || ln === region.separatorLine) {
        marks.push({ from: line.from, to: line.from, decoration: markerLineDeco });
      } else if (ln < region.separatorLine) {
        marks.push({ from: line.from, to: line.from, decoration: currentLineDeco });
      } else {
        marks.push({ from: line.from, to: line.from, decoration: incomingLineDeco });
      }
    }
  }

  // Decorations must be sorted by `from` position
  const all = [...widgets, ...marks].sort((a, b) => a.from - b.from);

  return Decoration.set(all.map(({ from, decoration }) => decoration.range(from)));
}

// ---------------------------------------------------------------------------
// ViewPlugin
// ---------------------------------------------------------------------------

const mergeConflictPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildConflictDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildConflictDecorations(update.view);
      }
    }
  },
  { decorations: (v) => v.decorations }
);

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the CodeMirror extension for the merge conflict resolution lens.
 * Include this in your editor's extension list (inside a Compartment for enable/disable).
 */
export function createMergeConflictExtension(): Extension {
  return [
    mergeConflictPlugin,
    EditorView.baseTheme({
      '.cm-conflict-lens': {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '3px 8px',
        borderBottom: '1px solid var(--border-color, #3d3d3d)',
        background: 'var(--bg-secondary, rgba(255,255,255,0.04))',
        fontSize: '11px',
        fontFamily: 'var(--font-ui, system-ui, sans-serif)',
        userSelect: 'none'
      },
      '.cm-conflict-btn': {
        border: '1px solid var(--border-color, #3d3d3d)',
        borderRadius: '3px',
        padding: '1px 8px',
        cursor: 'pointer',
        background: 'var(--bg-tertiary, rgba(255,255,255,0.06))',
        color: 'var(--fg-secondary, #c9d1d9)',
        fontSize: '11px',
        lineHeight: '1.6',
        transition: 'border-color 0.1s, color 0.1s'
      },
      '.cm-conflict-btn:hover': {
        borderColor: 'var(--accent-color, #58a6ff)',
        color: 'var(--accent-color, #58a6ff)'
      },
      '.cm-conflict-label': {
        marginLeft: 'auto',
        color: 'var(--fg-muted, #8b949e)',
        fontSize: '10px',
        fontStyle: 'italic'
      },
      '.cm-conflict-current-line': {
        background: 'rgba(78, 201, 148, 0.07)'
      },
      '.cm-conflict-incoming-line': {
        background: 'rgba(88, 166, 255, 0.07)'
      },
      '.cm-conflict-marker-line': {
        background: 'rgba(255, 255, 255, 0.03)'
      }
    })
  ];
}
