/**
 * Language Server Protocol (LSP) Client Coordinator
 * Manages active sessions, document synchronization, JSON-RPC routing, and diagnostics.
 */

import {
  CompletionItem,
  CompletionList,
  Diagnostic,
  DiagnosticSeverity,
  Hover,
  Location,
  LspServerStatus,
  LspStatusEvent,
  PublishDiagnosticsParams,
  ServerConfig
} from './lspTypes';
import { JsonRpcConnection } from './jsonRpc';
import { LspProcess } from './lspProcess';
import { lspServerRegistry } from './lspServerRegistry';
import { preferencesService } from '../preferences';
import { notificationService } from '../notification';

export function pathToUri(filePath: string): string {
  let normalized = filePath.replace(/\\/g, '/');
  if (!normalized.startsWith('/')) {
    normalized = '/' + normalized;
  }
  return encodeURI('file://' + normalized).replace(/#/g, '%23');
}

export function uriToPath(uri: string): string {
  let decoded = decodeURIComponent(uri);
  if (decoded.startsWith('file:///')) {
    decoded = decoded.slice(8);
  } else if (decoded.startsWith('file://')) {
    decoded = decoded.slice(7);
  }
  // Windows drive letter check: /d:/path -> D:/path
  if (/^\/[a-zA-Z]:/.test(decoded)) {
    decoded = decoded.slice(1);
  }
  return decoded.replace(/\//g, '\\');
}

/**
 * Normalizes file paths and URIs to compare them accurately regardless of drive letter casing or URL escaping.
 */
export function areUrisOrPathsMatching(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const pathA = a.startsWith('file://') ? uriToPath(a).toLowerCase() : a.replace(/\//g, '\\').toLowerCase();
  const pathB = b.startsWith('file://') ? uriToPath(b).toLowerCase() : b.replace(/\//g, '\\').toLowerCase();
  return pathA === pathB;
}

export interface CompletionResultPayload {
  items: CompletionItem[];
  isIncomplete: boolean;
}

interface PendingOpenDocument {
  filePath: string;
  languageId: string;
  version: number;
  text: string;
}

interface ActiveSession {
  config: ServerConfig;
  process: LspProcess;
  connection: JsonRpcConnection;
  status: LspServerStatus;
  openFiles: Set<string>;
  fileVersions: Map<string, number>;
  pendingOpenDocuments: Map<string, PendingOpenDocument>;
  activeCompletionRequestId?: number;
}

export class LspClient {
  private sessions = new Map<string, ActiveSession>(); // languageId -> Session
  private statusListeners: ((evt: LspStatusEvent) => void)[] = [];
  private diagnosticsListeners: ((params: PublishDiagnosticsParams) => void)[] = [];
  private currentWorkspaceRoot: string = '';

  constructor() {
    // Listen for preference changes
    preferencesService.subscribe('lsp.enabled', (enabled) => {
      if (!enabled) {
        this.stopAll();
      }
    });
  }

  setWorkspaceRoot(root: string) {
    const oldRoot = this.currentWorkspaceRoot;
    const resolved = (!root || root === '.')
      ? ((typeof window !== 'undefined' ? (window as any).NL_PATH : '') || '')
      : root.replace(/\//g, '\\');

    this.currentWorkspaceRoot = resolved;

    if (oldRoot && resolved && oldRoot.toLowerCase() !== resolved.toLowerCase()) {
      const addedUri = pathToUri(resolved);
      const removedUri = pathToUri(oldRoot);
      const uniqueSessions = new Set(this.sessions.values());
      for (const session of uniqueSessions) {
        if (session.status === 'ready') {
          session.connection.notify('workspace/didChangeWorkspaceFolders', {
            event: {
              added: [{ uri: addedUri, name: 'Workspace' }],
              removed: [{ uri: removedUri, name: 'Workspace' }]
            }
          }).catch(() => {});
        }
      }
    }
  }

  getWorkspaceRoot(): string {
    return this.currentWorkspaceRoot;
  }

  onStatusChange(callback: (evt: LspStatusEvent) => void): () => void {
    this.statusListeners.push(callback);
    return () => {
      const idx = this.statusListeners.indexOf(callback);
      if (idx !== -1) this.statusListeners.splice(idx, 1);
    };
  }

  onDiagnostics(callback: (params: PublishDiagnosticsParams) => void): () => void {
    this.diagnosticsListeners.push(callback);
    return () => {
      const idx = this.diagnosticsListeners.indexOf(callback);
      if (idx !== -1) this.diagnosticsListeners.splice(idx, 1);
    };
  }

  private emitStatus(languageId: string, status: LspServerStatus, serverName?: string, error?: string) {
    const evt: LspStatusEvent = { languageId, status, serverName, error };
    for (const listener of this.statusListeners) {
      try {
        listener(evt);
      } catch (err) {
        console.error('[LSP Client] Status listener error:', err);
      }
    }
  }

  private diagnosticsCache = new Map<string, Diagnostic[]>(); // Normalized path -> Diagnostic[]

  private emitDiagnostics(params: PublishDiagnosticsParams) {
    const normPath = uriToPath(params.uri).replace(/\//g, '\\').toLowerCase();
    if (!params.diagnostics || params.diagnostics.length === 0) {
      this.diagnosticsCache.delete(normPath);
    } else {
      this.diagnosticsCache.set(normPath, params.diagnostics);
    }

    for (const listener of this.diagnosticsListeners) {
      try {
        listener(params);
      } catch (err) {
        console.error('[LSP Client] Diagnostics listener error:', err);
      }
    }
  }

  /**
   * Retrieves cached diagnostics for a given file path.
   */
  getDiagnostics(filePath: string): Diagnostic[] {
    const norm = filePath.startsWith('file://')
      ? uriToPath(filePath).replace(/\//g, '\\').toLowerCase()
      : filePath.replace(/\//g, '\\').toLowerCase();
    return this.diagnosticsCache.get(norm) || [];
  }

  /**
   * Returns count of errors and warnings for a specific file.
   */
  getFileDiagnosticSummary(filePath: string): { errors: number; warnings: number } {
    const diags = this.getDiagnostics(filePath);
    let errors = 0;
    let warnings = 0;
    for (const d of diags) {
      if (d.severity === DiagnosticSeverity.Error) errors++;
      else if (d.severity === DiagnosticSeverity.Warning) warnings++;
    }
    return { errors, warnings };
  }

  /**
   * Returns aggregate count of errors and warnings for all files within a directory folder path.
   */
  getFolderDiagnosticSummary(folderPath: string): { errors: number; warnings: number } {
    const normFolder = folderPath.replace(/\//g, '\\').toLowerCase().replace(/\\+$/, '');
    let errors = 0;
    let warnings = 0;
    for (const [filePath, diags] of this.diagnosticsCache.entries()) {
      if (filePath.startsWith(normFolder + '\\') || filePath === normFolder) {
        for (const d of diags) {
          if (d.severity === DiagnosticSeverity.Error) errors++;
          else if (d.severity === DiagnosticSeverity.Warning) warnings++;
        }
      }
    }
    return { errors, warnings };
  }

  /**
   * Returns all cached diagnostics across workspace.
   */
  getAllDiagnostics(): Map<string, Diagnostic[]> {
    return new Map(this.diagnosticsCache);
  }

  getSessionForLanguage(languageId: string): ActiveSession | undefined {
    const norm = languageId.toLowerCase();
    return this.sessions.get(norm);
  }

  /**
   * Retrieves the current server status for a given language ID.
   */
  getServerStatus(languageId: string): { status: LspServerStatus; serverName?: string; error?: string } {
    if (!this.isLspEnabled()) {
      return { status: 'stopped' };
    }

    const norm = languageId.toLowerCase();
    const session = this.sessions.get(norm);
    if (session) {
      return { status: session.status, serverName: session.config.name };
    }

    const config = lspServerRegistry.findConfigForLanguage(norm);
    if (!config) {
      return { status: 'stopped' };
    }

    const customServers = preferencesService.get('lsp.customServers') as Record<string, any> || {};
    const userPref = customServers[config.id];
    if (userPref && userPref.enabled === false) {
      return { status: 'stopped', serverName: config.name };
    }

    return { status: 'stopped', serverName: config.name };
  }

  /**
   * Returns current known document version for an open file.
   */
  getDocumentVersion(filePath: string, languageId?: string): number | undefined {
    const uri = pathToUri(filePath);
    if (languageId) {
      const session = this.getSessionForLanguage(languageId);
      if (session) {
        return session.fileVersions.get(uri);
      }
    }
    for (const session of new Set(this.sessions.values())) {
      if (session.fileVersions.has(uri)) {
        return session.fileVersions.get(uri);
      }
    }
    return undefined;
  }

  isLspEnabled(): boolean {
    return preferencesService.get('lsp.enabled') !== false;
  }

  /**
   * Starts a language server process for the given language if supported, installed, and enabled.
   */
  async ensureServerRunning(languageId: string, filePath?: string): Promise<ActiveSession | null> {
    if (!this.isLspEnabled()) return null;

    const normLang = languageId.toLowerCase();
    const existing = this.sessions.get(normLang);
    if (existing) {
      if (existing.status === 'ready' || existing.status === 'starting') {
        return existing;
      }
    }

    const config = lspServerRegistry.findConfigForLanguage(normLang);
    if (!config) {
      return null;
    }

    // Check custom server preferences
    const customServers = preferencesService.get('lsp.customServers') as Record<string, any> || {};
    const userPref = customServers[config.id];
    if (userPref && userPref.enabled === false) {
      return null;
    }

    // Option B: For TypeScript/JavaScript language server, check if workspace or file belongs
    // to a configured project (package.json, tsconfig.json, jsconfig.json) or if a valid tsserver.js
    // is available. If opening a loose JS/TS file in a non-project directory and no tsserver is found,
    // skip starting the server gracefully to avoid annoying error toasts.
    if (config.id === 'typescript') {
      const customPath = (preferencesService.get('lsp.typescript.tsserverPath') as string) || undefined;
      const fallbackPath = await this.resolveTypescriptFallbackPath(filePath);
      const isProject = await this.isJsTsProject(filePath);

      if (!customPath && !isProject && !fallbackPath) {
        console.debug('[LSP Client] Skipping TypeScript language server for non-project folder/file:', filePath || this.currentWorkspaceRoot);
        this.emitStatus(normLang, 'stopped', config.name);
        return null;
      }
    }

    const command = userPref?.command || config.defaultCommand;
    const args = userPref?.args || config.defaultArgs;

    // Check if installed on PATH
    const isInstalled = await lspServerRegistry.isServerInstalled(config);
    if (!isInstalled && !userPref?.command) {
      this.emitStatus(normLang, 'stopped', config.name, 'Not installed on system PATH');
      return null;
    }

    this.emitStatus(normLang, 'starting', config.name);

    try {
      let connection: JsonRpcConnection;
      const proc = new LspProcess(
        command,
        args,
        this.currentWorkspaceRoot,
        (stdoutChunk) => {
          connection.handleIncomingChunk(stdoutChunk);
        },
        (stderrChunk) => {
          console.debug(`[LSP ${config.name} STDERR]`, stderrChunk);
        },
        (exitCode) => {
          console.warn(`[LSP ${config.name}] Process exited with code ${exitCode}`);
          const curSession = this.sessions.get(normLang);
          if (exitCode !== 0 && curSession && curSession.status === 'ready') {
            notificationService.warn(
              `LSP Terminated: ${config.name}`,
              `Language server process exited unexpectedly with code ${exitCode}.`,
              [
                {
                  label: 'Restart',
                  primary: true,
                  onClick: () => {
                    this.restartServer(normLang);
                  }
                },
                {
                  label: 'Configure',
                  primary: false,
                  onClick: () => {
                    window.dispatchEvent(new CustomEvent('gitero:open-settings', { detail: { tab: 'lsp' } }));
                  }
                }
              ]
            );
          }
          this.handleServerExit(normLang, config.name);
        }
      );

      connection = new JsonRpcConnection(async (data) => {
        await proc.send(data);
      });

      // Handle server notifications
      connection.onNotification((method, params) => {
        if (method === 'textDocument/publishDiagnostics') {
          this.emitDiagnostics(params as PublishDiagnosticsParams);
        }
      });

      await proc.start();

      const session: ActiveSession = {
        config,
        process: proc,
        connection,
        status: 'starting',
        openFiles: new Set<string>(),
        fileVersions: new Map<string, number>(),
        pendingOpenDocuments: new Map<string, PendingOpenDocument>()
      };

      // Map session for all languages handled by this server
      for (const lang of config.languages) {
        this.sessions.set(lang.toLowerCase(), session);
      }

      // Initialize LSP handshake
      const rootUri = (this.currentWorkspaceRoot && this.currentWorkspaceRoot !== '.')
        ? pathToUri(this.currentWorkspaceRoot)
        : (typeof window !== 'undefined' && (window as any).NL_PATH ? pathToUri((window as any).NL_PATH) : null);

      let initOptions: any = undefined;
      if (config.id === 'typescript') {
        const fallbackPath = await this.resolveTypescriptFallbackPath(filePath);
        const customPath = (preferencesService.get('lsp.typescript.tsserverPath') as string) || undefined;
        initOptions = {
          preferences: {
            includePackageJsonAutoImports: 'auto',
            importModuleSpecifierPreference: 'shortest'
          },
          inferredProjectCompilerOptions: {
            target: 'ESNext',
            module: 'ESNext',
            moduleResolution: 'bundler',
            allowJs: true,
            checkJs: false,
            skipLibCheck: true,
            esModuleInterop: true
          },
          ...(customPath || fallbackPath ? {
            tsserver: {
              ...(customPath ? { path: customPath } : {}),
              ...(fallbackPath ? { fallbackPath } : {})
            }
          } : {})
        };
      }

      const initResult = await connection.request('initialize', {
        processId: null,
        rootUri,
        capabilities: {
          textDocument: {
            synchronization: {
              dynamicRegistration: false,
              willSave: false,
              willSaveWaitUntil: false,
              didSave: true
            },
            completion: {
              dynamicRegistration: false,
              completionItem: {
                snippetSupport: true,
                commitCharactersSupport: true,
                documentationFormat: ['markdown', 'plaintext'],
                deprecatedSupport: true,
                preselectSupport: true
              },
              completionItemKind: {
                valueSet: Array.from({ length: 25 }, (_, i) => i + 1)
              },
              contextSupport: true
            },
            hover: {
              dynamicRegistration: false,
              contentFormat: ['markdown', 'plaintext']
            },
            definition: {
              dynamicRegistration: false,
              linkSupport: true
            },
            publishDiagnostics: {
              relatedInformation: true,
              versionSupport: true
            }
          }
        },
        workspaceFolders: rootUri ? [{ uri: rootUri, name: 'Workspace' }] : null,
        initializationOptions: initOptions
      });

      await connection.notify('initialized', {});
      session.status = 'ready';
      this.emitStatus(normLang, 'ready', config.name);

      // Auto-flush any documents that were opened while the server was starting up
      if (session.pendingOpenDocuments.size > 0) {
        const queued = Array.from(session.pendingOpenDocuments.values());
        session.pendingOpenDocuments.clear();
        for (const doc of queued) {
          this.notifyDidOpen(doc.filePath, doc.languageId, doc.version, doc.text).catch((err) => {
            console.warn('[LSP Client] Failed to flush queued didOpen:', err);
          });
        }
      }

      return session;
    } catch (err: any) {
      console.warn(`[LSP Client] Failed to launch server for ${config.name}:`, err);
      const errMsg = err?.message || String(err);
      this.emitStatus(normLang, 'error', config.name, errMsg);

      const isMissingTs = errMsg.includes('TypeScript installation') || errMsg.includes('tsserver');
      if (isMissingTs) {
        // Silently mark as stopped/unavailable instead of popping up an intrusive red error toast
        console.info('[LSP Client] TypeScript dependency or tsserver.js not found for workspace. Operating without LSP.');
        this.emitStatus(normLang, 'stopped', config.name);
      } else {
        notificationService.error(
          `LSP Error: ${config.name}`,
          `Failed to launch language server: ${errMsg}`,
          [
            {
              label: 'Configure LSP',
              primary: true,
              onClick: () => {
                window.dispatchEvent(new CustomEvent('gitero:open-settings', { detail: { tab: 'lsp' } }));
              }
            }
          ]
        );
      }
      return null;
    }
  }

  async restartServer(languageId: string): Promise<ActiveSession | null> {
    const norm = languageId.toLowerCase();
    const session = this.sessions.get(norm);
    if (session) {
      for (const lang of session.config.languages) {
        this.sessions.delete(lang.toLowerCase());
      }
      try {
        await session.connection.request('shutdown', undefined, 1000).catch(() => {});
        await session.connection.notify('exit');
        await session.process.stop();
      } catch {
        await session.process.stop();
      } finally {
        session.connection.dispose();
      }
    }
    return this.ensureServerRunning(norm);
  }

  private handleServerExit(languageId: string, serverName: string) {
    const session = this.sessions.get(languageId);
    if (session) {
      session.status = 'stopped';
      session.connection.dispose();
      for (const lang of session.config.languages) {
        this.sessions.delete(lang.toLowerCase());
      }
    }
    this.emitStatus(languageId, 'stopped', serverName, 'Server stopped');
  }

  /**
   * Notifies the server that a document was opened.
   */
  async notifyDidOpen(filePath: string, languageId: string, version: number, text: string): Promise<void> {
    const session = await this.ensureServerRunning(languageId, filePath);
    if (!session) return;

    const uri = pathToUri(filePath);
    if (session.status !== 'ready') {
      // Buffer document until server handshake is complete
      session.pendingOpenDocuments.set(uri, { filePath, languageId, version, text });
      return;
    }

    if (session.openFiles.has(uri)) {
      // Document is already open in the LSP server, do not send duplicate didOpen
      return;
    }

    session.openFiles.add(uri);
    session.fileVersions.set(uri, version);

    try {
      await session.connection.notify('textDocument/didOpen', {
        textDocument: {
          uri,
          languageId,
          version,
          text
        }
      });
    } catch (err) {
      console.warn('[LSP Client] Error sending didOpen:', err);
    }
  }

  /**
   * Notifies the server of document changes.
   */
  async notifyDidChange(filePath: string, languageId: string, version: number, text: string): Promise<void> {
    const session = this.getSessionForLanguage(languageId);
    if (!session || session.status !== 'ready') return;

    const uri = pathToUri(filePath);
    session.fileVersions.set(uri, version);

    try {
      await session.connection.notify('textDocument/didChange', {
        textDocument: {
          uri,
          version
        },
        contentChanges: [
          { text }
        ]
      });
    } catch (err) {
      console.warn('[LSP Client] Error sending didChange:', err);
    }
  }

  /**
   * Notifies the server that a document was saved.
   */
  async notifyDidSave(filePath: string, languageId: string, text?: string): Promise<void> {
    const session = this.getSessionForLanguage(languageId);
    if (!session || session.status !== 'ready') return;

    const uri = pathToUri(filePath);
    try {
      await session.connection.notify('textDocument/didSave', {
        textDocument: { uri },
        text
      });
    } catch (err) {
      console.warn('[LSP Client] Error sending didSave:', err);
    }
  }

  /**
   * Notifies the server that a document was closed.
   */
  async notifyDidClose(filePath: string, languageId?: string): Promise<void> {
    const uri = pathToUri(filePath);
    let session = languageId ? this.getSessionForLanguage(languageId) : undefined;
    if (!session) {
      // Fallback: locate which active session has this URI open
      for (const s of new Set(this.sessions.values())) {
        if (s.openFiles.has(uri) || s.pendingOpenDocuments.has(uri)) {
          session = s;
          break;
        }
      }
    }
    if (!session) return;

    session.pendingOpenDocuments.delete(uri);
    session.openFiles.delete(uri);
    session.fileVersions.delete(uri);

    if (session.status !== 'ready') return;

    try {
      await session.connection.notify('textDocument/didClose', {
        textDocument: { uri }
      });
    } catch (err) {
      console.warn('[LSP Client] Error sending didClose:', err);
    }
  }

  /**
   * Requests completion items at the cursor position.
   */
  async requestCompletion(
    filePath: string,
    languageId: string,
    line: number,
    character: number
  ): Promise<CompletionResultPayload> {
    const session = this.getSessionForLanguage(languageId);
    if (!session || session.status !== 'ready') return { items: [], isIncomplete: false };

    // Cancel previous in-flight completion request if still active
    if (session.activeCompletionRequestId !== undefined) {
      session.connection.cancelRequest(session.activeCompletionRequestId);
      session.activeCompletionRequestId = undefined;
    }

    const uri = pathToUri(filePath);
    try {
      const req = session.connection.requestWithId<CompletionList | CompletionItem[]>(
        'textDocument/completion',
        {
          textDocument: { uri },
          position: { line, character }
        },
        4000
      );
      session.activeCompletionRequestId = req.id;

      const res = await req.promise;
      if (session.activeCompletionRequestId === req.id) {
        session.activeCompletionRequestId = undefined;
      }

      if (!res) return { items: [], isIncomplete: false };
      if (Array.isArray(res)) return { items: res, isIncomplete: false };
      if ('items' in res && Array.isArray(res.items)) {
        return { items: res.items, isIncomplete: Boolean(res.isIncomplete) };
      }
      return { items: [], isIncomplete: false };
    } catch (err: any) {
      session.activeCompletionRequestId = undefined;
      if (err?.message?.includes('cancelled')) {
        // Request was superseded by newer keystroke
        return { items: [], isIncomplete: false };
      }
      console.debug('[LSP Client] Completion request returned empty or timed out:', err);
      return { items: [], isIncomplete: false };
    }
  }

  /**
   * Requests hover type information / documentation.
   */
  async requestHover(
    filePath: string,
    languageId: string,
    line: number,
    character: number
  ): Promise<Hover | null> {
    const session = this.getSessionForLanguage(languageId);
    if (!session || session.status !== 'ready') return null;

    const uri = pathToUri(filePath);
    try {
      const res = await session.connection.request<Hover>(
        'textDocument/hover',
        {
          textDocument: { uri },
          position: { line, character }
        },
        3000
      );
      return res || null;
    } catch (err) {
      return null;
    }
  }

  /**
   * Requests symbol definition locations.
   */
  async requestDefinition(
    filePath: string,
    languageId: string,
    line: number,
    character: number
  ): Promise<Location | Location[] | null> {
    const session = this.getSessionForLanguage(languageId);
    if (!session || session.status !== 'ready') return null;

    const uri = pathToUri(filePath);
    try {
      const res = await session.connection.request<Location | Location[]>(
        'textDocument/definition',
        {
          textDocument: { uri },
          position: { line, character }
        },
        4000
      );
      return res || null;
    } catch (err) {
      return null;
    }
  }

  /**
   * Determines if the current workspace or file belongs to a configured JavaScript/TypeScript project.
   * Checks for tsconfig.json, jsconfig.json, or package.json in the workspace root or file directory/ancestors.
   */
  async isJsTsProject(filePath?: string): Promise<boolean> {
    const projectFiles = ['tsconfig.json', 'jsconfig.json', 'package.json'];

    // 1. Check workspace root
    if (this.currentWorkspaceRoot && this.currentWorkspaceRoot !== '.') {
      const cleanWs = this.currentWorkspaceRoot.replace(/\\/g, '/').replace(/\/+$/, '');
      for (const pFile of projectFiles) {
        if (await this.pathExists(`${cleanWs}/${pFile}`)) {
          return true;
        }
      }
    }

    // 2. Check directory of filePath and up to 4 parent directories
    if (filePath && !filePath.startsWith('Untitled-') && !filePath.startsWith('gitero://')) {
      let currentDir = filePath.replace(/\\/g, '/');
      const lastSlash = currentDir.lastIndexOf('/');
      if (lastSlash > 0) {
        currentDir = currentDir.slice(0, lastSlash);
      }
      for (let depth = 0; depth < 5; depth++) {
        for (const pFile of projectFiles) {
          if (await this.pathExists(`${currentDir}/${pFile}`)) {
            return true;
          }
        }
        const parentSlash = currentDir.lastIndexOf('/');
        if (parentSlash < 3) break; // Stop at drive root
        currentDir = currentDir.slice(0, parentSlash);
      }
    }

    return false;
  }

  /**
   * Resolves a valid path to TypeScript or tsserver.js to prevent typescript-language-server
   * from failing when opened in a directory without local node_modules or when global TypeScript
   * does not supply tsserver.js.
   */
  private async resolveTypescriptFallbackPath(filePath?: string): Promise<string | undefined> {
    // 1. Check workspace node_modules, then parent directories (up to 4 levels up)
    if (this.currentWorkspaceRoot && this.currentWorkspaceRoot !== '.') {
      let searchDir = this.currentWorkspaceRoot.replace(/\\/g, '/').replace(/\/+$/, '');
      for (let depth = 0; depth < 4; depth++) {
        const candidate = `${searchDir}/node_modules/typescript/lib/tsserver.js`;
        if (await this.pathExists(candidate)) {
          return candidate.replace(/\//g, '\\');
        }
        // Walk up one directory
        const parentSlash = searchDir.lastIndexOf('/');
        if (parentSlash < 3) break; // Stop at drive root (e.g. C:/)
        searchDir = searchDir.slice(0, parentSlash);
      }
    }

    // 2. Check directory of filePath and parent directories (up to 4 levels up)
    if (filePath && !filePath.startsWith('Untitled-') && !filePath.startsWith('gitero://')) {
      let fileDir = filePath.replace(/\\/g, '/');
      const lastSlash = fileDir.lastIndexOf('/');
      if (lastSlash > 0) fileDir = fileDir.slice(0, lastSlash);
      for (let depth = 0; depth < 4; depth++) {
        const candidate = `${fileDir}/node_modules/typescript/lib/tsserver.js`;
        if (await this.pathExists(candidate)) {
          return candidate.replace(/\//g, '\\');
        }
        const parentSlash = fileDir.lastIndexOf('/');
        if (parentSlash < 3) break;
        fileDir = fileDir.slice(0, parentSlash);
      }
    }

    // 2. Check application directory (Neutralino NL_PATH or current working directory)
    const nlPath = typeof window !== 'undefined' ? (window as any).NL_PATH : undefined;
    if (nlPath) {
      const appCandidate = `${nlPath.replace(/\\/g, '/')}/node_modules/typescript/lib/tsserver.js`;
      if (await this.pathExists(appCandidate)) {
        return appCandidate.replace(/\//g, '\\');
      }
      const binCandidate = `${nlPath.replace(/\\/g, '/')}/bin/typescript/lib/tsserver.js`;
      if (await this.pathExists(binCandidate)) {
        return binCandidate.replace(/\//g, '\\');
      }
    }

    // 3. Check relative node_modules in dev environment
    const devCandidate = 'node_modules/typescript/lib/tsserver.js';
    if (await this.pathExists(devCandidate)) {
      return devCandidate.replace(/\//g, '\\');
    }

    // 4. Check environment APPDATA / global npm paths
    let appData: string | null = null;
    if (typeof window !== 'undefined' && (window as any).Neutralino?.os?.getEnv) {
      try {
        appData = await (window as any).Neutralino.os.getEnv('APPDATA');
      } catch {}
    }
    if (!appData && typeof process !== 'undefined' && (process as any).env?.APPDATA) {
      appData = (process as any).env.APPDATA;
    }

    if (appData) {
      const cleanAppData = appData.replace(/\\/g, '/');
      const candidates = [
        `${cleanAppData}/npm/node_modules/typescript/lib/tsserver.js`,
        `${cleanAppData}/npm/node_modules/vscode-langservers-extracted/node_modules/typescript/lib/tsserver.js`,
        `${cleanAppData}/npm/node_modules/intelephense/node_modules/typescript/lib/tsserver.js`,
        `${cleanAppData}/npm/node_modules/@angular/cli/node_modules/typescript/lib/tsserver.js`,
        `${cleanAppData}/npm/node_modules/typescript-language-server/node_modules/typescript/lib/tsserver.js`,
      ];
      for (const candidate of candidates) {
        if (await this.pathExists(candidate)) {
          return candidate.replace(/\//g, '\\');
        }
      }
    }

    // 5. Try LOCALAPPDATA (for nvm-windows and Volta installations)
    let localAppData: string | null = null;
    if (typeof window !== 'undefined' && (window as any).Neutralino?.os?.getEnv) {
      try {
        localAppData = await (window as any).Neutralino.os.getEnv('LOCALAPPDATA');
      } catch {}
    }
    if (localAppData) {
      const cleanLAD = localAppData.replace(/\\/g, '/');
      const nvmCandidates = [
        // nvm-windows (NVM_SYMLINK style)
        `${cleanLAD}/nvm/node_modules/typescript/lib/tsserver.js`,
        // Volta
        `${cleanLAD}/Volta/tools/shared/typescript/lib/tsserver.js`,
        // Scoop
        `${cleanLAD}/scoop/persist/nvm/node_modules/typescript/lib/tsserver.js`,
      ];
      for (const candidate of nvmCandidates) {
        if (await this.pathExists(candidate)) {
          return candidate.replace(/\//g, '\\');
        }
      }
    }

    return undefined;
  }

  private async pathExists(filePath: string): Promise<boolean> {
    if (typeof window !== 'undefined' && (window as any).Neutralino?.filesystem?.getStats) {
      try {
        const stats = await (window as any).Neutralino.filesystem.getStats(filePath);
        return Boolean(stats);
      } catch {
        return false;
      }
    }
    return false;
  }

  /**
   * Stops all running language server sessions cleanly.
   */
  async stopAll(): Promise<void> {
    const uniqueSessions = new Set(this.sessions.values());
    for (const session of uniqueSessions) {
      try {
        await session.connection.request('shutdown', undefined, 2000).catch(() => {});
        await session.connection.notify('exit');
        await session.process.stop();
      } catch {
        await session.process.stop();
      } finally {
        session.connection.dispose();
      }
    }
    this.sessions.clear();
  }
}

export const lspClient = new LspClient();
