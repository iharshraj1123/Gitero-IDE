/**
 * Git Blame Ghost Annotation for CodeMirror
 *
 * When the cursor rests on the same line for 600ms, fetches git blame for
 * that specific line and renders a soft grey italic annotation at the end
 * of the line showing: author name, relative date, commit message snippet.
 *
 * The annotation is instantly cleared on any document edit or cursor movement.
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
  StateField,
  StateEffect,
  Extension
} from '@codemirror/state';
import { BlameInfo } from '../services/git';
import { gitService } from '../services/git';

// ---------------------------------------------------------------------------
// StateEffect & StateField
// ---------------------------------------------------------------------------

interface BlameState {
  /** 1-based line number that was blamed, or -1 if cleared */
  lineNumber: number;
  blame: BlameInfo | null;
}

export const setBlameAnnotation = StateEffect.define<BlameState>();

const blameStateField = StateField.define<BlameState>({
  create() {
    return { lineNumber: -1, blame: null };
  },
  update(value, tr) {
    // Clear on any document edit immediately
    if (tr.docChanged) return { lineNumber: -1, blame: null };
    for (const effect of tr.effects) {
      if (effect.is(setBlameAnnotation)) return effect.value;
    }
    return value;
  },
  provide(field) {
    return EditorView.decorations.from(field, (state) => buildBlameDecoration(state));
  }
});

// ---------------------------------------------------------------------------
// Widget
// ---------------------------------------------------------------------------

class BlameWidget extends WidgetType {
  constructor(private blame: BlameInfo) {
    super();
  }

  eq(other: BlameWidget): boolean {
    return (
      other.blame.authorName === this.blame.authorName &&
      other.blame.relativeDate === this.blame.relativeDate &&
      other.blame.commitMessage === this.blame.commitMessage
    );
  }

  toDOM(): HTMLElement {
    const span = document.createElement('span');
    span.className = 'cm-git-blame-ghost';

    if (this.blame.isUncommitted) {
      span.textContent = 'Not yet committed';
    } else {
      const author = this.blame.authorName || 'Unknown';
      const date = this.blame.relativeDate;
      const msg = this.blame.commitMessage
        ? this.blame.commitMessage.slice(0, 60) + (this.blame.commitMessage.length > 60 ? '…' : '')
        : '';
      span.textContent = msg
        ? `${author}, ${date}  •  ${msg}`
        : `${author}, ${date}`;
    }

    return span;
  }

  ignoreEvent() {
    return true;
  }
}

// ---------------------------------------------------------------------------
// Decoration builder
// ---------------------------------------------------------------------------

function buildBlameDecoration(state: BlameState): DecorationSet {
  if (state.lineNumber < 1 || !state.blame) return Decoration.none;

  // We don't have the view here, so we need this called from the StateField provide.
  // The StateField.provide callback gives us the EditorState, not the view.
  // We'll use a workaround: the line number is stored so we can use it.
  // Actually in StateField.provide we get EditorState from the state itself.
  // Return a placeholder — the ViewPlugin will handle positioning properly.
  return Decoration.none;
}

// ---------------------------------------------------------------------------
// ViewPlugin — handles debounce timer and decoration positioning
// ---------------------------------------------------------------------------

class BlamePlugin {
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private currentLine: number = -1;
  private pendingClearBlame: boolean = false;
  decorations: DecorationSet = Decoration.none;

  constructor(private view: EditorView, private getFilePath: () => string | null) {}

  update(update: ViewUpdate) {
    // Clear decorations immediately if doc changed
    if (update.docChanged) {
      this.deferredClearBlame();
      return;
    }

    // Check if cursor moved to a different line
    if (update.selectionSet) {
      const head = update.state.selection.main.head;
      const line = update.state.doc.lineAt(head);
      const newLineNumber = line.number;

      if (newLineNumber !== this.currentLine) {
        this.currentLine = newLineNumber;
        // Clear current annotation immediately on line change
        this.deferredClearBlame();
        // Schedule new blame fetch after 600ms idle
        this.scheduleBlameFetch(newLineNumber);
      }
    }

    // Rebuild decorations if blame state changed
    const blameState = update.state.field(blameStateField);
    if (blameState.lineNumber > 0 && blameState.blame) {
      this.decorations = this.buildDecorations(update.view, blameState);
    } else {
      this.decorations = Decoration.none;
    }
  }

  /**
   * Deferred dispatch outside the current update cycle.
   * CodeMirror forbids calling view.dispatch() from inside a ViewPlugin.update() call
   * (it throws "Calls to EditorView.update are not allowed while an update is in progress").
   * Using Promise.resolve().then() pushes the dispatch to a microtask that runs after the
   * current update cycle fully completes.
   */
  private deferredClearBlame() {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.pendingClearBlame) return; // already scheduled
    this.pendingClearBlame = true;
    Promise.resolve().then(() => {
      this.pendingClearBlame = false;
      if (!this.view || this.view.state.doc.length === 0) return;
      // Only dispatch if there's actually a blame annotation to clear
      const blameState = this.view.state.field(blameStateField, false);
      if (blameState && blameState.lineNumber !== -1) {
        this.decorations = Decoration.none;
        this.view.dispatch({
          effects: setBlameAnnotation.of({ lineNumber: -1, blame: null })
        });
      } else {
        this.decorations = Decoration.none;
      }
    });
  }

  private scheduleBlameFetch(lineNumber: number) {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(async () => {
      this.debounceTimer = null;
      const filePath = this.getFilePath();
      if (!filePath) return;
      // Ensure cursor is still on the same line
      const currentHead = this.view.state.selection.main.head;
      const currentLine = this.view.state.doc.lineAt(currentHead).number;
      if (currentLine !== lineNumber) return;

      try {
        const blame = await gitService.getBlameForLine(filePath, lineNumber);
        if (!blame) return;
        // One final check before dispatching
        const finalHead = this.view.state.selection.main.head;
        const finalLine = this.view.state.doc.lineAt(finalHead).number;
        if (finalLine !== lineNumber) return;

        this.view.dispatch({
          effects: setBlameAnnotation.of({ lineNumber, blame })
        });
      } catch {
        // Silently ignore blame errors (file not tracked, no commits, etc.)
      }
    }, 600);
  }

  /** Direct synchronous clear — safe to call from outside an update cycle (e.g. destroy). */
  private clearBlame() {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.decorations = Decoration.none;
    this.view.dispatch({
      effects: setBlameAnnotation.of({ lineNumber: -1, blame: null })
    });
  }

  private buildDecorations(view: EditorView, state: BlameState): DecorationSet {
    if (state.lineNumber < 1 || !state.blame) return Decoration.none;
    const doc = view.state.doc;
    if (state.lineNumber > doc.lines) return Decoration.none;

    const line = doc.line(state.lineNumber);
    return Decoration.set([
      Decoration.widget({
        widget: new BlameWidget(state.blame),
        side: 1
      }).range(line.to)
    ]);
  }

  destroy() {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Creates the git blame ghost annotation extension.
 *
 * @param getFilePath - Getter that returns the currently open file path (or null).
 */
export function createGitBlameExtension(getFilePath: () => string | null): Extension {
  const plugin = ViewPlugin.fromClass(
    class extends BlamePlugin {
      constructor(view: EditorView) {
        super(view, getFilePath);
      }
    },
    { decorations: (v) => v.decorations }
  );

  return [
    blameStateField,
    plugin,
    EditorView.baseTheme({
      '.cm-git-blame-ghost': {
        color: 'var(--fg-muted, #8b949e)',
        opacity: '0.5',
        fontStyle: 'italic',
        fontSize: '12px',
        marginLeft: '40px',
        whiteSpace: 'pre',
        pointerEvents: 'none',
        userSelect: 'none',
        display: 'inline-block',
        verticalAlign: 'bottom',
        lineHeight: '1.5'
      }
    })
  ];
}
