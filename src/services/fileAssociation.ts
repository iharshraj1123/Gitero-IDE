/**
 * Gitero IDE - File Association & Document Icon Service
 *
 * Manages Windows file associations and ensures that all associated file types
 * (Markdown, Code, Web, Data, Plain Text) display dedicated document-style icons
 * in Windows Explorer, rather than the Gitero IDE application executable logo.
 */

export interface FileTypeDefinition {
  id: string;
  name: string;
  extensions: string[];
  progId: string;
  iconName: string;
  description: string;
}

export const SUPPORTED_FILE_TYPES: FileTypeDefinition[] = [
  {
    id: 'markdown',
    name: 'Markdown Documents',
    extensions: ['.md', '.markdown', '.mdown', '.mkd'],
    progId: 'Gitero.Markdown',
    iconName: 'document-markdown.ico',
    description: 'Markdown files with official M↓ badge'
  },
  {
    id: 'typescript',
    name: 'TypeScript Files',
    extensions: ['.ts', '.tsx', '.mts', '.cts'],
    progId: 'Gitero.TypeScript',
    iconName: 'document-typescript.ico',
    description: 'TypeScript files with TS badge'
  },
  {
    id: 'javascript',
    name: 'JavaScript Files',
    extensions: ['.js', '.jsx', '.mjs', '.cjs'],
    progId: 'Gitero.JavaScript',
    iconName: 'document-javascript.ico',
    description: 'JavaScript files with JS badge'
  },
  {
    id: 'python',
    name: 'Python Scripts',
    extensions: ['.py', '.pyw'],
    progId: 'Gitero.Python',
    iconName: 'document-python.ico',
    description: 'Python scripts with PY badge'
  },
  {
    id: 'html',
    name: 'HTML Documents',
    extensions: ['.html', '.htm'],
    progId: 'Gitero.HTML',
    iconName: 'document-html.ico',
    description: 'HTML markup with < > badge'
  },
  {
    id: 'css',
    name: 'CSS & Stylesheets',
    extensions: ['.css', '.scss', '.sass', '.less'],
    progId: 'Gitero.CSS',
    iconName: 'document-css.ico',
    description: 'CSS stylesheets with # badge'
  },
  {
    id: 'json',
    name: 'JSON Files',
    extensions: ['.json', '.jsonc'],
    progId: 'Gitero.JSON',
    iconName: 'document-json.ico',
    description: 'JSON data files with { } badge'
  },
  {
    id: 'yaml',
    name: 'YAML & Config Files',
    extensions: ['.yaml', '.yml', '.toml'],
    progId: 'Gitero.YAML',
    iconName: 'document-yaml.ico',
    description: 'Configuration files with YML badge'
  },
  {
    id: 'shell',
    name: 'Shell & Script Files',
    extensions: ['.sh', '.bash', '.zsh', '.ps1', '.bat', '.cmd'],
    progId: 'Gitero.Shell',
    iconName: 'document-shell.ico',
    description: 'Shell scripts with >_ badge'
  },
  {
    id: 'code',
    name: 'Source Code Files',
    extensions: ['.c', '.cpp', '.h', '.hpp', '.rs', '.go', '.java', '.sql', '.xml'],
    progId: 'Gitero.Code',
    iconName: 'document-code.ico',
    description: 'Source code files with </> badge'
  },
  {
    id: 'text',
    name: 'Plain Text Files',
    extensions: ['.txt', '.log', '.ini', '.conf'],
    progId: 'Gitero.Text',
    iconName: 'document-text.ico',
    description: 'Plain text files with document lines'
  }
];

export class FileAssociationService {
  public isWindows(): boolean {
    return navigator.userAgent.includes('Windows') || navigator.platform.includes('Win');
  }

  /**
   * Determine paths to icons and executable
   */
  private getSystemPaths(): { iconsDir: string; exePath: string } {
    const nl = (window as any).NL_PATH || '';
    const norm = nl.replace(/\//g, '\\');

    // Default production install directory
    const prodAppDir = 'C:\\Users\\ihars\\AppData\\Local\\Programs\\Gitero IDE';
    const prodExe = `${prodAppDir}\\Gitero.exe`;
    const prodIcons = `${prodAppDir}\\icons\\file-types`;

    if (norm.includes('Programs\\Gitero IDE')) {
      return {
        iconsDir: `${norm}\\icons\\file-types`,
        exePath: `${norm}\\Gitero.exe`
      };
    }

    // In dev / portable mode:
    const devIcons = `${norm}\\public\\icons\\file-types`;
    const devExe = `${norm}\\bin\\gitero-win_x64.exe`;

    return {
      iconsDir: norm ? devIcons : prodIcons,
      exePath: norm ? devExe : prodExe
    };
  }

  /**
   * Register file associations for a given list of file types
   */
  public async registerFileTypes(types: FileTypeDefinition[]): Promise<{ success: boolean; registered: number; error?: string }> {
    if (!this.isWindows()) {
      return { success: false, registered: 0, error: 'File association is currently only supported on Windows.' };
    }

    const neutralino = (window as any).Neutralino;
    if (!neutralino?.os?.execCommand) {
      return { success: false, registered: 0, error: 'Neutralino native OS API is not available.' };
    }

    const { iconsDir, exePath } = this.getSystemPaths();
    const fallbackDocIcon = `${iconsDir}\\document.ico,0`;

    const commands: string[] = [];

    // 1. Register Applications\Gitero.exe default icon to fallback document icon rather than app logo
    commands.push(`reg add "HKCU\\Software\\Classes\\Applications\\Gitero.exe" /v "FriendlyAppName" /t REG_SZ /d "Gitero IDE" /f`);
    commands.push(`reg add "HKCU\\Software\\Classes\\Applications\\Gitero.exe" /v "Icon" /t REG_SZ /d "${fallbackDocIcon}" /f`);
    commands.push(`reg add "HKCU\\Software\\Classes\\Applications\\Gitero.exe\\DefaultIcon" /ve /t REG_SZ /d "${fallbackDocIcon}" /f`);
    commands.push(`reg add "HKCU\\Software\\Classes\\Applications\\Gitero.exe\\SupportedTypes" /v ".*" /t REG_SZ /d "" /f`);
    commands.push(`reg add "HKCU\\Software\\Classes\\Applications\\Gitero.exe\\shell\\open\\command" /ve /t REG_SZ /d "\\"${exePath}\\" \\"%1\\"" /f`);

    let registeredCount = 0;

    for (const type of types) {
      const iconPath = `${iconsDir}\\${type.iconName},0`;

      // ProgID registration
      commands.push(`reg add "HKCU\\Software\\Classes\\${type.progId}" /ve /t REG_SZ /d "${type.name}" /f`);
      commands.push(`reg add "HKCU\\Software\\Classes\\${type.progId}" /v "FriendlyTypeName" /t REG_SZ /d "${type.name}" /f`);
      commands.push(`reg add "HKCU\\Software\\Classes\\${type.progId}\\DefaultIcon" /ve /t REG_SZ /d "${iconPath}" /f`);
      commands.push(`reg add "HKCU\\Software\\Classes\\${type.progId}\\shell\\open\\command" /ve /t REG_SZ /d "\\"${exePath}\\" \\"%1\\"" /f`);

      for (const ext of type.extensions) {
        // Associate OpenWithProgids
        commands.push(`reg add "HKCU\\Software\\Classes\\${ext}\\OpenWithProgids" /v "${type.progId}" /t REG_SZ /d "" /f`);
        
        // Auto-file icon override: ensures Windows Explorer "Open With" fallback uses document icon instead of app logo
        const cleanExt = ext.replace(/^\./, '');
        const autoFileKey = `${cleanExt}_auto_file`;
        commands.push(`reg add "HKCU\\Software\\Classes\\${autoFileKey}\\DefaultIcon" /ve /t REG_SZ /d "${iconPath}" /f`);
        
        registeredCount++;
      }
    }

    try {
      // Execute registration batch
      const batchCommand = commands.join(' && ');
      await neutralino.os.execCommand(batchCommand);

      // Refresh Windows Explorer icon cache
      await this.refreshWindowsIconCache();

      return { success: true, registered: registeredCount };
    } catch (err: any) {
      console.error('Failed to register file associations:', err);
      return { success: false, registered: 0, error: err?.message || String(err) };
    }
  }

  /**
   * Specifically set Gitero as default reader for Markdown files (.md, .markdown)
   */
  public async registerMarkdownAsDefault(): Promise<{ success: boolean; error?: string }> {
    const mdType = SUPPORTED_FILE_TYPES.find(t => t.id === 'markdown');
    if (!mdType) return { success: false, error: 'Markdown file type not found.' };

    const res = await this.registerFileTypes([mdType]);
    if (!res.success) return res;

    // Set as primary default ProgID for .md and .markdown
    const neutralino = (window as any).Neutralino;
    if (neutralino?.os?.execCommand) {
      try {
        await neutralino.os.execCommand(
          `reg add "HKCU\\Software\\Classes\\.md" /ve /t REG_SZ /d "Gitero.Markdown" /f && ` +
          `reg add "HKCU\\Software\\Classes\\.markdown" /ve /t REG_SZ /d "Gitero.Markdown" /f`
        );
        await this.refreshWindowsIconCache();
      } catch (err) {
        console.warn('Could not set primary default ProgID:', err);
      }
    }

    return { success: true };
  }

  /**
   * Register all supported code, web, data, and text file associations with their document icons
   */
  public async registerAll(): Promise<{ success: boolean; registered: number; error?: string }> {
    return this.registerFileTypes(SUPPORTED_FILE_TYPES);
  }

  /**
   * Force Windows Explorer to re-query file associations and refresh its icon cache
   */
  public async refreshWindowsIconCache(): Promise<boolean> {
    const neutralino = (window as any).Neutralino;
    if (!neutralino?.os?.execCommand) return false;

    try {
      // ie4uinit.exe -show flushes Windows Explorer icon cache immediately
      await neutralino.os.execCommand('ie4uinit.exe -show');
      return true;
    } catch (err) {
      console.warn('Failed to invoke ie4uinit:', err);
      return false;
    }
  }
}

export const fileAssociationService = new FileAssociationService();
