import { Extension } from '@codemirror/state';
import { indentationMarkers } from '@replit/codemirror-indentation-markers';

/**
 * Creates indentation markers extension with active block scope highlighting.
 */
export function createIndentGuidesExtension(enabled: boolean = true): Extension {
  if (!enabled) return [];

  return indentationMarkers({
    highlightActiveBlock: true,
    hideFirstIndent: false,
    markerType: 'fullScope',
    thickness: 1,
    activeThickness: 1.5,
    colors: {
      dark: 'rgba(255, 255, 255, 0.09)',
      activeDark: 'rgba(255, 255, 255, 0.28)',
      light: 'rgba(0, 0, 0, 0.08)',
      activeLight: 'rgba(0, 0, 0, 0.24)'
    }
  });
}
