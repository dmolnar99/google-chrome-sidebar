import { useEffect, useState } from 'react';
import type { Links } from '@/src/links/links';
import { linksStore } from '@/src/links/store';
import { sidebarStore } from '@/src/model/store';
import { connectPanel } from '@/src/panelPort';
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

/** Item–tab links, as maintained by the background worker. */
export function useLinks(): Links {
  const [links, setLinks] = useState<Links>({});
  useEffect(() => {
    linksStore.getValue().then((l) => setLinks(l ?? {}));
    return linksStore.watch((l) => setLinks(l ?? {}));
  }, []);
  return links;
}

export interface WindowTabs {
  windowId: number;
  tabs: Map<number, Browser.tabs.Tab>;
}

/** The tabs of the window this panel belongs to, refreshed on any tab event. */
export function useWindowTabs(): WindowTabs | undefined {
  const [value, setValue] = useState<WindowTabs>();
  useEffect(() => {
    let cancelled = false;
    let windowId: number | undefined;
    let pending = 0;
    const refresh = () => {
      cancelAnimationFrame(pending);
      pending = requestAnimationFrame(async () => {
        if (windowId === undefined) {
          windowId = (await browser.windows.getCurrent()).id;
          if (windowId !== undefined) connectPanel(windowId);
        }
        if (windowId === undefined || cancelled) return;
        const tabs = await browser.tabs.query({ windowId });
        if (!cancelled) setValue({ windowId, tabs: new Map(tabs.flatMap((t) => (t.id === undefined ? [] : [[t.id, t]]))) });
      });
    };
    const events = [
      browser.tabs.onCreated,
      browser.tabs.onUpdated,
      browser.tabs.onRemoved,
      browser.tabs.onActivated,
      browser.tabs.onAttached,
      browser.tabs.onDetached,
      browser.tabs.onMoved,
      browser.tabs.onReplaced,
    ] as { addListener(fn: () => void): void; removeListener(fn: () => void): void }[];
    events.forEach((e) => e.addListener(refresh));
    refresh();
    return () => {
      cancelled = true;
      cancelAnimationFrame(pending);
      events.forEach((e) => e.removeListener(refresh));
    };
  }, []);
  return value;
}
