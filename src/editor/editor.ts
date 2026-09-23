import {
  EditorView, lineNumbers, highlightActiveLineGutter, highlightSpecialChars, drawSelection,
  dropCursor, keymap, ViewPlugin, Decoration, DecorationSet, ViewUpdate, tooltips
} from '@codemirror/view';
import { EditorState, Compartment } from '@codemirror/state';
import {
  defaultKeymap, history, historyKeymap, indentWithTab, undo, redo, selectAll,
  toggleComment, toggleBlockComment, copyLineDown, copyLineUp, moveLineDown, moveLineUp,
  deleteLine, indentMore, indentLess, selectLine
} from '@codemirror/commands';
import { foldGutter, foldKeymap, indentOnInput, bracketMatching } from '@codemirror/language';
import { closeBrackets, closeBracketsKeymap, autocompletion, completionKeymap, snippet } from '@codemirror/autocomplete';
import { lintGutter } from '@codemirror/lint';
import { search, searchKeymap, highlightSelectionMatches, openSearchPanel } from '@codemirror/search';
import {
  FindWidgetPanel,
  openReplaceWidget,
  handlePreDocumentSwitch,
  handlePostDocumentSwitch
} from './findWidget';

import { themeManager } from '../themes/themeManager';
import { vimIntegration } from './vim';
import { detectLanguage, getLanguageByName } from './languages';
import { createIndentGuidesExtension } from './indentGuides';
import { createMinimapExtension } from './minimap';
import { createOverviewRulerExtension } from './overviewRuler';
import { preferencesService, CursorStyle } from '../services/preferences';
import {
  createCompositeCompletionSource,
  createLspHoverExtension,
  createLspDefinitionExtension,
  updateViewDiagnostics,
  NavigateToLocationHandler
} from './lspExtension';
import { createSignatureHelpExtension } from './signatureHelp';
import { createCodeActionsExtension } from './codeActions';
import { createRenameExtension } from './renameWidget';
import { createReferencesExtension } from './referencesWidget';
import { lspClient, pathToUri, areUrisOrPathsMatching } from '../services/lsp/lspClient';
import { createGitGutterExtension, updateGitGutter, parseUnifiedDiff } from './gitGutter';
import { createMergeConflictExtension } from './mergeConflict';
import { createGitBlameExtension } from './gitBlame';
import { gitService } from '../services/git';

// Smart active line highlighter that automatically yields during selections (e.g. Ctrl+A)
// so the selection highlight is never occluded or hidden by the active line background.
const activeLineDeco = Decoration.line({ class: 'cm-activeLine' });
const smartHighlightActiveLine = ViewPlugin.fromClass(class {
  decorations: DecorationSet;
  constructor(view: EditorView) {
    this.decorations = this.getDeco(view);
  }
  update(update: ViewUpdate) {
    if (update.docChanged || update.selectionSet || update.viewportChanged) {
      this.decorations = this.getDeco(update.view);
    }
  }
  getDeco(view: EditorView) {
    let lastLineStart = -1;
    const deco: any[] = [];
    for (const r of view.state.selection.ranges) {
      // If text is selected on this range (like Ctrl+A), do NOT paint active line over the selection
      if (!r.empty) continue;
      const line = view.lineBlockAt(r.head);
      if (line.from > lastLineStart) {
        deco.push(activeLineDeco.range(line.from));
        lastLineStart = line.from;
      }
    }
    return Decoration.set(deco);
  }
}, {
  decorations: v => v.decorations
});

function createFoldMarkerDOM(open: boolean): HTMLElement {
  const el = document.createElement('span');
  el.className = open ? 'cm-foldMarker cm-foldMarker-open' : 'cm-foldMarker cm-foldMarker-closed';
  el.title = open ? 'Fold block' : 'Unfold block';
  el.setAttribute('aria-label', open ? 'Fold block' : 'Unfold block');

  if (open) {
    el.innerHTML = '<svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 6l4.5 4.5 4.5-4.5"/></svg>';
  } else {
    el.innerHTML = '<svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3.5l4.5 4.5-4.5 4.5"/></svg>';
  }
  return el;
}

export interface CursorPosition {
  line: number;
  col: number;
}

export class EditorManager {
  private view: EditorView | null = null;
  private container: HTMLElement | null = null;

  // Active document and LSP tracking
  private currentFilePath: string | null = null;
  private currentLanguageId: string = 'plaintext';
  private documentVersion: number = 1;
  private lspChangeDebounceTimer: any = null;
  private pendingDocChange: { filePath: string; languageId: string; version: number; text: string } | null = null;
  private onNavigateToLocation?: NavigateToLocationHandler;
  
  // Compartments for dynamic reconfiguration
  private lineNumbersCompartment = new Compartment();
  private languageCompartment = new Compartment();
  private themeCompartment = new Compartment();
  private vimCompartment = new Compartment();
  private tabSizeCompartment = new Compartment();
  private wordWrapCompartment = new Compartment();
  private indentGuidesCompartment = new Compartment();
  private minimapCompartment = new Compartment();
  private overviewRulerCompartment = new Compartment();
  private gitGutterCompartment = new Compartment();
  private mergeConflictCompartment = new Compartment();
  private gitBlameCompartment = new Compartment();

  // Git gutter debounce timer
  private gitGutterDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  private onCursorChange?: (pos: CursorPosition) => void;
  private onContentChange?: (content: string) => void;

  private createExtensions(langExtension: any) {
    const tabSize = preferencesService.get('editor.tabSize') || 2;
    const wordWrap = preferencesService.get('editor.wordWrap');
    const showLineNumbers = preferencesService.get('editor.lineNumbers');
    const showIndentGuides = preferencesService.get('editor.renderIndentGuides') !== false;
    const showMinimap = preferencesService.get('editor.minimap.enabled') !== false;
    const showOverviewRuler = preferencesService.get('editor.overviewRuler.enabled') !== false;
    const showGitGutter = preferencesService.get('editor.gitGutter.enabled') !== false;
    const showGitBlame = preferencesService.get('editor.gitBlame.enabled') !== false;

    return [
      this.lineNumbersCompartment.of(showLineNumbers ? lineNumbers() : []),
      this.indentGuidesCompartment.of(createIndentGuidesExtension(showIndentGuides)),
      this.minimapCompartment.of(createMinimapExtension(showMinimap)),
      this.overviewRulerCompartment.of(createOverviewRulerExtension(showOverviewRuler)),
      this.gitGutterCompartment.of(showGitGutter ? createGitGutterExtension() : []),
      this.mergeConflictCompartment.of(createMergeConflictExtension()),
      this.gitBlameCompartment.of(showGitBlame ? createGitBlameExtension(() => this.currentFilePath) : []),
      highlightActiveLineGutter(),
      highlightSpecialChars(),
      history(),
      foldGutter({
        markerDOM: (open) => createFoldMarkerDOM(open)
      }),
      drawSelection(),
      dropCursor(),
      EditorState.allowMultipleSelections.of(true),
      indentOnInput(),
      bracketMatching(),
      closeBrackets(),
      lintGutter(),
      tooltips({
        position: 'fixed',
        parent: document.body,
        tooltipSpace: (view) => {
          const rect = view.dom.getBoundingClientRect();
          const docElt = view.dom.ownerDocument.documentElement;
          return {
            top: rect.top + 6,
            left: rect.left,
            bottom: rect.bottom - 6,
            right: docElt.clientWidth
          };
        }
      }),
      autocompletion({
        override: [
          createCompositeCompletionSource(
            () => this.currentFilePath,
            () => this.currentLanguageId,
            () => this.flushPendingDocumentChanges()
          )
        ],
        activateOnTyping: true,
        icons: true,
        positionInfo: (_view, list, _option, info, space) => {
          const spaceLeft = list.left - space.left;
          const spaceRight = space.right - list.right;
          const infoWidth = info.right - info.left;
          const infoHeight = info.bottom - info.top;

          // Determine preferred side: right first, then left
          let placeLeft = false;
          if (spaceRight >= 220 || spaceRight >= infoWidth) {
            placeLeft = false;
          } else if (spaceLeft >= 220 || spaceLeft >= infoWidth) {
            placeLeft = true;
          }

          const availableHoriz = placeLeft ? spaceLeft : spaceRight;
          if (availableHoriz >= 180) {
            // There is sufficient horizontal space beside the completion popup.
            // Align top with the list, clamped within viewport bounds.
            const offset = Math.max(space.top, Math.min(list.top, space.bottom - infoHeight)) - list.top;
            const maxWidth = Math.min(380, availableHoriz - 10);
            return {
              style: `top: ${Math.max(0, offset)}px; max-width: ${maxWidth}px; max-height: 280px; overflow-y: auto;`,
              class: placeLeft ? 'cm-completionInfo-left' : 'cm-completionInfo-right'
            };
          }

          // If horizontal space is constrained on both sides, position cleanly below or above
          // the ENTIRE list container so it NEVER overlays or hides any completion options.
          const spaceBelow = space.bottom - list.bottom;
          const spaceAbove = list.top - space.top;
          const listHeight = list.bottom - list.top;
          const maxWidth = Math.min(380, Math.max(260, list.right - list.left));

          if (spaceBelow >= 120 || spaceBelow >= spaceAbove) {
            return {
              style: `top: ${listHeight + 4}px; left: 0px; max-width: ${maxWidth}px; max-height: 180px; overflow-y: auto;`,
              class: 'cm-completionInfo-below'
            };
          } else {
            return {
              style: `bottom: ${listHeight + 4}px; left: 0px; max-width: ${maxWidth}px; max-height: 180px; overflow-y: auto;`,
              class: 'cm-completionInfo-above'
            };
          }
        }
      }),
      createLspHoverExtension(
        () => this.currentFilePath,
        () => this.currentLanguageId,
        () => this.flushPendingDocumentChanges()
      ),
      createLspDefinitionExtension(
        () => this.currentFilePath,
        () => this.currentLanguageId,
        (targetPath, line, col) => {
          if (this.onNavigateToLocation) {
            this.onNavigateToLocation(targetPath, line, col);
          } else {
            this.gotoLine(line, col);
          }
        },
        () => this.flushPendingDocumentChanges()
      ),
      createSignatureHelpExtension(
        () => this.currentFilePath,
        () => this.currentLanguageId,
        () => this.flushPendingDocumentChanges()
      ),
      createCodeActionsExtension(
        () => this.currentFilePath,
        () => this.currentLanguageId,
        () => this.flushPendingDocumentChanges()
      ),
      createRenameExtension(
        () => this.currentFilePath,
        () => this.currentLanguageId,
        () => this.flushPendingDocumentChanges()
      ),
      createReferencesExtension(
        () => this.currentFilePath,
        () => this.currentLanguageId,
        (targetPath, line, col) => {
          if (this.onNavigateToLocation) {
            this.onNavigateToLocation(targetPath, line, col);
          } else {
            this.gotoLine(line, col);
          }
        },
        () => this.flushPendingDocumentChanges()
      ),
      smartHighlightActiveLine,
      highlightSelectionMatches(),
      search({
        top: true,
        createPanel: (view) => new FindWidgetPanel(view)
      }),
      this.tabSizeCompartment.of(EditorState.tabSize.of(tabSize)),
      this.wordWrapCompartment.of(wordWrap ? EditorView.lineWrapping : []),
      this.languageCompartment.of(langExtension),
      this.themeCompartment.of(themeManager.createCodeMirrorTheme()),
      this.vimCompartment.of(vimIntegration.getExtension()),
      keymap.of([
        { key: 'Mod-/', run: toggleComment },
        { key: 'Mod-Shift-/', run: toggleBlockComment },
        { key: 'Shift-Alt-f', run: () => { this.formatDocument(); return true; } },
        { key: 'Shift-Alt-ArrowDown', run: copyLineDown },
        { key: 'Shift-Alt-ArrowUp', run: copyLineUp },
        { key: 'Alt-ArrowDown', run: moveLineDown },
        { key: 'Alt-ArrowUp', run: moveLineUp },
        { key: 'Mod-Shift-k', run: deleteLine },
        { key: 'Mod-]', run: indentMore },
        { key: 'Mod-[', run: indentLess },
        { key: 'Mod-l', run: selectLine },
        { key: 'Mod-f', run: openSearchPanel, scope: 'editor search-panel' },
        { key: 'Mod-h', run: openReplaceWidget, scope: 'editor search-panel' },
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...searchKeymap,
        ...historyKeymap,
        ...foldKeymap,
        ...completionKeymap,
        indentWithTab
      ]),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          this.documentVersion++;
          if (this.onContentChange) {
            this.onContentChange(update.state.doc.toString());
          }

          if (this.currentFilePath) {
            this.pendingDocChange = {
              filePath: this.currentFilePath,
              languageId: this.currentLanguageId,
              version: this.documentVersion,
              text: update.state.doc.toString()
            };

            // Debounced LSP document change notification for background idle sync
            clearTimeout(this.lspChangeDebounceTimer);
            this.lspChangeDebounceTimer = setTimeout(() => {
              this.flushPendingDocumentChanges();
            }, 100);
          }
        }

        if (update.selectionSet && this.onCursorChange) {
          const head = update.state.selection.main.head;
          const line = update.state.doc.lineAt(head);
          this.onCursorChange({
            line: line.number,
            col: head - line.from + 1
          });
        }
      })
    ];
  }

  init(container: HTMLElement, options: {
    initialContent?: string;
    filePath?: string;
    onCursorChange?: (pos: CursorPosition) => void;
    onContentChange?: (content: string) => void;
    onNavigateToLocation?: NavigateToLocationHandler;
  }) {
    this.container = container;
    this.onCursorChange = options.onCursorChange;
    this.onContentChange = options.onContentChange;
    this.onNavigateToLocation = options.onNavigateToLocation;

    const initialContent = options.initialContent || '';
    const filePath = options.filePath || 'untitled.txt';
    this.currentFilePath = filePath;
    const langInfo = detectLanguage(filePath);
    this.currentLanguageId = langInfo.languageId || 'plaintext';
    this.documentVersion = 1;

    const state = EditorState.create({
      doc: initialContent,
      extensions: this.createExtensions(langInfo.extension())
    });

    this.view = new EditorView({
      state,
      parent: container
    });

    this.applyCursorPreferences();
    this.view.dom.setAttribute('data-minimap', String(preferencesService.get('editor.minimap.enabled') !== false));
    vimIntegration.attachView(this.view);

    const cachedDiags = lspClient.getDiagnostics(filePath);
    if (cachedDiags && cachedDiags.length > 0) {
      updateViewDiagnostics(this.view, filePath, cachedDiags);
    }

    // React to theme changes
    themeManager.onThemeChange(() => {
      if (this.view) {
        this.view.dispatch({
          effects: this.themeCompartment.reconfigure(themeManager.createCodeMirrorTheme())
        });
      }
    });

    // React to cursor style & blinking changes
    preferencesService.subscribe('editor.cursorStyle', (style) => {
      if (this.view) {
        this.view.dom.setAttribute('data-cursor-style', style);
      }
    });

    preferencesService.subscribe('editor.cursorBlinking', (blinking) => {
      if (this.view) {
        this.view.dom.setAttribute('data-cursor-blinking', blinking);
      }
    });

    // React to tab size changes
    preferencesService.subscribe('editor.tabSize', (size) => {
      this.setTabSize(size);
    });

    // React to word wrap changes
    preferencesService.subscribe('editor.wordWrap', (wrap) => {
      this.setWordWrap(wrap);
    });

    // React to line numbers changes
    preferencesService.subscribe('editor.lineNumbers', (enabled) => {
      this.setLineNumbers(enabled);
    });

    // React to indent guides, minimap, and overview ruler changes
    preferencesService.subscribe('editor.renderIndentGuides', (enabled) => {
      this.setIndentGuides(enabled);
    });

    preferencesService.subscribe('editor.minimap.enabled', (enabled) => {
      this.setMinimap(enabled);
    });

    preferencesService.subscribe('editor.overviewRuler.enabled', (enabled) => {
      this.setOverviewRuler(enabled);
    });

    // Subscribe to LSP diagnostics
    lspClient.onDiagnostics((params) => {
      if (this.view && this.currentFilePath && areUrisOrPathsMatching(params.uri, this.currentFilePath)) {
        updateViewDiagnostics(this.view, this.currentFilePath, params.diagnostics);
      }
    });

    // Apply workspace edits in active view with undo support
    window.addEventListener('gitero:apply-workspace-edit', (evt: any) => {
      const changesMap = evt?.detail?.changes as Map<string, any[]> | undefined;
      if (!changesMap || !this.view || !this.currentFilePath) return;

      for (const [p, edits] of changesMap.entries()) {
        if (areUrisOrPathsMatching(p, this.currentFilePath)) {
          const doc = this.view.state.doc;
          const sortedEdits = [...edits].sort((a, b) => {
            if (b.range.start.line !== a.range.start.line) {
              return b.range.start.line - a.range.start.line;
            }
            return b.range.start.character - a.range.start.character;
          });
          const changes = sortedEdits.map((te) => {
            const startLineNum = Math.min(doc.lines, te.range.start.line + 1);
            const endLineNum = Math.min(doc.lines, te.range.end.line + 1);
            const startLine = doc.line(startLineNum);
            const endLine = doc.line(endLineNum);
            const f = Math.min(doc.length, startLine.from + te.range.start.character);
            const t = Math.min(doc.length, endLine.from + te.range.end.character);
            return { from: f, to: t, insert: te.newText };
          });
          this.view.dispatch({ changes });
        }
      }
    });

    // Refresh git gutter when the repository changes (commit, checkout, reset…)
    gitService.onRepositoryChange(() => {
      this.scheduleGitGutterUpdate(this.currentFilePath);
    });

    // Live toggle: git gutter
    preferencesService.subscribe('editor.gitGutter.enabled', (enabled) => {
      if (!this.view) return;
      this.view.dispatch({
        effects: this.gitGutterCompartment.reconfigure(enabled ? createGitGutterExtension() : [])
      });
      if (enabled) this.scheduleGitGutterUpdate(this.currentFilePath);
    });

    // Live toggle: git blame
    preferencesService.subscribe('editor.gitBlame.enabled', (enabled) => {
      if (!this.view) return;
      this.view.dispatch({
        effects: this.gitBlameCompartment.reconfigure(
          enabled ? createGitBlameExtension(() => this.currentFilePath) : []
        )
      });
    });
  }
 
  /**
   * Flushes any pending debounced document change notification to LSP immediately.
   * Call this synchronously before dispatching positional requests (completion, hover, definition).
   */
  flushPendingDocumentChanges(): void {
    if (this.lspChangeDebounceTimer) {
      clearTimeout(this.lspChangeDebounceTimer);
      this.lspChangeDebounceTimer = null;
    }
    if (this.pendingDocChange && this.pendingDocChange.filePath) {
      const change = this.pendingDocChange;
      this.pendingDocChange = null;
      lspClient.notifyDidChange(
        change.filePath,
        change.languageId,
        change.version,
        change.text
      );
    }
  }

  loadDocument(content: string, filePath: string) {
    if (!this.view) return;

    if (this.lspChangeDebounceTimer) {
      clearTimeout(this.lspChangeDebounceTimer);
      this.lspChangeDebounceTimer = null;
    }
    this.pendingDocChange = null;

    this.currentFilePath = filePath;
    const langInfo = detectLanguage(filePath);
    this.currentLanguageId = langInfo.languageId || 'plaintext';
    this.documentVersion = lspClient.getDocumentVersion(filePath, this.currentLanguageId) || 1;

    const findState = handlePreDocumentSwitch();

    this.view.setState(
      EditorState.create({
        doc: content,
        extensions: this.createExtensions(langInfo.extension())
      })
    );

    this.applyCursorPreferences();
    this.view.dom.setAttribute('data-minimap', String(preferencesService.get('editor.minimap.enabled') !== false));
    vimIntegration.attachView(this.view);

    handlePostDocumentSwitch(this.view, findState);
    if (!findState.wasFindFocused) {
      this.view.focus();
    }

    // Immediately restore cached LSP diagnostics so squiggles persist with zero lag across file switches
    const cachedDiags = lspClient.getDiagnostics(filePath);
    if (cachedDiags && cachedDiags.length > 0) {
      updateViewDiagnostics(this.view, filePath, cachedDiags);
    }

    lspClient.notifyDidOpen(filePath, this.currentLanguageId, this.documentVersion, content);

    // Schedule git gutter diff update for the newly loaded file
    this.scheduleGitGutterUpdate(filePath);
  }

  /**
   * Fetches git diff for the given file and updates the gutter decorations.
   * Debounced to avoid hammering git on rapid file switches.
   */
  private scheduleGitGutterUpdate(filePath: string | null) {
    if (this.gitGutterDebounceTimer !== null) {
      clearTimeout(this.gitGutterDebounceTimer);
      this.gitGutterDebounceTimer = null;
    }
    if (!filePath || preferencesService.get('editor.gitGutter.enabled') === false) return;

    this.gitGutterDebounceTimer = setTimeout(async () => {
      this.gitGutterDebounceTimer = null;
      if (!this.view || this.currentFilePath !== filePath) return;

      // getDiffForFile accepts an absolute path and normalizes it internally
      const diff = await gitService.getDiffForFile(filePath);
      if (!this.view || this.currentFilePath !== filePath) return;

      const diffMap = parseUnifiedDiff(diff);
      updateGitGutter(this.view, diffMap);
    }, 200);
  }

  notifyDidSave() {
    if (this.currentFilePath) {
      lspClient.notifyDidSave(this.currentFilePath, this.currentLanguageId, this.getContent());
    }
  }

  notifyDidClose(filePath: string, languageId?: string) {
    const lang = (languageId && languageId !== 'plaintext')
      ? languageId
      : (detectLanguage(filePath).languageId || 'plaintext');
    lspClient.notifyDidClose(filePath, lang);
  }

  getCurrentFilePath(): string | null {
    return this.currentFilePath;
  }

  getCurrentLanguageId(): string {
    return this.currentLanguageId;
  }

  getContent(): string {
    return this.view ? this.view.state.doc.toString() : '';
  }

  setContent(content: string) {
    if (!this.view) return;
    this.view.dispatch({
      changes: {
        from: 0,
        to: this.view.state.doc.length,
        insert: content
      }
    });
  }

  async formatDocument(): Promise<boolean> {
    if (!this.view || !this.currentFilePath || !this.currentLanguageId) return false;
    this.flushPendingDocumentChanges();
    const tabSize = preferencesService.get('editor.tabSize') || 2;
    const insertSpaces = preferencesService.get('editor.insertSpaces') !== false;

    try {
      const edits = await lspClient.requestFormatting(this.currentFilePath, this.currentLanguageId, {
        tabSize,
        insertSpaces
      });
      if (!edits || edits.length === 0) {
        return false;
      }

      const doc = this.view.state.doc;
      const sortedEdits = [...edits].sort((a, b) => {
        if (b.range.start.line !== a.range.start.line) {
          return b.range.start.line - a.range.start.line;
        }
        return b.range.start.character - a.range.start.character;
      });

      const changes = sortedEdits.map((te) => {
        const startLineNum = Math.min(doc.lines, te.range.start.line + 1);
        const endLineNum = Math.min(doc.lines, te.range.end.line + 1);
        const startLine = doc.line(startLineNum);
        const endLine = doc.line(endLineNum);
        const f = Math.min(doc.length, startLine.from + te.range.start.character);
        const t = Math.min(doc.length, endLine.from + te.range.end.character);
        return { from: f, to: t, insert: te.newText };
      });

      this.view.dispatch({ changes });
      return true;
    } catch (err) {
      console.warn('[Format Document Error]', err);
      return false;
    }
  }

  setLanguage(filePath: string) {
    if (!this.view) return;
    const langInfo = detectLanguage(filePath);
    this.currentLanguageId = langInfo.languageId || 'plaintext';
    this.view.dispatch({
      effects: this.languageCompartment.reconfigure(langInfo.extension())
    });
  }

  setLanguageByName(langName: string) {
    if (!this.view) return;
    const langInfo = getLanguageByName(langName);
    this.currentLanguageId = langInfo.languageId || 'plaintext';
    this.view.dispatch({
      effects: this.languageCompartment.reconfigure(langInfo.extension())
    });
  }

  setTabSize(size: number) {
    if (!this.view) return;
    this.view.dispatch({
      effects: this.tabSizeCompartment.reconfigure(EditorState.tabSize.of(size))
    });
  }

  setWordWrap(wrap: boolean) {
    if (!this.view) return;
    this.view.dispatch({
      effects: this.wordWrapCompartment.reconfigure(wrap ? EditorView.lineWrapping : [])
    });
  }

  setLineNumbers(show: boolean) {
    if (!this.view) return;
    this.view.dispatch({
      effects: this.lineNumbersCompartment.reconfigure(show ? lineNumbers() : [])
    });
  }

  toggleWordWrap(): boolean {
    const current = preferencesService.get('editor.wordWrap');
    const next = !current;
    preferencesService.set('editor.wordWrap', next);
    this.setWordWrap(next);
    return next;
  }

  setIndentGuides(enabled: boolean) {
    if (!this.view) return;
    this.view.dispatch({
      effects: this.indentGuidesCompartment.reconfigure(createIndentGuidesExtension(enabled))
    });
  }

  toggleIndentGuides(): boolean {
    const current = preferencesService.get('editor.renderIndentGuides') !== false;
    const next = !current;
    preferencesService.set('editor.renderIndentGuides', next);
    this.setIndentGuides(next);
    return next;
  }

  setMinimap(enabled: boolean) {
    document.documentElement.classList.toggle('init-minimap-collapsed', !enabled);
    if (!this.view) return;
    this.view.dom.setAttribute('data-minimap', String(enabled));
    this.view.dispatch({
      effects: this.minimapCompartment.reconfigure(createMinimapExtension(enabled))
    });
  }

  toggleMinimap(): boolean {
    const current = preferencesService.get('editor.minimap.enabled') !== false;
    const next = !current;
    preferencesService.set('editor.minimap.enabled', next);
    this.setMinimap(next);
    return next;
  }

  setOverviewRuler(enabled: boolean) {
    if (!this.view) return;
    this.view.dispatch({
      effects: this.overviewRulerCompartment.reconfigure(createOverviewRulerExtension(enabled))
    });
  }

  toggleOverviewRuler(): boolean {
    const current = preferencesService.get('editor.overviewRuler.enabled') !== false;
    const next = !current;
    preferencesService.set('editor.overviewRuler.enabled', next);
    this.setOverviewRuler(next);
    return next;
  }

  undo(): boolean {
    if (!this.view) return false;
    return undo(this.view);
  }

  redo(): boolean {
    if (!this.view) return false;
    return redo(this.view);
  }

  selectAll(): boolean {
    if (!this.view) return false;
    return selectAll(this.view);
  }

  openSearch(): void {
    if (!this.view) return;
    openSearchPanel(this.view);
  }

  openReplace(): void {
    if (!this.view) return;
    openReplaceWidget(this.view);
  }

  gotoLine(lineNumber: number, colNumber: number = 1) {
    if (!this.view) return;
    const doc = this.view.state.doc;
    const safeLine = Math.max(1, Math.min(lineNumber, doc.lines));
    const line = doc.line(safeLine);
    const safeCol = Math.max(1, Math.min(colNumber, line.length + 1));
    const targetPos = line.from + safeCol - 1;

    this.view.dispatch({
      selection: { anchor: targetPos, head: targetPos },
      scrollIntoView: true
    });
    this.view.focus();
  }

  toggleVim(enabled: boolean) {
    vimIntegration.setEnabled(enabled);
    if (this.view) {
      this.view.dispatch({
        effects: this.vimCompartment.reconfigure(vimIntegration.getExtension())
      });
      vimIntegration.attachView(this.view);
    }
  }

  focus() {
    this.view?.focus();
  }

  private applyCursorPreferences() {
    if (!this.view) return;
    const style = preferencesService.get('editor.cursorStyle');
    const blinking = preferencesService.get('editor.cursorBlinking');
    this.view.dom.setAttribute('data-cursor-style', style);
    this.view.dom.setAttribute('data-cursor-blinking', blinking);
  }

  getCursorStyle(): CursorStyle {
    return preferencesService.get('editor.cursorStyle');
  }

  setCursorStyle(style: CursorStyle) {
    preferencesService.set('editor.cursorStyle', style);
    if (this.view) {
      this.view.dom.setAttribute('data-cursor-style', style);
    }
  }

  cycleCursorStyle(): CursorStyle {
    const current = preferencesService.get('editor.cursorStyle');
    const styles: CursorStyle[] = ['line', 'block', 'underline'];
    const nextIdx = (styles.indexOf(current) + 1) % styles.length;
    const nextStyle = styles[nextIdx];
    this.setCursorStyle(nextStyle);
    return nextStyle;
  }

  toggleComment(): boolean {
    if (!this.view) return false;
    return toggleComment(this.view);
  }

  toggleBlockComment(): boolean {
    if (!this.view) return false;
    return toggleBlockComment(this.view);
  }

  copyLineDown(): boolean {
    if (!this.view) return false;
    return copyLineDown(this.view);
  }

  copyLineUp(): boolean {
    if (!this.view) return false;
    return copyLineUp(this.view);
  }

  moveLineDown(): boolean {
    if (!this.view) return false;
    return moveLineDown(this.view);
  }

  moveLineUp(): boolean {
    if (!this.view) return false;
    return moveLineUp(this.view);
  }

  deleteLine(): boolean {
    if (!this.view) return false;
    return deleteLine(this.view);
  }

  indentMore(): boolean {
    if (!this.view) return false;
    return indentMore(this.view);
  }

  indentLess(): boolean {
    if (!this.view) return false;
    return indentLess(this.view);
  }

  selectLine(): boolean {
    if (!this.view) return false;
    return selectLine(this.view);
  }

  insertSnippet(template: string) {
    if (!this.view) return;
    snippet(template)(this.view, null, this.view.state.selection.main.from, this.view.state.selection.main.to);
    this.view.focus();
  }

  destroy() {
    this.view?.destroy();
    this.view = null;
  }
}

export const editorManager = new EditorManager();
