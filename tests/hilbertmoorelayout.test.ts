import { describe, expect, it } from 'vitest';

import { Configuration } from '../source/configuration';
import { HilbertLayout, MooreLayout } from '../source/hilbertmoorelayout';
import { Layout, LayoutCallbacks } from '../source/layout';
import { Node } from '../source/node';
import { Rect } from '../source/rect';
import { Topology } from '../source/topology';
import {
    collectChildren,
    createLayoutScratch,
    createMinimalLayoutConfiguration,
    createStarTopology,
    noOpLayoutCallbacks,
} from './helpers';

type LayoutCompute = typeof HilbertLayout.compute;

interface LayoutUnderTest {
    name: string;
    algorithm: Layout.LayoutAlgorithm;
    compute: LayoutCompute;
}

const layoutsUnderTest: LayoutUnderTest[] = [
    { name: 'Hilbert', algorithm: Layout.LayoutAlgorithm.Hilbert, compute: HilbertLayout.compute },
    { name: 'Moore', algorithm: Layout.LayoutAlgorithm.Moore, compute: MooreLayout.compute },
];

function createMultiLevelTopology(): Topology {
    const edges = [
        0, 1,
        1, 3,
        1, 4,
        0, 2,
        2, 5,
        2, 6,
        2, 7,
    ];

    const tree = new Topology();
    tree.initialize(Topology.InputFormat.Interleaved, Topology.InputSemantics.ParentIdId, edges);
    return tree;
}

function createWeightsByNodeId(tree: Topology, weightsById: Record<number, number>): Float32Array {
    const weights = new Float32Array(tree.numberOfNodes);

    for (const [idString, weight] of Object.entries(weightsById)) {
        const id = Number(idString);
        const node = tree.innerNodeById(id) ?? tree.leafNodeById(id);

        if (node === undefined) {
            throw new Error(`Expected node with id ${id} to exist`);
        }

        weights[node.index] = weight;
    }

    return weights;
}

function runLayout(
    compute: LayoutCompute,
    tree: Topology,
    weights: Configuration.AttributeBuffer,
    callbacks: LayoutCallbacks = noOpLayoutCallbacks
): { result: Rect[]; scratch: { accessorySpace: Rect[]; labelRects: Rect[]; labelPaddingSpaces: number[] } } {
    const result = new Array<Rect>(tree.numberOfNodes);
    const scratch = createLayoutScratch(tree);

    compute(
        tree,
        weights,
        1.0,
        result,
        callbacks,
        scratch.accessorySpace,
        scratch.labelRects,
        scratch.labelPaddingSpaces
    );

    return { result, scratch };
}

function sharesEdge(a: Rect, b: Rect, epsilon = 1e-6): boolean {
    const xOverlap = Math.min(a.right, b.right) - Math.max(a.left, b.left);
    const yOverlap = Math.min(a.top, b.top) - Math.max(a.bottom, b.bottom);
    const touchesVertically = Math.abs(a.right - b.left) <= epsilon || Math.abs(b.right - a.left) <= epsilon;
    const touchesHorizontally = Math.abs(a.top - b.bottom) <= epsilon || Math.abs(b.top - a.bottom) <= epsilon;

    return (touchesVertically && yOverlap > epsilon) || (touchesHorizontally && xOverlap > epsilon);
}

function assertChildrenInsideParentRects(tree: Topology, layout: Rect[]): void {
    tree.forEachInnerNode((parent: Node) => {
        const parentRect = layout[parent.index];
        expect(parentRect).toBeDefined();
        if (parentRect === undefined) {
            return;
        }

        const children = collectChildren(tree, parent);
        expect(children.length).toBeGreaterThan(0);

        for (const child of children) {
            const childRect = layout[child.index];
            expect(childRect).toBeDefined();
            if (childRect === undefined) {
                continue;
            }

            expect(childRect.isValid()).toBe(true);
            expect(childRect.area).toBeGreaterThan(0);
            expect(parentRect.comprises(childRect)).toBe(true);
        }
    });
}

describe.each(layoutsUnderTest)('$name layout', ({ algorithm, compute }) => {
    it('lays out many siblings and preserves containment', () => {
        const tree = createStarTopology(12);
        const weights = new Float32Array([42, 1, 3, 2, 6, 4, 5, 2, 3, 6, 4, 2, 4]);

        const { result } = runLayout(compute, tree, weights);

        const rootRect = result[tree.root.index];
        expect(rootRect).toBeDefined();
        if (rootRect === undefined) {
            return;
        }

        const children = collectChildren(tree, tree.root);
        let childrenArea = 0.0;

        for (const child of children) {
            const childRect = result[child.index];
            expect(childRect).toBeDefined();
            if (childRect === undefined) {
                continue;
            }

            expect(childRect.area).toBeGreaterThan(0);
            expect(rootRect.comprises(childRect)).toBe(true);
            childrenArea += childRect.area;
        }

        expect(childrenArea).toBeCloseTo(rootRect.area, 5);
    });

    it('keeps consecutive siblings edge-adjacent for one-level data', () => {
        const tree = createStarTopology(16);
        const weights = new Float32Array(17);
        weights[0] = 16;
        for (let i = 1; i <= 16; ++i) {
            weights[i] = 1;
        }

        const { result } = runLayout(compute, tree, weights);
        const siblings = collectChildren(tree, tree.root);

        for (let i = 0; i + 1 < siblings.length; ++i) {
            const current = result[siblings[i].index];
            const next = result[siblings[i + 1].index];
            expect(current).toBeDefined();
            expect(next).toBeDefined();
            if (current === undefined || next === undefined) {
                continue;
            }

            expect(sharesEdge(current, next)).toBe(true);
        }
    });

    it('handles strongly skewed weights without invalid rectangles', () => {
        const tree = createStarTopology(10);
        const weights = new Float32Array([1009, 1000, 1, 1, 1, 1, 1, 1, 1, 1, 1]);

        const { result } = runLayout(compute, tree, weights);
        const children = collectChildren(tree, tree.root);

        for (const child of children) {
            const childRect = result[child.index];
            expect(childRect).toBeDefined();
            if (childRect === undefined) {
                continue;
            }

            expect(childRect.isValid()).toBe(true);
            expect(childRect.area).toBeGreaterThan(0);
        }
    });

    it('handles zero-weight data without producing invalid rectangles', () => {
        const tree = createStarTopology(8);
        const weights = new Float32Array(9); // root + 8 children, all zero

        const { result } = runLayout(compute, tree, weights);
        const children = collectChildren(tree, tree.root);

        for (const child of children) {
            const childRect = result[child.index];
            expect(childRect).toBeDefined();
            if (childRect === undefined) {
                continue;
            }

            expect(childRect.isValid()).toBe(true);
            expect(Number.isFinite(childRect.area)).toBe(true);
        }
    });

    it('supports multi-level trees and keeps descendants inside each parent', () => {
        const tree = createMultiLevelTopology();
        const weights = createWeightsByNodeId(tree, {
            0: 12,
            1: 4,
            2: 8,
            3: 3,
            4: 1,
            5: 2,
            6: 2,
            7: 4,
        });

        const { result } = runLayout(compute, tree, weights);
        assertChildrenInsideParentRects(tree, result);
    });

    it('works with non-trivial layout callbacks', () => {
        const tree = createStarTopology(6);
        const weights = new Float32Array([6, 1, 1, 1, 1, 1, 1]);

        const callbacks: LayoutCallbacks = {
            accessoryPaddingCallback: (rect: Rect) => rect.padded(0.02),
            parentPaddingCallback: (rect: Rect) => rect.padded(0.03),
            siblingMarginBeforeCallback: (rect: Rect) => rect.padded(0.01),
            siblingMarginAfterCallback: (rect: Rect) => rect,
        };

        const { result, scratch } = runLayout(compute, tree, weights, callbacks);
        const root = tree.root;
        let expectedContainer = callbacks.accessoryPaddingCallback(
            result[root.index],
            root,
            tree,
            result,
            scratch.accessorySpace
        );
        expectedContainer = callbacks.parentPaddingCallback(
            expectedContainer,
            root,
            tree,
            result,
            scratch.labelRects,
            scratch.labelPaddingSpaces
        );
        expectedContainer = callbacks.siblingMarginBeforeCallback(
            expectedContainer,
            root,
            tree,
            result,
            scratch.labelRects,
            scratch.labelPaddingSpaces
        );

        for (const child of collectChildren(tree, root)) {
            const childRect = result[child.index];
            expect(childRect).toBeDefined();
            if (childRect === undefined) {
                continue;
            }
            expect(expectedContainer.comprises(childRect)).toBe(true);
        }
    });

    it('can be selected through the static Layout dispatcher', () => {
        const tree = createStarTopology(5);
        const weights = new Float32Array([5, 1, 1, 1, 1, 1]);
        const layoutConfig = createMinimalLayoutConfiguration(algorithm);
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
        expect(layout[1].area).toBeGreaterThan(0);
    });
});
