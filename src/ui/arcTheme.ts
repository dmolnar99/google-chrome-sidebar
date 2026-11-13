/**
 * Builds the panel's color tokens from one theme color, the way Arc tints its sidebar: same hue,
 * toned-down saturation, fixed lightness. Matched against a screenshot of Arc with the theme
 * color #6cbad9, which Arc renders as a #9ebece background with #071c25 text.
 */

function hexToHsl(hex: string): [number, number, number] | undefined {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!m) return undefined;
  const [r, g, b] = m.slice(1).map((h) => parseInt(h, 16) / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s * 100, l * 100];
}

const hsl = (h: number, s: number, l: number) => `hsl(${h.toFixed(0)} ${s.toFixed(0)}% ${l.toFixed(0)}%)`;

export interface ThemeTokens {
  light: Record<string, string>;
  dark: Record<string, string>;
}

export function themeTokens(color: string): ThemeTokens | undefined {
  const parsed = hexToHsl(color);
  if (!parsed) return undefined;
  const [h, s] = parsed;
  return {
    light: {
      '--bg': hsl(h, s * 0.56, 71),
      '--fg': hsl(h, 70, 8),
      '--muted': hsl(h, 14, 37),
    },
    dark: {
      '--bg': hsl(h, s * 0.3, 17),
      '--fg': hsl(h, 25, 93),
      '--muted': hsl(h, 12, 65),
    },
  };
}

/** CSS that overrides the default tokens, for both color schemes. Empty when there's no theme. */
export function themeCss(color: string | null | undefined): string {
  const tokens = color ? themeTokens(color) : undefined;
  if (!tokens) return '';
  const block = (vars: Record<string, string>) => Object.entries(vars).map(([k, v]) => `${k}: ${v};`).join(' ');
  return `:root { ${block(tokens.light)} } @media (prefers-color-scheme: dark) { :root { ${block(tokens.dark)} } }`;
}
