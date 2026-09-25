export type ThemeTransparencyPreset = 'solid' | 'dark-glass' | 'frosted-acrylic' | 'subtle-glass' | 'code-focus';

export interface ThemeDefinition {
  id: string;
  name: string;
  isDark: boolean;
  transparencyPreset?: ThemeTransparencyPreset;
  colors: {
    bgPrimary: string;
    bgSecondary: string;
    bgSidebar: string;
    bgActivity: string;
    bgHover: string;
    bgActive: string;
    fgPrimary: string;
    fgMuted: string;
    borderColor: string;
    accent: string;
    statusBarBg: string;
    statusBarFg: string;
    tabActiveBg: string;
    tabInactiveBg: string;
    tabBorder: string;
    editorBg: string;
    editorFg: string;
    editorLineNumber: string;
    editorCursor: string;
    editorSelection: string;
    editorActiveLine: string;
    // Syntax highlighting tokens
    synKeyword: string;
    synString: string;
    synFunction: string;
    synVariable: string;
    synComment: string;
    synType: string;
    synNumber: string;
    synOperator: string;
  };
}

export const THEMES: Record<string, ThemeDefinition> = {
  'tokyo-night': {
    id: 'tokyo-night',
    name: 'Tokyo Night',
    isDark: true,
    colors: {
      bgPrimary: '#1a1b26',
      bgSecondary: '#16161e',
      bgSidebar: '#1f2335',
      bgActivity: '#16161e',
      bgHover: '#292e42',
      bgActive: '#3b4261',
      fgPrimary: '#c0caf5',
      fgMuted: '#565f89',
      borderColor: '#24283b',
      accent: '#7aa2f7',
      statusBarBg: '#1f2335',
      statusBarFg: '#c0caf5',
      tabActiveBg: '#1a1b26',
      tabInactiveBg: '#16161e',
      tabBorder: '#24283b',
      editorBg: '#1a1b26',
      editorFg: '#c0caf5',
      editorLineNumber: '#3b4261',
      editorCursor: '#c0caf5',
      editorSelection: '#364a82',
      editorActiveLine: '#1e202e',
      synKeyword: '#bb9af7',
      synString: '#9ece6a',
      synFunction: '#7aa2f7',
      synVariable: '#c0caf5',
      synComment: '#565f89',
      synType: '#2ac3de',
      synNumber: '#ff9e64',
      synOperator: '#89ddff'
    }
  },
  'one-dark-pro': {
    id: 'one-dark-pro',
    name: 'One Dark Pro',
    isDark: true,
    colors: {
      bgPrimary: '#282c34',
      bgSecondary: '#21252b',
      bgSidebar: '#21252b',
      bgActivity: '#1e1e24',
      bgHover: '#2c313c',
      bgActive: '#3e4451',
      fgPrimary: '#abb2bf',
      fgMuted: '#5c6370',
      borderColor: '#181a1f',
      accent: '#61afef',
      statusBarBg: '#21252b',
      statusBarFg: '#9da5b4',
      tabActiveBg: '#282c34',
      tabInactiveBg: '#21252b',
      tabBorder: '#181a1f',
      editorBg: '#282c34',
      editorFg: '#abb2bf',
      editorLineNumber: '#4b5263',
      editorCursor: '#528bff',
      editorSelection: '#3e4451',
      editorActiveLine: '#2c313c',
      synKeyword: '#c678dd',
      synString: '#98c379',
      synFunction: '#61afef',
      synVariable: '#e06c75',
      synComment: '#5c6370',
      synType: '#e5c07b',
      synNumber: '#d19a66',
      synOperator: '#56b6c2'
    }
  },
  'dracula': {
    id: 'dracula',
    name: 'Dracula',
    isDark: true,
    colors: {
      bgPrimary: '#282a36',
      bgSecondary: '#21222c',
      bgSidebar: '#21222c',
      bgActivity: '#191a21',
      bgHover: '#343746',
      bgActive: '#44475a',
      fgPrimary: '#f8f8f2',
      fgMuted: '#6272a4',
      borderColor: '#191a21',
      accent: '#bd93f9',
      statusBarBg: '#191a21',
      statusBarFg: '#f8f8f2',
      tabActiveBg: '#282a36',
      tabInactiveBg: '#21222c',
      tabBorder: '#191a21',
      editorBg: '#282a36',
      editorFg: '#f8f8f2',
      editorLineNumber: '#6272a4',
      editorCursor: '#f8f8f2',
      editorSelection: '#44475a',
      editorActiveLine: '#2d303e',
      synKeyword: '#ff79c6',
      synString: '#f1fa8c',
      synFunction: '#50fa7b',
      synVariable: '#f8f8f2',
      synComment: '#6272a4',
      synType: '#8be9fd',
      synNumber: '#bd93f9',
      synOperator: '#ff79c6'
    }
  },
  'catppuccin-mocha': {
    id: 'catppuccin-mocha',
    name: 'Catppuccin Mocha',
    isDark: true,
    colors: {
      bgPrimary: '#1e1e2e',
      bgSecondary: '#181825',
      bgSidebar: '#181825',
      bgActivity: '#11111b',
      bgHover: '#313244',
      bgActive: '#45475a',
      fgPrimary: '#cdd6f4',
      fgMuted: '#6c7086',
      borderColor: '#313244',
      accent: '#89b4fa',
      statusBarBg: '#11111b',
      statusBarFg: '#cdd6f4',
      tabActiveBg: '#1e1e2e',
      tabInactiveBg: '#181825',
      tabBorder: '#313244',
      editorBg: '#1e1e2e',
      editorFg: '#cdd6f4',
      editorLineNumber: '#585b70',
      editorCursor: '#f5e0dc',
      editorSelection: '#45475a',
      editorActiveLine: '#24273a',
      synKeyword: '#cba6f7',
      synString: '#a6e3a1',
      synFunction: '#89b4fa',
      synVariable: '#f38ba8',
      synComment: '#6c7086',
      synType: '#f9e2af',
      synNumber: '#fab387',
      synOperator: '#94e2d5'
    }
  },
  'monokai': {
    id: 'monokai',
    name: 'Monokai Classic',
    isDark: true,
    colors: {
      bgPrimary: '#272822',
      bgSecondary: '#1e1f1c',
      bgSidebar: '#1e1f1c',
      bgActivity: '#171814',
      bgHover: '#3e3d32',
      bgActive: '#49483e',
      fgPrimary: '#f8f8f2',
      fgMuted: '#75715e',
      borderColor: '#1e1f1c',
      accent: '#a6e22e',
      statusBarBg: '#1e1f1c',
      statusBarFg: '#f8f8f2',
      tabActiveBg: '#272822',
      tabInactiveBg: '#1e1f1c',
      tabBorder: '#171814',
      editorBg: '#272822',
      editorFg: '#f8f8f2',
      editorLineNumber: '#75715e',
      editorCursor: '#f8f8f0',
      editorSelection: '#49483e',
      editorActiveLine: '#34352f',
      synKeyword: '#f92672',
      synString: '#e6db74',
      synFunction: '#a6e22e',
      synVariable: '#fd971f',
      synComment: '#75715e',
      synType: '#66d9ef',
      synNumber: '#ae81ff',
      synOperator: '#f92672'
    }
  },
  'github-dark': {
    id: 'github-dark',
    name: 'GitHub Dark',
    isDark: true,
    colors: {
      bgPrimary: '#0d1117',
      bgSecondary: '#010409',
      bgSidebar: '#010409',
      bgActivity: '#010409',
      bgHover: '#161b22',
      bgActive: '#21262d',
      fgPrimary: '#c9d1d9',
      fgMuted: '#8b949e',
      borderColor: '#30363d',
      accent: '#58a6ff',
      statusBarBg: '#161b22',
      statusBarFg: '#c9d1d9',
      tabActiveBg: '#0d1117',
      tabInactiveBg: '#010409',
      tabBorder: '#30363d',
      editorBg: '#0d1117',
      editorFg: '#c9d1d9',
      editorLineNumber: '#484f58',
      editorCursor: '#58a6ff',
      editorSelection: '#264f78',
      editorActiveLine: '#161b22',
      synKeyword: '#ff7b72',
      synString: '#a5d6ff',
      synFunction: '#d2a8ff',
      synVariable: '#ffa657',
      synComment: '#8b949e',
      synType: '#79c0ff',
      synNumber: '#79c0ff',
      synOperator: '#ff7b72'
    }
  },
  'dark-glass': {
    id: 'dark-glass',
    name: 'Dark Glass',
    isDark: true,
    transparencyPreset: 'dark-glass',
    colors: {
      bgPrimary: '#080b11',
      bgSecondary: '#030508',
      bgSidebar: '#05080f',
      bgActivity: '#030508',
      bgHover: '#131b2e',
      bgActive: '#1a243d',
      fgPrimary: '#e2e8f0',
      fgMuted: '#64748b',
      borderColor: '#1e293b',
      accent: '#38bdf8',
      statusBarBg: '#05080f',
      statusBarFg: '#94a3b8',
      tabActiveBg: '#080b11',
      tabInactiveBg: '#030508',
      tabBorder: '#1e293b',
      editorBg: '#080b11',
      editorFg: '#f1f5f9',
      editorLineNumber: '#475569',
      editorCursor: '#38bdf8',
      editorSelection: '#1e3a8a66',
      editorActiveLine: '#0f172a88',
      synKeyword: '#f472b6',
      synString: '#4ade80',
      synFunction: '#38bdf8',
      synVariable: '#fbbf24',
      synComment: '#64748b',
      synType: '#22d3ee',
      synNumber: '#a78bfa',
      synOperator: '#f43f5e'
    }
  }
};
