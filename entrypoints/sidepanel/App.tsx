import { useCallback, useState } from 'react';
import { send } from '@/src/messages';
import { useThemeColor } from '@/src/ui/themeStore';
import type { Ctx } from './ctx';
import { tabState } from './ctx';
import { Dialog, type DialogRequest } from './Dialog';
import { SidebarDnd } from './dnd';
import { Favorites } from './Favorites';
import { useLinks, useSidebar, useWindowTabs } from './hooks';
import { Menu, type MenuEntry } from './Menu';
import { Tabs, type Tab } from './Tabs';
import { DragPreview, Pinned } from './Tree';

export function App() {
  useThemeColor();
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

  const linkedTabs = new Set(Object.keys(links).map(Number));
  const allTabs = [...win.tabs.values()].filter((t): t is Tab => t.id !== undefined).sort((a, b) => a.index - b.index);
  const plainTabs = allTabs.filter((t) => !linkedTabs.has(t.id));

  const isEmpty = state.favorites.length === 0 && state.pinned.length === 0;
  return (
    <SidebarDnd
      state={state}
      tabCount={allTabs.length}
      tabIndex={(tabId) => win.tabs.get(tabId)?.index}
      onDrop={(action) => {
        switch (action.type) {
          case 'move':
            return ctx.run({ type: 'sidebar', op: action });
          case 'unpin':
            return ctx.run({ ...action, windowId: win.windowId });
          default:
            return ctx.run(action);
        }
      }}
      onExpand={(id) => ctx.run({ type: 'sidebar', op: { type: 'update', id, patch: { collapsed: false } } })}
      renderOverlay={(source) => <DragPreview ctx={ctx} source={source} tab={source.kind === 'tab' ? win.tabs.get(source.tabId) : undefined} />}
    >
      <main onContextMenu={(e) => e.preventDefault()}>
        {isEmpty && (
          <button className="empty" onClick={() => browser.runtime.openOptionsPage()}>
            Import your Arc sidebar…
          </button>
        )}
        <Favorites ctx={ctx} />
        <Pinned ctx={ctx} />
        <Tabs ctx={ctx} tabs={plainTabs} />
        {error && <p className="error">{error}</p>}
        {menu && <Menu {...menu} onClose={closeMenu} />}
        {dialog && <Dialog request={dialog} onClose={() => setDialog(undefined)} />}
      </main>
    </SidebarDnd>
  );
}
