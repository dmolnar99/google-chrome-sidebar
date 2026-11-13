import type { Folder, Item, NodeId } from '@/src/model/types';
import { classes, faviconUrl, type Ctx } from './ctx';
import { useNodeDnd, useSectionDrop } from './dnd';
import { folderMenu, itemMenu, pinnedMenu } from './menus';

function ItemRow({ ctx, item }: { ctx: Ctx; item: Item }) {
  const ts = ctx.tabStateOf(item);
  const dnd = useNodeDnd(item.id, 'list');
  const command = { itemId: item.id, windowId: ctx.windowId };
  return (
    <div
      ref={dnd.ref}
      {...dnd.handlers}
      className={classes('row', 'item', ts.open && 'open', ts.active && 'active', dnd.isDragging && 'dragging', dnd.dropZone && `drop-${dnd.dropZone}`)}
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
          onPointerDown={(e) => e.stopPropagation()}
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
          onPointerDown={(e) => e.stopPropagation()}
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

function FolderRow({ ctx, folder }: { ctx: Ctx; folder: Folder }) {
  const dnd = useNodeDnd(folder.id, 'list');
  return (
    <>
      <button
        ref={dnd.ref}
        {...dnd.handlers}
        className={classes('row', 'folder', dnd.isDragging && 'dragging', dnd.dropZone && `drop-${dnd.dropZone}`)}
        onClick={() => ctx.run({ type: 'sidebar', op: { type: 'update', id: folder.id, patch: { collapsed: !folder.collapsed } } })}
        onContextMenu={(e) => ctx.openMenu(e, folderMenu(ctx, folder))}
      >
        <span className="chevron">{folder.collapsed ? '▸' : '▾'}</span>
        <span className="title">{folder.title}</span>
      </button>
      {!folder.collapsed && !dnd.isDragging && <Tree ctx={ctx} ids={folder.childIds} />}
    </>
  );
}

function Tree({ ctx, ids }: { ctx: Ctx; ids: NodeId[] }) {
  return (
    <ul className="tree">
      {ids.map((id) => {
        const node = ctx.state.nodes[id];
        if (!node) return null;
        return <li key={id}>{node.kind === 'item' ? <ItemRow ctx={ctx} item={node} /> : <FolderRow ctx={ctx} folder={node} />}</li>;
      })}
    </ul>
  );
}

/** Pinned items and folders. The empty space below the list accepts drops and right-clicks. */
export function Pinned({ ctx }: { ctx: Ctx }) {
  const section = useSectionDrop('pinned');
  return (
    <section
      ref={section.ref}
      className={classes('pinned', section.isTarget && 'drop-section')}
      onContextMenu={(e) => ctx.openMenu(e, pinnedMenu(ctx))}
    >
      <Tree ctx={ctx} ids={ctx.state.pinned} />
    </section>
  );
}

/** What follows the pointer while dragging. */
export function DragPreview({ ctx, id }: { ctx: Ctx; id: NodeId }) {
  const node = ctx.state.nodes[id];
  if (!node) return null;
  return (
    <div className="row drag-preview">
      {node.kind === 'item' ? <img src={faviconUrl(node.url)} alt="" /> : <span className="chevron">▸</span>}
      <span className="title">{node.title}</span>
    </div>
  );
}
