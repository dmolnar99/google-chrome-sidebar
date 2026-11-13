import { storage } from 'wxt/utils/storage';
import { useEffect } from 'react';
import { themeCss } from './arcTheme';

/** The sidebar's theme color as #rrggbb, or null for the neutral default. */
export const themeColorStore = storage.defineItem<string | null>('local:themeColor', { fallback: null });

/** Applies the stored theme color to this page and keeps it updated. */
export function useThemeColor() {
  useEffect(() => {
    const style = document.createElement('style');
    document.head.append(style);
    const apply = (color: string | null) => (style.textContent = themeCss(color));
    themeColorStore.getValue().then(apply);
    const unwatch = themeColorStore.watch(apply);
    return () => {
      unwatch();
      style.remove();
    };
  }, []);
}
