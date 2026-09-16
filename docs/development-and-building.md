# Development, Building & Packaging Guide

This document outlines the architecture, local development workflow, build process, and installer generation for Gitero IDE.

---

## Technical Architecture

Gitero IDE is built using a modern decoupled architecture:

1. **Native Shell Layer**: Powered by [Neutralinojs](https://neutralino.js.org/). Neutralino uses the host operating system's native webview (Microsoft Edge WebView2 on Windows) rather than bundling a whole Chromium engine. This results in sub-80ms startup times, a ~3.5MB download, and ~35MB RAM usage.
2. **Frontend Layer**: Written in TypeScript using modern DOM component patterns and bundled with Vite.
3. **Editor Engine**: CodeMirror 6 with dynamic language extensions and Vim emulation adapter.
4. **Installer Engine**: Inno Setup 6 generating a per-user, elevation-free Windows installer with shell context menu integration.

---

## Prerequisites

Before contributing or building Gitero IDE from source, ensure you have the following installed:

- **Node.js**: Version 18.0.0 or higher.
- **npm**: Version 9.0.0 or higher.
- **Inno Setup 6**: Required only if you intend to generate the Windows installer `.exe`. (Default install path: `C:\Users\<user>\AppData\Local\Programs\Inno Setup 6\iscc.exe` or installed in `PATH`).

---

## Local Development Workflow

### 1. Clone & Install Dependencies
```powershell
git clone https://github.com/iharshraj1123/Glitero-IDE.git
cd "Gitero IDE"
npm install
```

### 2. Running in Development Mode
During UI and frontend development, use the Vite dev server with Hot Module Replacement (HMR):
```powershell
npm run dev
```
Navigate to `http://localhost:5173` in any browser to inspect and modify UI components. Note that native Neutralino filesystem calls fall back gracefully to web mocks when run in a standard browser.

### 3. Running with Native Neutralino CLI
To test native OS filesystem access, frameless window controls, and system calls:
```powershell
npm start
```
This runs `neu run`, starting the native binary linked directly to the development build.

---

## Production Build Workflow

### Step 1: Compile Frontend Assets
```powershell
npm run build
```
This runs `tsc` (TypeScript compiler) and `vite build`. The bundled HTML, JavaScript, CSS, and asset files are output into `dist/`.

### Step 2: Package `resources.neu`
```powershell
npm run neu:build
```
Neutralino compiles all assets in `dist/` into a compressed binary resource archive: `dist/gitero/resources.neu`.

#### Why `resources.neu` is Required in Production
In Neutralinojs architecture:
1. In development mode (`neu run`), the runtime reads unpackaged files directly from the directory specified in `documentRoot`.
2. In production (`Gitero.exe`), the binary looks for the pre-packaged `resources.neu` archive located in the same folder as the executable.
3. If `resources.neu` is missing or out of date, the binary will fail back to Neutralino's internal default sample screen.
4. Always ensure `npm run neu:build` is executed before distributing or installing production binaries.

### Step 3: Build the Windows Installer
```powershell
npm run installer
```
This command performs a complete automated pipeline:
1. Runs `npm run build` (TypeScript check and Vite bundle).
2. Runs `npx @neutralinojs/neu build` (compiles `resources.neu` and native executables).
3. Invokes Inno Setup compiler (`iscc`) on `installer/gitero.iss`.
4. Outputs the final installer `Gitero-Setup-0.0.4-alpha.exe` to `installer-output/`.

---

## Project Standards & Strict Rules

Contributors must strictly adhere to the following project guidelines:

### 1. Strictly No Emojis
Gitero is a focused developer application with a serious, clean aesthetic.
- **Do NOT use emoji characters** anywhere in the UI, title bar, tab headers, buttons, status bar, modals, logs, error messages, code comments, or documentation.
- Always use vector icons (inline SVGs or Lucide icons) or clean text badges (such as `[NOTE]`, `[TIP]`, `[WARNING]`).

### 2. Git Push on Every Commit
Whenever a git commit is created, immediately push it to the GitHub remote repository:
```powershell
git push origin <branch>
```
This ensures that the in-app branch updater can immediately discover and test the commit.
