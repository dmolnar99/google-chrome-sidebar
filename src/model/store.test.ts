import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { sidebarStore, updateSidebar } from './store';
import { addItem } from './tree';

describe('sidebarStore', () => {
  beforeEach(() => fakeBrowser.reset());

  it('starts empty and persists updates', async () => {
    expect(await sidebarStore.getValue()).toMatchObject({ favorites: [], pinned: [] });
    await updateSidebar((s) => addItem(s, { title: 'Ex', url: 'https://example.com/' }, 'pinned'));
    const saved = await sidebarStore.getValue();
    expect(saved.pinned).toHaveLength(1);
    expect(saved.nodes[saved.pinned[0]!]).toMatchObject({ url: 'https://example.com/' });
  });
});
