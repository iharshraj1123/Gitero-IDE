# Themes, Typography & Custom CSS Styling

Gitero IDE features an extensible styling system that allows you to configure color schemes, adjust typography, customize cursor geometry, and inject arbitrary CSS rules directly into the user interface and editor engine.

---

## Bundled Color Themes

Gitero includes 6 carefully curated, authentic dark color themes matching popular developer palettes:

| Theme ID | Display Name | Characteristics |
| :--- | :--- | :--- |
| `tokyo-night` | **Tokyo Night** (Default) | Deep blue-gray palette with vibrant cyan, purple, and pastel highlights |
| `one-dark-pro` | **One Dark Pro** | Classic Atom-inspired muted dark palette with balanced contrast |
| `dracula` | **Dracula** | Famous gothic dark theme with pink, purple, and green accents |
| `catppuccin-mocha`| **Catppuccin Mocha** | Warm, soothing pastel palette with lavender and rosewater accents |
| `monokai` | **Monokai Classic** | High-contrast dark theme with sharp yellow, magenta, and green syntax |
| `github-dark` | **GitHub Dark** | Clean, minimalist dark aesthetic matching GitHub's web interface |

### Switching Themes
You can change the active theme in three ways:
1. **Activity Bar**: Click the palette icon on the left activity bar.
2. **Status Bar**: Click the theme name displayed on the right side of the status bar.
3. **Command Palette**: Press `Ctrl+Shift+P`, type `Switch Color Theme`, and select your theme from the list.

Changes are applied immediately across the entire window without requiring an app reload.

---

## Typography & Editor Dimensions

Gitero supports any monospace font installed on your operating system, complete with ligature rendering.

### Changing Fonts
1. Open the Settings modal with `Ctrl+,`.
2. Scroll to the **Typography & Editor** section.
3. Edit the **Font Family** field. The default font stack is:
   ```css
   "Cascadia Code", "Fira Code", "JetBrains Mono", Consolas, monospace
   ```
4. Adjust the **Font Size (px)** field (ranging from `10` to `32`, default: `14`).
5. Click **Save & Apply**.

The font settings are updated via CSS custom properties (`--editor-font-family` and `--editor-font-size`) and saved permanently in your configuration store.

---

## Cursor Customization

You can choose your preferred cursor shape:
- **Line / Bar (Default)**: Standard vertical bar cursor.
- **Block**: Solid rectangular block cursor across the current character.
- **Underline**: Horizontal baseline underline beneath the character.

### How to Change Cursor Shapes
- **Quick Keyboard Shortcut**: Press `Insert` or `Alt + 0` (or `NumPad 0` with NumLock off) while focused in the editor to cycle through styles.
- **Command Palette**: Press `Ctrl+Shift+P` and type `Cycle Cursor Style` or choose `Set Cursor Style to Line / Block / Underline`.
- **Settings Modal**: Select your preference in `Ctrl+,` under the **Cursor Style** dropdown.

---

## Custom CSS Override Engine

Gitero allows you to inject raw CSS into the application DOM. This lets you style every element, window border, tab color, status bar, or CodeMirror editor component to your exact liking.

### How to Inject Custom CSS
1. Press `Ctrl+,` to open **Settings & Customization**.
2. Scroll to the **Custom CSS Override** section.
3. Enter your CSS rules into the text area.
4. Click **Save & Apply**.

The CSS is written into a dynamic `<style id="gitero-custom-css">` tag in the document `<head>` and persisted in `localStorage`.

---

## Practical Custom CSS Recipes

Here are ready-to-use snippets you can copy into the **Custom CSS Override** field:

### 1. Glowing Neon Cursor
Adds a luminous glowing aura around the active text cursor:
```css
.cm-cursor {
  border-left-width: 3px !important;
  border-left-color: #00ffff !important;
  box-shadow: 0 0 8px #00ffff, 0 0 16px #00ffff !important;
}
```

### 2. Sleek Rounded Tabs
Gives the tab bar rounded corners and distinct active separation:
```css
.tab-item {
  border-radius: 6px 6px 0 0 !important;
  margin-right: 3px !important;
  transition: all 0.15s ease !important;
}

.tab-item.active {
  box-shadow: inset 0 2px 0 0 var(--accent) !important;
}
```

### 3. Customized Line Numbers
Adjusts line number opacity and highlight color for the active line:
```css
.cm-lineNumbers .cm-gutterElement {
  color: #565f89 !important;
  font-weight: 500 !important;
}

.cm-activeLineGutter {
  color: #7aa2f7 !important;
  font-weight: bold !important;
}
```

### 4. Compact Status Bar
Shrinks status bar height for maximum code viewing area:
```css
#status-bar {
  height: 22px !important;
  font-size: 11px !important;
  border-top: 1px solid rgba(255, 255, 255, 0.08) !important;
}
```

### 5. Smooth Window Borders
Adds a subtle modern border around the entire frameless window:
```css
#app {
  border: 1px solid var(--border-color) !important;
  box-sizing: border-box !important;
}
```
