import { preferencesService, GiteroPreferences } from './preferences';

export type TransparencyCategory = 'chrome' | 'workspace' | 'editor' | 'overlays';

export interface TransparencySectionMeta {
  id: string;
  name: string;
  category: TransparencyCategory;
  description: string;
  bgPrefKey: keyof GiteroPreferences;
  textPrefKey: keyof GiteroPreferences;
  defaultBg: number;
  defaultText: number;
}

export interface TransparencyPreset {
  id: string;
  name: string;
  description: string;
  blur: number;
  masterBg: number;
  masterText: number;
  atmosphereMood?: 'deep-space' | 'aurora' | 'monochrome' | 'accent' | 'none';
  atmosphereIntensity?: number;
  sections: Record<string, { bg: number; text: number }>;
}

export const TRANSPARENCY_SECTIONS: TransparencySectionMeta[] = [
  {
    id: 'titleBar',
    name: 'Title Bar & Menu Bar',
    category: 'chrome',
    description: 'Header window drag strip, menu bar buttons, and window controls',
    bgPrefKey: 'transparency.titleBar.bgOpacity',
    textPrefKey: 'transparency.titleBar.textOpacity',
    defaultBg: 100,
    defaultText: 100
  },
  {
    id: 'activityBar',
    name: 'Activity Bar',
    category: 'chrome',
    description: 'Far-left navigation icon bar and active indicator strip',
    bgPrefKey: 'transparency.activityBar.bgOpacity',
    textPrefKey: 'transparency.activityBar.textOpacity',
    defaultBg: 100,
    defaultText: 100
  },
  {
    id: 'sidebar',
    name: 'Primary Sidebar',
    category: 'workspace',
    description: 'File Explorer tree, Search matches pane, and Source Control panel',
    bgPrefKey: 'transparency.sidebar.bgOpacity',
    textPrefKey: 'transparency.sidebar.textOpacity',
    defaultBg: 100,
    defaultText: 100
  },
  {
    id: 'tabBar',
    name: 'Tabs & Breadcrumbs',
    category: 'workspace',
    description: 'Document tab bar strip and navigation breadcrumb trail',
    bgPrefKey: 'transparency.tabBar.bgOpacity',
    textPrefKey: 'transparency.tabBar.textOpacity',
    defaultBg: 100,
    defaultText: 100
  },
  {
    id: 'editor',
    name: 'Code Editor Canvas',
    category: 'editor',
    description: 'Main editing viewport, gutters, line numbers, and syntax code tokens',
    bgPrefKey: 'transparency.editor.bgOpacity',
    textPrefKey: 'transparency.editor.textOpacity',
    defaultBg: 100,
    defaultText: 100
  },
  {
    id: 'terminal',
    name: 'Integrated Terminal',
    category: 'editor',
    description: 'Bottom dock panel, command shell prompt, and terminal text',
    bgPrefKey: 'transparency.terminal.bgOpacity',
    textPrefKey: 'transparency.terminal.textOpacity',
    defaultBg: 100,
    defaultText: 100
  },
  {
    id: 'statusBar',
    name: 'Status Bar',
    category: 'chrome',
    description: 'Bottom status bar, git branch chip, line/column info, and notification chips',
    bgPrefKey: 'transparency.statusBar.bgOpacity',
    textPrefKey: 'transparency.statusBar.textOpacity',
    defaultBg: 100,
    defaultText: 100
  },
  {
    id: 'overlays',
    name: 'Modals & Overlays',
    category: 'overlays',
    description: 'Command Palette, Settings Modal, Find Widget, and quick dialogs',
    bgPrefKey: 'transparency.overlays.bgOpacity',
    textPrefKey: 'transparency.overlays.textOpacity',
    defaultBg: 100,
    defaultText: 100
  }
];

export const TRANSPARENCY_PRESETS: TransparencyPreset[] = [
  {
    id: 'solid',
    name: 'Solid (Default)',
    description: 'Standard 100% opaque theme surfaces with solid backgrounds',
    blur: 0,
    masterBg: 100,
    masterText: 100,
    atmosphereMood: 'none',
    atmosphereIntensity: 0,
    sections: {
      titleBar: { bg: 100, text: 100 },
      activityBar: { bg: 100, text: 100 },
      sidebar: { bg: 100, text: 100 },
      tabBar: { bg: 100, text: 100 },
      editor: { bg: 100, text: 100 },
      terminal: { bg: 100, text: 100 },
      statusBar: { bg: 100, text: 100 },
      overlays: { bg: 100, text: 100 }
    }
  },
  {
    id: 'subtle-glass',
    name: 'Subtle Glass',
    description: 'Gentle transparency with smooth frosted backdrop blur',
    blur: 12,
    masterBg: 100,
    masterText: 100,
    atmosphereMood: 'none',
    atmosphereIntensity: 0,
    sections: {
      titleBar: { bg: 80, text: 100 },
      activityBar: { bg: 75, text: 100 },
      sidebar: { bg: 78, text: 100 },
      tabBar: { bg: 80, text: 100 },
      editor: { bg: 92, text: 100 },
      terminal: { bg: 85, text: 100 },
      statusBar: { bg: 75, text: 100 },
      overlays: { bg: 90, text: 100 }
    }
  },
  {
    id: 'frosted-acrylic',
    name: 'Frosted Acrylic',
    description: 'Modern Windows Acrylic aesthetic with rich 20px blur and luminous glass chrome',
    blur: 20,
    masterBg: 100,
    masterText: 100,
    atmosphereMood: 'none',
    atmosphereIntensity: 0,
    sections: {
      titleBar: { bg: 60, text: 100 },
      activityBar: { bg: 55, text: 100 },
      sidebar: { bg: 60, text: 100 },
      tabBar: { bg: 65, text: 100 },
      editor: { bg: 85, text: 100 },
      terminal: { bg: 70, text: 100 },
      statusBar: { bg: 55, text: 100 },
      overlays: { bg: 88, text: 100 }
    }
  },
  {
    id: 'code-focus',
    name: 'Code Focus',
    description: 'Translucent sidebars and chrome with 100% solid, distraction-free code canvas',
    blur: 16,
    masterBg: 100,
    masterText: 100,
    atmosphereMood: 'none',
    atmosphereIntensity: 0,
    sections: {
      titleBar: { bg: 65, text: 100 },
      activityBar: { bg: 60, text: 100 },
      sidebar: { bg: 65, text: 100 },
      tabBar: { bg: 70, text: 100 },
      editor: { bg: 100, text: 100 },
      terminal: { bg: 72, text: 100 },
      statusBar: { bg: 60, text: 100 },
      overlays: { bg: 90, text: 100 }
    }
  }
];

export class TransparencyService {
  private isInitialized = false;


  init() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // Auto-upgrade legacy low preset opacities if below 50%
    const currentSidebar = preferencesService.get('transparency.sidebar.bgOpacity');
    if (typeof currentSidebar === 'number' && currentSidebar > 0 && currentSidebar <= 40) {
      const updates: Partial<GiteroPreferences> = {};
      const chromeKeys: (keyof GiteroPreferences)[] = [
        'transparency.titleBar.bgOpacity',
        'transparency.activityBar.bgOpacity',
        'transparency.sidebar.bgOpacity',
        'transparency.tabBar.bgOpacity',
        'transparency.terminal.bgOpacity',
        'transparency.statusBar.bgOpacity'
      ];
      chromeKeys.forEach(k => {
        const val = preferencesService.get(k) as number;
        if (typeof val === 'number' && val <= 45) {
          (updates as any)[k] = Math.min(100, val + 25);
        }
      });
      if (Object.keys(updates).length > 0) {
        preferencesService.update(updates);
      }
    }

    this.apply();

    // Subscribe to all transparency preferences
    const keys: (keyof GiteroPreferences)[] = [
      'transparency.enabled',
      'transparency.atmosphereMood',
      'transparency.atmosphereIntensity',
      'transparency.blur',
      'transparency.master.bgOpacity',
      'transparency.master.textOpacity',
      'transparency.titleBar.bgOpacity',
      'transparency.titleBar.textOpacity',
      'transparency.activityBar.bgOpacity',
      'transparency.activityBar.textOpacity',
      'transparency.sidebar.bgOpacity',
      'transparency.sidebar.textOpacity',
      'transparency.tabBar.bgOpacity',
      'transparency.tabBar.textOpacity',
      'transparency.editor.bgOpacity',
      'transparency.editor.textOpacity',
      'transparency.terminal.bgOpacity',
      'transparency.terminal.textOpacity',
      'transparency.statusBar.bgOpacity',
      'transparency.statusBar.textOpacity',
      'transparency.overlays.bgOpacity',
      'transparency.overlays.textOpacity'
    ];

    keys.forEach(k => {
      preferencesService.subscribe(k, () => this.apply());
    });
  }

  apply() {
    const root = document.documentElement;
    const body = document.body;
    const enabled = preferencesService.get('transparency.enabled');

    if (!enabled) {
      root.classList.remove('transparency-active');
      body.classList.remove('transparency-active');
      root.style.removeProperty('background');
      root.style.removeProperty('background-color');
      body.style.removeProperty('background');
      body.style.removeProperty('background-color');
      root.style.setProperty('--transparency-blur', '0px');
      root.style.setProperty('--opacity-master-fg', '1');

      TRANSPARENCY_SECTIONS.forEach(sec => {
        root.style.setProperty(`--opacity-${sec.id.toLowerCase()}-bg`, '1');
        root.style.setProperty(`--opacity-${sec.id.toLowerCase()}-fg`, '1');
      });
      return;
    }

    root.classList.add('transparency-active');
    body.classList.add('transparency-active');
    root.style.setProperty('background', 'transparent', 'important');
    root.style.setProperty('background-color', 'transparent', 'important');
    body.style.setProperty('background', 'transparent', 'important');
    body.style.setProperty('background-color', 'transparent', 'important');

    const blur = preferencesService.get('transparency.blur') ?? 14;
    const masterBg = (preferencesService.get('transparency.master.bgOpacity') ?? 100) / 100;
    const masterText = (preferencesService.get('transparency.master.textOpacity') ?? 100) / 100;

    root.style.setProperty('--transparency-blur', `${blur}px`);
    root.style.setProperty('--opacity-master-bg', masterBg.toFixed(3));
    root.style.setProperty('--opacity-master-fg', Math.max(0.3, masterText).toFixed(3));

    TRANSPARENCY_SECTIONS.forEach(sec => {
      const sectionBgRaw = (preferencesService.get(sec.bgPrefKey) as number) ?? 100;
      const sectionTextRaw = (preferencesService.get(sec.textPrefKey) as number) ?? 100;

      // Effective background opacity combines section with master scaling
      const effectiveBg = (sectionBgRaw / 100) * masterBg;
      // Effective text opacity combines section with master scaling, bounded at min 30% for legibility
      const effectiveText = Math.max(0.3, (sectionTextRaw / 100) * masterText);

      root.style.setProperty(`--opacity-${sec.id.toLowerCase()}-bg`, effectiveBg.toFixed(3));
      root.style.setProperty(`--opacity-${sec.id.toLowerCase()}-fg`, effectiveText.toFixed(3));
    });
  }

  applyPreset(presetId: string) {
    const preset = TRANSPARENCY_PRESETS.find(p => p.id === presetId);
    if (!preset) return;

    if (preset.id === 'solid') {
      preferencesService.update({
        'transparency.enabled': false,
        'transparency.atmosphereMood': 'none',
        'transparency.atmosphereIntensity': 0,
        'transparency.blur': 0,
        'transparency.master.bgOpacity': 100,
        'transparency.master.textOpacity': 100,
        'transparency.titleBar.bgOpacity': 100,
        'transparency.titleBar.textOpacity': 100,
        'transparency.activityBar.bgOpacity': 100,
        'transparency.activityBar.textOpacity': 100,
        'transparency.sidebar.bgOpacity': 100,
        'transparency.sidebar.textOpacity': 100,
        'transparency.tabBar.bgOpacity': 100,
        'transparency.tabBar.textOpacity': 100,
        'transparency.editor.bgOpacity': 100,
        'transparency.editor.textOpacity': 100,
        'transparency.terminal.bgOpacity': 100,
        'transparency.terminal.textOpacity': 100,
        'transparency.statusBar.bgOpacity': 100,
        'transparency.statusBar.textOpacity': 100,
        'transparency.overlays.bgOpacity': 100,
        'transparency.overlays.textOpacity': 100
      });
      return;
    }

    const updates: Partial<GiteroPreferences> = {
      'transparency.enabled': true,
      'transparency.blur': preset.blur,
      'transparency.master.bgOpacity': preset.masterBg,
      'transparency.master.textOpacity': preset.masterText
    };

    if (preset.atmosphereMood) {
      updates['transparency.atmosphereMood'] = preset.atmosphereMood;
    }
    if (preset.atmosphereIntensity !== undefined) {
      updates['transparency.atmosphereIntensity'] = preset.atmosphereIntensity;
    }

    for (const [secId, vals] of Object.entries(preset.sections)) {
      const meta = TRANSPARENCY_SECTIONS.find(s => s.id === secId);
      if (meta) {
        (updates as any)[meta.bgPrefKey] = vals.bg;
        (updates as any)[meta.textPrefKey] = vals.text;
      }
    }

    preferencesService.update(updates);
  }

  resetSection(sectionId: string) {
    const meta = TRANSPARENCY_SECTIONS.find(s => s.id === sectionId);
    if (!meta) return;

    preferencesService.update({
      [meta.bgPrefKey]: meta.defaultBg,
      [meta.textPrefKey]: meta.defaultText
    } as any);
  }
}

export const transparencyService = new TransparencyService();
