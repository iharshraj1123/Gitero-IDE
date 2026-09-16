import { EditorView, lineNumbers, highlightActiveLineGutter, highlightSpecialChars, drawSelection, dropCursor, highlightActiveLine, keymap } from '@codemirror/view';
import { EditorState, Compartment, Extension } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { foldGutter, foldKeymap, indentOnInput, bracketMatching } from '@codemirror/language';
import { closeBrackets, closeBracketsKeymap, autocompletion, completionKeymap } from '@codemirror/autocomplete';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';

import { themeManager } from '../themes/themeManager';
import { vimIntegration } from './vim';
import { detectLanguage } from './languages';

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

  private onCursorChange?: (pos: CursorPosition) => void;
  private onContentChange?: (content: string) => void;

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

    const updateListener = EditorView.updateListener.of((update) => {
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
    });

    const state = EditorState.create({
      doc: initialContent,
      extensions: [
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
        this.languageCompartment.of(langInfo.extension()),
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
        updateListener
      ]
    });

    this.view = new EditorView({
      state,
      parent: container
    });

    vimIntegration.attachView(this.view);

    // React to theme changes
    themeManager.onThemeChange(() => {
      if (this.view) {
        this.view.dispatch({
          effects: this.themeCompartment.reconfigure(themeManager.createCodeMirrorTheme())
        });
      }
    });
  }

  loadDocument(content: string, filePath: string) {
    if (!this.view) return;

    const langInfo = detectLanguage(filePath);

    this.view.setState(
      EditorState.create({
        doc: content,
        extensions: [
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
          this.languageCompartment.of(langInfo.extension()),
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
        ]
      })
    );

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

  destroy() {
    this.view?.destroy();
    this.view = null;
  }
}

export const editorManager = new EditorManager();
