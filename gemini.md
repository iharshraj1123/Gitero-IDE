# Gitero IDE — Project Reference & Production Locations

## Production (Installed App) Locations

* **Installation Directory**:  
  `C:\Users\<user>\AppData\Local\Programs\Gitero IDE\`
* **Main Application Executable**:  
  `C:\Users\<user>\AppData\Local\Programs\Gitero IDE\Gitero.exe`
* **Packaged Resources Bundle**:  
  `C:\Users\<user>\AppData\Local\Programs\Gitero IDE\resources.neu`
* **Configuration File**:  
  `C:\Users\<user>\AppData\Local\Programs\Gitero IDE\neutralino.config.json`
* **Application Icon**:  
  `C:\Users\<user>\AppData\Local\Programs\Gitero IDE\appIcon.ico`
* **Document File Icons**:  
  `C:\Users\<user>\AppData\Local\Programs\Gitero IDE\icons\file-types\`

---

## Installer Artifacts

* **Output Folder**:  
  `d:\ProjectsNew\appDev2\Gitero IDE\installer-output\`
* **Current Installer Executable**:  
  `d:\ProjectsNew\appDev2\Gitero IDE\installer-output\Gitero-Setup-0.3.1-beta.exe`
* **Inno Setup Script**:  
  `d:\ProjectsNew\appDev2\Gitero IDE\installer\gitero.iss`

---

## Repository & Version Info

* **GitHub Repository**: [https://github.com/iharshraj1123/Gitero-IDE](https://github.com/iharshraj1123/Gitero-IDE)
* **Active Branch**: `main`
* **Current Version**: `0.3.1-beta`

---

## Custom Neutralino Native Engine Fork (`iharshraj1123/neutralinojs`)

* **Repository**: [https://github.com/iharshraj1123/neutralinojs](https://github.com/iharshraj1123/neutralinojs) (branch: `main`)
* **CI Workflow**: `.github/workflows/build-gitero-binary.yml` compiles patched Windows x64 binary artifact (`gitero-win_x64`).
* **Binary Targets**: `bin/gitero-win_x64.exe` and `bin/neutralino-win_x64.exe`.
* **C++ Engine Patches**:
  1. **Per-Monitor DPI V2**: Enforces `DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2` before `CreateWindow` to prevent fractional scaling dead-zones.
  2. **Maximized Work-Area Alignment**: Handles `WM_NCCALCSIZE` and `WM_GETMINMAXINFO` using `mi.rcWork` to prevent 7-8px border clipping.
  3. **Auto-Hide Taskbar Sensor**: Reserves 1px at bottom edge when `rcWork == rcMonitor` so auto-hiding taskbars pop up on cursor hover.
  4. **Taskbar App Window Registration**: Restores `WS_EX_APPWINDOW` in `__undoFakeHidden()` so app icon appears on the taskbar.
  5. **DWM System Backdrop (Desktop Acrylic)**: Applies `DWMWA_SYSTEMBACKDROP_TYPE` (`38`) with `DWMSBT_TRANSIENTWINDOW` (`3`) for native blurred backdrop or `DWMSBT_NONE` (`1`) for 100% clear transparency; suppresses native caption buttons via `DWMWA_NCRENDERING_POLICY` (`DWMNCRP_DISABLED`) and strips `WS_SYSMENU | WS_MINIMIZEBOX | WS_MAXIMIZEBOX`.
  6. **Dead-Zone & Click Pass-Through Fix**: Permanently strips `WS_EX_LAYERED` and legacy `SetWindowCompositionAttribute` calls to guarantee 100% hit testing across the screen at fractional DPI scales (e.g. 125%).
  7. **Ghost Window & Stale Redirection Elimination**: Creates window with `WS_EX_NOREDIRECTIONBITMAP` (`0x00200000L`) via `CreateWindowEx`, sets `wc.hbrBackground = nullptr`, and suppresses `WM_ERASEBKGND` to prevent DWM from caching outdated GDI redirection bitmaps behind WebView2.
  8. **Non-Client Frame Suppression on Inactivity**: Handles `WM_NCACTIVATE` returning `DefWindowProc(hwnd, msg, wp, -1)` and `WM_NCPAINT` returning `0` when borderless to stop Windows from repainting inactive frames and flickering on focus loss.
  9. **Dynamic DWM Frame Synchronization**: Hooks `WM_WINDOWPOSCHANGED` (when `!(flags & SWP_NOSIZE)`) and `WM_SIZE` to re-invoke `DwmExtendFrameIntoClientArea(hwnd, &margins)`, ensuring backdrop bounds continuously track window resizing and maximize/restore transitions.
  10. **Native Windows 11 Rounded Corners**: Enforces `DWMWA_WINDOW_CORNER_PREFERENCE` (`33`) with `DWMWCP_ROUND` (`2`) in `TrySetWindowBackdrop()` and `setBorderless()`, enabling OS-level corner rounding and drop shadows for borderless windows.

---

## Stability & Fallback Anchors

* **Gitero IDE Stable Anchor**: Tag `v0.2.7-beta` & branch `stable/0.2.7-beta` at `5e03a57` on GitHub.
* **Neutralino Fork Stable Anchor**: Tag `v0.2.7-beta` & branch `stable/0.2.7-beta` at `930dfdc` on GitHub.
* Both repositories maintain these permanent fallback anchors for zero-loss recovery.

---

## Workspace Transparency & Glassmorphism Architecture

* **Service Controller**: `TransparencyService` (`src/services/transparencyService.ts`).
* **CSS Custom Properties**: Controls `--transparency-blur`, `--transparency-atmosphere-intensity`, `--opacity-master-bg`, `--opacity-master-fg`, and individual category opacities (`chrome`, `workspace`, `editor`, `overlays`).
* **Atmosphere Shaders**: Managed via `.app-glass-luminance` DOM element supporting presets (`none`, `deep-space`, `aurora`, `monochrome`, `accent`).
* **Corner Radius Synchronization**: Non-maximized window border radius (`workbench.windowBorderRadius`) defaults to `8px` (`--window-border-radius: 8px`), aligning the CSS `#app` container with Windows 11's native `DWMWCP_ROUND` geometry with zero gap. Maximize state cleanly resets radius to `0` via `body.window-maximized #app`.

---

## Useful Commands

| Command | Action |
| :--- | :--- |
| `npm run dev` | Start Vite development server with hot-reload (auto-syncs version) |
| `npm start` | Run the native desktop app with Neutralino CLI |
| `npm run build` | Compile TypeScript and bundle frontend to `dist/` (auto-syncs version) |
| `npm run sync:version` | Manually synchronize version from `package.json` to `neutralino.config.json` & Inno Setup |
| `npm run build:hotkey` | Compile Windows Explorer `Ctrl+.` background companion (`gitero_explorer_hotkey.exe`) |
| `npm run neu:build` | Package `dist/` into `dist/gitero/resources.neu` |
| `npm run installer` | Complete build: compile frontend, hotkey companion, bundle `resources.neu`, and generate installer (Run ONLY when explicitly instructed by user) |

---

## Automated Version Synchronization Architecture

* **Single Source of Truth**: `package.json` (`version`).
* **Vite Compile-Time Injection**: `vite.config.ts` reads `package.json` and injects `__APP_VERSION__`, `__GIT_COMMIT_SHA__`, and `__GIT_BRANCH__` into the frontend bundle at build/dev time.
* **Central Export (`src/version.ts`)**: Exports `APP_VERSION`, `DISPLAY_VERSION` (`v<version>`), `GIT_COMMIT_SHA`, and `GIT_BRANCH`, consumed by `src/main.ts` (Help -> About) and `src/services/updater.ts` (Settings -> Software Updates).
* **Automated Config Sync (`scripts/sync-version.js`)**: Automatically syncs version from `package.json` into `neutralino.config.json` (`version`), `installer/gitero.iss` (`#define MyAppVersion`), `README.md` (version badge & setup installer link), `gemini.md`, and documentation guides. Executes automatically before `npm run dev`, `npm run build`, and on `npm version`.
* **Version Bumping**: Run `npm version <x.y.z>-beta` (or `npm version <patch|minor|major>`) to bump across all project files at once.

---

## Windows Explorer `Ctrl+.` Hotkey Integration (`gitero_explorer_hotkey`)

* **Companion Executable**: `bin/gitero_explorer_hotkey.exe` (aliased as `bin/glitero_explorer_hotkey.exe`).
* **Source Location**: `src-native/explorer-hotkey/Program.cs` and `src-native/explorer-hotkey/build.bat`.
* **Behavior**:
  * Runs silently in the background (~19MB RAM, 0% CPU).
  * Hooks `Ctrl+.` via low-level keyboard hook (`WH_KEYBOARD_LL`).
  * Only intercepts when the foreground window is Windows File Explorer (`CabinetWClass` / `ExploreWClass`) or Desktop (`Progman` / `WorkerW`).
  * Passes through `Ctrl+.` completely untouched in all other applications (VS Code, browsers, word processors, etc.).
  * Automatically resolves active directory in both single-window and multi-tab Windows 11 Explorer views, then launches `Gitero.exe "<directory>"`.
* **Installer Registration**:
  * Optional task during installation: `[x] Enable Ctrl+. shortcut in Windows Explorer to open active folder in Gitero`.
  * Auto-starts with Windows login via `HKCU\Software\Microsoft\Windows\CurrentVersion\Run\GiteroExplorerHotkey`.
  * Cleanly killed during upgrades or uninstallation via `taskkill.exe`.

---

## Architecture Note: Why resources.neu is Required in Production

In Neutralinojs:
1. When running in developer mode (`neu run` or with `--load-dir-res`), it loads unpackaged files directly from `/dist/`.
2. In production (`Gitero.exe`), the binary looks for the pre-packaged `resources.neu` archive in its directory.
3. If `resources.neu` is missing, the binary falls back to its internal fallback default sample page.
4. The updated installer bundles `resources.neu` directly beside `Gitero.exe`, launching the real Gitero IDE instantly (<80ms).

---

## Neutralino Port & Native Storage Architecture

* **Dynamic Port (`port: 0`)**: Assigned randomly on every launch to avoid port collisions and support multiple instances.
* **WebView2 Origin Partitioning**: Browser `localStorage` is scoped to `protocol://host:port`. Changing ports resets `localStorage` to empty.
* **Native Storage Bridge**: `neutralino.config.json` sets `"storageLocation": "system"` (`%APPDATA%\com.gitero.ide\.storage`). `PersistentStorageService` (`src/services/storage.ts`) hydrates `localStorage` on bootstrap and mirrors all writes to disk, ensuring settings, tabs, and recent workspaces persist across launches.

---

## Guide: Adding Support for a New File Type & Language

Follow this complete step-by-step checklist whenever introducing support for a new file format or programming language in Gitero IDE:

### 1. CodeMirror Language Parser & Detection (`src/editor/languages.ts`)
* Install the official parser package if available (e.g. `npm install @codemirror/lang-<name>`).
* Import the parser function at the top of `src/editor/languages.ts`.
* In `detectLanguage(filePath: string)`:
  * Add the file extension case(s) mapped to the language name and parser extension (e.g. `case 'php': return { name: 'PHP', extension: () => php() };`).
* In `SUPPORTED_LANGUAGES`:
  * Add `{ name: '<LanguageName>', extension: () => <parser>() }` so it appears in the Status Bar language switcher and Command Palette.

### 2. UI & File Tree Icons (`src/ui/icons.ts`)
Update all three built-in icon themes:
* **Badges Theme**: Add entry to `BADGE_MAP` with clean abbreviation, background color, and text color (e.g. `php: { text: 'PHP', bg: '#8892be', fg: '#fff' }`).
* **Lucide Theme**: Add entry to `LUCIDE_COLOR_MAP` with appropriate Lucide icon component and accent color.
* **Material Theme**: In `getMaterialIcon()`, add an SVG branch returning the colored badge/glyph rectangle.

### 3. Editor Snippets & Boilerplates (`src/editor/snippets.ts`)
* Add commonly used templates, functions, and language starter structures to `SNIPPETS` with `languages: ['<LanguageName>']`.

### 4. Dedicated Windows Document Icon (`public/icons/file-types/`, `icons/file-types/`)
* **Never use the Gitero application logo for file types**. Files must represent what they are.
* Generate a multi-resolution `.ico` (`document-<name>.ico`) containing 7 standard Windows layers: `16x16`, `24x24`, `32x32`, `48x48`, `64x64`, `128x128`, and `256x256` at 32-bit color depth with alpha transparency.
* Design standard: White paper sheet with folded top-right dog-ear corner, subtle preview lines, and an official emblem/badge.
* Mirror both `.ico` and `.png` to `public/icons/file-types/` and `icons/file-types/`.

### 5. In-App File Association Service (`src/services/fileAssociation.ts`)
* Add the file definition to `SUPPORTED_FILE_TYPES`:
  * `id`: unique string ID
  * `name`: display name (e.g. `'PHP Source Files'`)
  * `extensions`: array of extensions (e.g. `['.php', '.phtml']`)
  * `progId`: Windows ProgID (e.g. `'Gitero.PHP'`)
  * `iconName`: icon filename (e.g. `'document-php.ico'`)
  * `description`: short description

### 6. Windows Installer & Shell Integration (`installer/gitero.iss`)
* In `[Registry]`:
  * Register the ProgID:
    * `HKCU\Software\Classes\Gitero.<Name>`: Default description
    * `HKCU\Software\Classes\Gitero.<Name>\FriendlyTypeName`: Description
    * `HKCU\Software\Classes\Gitero.<Name>\DefaultIcon`: `"{app}\icons\file-types\document-<name>.ico"` (clean direct path, no `,0`)
    * `HKCU\Software\Classes\Gitero.<Name>\shell\open\command`: `"""{app}\{#MyAppExeName}"" ""%1"""`
  * Register Explorer auto-file fallback icon so "Open with" -> "Always" never defaults to the app logo:
    * `HKCU\Software\Classes\<ext>_auto_file\DefaultIcon`: `"{app}\icons\file-types\document-<name>.ico"` (clean direct path, no `,0`)
  * Register `OpenWithProgids`:
    * `HKCU\Software\Classes\.<ext>\OpenWithProgids`: `Gitero.<Name>` = `""`
  * Add to association tasks (e.g. `assoc_code` or `assoc_md`).
  * Register under Windows Default Programs:
    * `HKCU\Software\Gitero\Capabilities\FileAssociations`: `.<ext>` = `Gitero.<Name>`

### 7. Verification & Production Build
1. `npm run build` — TypeScript typecheck and Vite frontend bundling.
2. `npm run neu:build` — Package web bundle into `dist/gitero/resources.neu`.
3. `npm run installer` — Compile Inno Setup installer executable (`installer-output/Gitero-Setup-<version>.exe`) when explicitly instructed by user.
4. Test opening sample files in the app and verifying syntax highlighting and file tree icons.

---

## Preferences Storage Architecture

* **Central Store**: `localStorage.getItem('gitero_preferences_v1')` (JSON document managed by `PreferencesService` in `src/services/preferences.ts`).
* **Schema**:
  * `editor.cursorStyle`: `'line' | 'block' | 'underline'` (Default: `'line'`)
  * `editor.cursorBlinking`: `'blink' | 'smooth' | 'solid'` (Default: `'blink'`)
  * `editor.fontFamily`: string (Default: Cascadia Code / Fira Code monospace stack)
  * `editor.fontSize`: number (Default: `14`)
  * `editor.theme`: string (Default: `'github-dark'`)
  * `editor.vimEnabled`: boolean (Default: `true`)
  * `editor.customCss`: string (Default: `''`)
  * `editor.tabSize`: number (Default: `2`)
  * `editor.wordWrap`: boolean (Default: `false`)
  * `files.autoSave`: boolean (Default: `false`)
  * `files.autoSaveDelay`: number in ms (Default: `1000`)
  * `keybindings`: Record<string, string> (customizable shortcut mappings)
* **Legacy Sync**: Automatically migrates and two-way mirrors legacy keys (`gitero_theme_id`, `gitero_font_family`, `gitero_font_size`, `gitero_vim_enabled`, `gitero_custom_css`) for zero data loss.
* **Reactivity**: Components subscribe via `preferencesService.subscribe(key, callback)` for instant live updates across the app.

---

## Strict Project Rules

1. **Strictly No Emojis**:
   * This is a serious developer application. Do not use emoji characters anywhere in the UI, modals, buttons, tabs, logs, messages, or codebase.
   * Always use real vector icons (clean inline SVGs or Lucide icons) or clean text badges.

2. **Git Push on Every Commit**:
   * Whenever a git commit is made, always immediately `git push` to the respective remote branch on GitHub (`https://github.com/iharshraj1123/Gitero-IDE`).

3. **Keybindings in Settings**:
   * Whenever a new keybinding is introduced, it must also be added to the Settings modal where it can be customized and edited. Persist mappings in `PreferencesService`.

4. **Do Not Run `npm run installer` Automatically**:
   * Do not run `npm run installer` unless the user explicitly tells you to run it. The user manages building and running the installer executable themselves.

5. **Never Directly Modify Installed Production Files**:
   * Never copy files directly into the installed production app directory (`C:\Users\ihars\AppData\Local\Programs\Gitero IDE\`).
   * The user uses the generated installer to perform updates.
   * All focus and testing should be placed on ensuring the installer script (`installer/gitero.iss`) and build outputs (`dist/`, `resources.neu`, `bin/`) package everything cleanly so the installer can seamlessly update all files, shortcuts, hotkeys, and registry associations.
