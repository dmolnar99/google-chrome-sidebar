import { useEffect, useState } from 'react';
import { parseArcSidebar, type ArcImportResult } from '@/src/import/arc';
import { send } from '@/src/messages';
import { sidebarStore } from '@/src/model/store';
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

  async function onFile(file: File | undefined) {
    if (!file) return;
    try {
      const result = parseArcSidebar(JSON.parse(await file.text()));
      setStatus({ step: 'preview', fileName: file.name, result });
    } catch (e) {
      setStatus({ step: 'error', message: e instanceof Error ? e.message : String(e) });
    }
  }

  async function confirmImport(result: ArcImportResult) {
    const current = await sidebarStore.getValue();
    const hasData = current.favorites.length > 0 || current.pinned.length > 0;
    if (hasData && !confirm('This replaces everything currently in your sidebar. Continue?')) return;
    await send({ type: 'sidebar', op: { type: 'replace', state: result.state } });
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

      <label className="button">
        Choose file…
        <input
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            onFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </label>

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
      <Appearance />
    </main>
  );
}
