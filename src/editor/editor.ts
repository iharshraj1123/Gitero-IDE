import { EditorView, lineNumbers, highlightActiveLineGutter, highlightSpecialChars, drawSelection, dropCursor, highlightActiveLine, keymap } from '@codemirror/view';
import { EditorState, Compartment } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap, indentWithTab, undo, redo, selectAll } from '@codemirror/commands';
import { foldGutter, foldKeymap, indentOnInput, bracketMatching } from '@codemirror/language';
import { closeBrackets, closeBracketsKeymap, autocompletion, completionKeymap } from '@codemirror/autocomplete';
import { searchKeymap, highlightSelectionMatches, openSearchPanel } from '@codemirror/search';

import { themeManager } from '../themes/themeManager';
import { vimIntegration } from './vim';
import { detectLanguage, getLanguageByName } from './languages';
import { preferencesService, CursorStyle } from '../services/preferences';

export interface CursorPosition {
  line: number;
  col: number;
}

export class EditorManager {
  private view: EditorView | null = null;
  private container: HTMLElement | null = null;
  
  // Compartments for dynamic reconfiguration
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

    return [
      lineNumbers(),
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
      autocompletion(),
      highlightActiveLine(),
      highlightSelectionMatches(),
      this.tabSizeCompartment.of(EditorState.tabSize.of(tabSize)),
      this.wordWrapCompartment.of(wordWrap ? EditorView.lineWrapping : []),
      this.languageCompartment.of(langExtension),
      this.themeCompartment.of(themeManager.createCodeMirrorTheme()),
      this.vimCompartment.of(vimIntegration.getExtension()),
      keymap.of([
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...searchKeymap,
        ...historyKeymap,
        ...foldKeymap,
        ...completionKeymap,
        indentWithTab
      ]),
      EditorView.updateListener.of((update) => {
        if (update.docChanged && this.onContentChange) {
          this.onContentChange(update.state.doc.toString());
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
  }) {
    this.container = container;
    this.onCursorChange = options.onCursorChange;
    this.onContentChange = options.onContentChange;

    const initialContent = options.initialContent || '';
    const filePath = options.filePath || 'untitled.txt';
    const langInfo = detectLanguage(filePath);

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
        if (vimIntegration.isEnabled()) {
          vimIntegration.applyCursorStyle(this.view, style);
        }
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
  }

  loadDocument(content: string, filePath: string) {
    if (!this.view) return;

    const langInfo = detectLanguage(filePath);

    this.view.setState(
      EditorState.create({
        doc: content,
        extensions: this.createExtensions(langInfo.extension())
      })
    );

    this.applyCursorPreferences();
    vimIntegration.attachView(this.view);
    this.view.focus();
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
    this.view.dispatch({
      effects: this.languageCompartment.reconfigure(langInfo.extension())
    });
  }

  setLanguageByName(langName: string) {
    if (!this.view) return;
    const langInfo = getLanguageByName(langName);
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
      if (vimIntegration.isEnabled()) {
        vimIntegration.applyCursorStyle(this.view, style);
      }
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

  destroy() {
    this.view?.destroy();
    this.view = null;
  }
}

export const editorManager = new EditorManager();
