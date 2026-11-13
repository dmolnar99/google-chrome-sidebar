import { describe, expect, it } from 'vitest';
import { applyOp } from './ops';
import { emptyState } from './tree';

describe('applyOp', () => {
  it('applies each kind of change', () => {
    let s = emptyState();
    s = applyOp(s, { type: 'add', node: { kind: 'item', id: 'a', title: 'A', url: 'https://a.test/' }, container: 'pinned' });
    s = applyOp(s, { type: 'update', id: 'a', patch: { title: 'Renamed' } });
    s = applyOp(s, { type: 'move', id: 'a', container: 'favorites' });
    expect(s.favorites).toEqual(['a']);
    expect(s.nodes.a).toMatchObject({ title: 'Renamed' });
    s = applyOp(s, { type: 'remove', id: 'a' });
    expect(s).toEqual(emptyState());
    const replacement = { ...emptyState(), pinned: [] };
    expect(applyOp(s, { type: 'replace', state: replacement })).toBe(replacement);
  });
});
