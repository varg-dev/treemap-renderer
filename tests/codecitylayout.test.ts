import { describe, expect, it } from 'vitest';

import { Layout } from '../source/layout';
import { Node } from '../source/node';
import { Rect } from '../source/rect';
import { Topology } from '../source/topology';
import { collectChildren, createLayoutScratch, createMinimalLayoutConfiguration, createStarTopology } from './helpers';

function separation(first: Rect, second: Rect): number {
    if (first.right <= second.left) {
        return second.left - first.right;
    }

    if (second.right <= first.left) {
        return first.left - second.right;
    }

    if (first.top <= second.bottom) {
        return second.bottom - first.top;
    }

    if (second.top <= first.bottom) {
        return first.bottom - second.top;
    }

    return 0.0;
}

function createNestedTopology(): Topology {
    const tree = new Topology();
    tree.initialize(Topology.InputFormat.Interleaved, Topology.InputSemantics.ParentIdId,
        [0, 1, 1, 2, 0, 3]);

    return tree;
}

describe('CodeCityLayout', () => {
    it('reserves accessory space for inner node labels', () => {
        const tree = createStarTopology(2);
        const weights = new Float32Array([2, 1, 1]);
        const layoutConfig = createMinimalLayoutConfiguration(Layout.LayoutAlgorithm.CodeCity);
        layoutConfig.accessoryPadding = {
            type: 'absolute',
            direction: 'bottom',
            value: 0.1,
            relativeAreaThreshold: 0.0,
        };
        const scratch = createLayoutScratch(tree);

        const layout = Layout.createLayout(
            tree,
            weights,
            layoutConfig,
            scratch.accessorySpace,
            scratch.labelRects,
            scratch.labelPaddingSpaces
        );

        const rootAccessorySpace = scratch.accessorySpace[tree.root.index];
        expect(rootAccessorySpace).toBeDefined();
        expect(rootAccessorySpace.area).toBeGreaterThan(0);
        expect(layout[tree.root.index].comprises(rootAccessorySpace)).toBe(true);

        tree.childrenDo(tree.root, (child: Node) => {
            expect(layout[child.index].intersects(rootAccessorySpace)).toBe(false);
        });
    });

    it('fits relative accessory space around packed children', () => {
        const tree = createStarTopology(2);
        const weights = new Float32Array([2, 1, 1]);
        const layoutConfig = createMinimalLayoutConfiguration(Layout.LayoutAlgorithm.CodeCity);
        layoutConfig.accessoryPadding = {
            type: 'relative',
            direction: 'bottom',
            value: 0.1,
            relativeAreaThreshold: 0.0,
        };
        const scratch = createLayoutScratch(tree);

        const layout = Layout.createLayout(
            tree,
            weights,
            layoutConfig,
            scratch.accessorySpace,
            scratch.labelRects,
            scratch.labelPaddingSpaces
        );

        const rootAccessorySpace = scratch.accessorySpace[tree.root.index];
        expect(rootAccessorySpace).toBeDefined();
        expect(rootAccessorySpace.area).toBeGreaterThan(0);
        expect(layout[tree.root.index].comprises(rootAccessorySpace)).toBe(true);

        tree.childrenDo(tree.root, (child: Node) => {
            expect(layout[child.index].intersects(rootAccessorySpace)).toBe(false);
        });
    });

    it('keeps child layouts inside parent padding', () => {
        const tree = createStarTopology(2);
        const weights = new Float32Array([2, 1, 1]);
        const layoutConfig = createMinimalLayoutConfiguration(Layout.LayoutAlgorithm.CodeCity);
        layoutConfig.parentPadding = {
            type: 'absolute',
            value: 0.1,
        };
        const scratch = createLayoutScratch(tree);

        const layout = Layout.createLayout(
            tree,
            weights,
            layoutConfig,
            scratch.accessorySpace,
            scratch.labelRects,
            scratch.labelPaddingSpaces
        );

        const rootLayout = layout[tree.root.index];

        tree.childrenDo(tree.root, (child: Node) => {
            const childLayout = layout[child.index];
            expect(rootLayout.comprises(childLayout)).toBe(true);
            expect(childLayout.left).toBeGreaterThan(rootLayout.left);
            expect(childLayout.right).toBeLessThan(rootLayout.right);
            expect(childLayout.bottom).toBeGreaterThan(rootLayout.bottom);
            expect(childLayout.top).toBeLessThan(rootLayout.top);
        });
    });

    it('keeps sibling margin between packed children', () => {
        const tree = createStarTopology(2);
        const weights = new Float32Array([2, 1, 1]);
        const layoutConfig = createMinimalLayoutConfiguration(Layout.LayoutAlgorithm.CodeCity);
        layoutConfig.siblingMargin = {
            type: 'absolute',
            value: 0.1,
        };
        const scratch = createLayoutScratch(tree);

        const layout = Layout.createLayout(
            tree,
            weights,
            layoutConfig,
            scratch.accessorySpace,
            scratch.labelRects,
            scratch.labelPaddingSpaces
        );
        const children = collectChildren(tree, tree.root);
        const first = layout[children[0].index];
        const second = layout[children[1].index];

        expect(first.intersects(second)).toBe(false);
        expect(separation(first, second)).toBeGreaterThan(0.0);
    });

    it('globalizes nested local layouts after bottom-up packing', () => {
        const tree = createNestedTopology();
        const weights = new Float32Array(tree.numberOfNodes);
        tree.nodesDo((node: Node) => {
            weights[node.index] = node.isRoot ? 2 : 1;
        });
        const layoutConfig = createMinimalLayoutConfiguration(Layout.LayoutAlgorithm.CodeCity);
        layoutConfig.parentPadding = {
            type: 'absolute',
            value: 0.1,
        };
        layoutConfig.accessoryPadding = {
            type: 'absolute',
            direction: 'bottom',
            value: 0.05,
            relativeAreaThreshold: 0.0,
        };
        const scratch = createLayoutScratch(tree);

        const layout = Layout.createLayout(
            tree,
            weights,
            layoutConfig,
            scratch.accessorySpace,
            scratch.labelRects,
            scratch.labelPaddingSpaces
        );

        tree.forEachInnerNode((parent: Node) => {
            tree.childrenDo(parent, (child: Node) => {
                expect(layout[parent.index].comprises(layout[child.index])).toBe(true);
                expect(layout[child.index].intersects(scratch.accessorySpace[parent.index]))
                    .toBe(false);
            });
        });
    });
});
