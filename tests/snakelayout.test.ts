import { describe, expect, it } from 'vitest';

import { Rect } from '../source/rect';
import { SnakeLayout } from '../source/snakelayout';
import { createLayoutScratch, createStarTopology, noOpLayoutCallbacks } from './helpers';

describe('SnakeLayout', () => {
    it('computes child rectangles', () => {
        const tree = createStarTopology(3);
        const weights = new Float32Array([3, 1, 1, 1]);
        const result = new Array<Rect>(tree.numberOfNodes);
        const scratch = createLayoutScratch(tree);

        SnakeLayout.compute(
            tree,
            weights,
            1.0,
            result,
            noOpLayoutCallbacks,
            scratch.accessorySpace,
            scratch.labelRects,
            scratch.labelPaddingSpaces
        );

        expect(result[1].area).toBeGreaterThan(0);
        expect(result[2].area).toBeGreaterThan(0);
        expect(result[3].area).toBeGreaterThan(0);
    });
});
