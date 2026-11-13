import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { sidebarStore } from './store';
import { addItem } from './tree';

describe('sidebarStore', () => {
  beforeEach(() => fakeBrowser.reset());

  it('starts empty and persists updates', async () => {
    const initial = await sidebarStore.getValue();
    expect(initial).toMatchObject({ favorites: [], pinned: [] });
    await sidebarStore.setValue(addItem(initial, { title: 'Ex', url: 'https://example.com/' }, 'pinned'));
    const saved = await sidebarStore.getValue();
    expect(saved.pinned).toHaveLength(1);
    expect(saved.nodes[saved.pinned[0]!]).toMatchObject({ url: 'https://example.com/' });
  });
});
