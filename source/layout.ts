
/* spellchecker: disable */

import { auxiliaries } from 'webgl-operate';
const assert = auxiliaries.assert;

import { Node } from './node';
import { Rect } from './rect';
import { Topology } from './topology';

import { CodeCityLayout } from './codecitylayout';
import { Configuration } from './configuration';
import { SnakeLayout } from './snakelayout';
import { HilbertLayout, MooreLayout } from './hilbertmoorelayout';
import { StripLayout } from './striplayout';

/* spellchecker: enable */


export interface ParentLayoutCallback {
    (rect: Rect, node: Node, tree: Topology, dissectionSpace: Array<Rect>, labelRects: Array<Rect>,
        labelPaddingSpaces: Array<number>): Rect;
}

export interface AccessoryLayoutCallback {
    (rect: Rect, node: Node, tree: Topology, dissectionSpace: Array<Rect>,
        accessorySpace: Array<Rect>): Rect;
}

export interface SiblingLayoutCallback {
    (rect: Rect, layoutRect: Rect, parentRect: Rect, node: Node): Rect;
}

export interface LayoutCallbacks {
    parentPaddingCallback: ParentLayoutCallback;
    siblingMarginBeforeCallback: ParentLayoutCallback;
    siblingMarginAfterCallback: SiblingLayoutCallback;
    accessoryPaddingCallback: AccessoryLayoutCallback;
    parentPaddingExpansionCallback?: ParentLayoutCallback;
    accessoryPaddingExpansionCallback?: AccessoryLayoutCallback;
}


export enum LayoutOperation {
    ParentPadding,
    SiblingMargin,
    AccessorPadding,
}


export class Layout {
    static readonly emptyParentCallback: ParentLayoutCallback =
        (rect: Rect, node: Node, tree: Topology, dissectionSpace: Array<Rect>) => {
            return rect;
        }
    static readonly emptyAccessoryParentCallback: AccessoryLayoutCallback =
        (rect: Rect, node: Node, tree: Topology, dissectionSpace: Array<Rect>,
            accessorySpaces: Array<Rect>) => {
            return rect;
        }
    static readonly emptySiblingCallback: SiblingLayoutCallback =
        (rect: Rect, layoutRect: Rect, parentRect: Rect, node: Node) => {
            return rect;
        }

    /**
     * Creates a nested layout.
     * @param tree - The underlying topology.
     * @param weights - The array of weights.
     * @param configuration - Configuration as source of layout algorithm and settings.
     * @param accessorySpaces - out - the spaces where the inner labels can be placed; by node.index
     * @param labelRects - out - the rectangle of the inner nodes, including padding; by node.index
     * @param labelPaddingSpaces - out - the padding spaces of the inner nodes; by node.index
     * @param prunedNodes - out - a node-index based buffer that should store if a node was pruned.
     * @returns layout for given tree
     */
    static createLayout(tree: Topology, weights: Configuration.AttributeBuffer,
        configuration: Configuration.Layout, accessorySpaces: Array<Rect>, labelRects: Array<Rect>,
        labelPaddingSpaces: Array<number>): Array<Rect> {

        const layout = new Array<Rect>(tree.numberOfNodes);

        assert(weights !== undefined, `Valid weights expected`);

        if (weights === undefined) {
            return layout;
        }

        const rootWeight = weights[0] as number;

        if (auxiliaries.assertions() && tree.numberOfNodes > 1) {
            let weightSum = 0.0;

            tree.forEachLeafNode((node: Node) => {
                weightSum += weights[node.index];
            });

            assert(rootWeight !== undefined && (weightSum === 0.0 || rootWeight > 0.0),
                `Accumulated leaf weights as root weight expected. Expected ${weightSum}, got ${rootWeight}`);
        }

        const aspectRatio = configuration.aspectRatio!;

        // out parameters: layout, labelRects, accessorySpaces, labelPaddingSpaces
        switch (configuration.algorithm) {
            case Layout.LayoutAlgorithm.Strip:
                StripLayout.compute(tree, weights, aspectRatio, layout,
                    Layout.splittingLayoutPostprocessing(configuration), accessorySpaces, labelRects,
                    labelPaddingSpaces);
                break;
            case Layout.LayoutAlgorithm.Snake:
                SnakeLayout.compute(tree, weights, aspectRatio, layout,
                    Layout.splittingLayoutPostprocessing(configuration), accessorySpaces, labelRects,
                    labelPaddingSpaces);
                break;
            case Layout.LayoutAlgorithm.Hilbert:
                HilbertLayout.compute(tree, weights, aspectRatio, layout,
                    Layout.splittingLayoutPostprocessing(configuration), accessorySpaces, labelRects,
                    labelPaddingSpaces);
                break;
            case Layout.LayoutAlgorithm.Moore:
                MooreLayout.compute(tree, weights, aspectRatio, layout,
                    Layout.splittingLayoutPostprocessing(configuration), accessorySpaces, labelRects,
                    labelPaddingSpaces);
                break;
            case Layout.LayoutAlgorithm.CodeCity:
                CodeCityLayout.compute(tree, weights, aspectRatio, layout,
                    Layout.packingLayoutPostprocessing(configuration), accessorySpaces, labelRects,
                    labelPaddingSpaces);
                break;
            default:
                break;
        }

        return layout;
    }

    static splittingLayoutPostprocessing(configuration: Configuration.Layout): LayoutCallbacks {
        const callbacks: LayoutCallbacks = {
            parentPaddingCallback: Layout.emptyParentCallback,
            siblingMarginBeforeCallback: Layout.emptyParentCallback,
            siblingMarginAfterCallback: Layout.emptySiblingCallback,
            accessoryPaddingCallback: Layout.emptyAccessoryParentCallback,
        };

        let parentPadding = [0.0];
        let siblingMargin = 0.0;

        if (configuration.siblingMargin !== undefined) {
            siblingMargin = configuration.siblingMargin.value as number;

            if (siblingMargin >= 0.0) {
                switch (configuration.siblingMargin.type) {
                    case Layout.SiblingMarginType.Absolute:
                        callbacks.siblingMarginAfterCallback =
                            (rect: Rect, layoutRect: Rect, parentRect: Rect, node: Node) => {
                                if (node.isRoot) {
                                    return rect;
                                }

                                const innerMargin = siblingMargin;

                                return rect.map(layoutRect, parentRect)
                                    .paddedWithMinArea(innerMargin * 0.5, 0.0);
                            };
                        break;
                    case Layout.SiblingMarginType.Relative:
                        callbacks.siblingMarginAfterCallback =
                            (rect: Rect, layoutRect: Rect, parentRect: Rect, node: Node) => {
                                if (node.isRoot) {
                                    return rect;
                                }

                                const innerMargin = rect.equalizedRelativeMargin(siblingMargin);

                                return rect.map(layoutRect, parentRect)
                                    .paddedWithMinArea(innerMargin * 0.5, 0.0);
                            };
                        break;
                    default:
                        break;
                }
            }
        }

        if (configuration.parentPadding !== undefined) {
            if (configuration.parentPadding.value instanceof Array) {
                parentPadding = configuration.parentPadding.value;
            } else {
                parentPadding = [configuration.parentPadding.value as number];
            }

            if (parentPadding[0] >= 0.0) { // todo
                switch (configuration.parentPadding.type) {

                    case Layout.ParentPaddingType.Mixed:

                        callbacks.parentPaddingCallback =
                            (rect: Rect, node: Node, tree: Topology, dissectionSpace: Array<Rect>,
                                labelRects: Array<Rect>, labelPaddingSpaces: Array<number>) => {

                                let outerPadding;
                                let resultRect;
                                if (parentPadding.length - 1 > node.depth) {
                                    const value = parentPadding[node.depth];
                                    outerPadding = rect.equalizedMargin(value, 0.5, 0.9);
                                    resultRect = rect.padded(outerPadding);

                                    if (labelRects !== undefined && labelPaddingSpaces !== undefined) {
                                        labelRects[node.index] = resultRect;
                                        labelPaddingSpaces[node.index] = outerPadding;
                                    }
                                } else {
                                    /* apply relative padding for the rest. This relative padding value
                                     * is stored as the last element in parentPadding */
                                    outerPadding = rect.equalizedRelativeMargin(
                                        parentPadding[parentPadding.length - 1]);
                                    resultRect = rect.padded(outerPadding);
                                }
                                return resultRect;
                            };
                        callbacks.siblingMarginBeforeCallback =
                            (rect: Rect, node: Node, tree: Topology, dissectionSpace: Array<Rect>) => {

                                let innerMargin;
                                if (parentPadding.length > node.depth) {
                                    innerMargin = siblingMargin;
                                } else {
                                    innerMargin = rect.equalizedRelativeMargin(siblingMargin);
                                }

                                return rect.padded(-innerMargin * 0.5);
                            };
                        break;
                    case Layout.ParentPaddingType.Absolute:
                        callbacks.parentPaddingCallback =
                            (rect: Rect, node: Node, tree: Topology, dissectionSpace: Array<Rect>) => {
                                const outerPadding = rect.equalizedMargin(parentPadding[0], 0.5, 0.6);

                                return rect.padded(outerPadding);
                            };
                        callbacks.siblingMarginBeforeCallback =
                            (rect: Rect, node: Node, tree: Topology, dissectionSpace: Array<Rect>) => {
                                const innerMargin = siblingMargin;

                                return rect.padded(-innerMargin * 0.5);
                            };
                        break;
                    case Layout.ParentPaddingType.Relative:
                        callbacks.parentPaddingCallback =
                            (rect: Rect, node: Node, tree: Topology, dissectionSpace: Array<Rect>) => {
                                const outerPadding = rect.equalizedRelativeMargin(parentPadding[0]);

                                return rect.padded(outerPadding);
                            };
                        callbacks.siblingMarginBeforeCallback =
                            (rect: Rect, node: Node, tree: Topology, dissectionSpace: Array<Rect>) => {
                                const innerMargin = rect.equalizedRelativeMargin(siblingMargin);

                                return rect.padded(-innerMargin * 0.5);
                            };
                        break;
                    default:
                        break;
                }
            }
        }

        if (configuration.accessoryPadding !== undefined) {
            const type = configuration.accessoryPadding.type as Layout.AccessoryPaddingType;
            const padding = configuration.accessoryPadding.value;

            const direction =
                configuration.accessoryPadding.direction! as Layout.AccessoryPaddingDirection;

            const relativeAreaThreshold =
                configuration.accessoryPadding.relativeAreaThreshold !== undefined ?
                    configuration.accessoryPadding.relativeAreaThreshold : 0.0;

            const targetAspectRatio = configuration.accessoryPadding.targetAspectRatio !== undefined ?
                configuration.accessoryPadding.targetAspectRatio : Number.NaN;

            /* todo - omg - refactor this! */
            if (padding !== undefined) {
                switch (type) {
                    case Layout.AccessoryPaddingType.Absolute: {
                        switch (direction) {
                            case Layout.AccessoryPaddingDirection.Bottom: {
                                callbacks.accessoryPaddingCallback = (rect: Rect, node: Node,
                                    tree: Topology, dissectionSpace: Array<Rect>,
                                    accessorySpace: Array<Rect>) => {

                                    let value: number;
                                    if (padding instanceof Array) {
                                        value = padding.length > node.depth ?
                                            padding[node.depth] : 0.0;
                                    } else {
                                        value = padding as number;
                                    }

                                    if (value > rect.height) {
                                        accessorySpace[node.index] = new Rect(0, 0, 0, 0);

                                        return rect;
                                    }

                                    let threshold: number;
                                    if (relativeAreaThreshold instanceof Array) {
                                        threshold = relativeAreaThreshold.length > node.depth ?
                                            relativeAreaThreshold[node.depth] : 1.0;
                                    } else {
                                        threshold = relativeAreaThreshold as number;
                                    }

                                    const newRect = rect.truncateBottom(rect.bottom + value);
                                    const accessoryRect = rect.truncateTop(newRect.bottom);

                                    if (newRect.area / rect.area <= threshold ||
                                        accessoryRect.aspectRatio < targetAspectRatio) {

                                        accessorySpace[node.index] = new Rect(0, 0, 0, 0);

                                        return rect;
                                    } else {
                                        accessorySpace[node.index] = accessoryRect;

                                        return newRect;
                                    }
                                };
                                break;
                            }
                            case Layout.AccessoryPaddingDirection.Top: {
                                callbacks.accessoryPaddingCallback = (rect: Rect, node: Node,
                                    tree: Topology, dissectionSpace: Array<Rect>,
                                    accessorySpace: Array<Rect>) => {

                                    let value: number;
                                    if (padding instanceof Array) {
                                        value = padding.length > node.depth ?
                                            padding[node.depth] : 0.0;
                                    } else {
                                        value = padding as number;
                                    }

                                    if (value > rect.height) {
                                        accessorySpace[node.index] = new Rect(0, 0, 0, 0);
                                        return rect;
                                    }

                                    let threshold: number;
                                    if (relativeAreaThreshold instanceof Array) {
                                        threshold = relativeAreaThreshold.length > node.depth ?
                                            relativeAreaThreshold[node.depth] : 1.0;
                                    } else {
                                        threshold = relativeAreaThreshold as number;
                                    }

                                    const newRect = rect.truncateTop(rect.top - value);
                                    const accessoryRect = rect.truncateBottom(newRect.top);

                                    if (newRect.area / rect.area <= threshold ||
                                        accessoryRect.aspectRatio < targetAspectRatio) {

                                        accessorySpace[node.index] = new Rect(0, 0, 0, 0);

                                        return rect;
                                    } else {
                                        accessorySpace[node.index] = accessoryRect;

                                        return newRect;
                                    }
                                };
                                break;
                            }
                            case Layout.AccessoryPaddingDirection.Left: {
                                callbacks.accessoryPaddingCallback = (rect: Rect, node: Node,
                                    tree: Topology, dissectionSpace: Array<Rect>,
                                    accessorySpace: Array<Rect>) => {

                                    let value: number;
                                    if (padding instanceof Array) {
                                        value = padding.length > node.depth ?
                                            padding[node.depth] : 0.0;
                                    } else {
                                        value = padding as number;
                                    }

                                    if (value > rect.width) {
                                        accessorySpace[node.index] = new Rect(0, 0, 0, 0);
                                        return rect;
                                    }

                                    let threshold: number;
                                    if (relativeAreaThreshold instanceof Array) {
                                        threshold = relativeAreaThreshold.length > node.depth ?
                                            relativeAreaThreshold[node.depth] : 1.0;
                                    } else {
                                        threshold = relativeAreaThreshold as number;
                                    }

                                    const newRect = rect.truncateLeft(rect.left + value);
                                    const accessoryRect = rect.truncateRight(newRect.left);

                                    if (newRect.area / rect.area <= threshold ||
                                        accessoryRect.aspectRatio < targetAspectRatio) {

                                        accessorySpace[node.index] = new Rect(0, 0, 0, 0);

                                        return rect;
                                    } else {
                                        accessorySpace[node.index] = accessoryRect;

                                        return newRect;
                                    }
                                };
                                break;
                            }
                            case Layout.AccessoryPaddingDirection.Right: {
                                callbacks.accessoryPaddingCallback = (rect: Rect, node: Node,
                                    tree: Topology, dissectionSpace: Array<Rect>,
                                    accessorySpace: Array<Rect>) => {

                                    let value: number;
                                    if (padding instanceof Array) {
                                        value = padding.length > node.depth ?
                                            padding[node.depth] : 0.0;
                                    } else {
                                        value = padding as number;
                                    }

                                    if (value > rect.width) {
                                        accessorySpace[node.index] = new Rect(0, 0, 0, 0);

                                        return rect;
                                    }

                                    let threshold: number;
                                    if (relativeAreaThreshold instanceof Array) {
                                        threshold = relativeAreaThreshold.length > node.depth ?
                                            relativeAreaThreshold[node.depth] : 1.0;
                                    } else {
                                        threshold = relativeAreaThreshold as number;
                                    }

                                    const newRect = rect.truncateRight(rect.right + value);
                                    const accessoryRect = rect.truncateLeft(newRect.right);

                                    if (newRect.area / rect.area <= threshold ||
                                        accessoryRect.aspectRatio < targetAspectRatio) {

                                        accessorySpace[node.index] = new Rect(0, 0, 0, 0);

                                        return rect;
                                    } else {
                                        accessorySpace[node.index] = accessoryRect;

                                        return newRect;
                                    }
                                };
                                break;
                            }
                            default:
                                break;
                        }
                        break;
                    }
                    case Layout.AccessoryPaddingType.Relative: {
                        switch (direction) {
                            case Layout.AccessoryPaddingDirection.Bottom: {
                                callbacks.accessoryPaddingCallback = (rect: Rect, node: Node,
                                    tree: Topology, dissectionSpace: Array<Rect>,
                                    accessorySpace: Array<Rect>) => {

                                    let value: number;
                                    if (padding instanceof Array) {
                                        value = padding.length > node.depth ?
                                            padding[node.depth] : 0.0;
                                    } else {
                                        value = padding as number;
                                    }

                                    let threshold: number;
                                    if (relativeAreaThreshold instanceof Array) {
                                        threshold = relativeAreaThreshold.length > node.depth ?
                                            relativeAreaThreshold[node.depth] : 1.0;
                                    } else {
                                        threshold = relativeAreaThreshold as number;
                                    }

                                    const newRect = rect.relativeTop(1.0 - value);
                                    const accessoryRect = rect.relativeBottom(value);

                                    if (newRect.area / rect.area > threshold) {
                                        accessorySpace[node.index] = accessoryRect;
                                        return newRect;
                                    }

                                    accessorySpace[node.index] = new Rect(0, 0, 0, 0);
                                    return rect;
                                };
                                break;
                            }
                            case Layout.AccessoryPaddingDirection.Top: {
                                callbacks.accessoryPaddingCallback = (rect: Rect, node: Node,
                                    tree: Topology, dissectionSpace: Array<Rect>,
                                    accessorySpace: Array<Rect>) => {

                                    let value: number;
                                    if (padding instanceof Array) {
                                        value = padding.length > node.depth ?
                                            padding[node.depth] : 0.0;
                                    } else {
                                        value = padding as number;
                                    }

                                    let threshold: number;
                                    if (relativeAreaThreshold instanceof Array) {
                                        threshold = relativeAreaThreshold.length > node.depth ?
                                            relativeAreaThreshold[node.depth] : 1.0;
                                    } else {
                                        threshold = relativeAreaThreshold as number;
                                    }

                                    const newRect = rect.relativeBottom(1.0 - value);
                                    const accessoryRect = rect.relativeTop(value);

                                    if (newRect.area / rect.area > threshold) {
                                        accessorySpace[node.index] = accessoryRect;
                                        return newRect;
                                    }

                                    accessorySpace[node.index] = new Rect(0, 0, 0, 0);
                                    return rect;
                                };
                                break;
                            }
                            case Layout.AccessoryPaddingDirection.Left: {
                                callbacks.accessoryPaddingCallback = (rect: Rect, node: Node,
                                    tree: Topology, dissectionSpace: Array<Rect>,
                                    accessorySpace: Array<Rect>) => {

                                    let value: number;
                                    if (padding instanceof Array) {
                                        value = padding.length > node.depth ?
                                            padding[node.depth] : 0.0;
                                    } else {
                                        value = padding as number;
                                    }

                                    let threshold: number;
                                    if (relativeAreaThreshold instanceof Array) {
                                        threshold = relativeAreaThreshold.length > node.depth ?
                                            relativeAreaThreshold[node.depth] : 1.0;
                                    } else {
                                        threshold = relativeAreaThreshold as number;
                                    }

                                    const newRect = rect.relativeRight(1.0 - value);
                                    const accessoryRect = rect.relativeLeft(value);

                                    if (newRect.area / rect.area > threshold) {
                                        accessorySpace[node.index] = accessoryRect;
                                        return newRect;
                                    }

                                    accessorySpace[node.index] = new Rect(0, 0, 0, 0);
                                    return rect;
                                };
                                break;
                            }
                            case Layout.AccessoryPaddingDirection.Right: {
                                callbacks.accessoryPaddingCallback = (rect: Rect, node: Node,
                                    tree: Topology, dissectionSpace: Array<Rect>,
                                    accessorySpace: Array<Rect>) => {

                                    let value: number;
                                    if (padding instanceof Array) {
                                        value = padding.length > node.depth ?
                                            padding[node.depth] : 0.0;
                                    } else {
                                        value = padding as number;
                                    }

                                    let threshold: number;
                                    if (relativeAreaThreshold instanceof Array) {
                                        threshold = relativeAreaThreshold.length > node.depth ?
                                            relativeAreaThreshold[node.depth] : 1.0;
                                    } else {
                                        threshold = relativeAreaThreshold as number;
                                    }

                                    const newRect = rect.relativeLeft(1.0 - value);
                                    const accessoryRect = rect.relativeRight(value);

                                    if (newRect.area / rect.area > threshold) {
                                        accessorySpace[node.index] = accessoryRect;
                                        return newRect;
                                    }

                                    accessorySpace[node.index] = new Rect(0, 0, 0, 0);
                                    return rect;
                                };
                                break;
                            }
                            default:
                                break;
                        }
                        break;
                    }
                    default:
                        break;
                }
            }
        }

        return callbacks;
    }

    static packingLayoutPostprocessing(configuration: Configuration.Layout): LayoutCallbacks {
        const splittingCallbacks = Layout.splittingLayoutPostprocessing(configuration);
        const callbacks: LayoutCallbacks = {
            parentPaddingCallback: splittingCallbacks.parentPaddingCallback,
            siblingMarginBeforeCallback: splittingCallbacks.siblingMarginBeforeCallback,
            siblingMarginAfterCallback: Layout.emptySiblingCallback,
            accessoryPaddingCallback: splittingCallbacks.accessoryPaddingCallback,
            parentPaddingExpansionCallback: Layout.emptyParentCallback,
            accessoryPaddingExpansionCallback: Layout.emptyAccessoryParentCallback,
        };

        let parentPadding = [0.0];
        let siblingMargin = 0.0;

        if (configuration.siblingMargin !== undefined) {
            siblingMargin = configuration.siblingMargin.value as number;
        }

        if (configuration.parentPadding !== undefined) {
            if (configuration.parentPadding.value instanceof Array) {
                parentPadding = configuration.parentPadding.value;
            } else {
                parentPadding = [configuration.parentPadding.value as number];
            }

            if (parentPadding[0] >= 0.0) {
                switch (configuration.parentPadding.type) {
                    case Layout.ParentPaddingType.Mixed:
                        callbacks.parentPaddingExpansionCallback =
                            (rect: Rect, node: Node, tree: Topology,
                                dissectionSpace: Array<Rect>, labelRects: Array<Rect>,
                                labelPaddingSpaces: Array<number>) => {

                                let outerPadding;
                                if (parentPadding.length - 1 > node.depth) {
                                    const value = parentPadding[node.depth];
                                    outerPadding = rect.equalizedMargin(value, 0.5, 0.9);

                                    if (labelRects !== undefined && labelPaddingSpaces !== undefined) {
                                        labelRects[node.index] = rect;
                                        labelPaddingSpaces[node.index] = outerPadding;
                                    }
                                } else {
                                    outerPadding = rect.equalizedRelativeMargin(
                                        parentPadding[parentPadding.length - 1]);
                                }

                                return rect.padded(-outerPadding);
                            };
                        break;
                    case Layout.ParentPaddingType.Absolute:
                        callbacks.parentPaddingExpansionCallback = (rect: Rect) => {
                            const outerPadding = rect.equalizedMargin(parentPadding[0], 0.5, 0.6);

                            return rect.padded(-outerPadding);
                        };
                        break;
                    case Layout.ParentPaddingType.Relative:
                        callbacks.parentPaddingExpansionCallback = (rect: Rect) => {
                            const outerPadding = rect.equalizedRelativeMargin(parentPadding[0]);

                            return rect.padded(-outerPadding);
                        };
                        break;
                    default:
                        break;
                }
            }
        }

        if (configuration.siblingMargin !== undefined && configuration.parentPadding === undefined) {
            if (siblingMargin >= 0.0) {
                switch (configuration.siblingMargin.type) {
                    case Layout.SiblingMarginType.Absolute:
                        callbacks.siblingMarginBeforeCallback =
                            (rect: Rect, node: Node) => {
                                if (node.isRoot) {
                                    return rect;
                                }

                                return rect.padded(-siblingMargin * 0.5);
                            };
                        break;
                    case Layout.SiblingMarginType.Relative:
                        callbacks.siblingMarginBeforeCallback =
                            (rect: Rect, node: Node) => {
                                if (node.isRoot) {
                                    return rect;
                                }

                                const innerMargin = rect.equalizedRelativeMargin(siblingMargin);

                                return rect.padded(-innerMargin * 0.5);
                            };
                        break;
                    default:
                        break;
                }
            }
        }

        if (configuration.accessoryPadding !== undefined) {
            const type = configuration.accessoryPadding.type as Layout.AccessoryPaddingType;
            const padding = configuration.accessoryPadding.value;
            const direction =
                configuration.accessoryPadding.direction! as Layout.AccessoryPaddingDirection;
            const relativeAreaThreshold =
                configuration.accessoryPadding.relativeAreaThreshold !== undefined ?
                    configuration.accessoryPadding.relativeAreaThreshold : 0.0;
            const targetAspectRatio = configuration.accessoryPadding.targetAspectRatio !== undefined ?
                configuration.accessoryPadding.targetAspectRatio : Number.NaN;

            callbacks.accessoryPaddingExpansionCallback =
                (rect: Rect, node: Node, tree: Topology, dissectionSpace: Array<Rect>,
                    accessorySpace: Array<Rect>) => {

                    const value = Layout.depthValue(padding, node.depth, 0.0);

                    if (value <= 0.0) {
                        accessorySpace[node.index] = new Rect(0, 0, 0, 0);
                        return rect;
                    }

                    const threshold = Layout.depthValue(relativeAreaThreshold, node.depth, 1.0);
                    let layoutRect = rect;
                    let accessoryRect = new Rect(0, 0, 0, 0);

                    switch (type) {
                        case Layout.AccessoryPaddingType.Absolute:
                            switch (direction) {
                                case Layout.AccessoryPaddingDirection.Bottom:
                                    layoutRect = new Rect(rect.left, rect.bottom - value,
                                        rect.right, rect.top);
                                    accessoryRect = new Rect(rect.left, rect.bottom - value,
                                        rect.right, rect.bottom);
                                    break;
                                case Layout.AccessoryPaddingDirection.Top:
                                    layoutRect = new Rect(rect.left, rect.bottom,
                                        rect.right, rect.top + value);
                                    accessoryRect = new Rect(rect.left, rect.top,
                                        rect.right, rect.top + value);
                                    break;
                                case Layout.AccessoryPaddingDirection.Left:
                                    layoutRect = new Rect(rect.left - value, rect.bottom,
                                        rect.right, rect.top);
                                    accessoryRect = new Rect(rect.left - value, rect.bottom,
                                        rect.left, rect.top);
                                    break;
                                case Layout.AccessoryPaddingDirection.Right:
                                    layoutRect = new Rect(rect.left, rect.bottom,
                                        rect.right + value, rect.top);
                                    accessoryRect = new Rect(rect.right, rect.bottom,
                                        rect.right + value, rect.top);
                                    break;
                                default:
                                    break;
                            }

                            if (rect.area / layoutRect.area <= threshold ||
                                accessoryRect.aspectRatio < targetAspectRatio) {

                                accessorySpace[node.index] = new Rect(0, 0, 0, 0);
                                return rect;
                            }
                            break;
                        case Layout.AccessoryPaddingType.Relative:
                            if (value >= 1.0) {
                                accessorySpace[node.index] = new Rect(0, 0, 0, 0);
                                return rect;
                            }

                            switch (direction) {
                                case Layout.AccessoryPaddingDirection.Bottom: {
                                    const accessoryHeight = rect.height / (1.0 - value) - rect.height;
                                    layoutRect = new Rect(rect.left, rect.bottom - accessoryHeight,
                                        rect.right, rect.top);
                                    accessoryRect = new Rect(rect.left, rect.bottom - accessoryHeight,
                                        rect.right, rect.bottom);
                                    break;
                                }
                                case Layout.AccessoryPaddingDirection.Top: {
                                    const accessoryHeight = rect.height / (1.0 - value) - rect.height;
                                    layoutRect = new Rect(rect.left, rect.bottom,
                                        rect.right, rect.top + accessoryHeight);
                                    accessoryRect = new Rect(rect.left, rect.top,
                                        rect.right, rect.top + accessoryHeight);
                                    break;
                                }
                                case Layout.AccessoryPaddingDirection.Left: {
                                    const accessoryWidth = rect.width / (1.0 - value) - rect.width;
                                    layoutRect = new Rect(rect.left - accessoryWidth, rect.bottom,
                                        rect.right, rect.top);
                                    accessoryRect = new Rect(rect.left - accessoryWidth, rect.bottom,
                                        rect.left, rect.top);
                                    break;
                                }
                                case Layout.AccessoryPaddingDirection.Right: {
                                    const accessoryWidth = rect.width / (1.0 - value) - rect.width;
                                    layoutRect = new Rect(rect.left, rect.bottom,
                                        rect.right + accessoryWidth, rect.top);
                                    accessoryRect = new Rect(rect.right, rect.bottom,
                                        rect.right + accessoryWidth, rect.top);
                                    break;
                                }
                                default:
                                    break;
                            }

                            if (rect.area / layoutRect.area <= threshold) {
                                accessorySpace[node.index] = new Rect(0, 0, 0, 0);
                                return rect;
                            }
                            break;
                        default:
                            break;
                    }

                    accessorySpace[node.index] = accessoryRect;
                    return layoutRect;
                };
        }

        return callbacks;
    }

    private static depthValue(value: number | Array<number>, depth: number, fallback: number): number {
        if (value instanceof Array) {
            return value.length > depth ? value[depth] : fallback;
        }

        return value as number;
    }
}

export namespace Layout {

    export enum LayoutAlgorithm {
        Strip = 'strip',
        Snake = 'snake',
        Hilbert = 'hilbert',
        Moore = 'moore',
        CodeCity = 'codecity',
    }

    export enum SiblingMarginType {
        Relative = 'relative',
        Absolute = 'absolute',
    }

    export enum ParentPaddingType {
        Relative = 'relative',
        Absolute = 'absolute',
        Mixed = 'mixed',
    }

    export enum AccessoryPaddingType {
        Relative = 'relative',
        Absolute = 'absolute',
    }

    export enum AccessoryPaddingDirection {
        Top = 'top',
        Bottom = 'bottom',
        Left = 'left',
        Right = 'right',
    }

}
