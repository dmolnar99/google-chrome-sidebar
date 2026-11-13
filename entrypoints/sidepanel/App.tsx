import { updateSidebar } from '@/src/model/store';
import { addItem, removeNode, updateNode } from '@/src/model/tree';
import type { NodeId, SidebarState } from '@/src/model/types';
import { useSidebar } from './useSidebar';

function faviconUrl(pageUrl: string) {
  const url = new URL(browser.runtime.getURL('/_favicon/' as '/'));
  url.searchParams.set('pageUrl', pageUrl);
  url.searchParams.set('size', '32');
  return url.toString();
}

async function addCurrentTab(container: 'favorites' | 'pinned') {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) return;
  await updateSidebar((s) => addItem(s, { title: tab.title ?? tab.url!, url: tab.url! }, container));
}

const remove = (id: NodeId) => updateSidebar((s) => removeNode(s, id));

function Favorites({ state }: { state: SidebarState }) {
  return (
    <div className="favorites">
      {state.favorites.map((id) => {
        const item = state.nodes[id];
        if (item?.kind !== 'item') return null;
        return (
          <button
            key={id}
            className="favorite"
            title={item.title}
            onContextMenu={(e) => {
              e.preventDefault();
              remove(id);
            }}
          >
            <img src={faviconUrl(item.url)} alt="" />
          </button>
        );
      })}
    </div>
  );
}

function Tree({ state, ids }: { state: SidebarState; ids: NodeId[] }) {
  return (
    <ul className="tree">
      {ids.map((id) => {
        const node = state.nodes[id];
        if (!node) return null;
        if (node.kind === 'folder') {
          return (
            <li key={id}>
              <button
                className="row"
                onClick={() => updateSidebar((s) => updateNode(s, id, { collapsed: !node.collapsed }))}
              >
                <span className="chevron">{node.collapsed ? '▸' : '▾'}</span>
                <span className="title">{node.title}</span>
              </button>
              {!node.collapsed && <Tree state={state} ids={node.childIds} />}
            </li>
          );
        }
        return (
          <li key={id}>
            <div className="row">
              <img src={faviconUrl(node.url)} alt="" />
              <span className="title">{node.title}</span>
              <button className="close" title="Remove" onClick={() => remove(id)}>
                ×
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function App() {
  const state = useSidebar();
  if (!state) return null;
  const isEmpty = state.favorites.length === 0 && state.pinned.length === 0;
  return (
    <main>
      {isEmpty && (
        <button className="empty" onClick={() => browser.runtime.openOptionsPage()}>
          Import your Arc sidebar…
        </button>
      )}
      <Favorites state={state} />
      <Tree state={state} ids={state.pinned} />
      {/* Temporary controls until drag-and-drop and context menus land (milestones 3–4). */}
      <div className="dev-controls">
        <button onClick={() => addCurrentTab('favorites')}>+ Favorite</button>
        <button onClick={() => addCurrentTab('pinned')}>+ Pin</button>
      </div>
    </main>
  );
}
