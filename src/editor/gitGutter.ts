/**
 * Git Gutter Extension for CodeMirror
 *
 * Renders colored diff indicator bars in the line-number gutter:
 *   - Green  bar → line added (not present in HEAD)
 *   - Amber  bar → line modified (changed from HEAD)
 *   - Red triangle → deletion point (a line that existed in HEAD is now gone)
 *
 * Usage:
 *   const ext = createGitGutterExtension();
 *   // later, when diff data is ready:
 *   updateGitGutter(view, lineDiffs);
 */

import {
  EditorView,
  GutterMarker,
  gutter,
  ViewUpdate,
  ViewPlugin
} from '@codemirror/view';
import {
  StateField,
  StateEffect,
  Extension
} from '@codemirror/state';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LineDiffType = 'added' | 'modified' | 'deleted';

/** Maps 1-based line numbers to their diff type */
export type LineDiffMap = Map<number, LineDiffType>;

// ---------------------------------------------------------------------------
// StateEffect — used to push fresh diff data into the view
// ---------------------------------------------------------------------------

export const setGitGutterDiff = StateEffect.define<LineDiffMap>();

// ---------------------------------------------------------------------------
// StateField — holds the current LineDiffMap
// ---------------------------------------------------------------------------

const gitGutterState = StateField.define<LineDiffMap>({
  create() {
    return new Map();
  },
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setGitGutterDiff)) {
        return effect.value;
      }
    }
    return value;
  }
});

// ---------------------------------------------------------------------------
// GutterMarker subclasses
// ---------------------------------------------------------------------------

class AddedMarker extends GutterMarker {
  toDOM() {
    const el = document.createElement('div');
    el.className = 'cm-git-gutter-added';
    el.title = 'Added line';
    return el;
  }
}

class ModifiedMarker extends GutterMarker {
  toDOM() {
    const el = document.createElement('div');
    el.className = 'cm-git-gutter-modified';
    el.title = 'Modified line';
    return el;
  }
}

class DeletedMarker extends GutterMarker {
  toDOM() {
    const el = document.createElement('div');
    el.className = 'cm-git-gutter-deleted';
    el.title = 'Deleted line (existed in HEAD)';
    return el;
  }
}

const addedMarker = new AddedMarker();
const modifiedMarker = new ModifiedMarker();
const deletedMarker = new DeletedMarker();

// ---------------------------------------------------------------------------
// Unified diff parser
// ---------------------------------------------------------------------------

/**
 * Parse a unified diff string into a LineDiffMap keyed by new (post-diff) line numbers.
 * Deleted lines are recorded at the line number AFTER the deletion point.
 */
export function parseUnifiedDiff(diff: string): LineDiffMap {
  const result: LineDiffMap = new Map();
  if (!diff) return result;

  const lines = diff.split(/\r?\n/);
  let currentNewLine = 0;

  for (const line of lines) {
    // Hunk header: @@ -oldStart,oldCount +newStart,newCount @@
    const hunkMatch = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunkMatch) {
      currentNewLine = parseInt(hunkMatch[1], 10);
      continue;
    }

    if (line.startsWith('+') && !line.startsWith('+++')) {
      // Added line — mark as added (or upgrade to modified if already deleted at same pos)
      const existing = result.get(currentNewLine);
      result.set(currentNewLine, existing === 'deleted' ? 'modified' : 'added');
      currentNewLine++;
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      // Deleted line — record at current new-line position as a deletion marker
      // The currentNewLine does NOT advance for deleted lines
      if (!result.has(currentNewLine)) {
        result.set(currentNewLine, 'deleted');
      } else if (result.get(currentNewLine) === 'added') {
        result.set(currentNewLine, 'modified');
      }
    } else if (!line.startsWith('\\') && !line.startsWith('diff') && !line.startsWith('index') && !line.startsWith('---') && !line.startsWith('+++')) {
      // Context line — advances new-line counter
      currentNewLine++;
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Gutter definition
// ---------------------------------------------------------------------------

const gitGutter = gutter({
  class: 'cm-git-gutter',
  lineMarker(view, line) {
    const diffMap = view.state.field(gitGutterState);
    const lineInfo = view.state.doc.lineAt(line.from);
    const diffType = diffMap.get(lineInfo.number);
    if (!diffType) return null;
    if (diffType === 'added') return addedMarker;
    if (diffType === 'modified') return modifiedMarker;
    if (diffType === 'deleted') return deletedMarker;
    return null;
  },
  lineMarkerChange(update) {
    // Redraw when the diff map changes or document changes
    return update.docChanged || update.transactions.some(tr =>
      tr.effects.some(e => e.is(setGitGutterDiff))
    );
  },
  initialSpacer: () => addedMarker
});

// ---------------------------------------------------------------------------
// ViewPlugin — redraws gutter on state change
// ---------------------------------------------------------------------------

const gitGutterPlugin = ViewPlugin.fromClass(class {
  update(_update: ViewUpdate) {
    // Handled reactively by StateField + gutter lineMarkerChange
  }
});

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the CodeMirror extensions needed for git gutter support.
 * Add this to your editor's extension list (inside a Compartment for dynamic enable/disable).
 */
export function createGitGutterExtension(): Extension {
  return [
    gitGutterState,
    gitGutter,
    gitGutterPlugin,
    EditorView.baseTheme({
      '.cm-git-gutter': {
        width: '4px',
        minWidth: '4px',
        padding: '0',
        borderRight: 'none'
      }
    })
  ];
}

/**
 * Dispatch fresh diff data to the editor view.
 * Call this after fetching `git diff HEAD -- <file>` and parsing the result.
 */
export function updateGitGutter(view: EditorView, diffMap: LineDiffMap): void {
  view.dispatch({ effects: setGitGutterDiff.of(diffMap) });
}
