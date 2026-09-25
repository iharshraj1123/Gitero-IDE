/**
 * Language Server Background Installer Service
 * Provides one-click installation for language servers using system package managers (npm, pip, etc.).
 */

import { ServerConfig, lspServerRegistry } from './lspServerRegistry';
import { notificationService } from '../notification';

declare const window: any;

class LspInstallerService {
  private installingServers = new Set<string>();

  /**
   * Check if a server is currently undergoing installation
   */
  isInstalling(serverId: string): boolean {
    return this.installingServers.has(serverId);
  }

  /**
   * Check if the required package manager is available on the user's PATH
   */
  async canInstall(server: ServerConfig): Promise<{ canInstall: boolean; error?: string; tool?: string }> {
    if (!server.installCommand) {
      return { canInstall: false, error: 'No installation command specified for this server.' };
    }

    if (typeof window === 'undefined' || !window.Neutralino?.os?.execCommand) {
      return { canInstall: false, error: 'Native execution environment is not available.' };
    }

    const tool = server.packageManager || this.inferTool(server.installCommand);
    if (!tool || tool === 'custom') {
      return { canInstall: true };
    }

    try {
      const res = await window.Neutralino.os.execCommand(`where.exe ${tool}`);
      if (res.exitCode === 0 && res.stdOut && res.stdOut.trim().length > 0) {
        return { canInstall: true, tool };
      }

      // Check fallback path for rustup or go
      let userProfile = '';
      try {
        if (window.Neutralino?.os?.getEnv) {
          userProfile = (await window.Neutralino.os.getEnv('USERPROFILE')) || '';
        }
      } catch {}

      if (tool === 'rustup' && userProfile) {
        try {
          const stats = await window.Neutralino.filesystem.getStats(`${userProfile}\\.cargo\\bin\\rustup.exe`);
          if (stats) return { canInstall: true, tool };
        } catch {}
      }
      if (tool === 'go') {
        const goCandidates = [
          userProfile ? `${userProfile}\\go\\bin\\go.exe` : '',
          'C:\\Program Files\\Go\\bin\\go.exe'
        ].filter(Boolean);
        for (const cand of goCandidates) {
          try {
            const stats = await window.Neutralino.filesystem.getStats(cand);
            if (stats) return { canInstall: true, tool };
          } catch {}
        }
      }

      return {
        canInstall: false,
        tool,
        error: `Required tool "${tool}" was not found on your system PATH. Please install ${tool} first.`
      };
    } catch (err: any) {
      return { canInstall: false, error: err?.message || `Failed to verify ${tool} availability.` };
    }
  }

  /**
   * Execute the installation command in the background, updating notifications and registry
   */
  async installServer(server: ServerConfig): Promise<{ success: boolean; error?: string }> {
    if (!server.installCommand) {
      return { success: false, error: 'No installation command available.' };
    }

    if (this.isInstalling(server.id)) {
      return { success: false, error: 'Installation is already in progress.' };
    }

    // Verify package manager tool
    const preCheck = await this.canInstall(server);
    if (!preCheck.canInstall) {
      notificationService.warn(
        'Installation Prerequisite Missing',
        preCheck.error || `Missing prerequisite to install ${server.name}.`,
        server.installGuide ? [{
          label: 'Copy Manual Guide',
          onClick: () => {
            navigator.clipboard.writeText(server.installGuide);
            notificationService.info('Copied', 'Installation guide copied to clipboard.');
          }
        }] : undefined
      );
      return { success: false, error: preCheck.error };
    }

    this.installingServers.add(server.id);

    // Notify user of installation starting
    const progressNotif = notificationService.show({
      type: 'info',
      title: 'Installing Language Server',
      message: `Installing ${server.name} in background... This may take up to a minute.`,
      durationMs: 0 // Sticky until completed
    });

    // Broadcast status for UI buttons
    window.dispatchEvent(new CustomEvent('gitero:lsp-install-status', {
      detail: { serverId: server.id, status: 'installing' }
    }));

    try {
      // Prepend toolchain paths if applicable to ensure newly installed or user toolchain is found
      let envPrefix = '';
      if (server.packageManager === 'rustup' || server.id === 'rust') {
        envPrefix = 'set PATH=%USERPROFILE%\\.cargo\\bin;%PATH% && ';
      } else if (server.packageManager === 'go' || server.id === 'go') {
        envPrefix = 'set PATH=%USERPROFILE%\\go\\bin;C:\\Program Files\\Go\\bin;%PATH% && ';
      }

      // Execute command via Windows cmd.exe
      const fullCmd = `cmd.exe /c "${envPrefix}${server.installCommand}"`;
      const res = await window.Neutralino.os.execCommand(fullCmd);

      notificationService.dismiss(progressNotif);

      if (res.exitCode === 0) {
        // Clear registry cache so it detects the newly installed binary
        lspServerRegistry.clearCache();
        const verified = await lspServerRegistry.isServerInstalled(server);

        notificationService.success(
          'Language Server Ready',
          `${server.name} has been successfully installed and is ready for use.`,
          [{
            label: 'View Settings',
            onClick: () => {
              window.dispatchEvent(new CustomEvent('gitero:open-settings', { detail: { tab: 'lsp' } }));
            }
          }]
        );

        window.dispatchEvent(new CustomEvent('gitero:lsp-server-installed', {
          detail: { serverId: server.id, server, verified }
        }));

        return { success: true };
      } else {
        const errorMsg = (res.stdErr || res.stdOut || 'Process exited with non-zero status').trim();
        notificationService.error(
          'Installation Failed',
          `Failed to install ${server.name}.`,
          [{
            label: 'Copy Command',
            onClick: () => {
              navigator.clipboard.writeText(server.installCommand || '');
              notificationService.info('Copied', 'Command copied to clipboard.');
            }
          }]
        );

        return { success: false, error: errorMsg };
      }
    } catch (err: any) {
      notificationService.dismiss(progressNotif);
      const errMsg = err?.message || 'Execution failed';
      notificationService.error(
        'Installation Error',
        `An error occurred while installing ${server.name}: ${errMsg}`
      );
      return { success: false, error: errMsg };
    } finally {
      this.installingServers.delete(server.id);
      window.dispatchEvent(new CustomEvent('gitero:lsp-install-status', {
        detail: { serverId: server.id, status: 'idle' }
      }));
    }
  }

  private inferTool(cmd: string): string | null {
    const trimmed = cmd.trim();
    if (trimmed.startsWith('npm')) return 'npm';
    if (trimmed.startsWith('pip')) return 'pip';
    if (trimmed.startsWith('rustup')) return 'rustup';
    if (trimmed.startsWith('go')) return 'go';
    if (trimmed.startsWith('winget')) return 'winget';
    return null;
  }
}

export const lspInstaller = new LspInstallerService();
