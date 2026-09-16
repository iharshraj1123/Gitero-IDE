import { EditorView } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import { Extension } from '@codemirror/state';
import { THEMES, ThemeDefinition } from './themes';

import { preferencesService } from '../services/preferences';

export class ThemeManager {
  private currentThemeId: string;
  private customCss: string = '';
  private listeners: ((theme: ThemeDefinition) => void)[] = [];

  constructor() {
    this.currentThemeId = preferencesService.get('editor.theme');
    this.customCss = preferencesService.get('editor.customCss');

    preferencesService.subscribe('editor.theme', (themeId) => {
      if (this.currentThemeId !== themeId) {
        this.applyTheme(themeId, false);
      }
    });

    preferencesService.subscribe('editor.customCss', (css) => {
      if (this.customCss !== css) {
        this.applyCustomCss(css, false);
      }
    });
  }

  init() {
    this.applyTheme(this.currentThemeId, false);
    this.applyCustomCss(this.customCss, false);
  }

  getCurrentTheme(): ThemeDefinition {
    return THEMES[this.currentThemeId] || THEMES['tokyo-night'];
  }

  getAllThemes(): ThemeDefinition[] {
    return Object.values(THEMES);
  }

  applyTheme(themeId: string, persist = true) {
    const theme = THEMES[themeId] || THEMES['tokyo-night'];
    this.currentThemeId = theme.id;
    if (persist) {
      preferencesService.set('editor.theme', theme.id);
    }

    // Apply CSS variables to root
    const root = document.documentElement;
    const c = theme.colors;

    root.style.setProperty('--bg-primary', c.bgPrimary);
    root.style.setProperty('--bg-secondary', c.bgSecondary);
    root.style.setProperty('--bg-sidebar', c.bgSidebar);
    root.style.setProperty('--bg-activity', c.bgActivity);
    root.style.setProperty('--bg-hover', c.bgHover);
    root.style.setProperty('--bg-active', c.bgActive);
    root.style.setProperty('--fg-primary', c.fgPrimary);
    root.style.setProperty('--fg-muted', c.fgMuted);
    root.style.setProperty('--border-color', c.borderColor);
    root.style.setProperty('--accent-color', c.accent);
    root.style.setProperty('--status-bg', c.statusBarBg);
    root.style.setProperty('--status-fg', c.statusBarFg);
    root.style.setProperty('--tab-active-bg', c.tabActiveBg);
    root.style.setProperty('--tab-inactive-bg', c.tabInactiveBg);
    root.style.setProperty('--tab-border', c.tabBorder);
    root.style.setProperty('--editor-bg', c.editorBg);
    root.style.setProperty('--editor-fg', c.editorFg);
    root.style.setProperty('--editor-line-number', c.editorLineNumber);
    root.style.setProperty('--editor-cursor', c.editorCursor);
    root.style.setProperty('--editor-selection', c.editorSelection);
    root.style.setProperty('--editor-active-line', c.editorActiveLine);

    this.listeners.forEach(fn => fn(theme));
  }

  onThemeChange(fn: (theme: ThemeDefinition) => void) {
    this.listeners.push(fn);
  }

  getCustomCss(): string {
    return this.customCss;
  }

  applyCustomCss(css: string, persist = true) {
    this.customCss = css;
    if (persist) {
      preferencesService.set('editor.customCss', css);
    }

    let styleEl = document.getElementById('gitero-custom-css') as HTMLStyleElement;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'gitero-custom-css';
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = css;
  }

  createCodeMirrorTheme(): Extension {
    const theme = this.getCurrentTheme();
    const c = theme.colors;

    const editorTheme = EditorView.theme({
      '&': {
        color: c.editorFg,
        backgroundColor: c.editorBg,
        height: '100%',
        fontSize: 'var(--editor-font-size, 14px)',
        fontFamily: 'var(--editor-font-family, "Cascadia Code", "Fira Code", "JetBrains Mono", Consolas, monospace)'
      },
      '.cm-content': {
        caretColor: c.editorCursor,
        padding: '8px 0'
      },
      '.cm-cursor, .cm-dropCursor': {
        borderLeftColor: c.editorCursor,
        borderLeftWidth: '2px'
      },
      '&.cm-focused .cm-cursor': {
        borderLeftColor: c.editorCursor
      },
      '.cm-selectionBackground, ::selection': {
        backgroundColor: `${c.editorSelection} !important`
      },
      '.cm-activeLine': {
        backgroundColor: c.editorActiveLine
      },
      '.cm-gutters': {
        backgroundColor: c.editorBg,
        color: c.editorLineNumber,
        border: 'none',
        borderRight: `1px solid ${c.borderColor}`
      },
      '.cm-activeLineGutter': {
        backgroundColor: c.editorActiveLine,
        color: c.fgPrimary
      },
      '.cm-lineNumbers .cm-gutterElement': {
        padding: '0 12px 0 16px',
        minWidth: '40px',
        textAlign: 'right'
      },
      '.cm-foldPlaceholder': {
        backgroundColor: c.bgHover,
        border: `1px solid ${c.borderColor}`,
        color: c.fgMuted
      },
      '.cm-tooltip': {
        backgroundColor: c.bgSidebar,
        border: `1px solid ${c.borderColor}`,
        color: c.fgPrimary
      }
    }, { dark: theme.isDark });

    const highlightStyle = HighlightStyle.define([
      { tag: t.keyword, color: c.synKeyword },
      { tag: [t.name, t.deleted, t.character, t.macroName], color: c.synVariable },
      { tag: [t.function(t.variableName), t.labelName], color: c.synFunction },
      { tag: [t.color, t.constant(t.name), t.standard(t.name)], color: c.synNumber },
      { tag: [t.definition(t.name), t.separator], color: c.fgPrimary },
      { tag: [t.typeName, t.className, t.number, t.changed, t.annotation, t.modifier, t.self, t.namespace], color: c.synType },
      { tag: [t.operator, t.operatorKeyword, t.url, t.escape, t.regexp, t.link, t.special(t.string)], color: c.synOperator },
      { tag: [t.meta, t.comment], color: c.synComment, fontStyle: 'italic' },
      { tag: t.strong, fontWeight: 'bold' },
      { tag: t.emphasis, fontStyle: 'italic' },
      { tag: t.strikethrough, textDecoration: 'line-through' },
      { tag: t.link, color: c.accent, textDecoration: 'underline' },
      { tag: t.heading, fontWeight: 'bold', color: c.synKeyword },
      { tag: [t.atom, t.bool, t.special(t.variableName)], color: c.synNumber },
      { tag: [t.processingInstruction, t.string, t.inserted], color: c.synString },
      { tag: t.invalid, color: '#ff5370' }
    ]);

    return [editorTheme, syntaxHighlighting(highlightStyle)];
  }
}

export const themeManager = new ThemeManager();
