import { gitService, GitCommit, GitCommitDetail, GitRef } from '../services/git';
import { fsService } from '../services/fs';
import { diffModal } from './diffModal';

export const GRAPH_COLORS = [
  '#3794ff', // Blue
  '#a855f7', // Purple
  '#22c55e', // Green
  '#f97316', // Orange
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#eab308'  // Yellow
];

export interface GraphRowData {
  commit: GitCommit;
  lane: number;
  color: string;
  isHead: boolean;
  passingLanes: number[];
  parentConnections: { fromLane: number; toLane: number; toParentHash: string }[];
  maxLanes: number;
}

export class GitGraphEngine {
  public static computeGraph(commits: GitCommit[]): GraphRowData[] {
    const activeLanes: (string | null)[] = [];
    const rows: GraphRowData[] = [];
    let maxLanesTotal = 0;

    for (const commit of commits) {
      // 1. Find lane for this commit
      let lane = activeLanes.indexOf(commit.hash);
      if (lane === -1) {
        // Find first empty slot or push to end
        lane = activeLanes.indexOf(null);
        if (lane === -1) {
          lane = activeLanes.length;
          activeLanes.push(commit.hash);
        } else {
          activeLanes[lane] = commit.hash;
        }
      }

      const color = GRAPH_COLORS[lane % GRAPH_COLORS.length];
      const isHead = commit.refs.some((r) => r.isCurrentHead || r.type === 'head');

      // Record passing lanes before updating activeLanes for parents
      const passingLanes: number[] = [];
      for (let l = 0; l < activeLanes.length; l++) {
        if (l !== lane && activeLanes[l] !== null) {
          passingLanes.push(l);
        }
      }

      // 2. Determine parent connections
      const parentConnections: { fromLane: number; toLane: number; toParentHash: string }[] = [];
      const parents = commit.parentHashes;

      if (parents.length === 0) {
        // Root commit ends this lane
        activeLanes[lane] = null;
      } else {
        // Primary parent continues this lane
        activeLanes[lane] = parents[0];
        parentConnections.push({ fromLane: lane, toLane: lane, toParentHash: parents[0] });

        // Merge parents (parents[1...])
        for (let p = 1; p < parents.length; p++) {
          const parentHash = parents[p];
          let pLane = activeLanes.indexOf(parentHash);
          if (pLane === -1) {
            // Allocate new lane for this merge parent
            pLane = activeLanes.indexOf(null);
            if (pLane === -1) {
              pLane = activeLanes.length;
              activeLanes.push(parentHash);
            } else {
              activeLanes[pLane] = parentHash;
            }
          }
          parentConnections.push({ fromLane: lane, toLane: pLane, toParentHash: parentHash });
        }
      }

      // Trim trailing nulls from activeLanes to keep column count compact
      while (activeLanes.length > 0 && activeLanes[activeLanes.length - 1] === null) {
        activeLanes.pop();
      }

      const currentLanesCount = Math.max(lane + 1, activeLanes.length);
      if (currentLanesCount > maxLanesTotal) {
        maxLanesTotal = currentLanesCount;
      }

      rows.push({
        commit,
        lane,
        color,
        isHead,
        passingLanes,
        parentConnections,
        maxLanes: currentLanesCount
      });
    }

    // Set overall maxLanes on all rows for consistent column alignment
    rows.forEach((r) => (r.maxLanes = Math.max(r.maxLanes, maxLanesTotal)));
    return rows;
  }

  public static renderSvgCell(row: GraphRowData, rowHeight: number = 24, laneWidth: number = 16): string {
    const svgWidth = Math.max(laneWidth * (row.maxLanes + 1), 24);
    const nodeX = row.lane * laneWidth + laneWidth / 2;
    const nodeY = rowHeight / 2;

    let paths = '';

    // 1. Draw passing lines for other branches
    for (const pLane of row.passingLanes) {
      const px = pLane * laneWidth + laneWidth / 2;
      const pColor = GRAPH_COLORS[pLane % GRAPH_COLORS.length];
      paths += `<line x1="${px}" y1="0" x2="${px}" y2="${rowHeight}" stroke="${pColor}" stroke-width="2" stroke-opacity="0.8"/>`;
    }

    // 2. Draw incoming line into node from top (if not the first commit in branch)
    paths += `<line x1="${nodeX}" y1="0" x2="${nodeX}" y2="${nodeY}" stroke="${row.color}" stroke-width="2"/>`;

    // 3. Draw outgoing lines/curves to parent lanes downwards
    for (const conn of row.parentConnections) {
      const pColor = GRAPH_COLORS[conn.toLane % GRAPH_COLORS.length];
      if (conn.toLane === row.lane) {
        // Straight line down to next row
        paths += `<line x1="${nodeX}" y1="${nodeY}" x2="${nodeX}" y2="${rowHeight}" stroke="${row.color}" stroke-width="2"/>`;
      } else {
        // Bezier curve to parent lane
        const targetX = conn.toLane * laneWidth + laneWidth / 2;
        const midY = (nodeY + rowHeight) / 2;
        paths += `<path d="M ${nodeX} ${nodeY} C ${nodeX} ${midY}, ${targetX} ${midY}, ${targetX} ${rowHeight}" fill="none" stroke="${pColor}" stroke-width="2"/>`;
      }
    }

    // 4. Draw Commit Node
    let nodeShape = '';
    if (row.isHead) {
      // Open glowing ring for HEAD
      nodeShape = `
        <circle cx="${nodeX}" cy="${nodeY}" r="5.5" fill="var(--bg-sidebar, #1e1e1e)" stroke="${row.color}" stroke-width="2.5"/>
        <circle cx="${nodeX}" cy="${nodeY}" r="2" fill="${row.color}"/>
      `;
    } else {
      // Solid filled dot
      nodeShape = `<circle cx="${nodeX}" cy="${nodeY}" r="4" fill="${row.color}"/>`;
    }

    return `
      <svg class="graph-row-svg" width="${svgWidth}" height="${rowHeight}" viewBox="0 0 ${svgWidth} ${rowHeight}">
        ${paths}
        ${nodeShape}
      </svg>
    `;
  }
}

/**
 * Compact Sidebar Git Graph Accordion Component (Embedded in Source Control panel)
 */
export class GitGraphSidebarComponent {
  private container: HTMLElement;
  private isCollapsed: boolean = false;
  private showAllBranches: boolean = true;
  private commits: GitCommit[] = [];
  private isLoading: boolean = false;
  private hasMore: boolean = true;
  private pageSize: number = 35;
  private onOpenFullView?: () => void;

  private bodyEl!: HTMLElement;
  private listEl!: HTMLElement;
  private spinnerEl!: HTMLElement;
  private filterToggleBtn!: HTMLElement;

  constructor(container: HTMLElement, options?: { onOpenFullView?: () => void }) {
    this.container = container;
    this.onOpenFullView = options?.onOpenFullView;
    this.build();
    this.setupListeners();
  }

  private build() {
    this.container.innerHTML = `
      <div class="git-section-header git-graph-header" id="sidebar-graph-header">
        <div class="git-section-title-wrap">
          <svg class="git-section-arrow" id="graph-accordion-arrow" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
          <span class="git-section-title">GRAPH</span>
        </div>
        <div class="git-section-actions">
          <button class="git-sec-action-btn graph-filter-btn" id="btn-graph-filter" title="Toggle: All Branches vs Current Branch">Auto</button>
          <button class="git-sec-action-btn" id="btn-graph-scroll-head" title="Focus HEAD Commit">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/></svg>
          </button>
          <button class="git-sec-action-btn" id="btn-graph-open-full" title="Open Complete Tree (Full Git Graph View)">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
          </button>
          <button class="git-sec-action-btn" id="btn-graph-refresh" title="Refresh Commit Graph">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/></svg>
          </button>
        </div>
      </div>

      <div class="git-graph-body" id="sidebar-graph-body">
        <div class="git-graph-list" id="sidebar-graph-list"></div>
        <div class="git-graph-spinner" id="sidebar-graph-spinner" style="display: none;">
          <span class="graph-loading-text">Loading commits...</span>
        </div>
      </div>
    `;

    this.bodyEl = this.container.querySelector('#sidebar-graph-body') as HTMLElement;
    this.listEl = this.container.querySelector('#sidebar-graph-list') as HTMLElement;
    this.spinnerEl = this.container.querySelector('#sidebar-graph-spinner') as HTMLElement;
    this.filterToggleBtn = this.container.querySelector('#btn-graph-filter') as HTMLElement;
  }

  private setupListeners() {
    // Accordion Toggle
    const header = this.container.querySelector('#sidebar-graph-header') as HTMLElement;
    header.addEventListener('click', (e) => {
      // Ignore clicks on action buttons
      if ((e.target as HTMLElement).closest('.git-sec-action-btn')) return;
      this.toggleCollapse();
    });

    // Filter Toggle (Auto/All vs Head)
    this.filterToggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.showAllBranches = !this.showAllBranches;
      this.filterToggleBtn.textContent = this.showAllBranches ? 'Auto' : 'Branch';
      this.filterToggleBtn.title = this.showAllBranches ? 'Showing All Branches (Click for Current)' : 'Showing Current Branch (Click for All)';
      this.reload();
    });

    // Scroll to HEAD
    this.container.querySelector('#btn-graph-scroll-head')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.scrollToHead();
    });

    // Open Complete Tree
    this.container.querySelector('#btn-graph-open-full')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.onOpenFullView) {
        this.onOpenFullView();
      }
    });

    // Refresh
    this.container.querySelector('#btn-graph-refresh')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.reload();
    });

    // Infinite Scroll
    this.listEl.addEventListener('scroll', () => {
      if (this.isLoading || !this.hasMore) return;
      const scrollPos = this.listEl.scrollTop + this.listEl.clientHeight;
      if (scrollPos >= this.listEl.scrollHeight - 100) {
        this.loadNextPage();
      }
    });
  }

  public toggleCollapse(force?: boolean) {
    this.isCollapsed = force !== undefined ? force : !this.isCollapsed;
    this.bodyEl.style.display = this.isCollapsed ? 'none' : 'block';
    const arrow = this.container.querySelector('#graph-accordion-arrow') as HTMLElement;
    if (arrow) {
      arrow.style.transform = this.isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)';
    }
  }

  public async reload() {
    this.commits = [];
    this.hasMore = true;
    this.listEl.innerHTML = '';
    await this.loadNextPage();
  }

  private async loadNextPage() {
    if (this.isLoading || !this.hasMore) return;
    this.isLoading = true;
    this.spinnerEl.style.display = 'block';

    try {
      const skip = this.commits.length;
      const branchOpt = this.showAllBranches ? undefined : gitService.getCurrentBranch();
      const newCommits = await gitService.getCommitLog({
        maxCount: this.pageSize,
        skip,
        all: this.showAllBranches,
        branch: branchOpt
      });

      if (newCommits.length < this.pageSize) {
        this.hasMore = false;
      }

      this.commits.push(...newCommits);
      this.render();
    } catch (err) {
      console.error('[GitGraphSidebar] Error loading commits:', err);
    } finally {
      this.isLoading = false;
      this.spinnerEl.style.display = 'none';
    }
  }

  private render() {
    if (this.commits.length === 0) {
      this.listEl.innerHTML = '<div class="git-clean-msg">No commit history found</div>';
      return;
    }

    const rows = GitGraphEngine.computeGraph(this.commits);
    this.listEl.innerHTML = '';

    for (const row of rows) {
      const rowEl = document.createElement('div');
      rowEl.className = `sidebar-graph-row ${row.isHead ? 'is-head-row' : ''}`;
      rowEl.title = `${row.commit.shortHash} - ${row.commit.message} (${row.commit.authorName}, ${row.commit.relativeDate})`;

      // Graph SVG Cell
      const svgCell = document.createElement('div');
      svgCell.className = 'graph-cell-svg';
      svgCell.innerHTML = GitGraphEngine.renderSvgCell(row, 24, 14);

      // Commit Message Content
      const contentEl = document.createElement('div');
      contentEl.className = 'graph-row-content';

      // Ref Badges (Branch/Tag pills)
      let refsHtml = '';
      for (const r of row.commit.refs) {
        const badgeClass = r.isCurrentHead
          ? 'ref-badge-head'
          : r.type === 'tag'
          ? 'ref-badge-tag'
          : r.type === 'remote'
          ? 'ref-badge-remote'
          : 'ref-badge-branch';

        refsHtml += `
          <span class="graph-ref-badge ${badgeClass}" title="${r.name}">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="6" x2="6" y1="3" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>
            <span class="ref-name">${r.name}</span>
          </span>
        `;
      }

      contentEl.innerHTML = `
        <span class="graph-commit-msg">${row.commit.message}</span>
        ${refsHtml}
      `;

      // Quick Hover Actions
      const actionsEl = document.createElement('div');
      actionsEl.className = 'graph-row-actions';

      const copyBtn = document.createElement('button');
      copyBtn.className = 'graph-action-btn';
      copyBtn.title = `Copy SHA (${row.commit.shortHash})`;
      copyBtn.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
      copyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(row.commit.hash);
        copyBtn.style.color = '#22c55e';
        setTimeout(() => (copyBtn.style.color = ''), 1000);
      });

      actionsEl.appendChild(copyBtn);

      rowEl.appendChild(svgCell);
      rowEl.appendChild(contentEl);
      rowEl.appendChild(actionsEl);

      // Clicking row opens full tree with this commit
      rowEl.addEventListener('click', () => {
        if (this.onOpenFullView) {
          this.onOpenFullView();
        }
      });

      this.listEl.appendChild(rowEl);
    }
  }

  public scrollToHead() {
    const headEl = this.listEl.querySelector('.is-head-row') as HTMLElement;
    if (headEl) {
      headEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      this.listEl.scrollTop = 0;
    }
  }
}

/**
 * Full Complete Tree Git Graph View (Opens in Editor Workspace Tab / Viewport)
 */
export class GitGraphFullComponent {
  private container: HTMLElement;
  private commits: GitCommit[] = [];
  private branches: { name: string; isCurrent: boolean }[] = [];
  private selectedBranch: string = 'all';
  private searchQuery: string = '';
  private showAbandoned: boolean = false;
  private isLoading: boolean = false;
  private hasMore: boolean = true;
  private pageSize: number = 50;
  private selectedCommit: GitCommitDetail | null = null;
  private rowsData: GraphRowData[] = [];

  private branchSelectEl!: HTMLSelectElement;
  private searchInputEl!: HTMLInputElement;
  private statsEl!: HTMLElement;
  private tableBodyEl!: HTMLElement;
  private scrollContainerEl!: HTMLElement;
  private spinnerEl!: HTMLElement;
  private detailDrawerEl!: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
    this.build();
    this.setupListeners();
  }

  private build() {
    this.container.innerHTML = `
      <div class="full-gitgraph-container">
        <!-- Control Header Toolbar -->
        <div class="full-gitgraph-toolbar">
          <div class="toolbar-left">
            <div class="toolbar-group">
              <label for="fg-branch-select">Branch:</label>
              <select class="gitgraph-select" id="fg-branch-select">
                <option value="all">All Branches</option>
                <option value="all-with-abandoned">All (Including Abandoned &amp; Reflog)</option>
                <option value="only-abandoned">Abandoned &amp; Dangling Only</option>
              </select>
            </div>

            <button class="btn-toolbar-toggle" id="fg-btn-abandoned" title="Show Abandoned & Dangling Commits (from Git Reflog & fsck)">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4"/><path d="m4.93 4.93 2.83 2.83"/><path d="M2 12h4"/><path d="m4.93 19.07 2.83-2.83"/><path d="M12 22v-4"/><path d="m19.07 19.07-2.83-2.83"/><path d="M22 12h-4"/><path d="m19.07 4.93-2.83 2.83"/></svg>
              <span>Abandoned / Reflog</span>
            </button>

            <div class="toolbar-search-wrap">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              <input type="text" class="gitgraph-search-input" id="fg-search-input" placeholder="Filter commits by message, author, or SHA..." spellcheck="false" autocomplete="off" />
            </div>
          </div>

          <div class="toolbar-right">
            <span class="gitgraph-stats" id="fg-stats">Loaded 0 commits</span>
            <button class="btn-toolbar-icon" id="fg-btn-refresh" title="Refresh Graph">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/></svg>
            </button>
          </div>
        </div>

        <!-- Main Split: Graph Table + Detail Drawer -->
        <div class="full-gitgraph-main">
          <div class="gitgraph-table-viewport" id="fg-scroll-container">
            <table class="gitgraph-table">
              <thead>
                <tr>
                  <th class="col-graph">Graph</th>
                  <th class="col-desc">Description</th>
                  <th class="col-hash">Commit</th>
                  <th class="col-author">Author</th>
                  <th class="col-date">Date</th>
                </tr>
              </thead>
              <tbody id="fg-table-body"></tbody>
            </table>
            <div class="gitgraph-scroll-spinner" id="fg-spinner" style="display: none;">
              <span>Loading commits...</span>
            </div>
          </div>

          <!-- Bottom Commit Detail Drawer -->
          <div class="gitgraph-detail-drawer" id="fg-detail-drawer" style="display: none;">
            <div class="detail-drawer-header">
              <div class="detail-commit-summary" id="detail-summary-title">Commit Details</div>
              <div class="detail-actions">
                <button class="btn-drawer-close" id="btn-close-detail" title="Close Details">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            </div>
            <div class="detail-drawer-body" id="detail-drawer-content"></div>
          </div>
        </div>
      </div>
    `;

    this.branchSelectEl = this.container.querySelector('#fg-branch-select') as HTMLSelectElement;
    this.searchInputEl = this.container.querySelector('#fg-search-input') as HTMLInputElement;
    this.statsEl = this.container.querySelector('#fg-stats') as HTMLElement;
    this.tableBodyEl = this.container.querySelector('#fg-table-body') as HTMLElement;
    this.scrollContainerEl = this.container.querySelector('#fg-scroll-container') as HTMLElement;
    this.spinnerEl = this.container.querySelector('#fg-spinner') as HTMLElement;
    this.detailDrawerEl = this.container.querySelector('#fg-detail-drawer') as HTMLElement;
  }

  private setupListeners() {
    this.branchSelectEl.addEventListener('change', () => {
      this.selectedBranch = this.branchSelectEl.value;
      this.reload();
    });

    let searchTimer: any = null;
    this.searchInputEl.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        this.searchQuery = this.searchInputEl.value.trim();
        this.reload();
      }, 250);
    });

    this.container.querySelector('#fg-btn-refresh')?.addEventListener('click', () => {
      this.reload();
    });

    this.container.querySelector('#btn-close-detail')?.addEventListener('click', () => {
      this.detailDrawerEl.style.display = 'none';
      this.selectedCommit = null;
      this.tableBodyEl.querySelectorAll('tr.active-commit-row').forEach((r) => r.classList.remove('active-commit-row'));
    });

    this.container.querySelector('#fg-btn-abandoned')?.addEventListener('click', (e) => {
      this.showAbandoned = !this.showAbandoned;
      const btn = e.currentTarget as HTMLElement;
      btn.classList.toggle('active', this.showAbandoned);
      this.reload();
    });

    // Infinite Scroll
    this.scrollContainerEl.addEventListener('scroll', () => {
      if (this.isLoading || !this.hasMore) return;
      const scrollPos = this.scrollContainerEl.scrollTop + this.scrollContainerEl.clientHeight;
      if (scrollPos >= this.scrollContainerEl.scrollHeight - 150) {
        this.loadNextPage();
      }
    });
  }

  public async reload() {
    this.commits = [];
    this.hasMore = true;
    this.tableBodyEl.innerHTML = '';
    this.detailDrawerEl.style.display = 'none';
    this.selectedCommit = null;
    await this.loadBranches();
    await this.loadNextPage();
  }

  private async loadBranches() {
    const branches = await gitService.getBranches();
    this.branches = branches;

    const currentVal = this.selectedBranch;
    this.branchSelectEl.innerHTML = `
      <option value="all">All Branches</option>
      <option value="all-with-abandoned">All (Including Abandoned &amp; Reflog)</option>
      <option value="only-abandoned">Abandoned &amp; Dangling Only</option>
    `;

    for (const b of branches) {
      const opt = document.createElement('option');
      opt.value = b.name;
      opt.textContent = `Branch: ${b.name}${b.isCurrent ? ' (HEAD)' : ''}`;
      if (b.name === currentVal) {
        opt.selected = true;
      }
      this.branchSelectEl.appendChild(opt);
    }
  }

  private async loadNextPage() {
    if (this.isLoading || !this.hasMore) return;
    this.isLoading = true;
    this.spinnerEl.style.display = 'flex';

    try {
      const skip = this.commits.length;
      const isOnlyDangling = this.selectedBranch === 'only-abandoned';
      const isIncludeReflog = this.showAbandoned || this.selectedBranch === 'all-with-abandoned' || isOnlyDangling;
      const branch =
        this.selectedBranch === 'all' ||
        this.selectedBranch === 'all-with-abandoned' ||
        this.selectedBranch === 'only-abandoned'
          ? undefined
          : this.selectedBranch;

      const newCommits = await gitService.getCommitLog({
        maxCount: this.pageSize,
        skip,
        all: !branch && !isOnlyDangling,
        branch,
        search: this.searchQuery,
        includeReflog: isIncludeReflog,
        onlyDangling: isOnlyDangling
      });

      if (newCommits.length < this.pageSize) {
        this.hasMore = false;
      }

      this.commits.push(...newCommits);
      this.render();
      this.statsEl.textContent = `Showing ${this.commits.length} commits`;
    } catch (err) {
      console.error('[GitGraphFull] Error loading commits:', err);
    } finally {
      this.isLoading = false;
      this.spinnerEl.style.display = 'none';
    }
  }

  private render() {
    if (this.commits.length === 0) {
      this.tableBodyEl.innerHTML = '<tr><td colspan="5" class="table-empty-note">No matching commits found.</td></tr>';
      return;
    }

    this.rowsData = GitGraphEngine.computeGraph(this.commits);
    this.tableBodyEl.innerHTML = '';

    for (const row of this.rowsData) {
      const tr = document.createElement('tr');
      tr.className = `gitgraph-tr ${row.isHead ? 'is-head-tr' : ''} ${row.commit.isDangling ? 'is-dangling-tr' : ''}`;
      tr.dataset.hash = row.commit.hash;

      // 1. Graph SVG Column
      const tdGraph = document.createElement('td');
      tdGraph.className = 'td-graph';
      tdGraph.innerHTML = GitGraphEngine.renderSvgCell(row, 26, 16);

      // 2. Description Column
      const tdDesc = document.createElement('td');
      tdDesc.className = 'td-desc';

      let refsHtml = '';
      for (const r of row.commit.refs) {
        const badgeClass = r.isCurrentHead
          ? 'ref-badge-head'
          : r.type === 'tag'
          ? 'ref-badge-tag'
          : r.type === 'remote'
          ? 'ref-badge-remote'
          : r.type === 'dangling'
          ? 'ref-badge-dangling'
          : 'ref-badge-branch';

        refsHtml += `
          <span class="graph-ref-badge ${badgeClass}" title="${r.name}">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="6" x2="6" y1="3" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>
            <span class="ref-name">${r.name}</span>
          </span>
        `;
      }

      tdDesc.innerHTML = `
        <span class="desc-subject">${this.escapeHtml(row.commit.message)}</span>
        ${refsHtml}
      `;

      // 3. Hash Column
      const tdHash = document.createElement('td');
      tdHash.className = 'td-hash';
      tdHash.innerHTML = `
        <span class="hash-label">${row.commit.shortHash}</span>
        <button class="btn-copy-hash" title="Copy Full SHA">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
        </button>
      `;

      tdHash.querySelector('.btn-copy-hash')?.addEventListener('click', (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(row.commit.hash);
        const btn = tdHash.querySelector('.btn-copy-hash') as HTMLElement;
        if (btn) {
          btn.style.color = '#22c55e';
          setTimeout(() => (btn.style.color = ''), 1000);
        }
      });

      // 4. Author Column
      const tdAuthor = document.createElement('td');
      tdAuthor.className = 'td-author';
      tdAuthor.textContent = row.commit.authorName;

      // 5. Date Column
      const tdDate = document.createElement('td');
      tdDate.className = 'td-date';
      tdDate.textContent = row.commit.relativeDate;
      tdDate.title = new Date(row.commit.timestamp * 1000).toLocaleString();

      tr.appendChild(tdGraph);
      tr.appendChild(tdDesc);
      tr.appendChild(tdHash);
      tr.appendChild(tdAuthor);
      tr.appendChild(tdDate);

      tr.addEventListener('click', () => {
        this.selectCommit(row.commit.hash, tr);
      });

      this.tableBodyEl.appendChild(tr);
    }
  }

  private async selectCommit(hash: string, rowEl: HTMLElement) {
    this.tableBodyEl.querySelectorAll('tr.active-commit-row').forEach((r) => r.classList.remove('active-commit-row'));
    rowEl.classList.add('active-commit-row');

    this.detailDrawerEl.style.display = 'flex';
    const contentEl = this.container.querySelector('#detail-drawer-content') as HTMLElement;
    contentEl.innerHTML = '<div class="drawer-loading">Loading commit details...</div>';

    const detail = await gitService.getCommitDetails(hash);
    if (!detail) {
      contentEl.innerHTML = '<div class="drawer-error">Failed to load commit details.</div>';
      return;
    }

    this.selectedCommit = detail;
    const titleEl = this.container.querySelector('#detail-summary-title') as HTMLElement;
    titleEl.innerHTML = `<strong>${detail.shortHash}</strong> — ${this.escapeHtml(detail.message)}`;

    let filesListHtml = '';
    for (const f of detail.files) {
      const addStr = f.additions !== undefined && f.additions > 0 ? `<span class="stat-add">+${f.additions}</span>` : '';
      const delStr = f.deletions !== undefined && f.deletions > 0 ? `<span class="stat-del">-${f.deletions}</span>` : '';

      filesListHtml += `
        <div class="commit-file-row" data-path="${f.path}">
          <span class="commit-file-status status-${f.status.toLowerCase()}">${f.status}</span>
          <span class="commit-file-path" title="${f.path}">${f.path}</span>
          <div class="commit-file-stats">${addStr} ${delStr}</div>
          <button class="btn-diff-file" title="Inspect Diff">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M6 21V9a9 9 0 0 0 9 9"/></svg>
          </button>
        </div>
      `;
    }

    const isDangling = rowEl.classList.contains('is-dangling-tr') || this.commits.find((c) => c.hash === hash)?.isDangling;
    let abandonedBannerHtml = '';
    if (isDangling) {
      abandonedBannerHtml = `
        <div class="drawer-abandoned-banner">
          <div class="banner-text">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#eab308" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            <span><strong>Abandoned / Dangling Commit:</strong> This commit is unreferenced by any active branch (from Git reflog or fsck).</span>
          </div>
          <button class="btn-restore-branch" id="btn-restore-commit" title="Restore this commit to a new branch">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            <span>Restore to Branch...</span>
          </button>
        </div>
      `;
    }

    contentEl.innerHTML = `
      ${abandonedBannerHtml}
      <div class="drawer-metadata-grid">
        <div class="drawer-meta-item">
          <span class="meta-label">Author:</span>
          <span class="meta-value">${this.escapeHtml(detail.authorName)} &lt;${this.escapeHtml(detail.authorEmail)}&gt;</span>
        </div>
        <div class="drawer-meta-item">
          <span class="meta-label">Date:</span>
          <span class="meta-value">${new Date(detail.timestamp * 1000).toLocaleString()} (${detail.relativeDate})</span>
        </div>
        <div class="drawer-meta-item">
          <span class="meta-label">Parents:</span>
          <span class="meta-value">${detail.parentHashes.map((p) => `<span class="parent-sha" data-sha="${p}">${p.slice(0, 7)}</span>`).join(' ') || 'None (root)'}</span>
        </div>
      </div>

      ${detail.body ? `<pre class="drawer-commit-body">${this.escapeHtml(detail.body)}</pre>` : ''}

      <div class="drawer-files-header">
        <span>Changed Files (${detail.files.length})</span>
      </div>
      <div class="drawer-files-list">${filesListHtml || '<div class="drawer-clean-files">No files changed.</div>'}</div>
    `;

    // Wire restore commit button
    contentEl.querySelector('#btn-restore-commit')?.addEventListener('click', async () => {
      const defaultName = `recovered-${detail.shortHash}`;
      const branchName = prompt('Enter new branch name to restore this commit to:', defaultName);
      if (!branchName?.trim()) return;
      const res = await gitService.restoreCommitToBranch(detail.hash, branchName.trim());
      if (res.success) {
        alert(`Successfully restored commit ${detail.shortHash} to new branch "${branchName.trim()}".`);
        this.reload();
      } else {
        alert(`Failed to restore commit: ${res.error}`);
      }
    });

    // Wire clicking parents
    contentEl.querySelectorAll('.parent-sha').forEach((el) => {
      el.addEventListener('click', (e) => {
        const sha = (e.currentTarget as HTMLElement).dataset.sha;
        if (sha) {
          this.jumpToCommit(sha);
        }
      });
    });

    // Wire file click to view diff
    contentEl.querySelectorAll('.commit-file-row').forEach((row) => {
      row.addEventListener('click', async (e) => {
        const filePath = (row as HTMLElement).dataset.path;
        if (!filePath) return;
        this.openCommitDiff(detail.hash, filePath, detail.parentHashes[0]);
      });
    });
  }

  private async openCommitDiff(hash: string, filePath: string, parentHash?: string) {
    const diffText = await gitService.getCommitFileDiff(hash, filePath, parentHash);
    const fileChange = {
      path: filePath,
      relativePath: filePath,
      status: 'M' as const,
      isStaged: false
    };

    // Open diff modal directly with historical diff content
    diffModal.open(fileChange, false);
    // Overwrite modal text with commit diff
    const modalContent = document.querySelector('.diff-modal-body') as HTMLElement;
    if (modalContent) {
      modalContent.textContent = diffText;
    }
  }

  private jumpToCommit(hash: string) {
    const targetRow = this.tableBodyEl.querySelector(`tr[data-hash="${hash}"]`) as HTMLElement;
    if (targetRow) {
      targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
      targetRow.click();
    } else {
      // Set search query to jump to that SHA
      this.searchInputEl.value = hash.slice(0, 7);
      this.searchQuery = hash.slice(0, 7);
      this.reload();
    }
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
