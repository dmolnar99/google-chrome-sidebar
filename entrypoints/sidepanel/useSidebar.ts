import { useEffect, useState } from 'react';
import { sidebarStore } from '@/src/model/store';
import type { SidebarState } from '@/src/model/types';

/** The saved sidebar, kept live across windows via storage change events. */
export function useSidebar(): SidebarState | undefined {
  const [state, setState] = useState<SidebarState>();
  useEffect(() => {
    sidebarStore.getValue().then(setState);
    return sidebarStore.watch(setState);
  }, []);
  return state;
}
