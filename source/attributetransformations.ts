
/* spellchecker: disable */

import * as wglo from 'webgl-operate';

wglo.auxiliaries;

import { auxiliaries } from 'webgl-operate';
const assert = auxiliaries.assert;
const log = auxiliaries.log;
const logIf = auxiliaries.logIf;
const LogLevel = auxiliaries.LogLevel;

import { AttributeBuffer } from './attributebuffer';
import { Configuration } from './configuration';
import { Node } from './node';
import { Topology } from './topology';

/* spellchecker: enable */


export namespace AttributeTransformations {
    export type Normalization = Array<number>;

    export function normalization_backup(tree: Topology, config: Configuration): Normalization {
        const result = new Array<number>(tree.numberOfNodes);

        let lookupEdge: (index: number) => [number, number];

        if (config.topology.format === Topology.InputFormat.Interleaved) {
            const edges = config.topology.edges as Array<number>;

            /*
             * It is expected that a tree has (number of nodes - 1) edges.
             * This usually holds as every node has an edge to its parent node except
             * for the root node.
             * For the interleaved format, the source and target of the edge are flat-encoded,
             * and thus, the expected length is doubled.
             */
            const expectedLength = 2 * (tree.numberOfNodes - 1);

            logIf(edges.length !== expectedLength, LogLevel.Warning, `expected an edgelist of size` +
                ` ${expectedLength} instead of ${edges.length}`);

            lookupEdge = (index: number): [number, number] => {
                const iLookup = 2 * (index - 1);

                assert(iLookup < edges.length, `expected an index within the ranges of edges but got`
                    + ` ${index}`);

                return iLookup < edges.length ? [edges[iLookup + 0], edges[iLookup + 1]] :
                    [Node.INVALID_INDEX, Node.INVALID_INDEX];
            };
        } else {
            const edges = config.topology.edges as Array<[number, number]>;

            /*
             * It is expected that a tree has (number of nodes - 1) edges.
             * This usually holds as every node has an edge to its parent node except
             * for the root node.
             */
            const expectedLength = tree.numberOfNodes - 1;

            logIf(edges.length !== expectedLength, LogLevel.Warning, `expected an edgelist of size` +
                ` ${expectedLength} instead of ${edges.length}`);

            lookupEdge = (index: number): [number, number] => {
                assert(index - 1 < edges.length, `expected an index within the ranges of edges but got`
                    + `${index}`);

                return index - 1 < edges.length ? edges[index - 1] :
                    [Node.INVALID_INDEX, Node.INVALID_INDEX];
            };
        }

        /*
         * Start with index = 1 for iteration as the root node index is correct in every used
         * encoding (depth-first, breadth-first)
         */

        /* Initialize root value (index = 0) */
        result[0] = 0;

        for (let index = 1; index < tree.numberOfNodes; index++) {
            let newIndex: number | undefined;

            /* The following is based on the topology edges order assumption @see {@link topology}. */
            const currentEdge = lookupEdge(index); // 0: parent, 1: current

            /*
             * Test if node is an inner node. It can't happen if it's the last one because of
             * depth-first order.
             */
            if (index + 1 < tree.numberOfNodes) {
                const possibleChildEdge = lookupEdge(index + 1); // 0: current, 1: child

                if (possibleChildEdge[0] === currentEdge[1]) {
                    newIndex = tree.innerNodeIndexById(currentEdge[1]);
                } else {
                    newIndex = tree.leafNodeIndexById(currentEdge[1]);
                }
            } else {
                newIndex = tree.leafNodeIndexById(currentEdge[1]);
            }

            assert(newIndex !== undefined, `expected a valid index, given ${newIndex} for `
                + `${currentEdge[1]}`);

            result[index] = newIndex!;
        }

        return result;
    }

    export function renormalize(source: Configuration.AttributeBuffer, normalization: Array<number>):
        Float32Array {

        const result = new Float32Array(normalization.length);

        logIf(normalization.length !== source.length, LogLevel.Warning, `expected value buffer to be`
            + ` sized with the number of nodes but got ${source.length} instead of `
            + `${normalization.length}`);

        for (let i = 0; i < result.length; ++i) {
            result[normalization[i]] = source[i];
        }

        return result;
    }

    export function renormalize_using_intermediate_linearization(source: Configuration.AttributeBuffer,
        mapping: Configuration.LinearizationMapping, normalization: Array<number>): Float32Array {

        const result = new Float32Array(normalization.length);

        result.fill(NaN);

        switch (mapping.type) {
            case AttributeBuffer.LinearizationMapping.IdMapping:
                assert(false, `Id-Mapping not yet implemented`);
                break;

            case AttributeBuffer.LinearizationMapping.IndexMapping:
                for (let i = 0; i < source.length; ++i) {
                    let sourceTopologyIndex = mapping.mapping[i];

                    if (sourceTopologyIndex === undefined) {
                        continue;
                    }

                    result[normalization[sourceTopologyIndex]] = source[i];
                }
                break;
        }

        return result;
    }

    export function applyTransformations(
        tree: Topology, normalization: Array<number>, target: Configuration.AttributeBuffer,
        transformations: Array<Configuration.Transformation>,
        config: Configuration): Configuration.AttributeBuffer {

        for (const transform of transformations) {
            switch (transform.type) {
                case 'normalize':
                    AttributeTransformations.applyNormalization(tree, target, transform);
                    break;
                case 'range-transform':
                    AttributeTransformations.applyRangeTransform(tree, target, transform);
                    break;
                case 'propagate-up':
                    AttributeTransformations.applyPropagation(tree, target, transform);
                    break;
                case 'fill-invalid':
                    AttributeTransformations.applyFill(tree, target, transform);
                    break;
                case 'mask':
                    AttributeTransformations.applyMask(tree, target, transform);
                    break;
                case 'clamp':
                    AttributeTransformations.applyClamp(tree, target, transform);
                    break;
                case 'threshold':
                    AttributeTransformations.applyThreshold(tree, target, transform);
                    break;
                case 'compare':
                    AttributeTransformations.applyCompare(tree, target, transform);
                    break;
                case 'transform':
                    AttributeTransformations.applyTransform(tree, normalization, target, transform, config);
                    break;
                case 'discretize':
                    AttributeTransformations.applyDiscretization(tree, target, transform);
                    break;
                case 'callback':
                    AttributeTransformations.applyCallback(tree, target, transform);
                    break;
                default:
                    break;
            }
        }

        return target;
    }

    export function applyNormalization(tree: Topology, target: Configuration.AttributeBuffer,
        transform: Configuration.Transformation): void {

        if (tree.numberOfLeafNodes === 0) {
            return;
        }

        let offset = 0.0;
        let factor = 1.0;

        switch (transform.operation) {
            case 'zero-to-max':
                {
                    let max: number | undefined;
                    tree.forEachLeafNode((leaf: Node) => {
                        const value = target[leaf.index];

                        max = max === undefined ? value : Math.max(max, value);
                    });

                    assert(max !== undefined, `Valid max expected`);

                    if (max === undefined) {
                        max = 1.0;
                    }

                    offset = 0;
                    factor = 1 / max;
                }
                break;
            case 'min-to-max':
                {
                    let max: number | undefined;
                    let min: number | undefined;
                    tree.forEachLeafNode((leaf: Node) => {
                        const value = target[leaf.index];

                        max = max === undefined ? value : Math.max(max, value);
                        min = min === undefined ? value : Math.min(min, value);
                    });

                    assert(max !== undefined, `Valid max expected`);
                    assert(min !== undefined, `Valid min expected`);

                    if (min === undefined) {
                        min = 0.0;
                    }

                    if (max === undefined) {
                        max = 1.0;
                    }

                    offset = -min;
                    factor = 1 / (max - min);
                }
                break;
            case 'sign-agnostic-max':
                {
                    let max: number | undefined;
                    tree.forEachLeafNode((leaf: Node) => {
                        const value = Math.abs(target[leaf.index]);

                        max = max === undefined ? value : Math.max(max, value);
                    });

                    assert(max !== undefined, `Valid max expected`);

                    if (max === undefined) {
                        max = 1.0;
                    }

                    offset = 0;
                    factor = 1 / max;
                }
                break;
            case 'diverging':
                {
                    const neutralElement = (transform.neutralElement === undefined ? 0.0 : transform.neutralElement);
                    let max: number | undefined;
                    let min: number | undefined;
                    tree.forEachLeafNode((leaf: Node) => {
                        const value = target[leaf.index];

                        max = max === undefined ? value : Math.max(max, value);
                        min = min === undefined ? value : Math.min(min, value);
                    });

                    assert(max !== undefined, `Valid max expected`);
                    assert(min !== undefined, `Valid min expected`);

                    if (min === undefined) {
                        min = 0.0;
                    }

                    if (max === undefined) {
                        max = 1.0;
                    }

                    const maxDelta = Math.max(Math.abs(neutralElement - min), Math.abs(max - neutralElement));

                    offset = maxDelta - neutralElement;
                    factor = 1 / (2 * maxDelta);

                }
                break;
            default:
                break;
        }

        (target as Array<number>).forEach((element: number, index: number) => {
            target[index] = (target[index] + offset) * factor;
        });
    }

    export function applyRangeTransform(tree: Topology, target: Configuration.AttributeBuffer,
        transform: Configuration.Transformation): void {

        if (tree.numberOfLeafNodes === 0 || transform.sourceRange === undefined ||
            transform.targetRange === undefined) {
            return;
        }

        const sourceRange = transform.sourceRange;
        const targetRange = transform.targetRange;

        const sourceOffset = -sourceRange[0];
        const targetOffset = targetRange[0];

        const factor = sourceRange[1] === sourceRange[0] ?
            0.0 : (targetRange[1] - targetRange[0]) / (sourceRange[1] - sourceRange[0]);

        for (let index = 0; index < target.length; index++) {
            if (target[index] < sourceRange[0]) {
                target[index] = -1;
            } else {
                target[index] = targetOffset + (target[index] + sourceOffset) * factor;
            }

        }
    }

    export function applyPropagation(tree: Topology, target: Configuration.AttributeBuffer,
        transform: Configuration.Transformation): void {

        if (tree.numberOfLeafNodes === 0) {
            return;
        }

        switch (transform.operation) {
            case 'average':
                {
                    tree.reverseParentsDo((parent: Node) => {
                        let accumulatedValue = 0.0;
                        let count = 0;
                        tree.childrenDo(parent, (child: Node) => {
                            const value = target[child.index];

                            accumulatedValue += value;
                            ++count;
                        });

                        target[parent.index] = count === 0 ? 0.0 : accumulatedValue / count;
                    });
                }
                break;
            case 'sum':
                {
                    tree.reverseParentsDo((parent: Node) => {
                        let accumulatedValue = 0.0;
                        tree.childrenDo(parent, (child: Node) => {
                            const value = target[child.index];

                            accumulatedValue += value;
                        });

                        target[parent.index] = accumulatedValue;
                    });
                }
                break;
            case 'min':
                {
                    tree.reverseParentsDo((parent: Node) => {
                        let accumulatedValue: number | undefined;
                        tree.childrenDo(parent, (child: Node) => {
                            const value = target[child.index];

                            accumulatedValue = accumulatedValue === undefined ? value :
                                Math.min(value, accumulatedValue);
                        });

                        if (accumulatedValue === undefined) {
                            accumulatedValue = 0.0;
                        }

                        target[parent.index] = accumulatedValue;
                    });
                }
                break;
            case 'max':
                {
                    tree.reverseParentsDo((parent: Node) => {
                        let accumulatedValue: number | undefined;
                        tree.childrenDo(parent, (child: Node) => {
                            const value = target[child.index];

                            accumulatedValue = accumulatedValue === undefined ? value :
                                Math.max(value, accumulatedValue);
                        });

                        if (accumulatedValue === undefined) {
                            accumulatedValue = 0.0;
                        }

                        target[parent.index] = accumulatedValue;
                    });
                }
                break;
            case 'median':
                {
                    tree.reverseParentsDo((parent: Node) => {
                        const values = new Array<number>();
                        tree.childrenDo(parent, (child: Node) => {
                            const value = target[child.index];

                            values.push(value);
                        });

                        values.sort();

                        if (values.length % 2 === 0) {
                            target[parent.index] = (values[values.length / 2]
                                + values[values.length / 2]) / 2.0;
                        } else {
                            target[parent.index] = values[values.length / 2];
                        }
                    });
                }
                break;
            case 'closest-to-zero':
                {
                    tree.reverseParentsDo((parent: Node) => {
                        let accumulatedValue: number | undefined;
                        tree.childrenDo(parent, (child: Node) => {
                            const value = target[child.index];

                            if (accumulatedValue === undefined
                                || Math.abs(value) < Math.abs(accumulatedValue)) {
                                accumulatedValue = value;
                            }
                        });

                        if (accumulatedValue === undefined) {
                            accumulatedValue = 0.0;
                        }

                        target[parent.index] = accumulatedValue;
                    });
                }
                break;
            case 'closest-to-infinity':
                {
                    tree.reverseParentsDo((parent: Node) => {
                        let accumulatedValue: number | undefined;
                        tree.childrenDo(parent, (child: Node) => {
                            const value = target[child.index];

                            if (accumulatedValue === undefined
                                || Math.abs(value) > Math.abs(accumulatedValue)) {
                                accumulatedValue = value;
                            }
                        });

                        if (accumulatedValue === undefined) {
                            accumulatedValue = 0.0;
                        }

                        target[parent.index] = accumulatedValue;
                    });
                }
                break;
            default:
                log(LogLevel.Warning, `Transformation type not recognized.`);
                break;
        }
    }

    export function applyFill(tree: Topology, target: Configuration.AttributeBuffer,
        transform: Configuration.Transformation): void {

        const value = (transform as any).value;
        const invalidValue = 'invalidValue' in transform ? (transform as any).invalidValue : undefined;

        tree.nodesDo((node: Node) => {
            if (target[node.index] === invalidValue) {
                target[node.index] = value;
            }
        });
    }

    export function applyClamp(tree: Topology, target: Configuration.AttributeBuffer,
        transform: Configuration.Transformation): void {

        let min: number;
        let max: number;
        if ('range' in transform) {
            min = (transform as any).range[0];
            max = (transform as any).range[0];
        } else {
            min = (transform as any).min;
            max = (transform as any).max;
        }

        assert(min <= max, `Require valid min-max range.`);

        tree.nodesDo((node: Node) => {
            const currentValue = target[node.index];

            if (currentValue === undefined) {
                return;
            }

            target[node.index] = Math.min(max, Math.max(min, currentValue));
        });
    }

    export function applyMask(tree: Topology, target: Configuration.AttributeBuffer,
        transform: Configuration.Transformation): void {

        const value = (transform as any).value as number;

        tree.nodesDo((node: Node) => {
            target[node.index] = target[node.index] === value ? 1.0 : 0.0;
        });
    }

    export function applyThreshold(tree: Topology, target: Configuration.AttributeBuffer,
        transform: Configuration.Transformation): void {

        const threshold = (transform as any).value as number;

        tree.nodesDo((node: Node) => {
            target[node.index] = target[node.index] >= threshold ? 1.0 : 0.0;
        });
    }

    export function applyCompare(tree: Topology, target: Configuration.AttributeBuffer,
        transform: Configuration.Transformation): void {

        const threshold = (transform as any).value as number;

        tree.nodesDo((node: Node) => {
            target[node.index] = target[node.index] > threshold ? 1.0
                : target[node.index] < threshold ? -1.0
                    : 0.0;
        });
    }

    export function applyTransform(tree: Topology, normalization: Array<number>,
        target: Configuration.AttributeBuffer, transform: Configuration.Transformation,
        configuration: Configuration): void {

        const operation = transform.operation;
        const parameter = transform.parameter;
        const buffer = transform.buffer;

        let getter = (node: Node) => parameter;
        if (buffer !== undefined) {
            const bufferValues = AttributeBuffer.create(tree, normalization, buffer, configuration);

            if (bufferValues !== undefined) {
                getter = (node: Node) => bufferValues[node.index];
            }
        }

        switch (operation) {
            case 'min':
                {
                    tree.nodesDo((node: Node) => {
                        target[node.index] = Math.min(target[node.index], getter(node)!);
                    });
                }
                break;
            case 'max':
                {
                    tree.nodesDo((node: Node) => {
                        target[node.index] = Math.max(target[node.index], getter(node)!);
                    });
                }
                break;
            case 'add':
                {
                    tree.nodesDo((node: Node) => {
                        target[node.index] = target[node.index] + getter(node)!;
                    });
                }
                break;
            case 'subtract':
                {
                    tree.nodesDo((node: Node) => {
                        target[node.index] = target[node.index] - getter(node)!;
                    });
                }
                break;
            case 'multiply':
                {
                    tree.nodesDo((node: Node) => {
                        target[node.index] = target[node.index] * getter(node)!;
                    });
                }
                break;
            case 'divide':
                {
                    tree.nodesDo((node: Node) => {
                        target[node.index] = target[node.index] / getter(node)!;
                    });
                }
                break;
            case 'inverse':
                {
                    tree.nodesDo((node: Node) => {
                        target[node.index] = 1.0 / target[node.index];
                    });
                }
                break;
            case 'pow':
                {
                    tree.nodesDo((node: Node) => {
                        target[node.index] = Math.pow(target[node.index], getter(node)!);
                    });
                }
                break;
            case 'nth-root':
                {
                    tree.nodesDo((node: Node) => {
                        const exponent = 1 / getter(node)!;
                        target[node.index] = Math.pow(target[node.index], exponent);
                    });
                }
                break;
            case 'log':
                {
                    if (parameter !== undefined && parameter !== 0.0) {
                        tree.nodesDo((node: Node) => {
                            const divisor = Math.log(getter(node)!);
                            target[node.index] = Math.log(target[node.index]) / divisor;
                        });
                    } else {
                        tree.nodesDo((node: Node) => {
                            target[node.index] = Math.log(target[node.index]);
                        });
                    }
                }
                break;
            case 'square':
                {
                    tree.nodesDo((node: Node) => {
                        target[node.index] = Math.pow(target[node.index], 2.0);
                    });
                }
                break;
            case 'square-root':
                {
                    tree.nodesDo((node: Node) => {
                        target[node.index] = Math.sqrt(target[node.index]);
                    });
                }
                break;
            case 'as-multiplier':
                {
                    tree.nodesDo((node: Node) => {
                        target[node.index] = Math.abs(target[node.index]);
                    });
                }
                break;
            case 'as-remainder':
                {
                    tree.nodesDo((node: Node) => {
                        target[node.index] = 1.0 - Math.abs(target[node.index]);
                    });
                }
                break;
            case 'abs':
                {
                    tree.nodesDo((node: Node) => {
                        target[node.index] = Math.abs(target[node.index]);
                    });
                }
                break;
            case 'compare':
                {
                    tree.nodesDo((node: Node) => {
                        const a = target[node.index];
                        const b = getter(node)!;

                        if (a < b) {
                            target[node.index] = -1;
                        } else if (a > b) {
                            target[node.index] = 1;
                        } else {
                            target[node.index] = 0;
                        }
                    });
                }
                break;
            default:
                return;
        }
    }

    export function applyDiscretization(tree: Topology, target: Configuration.AttributeBuffer,
        transform: Configuration.Transformation): void {
        assert(false, `Implementation missing`);
    }

    export function applyCallback(tree: Topology, target: Configuration.AttributeBuffer,
        transform: Configuration.Transformation): void {

        const callback = (transform as any).operation;
        const iteration = (transform as any).iteration;

        switch (iteration) {
            case Topology.IterationDirection.TopDown:
                tree.nodesDo((node: Node) => {
                    target[node.index] = callback(target[node.index], node, target, tree);
                });
                break;
            case Topology.IterationDirection.DepthFirst:
                tree.reverseNodesDo((node: Node) => {
                    target[node.index] = callback(target[node.index], node, target, tree);
                });
                break;
            case Topology.IterationDirection.Leaves:
                tree.forEachLeafNode((node: Node) => {
                    target[node.index] = callback(target[node.index], node, target, tree);
                });
                break;
            case Topology.IterationDirection.BottomUp:
            default:
                tree.depthFirstDo((node: Node) => {
                    target[node.index] = callback(target[node.index], node, target, tree);
                });
                break;
        }
    }

}
