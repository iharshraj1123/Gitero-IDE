# Gitero IDE

**High-Performance Developer Studio with Native Neutralino Engine & Modal Vim Editing**

[![Version](https://img.shields.io/badge/version-0.0.1--alpha-blue.svg?style=flat-square)](https://github.com/iharshraj1123/Glitero-IDE/releases)
[![Runtime](https://img.shields.io/badge/runtime-Neutralinojs%20v6.9.0-2563eb.svg?style=flat-square)](https://neutralino.js.org/)
[![Editor Engine](https://img.shields.io/badge/editor-CodeMirror%206-d97706.svg?style=flat-square)](https://codemirror.net/)
[![Language](https://img.shields.io/badge/language-TypeScript%205-3178c6.svg?style=flat-square)](https://www.typescriptlang.org/)
[![Platform](https://img.shields.io/badge/platform-Windows%20x64-0078d4.svg?style=flat-square)](https://github.com/iharshraj1123/Glitero-IDE)
[![License](https://img.shields.io/badge/license-MIT-green.svg?style=flat-square)](LICENSE)
[![Design](https://img.shields.io/badge/style-Zero%20Emojis-10b981.svg?style=flat-square)](https://github.com/iharshraj1123/Glitero-IDE)

---

## Overview

Gitero IDE is a lightweight, ultra-fast native code editor engineered for developers who demand sub-80ms startup times, minimal memory consumption, authentic Vim modal editing, and deep customizability. 

Built on the **Neutralinojs native runtime** and **CodeMirror 6**, Gitero eliminates the heavy RAM footprint and sluggish launch times of traditional Electron applications while providing a modern VS Code-like workspace, rich syntax highlighting, live theme switching, custom CSS injection, and an in-app GitHub branch updater.

---

## Key Features

### Ultra-Fast Native Performance
- **Sub-80ms Cold Starts**: Launches almost instantly via native OS webview integration.
- **Tiny Memory Footprint**: Idles around ~35MB RAM compared to 400MB+ for standard Electron IDEs.
- **Lightweight Distribution**: Packaged Windows installer is under 4MB, compiling native x64 binaries with bundled `resources.neu`.

### Full Modal Vim Editing Built-In
- **Native Vim Keybindings**: Full support for Normal, Insert, Visual, Visual-Line, and Visual-Block modes.
- **Ex Commands**: Support for `:w` (save), `:q` (quit tab), `:wq` (save and close), and `:x`.
- **Live Status Indicator**: Real-time Vim mode pill in the status bar with one-click toggling.
- **Independent Cursor Styling**: Configurable cursor shapes (Line/Bar, Block, Underline) that seamlessly adapt to modal states.

### Themes & Visual Customization
- **Bundled Themes**: Tokyo Night, One Dark Pro, Dracula, Catppuccin Mocha, Monokai Classic, and GitHub Dark.
- **Custom CSS Engine**: Inject arbitrary CSS rules directly from settings to tweak borders, glows, fonts, line heights, and syntax colors.
- **Dynamic Typography**: Switch monospace fonts (Cascadia Code, Fira Code, JetBrains Mono) and resize editor text on the fly.

### Workspace & File Management
- **Hierarchical File Tree**: Full directory tree navigation with single-click folder open, file creation, and folder creation.
- **Multi-Tab Architecture**: Open multiple files concurrently with unsaved dirty indicators, active path breadcrumbs, and tab closing.
- **Configurable Auto-Save**: Background auto-save engine with customizable debounce delays (default: 1000ms).
- **Command Palette & Quick Open**: Fast fuzzy file jumping (`Ctrl+P`) and global action palette (`Ctrl+Shift+P` / `F1`).

### In-App GitHub Branch Channel Updater
- **Branch Channel Switching**: Fetch and switch to any active branch directly from the settings dialog.
- **Zero Configuration Loss**: Updates strictly refresh application runtime bundles while leaving your themes, custom CSS, keybindings, and preferences completely untouched.

### Windows Explorer Integration
- **Context Menus**: Right-click any file, folder, directory background, or drive to open immediately in Gitero IDE.
- **User-Level Installation**: Installed via Inno Setup into Local AppData (`%LOCALAPPDATA%\Programs\Gitero IDE`), requiring no UAC administrative elevation.

---

## Quick Start

### Option 1: Windows Production Installer
1. Download the latest installer `Gitero-Setup-0.0.1-alpha.exe` from [Releases](https://github.com/iharshraj1123/Glitero-IDE/releases).
2. Run the installer. Gitero installs to `%LOCALAPPDATA%\Programs\Gitero IDE`.
3. Launch Gitero IDE from the Start Menu, Desktop shortcut, or right-click any folder and select **Open with Gitero**.

### Option 2: Running from Source

#### Prerequisites
- Node.js 18+ and npm
- Windows 10/11 (x64)

```powershell
# Clone the repository
git clone https://github.com/iharshraj1123/Glitero-IDE.git
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
| `Ctrl + N` | New File | Explorer / Workspace |
| `Ctrl + O` | Open File Dialog | Global |
| `Ctrl + W` / `:q` | Close Active Tab | Editor |
| `Ctrl + B` | Toggle Explorer Sidebar Visibility | Global |
| `Ctrl + ,` | Open Settings & Custom CSS | Global |
| `Insert` / `Alt + 0` | Cycle Cursor Style (Line / Block / Underline) | Editor |
| `Esc` | Enter Vim Normal Mode | Vim Editor |
| `i` | Enter Vim Insert Mode | Vim Editor |
| `v` | Enter Vim Visual Mode | Vim Editor |
| `:wq` / `:x` | Save and Close Active Tab | Vim Editor |

---

## Documentation & Wiki

Explore detailed guides and documentation in the [`docs/`](docs/README.md) directory:

- [Wiki Navigation Hub](docs/README.md) - Complete documentation table of contents
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
│   └── System Shell Context Menus & File Associations
│
├── Frontend Core: TypeScript + Vite
│   ├── Editor Engine: CodeMirror 6
│   │   ├── Vim Keymap Adapter (@replit/codemirror-vim)
│   │   ├── Dynamic Syntax Highlighting (16+ languages)
│   │   └── Dynamic Theme Compartments
│   │
│   ├── State & Services:
│   │   ├── PreferencesService (localStorage 'gitero_preferences_v1')
│   │   ├── ThemeManager (Theme tokens + Custom CSS injector)
│   │   ├── FileSystemService (Neutralino + Web File System Access)
│   │   └── UpdaterService (GitHub API branch tracking & hot update)
│   │
│   └── User Interface Components:
│       ├── TitleBarComponent (Custom frameless window controls & menus)
│       ├── TabBarComponent (Multi-tab tracking with dirty state)
│       ├── FileTreeComponent (Hierarchical explorer & file creation)
│       ├── StatusBarComponent (Vim mode, cursor pos, themes, encoding)
│       ├── CommandPalette (Fuzzy filterable action and file runner)
│       └── SettingsModalComponent (Preferences, CSS, and branch updates)
```

---

## Build Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts Vite local dev server with HMR |
| `npm start` | Launches native desktop app via Neutralino CLI |
| `npm run build` | Compiles TypeScript and bundles frontend assets to `dist/` |
| `npm run neu:build` | Packages `dist/` into production `dist/gitero/resources.neu` |
| `npm run installer` | Compiles frontend, packages resources, and produces Inno Setup installer |

---

## Project Standards

- **Strictly No Emojis**: Gitero IDE enforces a strict professional aesthetic. No emoji glyphs are permitted in the application UI, modals, tabs, logs, messages, or documentation. Clean SVG icons and vector glyphs are used throughout.
- **Git Push on Every Commit**: All changes committed to the Git repository are immediately synchronized with the GitHub remote repository.

---

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
