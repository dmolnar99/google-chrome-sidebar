import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragMoveEvent,
} from '@dnd-kit/core';
import { createContext, useContext, useRef, useState, type ReactNode } from 'react';
import { resolveDrop, targetForRow, zoneAt, type Destination, type DragSource, type DropAction, type Zone } from '@/src/model/drop';
import { childList } from '@/src/model/tree';
import type { NodeId, SidebarState } from '@/src/model/types';

type Section = 'favorites' | 'pinned' | 'tabs';
type DropData =
  | { type: 'node'; id: NodeId; layout: 'list' | 'grid' }
  | { type: 'tab'; tabId: number; index: number }
  | { type: 'section'; section: Section };
/** `key` matches the drop target's id, e.g. "node:<id>" or "tab:<id>". */
type Indicator = { key: string; zone: Zone } | { section: Section };
interface Drop {
  action: DropAction;
  indicator: Indicator;
}

const DndState = createContext<{ drop?: Drop; source?: DragSource }>({});

const sourceKey = (s: DragSource) => (s.kind === 'node' ? `node:${s.id}` : `tab:${s.tabId}`);

/** Rows and tiles win over the section they sit in; sections catch drops on empty space. */
const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  const specific = hits.filter((h) => !String(h.id).startsWith('section:'));
  return specific.length ? specific : hits;
};

const HOVER_EXPAND_MS = 600;

export function SidebarDnd(props: {
  state: SidebarState;
  /** Number of tabs in the window; dropping on the Tabs section's empty space appends there. */
  tabCount: number;
  tabIndex: (tabId: number) => number | undefined;
  onDrop: (action: DropAction) => void;
  onExpand: (folderId: NodeId) => void;
  renderOverlay: (source: DragSource) => ReactNode;
  children: ReactNode;
}) {
  const { state } = props;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const [source, setSource] = useState<DragSource>();
  const [drop, setDrop] = useState<Drop>();
  const expand = useRef<{ id: NodeId; timer: ReturnType<typeof setTimeout> }>(undefined);

  const stopExpand = () => {
    if (expand.current) clearTimeout(expand.current.timer);
    expand.current = undefined;
  };

  const track = (e: DragMoveEvent) => {
    const data = e.over?.data.current as DropData | undefined;
    const dragged = e.active.data.current as DragSource;
    let next: Drop | undefined;
    let hoverFolder: NodeId | undefined;
    if (e.over && data) {
      const start = e.activatorEvent as PointerEvent;
      const x = start.clientX + e.delta.x;
      const y = start.clientY + e.delta.y;
      const rect = e.over.rect;
      const fraction = (y - rect.top) / rect.height;
      let dest: Destination | undefined;
      let indicator: Indicator;
      if (data.type === 'section') {
        dest =
          data.section === 'tabs'
            ? { kind: 'tabs', index: props.tabCount }
            : { kind: 'tree', container: data.section, index: childList(state, data.section).length };
        indicator = { section: data.section };
      } else if (data.type === 'tab') {
        const zone = zoneAt(fraction, false);
        dest = { kind: 'tabs', index: zone === 'before' ? data.index : data.index + 1 };
        indicator = { key: `tab:${data.tabId}`, zone };
      } else {
        const node = state.nodes[data.id];
        const isFolder = node?.kind === 'folder';
        const zone: Zone = data.layout === 'grid' ? (x - rect.left < rect.width / 2 ? 'before' : 'after') : zoneAt(fraction, isFolder);
        const target = targetForRow(state, data.id, zone, { expanded: isFolder && !node.collapsed });
        dest = target && { kind: 'tree', ...target };
        indicator = { key: `node:${data.id}`, zone };
        if (isFolder && node.collapsed && zone === 'inside') hoverFolder = node.id;
      }
      const action = dest && resolveDrop(state, dragged, dest, props.tabIndex);
      if (action) next = { action, indicator };
    }

    if (hoverFolder !== expand.current?.id) {
      stopExpand();
      if (hoverFolder) {
        const id = hoverFolder;
        expand.current = { id, timer: setTimeout(() => props.onExpand(id), HOVER_EXPAND_MS) };
      }
    }
    // Pointer moves fire constantly; only re-render when the drop position actually changes.
    setDrop((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
  };

  const reset = () => {
    stopExpand();
    setSource(undefined);
    setDrop(undefined);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      onDragStart={(e) => setSource(e.active.data.current as DragSource)}
      onDragMove={track}
      onDragEnd={() => {
        if (drop) props.onDrop(drop.action);
        reset();
      }}
      onDragCancel={reset}
    >
      <DndState.Provider value={{ drop, source }}>{props.children}</DndState.Provider>
      <DragOverlay dropAnimation={null}>{source && props.renderOverlay(source)}</DragOverlay>
    </DndContext>
  );
}

function useIndicator(key: string): Zone | undefined {
  const indicator = useContext(DndState).drop?.indicator;
  return indicator && 'key' in indicator && indicator.key === key ? indicator.zone : undefined;
}

function useDragAndDrop(source: DragSource, data: DropData) {
  const key = sourceKey(source);
  const drag = useDraggable({ id: key, data: source });
  const target = useDroppable({ id: key, data });
  return {
    ref: (el: HTMLElement | null) => {
      drag.setNodeRef(el);
      target.setNodeRef(el);
    },
    handlers: drag.listeners,
    isDragging: drag.isDragging,
    dropZone: useIndicator(key),
  };
}

/** Makes a sidebar row (list) or Favorite tile (grid) draggable and a drop target. */
export function useNodeDnd(id: NodeId, layout: 'list' | 'grid') {
  return useDragAndDrop({ kind: 'node', id }, { type: 'node', id, layout });
}

/** Makes a row in the Tabs list draggable and a drop target. `index` is the tab's Chrome index. */
export function useTabDnd(tabId: number, index: number) {
  return useDragAndDrop({ kind: 'tab', tabId }, { type: 'tab', tabId, index });
}

/** A section's empty space accepts drops, appending to the section. */
export function useSectionDrop(section: Section) {
  const target = useDroppable({ id: `section:${section}`, data: { type: 'section', section } satisfies DropData });
  const { drop, source } = useContext(DndState);
  const indicator = drop?.indicator;
  return {
    ref: target.setNodeRef,
    isTarget: !!indicator && 'section' in indicator && indicator.section === section,
    isDragging: source !== undefined,
  };
}
