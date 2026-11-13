import { useEffect, useRef } from 'react';

export interface MenuEntry {
  label: string;
  onSelect: () => void;
  danger?: boolean;
}

/** A right-click menu at the pointer position. Closes on outside click, Escape or blur. */
export function Menu({ x, y, entries, onClose }: { x: number; y: number; entries: MenuEntry[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== 'Escape') return;
      if (e.type === 'pointerdown' && ref.current?.contains(e.target as Node)) return;
      onClose();
    };
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', close);
    window.addEventListener('blur', close);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', close);
      window.removeEventListener('blur', close);
    };
  }, [onClose]);

  // Keep the menu inside the panel.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { innerWidth, innerHeight } = window;
    el.style.left = `${Math.min(x, innerWidth - el.offsetWidth - 4)}px`;
    el.style.top = `${Math.min(y, innerHeight - el.offsetHeight - 4)}px`;
  }, [x, y]);

  return (
    <div ref={ref} className="menu" role="menu" style={{ left: x, top: y }}>
      {entries.map((entry) => (
        <button
          key={entry.label}
          role="menuitem"
          className={entry.danger ? 'danger' : undefined}
          onClick={() => {
            onClose();
            entry.onSelect();
          }}
        >
          {entry.label}
        </button>
      ))}
    </div>
  );
}
