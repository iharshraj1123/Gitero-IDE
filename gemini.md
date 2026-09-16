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

---

## Installer Artifacts

* **Output Folder**:  
  `d:\ProjectsNew\appDev2\Gitero IDE\installer-output\`
* **Current Installer Executable**:  
  `d:\ProjectsNew\appDev2\Gitero IDE\installer-output\Gitero-Setup-0.0.1-alpha.exe`
* **Inno Setup Script**:  
  `d:\ProjectsNew\appDev2\Gitero IDE\installer\gitero.iss`

---

## Repository & Version Info

* **GitHub Repository**: [https://github.com/iharshraj1123/Glitero-IDE](https://github.com/iharshraj1123/Glitero-IDE)
* **Active Branch**: `main`
* **Current Version**: `0.0.1-alpha`

---

## Useful Commands

| Command | Action |
| :--- | :--- |
| `npm run dev` | Start Vite development server with hot-reload |
| `npm start` | Run the native desktop app with Neutralino CLI |
| `npm run build` | Compile TypeScript and bundle frontend to `dist/` |
| `npm run neu:build` | Package `dist/` into `dist/gitero/resources.neu` |
| `npm run installer` | Complete build: compile frontend, bundle `resources.neu`, and generate `Gitero-Setup-0.0.1-alpha.exe` |

---

## Architecture Note: Why resources.neu is Required in Production

In Neutralinojs:
1. When running in developer mode (`neu run` or with `--load-dir-res`), it loads unpackaged files directly from `/dist/`.
2. In production (`Gitero.exe`), the binary looks for the pre-packaged `resources.neu` archive in its directory.
3. If `resources.neu` is missing, the binary falls back to its internal fallback default sample page.
4. The updated installer now bundles `resources.neu` directly beside `Gitero.exe`, launching the real Gitero IDE instantly (<80ms).

---

## Strict Project Rules

1. **Strictly No Emojis**:
   * This is a serious developer application. Do not use emoji characters anywhere in the UI, modals, buttons, tabs, logs, messages, or codebase.
   * Always use real vector icons (clean inline SVGs or Lucide icons) or clean text badges.

2. **Git Push on Every Commit**:
   * Whenever a git commit is made, always immediately `git push` to the respective remote branch on GitHub (`https://github.com/iharshraj1123/Glitero-IDE`).
