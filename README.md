# Gitero IDE

**High-Performance Developer Studio with Native Neutralino Engine & Modal Vim Editing**

[![Version](https://img.shields.io/badge/version-0.1.2--beta-blue.svg?style=flat-square)](https://github.com/iharshraj1123/Gitero-IDE/releases)
[![Runtime](https://img.shields.io/badge/runtime-Neutralinojs%20v6.9.0-2563eb.svg?style=flat-square)](https://neutralino.js.org/)
[![Editor Engine](https://img.shields.io/badge/editor-CodeMirror%206-d97706.svg?style=flat-square)](https://codemirror.net/)
[![Language](https://img.shields.io/badge/language-TypeScript%205-3178c6.svg?style=flat-square)](https://www.typescriptlang.org/)
[![Platform](https://img.shields.io/badge/platform-Windows%20x64-0078d4.svg?style=flat-square)](https://github.com/iharshraj1123/Gitero-IDE)
[![License](https://img.shields.io/badge/license-Custom%20(Non--Commercial)-red.svg?style=flat-square)](LICENSE)

---

## Overview

<img width="1622" height="937" alt="image" src="https://github.com/user-attachments/assets/ac3be809-58af-4dd9-b484-dda3dc81476c" />


<img width="1917" height="1077" alt="image" src="https://github.com/user-attachments/assets/d09e5db8-b153-4c09-b036-46fb71b1efde" />


Gitero IDE is a lightweight (~4 MB installer, <10MB RAM), ultra-fast native code editor engineered for developers who demand sub-80ms startup times, minimal memory consumption, authentic Vim modal editing, and deep customizability. 

Built on the **Neutralinojs native runtime** and **CodeMirror 6**, Gitero eliminates the heavy RAM footprint and sluggish launch times of traditional Electron applications while providing a modern VS Code-like workspace, integrated terminal, built-in Git source control, workspace-wide search, live theme switching, custom CSS injection, native Windows shell document associations, and an in-app GitHub branch updater.

---

## Key Features

### Ultra-Fast Native Performance
- **Sub-80ms Cold Starts**: Launches almost instantly via native OS webview integration.
- **Tiny Memory Footprint**: Idles around ~35MB RAM compared to 400MB+ for standard Electron IDEs.
- **Lightweight Distribution**: Packaged Windows installer is under 5MB, bundling native x64 binaries with pre-packaged `resources.neu`.
- **Dynamic Port & Native Storage Bridge**: Automatically avoids port collisions using dynamic ports while persisting all configuration, open tabs, and recent workspaces to `%APPDATA%\com.gitero.ide\.storage`.

### Full Modal Vim Editing Built-In
- **Native Modal Editing**: Full support for Normal, Insert, Visual, Visual-Line, Visual-Block, and Replace modes.
- **Ex Commands**: Support for `:w` (save file), `:q` (quit tab), `:wq` (save and close), and `:x`.
- **Live Status Indicator**: Real-time mode pill in the status bar with instant one-click toggling between Vim mode and standard editing.
- **Decoupled Cursor Styling**: Cycle cursor styles (Line, Block, Underline via `Alt+0`) without disrupting modal state or injecting fake keystrokes.

### Integrated Terminal
- **Native Command Execution**: Integrated multi-instance terminal panel powered directly by native OS shell execution.
- **Customizable Typography**: Independent font family and font size controls for terminal output.
- **Quick Toggle**: Seamlessly show or hide the terminal pane anytime with ``Ctrl + ` ``.

### Git Source Control & Repository Management
- **Source Control View (`Ctrl+Shift+G`)**: Track changed, staged, and untracked files with status badges.
- **Branch Management (`Ctrl+Shift+B`)**: Switch branches, view active branch state, and inspect remote tracking.
- **One-Click Synchronization (`Ctrl+Shift+U`)**: Push and pull upstream changes directly from the status bar or Command Palette.

### Global Search & Navigation
- **Workspace Find in Files (`Ctrl+Shift+F`)**: Fast full-workspace search engine with real-time match results.
- **Configurable Filters**: Toggle match case, whole word, and regular expressions.
- **Quick Open (`Ctrl+P`)**: Rapid fuzzy file finder for instantaneous jumping across large codebases.
- **Go to Line (`Ctrl+G`)**: Instant line and column navigation.

### Multi-Language Grammar & Syntax Highlighting
- **15+ First-Class Languages**: Built-in support with CodeMirror 6 parsers:
  - TypeScript, JavaScript, Python, Rust, C++, Go, PHP, Java
  - HTML, CSS, JSON, Markdown, SQL, XML, YAML
- **Markdown Live Preview (`Ctrl+Shift+V`)**: Dual-mode raw markdown editor and formatted live preview.

### Windows Shell & Explorer Integration
- **Ctrl+. Active Directory Hotkey**: Press `Ctrl+.` inside any Windows File Explorer window or Desktop to immediately launch Gitero IDE with that folder open as your workspace. Powered by a lightweight background companion (`gitero_explorer_hotkey.exe`) that passes keystrokes through untouched to all other applications.
- **Dedicated Document Icons**: Never uses the generic IDE logo for source files. Features handcrafted, 7-layer multi-resolution `.ico` document icons (sheet + folded dog-ear corner + language emblem) registered via Windows ProgIDs.
- **Shell Context Menus**: Right-click any file, directory, folder background, or drive in Windows Explorer to open directly in Gitero IDE.
- **User-Level Installation**: Installed via Inno Setup into Local AppData (`%LOCALAPPDATA%\Programs\Gitero IDE`), requiring no UAC administrative elevation.

### Themes & Visual Customization
- **Bundled Themes**: Tokyo Night, One Dark Pro, Dracula, Catppuccin Mocha, Monokai Classic, and GitHub Dark.
- **Theme Creator & Custom CSS**: Inject arbitrary CSS rules directly from settings to customize borders, glows, fonts, line heights, and syntax tokens.
- **Icon Themes**: Switch between Badges, Lucide vector icons, and Material Design file trees.
- **Fully Customizable Keybindings**: Complete keyboard shortcut manager in Settings with custom chord recording, search, and reset to defaults.

### In-App GitHub Branch Channel Updater
- **Branch Channel Switching**: Fetch and switch to any active branch directly from the settings dialog.
- **Zero Configuration Loss**: Updates strictly refresh application runtime bundles while leaving your themes, custom CSS, keybindings, and preferences completely untouched.

---

## Quick Start

### Option 1: Windows Production Installer
1. Download the latest installer `Gitero-Setup-0.1.2-beta.exe` from [Releases](https://github.com/iharshraj1123/Gitero-IDE/releases).
2. Run the installer. Gitero installs into `%LOCALAPPDATA%\Programs\Gitero IDE`.
3. Launch Gitero IDE from the Start Menu, Desktop shortcut, or right-click any folder and select **Open with Gitero**.

### Option 2: Running from Source

#### Prerequisites
- Node.js 18+ and npm
- Windows 10/11 (x64)

```powershell
# Clone the repository
git clone https://github.com/iharshraj1123/Gitero-IDE.git
cd "Gitero IDE"

# Install dependencies
npm install

# Run in development mode (Vite HMR + Neutralino CLI)
npm run dev

# Run desktop native application
npm start
```

---

## Keyboard Shortcuts Reference

| Shortcut | Action | Scope |
| :--- | :--- | :--- |
| `Ctrl + P` | Quick Open File | Global |
| `Ctrl + Shift + P` / `F1` | Open Command Palette | Global |
| `Ctrl + S` / `:w` | Save Active File | Editor |
| `Ctrl + Shift + S` | Save File As... | Editor |
| `Ctrl + N` | New Untitled File | Global |
| `Ctrl + O` | Open File Dialog | Global |
| `Ctrl + W` / `:q` | Close Active Tab | Editor |
| `Ctrl + B` | Toggle Explorer Sidebar Visibility | Global |
| `Ctrl + \`` | Toggle Integrated Terminal | Global |
| `Ctrl + Shift + F` | Find in Files (Global Search) | Global |
| `Ctrl + Shift + G` | Source Control (Git) View | Global |
| `Ctrl + Shift + B` | Git: Switch Branch | Global |
| `Ctrl + Shift + U` | Git: Sync / Push Remote Changes | Global |
| `Ctrl + Shift + V` | Toggle Markdown Live Preview | Markdown |
| `Ctrl + G` | Go to Line / Column | Editor |
| `Alt + Z` | Toggle Word Wrap | Editor |
| `Alt + 0` | Cycle Cursor Style (Line / Block / Underline) | Editor |
| `Ctrl + /` | Toggle Line Comment | Editor |
| `Ctrl + Shift + /` | Toggle Block Comment | Editor |
| `Ctrl + ,` | Open Settings & Custom CSS | Global |
| `Ctrl + K Ctrl + S` | Keyboard Shortcuts Reference | Global |
| `Ctrl + .` | Open Active Folder in Gitero (File Explorer / Desktop) | Windows Shell |
| `F11` | Toggle Full Screen | Global |
| `F12` / `Ctrl + Shift + I` | Toggle Developer Tools | Global |

### Vim Modal Shortcuts

| Key | Mode / Action | Description |
| :--- | :--- | :--- |
| `Esc` | Normal Mode | Exit typing and return to navigation/command mode |
| `i` | Insert Mode | Enter insert mode before current character |
| `a` | Append Mode | Enter insert mode after current character |
| `v` | Visual Mode | Start character-wise visual selection |
| `V` | Visual Line Mode | Start line-wise visual selection |
| `Ctrl + V` | Visual Block Mode | Start column/block selection |
| `:w` | Save | Save current file |
| `:q` | Quit | Close active editor tab |
| `:wq` / `:x` | Save and Quit | Save file and close tab |

---

## Documentation & Wiki

Explore detailed guides and documentation in the [`docs/`](docs/wiki.md) directory:

- [Wiki Navigation Hub](docs/wiki.md) - Complete documentation table of contents
- [Getting Started Guide](docs/getting-started.md) - Installation, workspace operations, and basic usage
- [Vim Modal Editing Guide](docs/vim-mode-guide.md) - Motions, operators, Ex commands, and configuration
- [Themes & Custom Styling](docs/themes-and-styling.md) - Color themes, typography, and custom CSS injection
- [Keyboard Shortcuts Cheat Sheet](docs/shortcuts-and-commands.md) - Full shortcut directory and Command Palette reference
- [In-App Branch Updater](docs/updater-and-branches.md) - Branch channel switching and update architecture
- [Development & Building](docs/development-and-building.md) - Local workflow, bundling `resources.neu`, and building installers

---

## Architecture & Tech Stack

```
Gitero IDE
├── Native Layer: Neutralinojs Runtime (C++ / OS Webview)
│   ├── Native Filesystem Access (neutralino.filesystem)
│   ├── Window & OS Management (neutralino.window, neutralino.os)
│   ├── Dynamic Port & Native Storage Bridge (%APPDATA%\com.gitero.ide\.storage)
│   └── System Shell Context Menus & File Associations
│
├── Windows Explorer Companion (C# / Win32 Hook)
│   ├── src-native/explorer-hotkey/Program.cs (WH_KEYBOARD_LL)
│   └── Global Ctrl+. Active Explorer Path Resolution
│
├── Frontend Core: TypeScript + Vite
│   ├── Editor Engine: CodeMirror 6
│   │   ├── Vim Keymap Adapter (@replit/codemirror-vim)
│   │   ├── Dynamic Syntax Highlighting (15+ languages)
│   │   └── Dynamic Theme Compartments
│   │
│   ├── State & Services:
│   │   ├── PreferencesService (Persistent Storage Bridge + Keybindings)
│   │   ├── ThemeManager (Tokens, Custom CSS, and File Icons)
│   │   ├── FileSystemService (Neutralino Native + Web FS Access)
│   │   ├── GitService (Branch switching, status, and synchronization)
│   │   └── UpdaterService (GitHub API branch tracking & live update)
│   │
│   └── User Interface Components:
│       ├── TitleBarComponent (Custom frameless window controls & menus)
│       ├── TabBarComponent (Multi-tab tracking with dirty state & breadcrumbs)
│       ├── FileTreeComponent (Hierarchical explorer, badges & file creation)
│       ├── TerminalPanelComponent (Multi-instance integrated terminal)
│       ├── SearchPanelComponent (Workspace-wide Find in Files)
│       ├── GitPanelComponent (Source control tracking & commit controls)
│       ├── StatusBarComponent (Vim mode pill, Git branch, cursor pos, themes)
│       ├── CommandPalette (Fuzzy action runner & quick file open)
│       └── SettingsModalComponent (Preferences, keybindings, CSS, & branch updates)
```

---

## Build Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts Vite local dev server with hot-reload |
| `npm start` | Launches native desktop app via Neutralino CLI |
| `npm run build` | Compiles TypeScript and bundles frontend assets to `dist/` |
| `npm run build:hotkey` | Compiles Windows Explorer `Ctrl+.` companion (`bin/gitero_explorer_hotkey.exe`) |
| `npm run neu:build` | Packages `dist/` into production `dist/gitero/resources.neu` |
| `npm run installer` | Full build: compiles frontend, companion, packages resources, and produces Inno Setup installer |

---

## Project Standards

- **Strictly No Emojis**: Gitero IDE enforces a strict professional aesthetic. No emoji glyphs are permitted in the application UI, modals, tabs, logs, messages, or documentation. Clean SVG icons and vector glyphs are used throughout.
- **Git Push on Every Commit**: All changes committed to the Git repository are immediately synchronized with the GitHub remote repository.

---

## License

Copyright (c) 2026 Harsh Raj.

This project is licensed under a **Source-Available Non-Commercial, No-Derivatives License**. See the full [`LICENSE`](LICENSE) file for complete terms:

- **Forks & Branches**: You are welcome to view, fork, branch, modify, and study the code for personal, educational, and evaluation purposes, or to contribute pull requests back to Gitero IDE.
- **No Derivative Applications**: You may not build, package, rebrand, or redistribute another application, editor, software tool, or competing product derived from this codebase.
- **No Commercial Use**: Any commercial use, monetization, sale, paid distribution, or SaaS hosting is strictly prohibited without prior written authorization.
- **Mandatory Attribution**: All forks, copies, and permitted extracts must retain original copyright notices and prominent attribution to Harsh Raj and the Gitero IDE project.
