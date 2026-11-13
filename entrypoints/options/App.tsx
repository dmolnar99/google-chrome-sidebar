import { useEffect, useState } from 'react';
import { backupFileName, countSidebar, createBackup, parseBackup, type SidebarCounts } from '@/src/backup/backup';
import { parseArcSidebar, type ArcImportResult } from '@/src/import/arc';
import { send } from '@/src/messages';
import { sidebarStore } from '@/src/model/store';
import type { SidebarState } from '@/src/model/types';
import { themeColorStore, useThemeColor } from '@/src/ui/themeStore';

const ARC_PATH = '~/Library/Application Support/Arc/StorableSidebar.json';

type Status =
  | { step: 'idle' }
  | { step: 'preview'; fileName: string; result: ArcImportResult }
  | { step: 'done'; result: ArcImportResult }
  | { step: 'error'; message: string };

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function Summary({ result }: { result: ArcImportResult }) {
  const { favorites, items, folders, skipped } = result.report;
  const skippedText = Object.entries(skipped)
    .map(([kind, n]) => `${n} × ${kind}`)
    .join(', ');
  return (
    <p>
      {plural(favorites, 'Favorite')}, {plural(items, 'pinned item')} and {plural(folders, 'folder')}
      {result.themeColor && (
        <>
          , plus your Space's color <span className="swatch" style={{ background: result.themeColor }} />
        </>
      )}
      .
      {skippedText && <span className="muted"> Not supported, left out: {skippedText}.</span>}
    </p>
  );
}

function describe({ favorites, items, folders }: SidebarCounts) {
  return `${plural(favorites, 'Favorite')}, ${plural(items, 'pinned item')} and ${plural(folders, 'folder')}`;
}

/** Replaces the sidebar, asking first if there's something to lose. */
async function replaceSidebar(state: SidebarState): Promise<boolean> {
  const current = await sidebarStore.getValue();
  const hasData = current.favorites.length > 0 || current.pinned.length > 0;
  if (hasData && !confirm('This replaces everything currently in your sidebar. Export a backup first if you might want it back. Continue?')) {
    return false;
  }
  await send({ type: 'sidebar', op: { type: 'replace', state } });
  return true;
}

function FileButton({ label, onFile }: { label: string; onFile: (file: File) => void }) {
  return (
    <label className="button">
      {label}
      <input
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = '';
        }}
      />
    </label>
  );
}

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

type BackupStatus =
  | { step: 'idle' }
  | { step: 'preview'; fileName: string; backup: ReturnType<typeof parseBackup> }
  | { step: 'done'; message: string }
  | { step: 'error'; message: string };

function BackupSection() {
  const [status, setStatus] = useState<BackupStatus>({ step: 'idle' });

  async function exportBackup() {
    const backup = createBackup(await sidebarStore.getValue(), await themeColorStore.getValue());
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: backupFileName() });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus({ step: 'done', message: `Exported ${describe(countSidebar(backup.sidebar))}.` });
  }

  async function onFile(file: File) {
    try {
      setStatus({ step: 'preview', fileName: file.name, backup: parseBackup(JSON.parse(await file.text())) });
    } catch (e) {
      setStatus({ step: 'error', message: errorMessage(e) });
    }
  }

  async function restore(backup: ReturnType<typeof parseBackup>) {
    if (!(await replaceSidebar(backup.sidebar))) return;
    await themeColorStore.setValue(backup.themeColor);
    setStatus({ step: 'done', message: `Restored ${describe(countSidebar(backup.sidebar))}.` });
  }

  return (
    <>
      <h1>Backup</h1>
      <p className="muted">
        Your sidebar lives only in this Chrome profile. Export it to a file now and then, and restore it here if anything
        goes wrong or you set up another computer.
      </p>
      <div className="row">
        <button className="button" onClick={exportBackup}>
          Export…
        </button>
        <FileButton label="Restore from file…" onFile={onFile} />
      </div>
      {status.step === 'preview' && (
        <section className="card">
          <p>
            <strong>{status.fileName}</strong>
            {status.backup.exportedAt && <span className="muted"> · exported {new Date(status.backup.exportedAt).toLocaleString()}</span>}
          </p>
          <p>
            {describe(countSidebar(status.backup.sidebar))}
            {status.backup.themeColor && (
              <>
                , color <span className="swatch" style={{ background: status.backup.themeColor }} />
              </>
            )}
            .
          </p>
          <button className="button primary" onClick={() => restore(status.backup)}>
            Restore
          </button>
        </section>
      )}
      {status.step === 'done' && (
        <section className="card">
          <p>{status.message}</p>
        </section>
      )}
      {status.step === 'error' && (
        <section className="card error">
          <p>
            <strong>Couldn't restore that file.</strong> {status.message}
          </p>
        </section>
      )}
    </>
  );
}

function Appearance() {
  const [color, setColor] = useState<string | null>(null);
  useEffect(() => {
    themeColorStore.getValue().then(setColor);
    return themeColorStore.watch(setColor);
  }, []);
  return (
    <>
      <h1>Appearance</h1>
      <p className="muted">The sidebar is tinted with this color, like an Arc Space.</p>
      <div className="row">
        <label className="button">
          <span className="swatch" style={{ background: color ?? 'var(--bg)' }} /> {color ? 'Change color…' : 'Choose a color…'}
          <input type="color" className="visually-hidden" value={color ?? '#9ebece'} onChange={(e) => themeColorStore.setValue(e.target.value)} />
        </label>
        {color && (
          <button className="button" onClick={() => themeColorStore.setValue(null)}>
            Use neutral
          </button>
        )}
      </div>
    </>
  );
}

export function App() {
  useThemeColor();
  const [status, setStatus] = useState<Status>({ step: 'idle' });

  async function onFile(file: File) {
    try {
      const result = parseArcSidebar(JSON.parse(await file.text()));
      setStatus({ step: 'preview', fileName: file.name, result });
    } catch (e) {
      setStatus({ step: 'error', message: errorMessage(e) });
    }
  }

  async function confirmImport(result: ArcImportResult) {
    if (!(await replaceSidebar(result.state))) return;
    if (result.themeColor) await themeColorStore.setValue(result.themeColor);
    setStatus({ step: 'done', result });
  }

  return (
    <main>
      <h1>Import from Arc</h1>
      <p>
        Choose Arc's sidebar file. In the file picker, press <kbd>⌘</kbd> <kbd>⇧</kbd> <kbd>G</kbd> and
        paste:
      </p>
      <pre>
        <code>{ARC_PATH}</code>
      </pre>
      <p className="muted">
        Brings over your Favorites and pinned items and folders. Open (Today) tabs are left out. If you
        had several Spaces, each becomes a folder.
      </p>

      <FileButton label="Choose file…" onFile={onFile} />

      {status.step === 'preview' && (
        <section className="card">
          <p>
            <strong>{status.fileName}</strong> contains:
          </p>
          <Summary result={status.result} />
          <div className="row">
            <button className="button primary" onClick={() => confirmImport(status.result)}>
              Import
            </button>
            {status.result.themeColor && (
              <button className="button" onClick={() => themeColorStore.setValue(status.result.themeColor!)}>
                Only use its color
              </button>
            )}
          </div>
        </section>
      )}
      {status.step === 'done' && (
        <section className="card">
          <p>
            <strong>Imported.</strong> Your sidebar now has:
          </p>
          <Summary result={status.result} />
        </section>
      )}
      {status.step === 'error' && (
        <section className="card error">
          <p>
            <strong>Couldn't read that file.</strong> {status.message}
          </p>
        </section>
      )}
      <hr />
      <BackupSection />
      <hr />
      <Appearance />
    </main>
  );
}
