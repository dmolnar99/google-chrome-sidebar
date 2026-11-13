import type { SidebarOp } from '@/src/model/ops';
import { newId } from '@/src/model/tree';
import type { ContainerId, Folder, Item } from '@/src/model/types';
import type { Ctx } from './ctx';
import type { MenuEntry } from './Menu';

/** Accepts "example.com" as well as full URLs. */
export function normalizeUrl(input: string): string | undefined {
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(input) ? input : `https://${input}`;
  try {
    return new URL(withScheme).toString();
  } catch {
    return undefined;
  }
}

const edit = (ctx: Ctx, op: SidebarOp) => ctx.run({ type: 'sidebar', op });

/** Creates a folder and asks for its name straight away. */
export function newFolder(ctx: Ctx, container: ContainerId, index?: number) {
  const id = newId();
  edit(ctx, { type: 'add', node: { kind: 'folder', id, title: 'New Folder', childIds: [], collapsed: false }, container, index });
  ctx.ask({ kind: 'input', title: 'Name folder', value: 'New Folder', onSubmit: (title) => edit(ctx, { type: 'update', id, patch: { title } }) });
}

export function itemMenu(ctx: Ctx, item: Item): MenuEntry[] {
  const { windowId } = ctx;
  const ts = ctx.tabStateOf(item);
  return [
    ...(ts.drifted ? [{ label: 'Back to saved URL', onSelect: () => ctx.run({ type: 'reset', itemId: item.id, windowId }) }] : []),
    ...(ts.open ? [{ label: 'Close tab', onSelect: () => ctx.run({ type: 'closeTab', itemId: item.id, windowId }) }] : []),
    {
      label: 'Rename…',
      onSelect: () =>
        ctx.ask({ kind: 'input', title: 'Rename', value: item.title, onSubmit: (title) => edit(ctx, { type: 'update', id: item.id, patch: { title } }) }),
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
            if (url) edit(ctx, { type: 'update', id: item.id, patch: { url } });
          },
        }),
    },
    { label: 'Delete', danger: true, onSelect: () => edit(ctx, { type: 'remove', id: item.id }) },
  ];
}

export function folderMenu(ctx: Ctx, folder: Folder): MenuEntry[] {
  const remove = () => edit(ctx, { type: 'remove', id: folder.id });
  return [
    { label: 'New folder inside', onSelect: () => newFolder(ctx, folder.id) },
    {
      label: 'Rename…',
      onSelect: () =>
        ctx.ask({ kind: 'input', title: 'Rename folder', value: folder.title, onSubmit: (title) => edit(ctx, { type: 'update', id: folder.id, patch: { title } }) }),
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

export function pinnedMenu(ctx: Ctx): MenuEntry[] {
  return [{ label: 'New folder', onSelect: () => newFolder(ctx, 'pinned') }];
}
