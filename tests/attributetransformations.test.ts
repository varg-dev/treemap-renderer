import { describe, expect, it } from 'vitest';

import { AttributeTransformations } from '../source/attributetransformations';
import { createStarTopology } from './helpers';

describe('AttributeTransformations', () => {
    it('renormalizes source buffers by index map', () => {
        const source = [10, 20, 30];
        const normalization = [2, 0, 1];
        const result = AttributeTransformations.renormalize(source, normalization);

        expect(Array.from(result)).toEqual([20, 30, 10]);
    });

    it('applies threshold across all nodes', () => {
        const tree = createStarTopology(2);
        const target = new Float32Array([0.5, 1.0, 2.0]);

        AttributeTransformations.applyThreshold(tree, target, { type: 'threshold', value: 1.0 });

        expect(Array.from(target)).toEqual([0, 1, 1]);
    });
});
