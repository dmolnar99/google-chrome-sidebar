import { addNode, moveNode, removeNode, updateNode } from './tree';
import type { ContainerId, NodeId, SidebarNode, SidebarState } from './types';

/** A change to the saved sidebar, sent to the background worker, which applies them one at a time. */
export type SidebarOp =
  | { type: 'replace'; state: SidebarState }
  | { type: 'add'; node: SidebarNode; container: ContainerId; index?: number }
  | { type: 'move'; id: NodeId; container: ContainerId; index?: number }
  | { type: 'remove'; id: NodeId }
  | { type: 'update'; id: NodeId; patch: Parameters<typeof updateNode>[2] };

export function applyOp(state: SidebarState, op: SidebarOp): SidebarState {
  switch (op.type) {
    case 'replace':
      return op.state;
    case 'add':
      return addNode(state, op.node, op.container, op.index);
    case 'move':
      return moveNode(state, op.id, op.container, op.index);
    case 'remove':
      return removeNode(state, op.id);
    case 'update':
      return updateNode(state, op.id, op.patch);
  }
}
