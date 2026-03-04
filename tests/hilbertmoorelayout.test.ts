import { describe, expect, it } from 'vitest';

import { HilbertLayout, MooreLayout } from '../source/hilbertmoorelayout';
import { Rect } from '../source/rect';
import { createStarTopology, noOpLayoutCallbacks } from './helpers';

describe('HilbertLayout/MooreLayout', () => {
    it('computes hilbert layout for one level', () => {
        const tree = createStarTopology(4);
        const weights = new Float32Array([4, 1, 1, 1, 1]);
        const result = new Array<Rect>(tree.numberOfNodes);

        HilbertLayout.compute(
            tree,
            weights,
            1.0,
            result,
            noOpLayoutCallbacks,
            new Array(tree.numberOfNodes),
            new Array(tree.numberOfNodes),
            new Array(tree.numberOfNodes)
        );

        expect(result[1].area).toBeGreaterThan(0);
    });

    it('computes moore layout for one level', () => {
        const tree = createStarTopology(4);
        const weights = new Float32Array([4, 1, 1, 1, 1]);
        const result = new Array<Rect>(tree.numberOfNodes);

        MooreLayout.compute(
            tree,
            weights,
            1.0,
            result,
            noOpLayoutCallbacks,
            new Array(tree.numberOfNodes),
            new Array(tree.numberOfNodes),
            new Array(tree.numberOfNodes)
        );

        expect(result[1].area).toBeGreaterThan(0);
    });
});
