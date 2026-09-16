# Gitero IDE — Project Reference & Production Locations

## Production (Installed App) Locations

* **Installation Directory**:  
  `C:\Users\ihars\AppData\Local\Programs\Gitero IDE\`
* **Main Application Executable**:  
  `C:\Users\ihars\AppData\Local\Programs\Gitero IDE\Gitero.exe`
* **Packaged Resources Bundle**:  
  `C:\Users\ihars\AppData\Local\Programs\Gitero IDE\resources.neu`
* **Configuration File**:  
  `C:\Users\ihars\AppData\Local\Programs\Gitero IDE\neutralino.config.json`
* **Application Icon**:  
  `C:\Users\ihars\AppData\Local\Programs\Gitero IDE\appIcon.ico`
* **Document File Icons**:  
  `C:\Users\ihars\AppData\Local\Programs\Gitero IDE\icons\file-types\`

---

## Installer Artifacts

* **Output Folder**:  
  `d:\ProjectsNew\appDev2\Gitero IDE\installer-output\`
* **Current Installer Executable**:  
  `d:\ProjectsNew\appDev2\Gitero IDE\installer-output\Gitero-Setup-0.1.2-beta.exe`
* **Inno Setup Script**:  
  `d:\ProjectsNew\appDev2\Gitero IDE\installer\gitero.iss`

---

## Repository & Version Info

* **GitHub Repository**: [https://github.com/iharshraj1123/Glitero-IDE](https://github.com/iharshraj1123/Glitero-IDE)
* **Active Branch**: `main`
* **Current Version**: `0.1.2-beta`

---

## Useful Commands

| Command | Action |
| :--- | :--- |
| `npm run dev` | Start Vite development server with hot-reload |
| `npm start` | Run the native desktop app with Neutralino CLI |
| `npm run build` | Compile TypeScript and bundle frontend to `dist/` |
| `npm run neu:build` | Package `dist/` into `dist/gitero/resources.neu` |
| `npm run installer` | Complete build: compile frontend, bundle `resources.neu`, and generate `Gitero-Setup-0.1.2-beta.exe` |

---

## Architecture Note: Why resources.neu is Required in Production

In Neutralinojs:
1. When running in developer mode (`neu run` or with `--load-dir-res`), it loads unpackaged files directly from `/dist/`.
2. In production (`Gitero.exe`), the binary looks for the pre-packaged `resources.neu` archive in its directory.
3. If `resources.neu` is missing, the binary falls back to its internal fallback default sample page.
4. The updated installer bundles `resources.neu` directly beside `Gitero.exe`, launching the real Gitero IDE instantly (<80ms).

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
    * `HKCU\Software\Classes\Gitero.<Name>\DefaultIcon`: `"{app}\icons\file-types\document-<name>.ico,0"`
    * `HKCU\Software\Classes\Gitero.<Name>\shell\open\command`: `"""{app}\{#MyAppExeName}"" ""%1"""`
  * Register Explorer auto-file fallback icon so "Open with" -> "Always" never defaults to the app logo:
    * `HKCU\Software\Classes\<ext>_auto_file\DefaultIcon`: `"{app}\icons\file-types\document-<name>.ico,0"`
  * Register `OpenWithProgids`:
    * `HKCU\Software\Classes\.<ext>\OpenWithProgids`: `Gitero.<Name>` = `""`
  * Add to association tasks (e.g. `assoc_code` or `assoc_md`).
  * Register under Windows Default Programs:
    * `HKCU\Software\Gitero\Capabilities\FileAssociations`: `.<ext>` = `Gitero.<Name>`

### 7. Verification & Production Build
1. `npm run build` — TypeScript typecheck and Vite frontend bundling.
2. `npm run neu:build` — Package web bundle into `dist/gitero/resources.neu`.
3. `npm run installer` — Compile Inno Setup installer executable (`installer-output/Gitero-Setup-<version>.exe`).
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
   * Whenever a git commit is made, always immediately `git push` to the respective remote branch on GitHub (`https://github.com/iharshraj1123/Glitero-IDE`).

3. **Keybindings in Settings**:
   * Whenever a new keybinding is introduced, it must also be added to the Settings modal where it can be customized and edited. Persist mappings in `PreferencesService`.
