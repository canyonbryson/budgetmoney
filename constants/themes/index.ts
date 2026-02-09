import type { ThemeDefinition, ThemeId, ColorScheme, ResolvedTheme } from './types';
import { classicTheme } from './classic';
import { oceanTheme } from './ocean';
import { emberTheme } from './ember';
import { botanicalTheme } from './botanical';
import { noirTheme } from './noir';
import { classicnoirTheme } from './classicnoir';

export { type ThemeId, type ColorScheme, type ResolvedTheme, type ThemeDefinition } from './types';

// ── Registry ─────────────────────────────────────────────────────────

export const themes: Record<ThemeId, ThemeDefinition> = {
  classic: classicTheme,
  ocean: oceanTheme,
  ember: emberTheme,
  botanical: botanicalTheme,
  noir: noirTheme,
  classicnoir: classicnoirTheme,
};

export const themeIds = Object.keys(themes) as ThemeId[];

export const DEFAULT_THEME_ID: ThemeId = 'classicnoir';

// ── Resolver ─────────────────────────────────────────────────────────

export function resolveTheme(
  themeId: ThemeId,
  colorScheme: ColorScheme,
): ResolvedTheme {
  const def = themes[themeId] ?? themes[DEFAULT_THEME_ID];
  return {
    id: def.id,
    displayName: def.displayName,
    colorScheme,
    fonts: def.fonts,
    colors: def.colors[colorScheme],
    spacing: def.spacing,
    borderRadius: def.borderRadius,
    shadows: def.shadows,
    typography: def.typography,
  };
}
