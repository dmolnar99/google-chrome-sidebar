import { storage } from 'wxt/utils/storage';
import { emptyState } from './tree';
import type { SidebarState } from './types';

/** The saved sidebar. Only the background worker writes it; pages send a SidebarOp instead. */
export const sidebarStore = storage.defineItem<SidebarState>('local:sidebar', {
  fallback: emptyState(),
  version: 1,
});
