import { useState } from 'react';

export type DialogRequest =
  | { kind: 'input'; title: string; value: string; onSubmit: (value: string) => void }
  | { kind: 'confirm'; title: string; message: string; confirmLabel: string; onConfirm: () => void };

/** A small in-panel dialog, used instead of window.prompt/confirm. */
export function Dialog({ request, onClose }: { request: DialogRequest; onClose: () => void }) {
  const [value, setValue] = useState(request.kind === 'input' ? request.value : '');
  const submit = () => {
    onClose();
    if (request.kind === 'input') {
      if (value.trim()) request.onSubmit(value.trim());
    } else {
      request.onConfirm();
    }
  };
  return (
    <div className="backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <form
        className="dialog"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
      >
        <strong>{request.title}</strong>
        {request.kind === 'input' ? (
          <input autoFocus value={value} onChange={(e) => setValue(e.target.value)} onFocus={(e) => e.target.select()} />
        ) : (
          <p>{request.message}</p>
        )}
        <div className="actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={request.kind === 'confirm' ? 'primary danger' : 'primary'} autoFocus={request.kind === 'confirm'}>
            {request.kind === 'confirm' ? request.confirmLabel : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
}
