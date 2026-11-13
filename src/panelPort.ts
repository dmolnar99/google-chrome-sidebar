/**
 * Open side panels keep a port to the background worker, so it knows which windows have the
 * sidebar open (to toggle it) and can ask a panel to close itself.
 */
export const PANEL_PORT_PREFIX = 'sidepanel:';
export type PanelMessage = { type: 'close' };

/** Called from the panel. Reconnects when the worker restarts and drops the port. */
export function connectPanel(windowId: number) {
  const connect = () => {
    const port = browser.runtime.connect({ name: `${PANEL_PORT_PREFIX}${windowId}` });
    port.onMessage.addListener((message: PanelMessage) => {
      if (message.type === 'close') window.close();
    });
    port.onDisconnect.addListener(() => setTimeout(connect, 100));
  };
  connect();
}

/** Called from the worker. Tracks open panels per window. */
export function trackPanels() {
  const panels = new Map<number, Browser.runtime.Port>();
  browser.runtime.onConnect.addListener((port) => {
    if (!port.name.startsWith(PANEL_PORT_PREFIX)) return;
    const windowId = Number(port.name.slice(PANEL_PORT_PREFIX.length));
    panels.set(windowId, port);
    port.onDisconnect.addListener(() => {
      if (panels.get(windowId) === port) panels.delete(windowId);
    });
  });
  return {
    /** Must run synchronously inside the user gesture (e.g. a command), or Chrome refuses to open the panel. */
    toggle(windowId: number) {
      const port = panels.get(windowId);
      if (port) port.postMessage({ type: 'close' } satisfies PanelMessage);
      else browser.sidePanel.open({ windowId }).catch(console.error);
    },
  };
}
