import type { Item } from '@/src/model/types';
import { classes, faviconUrl, type Ctx } from './ctx';
import { useNodeDnd, useSectionDrop } from './dnd';
import { itemMenu } from './menus';

function Tile({ ctx, item }: { ctx: Ctx; item: Item }) {
  const ts = ctx.tabStateOf(item);
  const dnd = useNodeDnd(item.id, 'grid');
  return (
    <button
      ref={dnd.ref}
      {...dnd.handlers}
      className={classes('favorite', ts.open && 'open', ts.active && 'active', dnd.isDragging && 'dragging', dnd.dropZone && `drop-${dnd.dropZone}`)}
      title={item.title}
      onClick={() => ctx.run({ type: 'activate', itemId: item.id, windowId: ctx.windowId })}
      onContextMenu={(e) => ctx.openMenu(e, itemMenu(ctx, item))}
    >
      <img src={faviconUrl(item.url)} alt="" />
    </button>
  );
}

export function Favorites({ ctx }: { ctx: Ctx }) {
  const section = useSectionDrop('favorites');
  const items = ctx.state.favorites.map((id) => ctx.state.nodes[id]).filter((n): n is Item => n?.kind === 'item');
  // Hidden when empty, except mid-drag so there's somewhere to drop the first Favorite.
  if (items.length === 0 && !section.isDragging) return null;
  return (
    <div ref={section.ref} className={classes('favorites', section.isTarget && 'drop-section')}>
      {items.map((item) => (
        <Tile key={item.id} ctx={ctx} item={item} />
      ))}
      {items.length === 0 && <div className="placeholder">Drop here to add to Favorites</div>}
    </div>
  );
}
