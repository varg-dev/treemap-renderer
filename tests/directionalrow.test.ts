import { describe, expect, it } from 'vitest';

import { DirectionalRow } from '../source/directionalrow';
import { Rect } from '../source/rect';
import { collectChildren, createStarTopology } from './helpers';

describe('DirectionalRow', () => {
    it('lays out nodes and flips reverse state on next()', () => {
        const tree = createStarTopology(2);
        const weights = new Float32Array([2, 1, 1]);
        const row = new DirectionalRow(tree, weights, new Rect(0, 0, 1, 1), 2, true, false, false);
        const children = collectChildren(tree, tree.root);

        row.insert(children[0], 1);
        row.insert(children[1], 1);

        const layout = new Array<Rect>(tree.numberOfNodes);
        row.layoutNodes(layout);

        expect(layout[children[0].index].area).toBeGreaterThan(0);
        expect(row.reverse).toBe(false);

        row.next(false);
        expect(row.reverse).toBe(true);
    });
});
