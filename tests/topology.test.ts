import { describe, expect, it } from 'vitest';

import { Topology } from '../source/topology';
import { collectChildren, createStarTopology } from './helpers';

describe('Topology', () => {
    it('initializes star topology and provides traversal helpers', () => {
        const tree = createStarTopology(3);

        expect(tree.numberOfNodes).toBe(4);
        expect(tree.numberOfInnerNodes).toBe(1);
        expect(tree.numberOfLeafNodes).toBe(3);

        const children = collectChildren(tree, tree.root);
        expect(children.length).toBe(3);

        const layoutRange = tree.childrenAsLayoutRange(tree.root);
        expect(layoutRange.last - layoutRange.first).toBe(3);
    });
});
