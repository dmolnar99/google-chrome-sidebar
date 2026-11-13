export type NodeId = string;

/** A saved URL. Exists whether or not it has a live tab. */
export interface Item {
  kind: 'item';
  id: NodeId;
  title: string;
  url: string;
}

export interface Folder {
  kind: 'folder';
  id: NodeId;
  title: string;
  childIds: NodeId[];
  collapsed: boolean;
}

export type SidebarNode = Item | Folder;

/** Where a node lives: one of the two top-level sections, or inside a folder. */
export type ContainerId = 'favorites' | 'pinned' | NodeId;

export interface SidebarState {
  version: 1;
  nodes: Record<NodeId, SidebarNode>;
  /** Items only; Favorites can't hold folders. */
  favorites: NodeId[];
  pinned: NodeId[];
}
