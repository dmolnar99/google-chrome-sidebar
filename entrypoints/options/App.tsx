import { useState } from 'react';
import { parseArcSidebar, type ArcImportResult } from '@/src/import/arc';
import { sidebarStore } from '@/src/model/store';

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
      {plural(favorites, 'Favorite')}, {plural(items, 'pinned item')} and {plural(folders, 'folder')}.
      {skippedText && <span className="muted"> Not supported, left out: {skippedText}.</span>}
    </p>
  );
}

export function App() {
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
    await sidebarStore.setValue(result.state);
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
          <button className="button primary" onClick={() => confirmImport(status.result)}>
            Import
          </button>
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
    </main>
  );
}
