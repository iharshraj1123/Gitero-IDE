import { themeManager } from '../themes/themeManager';
import { ThemeDefinition } from '../themes/themes';
import { vimIntegration } from '../editor/vim';
import { updaterService } from '../services/updater';
import { preferencesService, CursorStyle, IconTheme } from '../services/preferences';
import { renderIconPreview } from './icons';
import { fileAssociationService } from '../services/fileAssociation';
import { transparencyService, TRANSPARENCY_SECTIONS, TRANSPARENCY_PRESETS, TransparencyCategory } from '../services/transparencyService';
import { DEFAULT_SERVERS, lspServerRegistry } from '../services/lsp/lspServerRegistry';
import type { ServerConfig } from '../services/lsp/lspTypes';
import { unmuteLanguagePrompt } from '../services/lsp/lspDetector';
import { lspClient } from '../services/lsp/lspClient';
import { lspInstaller } from '../services/lsp/lspInstaller';

export interface KeybindingDefinition {
  id: string;
  name: string;
  category: string;
}

export const KEYBINDING_DEFINITIONS: KeybindingDefinition[] = [
  { id: 'editor.action.goToDefinition', name: 'Go to Definition (F12 / Ctrl+Click)', category: 'Editor' },
  { id: 'editor.action.formatDocument', name: 'Format Document (Shift+Alt+F)', category: 'Editor' },
  { id: 'editor.action.rename', name: 'Rename Symbol across Files (F2)', category: 'Editor' },
  { id: 'editor.action.findReferences', name: 'Find All References (Shift+F12)', category: 'Editor' },
  { id: 'editor.action.quickFix', name: 'Quick Fix & Code Actions (Alt+Enter)', category: 'Editor' },
  { id: 'editor.action.triggerParameterHints', name: 'Trigger Parameter Hints / Signature Help (Ctrl+Shift+Space)', category: 'Editor' },
  { id: 'workbench.action.quickOpen', name: 'Quick Open File', category: 'File' },
  { id: 'workbench.action.showCommands', name: 'Command Palette', category: 'View' },
  { id: 'workbench.action.files.save', name: 'Save File', category: 'File' },
  { id: 'workbench.action.files.saveAs', name: 'Save File As...', category: 'File' },
  { id: 'workbench.action.files.newUntitledFile', name: 'New Untitled File', category: 'File' },
  { id: 'workbench.action.files.openFile', name: 'Open File...', category: 'File' },
  { id: 'workbench.action.closeActiveEditor', name: 'Close Active Editor', category: 'View' },
  { id: 'workbench.action.closeAllEditors', name: 'Close All Editors / Tabs', category: 'View' },
  { id: 'workbench.action.reopenClosedEditor', name: 'Reopen Closed Editor', category: 'File' },
  { id: 'workbench.action.toggleSidebarVisibility', name: 'Toggle Sidebar Visibility', category: 'View' },
  { id: 'workbench.action.terminal.toggleTerminal', name: 'Toggle Integrated Terminal', category: 'Terminal' },
  { id: 'workbench.action.findInFiles', name: 'Find in Files (Global Search)', category: 'Search' },
  { id: 'workbench.view.scm', name: 'Source Control (Git)', category: 'Git' },
  { id: 'git.sync', name: 'Git: Sync / Push Remote Changes', category: 'Git' },
  { id: 'git.switchBranch', name: 'Git: Switch Branch...', category: 'Git' },
  { id: 'editor.action.toggleWordWrap', name: 'Toggle Word Wrap', category: 'Editor' },
  { id: 'view.toggleIndentGuides', name: 'Toggle Indentation Guides', category: 'View' },
  { id: 'view.toggleMinimap', name: 'Toggle Minimap (Code Preview)', category: 'View' },
  { id: 'view.toggleOverviewRuler', name: 'Toggle Scrollbar Overview Ruler', category: 'View' },
  { id: 'editor.action.commentLine', name: 'Toggle Line Comment', category: 'Editor' },
  { id: 'editor.action.blockComment', name: 'Toggle Block Comment', category: 'Editor' },
  { id: 'editor.action.copyLinesDownAction', name: 'Copy Line Down (Duplicate)', category: 'Editor' },
  { id: 'editor.action.copyLinesUpAction', name: 'Copy Line Up', category: 'Editor' },
  { id: 'editor.action.moveLinesDownAction', name: 'Move Line Down', category: 'Editor' },
  { id: 'editor.action.moveLinesUpAction', name: 'Move Line Up', category: 'Editor' },
  { id: 'editor.action.deleteLines', name: 'Delete Line', category: 'Editor' },
  { id: 'editor.action.indentLines', name: 'Indent Line', category: 'Editor' },
  { id: 'editor.action.outdentLines', name: 'Outdent Line', category: 'Editor' },
  { id: 'editor.action.selectLine', name: 'Select Current Line', category: 'Editor' },
  { id: 'editor.action.cycleCursorStyle', name: 'Cycle Cursor Style (Line, Block, Underline)', category: 'Editor' },
  { id: 'markdown.showPreview', name: 'Toggle Markdown Preview / Raw Editor', category: 'Markdown' },
  { id: 'workbench.action.openSettings', name: 'Open Settings & Custom CSS', category: 'Preferences' },
  { id: 'workbench.action.openShortcuts', name: 'Keyboard Shortcuts Reference', category: 'Help' },
  { id: 'workbench.action.toggleFullScreen', name: 'Toggle Full Screen', category: 'View' },
  { id: 'workbench.action.toggleDevTools', name: 'Toggle Developer Tools', category: 'Developer' },
  { id: 'workbench.action.explorerHotkey', name: 'Open Active Folder in Gitero (Windows Explorer / Desktop)', category: 'System' }
];

export class SettingsModalComponent {
  private overlay!: HTMLElement;
  private isOpen: boolean = false;
  private onVimToggled?: (enabled: boolean) => void;

  constructor(options?: { onVimToggled?: (enabled: boolean) => void }) {
    this.onVimToggled = options?.onVimToggled;
    this.createDom();
  }

  private createDom() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'settings-modal-overlay';
    this.overlay.style.display = 'none';

    this.overlay.innerHTML = `
      <div class="settings-modal">
        <div class="settings-header">
          <div class="settings-header-title-group">
            <h2>Gitero Settings & Preferences</h2>
            <span class="settings-header-badge">Preferences</span>
          </div>
          <button class="settings-close-btn" aria-label="Close">×</button>
        </div>

        <div class="settings-body-wrapper">
          <!-- Left: Stacked Tabs Sidebar Navigation -->
          <nav class="settings-tabs-sidebar" aria-label="Settings Categories">
            <button class="settings-tab-btn active" data-target="editor">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
              <span>Editor</span>
            </button>
            <button class="settings-tab-btn" data-target="files">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
              <span>Files</span>
            </button>
            <button class="settings-tab-btn" data-target="appearance">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
              <span>Appearance</span>
            </button>
            <button class="settings-tab-btn" data-target="terminal">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"/><line x1="12" x2="20" y1="19" y2="19"/></svg>
              <span>Terminal</span>
            </button>
            <button class="settings-tab-btn" data-target="shortcuts">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="M6 8h.001"/><path d="M10 8h.001"/><path d="M14 8h.001"/><path d="M18 8h.001"/><path d="M8 12h.001"/><path d="M12 12h.001"/><path d="M16 12h.001"/><path d="M7 16h10"/></svg>
              <span>Shortcuts</span>
            </button>
            <button class="settings-tab-btn" data-target="lsp">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/><circle cx="12" cy="12" r="2"/></svg>
              <span>Languages & LSP</span>
            </button>
            <button class="settings-tab-btn" data-target="updates">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
              <span>Updates</span>
            </button>
            <button class="settings-tab-btn" data-target="css">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" x2="15" y1="20" y2="20"/><line x1="12" x2="12" y1="4" y2="20"/></svg>
              <span>Custom CSS</span>
            </button>
          </nav>

          <!-- Right: Scrollable Tab Content Area -->
          <div class="settings-tab-content">
            <!-- 1. Editor Tab Pane -->
            <div class="settings-tab-pane active" id="tab-pane-editor" data-tab="editor">
              <div class="settings-section-header">
                <div class="settings-section-title">Editor Configuration</div>
                <div class="settings-section-subtitle">Customize typography, cursor styling, tab spacing, line wrapping, and editing modes.</div>
              </div>

              <div class="setting-card">
                <div class="setting-card-title">Typography</div>
                <div class="setting-row">
                  <div class="setting-label">
                    <span class="setting-title">Font Family</span>
                    <span class="setting-desc">Monospace font stack with coding ligature support</span>
                  </div>
                  <input type="text" id="setting-font-family" class="setting-input" style="width: 250px;" value="Cascadia Code, Fira Code, JetBrains Mono, Consolas, monospace" />
                </div>
                <div class="setting-row">
                  <div class="setting-label">
                    <span class="setting-title">Font Size (px)</span>
                    <span class="setting-desc">Text size in the code editor viewport</span>
                  </div>
                  <input type="number" id="setting-font-size" class="setting-input-small" min="10" max="32" value="14" />
                </div>
              </div>

              <div class="setting-card">
                <div class="setting-card-title">Cursor & Display</div>
                <div class="setting-row">
                  <div class="setting-label">
                    <span class="setting-title">Cursor Style</span>
                    <span class="setting-desc">Caret presentation style in editor</span>
                  </div>
                  <select id="setting-cursor-style" class="setting-select">
                    <option value="line">Line (Bar) [Default]</option>
                    <option value="block">Block</option>
                    <option value="underline">Underline</option>
                  </select>
                </div>
                <div class="setting-row">
                  <div class="setting-label">
                    <span class="setting-title">Cursor Blinking</span>
                    <span class="setting-desc">Animation curve for cursor blink</span>
                  </div>
                  <select id="setting-cursor-blinking" class="setting-select">
                    <option value="blink">Blink [Default]</option>
                    <option value="smooth">Smooth Fade</option>
                    <option value="solid">Solid (No Blink)</option>
                  </select>
                </div>
                <div class="setting-row">
                  <div class="setting-label">
                    <span class="setting-title">Line Height</span>
                    <span class="setting-desc">Line spacing multiplier in the editor (e.g. 1.5)</span>
                  </div>
                  <input type="number" id="setting-line-height" class="setting-input-small" min="1.1" max="2.6" step="0.1" value="1.5" />
                </div>
                <div class="setting-row">
                  <div class="setting-label">
                    <span class="setting-title">Line Numbers</span>
                    <span class="setting-desc">Render line numbers in the gutter margin</span>
                  </div>
                  <input type="checkbox" id="setting-line-numbers" class="setting-checkbox" checked />
                </div>
                <div class="setting-row">
                  <div class="setting-label">
                    <span class="setting-title">Indentation Characters</span>
                    <span class="setting-desc">Insert spaces (soft tabs) or hard tab characters when pressing Tab</span>
                  </div>
                  <select id="setting-insert-spaces" class="setting-select">
                    <option value="true">Insert Spaces (Soft Tabs) [Default]</option>
                    <option value="false">Tab Characters (\t)</option>
                  </select>
                </div>
                <div class="setting-row">
                  <div class="setting-label">
                    <span class="setting-title">Tab Size (Spaces)</span>
                    <span class="setting-desc">Number of spaces rendered per indentation level</span>
                  </div>
                  <input type="number" id="setting-tab-size" class="setting-input-small" min="1" max="8" value="2" />
                </div>
                <div class="setting-row">
                  <div class="setting-label">
                    <span class="setting-title">Word Wrap</span>
                    <span class="setting-desc">Wrap long lines to fit viewport width</span>
                  </div>
                  <input type="checkbox" id="setting-word-wrap" class="setting-checkbox" />
                </div>
                <div class="setting-row">
                  <div class="setting-label">
                    <span class="setting-title">Indentation Guides</span>
                    <span class="setting-desc">Render vertical guidelines showing indentation depth and active block nesting</span>
                  </div>
                  <input type="checkbox" id="setting-indent-guides" class="setting-checkbox" checked />
                </div>
                <div class="setting-row">
                  <div class="setting-label">
                    <span class="setting-title">Minimap (Code Preview)</span>
                    <span class="setting-desc">Display a miniature code preview with search and diagnostic highlights on the right side</span>
                  </div>
                  <input type="checkbox" id="setting-minimap" class="setting-checkbox" checked />
                </div>
                <div class="setting-row">
                  <div class="setting-label">
                    <span class="setting-title">Scrollbar Overview Ruler</span>
                    <span class="setting-desc">Show interactive error, warning, and search match dots along the scrollbar</span>
                  </div>
                  <input type="checkbox" id="setting-overview-ruler" class="setting-checkbox" checked />
                </div>
                <div class="setting-row">
                  <div class="setting-label">
                    <span class="setting-title">Complete Function & Method Calls</span>
                    <span class="setting-desc">Automatically insert parentheses and parameter arguments when accepting function/method autocomplete suggestions</span>
                  </div>
                  <input type="checkbox" id="setting-complete-function-calls" class="setting-checkbox" checked />
                </div>
                <div class="setting-row">
                  <div class="setting-label">
                    <span class="setting-title">Format on Save</span>
                    <span class="setting-desc">Automatically format the file using the active language server when saving</span>
                  </div>
                  <input type="checkbox" id="setting-format-on-save" class="setting-checkbox" />
                </div>
              </div>

              <div class="setting-card">
                <div class="setting-card-title">Git Intelligence</div>
                <div class="setting-row">
                  <div class="setting-label">
                    <span class="setting-title">Git Gutter Diff Indicators</span>
                    <span class="setting-desc">Show colored bars beside added, modified, and deleted lines in the editor gutter</span>
                  </div>
                  <input type="checkbox" id="setting-git-gutter" class="setting-checkbox" checked />
                </div>
                <div class="setting-row">
                  <div class="setting-label">
                    <span class="setting-title">Git Blame Annotation</span>
                    <span class="setting-desc">Show author, date, and commit message as a ghost annotation on the active line after a brief idle</span>
                  </div>
                  <input type="checkbox" id="setting-git-blame" class="setting-checkbox" checked />
                </div>
              </div>

              <div class="setting-card">
                <div class="setting-card-title">Save Actions &amp; Cleanups</div>
                <div class="setting-row">
                  <div class="setting-label">
                    <span class="setting-title">Trim Trailing Whitespace</span>
                    <span class="setting-desc">Automatically strip unnecessary spaces and tabs at the ends of lines when saving</span>
                  </div>
                  <input type="checkbox" id="setting-trim-whitespace" class="setting-checkbox" />
                </div>
                <div class="setting-row">
                  <div class="setting-label">
                    <span class="setting-title">Insert Final Newline</span>
                    <span class="setting-desc">Ensure saved documents terminate with a POSIX standard newline character</span>
                  </div>
                  <input type="checkbox" id="setting-final-newline" class="setting-checkbox" />
                </div>
              </div>

              <div class="setting-card">
                <div class="setting-card-title">Modal Editing</div>
                <div class="setting-row">
                  <div class="setting-label">
                    <span class="setting-title">Vim Keybindings</span>
                    <span class="setting-desc">Standard vi/vim modal editing commands (:w, :q, hjkl, etc.)</span>
                  </div>
                  <input type="checkbox" id="setting-vim-toggle" class="setting-checkbox" />
                </div>
              </div>
            </div>

            <!-- 2. Files & Auto-Save Tab Pane -->
            <div class="settings-tab-pane" id="tab-pane-files" data-tab="files">
              <div class="settings-section-header">
                <div class="settings-section-title">Files & Auto-Save</div>
                <div class="settings-section-subtitle">Manage automated file saving and workspace file behaviors.</div>
              </div>

              <div class="setting-card">
                <div class="setting-card-title">Auto-Save Behavior</div>
                <div class="setting-row">
                  <div class="setting-label">
                    <span class="setting-title">Enable Auto Save</span>
                    <span class="setting-desc">Automatically persist modified files after a brief pause</span>
                  </div>
                  <input type="checkbox" id="setting-auto-save-toggle" class="setting-checkbox" />
                </div>
                <div class="setting-row">
                  <div class="setting-label">
                    <span class="setting-title">Auto Save Delay (ms)</span>
                    <span class="setting-desc">Idle delay in milliseconds before automatically saving (e.g. 1000)</span>
                  </div>
                  <input type="number" id="setting-auto-save-delay" class="setting-input-small" min="100" max="10000" step="100" value="1000" />
                </div>
              </div>

              <!-- Windows File Associations & Document Icons -->
              <div class="setting-card">
                <div class="setting-card-title">Windows File Associations & Document Icons</div>
                <div style="font-size: 12px; color: var(--fg-muted, #8b949e); margin-bottom: 12px; line-height: 1.5;">
                  Configure Windows file associations so that files opened by Gitero display dedicated document icons in Windows Explorer representing what each file actually is, rather than the Gitero application executable logo.
                </div>

                <div class="setting-row" style="align-items: flex-start; padding-bottom: 12px; border-bottom: 1px solid var(--border-color, #30363d);">
                  <div class="setting-label">
                    <span class="setting-title">Markdown Documents (.md, .markdown)</span>
                    <span class="setting-desc">Registers Gitero as the default Markdown reader with the official M&darr; document icon.</span>
                  </div>
                  <button type="button" class="btn btn-secondary btn-sm" id="btn-assoc-register-md">Register Markdown (.md)</button>
                </div>

                <div class="setting-row" style="align-items: flex-start; padding-bottom: 12px; border-bottom: 1px solid var(--border-color, #30363d); margin-top: 10px;">
                  <div class="setting-label">
                    <span class="setting-title">All Supported Types (Code, Web, Data, Text)</span>
                    <span class="setting-desc">Registers ProgIDs and document icons for TS, JS, Python, HTML, CSS, JSON, YAML, Shell, and Plain Text.</span>
                  </div>
                  <button type="button" class="btn btn-primary btn-sm" id="btn-assoc-register-all">Register All Supported Types</button>
                </div>

                <div class="setting-row" style="align-items: flex-start; margin-top: 10px;">
                  <div class="setting-label">
                    <span class="setting-title">Windows Explorer Icon Cache</span>
                    <span class="setting-desc">Forces Windows Explorer to flush its shell icon cache so file icons update immediately.</span>
                  </div>
                  <button type="button" class="btn btn-secondary btn-sm" id="btn-assoc-refresh-cache">Refresh Icon Cache</button>
                </div>

                <div id="assoc-status-message" style="margin-top: 12px; font-size: 12px; display: none; padding: 8px 12px; border-radius: 4px;"></div>
              </div>
            </div>

            <!-- 3. Appearance Tab Pane -->
            <div class="settings-tab-pane" id="tab-pane-appearance" data-tab="appearance">
              <div class="settings-section-header">
                <div class="settings-section-title">Appearance & Theme Studio</div>
                <div class="settings-section-subtitle">Customize workspace chrome, editor surfaces, and syntax highlighting tokens, or create and export your own custom themes.</div>
              </div>

              <!-- Appearance Inner Sub-Tabs Navigation -->
              <div class="appearance-subtabs-nav" id="appearance-subtabs-nav">
                <button type="button" class="appearance-subtab-btn active" data-subtab="glass">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                  <span>Glass & Transparency</span>
                </button>
                <button type="button" class="appearance-subtab-btn" data-subtab="theme">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m4.93 4.93 4.24 4.24"/><path d="m14.83 9.17 4.24-4.24"/><path d="m14.83 14.83 4.24 4.24"/><path d="m9.17 14.83-4.24 4.24"/></svg>
                  <span>Theme Studio & Colors</span>
                </button>
                <button type="button" class="appearance-subtab-btn" data-subtab="window-icons">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
                  <span>Window & Icons</span>
                </button>
              </div>

              <!-- Sub-Pane 1: Glass & Transparency -->
              <div class="appearance-subtab-pane active" data-subpane="glass">
                <!-- Workspace Transparency & Glassmorphism Studio -->
                <div class="setting-card transparency-studio-card">
                  <div class="transparency-master-header">
                    <div>
                      <div class="setting-card-title" style="margin-bottom: 4px;">Workspace Transparency & Glassmorphism</div>
                      <div class="setting-desc">Control surface background opacity, independent text legibility, and frosted acrylic blur across IDE sections.</div>
                    </div>
                    <label class="transparency-switch-label">
                      <span style="font-size: 12px; font-weight: 600; color: var(--fg-primary);">Enable Glass</span>
                      <input type="checkbox" id="setting-transparency-enable-toggle" class="setting-checkbox" />
                    </label>
                  </div>

                  <!-- One-Click Presets -->
                  <div style="display: flex; flex-direction: column; gap: 8px;">
                    <div class="setting-label">
                      <span class="setting-title">Quick Glassmorphism Presets</span>
                    </div>
                    <div class="transparency-presets-row" id="transparency-presets-container">
                      <button type="button" class="preset-chip-btn" data-preset="solid">Solid (Default)</button>
                      <button type="button" class="preset-chip-btn" data-preset="subtle-glass">Subtle Glass</button>
                      <button type="button" class="preset-chip-btn" data-preset="frosted-acrylic">Frosted Acrylic</button>
                      <button type="button" class="preset-chip-btn" data-preset="dark-glass">Dark Glass</button>
                      <button type="button" class="preset-chip-btn" data-preset="code-focus">Code Focus</button>
                    </div>
                  </div>

                  <!-- Refractive Atmosphere Mood Engine -->
                  <div class="setting-item-stack" style="margin-top: 14px; margin-bottom: 14px;">
                    <div class="setting-label" style="margin-bottom: 6px;">
                      <span class="setting-title">Refractive Atmosphere Mood</span>
                      <span class="setting-description">Luminous ambient underglow diffused through frosted acrylic surfaces</span>
                    </div>
                    <div class="transparency-presets-row" id="transparency-mood-container">
                      <button type="button" class="preset-chip-btn" data-mood="deep-space">Deep Space</button>
                      <button type="button" class="preset-chip-btn" data-mood="aurora">Aurora</button>
                      <button type="button" class="preset-chip-btn" data-mood="monochrome">Monochrome</button>
                      <button type="button" class="preset-chip-btn" data-mood="accent">Theme Accent</button>
                      <button type="button" class="preset-chip-btn" data-mood="none">Off</button>
                    </div>
                  </div>

                  <!-- Master Global Controls -->
                  <div class="transparency-master-sliders" id="transparency-master-sliders-box">
                    <div class="transparency-slider-group">
                      <div class="transparency-slider-header">
                        <span>Master Surface Opacity</span>
                        <span class="transparency-slider-val" id="val-master-bg">100%</span>
                      </div>
                      <input type="range" id="setting-master-bg-opacity" class="transparency-range-input" min="10" max="100" step="1" value="100" />
                    </div>

                    <div class="transparency-slider-group" title="Radiance and underglow intensity diffused across frosted surfaces">
                      <div class="transparency-slider-header">
                        <span>Atmosphere Luminance</span>
                        <span class="transparency-slider-val" id="val-master-atmosphere">65%</span>
                      </div>
                      <input type="range" id="setting-master-atmosphere" class="transparency-range-input" min="0" max="100" step="1" value="65" />
                    </div>

                    <div class="transparency-slider-group">
                      <div class="transparency-slider-header">
                        <span>Master Text Contrast</span>
                        <span class="transparency-slider-val" id="val-master-text">100%</span>
                      </div>
                      <input type="range" id="setting-master-text-opacity" class="transparency-range-input" min="30" max="100" step="1" value="100" />
                    </div>

                    <div class="transparency-slider-group" title="Diffusion blur for ambient underglow and overlay modals (desktop blur is native Windows DWM Acrylic)">
                      <div class="transparency-slider-header">
                        <span>Backdrop Blur & Diffusion</span>
                        <span class="transparency-slider-val" id="val-master-blur">14px</span>
                      </div>
                      <input type="range" id="setting-master-blur" class="transparency-range-input" min="0" max="32" step="1" value="14" />
                    </div>
                  </div>

                  <!-- Category Segmented Filters -->
                  <div class="transparency-tabs-bar" id="transparency-category-tabs">
                    <button type="button" class="transparency-tab-btn active" data-cat="all">All Sections (8)</button>
                    <button type="button" class="transparency-tab-btn" data-cat="chrome">Chrome (3)</button>
                    <button type="button" class="transparency-tab-btn" data-cat="workspace">Workspace (2)</button>
                    <button type="button" class="transparency-tab-btn" data-cat="editor">Editor & Terminal (2)</button>
                    <button type="button" class="transparency-tab-btn" data-cat="overlays">Overlays (1)</button>
                  </div>

                  <!-- Dynamic Sections Grid -->
                  <div class="transparency-sections-grid" id="transparency-sections-grid"></div>
                </div>
              </div>

              <!-- Sub-Pane 2: Theme Studio & Colors -->
              <div class="appearance-subtab-pane" data-subpane="theme">
                <!-- Theme Toolbar -->
                <div class="setting-card theme-studio-card">
                  <div class="theme-studio-header">
                    <div class="theme-select-container">
                      <label for="setting-theme-select" class="theme-field-label">Theme Preset:</label>
                      <select id="setting-theme-select" class="setting-select"></select>
                    </div>
                    <div class="theme-studio-actions">
                      <button class="btn btn-secondary btn-sm" id="btn-theme-new" title="Create new custom theme">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        <span>New Theme</span>
                      </button>
                      <button class="btn btn-primary btn-sm" id="btn-theme-save" title="Save customizations to theme">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                        <span>Save Theme</span>
                      </button>
                      <button class="btn btn-secondary btn-sm" id="btn-theme-export" title="Export current theme as JSON">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                        <span>Export JSON</span>
                      </button>
                      <button class="btn btn-secondary btn-sm" id="btn-theme-import" title="Import theme from JSON">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                        <span>Import JSON</span>
                      </button>
                      <button class="btn btn-secondary btn-sm" id="btn-theme-delete" title="Delete custom theme" style="display: none; color: #f85149;">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Live Interactive Code Preview -->
                <div class="setting-card">
                  <div class="setting-card-title">Live Code & Syntax Preview</div>
                  <div id="theme-live-preview-box" class="theme-live-preview-box"></div>
                </div>

                <!-- Workspace Colors -->
                <div class="setting-card">
                  <div class="setting-card-title">Workspace Chrome Colors</div>
                  <div class="color-picker-grid" id="theme-colors-workspace"></div>
                </div>

                <!-- Editor Surface Colors -->
                <div class="setting-card">
                  <div class="setting-card-title">Editor Surface & Cursor Colors</div>
                  <div class="color-picker-grid" id="theme-colors-editor"></div>
                </div>

                <!-- Syntax Highlighting Colors -->
                <div class="setting-card">
                  <div class="setting-card-title">Syntax Token Highlighting Colors</div>
                  <div class="color-picker-grid" id="theme-colors-syntax"></div>
                </div>
              </div>

              <!-- Sub-Pane 3: Window & Icons -->
              <div class="appearance-subtab-pane" data-subpane="window-icons">
                <!-- Window Frame & Geometry -->
                <div class="setting-card">
                  <div class="setting-card-title">Window Frame & Geometry</div>
                  <div class="setting-row">
                    <div class="setting-label">
                      <span class="setting-title">Window Corner Radius (Non-Maximized)</span>
                      <span class="setting-desc">Corner rounding applied to the Gitero window frame when not maximized (disabled automatically when maximized)</span>
                      <span id="note-window-border-radius" style="font-size: 11px; margin-top: 5px; display: block; color: var(--fg-muted);">Requires Glass Transparency to be enabled.</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 12px;">
                      <input type="range" id="setting-window-border-radius" class="transparency-range-input" min="0" max="24" step="1" value="8" style="width: 140px;" />
                      <span id="val-window-border-radius" style="font-size: 12px; font-weight: 600; color: var(--fg-primary); min-width: 36px;">8px</span>
                    </div>
                  </div>
                </div>

                <!-- File & Folder Icons Package -->
                <div class="setting-card">
                  <div class="setting-card-title">File & Folder Icons Package</div>
                  <div class="setting-row">
                    <div class="setting-label">
                      <span class="setting-title">Icon Theme Package</span>
                      <span class="setting-desc">Select from available icon packages (badges, lucide, material, or custom upload)</span>
                    </div>
                    <select id="setting-icon-theme-select" class="setting-select">
                      <option value="lucide">Lucide Icons (Pure Vector Line Outlines) [Default]</option>
                      <option value="badges">Compact Badges (Classic Badges + Vector Folders)</option>
                      <option value="material">Material Icons (Colored Glyphs)</option>
                      <option value="custom">Custom Package (JSON / Uploaded Package)</option>
                    </select>
                  </div>

                  <div class="setting-label" style="margin-top: 10px;">
                    <span class="setting-title">Package Live Preview</span>
                  </div>
                  <div id="icon-theme-preview-box"></div>

                  <!-- Custom Package Upload / Editor Section -->
                  <div id="custom-icon-section" style="display: none; margin-top: 14px;">
                    <div class="setting-row">
                      <div class="setting-label">
                        <span class="setting-title">Custom Icon JSON Package</span>
                        <span class="setting-desc">Paste JSON or upload a custom icon definition package file</span>
                      </div>
                      <div style="display: flex; gap: 8px;">
                        <button type="button" class="btn btn-secondary btn-sm" id="btn-icon-upload-json">Upload JSON</button>
                        <input type="file" id="input-icon-upload-json" accept=".json" style="display: none;" />
                        <button type="button" class="btn btn-primary btn-sm" id="btn-icon-apply-custom">Apply Package</button>
                      </div>
                    </div>
                    <textarea id="setting-custom-icon-json" class="setting-textarea" rows="6" placeholder='{\n  "extensions": {\n    "ts": { "type": "badge", "text": "TS", "bg": "#3178c6", "fg": "#fff" }\n  }\n}' style="font-family: monospace; font-size: 11px;"></textarea>
                  </div>
                </div>
              </div>
            </div>

            <!-- Integrated Terminal Tab Pane -->
            <div class="settings-tab-pane" id="tab-pane-terminal" data-tab="terminal">
              <div class="settings-section-header">
                <div class="settings-section-title">Integrated Terminal</div>
                <div class="settings-section-subtitle">Configure typography, viewport dimensions, and execution parameters for the integrated shell.</div>
              </div>

              <div class="setting-card">
                <div class="setting-card-title">Typography & Display</div>
                <div class="setting-row">
                  <div class="setting-label">
                    <span class="setting-title">Terminal Font Size (px)</span>
                    <span class="setting-desc">Font size rendered in the integrated terminal viewport</span>
                  </div>
                  <input type="number" id="setting-terminal-font-size" class="setting-input-small" min="10" max="28" value="13" />
                </div>
                <div class="setting-row">
                  <div class="setting-label">
                    <span class="setting-title">Terminal Font Family</span>
                    <span class="setting-desc">Monospace font family used for terminal output</span>
                  </div>
                  <input type="text" id="setting-terminal-font-family" class="setting-input" style="width: 250px;" value="Cascadia Code, Fira Code, JetBrains Mono, Consolas, monospace" />
                </div>
              </div>

              <div class="setting-card">
                <div class="setting-card-title">History & Buffers</div>
                <div class="setting-row">
                  <div class="setting-label">
                    <span class="setting-title">Clear Command History</span>
                    <span class="setting-desc">Remove stored shell command history recalled by arrow keys</span>
                  </div>
                  <button type="button" class="btn btn-secondary btn-sm" id="btn-clear-terminal-history">Clear History</button>
                </div>
              </div>
            </div>

            <!-- 4. Keyboard Shortcuts Tab Pane -->
            <div class="settings-tab-pane" id="tab-pane-shortcuts" data-tab="shortcuts">
              <div class="settings-section-header">
                <div class="settings-section-title">Keyboard Shortcuts</div>
                <div class="settings-section-subtitle">Customize keybindings for commands. Click "Change" or double-click to assign keys.</div>
              </div>

              <div class="setting-card keybindings-section">
                <div class="keybindings-header">
                  <div class="keybindings-search-box" style="flex: 1; margin: 0;">
                    <input type="text" id="setting-keybinding-search" class="setting-input" style="width: 100%;" placeholder="Search shortcuts (e.g. Save, Ctrl+S, Markdown)..." />
                  </div>
                  <button class="btn btn-secondary btn-sm" id="btn-reset-keybindings" title="Reset all keybindings to defaults">Reset to Defaults</button>
                </div>

                <div class="keybindings-table-wrapper">
                  <table class="keybindings-table">
                    <thead>
                      <tr>
                        <th>Command</th>
                        <th>Keybinding</th>
                        <th style="width: 110px; text-align: right;">Action</th>
                      </tr>
                    </thead>
                    <tbody id="keybindings-table-body"></tbody>
                  </table>
                </div>
              </div>
            </div>

            <!-- 5. Software Updates Tab Pane -->
            <div class="settings-tab-pane" id="tab-pane-updates" data-tab="updates">
              <div class="settings-section-header">
                <div class="settings-section-title">Software Updates</div>
                <div class="settings-section-subtitle">Switch channels and update Gitero IDE directly from any GitHub branch.</div>
              </div>

              <div class="update-box">
                <div class="update-meta-grid">
                  <div class="update-meta-card">
                    <span class="meta-label">Installed Version</span>
                    <span class="meta-val" id="update-cur-ver">0.1.2-beta</span>
                  </div>
                  <div class="update-meta-card">
                    <span class="meta-label">Current Branch</span>
                    <span class="meta-val" id="update-cur-branch">main</span>
                  </div>
                  <div class="update-meta-card">
                    <span class="meta-label">Current SHA</span>
                    <span class="meta-val" id="update-cur-sha">HEAD</span>
                  </div>
                </div>

                <div class="update-controls-row">
                  <div class="update-channel-group">
                    <label for="update-branch-select">Target Branch:</label>
                    <select id="update-branch-select" class="setting-select">
                      <option value="main">main</option>
                    </select>
                  </div>
                  <div class="update-buttons">
                    <button class="btn btn-secondary" id="btn-check-update">Check for Updates</button>
                    <button class="btn btn-primary" id="btn-apply-update" disabled>Update Now</button>
                  </div>
                </div>

                <div class="update-status" id="update-status-msg">Click "Check for Updates" to query the repository.</div>

                <div class="update-token-row" style="margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--border-color);">
                  <div style="margin-bottom: 6px;">
                    <label for="setting-github-token" style="font-size: 12px; font-weight: 600; color: var(--fg-primary);">GitHub Personal Access Token (Optional):</label>
                    <div style="font-size: 11px; color: var(--fg-muted); margin-top: 2px;">Required to fetch branches and updates if the Gitero repository is private.</div>
                  </div>
                  <div style="display: flex; gap: 8px;">
                    <input type="password" id="setting-github-token" class="setting-input" style="flex: 1;" placeholder="ghp_xxxxxxxxxxxxxxxxxxxx" spellcheck="false" />
                    <button class="btn btn-secondary btn-sm" id="btn-toggle-github-token" type="button">Show</button>
                    <button class="btn btn-primary btn-sm" id="btn-save-github-token" type="button">Save Token</button>
                  </div>
                </div>

                <div class="update-history-section">
                  <div class="update-history-header">
                    <div class="history-title-group">
                      <h4>Update & Rollback History</h4>
                      <span class="history-badge" id="history-count-badge">0</span>
                    </div>
                    <button class="btn btn-secondary btn-sm" id="btn-toggle-history">Show History</button>
                  </div>
                  <div class="update-history-list" id="update-history-list" style="display: none;"></div>
                </div>
              </div>
            </div>

            <!-- 6. Custom CSS Tab Pane -->
            <div class="settings-tab-pane" id="tab-pane-css" data-tab="css">
              <div class="settings-section-header">
                <div class="settings-section-title">Custom CSS Override</div>
                <div class="settings-section-subtitle">Inject arbitrary CSS rules to style any editor component, cursor, scrollbar, or status bar.</div>
              </div>

              <div class="setting-card">
                <textarea id="setting-custom-css" class="setting-textarea" placeholder="/* Enter custom CSS rules here */&#10;/* Example: */&#10;/* .cm-cursor { border-left-color: #58a6ff !important; box-shadow: 0 0 8px #58a6ff; } */"></textarea>
              </div>
            </div>

            <!-- 7. Languages & LSP Tab Pane -->
            <div class="settings-tab-pane" id="tab-pane-lsp" data-tab="lsp">
              <div class="settings-section-header">
                <div class="settings-section-title">Language Server Protocol (LSP) & Code Intelligence</div>
                <div class="settings-section-subtitle">Manage background language servers, real-time diagnostics, hover tooltips, and autocompletion.</div>
              </div>

              <div class="setting-card">
                <div class="setting-card-title">General Code Intelligence</div>
                <div class="setting-row">
                  <div class="setting-label">
                    <span class="setting-title">Enable Language Server Protocol (LSP)</span>
                    <span class="setting-desc">Automatically launch background language servers found in system PATH for rich IntelliSense</span>
                  </div>
                  <label class="setting-toggle">
                    <input type="checkbox" id="setting-lsp-enabled" checked />
                    <span class="toggle-slider"></span>
                  </label>
                </div>
                <div class="setting-row">
                  <div class="setting-label">
                    <span class="setting-title">Real-Time Diagnostics</span>
                    <span class="setting-desc">Display compiler error and warning squiggly lines and gutter indicators</span>
                  </div>
                  <label class="setting-toggle">
                    <input type="checkbox" id="setting-lsp-diagnostics" checked />
                    <span class="toggle-slider"></span>
                  </label>
                </div>
                <div class="setting-row">
                  <div class="setting-label">
                    <span class="setting-title">Hover Tooltip Inspector</span>
                    <span class="setting-desc">Inspect function signatures, types, and Markdown documentation on cursor hover</span>
                  </div>
                  <label class="setting-toggle">
                    <input type="checkbox" id="setting-lsp-hover" checked />
                    <span class="toggle-slider"></span>
                  </label>
                </div>
                <div class="setting-row">
                  <div class="setting-label">
                    <span class="setting-title">Signature Help (Parameter Hints)</span>
                    <span class="setting-desc">Display active parameter signatures and documentation tooltips when typing inside argument lists</span>
                  </div>
                  <label class="setting-toggle">
                    <input type="checkbox" id="setting-lsp-signature-help" checked />
                    <span class="toggle-slider"></span>
                  </label>
                </div>
              </div>

              <div class="setting-card">
                <div class="setting-card-title" style="display: flex; justify-content: space-between; align-items: center;">
                  <span>Supported Language Servers</span>
                  <div style="display: flex; gap: 8px;">
                    <button type="button" class="btn btn-primary btn-sm" id="btn-add-custom-lsp">+ Add Custom Server</button>
                    <button type="button" class="btn btn-secondary btn-sm" id="btn-refresh-lsp-status">Refresh PATH</button>
                  </div>
                </div>
                <div style="font-size: 11px; color: var(--fg-muted); margin-bottom: 12px;">
                  Gitero auto-detects standard language servers on your system PATH, and lets you register custom servers for any language or framework.
                </div>

                <!-- Add / Edit Custom Server Form Card -->
                <div id="add-lsp-server-form-card" class="add-lsp-server-form-card" style="display: none; margin-bottom: 16px; padding: 14px; background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border-color, #30363d); border-radius: 6px;">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <span id="lsp-form-title" style="font-weight: 600; font-size: 13px; color: var(--fg-primary);">Add Custom Language Server</span>
                    <button type="button" class="btn btn-secondary btn-sm" id="btn-cancel-custom-lsp">Cancel</button>
                  </div>
                  <input type="hidden" id="lsp-form-server-id" value="" />
                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 10px;">
                    <div>
                      <label style="display: block; font-size: 11px; color: var(--fg-muted); margin-bottom: 4px;">Server Name</label>
                      <input type="text" id="lsp-form-name" class="setting-input" placeholder="e.g. Zig Language Server (zls)" style="width: 100%; box-sizing: border-box;" />
                    </div>
                    <div>
                      <label style="display: block; font-size: 11px; color: var(--fg-muted); margin-bottom: 4px;">File Extensions (comma separated)</label>
                      <input type="text" id="lsp-form-languages" class="setting-input" placeholder="e.g. zig, zls" style="width: 100%; box-sizing: border-box;" />
                    </div>
                  </div>
                  <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 12px; margin-bottom: 10px;">
                    <div>
                      <label style="display: block; font-size: 11px; color: var(--fg-muted); margin-bottom: 4px;">Executable Command / Path</label>
                      <input type="text" id="lsp-form-command" class="setting-input" placeholder="e.g. zls or C:\\tools\\zls.exe" style="width: 100%; box-sizing: border-box; font-family: var(--font-mono, monospace); font-size: 11px;" />
                    </div>
                    <div>
                      <label style="display: block; font-size: 11px; color: var(--fg-muted); margin-bottom: 4px;">Command Arguments (optional)</label>
                      <input type="text" id="lsp-form-args" class="setting-input" placeholder="e.g. --stdio" style="width: 100%; box-sizing: border-box; font-family: var(--font-mono, monospace); font-size: 11px;" />
                    </div>
                  </div>
                  <div style="margin-bottom: 12px;">
                    <label style="display: block; font-size: 11px; color: var(--fg-muted); margin-bottom: 4px;">Documentation / Install URL (optional)</label>
                    <input type="text" id="lsp-form-guide" class="setting-input" placeholder="e.g. https://github.com/zigtools/zls" style="width: 100%; box-sizing: border-box; font-size: 11px;" />
                  </div>
                  <div style="display: flex; justify-content: flex-end; gap: 8px;">
                    <button type="button" class="btn btn-secondary btn-sm" id="btn-cancel-custom-lsp-bottom">Cancel</button>
                    <button type="button" class="btn btn-primary btn-sm" id="btn-save-custom-lsp">Save Language Server</button>
                  </div>
                </div>

                <div class="lsp-servers-list" id="lsp-servers-list">
                  <!-- Rendered dynamically -->
                </div>

                <!-- Muted Notifications Section -->
                <div id="lsp-muted-prompts-section" style="margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--border-color, #30363d); display: none;">
                  <div style="font-size: 12px; font-weight: 600; color: var(--fg-primary); margin-bottom: 6px;">Muted Language Server Prompts</div>
                  <div style="font-size: 11px; color: var(--fg-muted); margin-bottom: 8px;">
                    You previously chose &quot;Don&apos;t Ask Again&quot; for the following file types:
                  </div>
                  <div id="lsp-muted-chips-container" style="display: flex; flex-wrap: wrap; gap: 6px;"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="settings-footer">
          <div class="settings-footer-info">
            <span>Changes apply immediately upon saving.</span>
          </div>
          <div class="settings-footer-actions">
            <button class="btn btn-secondary" id="settings-cancel">Close</button>
            <button class="btn btn-primary" id="settings-save">Save & Apply</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(this.overlay);

    const closeBtn = this.overlay.querySelector('.settings-close-btn') as HTMLElement;
    const cancelBtn = this.overlay.querySelector('#settings-cancel') as HTMLElement;
    const saveBtn = this.overlay.querySelector('#settings-save') as HTMLElement;

    closeBtn.addEventListener('click', () => this.close());
    cancelBtn.addEventListener('click', () => this.close());
    saveBtn.addEventListener('click', () => this.save());

    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close();
    });

    // Wire up sidebar tab switches
    const tabBtns = this.overlay.querySelectorAll('.settings-tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-target');
        if (target) this.switchTab(target);
      });
    });

    this.setupAppearanceSubtabs();
    this.setupUpdateListeners();
    this.setupKeybindingsListeners();
    this.setupThemeStudioListeners();
    this.setupIconThemeListeners();
    this.setupTerminalSettingsListeners();
    this.setupFileAssociationListeners();
    this.setupTransparencyStudioListeners();
    this.setupLspSettingsListeners();
  }

  private setupAppearanceSubtabs() {
    const subtabBtns = this.overlay.querySelectorAll<HTMLButtonElement>('#appearance-subtabs-nav .appearance-subtab-btn');
    const subtabPanes = this.overlay.querySelectorAll<HTMLElement>('.appearance-subtab-pane');

    subtabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-subtab');
        subtabBtns.forEach(b => b.classList.toggle('active', b === btn));
        subtabPanes.forEach(pane => {
          pane.classList.toggle('active', pane.getAttribute('data-subpane') === target);
        });
      });
    });

    this.updateBorderRadiusControlState();
  }

  private updateBorderRadiusControlState() {
    const glassEnabled = !!preferencesService.get('transparency.enabled');
    const radiusInput = this.overlay.querySelector('#setting-window-border-radius') as HTMLInputElement;
    const radiusVal = this.overlay.querySelector('#val-window-border-radius') as HTMLElement;
    const radiusNote = this.overlay.querySelector('#note-window-border-radius') as HTMLElement;

    if (radiusInput) {
      radiusInput.disabled = !glassEnabled;
      radiusInput.style.opacity = glassEnabled ? '1' : '0.45';
      radiusInput.style.cursor = glassEnabled ? 'pointer' : 'not-allowed';
    }
    if (radiusVal) {
      radiusVal.style.opacity = glassEnabled ? '1' : '0.45';
    }
    if (radiusNote) {
      radiusNote.style.color = glassEnabled ? 'var(--accent-color, #58a6ff)' : 'var(--fg-muted)';
      radiusNote.textContent = glassEnabled
        ? 'Active — applied to window frame when not maximized'
        : 'Disabled — requires "Enable Glass" in Glass & Transparency tab';
    }
  }

  private setupFileAssociationListeners() {
    const registerMdBtn = this.overlay.querySelector('#btn-assoc-register-md') as HTMLButtonElement;
    const registerAllBtn = this.overlay.querySelector('#btn-assoc-register-all') as HTMLButtonElement;
    const refreshCacheBtn = this.overlay.querySelector('#btn-assoc-refresh-cache') as HTMLButtonElement;
    const statusMsg = this.overlay.querySelector('#assoc-status-message') as HTMLElement;

    const showStatus = (msg: string, isError = false) => {
      if (!statusMsg) return;
      statusMsg.style.display = 'block';
      statusMsg.style.backgroundColor = isError ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)';
      statusMsg.style.color = isError ? '#f87171' : '#4ade80';
      statusMsg.style.border = `1px solid ${isError ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`;
      statusMsg.textContent = msg;
    };

    registerMdBtn?.addEventListener('click', async () => {
      registerMdBtn.disabled = true;
      registerMdBtn.textContent = 'Registering...';
      try {
        const res = await fileAssociationService.registerMarkdownAsDefault();
        if (res.success) {
          showStatus('Gitero successfully registered as default reader for Markdown files (.md, .markdown) with dedicated Markdown document icon.');
        } else {
          showStatus(`Failed to register Markdown association: ${res.error}`, true);
        }
      } catch (err: any) {
        showStatus(`Error registering Markdown association: ${err?.message || err}`, true);
      } finally {
        registerMdBtn.disabled = false;
        registerMdBtn.textContent = 'Register Markdown (.md)';
      }
    });

    registerAllBtn?.addEventListener('click', async () => {
      registerAllBtn.disabled = true;
      registerAllBtn.textContent = 'Registering all...';
      try {
        const res = await fileAssociationService.registerAll();
        if (res.success) {
          showStatus(`Registered document icons for ${res.registered} file extensions across all supported formats.`);
        } else {
          showStatus(`Failed to register associations: ${res.error}`, true);
        }
      } catch (err: any) {
        showStatus(`Error registering associations: ${err?.message || err}`, true);
      } finally {
        registerAllBtn.disabled = false;
        registerAllBtn.textContent = 'Register All Supported Types';
      }
    });

    refreshCacheBtn?.addEventListener('click', async () => {
      refreshCacheBtn.disabled = true;
      refreshCacheBtn.textContent = 'Refreshing...';
      try {
        const ok = await fileAssociationService.refreshWindowsIconCache();
        if (ok) {
          showStatus('Windows Explorer icon cache refresh signal sent successfully.');
        } else {
          showStatus('Windows icon refresh is only supported on Windows desktop.', true);
        }
      } finally {
        refreshCacheBtn.disabled = false;
        refreshCacheBtn.textContent = 'Refresh Icon Cache';
      }
    });
  }

  private setupTerminalSettingsListeners() {
    const clearHistBtn = this.overlay.querySelector('#btn-clear-terminal-history') as HTMLButtonElement;
    clearHistBtn?.addEventListener('click', () => {
      try {
        localStorage.removeItem('gitero_terminal_history');
        alert('Terminal command history cleared.');
      } catch (e) {
        console.warn('Failed to clear terminal history', e);
      }
    });
  }

  private setupIconThemeListeners() {
    const iconSelect = this.overlay.querySelector('#setting-icon-theme-select') as HTMLSelectElement;
    const previewBox = this.overlay.querySelector('#icon-theme-preview-box') as HTMLElement;
    const customSection = this.overlay.querySelector('#custom-icon-section') as HTMLElement;
    const customTextarea = this.overlay.querySelector('#setting-custom-icon-json') as HTMLTextAreaElement;
    const uploadBtn = this.overlay.querySelector('#btn-icon-upload-json') as HTMLButtonElement;
    const uploadInput = this.overlay.querySelector('#input-icon-upload-json') as HTMLInputElement;
    const applyBtn = this.overlay.querySelector('#btn-icon-apply-custom') as HTMLButtonElement;

    const updatePreview = (theme: IconTheme) => {
      if (previewBox) {
        previewBox.innerHTML = renderIconPreview(theme);
      }
      if (customSection) {
        customSection.style.display = theme === 'custom' ? 'block' : 'none';
      }
    };

    iconSelect?.addEventListener('change', () => {
      const theme = (iconSelect.value as IconTheme) || 'lucide';
      updatePreview(theme);
      preferencesService.set('workbench.iconTheme', theme);
      try {
        localStorage.setItem('gitero_icon_theme', theme);
      } catch {}
    });

    uploadBtn?.addEventListener('click', () => {
      uploadInput?.click();
    });

    uploadInput?.addEventListener('change', (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const text = reader.result as string;
          JSON.parse(text); // validate
          if (customTextarea) customTextarea.value = text;
          preferencesService.set('workbench.customIconPackage', text);
          preferencesService.set('workbench.iconTheme', 'custom');
          if (iconSelect) iconSelect.value = 'custom';
          updatePreview('custom');
          alert('Custom icon package loaded successfully!');
        } catch {
          alert('Invalid JSON in uploaded package file.');
        }
      };
      reader.readAsText(file);
    });

    applyBtn?.addEventListener('click', () => {
      try {
        const val = customTextarea?.value.trim() || '{}';
        JSON.parse(val);
        preferencesService.set('workbench.customIconPackage', val);
        preferencesService.set('workbench.iconTheme', 'custom');
        if (iconSelect) iconSelect.value = 'custom';
        updatePreview('custom');
        alert('Custom icon package applied!');
      } catch {
        alert('Invalid JSON in custom package field.');
      }
    });

    const radiusInput = this.overlay.querySelector('#setting-window-border-radius') as HTMLInputElement;
    const radiusVal = this.overlay.querySelector('#val-window-border-radius');
    radiusInput?.addEventListener('input', () => {
      const val = parseInt(radiusInput.value, 10) || 0;
      if (radiusVal) radiusVal.textContent = `${val}px`;
      preferencesService.set('workbench.windowBorderRadius', val);
    });
  }

  private setupUpdateListeners() {
    const branchSelect = this.overlay.querySelector('#update-branch-select') as HTMLSelectElement;
    const checkBtn = this.overlay.querySelector('#btn-check-update') as HTMLButtonElement;
    const applyBtn = this.overlay.querySelector('#btn-apply-update') as HTMLButtonElement;
    const statusMsg = this.overlay.querySelector('#update-status-msg') as HTMLElement;

    const tokenInput = this.overlay.querySelector('#setting-github-token') as HTMLInputElement;
    const toggleTokenBtn = this.overlay.querySelector('#btn-toggle-github-token') as HTMLButtonElement;
    const saveTokenBtn = this.overlay.querySelector('#btn-save-github-token') as HTMLButtonElement;

    toggleTokenBtn?.addEventListener('click', () => {
      if (tokenInput.type === 'password') {
        tokenInput.type = 'text';
        toggleTokenBtn.textContent = 'Hide';
      } else {
        tokenInput.type = 'password';
        toggleTokenBtn.textContent = 'Show';
      }
    });

    saveTokenBtn?.addEventListener('click', async () => {
      const val = tokenInput.value.trim();
      preferencesService.set('updater.githubToken', val);
      try {
        localStorage.setItem('gitero_github_token', val);
      } catch {}
      statusMsg.innerHTML = '<span style="color: #4ade80;">GitHub token saved. Fetching branches...</span>';
      await this.loadBranches();
    });

    checkBtn.addEventListener('click', async () => {
      const branch = branchSelect.value;
      checkBtn.disabled = true;
      statusMsg.innerHTML = `<span class="loading-spinner"></span> Checking GitHub for branch <strong>${branch}</strong>...`;

      try {
        const result = await updaterService.checkForUpdates(branch);
        if (result.isUpdateAvailable) {
          statusMsg.innerHTML = `
            <div class="update-avail-box">
              <span class="status-badge badge-avail">Update Available</span>
              <div class="commit-details">
                <div><strong>Commit:</strong> <code>${result.latestSha}</code> <a href="https://github.com/iharshraj1123/Gitero-IDE/commit/${result.latestSha}" target="_blank" rel="noopener noreferrer" style="margin-left: 8px; color: var(--accent-color, #58a6ff); font-size: 11px; text-decoration: none;">View on GitHub</a></div>
                <div><strong>Message:</strong> ${result.latestCommit?.message}</div>
                <div><strong>Author:</strong> ${result.latestCommit?.author} (${new Date(result.latestCommit?.date || '').toLocaleDateString()})</div>
              </div>
            </div>
          `;
          applyBtn.disabled = false;
          applyBtn.textContent = `Update from ${branch}`;
        } else {
          statusMsg.innerHTML = `
            <div class="update-uptodate-box">
              <span class="status-badge badge-latest">Up to Date</span>
              <span>You are already running the latest commit (<code>${result.currentSha}</code>) on branch <strong>${branch}</strong>. <a href="https://github.com/iharshraj1123/Gitero-IDE/commits/${branch}" target="_blank" rel="noopener noreferrer" style="margin-left: 6px; color: var(--accent-color, #58a6ff); font-size: 11px; text-decoration: none;">View commits</a></span>
            </div>
          `;
          applyBtn.disabled = false;
          applyBtn.textContent = `Force Re-sync ${branch}`;
        }
      } catch (err: any) {
        statusMsg.innerHTML = `<span class="error-text">${err.message || 'Could not connect to GitHub'}</span>`;
        applyBtn.disabled = true;
      } finally {
        checkBtn.disabled = false;
      }
    });

    applyBtn.addEventListener('click', async () => {
      const branch = branchSelect.value;
      applyBtn.disabled = true;
      checkBtn.disabled = true;

      try {
        await updaterService.updateFromBranch(branch, (step) => {
          statusMsg.innerHTML = `<span class="loading-spinner"></span> ${step}`;
        });

        statusMsg.innerHTML = `
          <div class="update-success-box">
            <span class="status-badge badge-latest">Update Applied Successfully</span>
            <p>Gitero IDE updated to branch <strong>${branch}</strong>.</p>
            <button class="btn btn-primary btn-sm" id="btn-restart-now" style="margin-top: 8px;">Restart Gitero IDE</button>
          </div>
        `;

        this.overlay.querySelector('#btn-restart-now')?.addEventListener('click', () => {
          updaterService.restartApp();
        });

        (this.overlay.querySelector('#update-cur-sha') as HTMLElement).textContent = updaterService.getCurrentSha();
        (this.overlay.querySelector('#update-cur-branch') as HTMLElement).textContent = updaterService.getCurrentBranch();
        this.renderUpdateHistory();
      } catch (err: any) {
        statusMsg.innerHTML = `<span class="error-text">Update failed: ${err.message}</span>`;
        applyBtn.disabled = false;
        checkBtn.disabled = false;
      }
    });

    const toggleHistoryBtn = this.overlay.querySelector('#btn-toggle-history') as HTMLButtonElement;
    const historyList = this.overlay.querySelector('#update-history-list') as HTMLElement;

    toggleHistoryBtn.addEventListener('click', () => {
      const isHidden = historyList.style.display === 'none';
      if (isHidden) {
        historyList.style.display = 'flex';
        toggleHistoryBtn.textContent = 'Hide History';
        this.renderUpdateHistory();
      } else {
        historyList.style.display = 'none';
        toggleHistoryBtn.textContent = 'Show History';
      }
    });
  }

  private async loadBranches() {
    const branchSelect = this.overlay.querySelector('#update-branch-select') as HTMLSelectElement;
    const currentBranch = updaterService.getCurrentBranch();

    try {
      const branches = await updaterService.fetchBranches();
      branchSelect.innerHTML = '';
      branches.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b;
        opt.textContent = b;
        if (b === currentBranch) opt.selected = true;
        branchSelect.appendChild(opt);
      });
    } catch (e) {
      console.warn('Could not load branches', e);
    }
  }

  private renderUpdateHistory() {
    const historyList = this.overlay.querySelector('#update-history-list') as HTMLElement;
    const countBadge = this.overlay.querySelector('#history-count-badge') as HTMLElement;
    const statusMsg = this.overlay.querySelector('#update-status-msg') as HTMLElement;
    const applyBtn = this.overlay.querySelector('#btn-apply-update') as HTMLButtonElement;
    const checkBtn = this.overlay.querySelector('#btn-check-update') as HTMLButtonElement;

    if (!historyList) return;

    const history = updaterService.getHistory();
    if (countBadge) countBadge.textContent = String(history.length);
    const currentSha = updaterService.getCurrentSha().toLowerCase();

    if (history.length === 0) {
      historyList.innerHTML = '<div class="history-empty-msg">No update history recorded yet.</div>';
      return;
    }

    historyList.innerHTML = history.map(entry => {
      const isCurrent = entry.toSha.toLowerCase() === currentSha;
      const isRollback = entry.type === 'rollback';
      return `
        <div class="history-card ${isCurrent ? 'is-current' : ''}">
          <div class="history-card-header">
            <div class="history-badges">
              <span class="history-type-badge ${isRollback ? 'badge-rollback' : 'badge-update'}">${entry.type}</span>
              <span class="history-branch-badge">${entry.branch}</span>
              <span class="history-sha-badge"><code>${entry.toSha}</code></span>
            </div>
            <span class="history-timestamp" title="${entry.timestamp}">${entry.formattedTime}</span>
          </div>
          <div class="history-message">${entry.commitMessage}</div>
          <div class="history-card-footer">
            <span class="history-author">Author: ${entry.author}</span>
            ${isCurrent 
              ? `<span class="badge-active-state"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Current State</span>`
              : `<button class="btn btn-secondary btn-sm btn-rollback-state" data-entry-id="${entry.id}">Rollback to this state</button>`
            }
          </div>
        </div>
      `;
    }).join('');

    // Attach rollback handlers
    historyList.querySelectorAll('.btn-rollback-state').forEach(btn => {
      btn.addEventListener('click', async () => {
        const entryId = btn.getAttribute('data-entry-id');
        const targetEntry = history.find(h => h.id === entryId);
        if (!targetEntry) return;

        applyBtn.disabled = true;
        checkBtn.disabled = true;
        statusMsg.innerHTML = `<span class="loading-spinner"></span> Initializing rollback to commit <code>${targetEntry.toSha}</code>...`;

        try {
          await updaterService.rollbackTo(targetEntry, (step) => {
            statusMsg.innerHTML = `<span class="loading-spinner"></span> ${step}`;
          });

          (this.overlay.querySelector('#update-cur-sha') as HTMLElement).textContent = updaterService.getCurrentSha();
          (this.overlay.querySelector('#update-cur-branch') as HTMLElement).textContent = updaterService.getCurrentBranch();

          statusMsg.innerHTML = `
            <div class="update-success-box">
              <span class="status-badge badge-latest">Rollback Applied</span>
              <p>Gitero IDE restored to commit <strong>${targetEntry.toSha}</strong> (${targetEntry.branch}).</p>
              <button class="btn btn-primary btn-sm" id="btn-restart-rollback" style="margin-top: 8px;">Restart Gitero IDE</button>
            </div>
          `;

          this.overlay.querySelector('#btn-restart-rollback')?.addEventListener('click', () => {
            updaterService.restartApp();
          });

          this.renderUpdateHistory();
        } catch (err: any) {
          statusMsg.innerHTML = `<span class="error-text">Rollback failed: ${err.message}</span>`;
        } finally {
          applyBtn.disabled = false;
          checkBtn.disabled = false;
        }
      });
    });
  }

  private editingActionId: string | null = null;

  private setupKeybindingsListeners() {
    const searchInput = this.overlay.querySelector('#setting-keybinding-search') as HTMLInputElement;
    const resetBtn = this.overlay.querySelector('#btn-reset-keybindings') as HTMLButtonElement;

    searchInput.addEventListener('input', () => {
      this.renderKeybindingsTable(searchInput.value.trim());
    });

    resetBtn.addEventListener('click', () => {
      const confirmReset = confirm('Reset all keyboard shortcuts to their default combinations?');
      if (confirmReset) {
        preferencesService.resetKeybindings();
        this.renderKeybindingsTable(searchInput.value.trim());
      }
    });
  }

  private renderKeybindingsTable(filterQuery: string = '') {
    const tbody = this.overlay.querySelector('#keybindings-table-body') as HTMLElement;
    if (!tbody) return;

    tbody.innerHTML = '';
    const q = filterQuery.toLowerCase();

    const filtered = KEYBINDING_DEFINITIONS.filter(def => {
      const shortcut = preferencesService.getKeybinding(def.id);
      return (
        !q ||
        def.name.toLowerCase().includes(q) ||
        def.category.toLowerCase().includes(q) ||
        def.id.toLowerCase().includes(q) ||
        shortcut.toLowerCase().includes(q)
      );
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="3" class="keybindings-empty">No matching keyboard shortcuts found</td></tr>`;
      return;
    }

    for (const def of filtered) {
      const tr = document.createElement('tr');
      tr.className = 'keybinding-row';

      const currentShortcut = preferencesService.getKeybinding(def.id);
      const isEditing = this.editingActionId === def.id;

      if (isEditing) {
        tr.classList.add('is-editing');
        tr.innerHTML = `
          <td class="keybinding-col-cmd">
            <div class="keybinding-cmd-name">${def.name}</div>
            <div class="keybinding-cmd-id"><code>${def.id}</code></div>
          </td>
          <td class="keybinding-col-keys">
            <input type="text" class="keybinding-recorder-input" value="${currentShortcut}" placeholder="Press keys..." />
          </td>
          <td class="keybinding-col-action">
            <div class="keybinding-edit-btns">
              <button class="btn btn-primary btn-sm btn-save-kb" title="Save keybinding">Save</button>
              <button class="btn btn-secondary btn-sm btn-cancel-kb" title="Cancel">Cancel</button>
            </div>
          </td>
        `;

        const recorderInput = tr.querySelector('.keybinding-recorder-input') as HTMLInputElement;
        const saveBtn = tr.querySelector('.btn-save-kb') as HTMLButtonElement;
        const cancelBtn = tr.querySelector('.btn-cancel-kb') as HTMLButtonElement;

        setTimeout(() => recorderInput.focus(), 30);

        recorderInput.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            this.editingActionId = null;
            this.renderKeybindingsTable(filterQuery);
            return;
          }
          if (e.key === 'Enter') {
            e.preventDefault();
            preferencesService.setKeybinding(def.id, recorderInput.value.trim());
            this.editingActionId = null;
            this.renderKeybindingsTable(filterQuery);
            return;
          }

          if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;

          e.preventDefault();
          e.stopPropagation();

          const parts: string[] = [];
          if (e.ctrlKey) parts.push('Ctrl');
          if (e.altKey) parts.push('Alt');
          if (e.shiftKey) parts.push('Shift');
          if (e.metaKey) parts.push('Meta');

          let k = e.key;
          if (k === ' ') k = 'Space';
          else if (k.length === 1) k = k.toUpperCase();

          parts.push(k);
          recorderInput.value = parts.join('+');
        });

        saveBtn.addEventListener('click', () => {
          preferencesService.setKeybinding(def.id, recorderInput.value.trim());
          this.editingActionId = null;
          this.renderKeybindingsTable(filterQuery);
        });

        cancelBtn.addEventListener('click', () => {
          this.editingActionId = null;
          this.renderKeybindingsTable(filterQuery);
        });
      } else {
        const kbdHtml = currentShortcut
          ? `<kbd class="keybinding-kbd">${currentShortcut}</kbd>`
          : `<span class="keybinding-none">Unassigned</span>`;

        tr.innerHTML = `
          <td class="keybinding-col-cmd">
            <div class="keybinding-cmd-name">${def.name} <span class="keybinding-cat-badge">${def.category}</span></div>
            <div class="keybinding-cmd-id"><code>${def.id}</code></div>
          </td>
          <td class="keybinding-col-keys">${kbdHtml}</td>
          <td class="keybinding-col-action">
            <button class="btn btn-secondary btn-sm btn-change-kb" data-id="${def.id}">Change</button>
          </td>
        `;

        const changeBtn = tr.querySelector('.btn-change-kb') as HTMLButtonElement;
        changeBtn.addEventListener('click', () => {
          this.editingActionId = def.id;
          this.renderKeybindingsTable(filterQuery);
        });

        tr.addEventListener('dblclick', () => {
          this.editingActionId = def.id;
          this.renderKeybindingsTable(filterQuery);
        });
      }

      tbody.appendChild(tr);
    }
  }

  switchTab(tabId: string) {
    const tabBtns = this.overlay.querySelectorAll('.settings-tab-btn');
    const tabPanes = this.overlay.querySelectorAll('.settings-tab-pane');

    tabBtns.forEach(btn => {
      if (btn.getAttribute('data-target') === tabId) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    tabPanes.forEach(pane => {
      if (pane.getAttribute('data-tab') === tabId) {
        pane.classList.add('active');
      } else {
        pane.classList.remove('active');
      }
    });

    if (tabId === 'updates') {
      this.loadBranches();
    } else if (tabId === 'lsp') {
      this.renderLspServersList();
    }
  }

  private workingTheme: ThemeDefinition | null = null;

  private setupThemeStudioListeners() {
    const themeSelect = this.overlay.querySelector('#setting-theme-select') as HTMLSelectElement;
    const newBtn = this.overlay.querySelector('#btn-theme-new') as HTMLButtonElement;
    const saveBtn = this.overlay.querySelector('#btn-theme-save') as HTMLButtonElement;
    const exportBtn = this.overlay.querySelector('#btn-theme-export') as HTMLButtonElement;
    const importBtn = this.overlay.querySelector('#btn-theme-import') as HTMLButtonElement;
    const deleteBtn = this.overlay.querySelector('#btn-theme-delete') as HTMLButtonElement;

    themeSelect?.addEventListener('change', () => {
      this.loadThemeIntoStudio(themeSelect.value);
    });

    newBtn?.addEventListener('click', () => {
      const name = prompt('Enter a name for the new custom theme:', (this.workingTheme?.name || 'Custom') + ' Copy');
      if (!name || !name.trim()) return;
      const baseColors = this.workingTheme?.colors || themeManager.getCurrentTheme().colors;
      const id = 'custom-' + name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now().toString(36);
      const newTheme: ThemeDefinition = {
        id,
        name: name.trim(),
        isDark: true,
        colors: { ...baseColors }
      };
      themeManager.saveCustomTheme(newTheme);
      this.refreshThemeDropdown(newTheme.id);
      this.loadThemeIntoStudio(newTheme.id);
    });

    saveBtn?.addEventListener('click', () => {
      if (!this.workingTheme) return;
      if (themeManager.isCustomTheme(this.workingTheme.id)) {
        themeManager.saveCustomTheme(this.workingTheme);
        alert(`Saved theme "${this.workingTheme.name}".`);
      } else {
        const name = prompt('Preset themes are protected. Save as a new custom theme name:', this.workingTheme.name + ' Custom');
        if (!name || !name.trim()) return;
        const id = 'custom-' + name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now().toString(36);
        const newTheme: ThemeDefinition = {
          ...this.workingTheme,
          id,
          name: name.trim()
        };
        themeManager.saveCustomTheme(newTheme);
        this.refreshThemeDropdown(newTheme.id);
        this.loadThemeIntoStudio(newTheme.id);
      }
    });

    deleteBtn?.addEventListener('click', () => {
      if (!this.workingTheme || !themeManager.isCustomTheme(this.workingTheme.id)) return;
      if (confirm(`Delete custom theme "${this.workingTheme.name}"?`)) {
        themeManager.deleteCustomTheme(this.workingTheme.id);
        const curTheme = themeManager.getCurrentTheme();
        this.refreshThemeDropdown(curTheme.id);
        this.loadThemeIntoStudio(curTheme.id);
      }
    });

    exportBtn?.addEventListener('click', () => {
      if (!this.workingTheme) return;
      const json = JSON.stringify(this.workingTheme, null, 2);
      navigator.clipboard?.writeText(json).catch(() => {});
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${this.workingTheme.id}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });

    importBtn?.addEventListener('click', () => {
      const input = prompt('Paste theme JSON content here:');
      if (!input || !input.trim()) return;
      try {
        const imported = themeManager.importThemeJson(input.trim());
        this.refreshThemeDropdown(imported.id);
        this.loadThemeIntoStudio(imported.id);
      } catch (err: any) {
        alert('Failed to import theme: ' + err.message);
      }
    });
  }

  private refreshThemeDropdown(selectedId?: string) {
    const themeSelect = this.overlay.querySelector('#setting-theme-select') as HTMLSelectElement;
    if (!themeSelect) return;
    themeSelect.innerHTML = '';

    const currentId = selectedId || themeManager.getCurrentTheme().id;
    const allThemes = themeManager.getAllThemes();

    const presets = allThemes.filter(t => !themeManager.isCustomTheme(t.id));
    const customs = allThemes.filter(t => themeManager.isCustomTheme(t.id));

    const optGroupPresets = document.createElement('optgroup');
    optGroupPresets.label = 'Built-in Presets';
    presets.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.name;
      if (t.id === currentId) opt.selected = true;
      optGroupPresets.appendChild(opt);
    });
    themeSelect.appendChild(optGroupPresets);

    if (customs.length > 0) {
      const optGroupCustoms = document.createElement('optgroup');
      optGroupCustoms.label = 'Custom Themes';
      customs.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = `${t.name} (Custom)`;
        if (t.id === currentId) opt.selected = true;
        optGroupCustoms.appendChild(opt);
      });
      themeSelect.appendChild(optGroupCustoms);
    }
  }

  private loadThemeIntoStudio(themeId: string) {
    const theme = themeManager.getTheme(themeId);
    this.workingTheme = JSON.parse(JSON.stringify(theme));
    const deleteBtn = this.overlay.querySelector('#btn-theme-delete') as HTMLButtonElement;
    if (deleteBtn) {
      deleteBtn.style.display = themeManager.isCustomTheme(theme.id) ? 'inline-flex' : 'none';
    }

    this.renderThemeLivePreview();
    this.renderColorPickers();
    themeManager.applyTheme(this.workingTheme!, false);
  }

  private renderThemeLivePreview() {
    const box = this.overlay.querySelector('#theme-live-preview-box') as HTMLElement;
    if (!box || !this.workingTheme) return;
    const c = this.workingTheme.colors;

    box.style.background = c.editorBg;
    box.style.borderColor = c.borderColor;

    box.innerHTML = `
      <div class="preview-chrome" style="background: ${c.bgSecondary}; border-bottom: 1px solid ${c.borderColor}; color: ${c.fgPrimary}; display: flex; align-items: center; justify-content: space-between; padding: 6px 12px;">
        <div class="preview-chrome-left" style="display: flex; align-items: center; gap: 8px;">
          <span class="preview-dot" style="width: 10px; height: 10px; border-radius: 50%; background: #f85149; display: inline-block;"></span>
          <span class="preview-dot" style="width: 10px; height: 10px; border-radius: 50%; background: #e3b341; display: inline-block;"></span>
          <span class="preview-dot" style="width: 10px; height: 10px; border-radius: 50%; background: #2ea043; display: inline-block;"></span>
          <span class="preview-title" style="color: ${c.fgMuted}; font-size: 12px; margin-left: 6px; font-weight: 500;">${this.workingTheme.name}</span>
        </div>
        <div class="preview-chrome-badge" style="background: ${c.bgActive}; color: ${c.accent}; font-size: 11px; padding: 2px 8px; border-radius: 4px;">
          ${themeManager.isCustomTheme(this.workingTheme.id) ? 'Custom Theme' : 'Preset Theme'}
        </div>
      </div>
      <div class="preview-content-row" style="display: flex; min-height: 140px;">
        <div class="preview-sidebar" style="background: ${c.bgSidebar}; border-right: 1px solid ${c.borderColor}; color: ${c.fgMuted}; width: 140px; padding: 8px; font-size: 12px; display: flex; flex-direction: column; gap: 4px;">
          <div class="preview-tree-item" style="color: ${c.accent}; font-weight: 600;"><span style="margin-right: 4px;">▸</span> src</div>
          <div class="preview-tree-item active" style="background: ${c.bgActive}; color: ${c.fgPrimary}; padding: 2px 6px; border-radius: 3px;"><span style="margin-right: 4px;">•</span> main.ts</div>
          <div class="preview-tree-item" style="color: ${c.fgMuted}; padding: 2px 6px;"><span style="margin-right: 4px;">•</span> app.css</div>
        </div>
        <div class="preview-editor-canvas" style="flex: 1; background: ${c.editorBg}; color: ${c.editorFg}; font-family: monospace; font-size: 12.5px; padding: 8px 12px; line-height: 1.6;">
          <div class="preview-code-line"><span class="p-num" style="color: ${c.editorLineNumber}; display: inline-block; width: 22px;">1</span> <span style="color: ${c.synComment}; font-style: italic;">// Gitero IDE — Live Syntax Preview</span></div>
          <div class="preview-code-line"><span class="p-num" style="color: ${c.editorLineNumber}; display: inline-block; width: 22px;">2</span> <span style="color: ${c.synKeyword};">import</span> { <span style="color: ${c.synFunction};">createApp</span> } <span style="color: ${c.synKeyword};">from</span> <span style="color: ${c.synString};">'gitero'</span>;</div>
          <div class="preview-code-line active" style="background: ${c.editorActiveLine};"><span class="p-num" style="color: ${c.fgPrimary}; font-weight: bold; display: inline-block; width: 22px;">3</span> <span style="color: ${c.synKeyword};">export async function</span> <span style="color: ${c.synFunction};">buildApp</span>(<span style="color: ${c.synVariable};">config</span>: <span style="color: ${c.synType};">AppConfig</span>): <span style="color: ${c.synType};">Promise</span>&lt;<span style="color: ${c.synType};">boolean</span>&gt; {<span class="p-cursor" style="border-left: 2px solid ${c.editorCursor}; margin-left: 2px;"></span></div>
          <div class="preview-code-line"><span class="p-num" style="color: ${c.editorLineNumber}; display: inline-block; width: 22px;">4</span>   <span style="color: ${c.synKeyword};">const</span> <span style="color: ${c.synVariable};">totalCount</span>: <span style="color: ${c.synType};">number</span> = <span style="color: ${c.synNumber};">42</span>;</div>
          <div class="preview-code-line"><span class="p-num" style="color: ${c.editorLineNumber}; display: inline-block; width: 22px;">5</span>   <span style="color: ${c.synKeyword};">return</span> <span style="color: ${c.synVariable};">config</span>.<span style="color: ${c.synVariable};">enabled</span> <span style="color: ${c.synOperator};">===</span> <span style="color: ${c.synNumber};">true</span>;</div>
          <div class="preview-code-line"><span class="p-num" style="color: ${c.editorLineNumber}; display: inline-block; width: 22px;">6</span> }</div>
        </div>
      </div>
      <div class="preview-statusbar" style="background: ${c.statusBarBg}; color: ${c.statusBarFg}; border-top: 1px solid ${c.borderColor}; font-size: 11px; padding: 4px 12px; display: flex; justify-content: space-between;">
        <span>git: (main) • Synced</span>
        <span>TypeScript • UTF-8 • Tab Size: 2</span>
      </div>
    `;
  }

  private renderColorPickers() {
    if (!this.workingTheme) return;
    const colors = this.workingTheme.colors;

    const workspaceKeys: { key: keyof typeof colors; label: string }[] = [
      { key: 'bgPrimary', label: 'Primary Background' },
      { key: 'bgSidebar', label: 'Sidebar Background' },
      { key: 'bgSecondary', label: 'Top Bar / Chrome' },
      { key: 'bgHover', label: 'Hover Highlight' },
      { key: 'bgActive', label: 'Active Tab / Element' },
      { key: 'borderColor', label: 'Border & Dividers' },
      { key: 'accent', label: 'Accent & Links' },
      { key: 'statusBarBg', label: 'Status Bar Background' },
      { key: 'statusBarFg', label: 'Status Bar Text' }
    ];

    const editorKeys: { key: keyof typeof colors; label: string }[] = [
      { key: 'editorBg', label: 'Editor Canvas Background' },
      { key: 'editorFg', label: 'Editor Text' },
      { key: 'editorCursor', label: 'Cursor / Caret' },
      { key: 'editorSelection', label: 'Selection Highlight' },
      { key: 'editorActiveLine', label: 'Active Line Highlight' },
      { key: 'editorLineNumber', label: 'Line Numbers Gutter' }
    ];

    const syntaxKeys: { key: keyof typeof colors; label: string }[] = [
      { key: 'synKeyword', label: 'Keywords (import, function, return)' },
      { key: 'synString', label: 'Strings ("...", \'...\')' },
      { key: 'synFunction', label: 'Functions (createApp, buildApp)' },
      { key: 'synVariable', label: 'Variables (config, totalCount)' },
      { key: 'synComment', label: 'Comments (//, /* */)' },
      { key: 'synType', label: 'Types & Classes (Promise, number)' },
      { key: 'synNumber', label: 'Numbers & Booleans (42, true)' },
      { key: 'synOperator', label: 'Operators (===, =, +, &)' }
    ];

    const populateGrid = (containerId: string, keys: { key: keyof typeof colors; label: string }[]) => {
      const container = this.overlay.querySelector(containerId) as HTMLElement;
      if (!container) return;
      container.innerHTML = '';

      keys.forEach(({ key, label }) => {
        const val = (colors as any)[key] || '#ffffff';
        const card = document.createElement('div');
        card.className = 'color-item-card';
        card.innerHTML = `
          <div class="color-item-info">
            <span class="color-item-label">${label}</span>
            <code class="color-item-key">${key}</code>
          </div>
          <div class="color-item-inputs">
            <input type="color" class="color-picker-input" data-key="${key}" value="${val.length === 7 ? val : '#1a1b26'}" />
            <input type="text" class="color-text-input" data-key="${key}" value="${val}" spellcheck="false" />
          </div>
        `;

        const colorInput = card.querySelector('.color-picker-input') as HTMLInputElement;
        const textInput = card.querySelector('.color-text-input') as HTMLInputElement;

        const updateColor = (newVal: string) => {
          (this.workingTheme!.colors as any)[key] = newVal;
          if (newVal.length === 7) {
            colorInput.value = newVal;
          }
          textInput.value = newVal;
          this.renderThemeLivePreview();
          themeManager.applyTheme(this.workingTheme!, false);
        };

        colorInput.addEventListener('input', () => updateColor(colorInput.value));
        textInput.addEventListener('input', () => updateColor(textInput.value));

        container.appendChild(card);
      });
    };

    populateGrid('#theme-colors-workspace', workspaceKeys);
    populateGrid('#theme-colors-editor', editorKeys);
    populateGrid('#theme-colors-syntax', syntaxKeys);
  }

  open(initialTab: string = 'editor') {
    this.isOpen = true;
    this.overlay.style.display = 'flex';
    this.switchTab(initialTab);

    // Update section meta
    (this.overlay.querySelector('#update-cur-ver') as HTMLElement).textContent = updaterService.getCurrentVersion();
    (this.overlay.querySelector('#update-cur-sha') as HTMLElement).textContent = updaterService.getCurrentSha();
    (this.overlay.querySelector('#update-cur-branch') as HTMLElement).textContent = updaterService.getCurrentBranch();

    const tokenInput = this.overlay.querySelector('#setting-github-token') as HTMLInputElement;
    if (tokenInput) {
      tokenInput.value = preferencesService.get('updater.githubToken') || '';
    }

    this.renderUpdateHistory();
    this.editingActionId = null;
    this.renderKeybindingsTable();

    const autoSaveToggle = this.overlay.querySelector('#setting-auto-save-toggle') as HTMLInputElement;
    autoSaveToggle.checked = preferencesService.get('files.autoSave');

    const autoSaveDelayInput = this.overlay.querySelector('#setting-auto-save-delay') as HTMLInputElement;
    autoSaveDelayInput.value = String(preferencesService.get('files.autoSaveDelay'));

    const vimToggle = this.overlay.querySelector('#setting-vim-toggle') as HTMLInputElement;
    vimToggle.checked = vimIntegration.isEnabled();

    const currentTheme = themeManager.getCurrentTheme();
    this.refreshThemeDropdown(currentTheme.id);
    this.loadThemeIntoStudio(currentTheme.id);

    const cursorSelect = this.overlay.querySelector('#setting-cursor-style') as HTMLSelectElement;
    cursorSelect.value = preferencesService.get('editor.cursorStyle');

    const cursorBlinkingSelect = this.overlay.querySelector('#setting-cursor-blinking') as HTMLSelectElement;
    if (cursorBlinkingSelect) {
      cursorBlinkingSelect.value = preferencesService.get('editor.cursorBlinking');
    }

    const fontInput = this.overlay.querySelector('#setting-font-family') as HTMLInputElement;
    fontInput.value = preferencesService.get('editor.fontFamily');

    const sizeInput = this.overlay.querySelector('#setting-font-size') as HTMLInputElement;
    sizeInput.value = String(preferencesService.get('editor.fontSize'));

    const tabSizeInput = this.overlay.querySelector('#setting-tab-size') as HTMLInputElement;
    if (tabSizeInput) {
      tabSizeInput.value = String(preferencesService.get('editor.tabSize') || 2);
    }

    const lineHeightInput = this.overlay.querySelector('#setting-line-height') as HTMLInputElement;
    if (lineHeightInput) {
      lineHeightInput.value = String(preferencesService.get('editor.lineHeight') || 1.5);
    }

    const lineNumbersToggle = this.overlay.querySelector('#setting-line-numbers') as HTMLInputElement;
    if (lineNumbersToggle) {
      lineNumbersToggle.checked = preferencesService.get('editor.lineNumbers');
    }

    const indentGuidesToggle = this.overlay.querySelector('#setting-indent-guides') as HTMLInputElement;
    if (indentGuidesToggle) {
      indentGuidesToggle.checked = preferencesService.get('editor.renderIndentGuides') !== false;
      indentGuidesToggle.onchange = () => {
        preferencesService.set('editor.renderIndentGuides', indentGuidesToggle.checked);
      };
    }

    const minimapToggle = this.overlay.querySelector('#setting-minimap') as HTMLInputElement;
    if (minimapToggle) {
      minimapToggle.checked = preferencesService.get('editor.minimap.enabled') !== false;
      minimapToggle.onchange = () => {
        preferencesService.set('editor.minimap.enabled', minimapToggle.checked);
      };
    }

    const overviewRulerToggle = this.overlay.querySelector('#setting-overview-ruler') as HTMLInputElement;
    if (overviewRulerToggle) {
      overviewRulerToggle.checked = preferencesService.get('editor.overviewRuler.enabled') !== false;
      overviewRulerToggle.onchange = () => {
        preferencesService.set('editor.overviewRuler.enabled', overviewRulerToggle.checked);
      };
    }

    const gitGutterToggle = this.overlay.querySelector('#setting-git-gutter') as HTMLInputElement;
    if (gitGutterToggle) {
      gitGutterToggle.checked = preferencesService.get('editor.gitGutter.enabled') !== false;
      gitGutterToggle.onchange = () => {
        preferencesService.set('editor.gitGutter.enabled', gitGutterToggle.checked);
      };
    }

    const gitBlameToggle = this.overlay.querySelector('#setting-git-blame') as HTMLInputElement;
    if (gitBlameToggle) {
      gitBlameToggle.checked = preferencesService.get('editor.gitBlame.enabled') !== false;
      gitBlameToggle.onchange = () => {
        preferencesService.set('editor.gitBlame.enabled', gitBlameToggle.checked);
      };
    }

    const completeFunctionCallsToggle = this.overlay.querySelector('#setting-complete-function-calls') as HTMLInputElement;
    if (completeFunctionCallsToggle) {
      completeFunctionCallsToggle.checked = preferencesService.get('editor.suggest.completeFunctionCalls') !== false;
      completeFunctionCallsToggle.onchange = () => {
        preferencesService.set('editor.suggest.completeFunctionCalls', completeFunctionCallsToggle.checked);
      };
    }

    const formatOnSaveToggle = this.overlay.querySelector('#setting-format-on-save') as HTMLInputElement;
    if (formatOnSaveToggle) {
      formatOnSaveToggle.checked = preferencesService.get('editor.formatOnSave') === true;
      formatOnSaveToggle.onchange = () => {
        preferencesService.set('editor.formatOnSave', formatOnSaveToggle.checked);
      };
    }

    const insertSpacesSelect = this.overlay.querySelector('#setting-insert-spaces') as HTMLSelectElement;
    if (insertSpacesSelect) {
      insertSpacesSelect.value = String(preferencesService.get('editor.insertSpaces'));
    }

    const trimWhitespaceToggle = this.overlay.querySelector('#setting-trim-whitespace') as HTMLInputElement;
    if (trimWhitespaceToggle) {
      trimWhitespaceToggle.checked = preferencesService.get('editor.trimTrailingWhitespace');
    }

    const finalNewlineToggle = this.overlay.querySelector('#setting-final-newline') as HTMLInputElement;
    if (finalNewlineToggle) {
      finalNewlineToggle.checked = preferencesService.get('editor.insertFinalNewline');
    }

    const termSizeInput = this.overlay.querySelector('#setting-terminal-font-size') as HTMLInputElement;
    if (termSizeInput) {
      termSizeInput.value = String(preferencesService.get('terminal.fontSize') || 13);
    }

    const termFontInput = this.overlay.querySelector('#setting-terminal-font-family') as HTMLInputElement;
    if (termFontInput) {
      termFontInput.value = preferencesService.get('terminal.fontFamily') || '"Cascadia Code", "Fira Code", "JetBrains Mono", Consolas, monospace';
    }

    const wrapToggle = (this.overlay.querySelector('#setting-word-wrap') || this.overlay.querySelector('#setting-word-wrap-toggle')) as HTMLInputElement;
    if (wrapToggle) {
      wrapToggle.checked = preferencesService.get('editor.wordWrap');
    }

    const cssText = this.overlay.querySelector('#setting-custom-css') as HTMLTextAreaElement;
    cssText.value = themeManager.getCustomCss();

    // Load Icon Theme & Preview
    const iconSelect = this.overlay.querySelector('#setting-icon-theme-select') as HTMLSelectElement;
    const previewBox = this.overlay.querySelector('#icon-theme-preview-box') as HTMLElement;
    const customSection = this.overlay.querySelector('#custom-icon-section') as HTMLElement;
    const customTextarea = this.overlay.querySelector('#setting-custom-icon-json') as HTMLTextAreaElement;

    const currentIconTheme = preferencesService.get('workbench.iconTheme') || (localStorage.getItem('gitero_icon_theme') as IconTheme) || 'lucide';
    if (iconSelect) iconSelect.value = currentIconTheme;
    if (previewBox) previewBox.innerHTML = renderIconPreview(currentIconTheme);
    if (customSection) customSection.style.display = currentIconTheme === 'custom' ? 'block' : 'none';
    if (customTextarea) customTextarea.value = preferencesService.get('workbench.customIconPackage') || '';

    // Load Window Border Radius
    const radiusInput = this.overlay.querySelector('#setting-window-border-radius') as HTMLInputElement;
    const radiusVal = this.overlay.querySelector('#val-window-border-radius');
    let curRadius = preferencesService.get('workbench.windowBorderRadius') ?? 8;
    if (curRadius === 13 || curRadius === 10) {
      curRadius = 8;
      preferencesService.set('workbench.windowBorderRadius', 8);
    }
    if (radiusInput) radiusInput.value = String(curRadius);
    if (radiusVal) radiusVal.textContent = `${curRadius}px`;
    this.updateBorderRadiusControlState();

    this.refreshTransparencyStudioUi();
  }

  close() {
    this.isOpen = false;
    this.overlay.style.display = 'none';
    themeManager.applyTheme(themeManager.getCurrentTheme().id, false);
  }

  private save() {
    const autoSaveToggle = this.overlay.querySelector('#setting-auto-save-toggle') as HTMLInputElement;
    const autoSaveDelayInput = this.overlay.querySelector('#setting-auto-save-delay') as HTMLInputElement;
    const vimToggle = this.overlay.querySelector('#setting-vim-toggle') as HTMLInputElement;
    const themeSelect = this.overlay.querySelector('#setting-theme-select') as HTMLSelectElement;
    const cursorSelect = this.overlay.querySelector('#setting-cursor-style') as HTMLSelectElement;
    const cursorBlinkingSelect = this.overlay.querySelector('#setting-cursor-blinking') as HTMLSelectElement;
    const fontInput = this.overlay.querySelector('#setting-font-family') as HTMLInputElement;
    const sizeInput = this.overlay.querySelector('#setting-font-size') as HTMLInputElement;
    const tabSizeInput = this.overlay.querySelector('#setting-tab-size') as HTMLInputElement;
    const wrapToggle = (this.overlay.querySelector('#setting-word-wrap') || this.overlay.querySelector('#setting-word-wrap-toggle')) as HTMLInputElement;
    const cssText = this.overlay.querySelector('#setting-custom-css') as HTMLTextAreaElement;

    // Save Tab Size & Word Wrap
    if (tabSizeInput) {
      preferencesService.set('editor.tabSize', parseInt(tabSizeInput.value, 10) || 2);
    }
    if (wrapToggle) {
      preferencesService.set('editor.wordWrap', wrapToggle.checked);
    }

    const lineHeightInput = this.overlay.querySelector('#setting-line-height') as HTMLInputElement;
    if (lineHeightInput) {
      const lh = parseFloat(lineHeightInput.value) || 1.5;
      preferencesService.set('editor.lineHeight', lh);
      document.documentElement.style.setProperty('--editor-line-height', String(lh));
    }

    const lineNumbersToggle = this.overlay.querySelector('#setting-line-numbers') as HTMLInputElement;
    if (lineNumbersToggle) {
      preferencesService.set('editor.lineNumbers', lineNumbersToggle.checked);
    }

    const indentGuidesToggle = this.overlay.querySelector('#setting-indent-guides') as HTMLInputElement;
    if (indentGuidesToggle) {
      preferencesService.set('editor.renderIndentGuides', indentGuidesToggle.checked);
    }

    const minimapToggle = this.overlay.querySelector('#setting-minimap') as HTMLInputElement;
    if (minimapToggle) {
      preferencesService.set('editor.minimap.enabled', minimapToggle.checked);
    }

    const overviewRulerToggle = this.overlay.querySelector('#setting-overview-ruler') as HTMLInputElement;
    if (overviewRulerToggle) {
      preferencesService.set('editor.overviewRuler.enabled', overviewRulerToggle.checked);
    }

    const gitGutterToggle = this.overlay.querySelector('#setting-git-gutter') as HTMLInputElement;
    if (gitGutterToggle) {
      preferencesService.set('editor.gitGutter.enabled', gitGutterToggle.checked);
    }

    const gitBlameToggle = this.overlay.querySelector('#setting-git-blame') as HTMLInputElement;
    if (gitBlameToggle) {
      preferencesService.set('editor.gitBlame.enabled', gitBlameToggle.checked);
    }

    const completeFunctionCallsToggle = this.overlay.querySelector('#setting-complete-function-calls') as HTMLInputElement;
    if (completeFunctionCallsToggle) {
      preferencesService.set('editor.suggest.completeFunctionCalls', completeFunctionCallsToggle.checked);
    }

    const formatOnSaveToggle = this.overlay.querySelector('#setting-format-on-save') as HTMLInputElement;
    if (formatOnSaveToggle) {
      preferencesService.set('editor.formatOnSave', formatOnSaveToggle.checked);
    }

    const insertSpacesSelect = this.overlay.querySelector('#setting-insert-spaces') as HTMLSelectElement;
    if (insertSpacesSelect) {
      preferencesService.set('editor.insertSpaces', insertSpacesSelect.value === 'true');
    }

    const trimWhitespaceToggle = this.overlay.querySelector('#setting-trim-whitespace') as HTMLInputElement;
    if (trimWhitespaceToggle) {
      preferencesService.set('editor.trimTrailingWhitespace', trimWhitespaceToggle.checked);
    }

    const finalNewlineToggle = this.overlay.querySelector('#setting-final-newline') as HTMLInputElement;
    if (finalNewlineToggle) {
      preferencesService.set('editor.insertFinalNewline', finalNewlineToggle.checked);
    }

    const termSizeInput = this.overlay.querySelector('#setting-terminal-font-size') as HTMLInputElement;
    if (termSizeInput) {
      const termSize = parseInt(termSizeInput.value, 10) || 13;
      preferencesService.set('terminal.fontSize', termSize);
      document.documentElement.style.setProperty('--terminal-font-size', `${termSize}px`);
    }

    const termFontInput = this.overlay.querySelector('#setting-terminal-font-family') as HTMLInputElement;
    if (termFontInput) {
      const termFont = termFontInput.value.trim() || '"Cascadia Code", "Fira Code", "JetBrains Mono", Consolas, monospace';
      preferencesService.set('terminal.fontFamily', termFont);
      document.documentElement.style.setProperty('--terminal-font-family', termFont);
    }

    // Save Auto Save
    preferencesService.set('files.autoSave', autoSaveToggle.checked);
    const delayNum = parseInt(autoSaveDelayInput.value.trim(), 10) || 1000;
    preferencesService.set('files.autoSaveDelay', delayNum);

    // Save Cursor Style & Blinking
    const newCursor = (cursorSelect.value as CursorStyle) || 'line';
    preferencesService.set('editor.cursorStyle', newCursor);
    if (cursorBlinkingSelect) {
      preferencesService.set('editor.cursorBlinking', (cursorBlinkingSelect.value as any) || 'blink');
    }

    // Save Vim
    const newVim = vimToggle.checked;
    preferencesService.set('editor.vimEnabled', newVim);
    vimIntegration.setEnabled(newVim);
    if (this.onVimToggled) this.onVimToggled(newVim);

    // Save Working Theme
    if (this.workingTheme) {
      if (themeManager.isCustomTheme(this.workingTheme.id)) {
        themeManager.saveCustomTheme(this.workingTheme);
      } else {
        themeManager.applyTheme(this.workingTheme.id, true);
      }
    } else if (themeSelect?.value) {
      themeManager.applyTheme(themeSelect.value, true);
    }

    // Save Typography
    const fontFamily = fontInput.value.trim() || '"Cascadia Code", "Fira Code", "JetBrains Mono", Consolas, monospace';
    const fontSizeNum = parseInt(sizeInput.value.trim(), 10) || 14;
    preferencesService.set('editor.fontFamily', fontFamily);
    preferencesService.set('editor.fontSize', fontSizeNum);

    document.documentElement.style.setProperty('--editor-font-family', fontFamily);
    document.documentElement.style.setProperty('--editor-font-size', `${fontSizeNum}px`);

    // Save Custom CSS
    themeManager.applyCustomCss(cssText.value);

    // Save Icon Theme
    const iconSelect = this.overlay.querySelector('#setting-icon-theme-select') as HTMLSelectElement;
    if (iconSelect) {
      const selectedTheme = (iconSelect.value as IconTheme) || 'lucide';
      preferencesService.set('workbench.iconTheme', selectedTheme);
      try {
        localStorage.setItem('gitero_icon_theme', selectedTheme);
      } catch {}
    }
    const customTextarea = this.overlay.querySelector('#setting-custom-icon-json') as HTMLTextAreaElement;
    if (customTextarea && customTextarea.value.trim()) {
      preferencesService.set('workbench.customIconPackage', customTextarea.value.trim());
    }

    // Save GitHub Token for private repository updates
    const tokenInput = this.overlay.querySelector('#setting-github-token') as HTMLInputElement;
    if (tokenInput) {
      const val = tokenInput.value.trim();
      preferencesService.set('updater.githubToken', val);
      try {
        localStorage.setItem('gitero_github_token', val);
      } catch {}
    }

    // Save Window Border Radius
    const radiusInput = this.overlay.querySelector('#setting-window-border-radius') as HTMLInputElement;
    if (radiusInput) {
      preferencesService.set('workbench.windowBorderRadius', parseInt(radiusInput.value, 10) || 0);
    }

    this.close();
  }

  private activeTransparencyCategory: string = 'all';

  private setupTransparencyStudioListeners() {
    const enableToggle = this.overlay.querySelector('#setting-transparency-enable-toggle') as HTMLInputElement;
    const masterBgSlider = this.overlay.querySelector('#setting-master-bg-opacity') as HTMLInputElement;
    const masterAtmosphereSlider = this.overlay.querySelector('#setting-master-atmosphere') as HTMLInputElement;
    const masterTextSlider = this.overlay.querySelector('#setting-master-text-opacity') as HTMLInputElement;
    const masterBlurSlider = this.overlay.querySelector('#setting-master-blur') as HTMLInputElement;
    const categoryTabs = this.overlay.querySelectorAll('#transparency-category-tabs .transparency-tab-btn');
    const presetBtns = this.overlay.querySelectorAll('#transparency-presets-container .preset-chip-btn');
    const moodBtns = this.overlay.querySelectorAll('#transparency-mood-container .preset-chip-btn');

    // Toggle Transparency
    enableToggle?.addEventListener('change', () => {
      preferencesService.set('transparency.enabled', enableToggle.checked);
      this.refreshTransparencyStudioUi();
    });

    // Master Sliders
    masterBgSlider?.addEventListener('input', () => {
      const val = parseInt(masterBgSlider.value, 10) || 100;
      const label = this.overlay.querySelector('#val-master-bg');
      if (label) label.textContent = `${val}%`;
      preferencesService.set('transparency.master.bgOpacity', val);
      this.updateAllSectionChips();
    });

    masterAtmosphereSlider?.addEventListener('input', () => {
      const val = parseInt(masterAtmosphereSlider.value, 10) || 0;
      const label = this.overlay.querySelector('#val-master-atmosphere');
      if (label) label.textContent = `${val}%`;
      preferencesService.set('transparency.atmosphereIntensity', val);
    });

    masterTextSlider?.addEventListener('input', () => {
      const val = parseInt(masterTextSlider.value, 10) || 100;
      const label = this.overlay.querySelector('#val-master-text');
      if (label) label.textContent = `${val}%`;
      preferencesService.set('transparency.master.textOpacity', val);
      this.updateAllSectionChips();
    });

    masterBlurSlider?.addEventListener('input', () => {
      const val = parseInt(masterBlurSlider.value, 10) || 0;
      const label = this.overlay.querySelector('#val-master-blur');
      if (label) label.textContent = `${val}px`;
      preferencesService.set('transparency.blur', val);
    });

    // Presets
    presetBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const presetId = btn.getAttribute('data-preset');
        if (presetId) {
          transparencyService.applyPreset(presetId);
          this.refreshTransparencyStudioUi();
        }
      });
    });

    // Mood Engine Chips
    moodBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const mood = btn.getAttribute('data-mood') as any;
        if (mood) {
          preferencesService.set('transparency.atmosphereMood', mood);
          this.refreshTransparencyStudioUi();
        }
      });
    });

    // Category Tabs
    categoryTabs.forEach(btn => {
      btn.addEventListener('click', () => {
        categoryTabs.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeTransparencyCategory = btn.getAttribute('data-cat') || 'all';
        this.filterTransparencySections();
      });
    });

    this.renderTransparencySections();
  }

  private renderTransparencySections() {
    const container = this.overlay.querySelector('#transparency-sections-grid') as HTMLElement;
    if (!container) return;

    container.innerHTML = '';

    TRANSPARENCY_SECTIONS.forEach(sec => {
      const card = document.createElement('div');
      card.className = 'transparency-section-card';
      card.setAttribute('data-category', sec.category);
      card.setAttribute('data-section-id', sec.id);

      const bgVal = (preferencesService.get(sec.bgPrefKey) as number) ?? sec.defaultBg;
      const textVal = (preferencesService.get(sec.textPrefKey) as number) ?? sec.defaultText;

      card.innerHTML = `
        <div class="transparency-card-top">
          <div class="transparency-card-title-group">
            <span class="transparency-card-title">${sec.name}</span>
            <span class="transparency-card-category-badge">${sec.category}</span>
          </div>
          <button type="button" class="transparency-reset-btn" title="Reset ${sec.name} to default opacity">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
              <path d="M3 3v5h5"/>
            </svg>
          </button>
        </div>
        <div class="transparency-card-desc">${sec.description}</div>
        <div class="transparency-card-controls">
          <div class="transparency-slider-group">
            <div class="transparency-slider-header">
              <span>Surface (Background)</span>
              <span class="transparency-slider-val sec-bg-val">${bgVal}%</span>
            </div>
            <input type="range" class="transparency-range-input sec-bg-input" min="0" max="100" step="1" value="${bgVal}" />
          </div>

          <div class="transparency-slider-group">
            <div class="transparency-slider-header">
              <span>Text (Foreground)</span>
              <span class="transparency-slider-val sec-text-val">${textVal}%</span>
            </div>
            <input type="range" class="transparency-range-input sec-text-input" min="30" max="100" step="1" value="${textVal}" />
          </div>

          <div class="transparency-preview-chip" title="Live surface & text contrast preview">
            <div class="transparency-preview-chip-inner">Aa Code</div>
          </div>
        </div>
      `;

      // Wire inputs
      const bgInput = card.querySelector('.sec-bg-input') as HTMLInputElement;
      const textInput = card.querySelector('.sec-text-input') as HTMLInputElement;
      const bgLabel = card.querySelector('.sec-bg-val') as HTMLElement;
      const textLabel = card.querySelector('.sec-text-val') as HTMLElement;
      const chipInner = card.querySelector('.transparency-preview-chip-inner') as HTMLElement;
      const resetBtn = card.querySelector('.transparency-reset-btn') as HTMLButtonElement;

      const updateChip = () => {
        const curBg = parseInt(bgInput.value, 10) || 0;
        const curText = parseInt(textInput.value, 10) || 30;
        const masterBg = (preferencesService.get('transparency.master.bgOpacity') ?? 100) / 100;
        const masterText = (preferencesService.get('transparency.master.textOpacity') ?? 100) / 100;
        const effBg = Math.round((curBg / 100) * masterBg * 100);
        const effText = Math.max(30, Math.round((curText / 100) * masterText * 100));

        let bgVar = 'var(--bg-secondary)';
        let fgVar = 'var(--fg-primary)';
        if (sec.id === 'sidebar') {
          bgVar = 'var(--bg-sidebar)';
        } else if (sec.id === 'editor') {
          bgVar = 'var(--editor-bg)';
          fgVar = 'var(--editor-fg)';
        } else if (sec.id === 'statusBar') {
          bgVar = 'var(--status-bg)';
          fgVar = 'var(--status-fg)';
        } else if (sec.id === 'activityBar') {
          bgVar = 'var(--bg-activity)';
        } else if (sec.id === 'tabBar') {
          bgVar = 'var(--tab-inactive-bg)';
        }

        chipInner.style.backgroundColor = `color-mix(in srgb, ${bgVar} ${effBg}%, transparent)`;
        chipInner.style.color = `color-mix(in srgb, ${fgVar} ${effText}%, transparent)`;
      };

      updateChip();

      bgInput.addEventListener('input', () => {
        const val = parseInt(bgInput.value, 10) || 0;
        bgLabel.textContent = `${val}%`;
        preferencesService.set(sec.bgPrefKey, val);
        updateChip();
      });

      textInput.addEventListener('input', () => {
        const val = parseInt(textInput.value, 10) || 30;
        textLabel.textContent = `${val}%`;
        preferencesService.set(sec.textPrefKey, val);
        updateChip();
      });

      resetBtn.addEventListener('click', () => {
        transparencyService.resetSection(sec.id);
        bgInput.value = String(sec.defaultBg);
        textInput.value = String(sec.defaultText);
        bgLabel.textContent = `${sec.defaultBg}%`;
        textLabel.textContent = `${sec.defaultText}%`;
        updateChip();
      });

      container.appendChild(card);
    });

    this.filterTransparencySections();
  }

  private filterTransparencySections() {
    const cards = this.overlay.querySelectorAll('.transparency-section-card');
    cards.forEach(c => {
      const el = c as HTMLElement;
      const cat = el.getAttribute('data-category');
      if (this.activeTransparencyCategory === 'all' || cat === this.activeTransparencyCategory) {
        el.style.display = 'flex';
      } else {
        el.style.display = 'none';
      }
    });
  }

  private updateAllSectionChips() {
    const cards = this.overlay.querySelectorAll('.transparency-section-card');
    cards.forEach(c => {
      const el = c as HTMLElement;
      const secId = el.getAttribute('data-section-id');
      const meta = TRANSPARENCY_SECTIONS.find(s => s.id === secId);
      if (!meta) return;

      const bgInput = el.querySelector('.sec-bg-input') as HTMLInputElement;
      const textInput = el.querySelector('.sec-text-input') as HTMLInputElement;
      const chipInner = el.querySelector('.transparency-preview-chip-inner') as HTMLElement;
      if (!bgInput || !textInput || !chipInner) return;

      const curBg = parseInt(bgInput.value, 10) || 0;
      const curText = parseInt(textInput.value, 10) || 30;
      const masterBg = (preferencesService.get('transparency.master.bgOpacity') ?? 100) / 100;
      const masterText = (preferencesService.get('transparency.master.textOpacity') ?? 100) / 100;
      const effBg = Math.round((curBg / 100) * masterBg * 100);
      const effText = Math.max(30, Math.round((curText / 100) * masterText * 100));

      let bgVar = 'var(--bg-secondary)';
      let fgVar = 'var(--fg-primary)';
      if (meta.id === 'sidebar') bgVar = 'var(--bg-sidebar)';
      else if (meta.id === 'editor') { bgVar = 'var(--editor-bg)'; fgVar = 'var(--editor-fg)'; }
      else if (meta.id === 'statusBar') { bgVar = 'var(--status-bg)'; fgVar = 'var(--status-fg)'; }
      else if (meta.id === 'activityBar') bgVar = 'var(--bg-activity)';
      else if (meta.id === 'tabBar') bgVar = 'var(--tab-inactive-bg)';

      chipInner.style.backgroundColor = `color-mix(in srgb, ${bgVar} ${effBg}%, transparent)`;
      chipInner.style.color = `color-mix(in srgb, ${fgVar} ${effText}%, transparent)`;
    });
  }

  private refreshTransparencyStudioUi() {
    const enabled = preferencesService.get('transparency.enabled');
    const blur = preferencesService.get('transparency.blur') ?? 14;
    const masterBg = preferencesService.get('transparency.master.bgOpacity') ?? 100;
    const masterText = preferencesService.get('transparency.master.textOpacity') ?? 100;
    const atmosphereMood = preferencesService.get('transparency.atmosphereMood') ?? 'deep-space';
    const atmosphereIntensity = preferencesService.get('transparency.atmosphereIntensity') ?? 65;

    const enableToggle = this.overlay.querySelector('#setting-transparency-enable-toggle') as HTMLInputElement;
    if (enableToggle) enableToggle.checked = enabled;

    const masterBgSlider = this.overlay.querySelector('#setting-master-bg-opacity') as HTMLInputElement;
    if (masterBgSlider) masterBgSlider.value = String(masterBg);
    const valMasterBg = this.overlay.querySelector('#val-master-bg');
    if (valMasterBg) valMasterBg.textContent = `${masterBg}%`;

    const masterAtmosphereSlider = this.overlay.querySelector('#setting-master-atmosphere') as HTMLInputElement;
    if (masterAtmosphereSlider) masterAtmosphereSlider.value = String(atmosphereIntensity);
    const valMasterAtmosphere = this.overlay.querySelector('#val-master-atmosphere');
    if (valMasterAtmosphere) valMasterAtmosphere.textContent = `${atmosphereIntensity}%`;

    const masterTextSlider = this.overlay.querySelector('#setting-master-text-opacity') as HTMLInputElement;
    if (masterTextSlider) masterTextSlider.value = String(masterText);
    const valMasterText = this.overlay.querySelector('#val-master-text');
    if (valMasterText) valMasterText.textContent = `${masterText}%`;

    const masterBlurSlider = this.overlay.querySelector('#setting-master-blur') as HTMLInputElement;
    if (masterBlurSlider) masterBlurSlider.value = String(blur);
    const valMasterBlur = this.overlay.querySelector('#val-master-blur');
    if (valMasterBlur) valMasterBlur.textContent = `${blur}px`;

    // Refresh active preset chip button highlight
    const presetBtns = this.overlay.querySelectorAll('#transparency-presets-container .preset-chip-btn');
    presetBtns.forEach(btn => {
      const pId = btn.getAttribute('data-preset');
      const preset = TRANSPARENCY_PRESETS.find(p => p.id === pId);
      if (preset) {
        const matches = (
          (pId === 'solid' && !enabled) ||
          (enabled &&
           masterBg === preset.masterBg &&
           masterText === preset.masterText &&
           blur === preset.blur)
        );
        btn.classList.toggle('active', !!matches);
      }
    });

    // Refresh active atmosphere mood button highlight
    const moodBtns = this.overlay.querySelectorAll('#transparency-mood-container .preset-chip-btn');
    moodBtns.forEach(btn => {
      const m = btn.getAttribute('data-mood');
      btn.classList.toggle('active', m === atmosphereMood);
    });

    // Refresh Section Card Sliders
    const cards = this.overlay.querySelectorAll('.transparency-section-card');
    cards.forEach(c => {
      const el = c as HTMLElement;
      const secId = el.getAttribute('data-section-id');
      const meta = TRANSPARENCY_SECTIONS.find(s => s.id === secId);
      if (!meta) return;

      const bgVal = (preferencesService.get(meta.bgPrefKey) as number) ?? meta.defaultBg;
      const textVal = (preferencesService.get(meta.textPrefKey) as number) ?? meta.defaultText;

      const bgInput = el.querySelector('.sec-bg-input') as HTMLInputElement;
      const textInput = el.querySelector('.sec-text-input') as HTMLInputElement;
      const bgLabel = el.querySelector('.sec-bg-val') as HTMLElement;
      const textLabel = el.querySelector('.sec-text-val') as HTMLElement;

      if (bgInput) bgInput.value = String(bgVal);
      if (textInput) textInput.value = String(textVal);
      if (bgLabel) bgLabel.textContent = `${bgVal}%`;
      if (textLabel) textLabel.textContent = `${textVal}%`;
    });

    this.updateAllSectionChips();
    this.updateBorderRadiusControlState();
  }

  openWithAddServer(prefilledExt?: string, prefilledName?: string): void {
    this.open('lsp');
    this.showAddServerForm(prefilledExt, prefilledName);
  }

  showAddServerForm(prefilledExt?: string, prefilledName?: string, existingConfig?: ServerConfig): void {
    const form = this.overlay.querySelector('#add-lsp-server-form-card') as HTMLElement;
    if (!form) return;
    form.style.display = 'block';

    const title = form.querySelector('#lsp-form-title') as HTMLElement;
    const idInput = form.querySelector('#lsp-form-server-id') as HTMLInputElement;
    const nameInput = form.querySelector('#lsp-form-name') as HTMLInputElement;
    const langInput = form.querySelector('#lsp-form-languages') as HTMLInputElement;
    const cmdInput = form.querySelector('#lsp-form-command') as HTMLInputElement;
    const argsInput = form.querySelector('#lsp-form-args') as HTMLInputElement;
    const guideInput = form.querySelector('#lsp-form-guide') as HTMLInputElement;

    if (existingConfig) {
      if (title) title.textContent = 'Edit Custom Language Server';
      if (idInput) idInput.value = existingConfig.id;
      if (nameInput) nameInput.value = existingConfig.name || '';
      if (langInput) langInput.value = (existingConfig.languages || []).join(', ');
      if (cmdInput) cmdInput.value = existingConfig.defaultCommand || '';
      if (argsInput) argsInput.value = (existingConfig.defaultArgs || []).join(' ');
      if (guideInput) guideInput.value = existingConfig.installGuide || '';
    } else {
      if (title) title.textContent = 'Add Custom Language Server';
      if (idInput) idInput.value = '';
      const rawExt = prefilledExt ? prefilledExt.replace(/^\./, '').trim() : '';
      const capitalized = rawExt ? rawExt.charAt(0).toUpperCase() + rawExt.slice(1) : '';
      if (nameInput) nameInput.value = prefilledName || (rawExt ? `${capitalized} Language Server` : '');
      if (langInput) langInput.value = rawExt || '';
      if (cmdInput) cmdInput.value = '';
      if (argsInput) argsInput.value = '';
      if (guideInput) guideInput.value = '';
    }

    form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    nameInput?.focus();
  }

  hideAddServerForm(): void {
    const form = this.overlay.querySelector('#add-lsp-server-form-card') as HTMLElement;
    if (form) form.style.display = 'none';
  }

  private setupLspSettingsListeners() {
    const lspEnabledInput = this.overlay.querySelector('#setting-lsp-enabled') as HTMLInputElement;
    const lspDiagnosticsInput = this.overlay.querySelector('#setting-lsp-diagnostics') as HTMLInputElement;
    const lspHoverInput = this.overlay.querySelector('#setting-lsp-hover') as HTMLInputElement;
    const refreshBtn = this.overlay.querySelector('#btn-refresh-lsp-status') as HTMLButtonElement;
    const addServerBtn = this.overlay.querySelector('#btn-add-custom-lsp') as HTMLButtonElement;
    const cancelBtn = this.overlay.querySelector('#btn-cancel-custom-lsp') as HTMLButtonElement;
    const cancelBtnBottom = this.overlay.querySelector('#btn-cancel-custom-lsp-bottom') as HTMLButtonElement;
    const saveServerBtn = this.overlay.querySelector('#btn-save-custom-lsp') as HTMLButtonElement;

    if (lspEnabledInput) {
      lspEnabledInput.checked = preferencesService.get('lsp.enabled') !== false;
      lspEnabledInput.addEventListener('change', () => {
        preferencesService.set('lsp.enabled', lspEnabledInput.checked);
      });
    }

    if (lspDiagnosticsInput) {
      lspDiagnosticsInput.checked = preferencesService.get('lsp.diagnostics') !== false;
      lspDiagnosticsInput.addEventListener('change', () => {
        preferencesService.set('lsp.diagnostics', lspDiagnosticsInput.checked);
      });
    }

    if (lspHoverInput) {
      lspHoverInput.checked = preferencesService.get('lsp.hover') !== false;
      lspHoverInput.addEventListener('change', () => {
        preferencesService.set('lsp.hover', lspHoverInput.checked);
      });
    }

    const lspSignatureHelpInput = this.overlay.querySelector('#setting-lsp-signature-help') as HTMLInputElement;
    if (lspSignatureHelpInput) {
      lspSignatureHelpInput.checked = preferencesService.get('lsp.signatureHelp.enabled') !== false;
      lspSignatureHelpInput.addEventListener('change', () => {
        preferencesService.set('lsp.signatureHelp.enabled', lspSignatureHelpInput.checked);
      });
    }

    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        refreshBtn.disabled = true;
        refreshBtn.textContent = 'Scanning...';
        lspServerRegistry.clearCache();
        await this.renderLspServersList();
        refreshBtn.disabled = false;
        refreshBtn.textContent = 'Refresh PATH';
      });
    }

    window.addEventListener('gitero:lsp-server-installed', async () => {
      await this.renderLspServersList();
    });

    window.addEventListener('gitero:lsp-install-status', async () => {
      await this.renderLspServersList();
    });

    addServerBtn?.addEventListener('click', () => {
      this.showAddServerForm();
    });

    cancelBtn?.addEventListener('click', () => {
      this.hideAddServerForm();
    });

    cancelBtnBottom?.addEventListener('click', () => {
      this.hideAddServerForm();
    });

    saveServerBtn?.addEventListener('click', async () => {
      const form = this.overlay.querySelector('#add-lsp-server-form-card') as HTMLElement;
      if (!form) return;

      const idInput = form.querySelector('#lsp-form-server-id') as HTMLInputElement;
      const nameInput = form.querySelector('#lsp-form-name') as HTMLInputElement;
      const langInput = form.querySelector('#lsp-form-languages') as HTMLInputElement;
      const cmdInput = form.querySelector('#lsp-form-command') as HTMLInputElement;
      const argsInput = form.querySelector('#lsp-form-args') as HTMLInputElement;
      const guideInput = form.querySelector('#lsp-form-guide') as HTMLInputElement;

      const name = nameInput.value.trim();
      const rawLangs = langInput.value.trim();
      const command = cmdInput.value.trim();
      const rawArgs = argsInput.value.trim();
      const installGuide = guideInput.value.trim();

      if (!name) {
        alert('Please provide a name for this language server.');
        nameInput.focus();
        return;
      }
      if (!rawLangs) {
        alert('Please specify at least one file extension (e.g. zig, zls).');
        langInput.focus();
        return;
      }
      if (!command) {
        alert('Please provide the executable command or executable path.');
        cmdInput.focus();
        return;
      }

      const languages = rawLangs
        .split(',')
        .map((l) => l.trim().replace(/^\./, '').toLowerCase())
        .filter(Boolean);

      const defaultArgs = rawArgs ? rawArgs.split(/\s+/).filter(Boolean) : [];
      const id = idInput.value.trim() || `custom-lsp-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36)}`;

      const config: ServerConfig = {
        id,
        name,
        languages,
        defaultCommand: command,
        defaultArgs,
        installGuide
      };

      lspServerRegistry.registerUserServer(config);
      this.hideAddServerForm();
      await this.renderLspServersList();
    });
  }

  private async renderLspServersList() {
    const container = this.overlay.querySelector('#lsp-servers-list');
    if (!container) return;

    container.innerHTML = '<div style="padding: 12px; font-size: 12px; color: var(--fg-muted);">Scanning system PATH for language servers...</div>';

    const customServers = (preferencesService.get('lsp.customServers') as Record<string, any>) || {};
    const userServers = lspServerRegistry.getUserServers();

    const sections: HTMLElement[] = [];

    // 1. Custom User Servers (if any)
    if (userServers.length > 0) {
      const userSection = document.createElement('div');
      userSection.className = 'lsp-servers-group';
      userSection.innerHTML = `
        <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--accent-color, #58a6ff); margin-bottom: 8px;">
          Custom Configured Servers (${userServers.length})
        </div>
      `;

      for (const server of userServers) {
        const isInstalled = await lspServerRegistry.isServerInstalled(server);
        const card = document.createElement('div');
        card.className = 'lsp-server-card custom-lsp-card';
        card.innerHTML = `
          <div class="lsp-server-header">
            <div class="lsp-server-title-group">
              <span class="lsp-server-name">${server.name}</span>
              <span class="lsp-server-languages">${server.languages.map((l: string) => '.' + l).join(', ')}</span>
              <span class="lsp-server-custom-badge" style="font-size: 10px; background: rgba(88, 166, 255, 0.15); color: var(--accent-color, #58a6ff); padding: 2px 6px; border-radius: 3px; font-weight: 600;">Custom</span>
            </div>
            <div class="lsp-server-status-group" style="gap: 8px;">
              <span class="lsp-status-badge ${isInstalled ? 'installed' : 'not-found'}">
                <span class="status-dot"></span>
                ${isInstalled ? 'Available' : 'Command Not Found'}
              </span>
              <button class="btn btn-secondary btn-sm btn-edit-user-server" data-server-id="${server.id}" title="Edit server configuration">Edit</button>
              <button class="btn btn-secondary btn-sm btn-delete-user-server" data-server-id="${server.id}" style="color: #f85149;" title="Delete custom server">Delete</button>
            </div>
          </div>

          <div class="lsp-server-details">
            <div style="font-size: 11px; color: var(--fg-muted);">
              Command: <code style="background: rgba(255,255,255,0.06); padding: 2px 6px; border-radius: 4px; font-family: var(--font-mono, monospace);">${server.defaultCommand} ${server.defaultArgs.join(' ')}</code>
            </div>
            ${server.installGuide ? `
              <div style="font-size: 11px; color: var(--fg-muted); margin-top: 6px;">
                Documentation: <a href="${server.installGuide}" target="_blank" style="color: var(--accent-color, #58a6ff); text-decoration: none;">${server.installGuide}</a>
              </div>
            ` : ''}
          </div>
        `;

        card.querySelector('.btn-edit-user-server')?.addEventListener('click', () => {
          this.showAddServerForm(undefined, undefined, server);
        });

        card.querySelector('.btn-delete-user-server')?.addEventListener('click', async () => {
          if (confirm(`Remove custom language server "${server.name}"?`)) {
            lspServerRegistry.deleteUserServer(server.id);
            await this.renderLspServersList();
          }
        });

        userSection.appendChild(card);
      }
      sections.push(userSection);
    }

    // 2. Built-in Standard Servers
    const standardSection = document.createElement('div');
    standardSection.className = 'lsp-servers-group';
    standardSection.style.marginTop = userServers.length > 0 ? '16px' : '0';
    standardSection.innerHTML = `
      <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--fg-muted); margin-bottom: 8px;">
        Standard Pre-configured Servers (${DEFAULT_SERVERS.length})
      </div>
    `;

    for (const server of DEFAULT_SERVERS) {
      const isInstalled = await lspServerRegistry.isServerInstalled(server);
      const isInstalling = lspInstaller.isInstalling(server.id);
      const userConfig = customServers[server.id] || {};
      const isEnabled = userConfig.enabled !== false;
      const customCmd = userConfig.command || '';

      const card = document.createElement('div');
      card.className = 'lsp-server-card';
      card.innerHTML = `
        <div class="lsp-server-header">
          <div class="lsp-server-title-group">
            <span class="lsp-server-name">${server.name}</span>
            <span class="lsp-server-languages">${server.languages.map((l: string) => '.' + l).join(', ')}</span>
          </div>
          <div class="lsp-server-status-group">
            <span class="lsp-status-badge ${isInstalled ? 'installed' : 'not-found'}">
              <span class="status-dot"></span>
              ${isInstalled ? 'Installed on PATH' : 'Not Found in PATH'}
            </span>
            <label class="setting-toggle" style="margin-left: 12px;">
              <input type="checkbox" class="server-enable-toggle" data-server-id="${server.id}" ${isEnabled ? 'checked' : ''} />
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>

        <div class="lsp-server-details">
          <div class="lsp-server-field">
            <label style="font-size: 11px; color: var(--fg-muted); display: block; margin-bottom: 4px;">Executable Command / Path:</label>
            <div style="display: flex; gap: 8px;">
              <input type="text" class="setting-input server-cmd-input" data-server-id="${server.id}"
                placeholder="${server.defaultCommand} ${server.defaultArgs.join(' ')}"
                value="${customCmd}" style="flex: 1; font-family: var(--font-mono, monospace); font-size: 11px;" />
              <button class="btn btn-secondary btn-sm server-cmd-save-btn" data-server-id="${server.id}">Save</button>
            </div>
          </div>
          ${server.id === 'typescript' ? `
            <div class="lsp-server-field" style="margin-top: 8px;">
              <label style="font-size: 11px; color: var(--fg-muted); display: block; margin-bottom: 4px;">Custom TypeScript tsserver.js Path (Optional override):</label>
              <div style="display: flex; gap: 8px;">
                <input type="text" class="setting-input server-tsserver-input"
                  placeholder="Auto-detected from workspace, node_modules, or global packages"
                  value="${(preferencesService.get('lsp.typescript.tsserverPath') as string) || ''}" style="flex: 1; font-family: var(--font-mono, monospace); font-size: 11px;" />
                <button class="btn btn-secondary btn-sm server-tsserver-save-btn">Save</button>
              </div>
            </div>
          ` : ''}

          <div class="lsp-server-install-row" style="margin-top: 8px; display: flex; align-items: center; justify-content: space-between; font-size: 11px;">
            <div style="display: flex; align-items: center; gap: 6px; overflow: hidden;">
              <span style="color: var(--fg-muted); white-space: nowrap;">Install guide:</span>
              <code style="background: rgba(255,255,255,0.06); padding: 2px 6px; border-radius: 4px; font-family: var(--font-mono, monospace); white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">${server.installGuide}</code>
            </div>
            <div style="display: flex; align-items: center; gap: 6px; margin-left: 8px; flex-shrink: 0;">
              ${!isInstalled && server.installCommand ? `
                <button class="btn btn-primary btn-sm install-server-btn" data-server-id="${server.id}" ${isInstalling ? 'disabled' : ''} style="white-space: nowrap;">
                  ${isInstalling ? 'Installing...' : 'Install'}
                </button>
              ` : ''}
              <button class="btn btn-secondary btn-sm copy-install-btn" data-cmd="${server.installGuide}" style="white-space: nowrap;">Copy</button>
            </div>
          </div>
        </div>
      `;

      // Wire install button
      const installBtn = card.querySelector('.install-server-btn') as HTMLButtonElement;
      installBtn?.addEventListener('click', async () => {
        installBtn.disabled = true;
        installBtn.textContent = 'Installing...';
        await lspInstaller.installServer(server);
      });

      // Wire enable toggle
      const enableToggle = card.querySelector('.server-enable-toggle') as HTMLInputElement;
      enableToggle?.addEventListener('change', () => {
        const current = (preferencesService.get('lsp.customServers') as Record<string, any>) || {};
        preferencesService.set('lsp.customServers', {
          ...current,
          [server.id]: {
            ...current[server.id],
            enabled: enableToggle.checked
          }
        });
      });

      // Wire save button
      const saveBtn = card.querySelector('.server-cmd-save-btn') as HTMLButtonElement;
      const cmdInput = card.querySelector('.server-cmd-input') as HTMLInputElement;
      saveBtn?.addEventListener('click', () => {
        const current = (preferencesService.get('lsp.customServers') as Record<string, any>) || {};
        preferencesService.set('lsp.customServers', {
          ...current,
          [server.id]: {
            ...current[server.id],
            command: cmdInput.value.trim()
          }
        });
        saveBtn.textContent = 'Saved!';
        setTimeout(() => { saveBtn.textContent = 'Save'; }, 1500);
      });

      // Wire tsserver path save button (if typescript server)
      const tsSaveBtn = card.querySelector('.server-tsserver-save-btn') as HTMLButtonElement;
      const tsInput = card.querySelector('.server-tsserver-input') as HTMLInputElement;
      tsSaveBtn?.addEventListener('click', () => {
        preferencesService.set('lsp.typescript.tsserverPath', tsInput.value.trim());
        tsSaveBtn.textContent = 'Saved!';
        setTimeout(() => { tsSaveBtn.textContent = 'Save'; }, 1500);
      });

      // Wire copy button
      const copyBtn = card.querySelector('.copy-install-btn') as HTMLButtonElement;
      copyBtn?.addEventListener('click', async () => {
        const cmd = copyBtn.getAttribute('data-cmd');
        if (cmd) {
          try {
            await navigator.clipboard.writeText(cmd);
            copyBtn.textContent = 'Copied!';
            setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1500);
          } catch {
            copyBtn.textContent = 'Copied!';
          }
        }
      });

      standardSection.appendChild(card);
    }
    sections.push(standardSection);

    container.innerHTML = '';
    for (const sec of sections) {
      container.appendChild(sec);
    }

    // 3. Render Muted Prompts list
    this.renderMutedPrompts();
  }

  private renderMutedPrompts() {
    const mutedSection = this.overlay.querySelector('#lsp-muted-prompts-section') as HTMLElement;
    const chipsContainer = this.overlay.querySelector('#lsp-muted-chips-container') as HTMLElement;
    if (!mutedSection || !chipsContainer) return;

    const muted = (preferencesService.get('lsp.mutedPrompts') as string[]) || [];
    if (muted.length === 0) {
      mutedSection.style.display = 'none';
      chipsContainer.innerHTML = '';
      return;
    }

    mutedSection.style.display = 'block';
    chipsContainer.innerHTML = '';

    for (const ext of muted) {
      const chip = document.createElement('div');
      chip.className = 'lsp-muted-chip';
      chip.style.display = 'inline-flex';
      chip.style.alignItems = 'center';
      chip.style.gap = '6px';
      chip.style.padding = '3px 8px';
      chip.style.background = 'rgba(255, 255, 255, 0.06)';
      chip.style.border = '1px solid var(--border-color, #30363d)';
      chip.style.borderRadius = '4px';
      chip.style.fontSize = '11px';
      chip.style.color = 'var(--fg-primary)';

      chip.innerHTML = `
        <span>.${ext}</span>
        <button type="button" class="btn-unmute-chip" data-ext="${ext}" style="background: none; border: none; color: var(--fg-muted); cursor: pointer; padding: 0 2px; font-size: 13px; line-height: 1;">×</button>
      `;

      chip.querySelector('.btn-unmute-chip')?.addEventListener('click', () => {
        unmuteLanguagePrompt(ext);
        this.renderMutedPrompts();
      });

      chipsContainer.appendChild(chip);
    }
  }
}
