
/* spellchecker: disable */

import { auxiliaries } from 'webgl-operate';
const assert = auxiliaries.assert;

import { Configuration } from './configuration';
import { Node } from './node';
import { Rect } from './rect';
import { Row } from './row';
import { Topology } from './topology';

/* spellchecker: enable */


/**
 * Extension to the row to handle 4-directional row layouting.
 *
 * This actual implementation implements interfaces to handle:
 * - Strip Inverted Layouting (continuous arrangement, performance-optimized)
 */
export class DirectionalRow extends Row {

    /**
     * Flag to indicate whether the current direction has to be treated reversed:
     * - horizontal would be right-to-left instead of left-to-right
     * - vertical would be top-to-bottom instead of bottom-to-top
     */
    protected _reverse: boolean;

    /**
     * Flag to indicate whether the parent rectangle is reversed, resulting in an inverted reversed
     * flag for this row.
     */
    protected _parentReverse: boolean;

    /**
     * Constructor.
     *
     * @param tree - The tree.
     * @param weights - The array of weights.
     * @param availableSpace - The overall space in which the row may be layed out (usually the parent
     * node layout).
     * @param availableWeight - The overall weight all children may use (usually the sum of all child
     * weights, a.k.a. the parent weight).
     * @param horizontal - The direction for layout.
     * @param reverse - The reversed flag for the row.
     * @param parentReverse - The reversed flag for the parent.
     */
    constructor(tree: Topology, weights: Configuration.AttributeBuffer, availableSpace: Rect,
        availableWeight: number, horizontal: boolean, reverse: boolean, parentReverse: boolean) {

        super(tree, weights, availableSpace, availableWeight, horizontal);

        this._reverse = reverse;
        this._parentReverse = parentReverse;
    }

    /**
     * Accessor for reversed flag.
     */
    get reverse(): boolean {
        return this._reverse;
    }

    /**
     * Setter for reversed flag.
     * @param reverse - The new reverse flag value.
     */
    set reverse(reverse: boolean) {
        this._reverse = reverse;
    }

    /**
     * Accessor for parent reverse flag.
     */
    get parentReverse(): boolean {
        return this._parentReverse;
    }

    /**
     * Setter for parent reversed flag.
     * @param reverse - The new reverse flag value.
     */
    set parentReverse(reverse: boolean) {
        this._parentReverse = reverse;
    }

    /**
     * Specialization to write layouts of nodes in the current row to layout array, regarding reversed
     * layouting directions.
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
        const rectOrientation = this._reverse ? Rect.Orientation.DC : Rect.Orientation.CD;

        if (this._horizontal) {
            if (this._parentReverse) {
                let right = currentRect.right;
                this._tree.siblingsRangeDo(this._firstChild, this._lastChild, (current: Node) => {
                    const weight = this._weights[current.index] as number;
                    const length = currentRect.width * weight / this._childrenWeight;
                    const left = Math.max(right - length, currentRect.left);

                    layout[current.index] = new Rect(
                        left, currentRect.bottom, right, currentRect.top, rectOrientation);

                    assert(this._availableSpace.comprises(layout[current.index]),
                        `Expect that child rect is within parent rect`);

                    right = left;
                });
            } else {
                let left = currentRect.left;
                this._tree.siblingsRangeDo(this._firstChild, this._lastChild, (current: Node) => {
                    const weight = this._weights[current.index] as number;
                    const length = currentRect.width * weight / this._childrenWeight;
                    const right = Math.min(left + length, currentRect.right);

                    layout[current.index] = new Rect(
                        left, currentRect.bottom, right, currentRect.top, rectOrientation);

                    assert(this._availableSpace.comprises(layout[current.index]),
                        `Expect that child rect is within parent rect`);

                    left = right;
                });
            }
        } else {
            if (this._parentReverse) {
                let top = currentRect.top;
                this._tree.siblingsRangeDo(this._firstChild, this._lastChild, (current: Node) => {
                    const weight = this._weights[current.index] as number;
                    const length = currentRect.height * weight / this._childrenWeight;
                    const bottom = Math.max(top - length, currentRect.bottom);

                    layout[current.index] = new Rect(
                        currentRect.left, bottom, currentRect.right, top, rectOrientation);

                    assert(this._availableSpace.comprises(layout[current.index]),
                        `Expect that child rect is within parent rect`);

                    top = bottom;
                });
            } else {
                let bottom = currentRect.bottom;
                this._tree.siblingsRangeDo(this._firstChild, this._lastChild, (current: Node) => {
                    const weight = this._weights[current.index] as number;
                    const length = currentRect.height * weight / this._childrenWeight;
                    const top = Math.min(bottom + length, currentRect.top);

                    layout[current.index] = new Rect(
                        currentRect.left, bottom, currentRect.right, top, rectOrientation);

                    assert(this._availableSpace.comprises(layout[current.index]),
                        `Expect that child rect is within parent rect`);

                    bottom = top;
                });
            }
        }
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
            if (this._parentReverse) {
                const pos = this._availableSpace.top - fraction * this._availableSpace.height;
                return this._availableSpace.truncateBottom(pos);
            } else {
                const pos = this._availableSpace.bottom + fraction * this._availableSpace.height;
                return this._availableSpace.truncateTop(pos);
            }
        } else {
            if (this._parentReverse) {
                const pos = this._availableSpace.right - fraction * this._availableSpace.width;
                return this._availableSpace.truncateLeft(pos);
            } else {
                const pos = this._availableSpace.left + fraction * this._availableSpace.width;
                return this._availableSpace.truncateRight(pos);
            }
        }
    }

    /**
     * Specialization for the remaining weight for the remaining child nodes, regarding reversed
     * layouting directions.
     */
    get remainingSpace(): Rect {
        if (this.isDisabled) {
            return this._availableSpace.truncateBottom(this._availableSpace.top);
        }

        const fraction = Math.min(this._childrenWeight / this._availableWeight, 1.0);

        if (this._horizontal) {
            if (this._parentReverse) {
                const pos = this._availableSpace.top - fraction * this._availableSpace.height;
                return this._availableSpace.truncateTop(pos);
            } else {
                const pos = this._availableSpace.bottom + fraction * this._availableSpace.height;
                return this._availableSpace.truncateBottom(pos);
            }
        } else {
            if (this._parentReverse) {
                const pos = this._availableSpace.right - fraction * this._availableSpace.width;
                return this._availableSpace.truncateRight(pos);
            } else {
                const pos = this._availableSpace.left + fraction * this._availableSpace.width;
                return this._availableSpace.truncateLeft(pos);
            }
        }
    }

    /**
     * Specialization to prepare the next row. Basically, the next row layouts in reverse direction
     * to the current row.
     * @param horizontal - The new layout direction.
     */
    next(horizontal: boolean): void {
        super.next(horizontal);

        this._reverse = !this._reverse;
    }
}
