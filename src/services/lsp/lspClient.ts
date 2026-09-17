/**
 * Language Server Protocol (LSP) Client Coordinator
 * Manages active sessions, document synchronization, JSON-RPC routing, and diagnostics.
 */

import {
  CompletionItem,
  CompletionList,
  Diagnostic,
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

interface ActiveSession {
  config: ServerConfig;
  process: LspProcess;
  connection: JsonRpcConnection;
  status: LspServerStatus;
  openFiles: Set<string>;
  fileVersions: Map<string, number>;
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
    this.currentWorkspaceRoot = root;
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

  private emitDiagnostics(params: PublishDiagnosticsParams) {
    for (const listener of this.diagnosticsListeners) {
      try {
        listener(params);
      } catch (err) {
        console.error('[LSP Client] Diagnostics listener error:', err);
      }
    }
  }

  getSessionForLanguage(languageId: string): ActiveSession | undefined {
    const norm = languageId.toLowerCase();
    return this.sessions.get(norm);
  }

  isLspEnabled(): boolean {
    return preferencesService.get('lsp.enabled') !== false;
  }

  /**
   * Starts a language server process for the given language if supported, installed, and enabled.
   */
  async ensureServerRunning(languageId: string): Promise<ActiveSession | null> {
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
        fileVersions: new Map<string, number>()
      };

      // Map session for all languages handled by this server
      for (const lang of config.languages) {
        this.sessions.set(lang.toLowerCase(), session);
      }

      // Initialize LSP handshake
      const rootUri = this.currentWorkspaceRoot ? pathToUri(this.currentWorkspaceRoot) : null;
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
        workspaceFolders: rootUri ? [{ uri: rootUri, name: 'Workspace' }] : null
      });

      await connection.notify('initialized', {});
      session.status = 'ready';
      this.emitStatus(normLang, 'ready', config.name);

      return session;
    } catch (err: any) {
      console.warn(`[LSP Client] Failed to launch server for ${config.name}:`, err);
      this.emitStatus(normLang, 'error', config.name, err?.message || String(err));
      notificationService.error(
        `LSP Error: ${config.name}`,
        `Failed to launch language server: ${err?.message || err}`,
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
    const session = await this.ensureServerRunning(languageId);
    if (!session || session.status !== 'ready') return;

    const uri = pathToUri(filePath);
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
  async notifyDidClose(filePath: string, languageId: string): Promise<void> {
    const session = this.getSessionForLanguage(languageId);
    if (!session || session.status !== 'ready') return;

    const uri = pathToUri(filePath);
    session.openFiles.delete(uri);
    session.fileVersions.delete(uri);

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
  ): Promise<CompletionItem[]> {
    const session = this.getSessionForLanguage(languageId);
    if (!session || session.status !== 'ready') return [];

    const uri = pathToUri(filePath);
    try {
      const res = await session.connection.request<CompletionList | CompletionItem[]>(
        'textDocument/completion',
        {
          textDocument: { uri },
          position: { line, character }
        },
        4000
      );

      if (!res) return [];
      if (Array.isArray(res)) return res;
      if ('items' in res && Array.isArray(res.items)) return res.items;
      return [];
    } catch (err) {
      console.debug('[LSP Client] Completion request returned empty or timed out:', err);
      return [];
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
