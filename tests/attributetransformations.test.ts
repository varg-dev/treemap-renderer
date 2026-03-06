import { describe, expect, it } from 'vitest';

import { AttributeTransformations } from '../source/attributetransformations';
import { Node } from '../source/node';
import { createStarTopology } from './helpers';
import { Topology } from '../source/topology';

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

    it('discretizes values by quantiles', () => {
        const tree = createStarTopology(3);
        const target = new Float32Array([10, 20, 30, 40]);

        AttributeTransformations.applyDiscretization(tree, target, {
            type: 'discretize',
            operation: 'quantiles',
            percentiles: [50],
        });

        expect(Array.from(target)).toEqual([0, 0, 1, 1]);
    });

    it('invokes callbacks in configured iteration order', () => {
        const edges = [0, 1, 1, 2, 1, 3, 0, 4, 4, 5, 4, 6];
        const tree = new Topology();
        tree.initialize(Topology.InputFormat.Interleaved, Topology.InputSemantics.ParentIdId, edges);
        const target = new Float32Array([0, 1, 2, 3, 4, 5, 6]);

        const topDown = new Array<number>();
        AttributeTransformations.applyCallback(tree, target, {
            type: 'callback',
            iteration: 'top-down',
            operation: (_value: number, node: Node) => {
                topDown.push(node.id);
                return _value;
            },
        });

        const depthFirst = new Array<number>();
        AttributeTransformations.applyCallback(tree, target, {
            type: 'callback',
            iteration: 'depth-first',
            operation: (_value: number, node: Node) => {
                depthFirst.push(node.id);
                return _value;
            },
        });

        const leavesOnly = new Array<number>();
        AttributeTransformations.applyCallback(tree, target, {
            type: 'callback',
            iteration: 'leaves',
            operation: (_value: number, node: Node) => {
                leavesOnly.push(node.id);
                return _value;
            },
        });

        const bottomUp = new Array<number>();
        AttributeTransformations.applyCallback(tree, target, {
            type: 'callback',
            iteration: 'bottom-up',
            operation: (_value: number, node: Node) => {
                bottomUp.push(node.id);
                return _value;
            },
        });

        expect(topDown).toEqual([0, 1, 4, 2, 3, 5, 6]);
        expect(depthFirst).toEqual([0, 1, 2, 3, 4, 5, 6]);
        expect(leavesOnly).toEqual([2, 3, 5, 6]);
        expect(bottomUp).toEqual([2, 3, 5, 6, 4, 1, 0]);
    });

    it('applies median propagation with numeric sorting for even and odd counts', () => {
        const tree = createStarTopology(2);
        const evenChildren = new Float32Array([0, 20, 2]);
        AttributeTransformations.applyPropagation(tree, evenChildren, {
            type: 'propagate-up',
            operation: 'median',
        });
        expect(evenChildren[0]).toBeCloseTo(11);

        const oddChildren = new Float32Array([0, 100, 2, 20]);
        const oddTree = createStarTopology(3);
        AttributeTransformations.applyPropagation(oddTree, oddChildren, {
            type: 'propagate-up',
            operation: 'median',
        });
        expect(oddChildren[0]).toBeCloseTo(20);
    });

    it('passes the tree to callback function', () => {
        const tree = createStarTopology(2);
        const target = new Float32Array([1, 2, 3]);
        let sameTree = false;

        AttributeTransformations.applyCallback(tree, target, {
            type: 'callback',
            iteration: 'top-down',
            operation: (_value: number, _node: Node, callbackTree: Topology) => {
                sameTree = callbackTree === tree;
                return _value;
            },
        });

        expect(sameTree).toBe(true);
    });

    it('rejects non-functional callback operations', () => {
        const tree = createStarTopology(1);
        const target = new Float32Array([1]);

        expect(() => {
            AttributeTransformations.applyCallback(tree, target, {
                type: 'callback',
                iteration: 'top-down',
                operation: 'invalid' as unknown as ((value: number) => number),
            });
        }).toThrowError(`Expected callback operation to be a function`);
    });

    it('clamps with both min and max from a range tuple', () => {
        const tree = createStarTopology(2);
        const target = new Float32Array([1, 5, 10]);

        AttributeTransformations.applyClamp(tree, target, {
            type: 'clamp',
            range: [3, 8],
        });

        expect(Array.from(target)).toEqual([3, 5, 8]);
    });

    it('maps source buffers using id-mapping linearization', () => {
        const tree = new Topology();
        tree.initialize(Topology.InputFormat.Interleaved, Topology.InputSemantics.ParentIdId,
            [0, 1, 0, 2]);

        const source = [10, 20, 30];
        const normalization = tree.edgeIndexToTopologyIndexMap;
        const result = AttributeTransformations.renormalize_using_intermediate_linearization(tree, source,
            {
                type: 'id-mapping',
                mapping: [1, 2, 0],
            },
            normalization);

        expect(Array.from(result)).toEqual([20, 30, 10]);
    });
});
