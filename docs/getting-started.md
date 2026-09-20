# Getting Started with Gitero IDE

This guide walks you through installing Gitero IDE, opening your first workspace, navigating the interface, creating files, and configuring preferences.

---

## Installation

### Windows Installer (Recommended)
1. Download `Gitero-Setup-0.3.5-beta.exe` from the GitHub Releases page.
2. Run the executable.
3. The setup wizard installs Gitero IDE to `%LOCALAPPDATA%\Programs\Gitero IDE`.
4. Optionally check the box to add the **"Open with Gitero"** option to your Windows Explorer context menu.
5. Finish the installation and launch Gitero IDE.

### Windows Explorer Context Menu Integration
When enabled during installation, you can right-click:
- Any file to open it directly in Gitero IDE.
- Any directory or empty space inside a folder to open that folder as your active workspace.
- Any drive root (e.g. `C:\` or `D:\`) to open the drive in Gitero IDE.

---

## User Interface Overview

Gitero IDE features a clean, responsive VS Code-styled layout:

```
+-------------------------------------------------------------------------+
| Gitero IDE  -  [File]  [Edit]  [Selection]  [View]  [Preferences]   _ O X| <- Custom Frameless Titlebar
+---------+---------------------------------------------------------------+
|         | [filename.ts X] [README.md] [+]                               | <- Tab Bar
| Sidebar | src > editor > filename.ts                                    | <- Breadcrumb Navigation
| Tree    |---------------------------------------------------------------|
|         | 1 | import { EditorView } from '@codemirror/view';            |
| - src   | 2 |                                                           | <- CodeMirror 6 Editor
|   - ui  | 3 | export class Example { ... }                              |
|   main  |                                                               |
|         |                                                               |
+---------+---------------------------------------------------------------+
| NORMAL  | Ln 1, Col 1  |  UTF-8  |  TypeScript  |  Tokyo Night          | <- Status Bar
+---------+---------------------------------------------------------------+
```

### 1. Frameless Title Bar
- Contains the application window drag zone and standard window controls (Minimize, Maximize, Close).
- Includes classic dropdown menus: `File`, `Edit`, `Selection`, `View`, `Preferences`, and `Help`.
- Displays the active file and workspace directory name.

### 2. Activity Bar & Sidebar
- **Explorer Icon**: Click to toggle the file tree explorer (or press `Ctrl+B`).
- **Theme Icon**: Click to open the live theme selector.
- **Settings Icon**: Click to open the Settings and Custom CSS modal (or press `Ctrl+,`).
- **Workspace Header**: Displays the name of the currently active directory.
- **Action Buttons**: Includes buttons to create a new file, create a new folder, refresh the workspace, or open a different directory.

### 3. Tab Bar & Breadcrumbs
- Displays all currently opened documents.
- Dirty state indicator (a rounded badge on the tab) appears when a document has unsaved changes.
- Click `x` on any tab (or press `Ctrl+W` or `:q` in Vim mode) to close it.
- Breadcrumb bar displays the exact relative path of the file inside your project.

### 4. CodeMirror 6 Editor
- High-performance, modular text editor.
- Dynamic syntax highlighting automatically configured based on file extension.
- Bracket matching, auto-closing brackets, code folding gutter, and multi-selection support.

### 5. Status Bar
- **Vim Mode Pill**: Shows the active modal state (`NORMAL`, `INSERT`, `VISUAL`, `V-LINE`, `V-BLOCK`). Click the pill at any time to toggle Vim mode on or off.
- **Cursor Position**: Live line and column readout (`Ln X, Col Y`).
- **Encoding**: Standard `UTF-8` indicator.
- **Language Mode**: Detected programming language for the active document.
- **Theme Indicator**: Name of the active color theme. Click to quickly change themes.
- **Notification Area**: Displays temporary status alerts (such as "Saved active file", "Vim mode ENABLED", "Auto-saved filename.ts").

---

## Workspace Operations

### Opening a Folder
1. Use the menu: `File` > `Open Folder...` or click the folder icon in the sidebar.
2. Select your project folder in the native Windows folder picker.
3. The file tree instantly populates with all files and subdirectories.

### Creating New Files & Folders
- Click the **New File** icon above the sidebar (or press `Ctrl+N`).
- Enter the filename in the prompt. You can include subdirectories (e.g. `src/components/Button.tsx`) to create parent folders automatically.
- Click the **New Folder** icon to create a directory.

### Saving Files
- **Manual Save**: Press `Ctrl+S` or type `:w` in Vim Normal mode.
- **Save As**: Press `Ctrl+Shift+S` or select `File` > `Save As...`.
- **Auto-Save**: Enable auto-save in `Preferences` (`Ctrl+,`) or select `File` > `Auto Save`. Gitero will automatically save dirty files after a configurable delay (default: 1000ms).

### Quick File Navigation
- Press `Ctrl+P` to open the **Quick Open** list.
- Jump between open documents instantly using fuzzy matching.
