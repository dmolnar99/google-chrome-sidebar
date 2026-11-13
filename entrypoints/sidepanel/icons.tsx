/** Small line icons, 16px, drawn in the current text color. */
const base = { width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

export function FolderIcon({ open }: { open: boolean }) {
  return open ? (
    <svg {...base} className="glyph" aria-hidden>
      <path d="M1.75 12.5V4a1.25 1.25 0 0 1 1.25-1.25h3.1l1.4 1.5h4.5A1.25 1.25 0 0 1 13.25 5.5V7" />
      <path d="M1.75 12.5 3.6 7.9A1.25 1.25 0 0 1 4.76 7.1h9.06a.75.75 0 0 1 .7 1.03l-1.62 4.1a1.25 1.25 0 0 1-1.16.77H3a1.25 1.25 0 0 1-1.25-.5Z" fill="var(--folder-fill)" />
    </svg>
  ) : (
    <svg {...base} className="glyph" aria-hidden>
      <path d="M1.75 4a1.25 1.25 0 0 1 1.25-1.25h3.1l1.4 1.5h5.5A1.25 1.25 0 0 1 14.25 5.5v6.25A1.25 1.25 0 0 1 13 13H3a1.25 1.25 0 0 1-1.25-1.25Z" fill="var(--folder-fill)" />
      <path d="M1.75 6.25h12.5" />
    </svg>
  );
}

export function PlusIcon() {
  return (
    <svg {...base} className="glyph" aria-hidden>
      <path d="M8 3v10M3 8h10" />
    </svg>
  );
}

export function CloseIcon() {
  return (
    <svg {...base} width={12} height={12} aria-hidden>
      <path d="M4 4l8 8M12 4l-8 8" strokeWidth={1.6} />
    </svg>
  );
}

export function ResetIcon() {
  return (
    <svg {...base} width={13} height={13} aria-hidden>
      <path d="M3 8a5 5 0 1 0 1.6-3.65" />
      <path d="M3 2.5v3h3" />
    </svg>
  );
}
