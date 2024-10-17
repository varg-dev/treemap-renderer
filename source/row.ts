
/* spellchecker: disable */

import { auxiliaries } from 'webgl-operate';
const assert = auxiliaries.assert;

import { Configuration } from './configuration';
import { Node } from './node';
import { Rect } from './rect';
import { Topology } from './topology';

/* spellchecker: enable */


/**
 * An abstraction class to ease splitting treemap layouting implementations.
 *
 * This actual implementation implements interfaces to handle:
 * - Strip Layouting (performance-optimized)
 */
export class Row {

    // General row attributes

    /**
     * The current tree, used to perform node lookups.
     */
    protected _tree: Topology;

    /**
     * The array of weights for each node.
     */
    protected _weights: Configuration.AttributeBuffer;

    /**
     * The rectangle to lay out the nodes.
     */
    protected _availableSpace: Rect;

    /**
     * The maximum weight associated with the rectangle.
     */
    protected _availableWeight: number;

    /**
     * The direction of layout ('true' indicates horizontal layouting, 'false' for vertical).
     */
    protected _horizontal: boolean;

    /**
     * Reference to the first node of the current row.
     */
    protected _firstChild: Node | undefined;

    /**
     * Reference to the element after the last node of the current row (cf. end iterator of, e.g., C++).
     */
    protected _lastChild: Node | undefined;

    // Strip (Inverted) specific attributes

    /**
     * Number of children already inserted into the current row.
     */
    protected _insertedChildrenCount: number;

    /**
     * Number of children already inserted into the current and all former rows of the parent.
     */
    protected _overallChildrenCount: number;

    /**
     * Associated weight of the parent node.
     */
    protected _parentWeight: number;

    /**
     * Sum of associated weights of all nodes in the current row.
     */
    protected _childrenWeight: number;

    /**
     * Sum of associated weights of all nodes in the current and all former rows of the parent.
     */
    protected _overallChildrenWeight: number;

    /**
     * Compute the aspect ratio of a rectangle, represented by a primary extent and a fraction of it and
     * a secondary extent.
     * @param fraction - The fraction of the primary extent.
     * @param primaryExtent - The primary extent.
     * @param secondaryExtent - The secondary extent.
     * @return The (normalized) aspect ratio of the rectangle (in open range [1.0, infinity)).
     */
    protected static aspectRatio(
        fraction: number, primaryExtent: number, secondaryExtent: number): number {

        const a = fraction * primaryExtent;
        const b = secondaryExtent;

        return a > b ? a / b : b / a;
    }

    /**
     * Constructor.
     *
     * @param tree - The tree.
     * @param weights - The array of weights.
     * @param availableSpace - Overall space in which the row may be layed out (usually parent layout).
     * @param availableWeight - Overall weight all children may use (usually sum of all child weights,
     *     a.k.a. the parent weight).
     * @param horizontal - The direction for layout.
     */
    constructor(tree: Topology, weights: Configuration.AttributeBuffer,
        availableSpace: Rect, availableWeight: number, horizontal: boolean) {
        this._tree = tree;
        this._weights = weights;
        this._availableSpace = availableSpace;
        this._availableWeight = availableWeight;
        this._horizontal = horizontal;
        this._insertedChildrenCount = 0;
        this._overallChildrenCount = 0;
        this._parentWeight = availableWeight;
        this._childrenWeight = 0.0;
        this._overallChildrenWeight = 0.0;
    }

    /**
     * Compute optimized average aspect ratio using an optional additional weight.
     *
     * @param additionalWeight - The additional weight (usually the weight of the next node).
     *
     * This implementation uses the performance-optimized average-aspect-ratio computation.
     * An actual implementation would require a re-iteration over all children each time.
     */
    protected optimizedAverageAspectRatio(additionalWeight?: number): number {
        if (additionalWeight) {
            const weightSum = Math.min(this._childrenWeight + additionalWeight, this._availableWeight);
            const weightFactor = Math.min(weightSum / this._availableWeight, 1.0);

            const primaryExtent = this._horizontal ?
                this._availableSpace.width : this._availableSpace.height;
            const secondaryExtent = (this._horizontal ?
                this._availableSpace.height : this._availableSpace.width) * weightFactor;

            return Row.aspectRatio(1.0 / (this._insertedChildrenCount + 1),
                primaryExtent, secondaryExtent);

        } else {
            const weightSum = this._childrenWeight;
            const weightFactor = Math.min(weightSum / this._availableWeight, 1.0);

            const primaryExtent = this._horizontal ?
                this._availableSpace.width : this._availableSpace.height;
            const secondaryExtent = (this._horizontal
                ? this._availableSpace.height : this._availableSpace.width) * weightFactor;

            return Row.aspectRatio(1.0 / this._insertedChildrenCount, primaryExtent, secondaryExtent);
        }
    }

    /**
     * Insert node into row.
     *
     * The next node must be the successor of the previously inserted node to ensure correct layout.
     *
     * @param node - The next node.
     * @param weight - The associated weight of the node.
     */
    insert(node: Node, weight: number): void {
        if (!this._firstChild) {
            this._firstChild = node;
        }

        assert(this._lastChild === undefined || this._lastChild === node,
            `Next node invariant not held.`);

        this._lastChild = this._tree.node(node.nextSibling);

        // handle weight being near to 0.0 errors
        if (weight > Number.EPSILON) {
            this._childrenWeight = Math.min(this._childrenWeight + weight, this._availableWeight);
            this._overallChildrenWeight = Math.min(
                this._overallChildrenWeight + weight, this._parentWeight);
            this._insertedChildrenCount += 1;
        }
    }

    /**
     * Write layouts of nodes in the current row to layout array.
     *
     * @param layout - The target layout array (output parameter).
     */
    layoutNodes(layout: Array<Rect>): void {
        if (this._firstChild === undefined) {
            return;
        }

        if (this.isDisabled) {
            this._tree.siblingsRangeDo(this._firstChild, this._lastChild, (current: Node) => {
                layout[current.index] = new Rect(
                    this._availableSpace.left,
                    this._availableSpace.bottom,
                    this._availableSpace.left,
                    this._availableSpace.bottom);
            });

            return;
        }

        const currentRect = this.currentSpace;

        if (this._horizontal) {
            let left = currentRect.left;
            this._tree.siblingsRangeDo(this._firstChild, this._lastChild, (current: Node) => {
                const weight = this._weights[current.index] as number;
                const length = currentRect.width * weight / this._childrenWeight;
                const right = Math.min(left + length, currentRect.right);

                layout[current.index] = new Rect(left, currentRect.bottom, right, currentRect.top);

                assert(this._availableSpace.comprises(layout[current.index]),
                    `Expect that child rect is within parent rect`);

                left = right;
            });
        } else {
            let bottom = currentRect.bottom;
            this._tree.siblingsRangeDo(this._firstChild, this._lastChild, (current: Node) => {
                const weight = this._weights[current.index] as number;
                const length = currentRect.height * weight / this._childrenWeight;
                const top = Math.min(bottom + length, currentRect.top);

                layout[current.index] = new Rect(currentRect.left, bottom, currentRect.right, top);

                assert(this._availableSpace.comprises(layout[current.index]),
                    `Expect that child rect is within parent rect`);

                bottom = top;
            });
        }
    }

    /**
     * Check for row validity. Invalid rows have either no remaining weight or space.
     */
    get isDisabled(): boolean {
        return this._availableWeight <= 0.0
            || this._availableSpace.width <= 0.0
            || this._availableSpace.height <= 0.0;
    }

    /**
     * Accessor for the available weight for the child nodes.
     */
    get availableWeight(): number {
        return this._availableWeight;
    }

    /**
     * Accessor for the remaining weight for the remaining child nodes.
     */
    get remainingWeight(): number {
        return this.isDisabled
            ? 0.0
            : Math.max(this._parentWeight - this._overallChildrenWeight, 0.0);
    }

    /**
     * Accessor for the available space for the child nodes.
     */
    get availableSpace(): Rect {
        return this._availableSpace;
    }

    get currentSpace(): Rect {
        if (this.isDisabled) {
            return this._availableSpace.truncateBottom(this._availableSpace.top);
        }

        if (this._childrenWeight >= this._availableWeight || this._lastChild === undefined) {
            return Rect.clone(this.availableSpace);
        }

        const fraction = this._childrenWeight / this._availableWeight;

        if (this._horizontal) {
            const pos = this._availableSpace.bottom + fraction * this._availableSpace.height;
            return this._availableSpace.truncateTop(pos);
        } else {
            const pos = this._availableSpace.left + fraction * this._availableSpace.width;
            return this._availableSpace.truncateRight(pos);
        }
    }

    /**
     * Get remaining space under the assumption all nodes of the current row are layed out.
     */
    get remainingSpace(): Rect {
        if (this.isDisabled) {
            return this._availableSpace.truncateBottom(this._availableSpace.top);
        }

        const fraction = Math.min(this._childrenWeight / this._availableWeight, 1.0);

        if (this._horizontal) {
            const pos = this._availableSpace.bottom + fraction * this._availableSpace.height;
            return this._availableSpace.truncateBottom(pos);
        } else {
            const pos = this._availableSpace.left + fraction * this._availableSpace.width;
            return this._availableSpace.truncateLeft(pos);
        }
    }

    /**
     * Accessor for the layout direction.
     */
    get isHorizontal(): boolean {
        return this._horizontal;
    }

    /**
     * This implementation uses the performance-optimized average-aspect-ratio computation.
     * An actual implementation would require a re-iteration over all children each time.
     * @param additionalWeight - The additional weight (usually the weight of the next node).
     * @return 'true' if the additional weight would increase the average aspect ratio, else 'false'.
     */
    increasesAverageAspectRatio(additionalWeight: number): boolean {
        if (this.isDisabled || this._firstChild === undefined || additionalWeight <= Number.EPSILON) {
            return false;
        }
        const optimizedRatio = this.optimizedAverageAspectRatio(additionalWeight);
        return optimizedRatio > this.optimizedAverageAspectRatio() + Number.EPSILON;
    }

    /**
     * Assume current row as finished and prepare this instance to represent the remaining space as
     * starting point of the next row.
     * @param horizontal - The new layout direction.
     */
    next(horizontal: boolean): void {
        const remainingSpace = this.remainingSpace;

        assert(this._availableSpace.comprises(remainingSpace),
            `Remaining Space should not exceed available space`);

        this._availableSpace = remainingSpace;
        this._availableWeight = this.remainingWeight;
        this._horizontal = horizontal;
        this._firstChild = undefined;
        this._lastChild = undefined;
        this._insertedChildrenCount = 0;
        this._childrenWeight = 0.0;
    }
}
