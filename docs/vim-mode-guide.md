# Vim Modal Editing in Gitero IDE

Gitero IDE comes equipped with first-class modal Vim editing powered by the CodeMirror Vim adapter (`@replit/codemirror-vim`). Whether you are a lifelong Vim user or learning modal text editing for the first time, Gitero provides an authentic editing experience with zero setup required.

---

## Toggling Vim Mode

Vim mode is enabled by default upon installation. You can toggle it on or off at any time using any of the following methods:

1. **Status Bar Click**: Click the Vim mode pill in the bottom-left corner of the status bar.
2. **Settings Dialog**: Press `Ctrl+,`, navigate to the **Vim Mode** section, and toggle the **Enable Vim Modal Editing** checkbox.
3. **Command Palette**: Press `Ctrl+Shift+P`, type `Toggle Vim Mode`, and press `Enter`.

When Vim mode is disabled, Gitero operates as a standard GUI text editor with standard arrow-key navigation and cursor selection.

---

## Vim Modes & Indicators

Gitero provides real-time visual feedback of your current Vim mode in the status bar pill:

| Mode Pill | State | Description | Transition Key |
| :--- | :--- | :--- | :--- |
| `NORMAL` | Normal Mode | Navigation, motions, deletions, and commands | `Esc` or `Ctrl+[` |
| `INSERT` | Insert Mode | Typing code into the buffer | `i`, `a`, `o`, `I`, `A`, `O` |
| `VISUAL` | Visual Mode | Character-level selection | `v` |
| `V-LINE` | Visual Line Mode | Full-line selection | `Shift + V` (`V`) |
| `V-BLOCK` | Visual Block Mode | Rectangular column block selection | `Ctrl + V` |

---

## Essential Vim Motions & Operators

### Navigation (Normal Mode)
- `h`, `j`, `k`, `l`: Move Left, Down, Up, Right.
- `w`: Jump forward to the start of the next word.
- `b`: Jump backward to the start of the previous word.
- `e`: Jump forward to the end of a word.
- `0`: Jump to the absolute beginning of the current line.
- `^`: Jump to the first non-whitespace character of the current line.
- `$`: Jump to the end of the current line.
- `gg`: Jump to the very first line of the document.
- `G`: Jump to the very last line of the document.
- `<line_number>G`: Jump directly to a specific line number (e.g. `45G`).

### Entering Insert Mode
- `i`: Insert before the cursor.
- `I`: Insert at the beginning of the line.
- `a`: Append after the cursor.
- `A`: Append at the end of the line.
- `o`: Open a new line below the current line and enter Insert mode.
- `O`: Open a new line above the current line and enter Insert mode.

### Editing & Manipulation
- `x`: Delete the character under the cursor.
- `dd`: Delete (cut) the entire current line.
- `dw`: Delete the current word from cursor to end.
- `yy`: Yank (copy) the entire current line.
- `yw`: Yank the current word.
- `p`: Paste buffer after the cursor.
- `P`: Paste buffer before the cursor.
- `u`: Undo the last edit.
- `Ctrl + R`: Redo the last undone edit.
- `ci"`: Change inside quotation marks (clears quotes and enters Insert mode).
- `ci(`: Change inside parentheses.
- `ci{`: Change inside curly braces.
- `r<char>`: Replace character under cursor with `<char>`.

### Searching Within Document
- `/pattern`: Search forward for `pattern`. Press `Enter` to submit.
- `?pattern`: Search backward for `pattern`.
- `n`: Jump to next search match.
- `N`: Jump to previous search match.
- `*`: Search forward for the word currently under the cursor.

---

## Ex Commands (Command Mode)

Gitero IDE intercepts and handles classic Vim Ex commands directly:

| Command | Action in Gitero IDE |
| :--- | :--- |
| `:w` | Save the active file to disk |
| `:q` | Close the current file tab |
| `:wq` | Save changes to disk and immediately close the tab |
| `:x` | Save changes and close the tab (equivalent to `:wq`) |

To invoke an Ex command:
1. Ensure you are in Normal Mode (press `Esc`).
2. Type `:` followed by the command name (e.g., `:w`).
3. Press `Enter`. A confirmation message appears in the bottom status bar (e.g., `Saved active file`).

---

## Cursor Integration

Gitero features dynamic cursor geometry that integrates with Vim:
- When entering **Insert Mode**, the cursor can display as a vertical **Line** bar.
- When entering **Normal Mode**, the cursor can display as a solid **Block**.
- In the status bar or via `Insert` / `Alt+0`, you can cycle your preferred base cursor style between:
  - `Line` (Bar)
  - `Block`
  - `Underline`

Your chosen cursor style is automatically saved to preferences (`editor.cursorStyle`) and persisted across all sessions.
