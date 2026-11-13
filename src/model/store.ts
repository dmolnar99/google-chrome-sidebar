import { storage } from 'wxt/utils/storage';
import { emptyState } from './tree';
import type { SidebarState } from './types';

export const sidebarStore = storage.defineItem<SidebarState>('local:sidebar', {
  fallback: emptyState(),
  version: 1,
});

/** Read-modify-write. Every change to the saved sidebar goes through here. */
export async function updateSidebar(fn: (state: SidebarState) => SidebarState) {
  await sidebarStore.setValue(fn(await sidebarStore.getValue()));
}
