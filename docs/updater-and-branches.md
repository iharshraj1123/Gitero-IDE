# In-App Branch Channel Updater

Gitero IDE features an integrated GitHub Branch Updater designed specifically for developers. Instead of forcing you onto monolithic release cycles, Gitero allows you to follow active GitHub branches (such as `main`, `dev`, or experimental feature branches) directly from inside the IDE.

---

## How It Works

1. **GitHub API Querying**: Gitero connects to the public GitHub API for [`iharshraj1123/Glitero-IDE`](https://github.com/iharshraj1123/Glitero-IDE).
2. **Commit Comparison**: It compares your local commit SHA against the HEAD commit SHA of the selected branch.
3. **Targeted Bundle Refresh**: When an update is triggered, Gitero updates only the application runtime assets (`dist/`).
4. **Instant Restart**: After applying changes, Gitero can be restarted with a single click to run the newly updated code.

---

## Zero-Loss State Isolation Guarantee

A common frustration with software updates is having your personalized editor configuration, theme choices, or custom tweaks wiped out.

Gitero enforces strict isolation between application code and user state:

- **Application Code**: Resides in the application directory or memory runtime (`dist/` or `resources.neu`).
- **User State Store**: Resides in isolated `localStorage` keys under `gitero_preferences_v1`:
  - Active color theme
  - Custom CSS rules
  - Typography preferences (font family, font size)
  - Cursor style & blinking preferences
  - Vim mode enable/disable state
  - Auto-save configuration

**Updating from any branch will NEVER overwrite or erase your custom CSS, theme preferences, or keybindings.**

---

## How to Check for Updates and Switch Branches

1. Open the Settings modal by pressing `Ctrl+,` (or select `Preferences` > `Settings` from the top menu).
2. Look at the top section: **Software Updates (GitHub Branch Channel)**.
3. The metadata card displays:
   - **Version**: Current semantic version (e.g., `0.0.1-alpha`).
   - **Current Commit**: The short commit SHA of your active build (e.g., `791a8ec`).
   - **Active Channel**: The branch you are currently tracking (e.g., `main`).
4. **Choose a Branch**: Select a branch from the **Target Branch** dropdown. Click **Refresh** to pull any newly pushed branches from GitHub.
5. Click **Check for Updates**:
   - If updates are found: The status card displays the latest commit message, author, date, and commit SHA. The **Update from this Branch** button becomes active.
   - If already up to date: The card confirms you are on the latest commit. You also have the option to **Force Re-sync**.
6. Click **Update from this Branch**:
   - Gitero downloads and verifies the code bundle.
   - A progress indicator details each step of the installation.
7. Once finished, click **Restart Gitero IDE** to launch with the updated code.
