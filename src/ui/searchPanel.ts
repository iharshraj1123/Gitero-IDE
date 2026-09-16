import { fsService } from '../services/fs';
import { editorState } from '../state/editorState';
import { editorManager } from '../editor/editor';
import { getFileIconSvg, getFolderChevronSvg } from './icons';

export interface SearchMatchItem {
  file: string;
  line: number;
  text: string;
}

export interface SearchGroup {
  file: string;
  relativePath: string;
  matches: SearchMatchItem[];
  isOpen: boolean;
}

export class SearchPanelComponent {
  private container: HTMLElement;
  private isCaseSensitive: boolean = false;
  private isWholeWord: boolean = false;
  private isRegex: boolean = false;
  private isReplaceOpen: boolean = false;
  private groups: SearchGroup[] = [];
  private isSearching: boolean = false;

  private searchInput!: HTMLInputElement;
  private replaceInput!: HTMLInputElement;
  private resultsContainer!: HTMLElement;
  private statusContainer!: HTMLElement;
  private replaceRow!: HTMLElement;
  private toggleReplaceBtn!: HTMLButtonElement;

  constructor(container: HTMLElement) {
    this.container = container;
    this.build();
  }

  private build() {
    this.container.innerHTML = `
      <div class="sidebar-header">
        <span>SEARCH</span>
        <div class="sidebar-actions">
          <button class="sidebar-action-btn" id="btn-search-refresh" title="Refresh Search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/></svg>
          </button>
          <button class="sidebar-action-btn" id="btn-search-collapse" title="Collapse All">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 14h6v6"/><path d="M20 10h-6V4"/><path d="m14 10 7-7"/><path d="m3 21 7-7"/></svg>
          </button>
          <button class="sidebar-action-btn" id="btn-search-clear" title="Clear Search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>
      </div>

      <div class="search-panel-body">
        <div class="search-inputs-box">
          <div class="search-input-row">
            <button class="btn-toggle-replace" id="btn-toggle-replace" title="Toggle Replace">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>
            </button>
            <div class="search-input-wrapper">
              <input type="text" class="search-field" id="search-query-input" placeholder="Search (Press Enter to search)" spellcheck="false" />
              <div class="search-modifiers">
                <button class="mod-btn" id="btn-mod-case" title="Match Case (Alt+C)">Aa</button>
                <button class="mod-btn" id="btn-mod-word" title="Match Whole Word (Alt+W)">\\b</button>
                <button class="mod-btn" id="btn-mod-regex" title="Use Regular Expression (Alt+R)">.*</button>
              </div>
            </div>
          </div>

          <div class="search-input-row replace-row" id="replace-input-row" style="display: none;">
            <div class="replace-indent-spacer"></div>
            <div class="search-input-wrapper">
              <input type="text" class="search-field" id="search-replace-input" placeholder="Replace" spellcheck="false" />
              <div class="search-modifiers">
                <button class="mod-btn btn-replace-action" id="btn-replace-all" title="Replace All in Workspace">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m3 7 3 3 3-3"/><path d="M6 10V4a2 2 0 0 1 2-2h8"/><path d="m21 17-3-3-3 3"/><path d="M18 14v6a2 2 0 0 1-2 2H8"/></svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="search-status-bar" id="search-status">Type a query to search across workspace files.</div>

        <div class="search-results-list" id="search-results-list"></div>
      </div>
    `;

    this.searchInput = this.container.querySelector('#search-query-input') as HTMLInputElement;
    this.replaceInput = this.container.querySelector('#search-replace-input') as HTMLInputElement;
    this.resultsContainer = this.container.querySelector('#search-results-list') as HTMLElement;
    this.statusContainer = this.container.querySelector('#search-status') as HTMLElement;
    this.replaceRow = this.container.querySelector('#replace-input-row') as HTMLElement;
    this.toggleReplaceBtn = this.container.querySelector('#btn-toggle-replace') as HTMLButtonElement;

    this.setupListeners();
  }

  private setupListeners() {
    this.toggleReplaceBtn.addEventListener('click', () => {
      this.isReplaceOpen = !this.isReplaceOpen;
      this.replaceRow.style.display = this.isReplaceOpen ? 'flex' : 'none';
      this.toggleReplaceBtn.classList.toggle('open', this.isReplaceOpen);
    });

    const caseBtn = this.container.querySelector('#btn-mod-case') as HTMLElement;
    caseBtn.addEventListener('click', () => {
      this.isCaseSensitive = !this.isCaseSensitive;
      caseBtn.classList.toggle('active', this.isCaseSensitive);
      if (this.searchInput.value) this.executeSearch();
    });

    const wordBtn = this.container.querySelector('#btn-mod-word') as HTMLElement;
    wordBtn.addEventListener('click', () => {
      this.isWholeWord = !this.isWholeWord;
      wordBtn.classList.toggle('active', this.isWholeWord);
      if (this.searchInput.value) this.executeSearch();
    });

    const regexBtn = this.container.querySelector('#btn-mod-regex') as HTMLElement;
    regexBtn.addEventListener('click', () => {
      this.isRegex = !this.isRegex;
      regexBtn.classList.toggle('active', this.isRegex);
      if (this.searchInput.value) this.executeSearch();
    });

    this.searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.executeSearch();
      }
    });

    this.container.querySelector('#btn-search-refresh')?.addEventListener('click', () => {
      this.executeSearch();
    });

    this.container.querySelector('#btn-search-clear')?.addEventListener('click', () => {
      this.searchInput.value = '';
      this.replaceInput.value = '';
      this.groups = [];
      this.resultsContainer.innerHTML = '';
      this.statusContainer.textContent = 'Type a query to search across workspace files.';
    });

    this.container.querySelector('#btn-search-collapse')?.addEventListener('click', () => {
      const allOpen = this.groups.some(g => g.isOpen);
      this.groups.forEach(g => (g.isOpen = !allOpen));
      this.renderResults();
    });

    this.container.querySelector('#btn-replace-all')?.addEventListener('click', () => {
      this.executeReplaceAll();
    });
  }

  focus() {
    this.searchInput?.focus();
    this.searchInput?.select();
  }

  async executeSearch() {
    const query = this.searchInput.value.trim();
    if (!query) {
      this.groups = [];
      this.resultsContainer.innerHTML = '';
      this.statusContainer.textContent = 'Please enter a search query.';
      return;
    }

    const ws = fsService.getWorkspace();
    if (!ws) {
      this.statusContainer.textContent = 'No folder currently open.';
      return;
    }

    this.isSearching = true;
    this.statusContainer.textContent = 'Searching workspace files...';
    this.resultsContainer.innerHTML = '';

    try {
      const rawMatches = await fsService.searchInFiles(ws, query, {
        isRegex: this.isRegex,
        caseSensitive: this.isCaseSensitive,
        wholeWord: this.isWholeWord
      });

      // Group matches by file
      const map = new Map<string, SearchMatchItem[]>();
      for (const m of rawMatches) {
        if (!map.has(m.file)) {
          map.set(m.file, []);
        }
        map.get(m.file)!.push(m);
      }

      this.groups = Array.from(map.entries()).map(([file, matches]) => {
        const relativePath = file.startsWith(ws) ? file.slice(ws.length).replace(/^[/\\]/, '') : file;
        return {
          file,
          relativePath,
          matches,
          isOpen: true
        };
      });

      const totalMatches = rawMatches.length;
      const totalFiles = this.groups.length;

      if (totalMatches === 0) {
        this.statusContainer.textContent = `No results found for "${query}".`;
      } else {
        this.statusContainer.textContent = `${totalMatches} result${totalMatches === 1 ? '' : 's'} in ${totalFiles} file${totalFiles === 1 ? '' : 's'}`;
      }

      this.renderResults();
    } catch (err) {
      this.statusContainer.textContent = `Search failed: ${err}`;
    } finally {
      this.isSearching = false;
    }
  }

  private renderResults() {
    this.resultsContainer.innerHTML = '';
    const query = this.searchInput.value;

    for (const group of this.groups) {
      const groupEl = document.createElement('div');
      groupEl.className = 'search-file-group';

      const header = document.createElement('div');
      header.className = 'search-file-header';

      const chevron = document.createElement('span');
      chevron.className = 'tree-chevron';
      chevron.innerHTML = getFolderChevronSvg(group.isOpen);

      const fileName = group.relativePath.split(/[/\\]/).pop() || group.relativePath;
      const dirPart = group.relativePath.substring(0, group.relativePath.length - fileName.length);

      const iconSpan = document.createElement('span');
      iconSpan.className = 'tree-icon';
      iconSpan.innerHTML = getFileIconSvg(fileName, false);

      const titleSpan = document.createElement('span');
      titleSpan.className = 'search-file-title';
      titleSpan.innerHTML = `<span class="filename-main">${fileName}</span> <span class="file-dir-sub">${dirPart}</span>`;

      const badge = document.createElement('span');
      badge.className = 'search-count-badge';
      badge.textContent = `${group.matches.length}`;

      header.appendChild(chevron);
      header.appendChild(iconSpan);
      header.appendChild(titleSpan);
      header.appendChild(badge);

      header.addEventListener('click', () => {
        group.isOpen = !group.isOpen;
        matchesList.style.display = group.isOpen ? 'block' : 'none';
        chevron.innerHTML = getFolderChevronSvg(group.isOpen);
      });

      const matchesList = document.createElement('div');
      matchesList.className = 'search-matches-container';
      matchesList.style.display = group.isOpen ? 'block' : 'none';

      for (const match of group.matches) {
        const row = document.createElement('div');
        row.className = 'search-match-row';

        const lineNum = document.createElement('span');
        lineNum.className = 'match-line-num';
        lineNum.textContent = `${match.line}:`;

        const textSpan = document.createElement('span');
        textSpan.className = 'match-line-text';
        textSpan.innerHTML = this.highlightSnippet(match.text, query);

        row.appendChild(lineNum);
        row.appendChild(textSpan);

        row.addEventListener('click', async (e) => {
          e.stopPropagation();
          try {
            const content = await fsService.readFile(match.file);
            editorState.openFile(match.file, content);
            editorManager.gotoLine(match.line, 1);
          } catch (err) {
            alert(`Could not open file: ${err}`);
          }
        });

        matchesList.appendChild(row);
      }

      groupEl.appendChild(header);
      groupEl.appendChild(matchesList);
      this.resultsContainer.appendChild(groupEl);
    }
  }

  private highlightSnippet(text: string, query: string): string {
    if (!query) return this.escapeHtml(text);
    try {
      let pattern = this.isRegex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (this.isWholeWord) pattern = `\\b${pattern}\\b`;
      const regex = new RegExp(`(${pattern})`, this.isCaseSensitive ? 'g' : 'gi');
      return this.escapeHtml(text).replace(regex, '<span class="match-highlight">$1</span>');
    } catch {
      return this.escapeHtml(text);
    }
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  async executeReplaceAll() {
    const query = this.searchInput.value.trim();
    const replacement = this.replaceInput.value;

    if (!query) {
      alert('Please specify a search query to replace.');
      return;
    }

    if (this.groups.length === 0) {
      alert('No search results to replace.');
      return;
    }

    const totalMatches = this.groups.reduce((acc, g) => acc + g.matches.length, 0);
    const confirmReplace = confirm(`Replace ${totalMatches} occurrences across ${this.groups.length} files with "${replacement}"?`);
    if (!confirmReplace) return;

    let regex: RegExp;
    try {
      let pattern = this.isRegex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (this.isWholeWord) pattern = `\\b${pattern}\\b`;
      regex = new RegExp(pattern, this.isCaseSensitive ? 'g' : 'gi');
    } catch (e) {
      alert(`Invalid search pattern: ${e}`);
      return;
    }

    let replacedCount = 0;
    for (const group of this.groups) {
      try {
        const originalContent = await fsService.readFile(group.file);
        const newContent = originalContent.replace(regex, replacement);
        if (newContent !== originalContent) {
          await fsService.writeFile(group.file, newContent);
          replacedCount++;

          // Update active tab if open
          const tabs = editorState.getTabs();
          const tab = tabs.find(t => t.path === group.file);
          if (tab) {
            editorState.markSaved(tab.id, newContent);
            if (editorState.getActiveTab()?.id === tab.id) {
              editorManager.setContent(newContent);
            }
          }
        }
      } catch (err) {
        console.error(`Failed to replace in ${group.file}:`, err);
      }
    }

    this.statusContainer.textContent = `Replaced in ${replacedCount} files.`;
    await this.executeSearch();
  }
}
