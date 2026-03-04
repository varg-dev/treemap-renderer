import { describe, expect, it } from 'vitest';

import { Rect } from '../source/rect';
import { Row } from '../source/row';
import { collectChildren, createStarTopology } from './helpers';

describe('Row', () => {
    it('lays out inserted nodes in a row', () => {
        const tree = createStarTopology(2);
        const weights = new Float32Array([2, 1, 1]);
        const row = new Row(tree, weights, new Rect(0, 0, 1, 1), weights[0], true);
        const children = collectChildren(tree, tree.root);

        row.insert(children[0], weights[children[0].index]);
        row.insert(children[1], weights[children[1].index]);

        const layout = new Array<Rect>(tree.numberOfNodes);
        row.layoutNodes(layout);

        expect(layout[children[0].index].area).toBeGreaterThan(0);
        expect(layout[children[1].index].area).toBeGreaterThan(0);
    });
});
