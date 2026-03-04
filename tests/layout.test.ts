import { describe, expect, it } from 'vitest';

import { Layout } from '../source/layout';
import { createStarTopology } from './helpers';

describe('Layout', () => {
    it('creates a strip layout using static dispatcher', () => {
        const tree = createStarTopology(3);
        const weights = new Float32Array([3, 1, 1, 1]);
        const layout = Layout.createLayout(
            tree,
            weights,
            { algorithm: Layout.LayoutAlgorithm.Strip, aspectRatio: 1.0 } as any,
            new Array(tree.numberOfNodes),
            new Array(tree.numberOfNodes),
            new Array(tree.numberOfNodes)
        );

        expect(layout.length).toBe(tree.numberOfNodes);
        expect(layout[0]).toBeDefined();
    });
});
