# Keyboard Shortcuts & Command Palette

Gitero IDE is built around rapid keyboard navigation. You can perform almost any IDE function without lifting your hands from the keyboard.

---

## Global Keyboard Shortcuts

| Shortcut | Command | Action |
| :--- | :--- | :--- |
| `Ctrl + P` | `workbench.quickOpen` | Open fuzzy file switcher to jump between open tabs |
| `Ctrl + Shift + P` | `workbench.commandPalette` | Open the interactive Command Palette |
| `F1` | `workbench.commandPalette` | Alternate trigger for the Command Palette |
| `Ctrl + S` | `file.save` | Save the currently active document |
| `Ctrl + Shift + S` | `file.saveAs` | Save the currently active document with a new name/path |
| `Ctrl + N` | `file.newFile` | Prompt to create a new file in current workspace |
| `Ctrl + O` | `file.openFile` | Open native OS file picker |
| `Ctrl + W` | `view.closeActiveTab` | Close the currently active editor tab |
| `Ctrl + B` | `view.toggleSidebar` | Collapse or expand the file tree explorer sidebar |
| `Ctrl + ,` | `settings.open` | Open Settings & Custom CSS configuration modal |
| `Insert` | `preferences.cursor.cycle` | Cycle cursor style (`line` -> `block` -> `underline`) |
| `Alt + 0` | `preferences.cursor.cycle` | Alternate key to cycle cursor styles |
| `NumPad 0` | `preferences.cursor.cycle` | Cycle cursor style when NumLock is disabled |

---

## Editor Text Manipulation Shortcuts

Gitero supports standard CodeMirror 6 text editing keymaps when outside Vim mode, or during Vim Insert mode:

| Shortcut | Action |
| :--- | :--- |
| `Ctrl + Z` | Undo last change |
| `Ctrl + Y` / `Ctrl + Shift + Z` | Redo last undone change |
| `Ctrl + A` | Select all text in active document |
| `Ctrl + F` | Trigger search inside the editor buffer |
| `Ctrl + H` | Trigger replace dialog inside the editor buffer |
| `Tab` | Indent current line or selection |
| `Shift + Tab` | Unindent / dedent current line or selection |
| `Ctrl + /` | Toggle line comment (in languages supporting comments) |
| `Alt + Up` | Move current line or block upwards |
| `Alt + Down` | Move current line or block downwards |

---

## Vim Modal Shortcuts (When Vim Mode is Enabled)

| Mode | Shortcut | Action |
| :--- | :--- | :--- |
| **Normal** | `h`, `j`, `k`, `l` | Navigate Left, Down, Up, Right |
| **Normal** | `w` / `b` | Forward / Backward by word |
| **Normal** | `0` / `$` | Start / End of current line |
| **Normal** | `gg` / `G` | Jump to start / end of document |
| **Normal** | `dd` | Delete (cut) current line |
| **Normal** | `yy` | Yank (copy) current line |
| **Normal** | `p` | Paste buffer |
| **Normal** | `u` | Undo |
| **Normal** | `Ctrl + R` | Redo |
| **Normal** | `:w` | Save file |
| **Normal** | `:q` | Close tab |
| **Normal** | `:wq` or `:x` | Save file and close tab |
| **Insert** | `Esc` or `Ctrl + [` | Return to Normal mode |
| **Visual** | `v` | Enter character-wise Visual mode |
| **Visual** | `V` | Enter line-wise Visual mode |
| **Visual** | `Ctrl + V` | Enter block-wise Visual mode |

---

## Command Palette (`Ctrl + Shift + P` / `F1`)

The Command Palette allows you to discover and trigger any application action using quick fuzzy search.

To use the Command Palette:
1. Press `Ctrl + Shift + P` (or `F1`).
2. Type a query (e.g. `Theme`, `Save`, `Vim`, `Cursor`).
3. Press `Down` / `Up` arrow keys to navigate suggestions.
4. Press `Enter` to execute the selected command.

### Available Commands in Gitero IDE:

- **Preferences: Switch Color Theme** — Open the theme browser and live switch between Tokyo Night, One Dark Pro, Dracula, Catppuccin Mocha, Monokai Classic, and GitHub Dark.
- **Vim: Toggle Vim Mode** — Enable or disable modal Vim editing instantly.
- **File: New File** — Create a new file in the current workspace.
- **File: Open File...** — Open an existing file from disk.
- **File: Open Folder...** — Open an entire folder tree into the workspace explorer.
- **File: Save** — Save the active file.
- **File: Save As...** — Save the file to a new target path.
- **File: Toggle Auto Save** — Enable or disable automatic background file saving.
- **View: Close Active Editor** — Close the currently focused tab.
- **View: Toggle Sidebar Visibility** — Show or hide the Explorer file tree.
- **Preferences: Cycle Cursor Style** — Cycle through line, block, and underline cursor shapes.
- **Preferences: Set Cursor Style to Line (Bar)** — Set the cursor to a vertical bar.
- **Preferences: Set Cursor Style to Block** — Set the cursor to a solid rectangular block.
- **Preferences: Set Cursor Style to Underline** — Set the cursor to an underline.
- **Preferences: Open Settings & Custom CSS** — Open the complete configuration dialog.
