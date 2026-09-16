# Gitero IDE Documentation & Wiki

Welcome to the official Gitero IDE documentation. This wiki contains comprehensive technical guides, user instructions, configuration references, and architecture notes for Gitero IDE.

---

## Documentation Sections

### 1. [Getting Started](getting-started.md)
Learn how to install Gitero IDE, launch your first workspace, navigate the user interface, create and manage files, and configure auto-save behavior.

### 2. [Vim Modal Editing Guide](vim-mode-guide.md)
Explore the native Vim modal editing system built directly into Gitero IDE. Understand Normal, Insert, Visual, and Ex modes, command line operations (`:w`, `:q`, `:wq`), status indicators, and toggling Vim on and off.

### 3. [Themes & Custom Styling](themes-and-styling.md)
A complete guide to Gitero's aesthetic engine:
- Bundled authentic dark themes (Tokyo Night, One Dark Pro, Dracula, Catppuccin Mocha, Monokai Classic, GitHub Dark).
- Typography and font family settings.
- Cursor geometry configuration (Line, Block, Underline).
- Custom CSS injection guide with ready-to-use recipes for editor styling, borders, and animations.

### 4. [Keyboard Shortcuts & Command Palette](shortcuts-and-commands.md)
Complete cheat sheet covering all global hotkeys, file management shortcuts, editor commands, and the interactive Command Palette (`Ctrl+Shift+P` / `F1`).

### 5. [In-App Branch Updater](updater-and-branches.md)
Detailed walkthrough of Gitero's Git-native in-app updater:
- How to switch branches (e.g., `main`, `dev`, experimental feature branches).
- The zero-loss state isolation guarantee: how your preferences, custom CSS, themes, and open workspaces remain intact across updates.

### 6. [Development & Building](development-and-building.md)
For contributors and developers:
- Setting up the local development environment.
- Neutralinojs architecture and the role of `resources.neu`.
- Compiling TypeScript, bundling with Vite, and generating production Windows installers via Inno Setup.

---

## Core Philosophy

Gitero IDE is designed around three foundational principles:

1. **Native Speed**: Startup times must stay below 80ms. Memory footprint should stay under 50MB during typical single-workspace editing.
2. **Keyboard-Centric Flow**: Every essential action can be executed through Vim motions, dedicated hotkeys, or the Command Palette without touching the mouse.
3. **Uncompromising Cleanliness**: Zero emojis, zero telemetry nag screens, zero bloatware. Just a razor-sharp developer workspace.
