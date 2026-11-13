import type { ContainerId, NodeId } from './model/types';
import type { SidebarOp } from './model/ops';

/** Requests from extension pages to the background worker. */
export type Command =
  | { type: 'sidebar'; op: SidebarOp }
  /** Focus the item's tab in this window, or open its saved URL. */
  | { type: 'activate'; itemId: NodeId; windowId: number }
  /** Close the item's tab in this window; the item stays. */
  | { type: 'closeTab'; itemId: NodeId; windowId: number }
  /** Send the item's tab back to the saved URL. */
  | { type: 'reset'; itemId: NodeId; windowId: number }
  /** Save a tab as a new item and link it. */
  | { type: 'saveTab'; tabId: number; container: ContainerId; index?: number };

type Response = { ok: true } | { ok: false; error: string };

export async function send(command: Command): Promise<void> {
  const response: Response | undefined = await browser.runtime.sendMessage(command);
  if (!response?.ok) throw new Error(response?.error ?? 'No response from background');
}

/** Wires a handler to runtime messages, reporting errors back to the sender. */
export function onCommand(handler: (command: Command) => Promise<void>) {
  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    handler(message as Command).then(
      () => sendResponse({ ok: true } satisfies Response),
      (e: unknown) => sendResponse({ ok: false, error: e instanceof Error ? e.message : String(e) } satisfies Response),
    );
    return true; // keeps the channel open for the async response
  });
}
