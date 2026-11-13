import { describe, expect, it } from 'vitest';
import { themeCss, themeTokens } from './arcTheme';

describe('themeTokens', () => {
  it("reproduces Arc's tint for the screenshot's theme color", () => {
    // Arc showed #9ebece (hsl ≈ 201 33% 71%) for theme color #6cbad9.
    expect(themeTokens('#6cbad9')!.light['--bg']).toBe('hsl(197 33% 71%)');
  });

  it('rejects malformed colors', () => {
    expect(themeTokens('blue')).toBeUndefined();
    expect(themeCss('nope')).toBe('');
    expect(themeCss(null)).toBe('');
  });

  it('handles grays without a hue', () => {
    expect(themeTokens('#808080')!.light['--bg']).toBe('hsl(0 0% 71%)');
  });
});
