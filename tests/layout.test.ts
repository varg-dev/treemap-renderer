import { describe, expect, it } from 'vitest';

import { Configuration } from '../source/configuration';
import { Layout } from '../source/layout';
import { createLayoutScratch, createMinimalLayoutConfiguration, createStarTopology } from './helpers';

describe('Layout', () => {
    it('creates a strip layout using static dispatcher', () => {
        const tree = createStarTopology(3);
        const weights = new Float32Array([3, 1, 1, 1]);
        const layoutConfig: Configuration.Layout = createMinimalLayoutConfiguration(
            Layout.LayoutAlgorithm.Strip
        );
        const scratch = createLayoutScratch(tree);

        const layout = Layout.createLayout(
            tree,
            weights,
            layoutConfig,
            scratch.accessorySpace,
            scratch.labelRects,
            scratch.labelPaddingSpaces
        );

        expect(layout).toHaveLength(tree.numberOfNodes);
        expect(layout[0]).toBeDefined();
    });
});
