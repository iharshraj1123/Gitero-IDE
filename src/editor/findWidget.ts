import { EditorView, Panel, ViewUpdate } from '@codemirror/view';
import {
  SearchQuery,
  setSearchQuery,
  getSearchQuery,
  findNext,
  findPrevious,
  replaceNext,
  replaceAll,
  closeSearchPanel,
  openSearchPanel
} from '@codemirror/search';
import { preferencesService } from '../services/preferences';

let activeFindWidget: FindWidgetPanel | null = null;

export const openReplaceWidget = (view: EditorView): boolean => {
  openSearchPanel(view);
  setTimeout(() => {
    if (activeFindWidget) {
      activeFindWidget.expandReplace();
      activeFindWidget.focusReplace();
    }
  }, 20);
  return true;
};

export class FindWidgetPanel implements Panel {
  readonly dom: HTMLElement;
  readonly top = true;

  private toggleReplaceBtn!: HTMLButtonElement;
  private findInput!: HTMLTextAreaElement;
  private replaceInput!: HTMLTextAreaElement;
  private replaceRow!: HTMLElement;
  private counterEl!: HTMLElement;

  private caseBtn!: HTMLButtonElement;
  private wordBtn!: HTMLButtonElement;
  private regexBtn!: HTMLButtonElement;
  private selBtn!: HTMLButtonElement;

  private prevBtn!: HTMLButtonElement;
  private nextBtn!: HTMLButtonElement;
  private closeBtn!: HTMLButtonElement;
  private replaceBtn!: HTMLButtonElement;
  private replaceAllBtn!: HTMLButtonElement;

  private isReplaceExpanded = false;
  private isFindInSelection = false;
  private query: SearchQuery;

  constructor(private readonly view: EditorView) {
    const defaultQuery = getSearchQuery(view.state);
    const isCase = preferencesService.get('search.matchCase');
    const isWord = preferencesService.get('search.matchWholeWord');
    const isRegex = preferencesService.get('search.useRegex');
    this.query = new SearchQuery({
      search: defaultQuery.search,
      replace: defaultQuery.replace,
      caseSensitive: isCase,
      wholeWord: isWord,
      regexp: isRegex
    });
    this.dom = this.buildDom();
    this.bindEvents();
    this.syncFromQuery(this.query);
  }

  private buildDom(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'gitero-find-widget';
    container.setAttribute('role', 'region');
    container.setAttribute('aria-label', 'Find and Replace');

    container.innerHTML = `
      <div class="gfw-toggle-col">
        <button type="button" class="gfw-btn gfw-toggle-replace" title="Toggle Replace (Ctrl+H)" aria-label="Toggle Replace" aria-expanded="false">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>

      <div class="gfw-content-col">
        <!-- Row 1: Find -->
        <div class="gfw-row gfw-find-row">
          <div class="gfw-input-box">
            <textarea
              class="gfw-input gfw-find-input"
              main-field="true"
              placeholder="Find"
              aria-label="Find"
              spellcheck="false"
              rows="1"
            ></textarea>
            <div class="gfw-input-options">
              <button type="button" class="gfw-opt-btn gfw-opt-case" title="Match Case (Alt+C)" aria-label="Match Case">Aa</button>
              <button type="button" class="gfw-opt-btn gfw-opt-word" title="Match Whole Word (Alt+W)" aria-label="Match Whole Word">ab</button>
              <button type="button" class="gfw-opt-btn gfw-opt-regex" title="Use Regular Expression (Alt+R)" aria-label="Use Regular Expression">.*</button>
            </div>
          </div>

          <div class="gfw-matches-count" aria-live="polite"></div>

          <div class="gfw-nav-actions">
            <button type="button" class="gfw-btn gfw-prev-btn" title="Previous Match (Shift+Enter)" aria-label="Previous Match">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
            </button>
            <button type="button" class="gfw-btn gfw-next-btn" title="Next Match (Enter)" aria-label="Next Match">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>
            </button>
            <button type="button" class="gfw-btn gfw-sel-btn" title="Find in Selection (Alt+L)" aria-label="Find in Selection">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            </button>
            <button type="button" class="gfw-btn gfw-close-btn" title="Close (Escape)" aria-label="Close">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>

        <!-- Row 2: Replace -->
        <div class="gfw-row gfw-replace-row" style="display: none;">
          <div class="gfw-input-box">
            <textarea
              class="gfw-input gfw-replace-input"
              placeholder="Replace"
              aria-label="Replace"
              spellcheck="false"
              rows="1"
            ></textarea>
          </div>

          <div class="gfw-replace-actions">
            <button type="button" class="gfw-btn gfw-replace-btn" title="Replace (Enter)" aria-label="Replace">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
            </button>
            <button type="button" class="gfw-btn gfw-replace-all-btn" title="Replace All (Ctrl+Alt+Enter)" aria-label="Replace All">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/><polyline points="15 8 18 11 15 14"/></svg>
            </button>
          </div>
        </div>
      </div>
    `;

    this.toggleReplaceBtn = container.querySelector('.gfw-toggle-replace') as HTMLButtonElement;
    this.findInput = container.querySelector('.gfw-find-input') as HTMLTextAreaElement;
    this.replaceInput = container.querySelector('.gfw-replace-input') as HTMLTextAreaElement;
    this.replaceRow = container.querySelector('.gfw-replace-row') as HTMLElement;
    this.counterEl = container.querySelector('.gfw-matches-count') as HTMLElement;

    this.caseBtn = container.querySelector('.gfw-opt-case') as HTMLButtonElement;
    this.wordBtn = container.querySelector('.gfw-opt-word') as HTMLButtonElement;
    this.regexBtn = container.querySelector('.gfw-opt-regex') as HTMLButtonElement;
    this.selBtn = container.querySelector('.gfw-sel-btn') as HTMLButtonElement;

    this.prevBtn = container.querySelector('.gfw-prev-btn') as HTMLButtonElement;
    this.nextBtn = container.querySelector('.gfw-next-btn') as HTMLButtonElement;
    this.closeBtn = container.querySelector('.gfw-close-btn') as HTMLButtonElement;
    this.replaceBtn = container.querySelector('.gfw-replace-btn') as HTMLButtonElement;
    this.replaceAllBtn = container.querySelector('.gfw-replace-all-btn') as HTMLButtonElement;

    return container;
  }

  private bindEvents() {
    this.toggleReplaceBtn.addEventListener('click', () => this.toggleReplace());

    this.findInput.addEventListener('input', () => {
      // Auto-grow textarea
      this.findInput.style.height = 'auto';
      this.findInput.style.height = `${this.findInput.scrollHeight}px`;
      this.commit();
    });
    this.replaceInput.addEventListener('input', () => {
      // Auto-grow replace textarea
      this.replaceInput.style.height = 'auto';
      this.replaceInput.style.height = `${this.replaceInput.scrollHeight}px`;
      this.commit();
    });

    this.caseBtn.addEventListener('click', () => this.toggleCase());
    this.wordBtn.addEventListener('click', () => this.toggleWord());
    this.regexBtn.addEventListener('click', () => this.toggleRegex());
    this.selBtn.addEventListener('click', () => this.toggleSelection());

    this.prevBtn.addEventListener('click', () => {
      findPrevious(this.view);
      this.updateMatchCount();
    });

    this.nextBtn.addEventListener('click', () => {
      findNext(this.view);
      this.updateMatchCount();
    });

    this.closeBtn.addEventListener('click', () => {
      closeSearchPanel(this.view);
      this.view.focus();
    });

    this.replaceBtn.addEventListener('click', () => {
      replaceNext(this.view);
      this.updateMatchCount();
    });

    this.replaceAllBtn.addEventListener('click', () => {
      replaceAll(this.view);
      this.updateMatchCount();
    });

    // Keyboard handling inside find textarea
    this.findInput.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        // Plain Enter = navigate to next/prev match
        e.preventDefault();
        if (e.shiftKey) {
          findPrevious(this.view);
        } else {
          findNext(this.view);
        }
        this.updateMatchCount();
      }
      // Shift+Enter: browser inserts newline, then 'input' fires auto-grow + commit
      if (e.key === 'ArrowDown' && this.isReplaceExpanded) {
        e.preventDefault();
        this.replaceInput.focus();
        this.replaceInput.select();
      }
    });

    // Keyboard handling inside replace textarea
    this.replaceInput.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        // Plain Enter = replace; Ctrl+Alt+Enter = replace all
        e.preventDefault();
        if (e.ctrlKey && e.altKey) {
          replaceAll(this.view);
        } else {
          replaceNext(this.view);
        }
        this.updateMatchCount();
      }
      // Shift+Enter: browser inserts newline, then 'input' fires auto-grow + commit
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.findInput.focus();
        this.findInput.select();
      }
    });

    // Global widget shortcuts (Alt+C, Alt+W, Alt+R, Alt+L, Escape)
    this.dom.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        closeSearchPanel(this.view);
        this.view.focus();
      } else if (e.altKey && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        this.toggleCase();
      } else if (e.altKey && (e.key === 'w' || e.key === 'W')) {
        e.preventDefault();
        this.toggleWord();
      } else if (e.altKey && (e.key === 'r' || e.key === 'R')) {
        e.preventDefault();
        this.toggleRegex();
      } else if (e.altKey && (e.key === 'l' || e.key === 'L')) {
        e.preventDefault();
        this.toggleSelection();
      }
    });
  }

  expandReplace() {
    this.isReplaceExpanded = true;
    this.replaceRow.style.display = 'flex';
    this.toggleReplaceBtn.classList.add('is-expanded');
    this.toggleReplaceBtn.setAttribute('aria-expanded', 'true');
  }

  collapseReplace() {
    this.isReplaceExpanded = false;
    this.replaceRow.style.display = 'none';
    this.toggleReplaceBtn.classList.remove('is-expanded');
    this.toggleReplaceBtn.setAttribute('aria-expanded', 'false');
  }

  toggleReplace() {
    if (this.isReplaceExpanded) {
      this.collapseReplace();
      this.findInput.focus();
    } else {
      this.expandReplace();
      this.replaceInput.focus();
      this.replaceInput.select();
    }
  }

  focusReplace() {
    this.replaceInput.focus();
    this.replaceInput.select();
  }

  private toggleCase() {
    this.caseBtn.classList.toggle('active');
    preferencesService.set('search.matchCase', this.caseBtn.classList.contains('active'));
    this.commit();
  }

  private toggleWord() {
    this.wordBtn.classList.toggle('active');
    preferencesService.set('search.matchWholeWord', this.wordBtn.classList.contains('active'));
    this.commit();
  }

  private toggleRegex() {
    this.regexBtn.classList.toggle('active');
    preferencesService.set('search.useRegex', this.regexBtn.classList.contains('active'));
    this.commit();
  }

  private toggleSelection() {
    this.isFindInSelection = !this.isFindInSelection;
    this.selBtn.classList.toggle('active', this.isFindInSelection);
    this.commit();
  }

  private commit() {
    const isCase = this.caseBtn.classList.contains('active');
    const isWord = this.wordBtn.classList.contains('active');
    const isRegex = this.regexBtn.classList.contains('active');

    const rawSearch = this.findInput.value;
    const isMultiLine = rawSearch.includes('\n');

    let searchStr = rawSearch;
    let useRegex = isRegex;

    if (isMultiLine && !isRegex) {
      // Automatically treat multi-line literal input as a regex so CodeMirror
      // can match across line boundaries. Escape the literal text first,
      // then replace the escaped newlines with \n (which CM's regex understands).
      searchStr = rawSearch
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\n/g, '\\n');
      useRegex = true;
    }

    const newQuery = new SearchQuery({
      search: searchStr,
      replace: this.replaceInput.value,
      caseSensitive: isCase,
      wholeWord: isWord,
      regexp: useRegex
    });

    if (!newQuery.eq(this.query)) {
      this.query = newQuery;
      this.view.dispatch({ effects: setSearchQuery.of(newQuery) });
    }

    this.updateMatchCount();
  }

  private syncFromQuery(query: SearchQuery) {
    this.query = query;
    if (this.findInput.value !== query.search) {
      this.findInput.value = query.search;
    }
    if (this.replaceInput.value !== query.replace) {
      this.replaceInput.value = query.replace;
    }
    this.caseBtn.classList.toggle('active', query.caseSensitive);
    this.wordBtn.classList.toggle('active', query.wholeWord);
    this.regexBtn.classList.toggle('active', query.regexp);
    this.updateMatchCount();
  }

  private updateMatchCount() {
    const searchText = this.findInput.value;
    if (!searchText) {
      this.counterEl.textContent = '';
      this.counterEl.className = 'gfw-matches-count';
      this.findInput.classList.remove('has-no-results');
      return;
    }

    if (!this.query.valid) {
      this.counterEl.textContent = 'Invalid regex';
      this.counterEl.className = 'gfw-matches-count gfw-count-error';
      this.findInput.classList.add('has-no-results');
      return;
    }

    try {
      const cursor = this.query.getCursor(this.view.state);
      let total = 0;
      let current = 0;
      const mainSel = this.view.state.selection.main;
      const limit = 1000;

      while (true) {
        const { done, value } = cursor.next();
        if (done) break;
        total++;
        if (value.from <= mainSel.from && value.to >= mainSel.to) {
          current = total;
        }
        if (total >= limit) break;
      }

      if (total === 0) {
        this.counterEl.textContent = 'No results';
        this.counterEl.className = 'gfw-matches-count gfw-count-empty';
        this.findInput.classList.add('has-no-results');
      } else {
        this.findInput.classList.remove('has-no-results');
        this.counterEl.className = 'gfw-matches-count';
        const totalStr = total >= limit ? `${limit}+` : `${total}`;
        if (current > 0) {
          this.counterEl.textContent = `${current} of ${totalStr}`;
        } else {
          this.counterEl.textContent = `${totalStr} found`;
        }
      }
    } catch {
      this.counterEl.textContent = 'No results';
      this.counterEl.className = 'gfw-matches-count gfw-count-empty';
      this.findInput.classList.add('has-no-results');
    }
  }

  mount() {
    activeFindWidget = this;
    const initialQuery = getSearchQuery(this.view.state);
    if (initialQuery && initialQuery.search) {
      this.syncFromQuery(initialQuery);
    }
    this.findInput.focus();
    this.findInput.select();
  }

  update(update: ViewUpdate) {
    for (const tr of update.transactions) {
      for (const effect of tr.effects) {
        if (effect.is(setSearchQuery) && !effect.value.eq(this.query)) {
          this.syncFromQuery(effect.value);
        }
      }
    }

    if (update.docChanged || update.selectionSet) {
      this.updateMatchCount();
    }
  }

  destroy() {
    if (activeFindWidget === this) {
      activeFindWidget = null;
    }
  }
}
