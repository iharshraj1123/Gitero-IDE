/**
 * Language Server Protocol (LSP) Client Coordinator
 * Manages active sessions, document synchronization, JSON-RPC routing, and diagnostics.
 */

import {
  CodeAction,
  CompletionItem,
  CompletionList,
  Diagnostic,
  DiagnosticSeverity,
  DiagnosticTag,
  FormattingOptions,
  Hover,
  Location,
  LspServerStatus,
  LspStatusEvent,
  PublishDiagnosticsParams,
  Range,
  ServerCapabilities,
  ServerConfig,
  SignatureHelp,
  TextEdit,
  WorkspaceEdit
} from './lspTypes';
import { JsonRpcConnection } from './jsonRpc';
import { LspProcess } from './lspProcess';
import { lspServerRegistry } from './lspServerRegistry';
import { lspInstaller } from './lspInstaller';
import { preferencesService } from '../preferences';
import { notificationService } from '../notification';
import { fsService } from '../fs';
import { isJsoncFile } from '../../editor/languages';

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
  capabilities?: ServerCapabilities;
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

  private sanitizeDiagnostics(uri: string, diagnostics: Diagnostic[]): Diagnostic[] {
    if (!diagnostics || diagnostics.length === 0) return [];

    const normPath = uriToPath(uri).replace(/\//g, '\\').toLowerCase();
    const fileName = normPath.split('\\').pop() || '';
    const isJsonDoc = fileName.endsWith('.json') || fileName.endsWith('.jsonc') || fileName.endsWith('.json5') || isJsoncFile(normPath);
    const sanitized: Diagnostic[] = [];

    for (const d of diagnostics) {
      const codeStr = d.code !== undefined ? String(d.code) : '';
      const msg = d.message || '';

      // 1. JSON False Positives:
      // ErrorCode 521: "Comments are not permitted in JSON."
      // ErrorCode 519: "Trailing comma"
      if (isJsonDoc) {
        if (codeStr === '521' || msg.includes('Comments are not permitted in JSON')) {
          continue; // Suppress false comment error for JSON/JSONC documents
        }
        if (isJsoncFile(normPath) && (codeStr === '519' || msg.includes('Trailing comma'))) {
          continue; // Suppress trailing comma false error for JSONC
        }
      }

      const cloned: Diagnostic = { ...d };

      // 2. TypeScript / JavaScript Unused Directives:
      // TS2578: "Unused '@ts-expect-error' directive."
      // TS2577: "Unused '@ts-ignore' directive."
      // Comments are completely ignored for checks (no errors, no hints, no squiggles).
      if (codeStr === '2578' || codeStr === '2577' || msg.includes("Unused '@ts-expect-error'") || msg.includes("Unused '@ts-ignore'")) {
        continue;
      }

      // 3. Unnecessary code (unused vars, imports, parameters) should NEVER be Error:
      if (cloned.tags && (cloned.tags.includes(DiagnosticTag.Unnecessary) || (cloned.tags as number[]).includes(1))) {
        if (cloned.severity === DiagnosticSeverity.Error) {
          cloned.severity = DiagnosticSeverity.Hint;
        }
      }

      // 4. Rust Analyzer unlinked file warning/error:
      if (codeStr === 'unlinked-file' || msg.includes('not included in crate hierarchy')) {
        cloned.severity = DiagnosticSeverity.Information;
      }

      // 5. Pyright missing type stubs:
      if (codeStr === 'reportMissingTypeStubs') {
        cloned.severity = DiagnosticSeverity.Hint;
      }

      sanitized.push(cloned);
    }

    return sanitized;
  }

  private emitDiagnostics(params: PublishDiagnosticsParams) {
    const normPath = uriToPath(params.uri).replace(/\//g, '\\').toLowerCase();
    const cleanDiagnostics = this.sanitizeDiagnostics(params.uri, params.diagnostics);
    const sanitizedParams: PublishDiagnosticsParams = {
      ...params,
      diagnostics: cleanDiagnostics
    };

    if (cleanDiagnostics.length === 0) {
      this.diagnosticsCache.delete(normPath);
    } else {
      this.diagnosticsCache.set(normPath, cleanDiagnostics);
    }

    for (const listener of this.diagnosticsListeners) {
      try {
        listener(sanitizedParams);
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

    const resolvedCmd = userPref?.command || (await lspServerRegistry.resolveServerExecutable(config)) || config.defaultCommand;
    const command = resolvedCmd;
    const args = userPref?.args || config.defaultArgs;

    // Check if installed on PATH or resolved
    const isInstalled = !!userPref?.command || (await lspServerRegistry.isServerInstalled(config));
    if (!isInstalled) {
      this.emitStatus(normLang, 'stopped', config.name, 'Not installed on system PATH');
      return null;
    }

    this.emitStatus(normLang, 'starting', config.name);

    let proc: LspProcess | null = null;
    let startupExitCode: number | null = null;

    try {
      let connection: JsonRpcConnection;
      const activeProc = new LspProcess(
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
          if (curSession && curSession.status === 'ready') {
            if (exitCode !== 0) {
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
          } else {
            startupExitCode = exitCode;
          }
          this.handleServerExit(normLang, config.name);
        }
      );
      proc = activeProc;

      connection = new JsonRpcConnection(async (data) => {
        await activeProc.send(data);
      });

      // Handle server notifications
      connection.onNotification((method, params) => {
        if (method === 'textDocument/publishDiagnostics') {
          this.emitDiagnostics(params as PublishDiagnosticsParams);
        }
      });

      // Handle server-to-client requests for configuration & dynamic capabilities
      connection.onRequest('workspace/configuration', async (_method, params) => {
        const items = params?.items || [];
        return items.map((item: any) => {
          const section = item?.section;
          if (section === 'json') {
            return {
              validate: { enable: true },
              format: { enable: true },
              schemas: []
            };
          }
          if (section === 'http') {
            return { proxy: '', proxyStrictSSL: false };
          }
          if (section === 'typescript' || section === 'javascript') {
            return {
              suggest: { completeFunctionCalls: true },
              preferences: {
                includePackageJsonAutoImports: 'auto',
                importModuleSpecifierPreference: 'shortest'
              }
            };
          }
          if (section === 'python') {
            return {
              analysis: {
                autoSearchPaths: true,
                useLibraryCodeForTypes: true,
                diagnosticSeverityOverrides: {
                  reportMissingTypeStubs: 'none'
                }
              }
            };
          }
          if (section === 'xml') {
            return {
              format: { enabled: true },
              validation: { enabled: true }
            };
          }
          return {};
        });
      });

      connection.onRequest('client/registerCapability', async () => null);
      connection.onRequest('client/unregisterCapability', async () => null);
      connection.onRequest('workspace/workspaceFolders', async () => {
        const rUri = (this.currentWorkspaceRoot && this.currentWorkspaceRoot !== '.')
          ? pathToUri(this.currentWorkspaceRoot)
          : null;
        return rUri ? [{ uri: rUri, name: 'Workspace' }] : [];
      });

      await activeProc.start();

      const session: ActiveSession = {
        config,
        process: activeProc,
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
            esModuleInterop: true,
            lib: ['ESNext', 'DOM', 'DOM.Iterable']
          },
          ...(customPath || fallbackPath ? {
            tsserver: {
              ...(customPath ? { path: customPath } : {}),
              ...(fallbackPath ? { fallbackPath } : {})
            }
          } : {})
        };
      } else if (config.id === 'json') {
        initOptions = {
          provideFormatter: true,
          customCapabilities: {
            rangeFormatting: {
              dynamicRegistration: false
            }
          }
        };
      }

      const rootPath = (this.currentWorkspaceRoot && this.currentWorkspaceRoot !== '.')
        ? this.currentWorkspaceRoot
        : (filePath ? filePath.substring(0, Math.max(filePath.lastIndexOf('\\'), filePath.lastIndexOf('/'))) : null);

      const initResult = await connection.request('initialize', {
        processId: null,
        rootUri,
        rootPath,
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
                preselectSupport: true,
                insertReplaceSupport: true,
                resolveSupport: {
                  properties: ['documentation', 'detail', 'additionalTextEdits']
                }
              },
              completionItemKind: {
                valueSet: Array.from({ length: 25 }, (_, i) => i + 1)
              },
              contextSupport: true
            },
            signatureHelp: {
              dynamicRegistration: false,
              signatureInformation: {
                documentationFormat: ['markdown', 'plaintext'],
                parameterInformation: {
                  labelOffsetSupport: true
                },
                activeParameterSupport: true
              }
            },
            hover: {
              dynamicRegistration: false,
              contentFormat: ['markdown', 'plaintext']
            },
            definition: {
              dynamicRegistration: false,
              linkSupport: true
            },
            references: {
              dynamicRegistration: false
            },
            rename: {
              dynamicRegistration: false,
              prepareSupport: true
            },
            formatting: {
              dynamicRegistration: false
            },
            codeAction: {
              dynamicRegistration: false,
              codeActionLiteralSupport: {
                codeActionKind: {
                  valueSet: [
                    '',
                    'quickfix',
                    'refactor',
                    'refactor.extract',
                    'refactor.inline',
                    'refactor.rewrite',
                    'source',
                    'source.organizeImports'
                  ]
                }
              },
              isPreferredSupport: true
            },
            publishDiagnostics: {
              relatedInformation: true,
              versionSupport: true
            }
          },
          workspace: {
            applyEdit: true,
            workspaceEdit: {
              documentChanges: true
            },
            configuration: true,
            workspaceFolders: true
          }
        },
        workspaceFolders: rootUri ? [{ uri: rootUri, name: 'Workspace' }] : null,
        initializationOptions: initOptions
      });

      await connection.notify('initialized', {});
      session.capabilities = initResult?.capabilities;
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
      const rawStderr = proc?.getRecentStderr() || '';
      const stderr = rawStderr.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '').trim();
      const errMsg = err?.message || String(err);
      this.emitStatus(normLang, 'error', config.name, stderr || errMsg);

      const isMissingTs = errMsg.includes('TypeScript installation') || errMsg.includes('tsserver');
      if (isMissingTs) {
        // Silently mark as stopped/unavailable instead of popping up an intrusive red error toast
        console.info('[LSP Client] TypeScript dependency or tsserver.js not found for workspace. Operating without LSP.');
        this.emitStatus(normLang, 'stopped', config.name);
      } else if (config.id === 'rust' && (stderr.toLowerCase().includes('unknown binary') || stderr.toLowerCase().includes('rustup component add') || stderr.toLowerCase().includes('rust-analyzer'))) {
        lspServerRegistry.clearCache();
        notificationService.warn(
          'Rust Analyzer Component Missing',
          'Rust Analyzer is not installed in the active Rust toolchain. Run "rustup component add rust-analyzer" to install it.',
          [
            {
              label: 'Install Now',
              primary: true,
              onClick: () => {
                lspInstaller.installServer(config);
              }
            },
            {
              label: 'Configure',
              primary: false,
              onClick: () => {
                window.dispatchEvent(new CustomEvent('gitero:open-settings', { detail: { tab: 'lsp' } }));
              }
            },
            {
              label: 'Copy Command',
              primary: false,
              onClick: () => {
                navigator.clipboard.writeText('rustup component add rust-analyzer');
                notificationService.info('Copied', 'Command copied to clipboard.');
              }
            }
          ],
          12000
        );
      } else {
        const displayDetail = stderr
          ? (stderr.length > 250 ? stderr.substring(0, 247) + '...' : stderr)
          : (startupExitCode !== null ? `Process exited early with code ${startupExitCode}.` : errMsg);

        const actions: any[] = [];
        if (config.installCommand) {
          actions.push({
            label: 'Install / Reinstall',
            primary: true,
            onClick: () => {
              lspInstaller.installServer(config);
            }
          });
        }
        actions.push({
          label: 'Configure LSP',
          primary: !config.installCommand,
          onClick: () => {
            window.dispatchEvent(new CustomEvent('gitero:open-settings', { detail: { tab: 'lsp' } }));
          }
        });
        if (stderr) {
          actions.push({
            label: 'Copy Error',
            primary: false,
            onClick: () => {
              navigator.clipboard.writeText(stderr);
              notificationService.info('Copied', 'Error details copied to clipboard.');
            }
          });
        }

        notificationService.error(
          `LSP Error: ${config.name}`,
          `Failed to launch language server. ${displayDetail}`,
          actions
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
    let effectiveLang = languageId;
    if (languageId === 'json' && (isJsoncFile(filePath) || text.includes('//') || text.includes('/*'))) {
      effectiveLang = 'jsonc';
    }

    const session = await this.ensureServerRunning(effectiveLang, filePath);
    if (!session) return;

    const uri = pathToUri(filePath);
    if (session.status !== 'ready') {
      // Buffer document until server handshake is complete
      session.pendingOpenDocuments.set(uri, { filePath, languageId: effectiveLang, version, text });
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
          languageId: effectiveLang,
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
    let effectiveLang = languageId;
    if (languageId === 'json' && (isJsoncFile(filePath) || text.includes('//') || text.includes('/*'))) {
      effectiveLang = 'jsonc';
    }

    const session = this.getSessionForLanguage(effectiveLang);
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
   * Retrieves server capabilities for a given language ID if initialized.
   */
  getServerCapabilities(languageId: string): ServerCapabilities | undefined {
    const session = this.getSessionForLanguage(languageId);
    return session?.capabilities;
  }

  /**
   * Resolves additional documentation and edits for a highlighted completion item.
   */
  async resolveCompletionItem(
    languageId: string,
    item: CompletionItem
  ): Promise<CompletionItem> {
    const session = this.getSessionForLanguage(languageId);
    if (!session || session.status !== 'ready') return item;
    if (!session.capabilities?.completionProvider?.resolveProvider) {
      return item;
    }

    try {
      const resolved = await session.connection.request<CompletionItem>(
        'completionItem/resolve',
        item,
        2500
      );
      return resolved || item;
    } catch {
      return item;
    }
  }

  /**
   * Requests signature help (parameter hints) at the current cursor position.
   */
  async requestSignatureHelp(
    filePath: string,
    languageId: string,
    line: number,
    character: number,
    triggerCharacter?: string
  ): Promise<SignatureHelp | null> {
    const session = this.getSessionForLanguage(languageId);
    if (!session || session.status !== 'ready') return null;

    const uri = pathToUri(filePath);
    try {
      const res = await session.connection.request<SignatureHelp>(
        'textDocument/signatureHelp',
        {
          textDocument: { uri },
          position: { line, character },
          context: {
            triggerKind: triggerCharacter ? 2 : 1, // 1 = Invoked, 2 = TriggerCharacter
            triggerCharacter,
            isRetrigger: false
          }
        },
        3000
      );
      return res || null;
    } catch {
      return null;
    }
  }

  /**
   * Requests code actions (quick fixes, refactorings) for a given range and diagnostics.
   */
  async requestCodeActions(
    filePath: string,
    languageId: string,
    range: Range,
    diagnostics: Diagnostic[]
  ): Promise<CodeAction[]> {
    const session = this.getSessionForLanguage(languageId);
    if (!session || session.status !== 'ready') return [];

    const uri = pathToUri(filePath);
    try {
      const res = await session.connection.request<(CodeAction | any)[]>(
        'textDocument/codeAction',
        {
          textDocument: { uri },
          range,
          context: {
            diagnostics
          }
        },
        4000
      );
      if (!Array.isArray(res)) return [];
      return res.map((act) => {
        if ('title' in act) return act;
        return {
          title: act.command?.title || 'Apply action',
          command: act
        };
      });
    } catch {
      return [];
    }
  }

  /**
   * Requests document formatting edits.
   */
  async requestFormatting(
    filePath: string,
    languageId: string,
    options: FormattingOptions
  ): Promise<TextEdit[]> {
    const session = this.getSessionForLanguage(languageId);
    if (!session || session.status !== 'ready') return [];

    const uri = pathToUri(filePath);
    try {
      const res = await session.connection.request<TextEdit[]>(
        'textDocument/formatting',
        {
          textDocument: { uri },
          options
        },
        6000
      );
      return Array.isArray(res) ? res : [];
    } catch {
      return [];
    }
  }

  /**
   * Requests symbol rename across workspace.
   */
  async requestRename(
    filePath: string,
    languageId: string,
    line: number,
    character: number,
    newName: string
  ): Promise<WorkspaceEdit | null> {
    const session = this.getSessionForLanguage(languageId);
    if (!session || session.status !== 'ready') return null;

    const uri = pathToUri(filePath);
    try {
      const res = await session.connection.request<WorkspaceEdit>(
        'textDocument/rename',
        {
          textDocument: { uri },
          position: { line, character },
          newName
        },
        6000
      );
      return res || null;
    } catch (err: any) {
      notificationService.warn('Rename Failed', err?.message || 'Symbol could not be renamed.');
      return null;
    }
  }

  /**
   * Requests all references of the symbol at the cursor.
   */
  async requestReferences(
    filePath: string,
    languageId: string,
    line: number,
    character: number
  ): Promise<Location[]> {
    const session = this.getSessionForLanguage(languageId);
    if (!session || session.status !== 'ready') return [];

    const uri = pathToUri(filePath);
    try {
      const res = await session.connection.request<Location[]>(
        'textDocument/references',
        {
          textDocument: { uri },
          position: { line, character },
          context: { includeDeclaration: true }
        },
        6000
      );
      return Array.isArray(res) ? res : [];
    } catch {
      return [];
    }
  }

  /**
   * Applies a WorkspaceEdit across open editors or files on disk.
   */
  async applyWorkspaceEdit(edit: WorkspaceEdit): Promise<boolean> {
    if (!edit) return false;

    const changesMap = new Map<string, TextEdit[]>();

    if (edit.changes) {
      for (const [uri, edits] of Object.entries(edit.changes)) {
        const filePath = uriToPath(uri);
        changesMap.set(filePath, edits);
      }
    }

    if (edit.documentChanges && Array.isArray(edit.documentChanges)) {
      for (const docChange of edit.documentChanges) {
        if ('textDocument' in docChange && 'edits' in docChange) {
          const filePath = uriToPath(docChange.textDocument.uri);
          const existing = changesMap.get(filePath) || [];
          changesMap.set(filePath, [...existing, ...docChange.edits]);
        }
      }
    }

    if (changesMap.size === 0) return false;

    // Dispatch event so active editor view can apply changes in-memory with undo support
    window.dispatchEvent(new CustomEvent('gitero:apply-workspace-edit', { detail: { changes: changesMap } }));

    // Apply edits to any files on disk
    for (const [filePath, edits] of changesMap.entries()) {
      try {
        const content = await fsService.readFile(filePath);
        const sortedEdits = [...edits].sort((a, b) => {
          if (b.range.start.line !== a.range.start.line) {
            return b.range.start.line - a.range.start.line;
          }
          return b.range.start.character - a.range.start.character;
        });

        const lines = content.split('\n');
        for (const te of sortedEdits) {
          const startLine = te.range.start.line;
          const startChar = te.range.start.character;
          const endLine = te.range.end.line;
          const endChar = te.range.end.character;

          if (startLine < lines.length && endLine < lines.length) {
            const before = lines[startLine].slice(0, startChar);
            const after = lines[endLine].slice(endChar);
            const replacementLines = te.newText.split('\n');
            if (replacementLines.length === 1) {
              lines.splice(startLine, endLine - startLine + 1, before + replacementLines[0] + after);
            } else {
              const newBlock = [
                before + replacementLines[0],
                ...replacementLines.slice(1, -1),
                replacementLines[replacementLines.length - 1] + after
              ];
              lines.splice(startLine, endLine - startLine + 1, ...newBlock);
            }
          }
        }
        await fsService.writeFile(filePath, lines.join('\n'));
      } catch (err) {
        console.warn(`[LSP Client] Failed to write edit to ${filePath}:`, err);
      }
    }

    return true;
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
        const norm = filePath.replace(/\//g, '\\');
        const stats = await (window as any).Neutralino.filesystem.getStats(norm);
        return Boolean(stats);
      } catch {
        return false;
      }
    }
    return false;
  }

  /**
   * Stops any running language server session matching a specific server ID.
   * Useful before running an install or update command to release file locks on Windows.
   */
  async stopServer(serverId: string): Promise<void> {
    const sessionsToStop = Array.from(this.sessions.entries())
      .filter(([_, session]) => session.config.id === serverId);

    const stoppedUnique = new Set<ActiveSession>();
    for (const [langId, session] of sessionsToStop) {
      this.sessions.delete(langId);
      if (!stoppedUnique.has(session)) {
        stoppedUnique.add(session);
        try {
          await session.connection.request('shutdown', undefined, 1500).catch(() => {});
          await session.connection.notify('exit');
          await session.process.stop();
        } catch {
          await session.process.stop();
        } finally {
          session.connection.dispose();
        }
      }
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
