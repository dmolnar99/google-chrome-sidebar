import { storage } from 'wxt/utils/storage';
import type { Links } from './links';

/**
 * Live item–tab links. Session storage survives service-worker restarts but is cleared when the
 * browser restarts or the extension reloads; `null` means "not built yet".
 */
export const linksStore = storage.defineItem<Links | null>('session:links', { fallback: null });
