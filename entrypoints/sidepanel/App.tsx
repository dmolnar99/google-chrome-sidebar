import { useCallback, useState } from 'react';
import { send } from '@/src/messages';
import type { Ctx } from './ctx';
import { tabState } from './ctx';
import { Dialog, type DialogRequest } from './Dialog';
import { SidebarDnd } from './dnd';
import { Favorites } from './Favorites';
import { useLinks, useSidebar, useWindowTabs } from './hooks';
import { Menu, type MenuEntry } from './Menu';
import { DragPreview, Pinned } from './Tree';

export function App() {
  const state = useSidebar();
  const links = useLinks();
  const win = useWindowTabs();
  const [menu, setMenu] = useState<{ x: number; y: number; entries: MenuEntry[] }>();
  const [dialog, setDialog] = useState<DialogRequest>();
  const [error, setError] = useState<string>();
  const closeMenu = useCallback(() => setMenu(undefined), []);

  if (!state || !win) return null;

  const ctx: Ctx = {
    state,
    windowId: win.windowId,
    tabStateOf: (item) => tabState(item, links, win),
    run: (command) =>
      send(command).catch((e: Error) => {
        console.error(e);
        setError(e.message);
        setTimeout(() => setError(undefined), 4000);
      }),
    openMenu: (e, entries) => {
      e.preventDefault();
      e.stopPropagation();
      setMenu({ x: e.clientX, y: e.clientY, entries });
    },
    ask: setDialog,
  };

  const saveActiveTab = (container: 'favorites' | 'pinned') => {
    const active = [...win.tabs.values()].find((t) => t.active);
    if (active?.id !== undefined) ctx.run({ type: 'saveTab', tabId: active.id, container });
  };

  const isEmpty = state.favorites.length === 0 && state.pinned.length === 0;
  return (
    <SidebarDnd
      state={state}
      onMove={(id, container, index) => ctx.run({ type: 'sidebar', op: { type: 'move', id, container, index } })}
      onExpand={(id) => ctx.run({ type: 'sidebar', op: { type: 'update', id, patch: { collapsed: false } } })}
      renderOverlay={(id) => <DragPreview ctx={ctx} id={id} />}
    >
      <main onContextMenu={(e) => e.preventDefault()}>
        {isEmpty && (
          <button className="empty" onClick={() => browser.runtime.openOptionsPage()}>
            Import your Arc sidebar…
          </button>
        )}
        <Favorites ctx={ctx} />
        <Pinned ctx={ctx} />
        {/* Temporary controls until the Tabs list lands (milestone 5). */}
        <div className="dev-controls">
          <button onClick={() => saveActiveTab('favorites')}>+ Favorite</button>
          <button onClick={() => saveActiveTab('pinned')}>+ Pin</button>
        </div>
        {error && <p className="error">{error}</p>}
        {menu && <Menu {...menu} onClose={closeMenu} />}
        {dialog && <Dialog request={dialog} onClose={() => setDialog(undefined)} />}
      </main>
    </SidebarDnd>
  );
}
