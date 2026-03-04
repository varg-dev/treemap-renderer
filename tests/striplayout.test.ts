import { describe, expect, it } from 'vitest';

import { Rect } from '../source/rect';
import { StripLayout } from '../source/striplayout';
import { createStarTopology, noOpLayoutCallbacks } from './helpers';

describe('StripLayout', () => {
    it('computes child rectangles', () => {
        const tree = createStarTopology(3);
        const weights = new Float32Array([3, 1, 1, 1]);
        const result = new Array<Rect>(tree.numberOfNodes);

        StripLayout.compute(
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
        expect(result[2].area).toBeGreaterThan(0);
        expect(result[3].area).toBeGreaterThan(0);
    });
});
