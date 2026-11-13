import { classes, faviconUrl, type Ctx } from './ctx';
import { useSectionDrop, useTabDnd } from './dnd';
import { CloseIcon, PlusIcon } from './icons';
import type { MenuEntry } from './Menu';

export type Tab = Browser.tabs.Tab & { id: number };

export function tabFavicon(tab: Browser.tabs.Tab) {
  return tab.favIconUrl || faviconUrl(tab.url ?? '');
}

function tabMenu(ctx: Ctx, tab: Tab): MenuEntry[] {
  return [
    { label: 'Add to Favorites', onSelect: () => ctx.run({ type: 'saveTab', tabId: tab.id, container: 'favorites' }) },
    { label: 'Pin', onSelect: () => ctx.run({ type: 'saveTab', tabId: tab.id, container: 'pinned' }) },
    { label: 'Close tab', danger: true, onSelect: () => browser.tabs.remove(tab.id) },
  ];
}

function TabRow({ ctx, tab }: { ctx: Ctx; tab: Tab }) {
  const dnd = useTabDnd(tab.id, tab.index);
  const activate = () => browser.tabs.update(tab.id, { active: true });
  return (
    <div
      ref={dnd.ref}
      {...dnd.handlers}
      className={classes('row', 'tab', tab.active && 'active', dnd.isDragging && 'dragging', dnd.dropZone && `drop-${dnd.dropZone}`)}
      role="button"
      tabIndex={0}
      onClick={activate}
      onKeyDown={(e) => e.key === 'Enter' && activate()}
      onAuxClick={(e) => e.button === 1 && browser.tabs.remove(tab.id)}
      onContextMenu={(e) => ctx.openMenu(e, tabMenu(ctx, tab))}
    >
      <img src={tabFavicon(tab)} alt="" />
      <span className="title">{tab.title || tab.url}</span>
      <button
        className="icon close"
        title="Close tab"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          browser.tabs.remove(tab.id);
        }}
      >
        <CloseIcon />
      </button>
    </div>
  );
}

/** This window's tabs that aren't linked to a Favorite or pinned item, in Chrome's order. */
export function Tabs({ ctx, tabs }: { ctx: Ctx; tabs: Tab[] }) {
  const section = useSectionDrop('tabs');
  return (
    <section ref={section.ref} className={classes('tabs', section.isTarget && 'drop-section')}>
      <div className="divider" />
      <button className="row new-tab" onClick={() => browser.tabs.create({ windowId: ctx.windowId })}>
        <PlusIcon />
        <span className="title">New Tab</span>
      </button>
      {tabs.map((tab) => (
        <TabRow key={tab.id} ctx={ctx} tab={tab} />
      ))}
    </section>
  );
}
