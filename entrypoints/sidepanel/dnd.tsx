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
import { resolveMove, targetForRow, zoneAt, type Zone } from '@/src/model/drop';
import { childList } from '@/src/model/tree';
import type { ContainerId, NodeId, SidebarState } from '@/src/model/types';

type Section = 'favorites' | 'pinned';
type DropData = { type: 'node'; id: NodeId; layout: 'list' | 'grid' } | { type: 'section'; section: Section };
type Indicator = { id: NodeId; zone: Zone } | { section: Section };
interface Drop {
  move: { container: ContainerId; index: number };
  indicator: Indicator;
}

const DndState = createContext<{ drop?: Drop; activeId?: NodeId }>({});

/** Rows and tiles win over the section they sit in; sections catch drops on empty space. */
const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  const specific = hits.filter((h) => !String(h.id).startsWith('section:'));
  return specific.length ? specific : hits;
};

const HOVER_EXPAND_MS = 600;

export function SidebarDnd(props: {
  state: SidebarState;
  onMove: (id: NodeId, container: ContainerId, index: number) => void;
  onExpand: (folderId: NodeId) => void;
  renderOverlay: (id: NodeId) => ReactNode;
  children: ReactNode;
}) {
  const { state } = props;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const [activeId, setActiveId] = useState<NodeId>();
  const [drop, setDrop] = useState<Drop>();
  const expand = useRef<{ id: NodeId; timer: ReturnType<typeof setTimeout> }>(undefined);

  const stopExpand = () => {
    if (expand.current) clearTimeout(expand.current.timer);
    expand.current = undefined;
  };

  const track = (e: DragMoveEvent) => {
    const data = e.over?.data.current as DropData | undefined;
    let next: Drop | undefined;
    let hoverFolder: NodeId | undefined;
    if (e.over && data) {
      const start = e.activatorEvent as PointerEvent;
      const x = start.clientX + e.delta.x;
      const y = start.clientY + e.delta.y;
      let target: { container: ContainerId; index: number } | undefined;
      let indicator: Indicator;
      if (data.type === 'section') {
        target = { container: data.section, index: childList(state, data.section).length };
        indicator = { section: data.section };
      } else {
        const node = state.nodes[data.id];
        const rect = e.over.rect;
        const isFolder = node?.kind === 'folder';
        const zone: Zone =
          data.layout === 'grid'
            ? x - rect.left < rect.width / 2
              ? 'before'
              : 'after'
            : zoneAt((y - rect.top) / rect.height, isFolder);
        target = targetForRow(state, data.id, zone, { expanded: isFolder && !node.collapsed });
        indicator = { id: data.id, zone };
        if (isFolder && node.collapsed && zone === 'inside') hoverFolder = node.id;
      }
      const move = target && resolveMove(state, String(e.active.id), target);
      if (move) next = { move, indicator };
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
    setActiveId(undefined);
    setDrop(undefined);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      onDragStart={(e) => setActiveId(String(e.active.id))}
      onDragMove={track}
      onDragEnd={(e) => {
        if (drop) props.onMove(String(e.active.id), drop.move.container, drop.move.index);
        reset();
      }}
      onDragCancel={reset}
    >
      <DndState.Provider value={{ drop, activeId }}>{props.children}</DndState.Provider>
      <DragOverlay dropAnimation={null}>{activeId && props.renderOverlay(activeId)}</DragOverlay>
    </DndContext>
  );
}

/** Makes a row (list) or tile (grid) draggable and a drop target. */
export function useNodeDnd(id: NodeId, layout: 'list' | 'grid') {
  const drag = useDraggable({ id });
  const target = useDroppable({ id: `${layout}:${id}`, data: { type: 'node', id, layout } satisfies DropData });
  const { drop } = useContext(DndState);
  const indicator = drop?.indicator;
  return {
    ref: (el: HTMLElement | null) => {
      drag.setNodeRef(el);
      target.setNodeRef(el);
    },
    handlers: drag.listeners,
    isDragging: drag.isDragging,
    dropZone: indicator && 'id' in indicator && indicator.id === id ? indicator.zone : undefined,
  };
}

/** A section's empty space accepts drops, appending to the section. */
export function useSectionDrop(section: Section) {
  const target = useDroppable({ id: `section:${section}`, data: { type: 'section', section } satisfies DropData });
  const { drop, activeId } = useContext(DndState);
  const indicator = drop?.indicator;
  return {
    ref: target.setNodeRef,
    isTarget: !!indicator && 'section' in indicator && indicator.section === section,
    isDragging: activeId !== undefined,
  };
}
