import {
  EditorView, lineNumbers, highlightActiveLineGutter, highlightSpecialChars, drawSelection,
  dropCursor, keymap, ViewPlugin, Decoration, DecorationSet, ViewUpdate
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
import { FindWidgetPanel, openReplaceWidget } from './findWidget';

import { themeManager } from '../themes/themeManager';
import { vimIntegration } from './vim';
import { detectLanguage, getLanguageByName } from './languages';
import { preferencesService, CursorStyle } from '../services/preferences';
import {
  createCompositeCompletionSource,
  createLspHoverExtension,
  createLspDefinitionExtension,
  updateViewDiagnostics,
  NavigateToLocationHandler
} from './lspExtension';
import { lspClient, pathToUri, areUrisOrPathsMatching } from '../services/lsp/lspClient';

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
  private onNavigateToLocation?: NavigateToLocationHandler;
  
  // Compartments for dynamic reconfiguration
  private lineNumbersCompartment = new Compartment();
  private languageCompartment = new Compartment();
  private themeCompartment = new Compartment();
  private vimCompartment = new Compartment();
  private tabSizeCompartment = new Compartment();
  private wordWrapCompartment = new Compartment();

  private onCursorChange?: (pos: CursorPosition) => void;
  private onContentChange?: (content: string) => void;

  private createExtensions(langExtension: any) {
    const tabSize = preferencesService.get('editor.tabSize') || 2;
    const wordWrap = preferencesService.get('editor.wordWrap');
    const showLineNumbers = preferencesService.get('editor.lineNumbers');

    return [
      this.lineNumbersCompartment.of(showLineNumbers ? lineNumbers() : []),
      highlightActiveLineGutter(),
      highlightSpecialChars(),
      history(),
      foldGutter(),
      drawSelection(),
      dropCursor(),
      EditorState.allowMultipleSelections.of(true),
      indentOnInput(),
      bracketMatching(),
      closeBrackets(),
      lintGutter(),
      autocompletion({
        override: [
          createCompositeCompletionSource(
            () => this.currentFilePath,
            () => this.currentLanguageId
          )
        ],
        activateOnTyping: true,
        icons: true
      }),
      createLspHoverExtension(
        () => this.currentFilePath,
        () => this.currentLanguageId
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
        }
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

          // Debounced LSP document change notification
          clearTimeout(this.lspChangeDebounceTimer);
          this.lspChangeDebounceTimer = setTimeout(() => {
            if (this.currentFilePath) {
              lspClient.notifyDidChange(
                this.currentFilePath,
                this.currentLanguageId,
                this.documentVersion,
                update.state.doc.toString()
              );
            }
          }, 150);
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

    // Subscribe to LSP diagnostics
    lspClient.onDiagnostics((params) => {
      if (this.view && this.currentFilePath && areUrisOrPathsMatching(params.uri, this.currentFilePath)) {
        updateViewDiagnostics(this.view, this.currentFilePath, params.diagnostics);
      }
    });
  }

  loadDocument(content: string, filePath: string) {
    if (!this.view) return;

    this.currentFilePath = filePath;
    const langInfo = detectLanguage(filePath);
    this.currentLanguageId = langInfo.languageId || 'plaintext';
    this.documentVersion = 1;

    this.view.setState(
      EditorState.create({
        doc: content,
        extensions: this.createExtensions(langInfo.extension())
      })
    );

    this.applyCursorPreferences();
    vimIntegration.attachView(this.view);
    this.view.focus();

    // Immediately restore cached LSP diagnostics so squiggles persist with zero lag across file switches
    const cachedDiags = lspClient.getDiagnostics(filePath);
    if (cachedDiags && cachedDiags.length > 0) {
      updateViewDiagnostics(this.view, filePath, cachedDiags);
    }

    lspClient.notifyDidOpen(filePath, this.currentLanguageId, this.documentVersion, content);
  }

  notifyDidSave() {
    if (this.currentFilePath) {
      lspClient.notifyDidSave(this.currentFilePath, this.currentLanguageId, this.getContent());
    }
  }

  notifyDidClose(filePath: string, languageId?: string) {
    const lang = languageId || (this.currentFilePath === filePath ? this.currentLanguageId : detectLanguage(filePath).languageId) || 'plaintext';
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
