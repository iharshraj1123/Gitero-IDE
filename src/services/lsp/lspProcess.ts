/**
 * Native Language Server Process Manager
 * Manages child process lifecycles, stdio communication, and events via Neutralinojs.
 */

declare const window: any;

export class LspProcess {
  private processId: number | null = null;
  private isTerminated = false;
  private eventCleanup: (() => void) | null = null;
  private stderrBuffer: string[] = [];

  constructor(
    public readonly command: string,
    public readonly args: string[],
    public readonly cwd: string,
    private readonly onStdOut: (data: string) => void,
    private readonly onStdErr: (data: string) => void,
    private readonly onExit: (exitCode: number) => void
  ) {}

  getRecentStderr(): string {
    return this.stderrBuffer.join('');
  }

  async start(): Promise<number> {
    if (typeof window === 'undefined' || !window.Neutralino?.os) {
      throw new Error('Native Neutralino OS API is not available.');
    }

    const commandArgs = this.args.length > 0 ? ` ${this.args.join(' ')}` : '';
    const fullCommand = this.cwd
      ? `cmd.exe /c "cd /d "${this.cwd}" && ${this.command}${commandArgs}"`
      : `cmd.exe /c "${this.command}${commandArgs}"`;

    try {
      const proc = await window.Neutralino.os.spawnProcess(fullCommand);
      this.processId = proc.id;
      this.isTerminated = false;

      // Attach Neutralino spawnedProcess event listener
      const eventHandler = (evt: any) => {
        const detail = evt?.detail;
        if (!detail || detail.id !== this.processId) return;

        if (detail.action === 'stdOut') {
          if (detail.data) {
            this.onStdOut(detail.data);
          }
        } else if (detail.action === 'stdErr') {
          if (detail.data) {
            this.stderrBuffer.push(detail.data);
            if (this.stderrBuffer.length > 30) {
              this.stderrBuffer.shift();
            }
            this.onStdErr(detail.data);
          }
        } else if (detail.action === 'exit') {
          this.isTerminated = true;
          this.onExit(typeof detail.data === 'number' ? detail.data : 0);
        }
      };

      if (window.Neutralino.events?.on) {
        window.Neutralino.events.on('spawnedProcess', eventHandler);
        this.eventCleanup = () => {
          if (window.Neutralino.events?.off) {
            window.Neutralino.events.off('spawnedProcess', eventHandler);
          }
        };
      }

      return this.processId!;
    } catch (err: any) {
      this.isTerminated = true;
      throw new Error(`Failed to spawn language server (${this.command}): ${err?.message || err}`);
    }
  }

  async send(data: string): Promise<void> {
    if (this.isTerminated || this.processId === null) {
      throw new Error('Cannot send data to a terminated language server process.');
    }

    try {
      await window.Neutralino.os.updateSpawnedProcess(this.processId, 'stdIn', data);
    } catch (err: any) {
      console.warn(`[LSP Process] Error sending to stdin (PID ${this.processId}):`, err);
      throw err;
    }
  }

  async stop(): Promise<void> {
    if (this.isTerminated || this.processId === null) return;
    this.isTerminated = true;

    try {
      if (window.Neutralino?.os?.updateSpawnedProcess) {
        await window.Neutralino.os.updateSpawnedProcess(this.processId, 'exit');
      }
    } catch (err) {
      console.warn(`[LSP Process] Could not terminate process PID ${this.processId}:`, err);
    } finally {
      if (this.eventCleanup) {
        this.eventCleanup();
        this.eventCleanup = null;
      }
      this.processId = null;
    }
  }

  getId(): number | null {
    return this.processId;
  }

  isRunning(): boolean {
    return !this.isTerminated && this.processId !== null;
  }
}
