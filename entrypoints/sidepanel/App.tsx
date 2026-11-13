import { useCallback, useState, type MouseEvent } from 'react';
import { tabForItem, type Links } from '@/src/links/links';
import { send, type Command } from '@/src/messages';
import type { SidebarOp } from '@/src/model/ops';
import type { Folder, Item, NodeId, SidebarState } from '@/src/model/types';
import { Dialog, type DialogRequest } from './Dialog';
import { useLinks, useSidebar, useWindowTabs, type WindowTabs } from './hooks';
import { Menu, type MenuEntry } from './Menu';

function faviconUrl(pageUrl: string) {
  const url = new URL(browser.runtime.getURL('/_favicon/' as '/'));
  url.searchParams.set('pageUrl', pageUrl);
  url.searchParams.set('size', '32');
  return url.toString();
}

/** Accepts "example.com" as well as full URLs. */
function normalizeUrl(input: string): string | undefined {
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(input) ? input : `https://${input}`;
  try {
    return new URL(withScheme).toString();
  } catch {
    return undefined;
  }
}

/** What the panel knows about an item's tab in this window. */
interface TabState {
  open: boolean;
  active: boolean;
  /** The linked tab has navigated away from the saved URL. */
  drifted: boolean;
}

function tabState(item: Item, links: Links, win: WindowTabs): TabState {
  const tabId = tabForItem(links, item.id, win.windowId);
  const tab = tabId === undefined ? undefined : win.tabs.get(tabId);
  if (!tab) return { open: false, active: false, drifted: false };
  const url = tab.pendingUrl ?? tab.url;
  return { open: true, active: !!tab.active, drifted: !!url && url !== item.url };
}

interface Ctx {
  state: SidebarState;
  tabStateOf: (item: Item) => TabState;
  run: (command: Command) => void;
  openMenu: (e: MouseEvent, entries: MenuEntry[]) => void;
  ask: (request: DialogRequest) => void;
  windowId: number;
}

function itemMenu(ctx: Ctx, item: Item): MenuEntry[] {
  const { windowId } = ctx;
  const ts = ctx.tabStateOf(item);
  const edit = (op: SidebarOp) => ctx.run({ type: 'sidebar', op });
  return [
    ...(ts.drifted ? [{ label: 'Back to saved URL', onSelect: () => ctx.run({ type: 'reset', itemId: item.id, windowId }) }] : []),
    ...(ts.open ? [{ label: 'Close tab', onSelect: () => ctx.run({ type: 'closeTab', itemId: item.id, windowId }) }] : []),
    {
      label: 'Rename…',
      onSelect: () =>
        ctx.ask({ kind: 'input', title: 'Rename', value: item.title, onSubmit: (title) => edit({ type: 'update', id: item.id, patch: { title } }) }),
    },
    {
      label: 'Edit URL…',
      onSelect: () =>
        ctx.ask({
          kind: 'input',
          title: 'Edit URL',
          value: item.url,
          onSubmit: (value) => {
            const url = normalizeUrl(value);
            if (url) edit({ type: 'update', id: item.id, patch: { url } });
          },
        }),
    },
    { label: 'Delete', danger: true, onSelect: () => edit({ type: 'remove', id: item.id }) },
  ];
}

function folderMenu(ctx: Ctx, folder: Folder): MenuEntry[] {
  const edit = (op: SidebarOp) => ctx.run({ type: 'sidebar', op });
  const remove = () => edit({ type: 'remove', id: folder.id });
  return [
    {
      label: 'Rename…',
      onSelect: () =>
        ctx.ask({ kind: 'input', title: 'Rename folder', value: folder.title, onSubmit: (title) => edit({ type: 'update', id: folder.id, patch: { title } }) }),
    },
    {
      label: 'Delete',
      danger: true,
      onSelect: () =>
        folder.childIds.length === 0
          ? remove()
          : ctx.ask({
              kind: 'confirm',
              title: `Delete “${folder.title}”?`,
              message: 'Everything inside this folder will be deleted too. Open tabs stay open.',
              confirmLabel: 'Delete',
              onConfirm: remove,
            }),
    },
  ];
}

function classes(...names: (string | false)[]) {
  return names.filter(Boolean).join(' ');
}

function Favorites({ ctx }: { ctx: Ctx }) {
  if (ctx.state.favorites.length === 0) return null;
  return (
    <div className="favorites">
      {ctx.state.favorites.map((id) => {
        const item = ctx.state.nodes[id];
        if (item?.kind !== 'item') return null;
        const ts = ctx.tabStateOf(item);
        return (
          <button
            key={id}
            className={classes('favorite', ts.open && 'open', ts.active && 'active')}
            title={item.title}
            onClick={() => ctx.run({ type: 'activate', itemId: id, windowId: ctx.windowId })}
            onContextMenu={(e) => ctx.openMenu(e, itemMenu(ctx, item))}
          >
            <img src={faviconUrl(item.url)} alt="" />
          </button>
        );
      })}
    </div>
  );
}

function ItemRow({ ctx, item }: { ctx: Ctx; item: Item }) {
  const ts = ctx.tabStateOf(item);
  const command = { itemId: item.id, windowId: ctx.windowId };
  return (
    <div
      className={classes('row', 'item', ts.open && 'open', ts.active && 'active')}
      role="button"
      tabIndex={0}
      onClick={() => ctx.run({ type: 'activate', ...command })}
      onKeyDown={(e) => e.key === 'Enter' && ctx.run({ type: 'activate', ...command })}
      onContextMenu={(e) => ctx.openMenu(e, itemMenu(ctx, item))}
    >
      <img src={faviconUrl(item.url)} alt="" />
      <span className="title">{item.title}</span>
      {ts.drifted && (
        <button
          className="icon"
          title="Back to saved URL"
          onClick={(e) => {
            e.stopPropagation();
            ctx.run({ type: 'reset', ...command });
          }}
        >
          ↺
        </button>
      )}
      {ts.open && (
        <button
          className="icon close"
          title="Close tab"
          onClick={(e) => {
            e.stopPropagation();
            ctx.run({ type: 'closeTab', ...command });
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}

function Tree({ ctx, ids }: { ctx: Ctx; ids: NodeId[] }) {
  return (
    <ul className="tree">
      {ids.map((id) => {
        const node = ctx.state.nodes[id];
        if (!node) return null;
        if (node.kind === 'item') {
          return (
            <li key={id}>
              <ItemRow ctx={ctx} item={node} />
            </li>
          );
        }
        return (
          <li key={id}>
            <button
              className="row"
              onClick={() => ctx.run({ type: 'sidebar', op: { type: 'update', id, patch: { collapsed: !node.collapsed } } })}
              onContextMenu={(e) => ctx.openMenu(e, folderMenu(ctx, node))}
            >
              <span className="chevron">{node.collapsed ? '▸' : '▾'}</span>
              <span className="title">{node.title}</span>
            </button>
            {!node.collapsed && <Tree ctx={ctx} ids={node.childIds} />}
          </li>
        );
      })}
    </ul>
  );
}

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
    <main onContextMenu={(e) => e.preventDefault()}>
      {isEmpty && (
        <button className="empty" onClick={() => browser.runtime.openOptionsPage()}>
          Import your Arc sidebar…
        </button>
      )}
      <Favorites ctx={ctx} />
      <Tree ctx={ctx} ids={state.pinned} />
      {/* Temporary controls until drag-and-drop lands (milestone 4). */}
      <div className="dev-controls">
        <button onClick={() => saveActiveTab('favorites')}>+ Favorite</button>
        <button onClick={() => saveActiveTab('pinned')}>+ Pin</button>
      </div>
      {error && <p className="error">{error}</p>}
      {menu && <Menu {...menu} onClose={closeMenu} />}
      {dialog && <Dialog request={dialog} onClose={() => setDialog(undefined)} />}
    </main>
  );
}
