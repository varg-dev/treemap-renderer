
/* spellchecker: disable */

// import { auxiliaries } from 'webgl-operate';
// const assert = auxiliaries.assert;

/* spellchecker: enable */


/**
 * Axis-aligned Rectangle representation.
 */
export class Rect {

    /**
     * The four coordinates of a axis-aligned rectangle
     */
    protected _left: number;
    protected _right: number;
    protected _top: number;
    protected _bottom: number;

    /**
     * Orientation of the rectangle. Used to identify reversed rectangles for strip-inverted layouting.
     */
    orientation: Rect.Orientation | undefined;

    /**
     * Create a clone of the rectangle.
     *
     * @param rect - The rectangle to clone.
     */
    static clone(rect: Rect): Rect {
        return new Rect(rect.left, rect.bottom, rect.right, rect.top);
    }

    /**
     * Constructor.
     *
     * @param pos - The lower-left position.
     * @param extent - The vector to the upper-right position.
     * @param orientation - The orientation.
     */
    constructor(left: number, bottom: number, right: number, top: number,
        orientation?: Rect.Orientation) {
        /*
        Disable assertions for now

        // NaN checks
        assert(left === left, `left should not be NaN`);
        assert(right === right, `right should not be NaN`);
        assert(top === top, `top should not be NaN`);
        assert(bottom === bottom, `bottom should not be NaN`);

        assert(left >= 0 && left <= 0xFFFFFFFF, `left should be a non-negative integer`);
        assert(right >= 0 && right <= 0xFFFFFFFF, `right should be a non-negative integer`);
        assert(top >= 0 && top <= 0xFFFFFFFF, `top should be a non-negative integer`);
        assert(bottom >= 0 && bottom <= 0xFFFFFFFF, `bottom should be a non-negative integer`);

        assert(left <= right, `width should be a non-negative integer`);
        assert(bottom <= top, `height should be a non-negative integer`);
        */

        this._left = left;
        this._right = Math.max(right, left);
        this._bottom = bottom;
        this._top = Math.max(top, bottom);
        this.orientation = orientation;
    }


    /**
     * Return the area of the spanned rectangle.
     */
    get area(): number {
        return this.width * this.height;
    }

    /**
     * Return the center coordinates
     */
    get center(): [number, number] {
        return [(this._left + this._right) / 2.0, (this._bottom + this._top) / 2.0];
    }

    /**
     * Accessor for the length of the shorter side.
     */
    get shorterSide(): number {
        return Math.min(this.width, this.height);
    }

    /**
     * Accessor for the length of the longer side.
     */
    get longerSide(): number {
        return Math.max(this.width, this.height);
    }

    /**
     * Accessor for the inverse status regarding the rectangle orientation.
     */
    get isReversed(): boolean {
        if (this.orientation === undefined) {
            return false;
        }

        return this.orientation >= Rect.Orientation.DC;
    }

    /**
     * Return the top value of the rectangle.
     */
    get top(): number {
        return this._top;
    }

    set top(v: number) {
        // assert(v >= this.bottom, `Non-negative height expected`);

        this._top = Math.max(v, this._bottom);
    }

    /**
     * Return the left value of the rectangle.
     */
    get left(): number {
        return this._left;
    }

    set left(v: number) {
        // assert(v <= this.right, `Non-negative width expected`);

        this._left = Math.max(v, this._left);
    }

    /**
     * Return the right value of the rectangle.
     */
    get right(): number {
        return this._right;
    }

    set right(v: number) {
        // assert(v >= this.left, `Non-negative width expected`);

        this._right = Math.min(v, this._right);
    }

    /**
     * Return the bottom value of the rectangle.
     */
    get bottom(): number {
        return this._bottom;
    }

    set bottom(v: number) {
        // assert(v <= this.top, `Non-negative height expected`);

        this._bottom = Math.max(v, this._bottom);
    }

    /**
     * Return the width of the rectangle.
     */
    get width(): number {
        return this._right - this._left;
    }

    /**
     * Return the height of the rectangle.
     */
    get height(): number {
        return this._top - this._bottom;
    }

    /**
     * Return whether the rectangle is more wide than high.
     */
    get isHorizontal(): boolean {
        return this.width > this.height;
    }

    /**
     * Return whether the rectangle is more high than wide.
     */
    get isVertical(): boolean {
        return this.width <= this.height;
    }

    /**
     * Return a new rectangle covering the top x% of the current rectangle.
     *
     * @param percent - The fraction of the rectangle.
     */
    relativeTop(percent: number): Rect {
        return this.relativeRect(0.0, 1.0 - percent, 1.0, percent);
    }

    /**
     * Return a new rectangle covering the bottom part separated at top value in pos.
     *
     * @param pos - The vertical position to split the rectangle.
     */
    truncateTop(pos: number): Rect {
        // assert(pos <= this._top && pos >= this._bottom, `Expect new top to be within rectangle`);

        return new Rect(
            this._left,
            this._bottom,
            this._right,
            Math.max(Math.min(pos, this._top), this._bottom)
        );
    }

    /**
     * Return a new rectangle covering the left x% of the current rectangle.
     *
     * @param percent - The fraction of the rectangle.
     */
    relativeLeft(percent: number): Rect {
        return this.relativeRect(0.0, 0, percent, 1.0);
    }

    /**
     * Return a new rectangle covering the right part separated at left value in pos.
     *
     * @param pos - The horizontal position to split the rectangle.
     */
    truncateLeft(pos: number): Rect {
        // assert(pos <= this._right && pos >= this._left, `Expect new top to be within rectangle`);

        return new Rect(
            Math.min(Math.max(this._left, pos), this._right),
            this._bottom,
            this._right,
            this._top);
    }

    /**
     * Return a new rectangle covering the right x% of the current rectangle.
     *
     * @param percent - The fraction of the rectangle.
     */
    relativeRight(percent: number): Rect {
        return this.relativeRect(1.0 - percent, 0.0, percent, 1.0);
    }

    /**
     * Return a new rectangle covering the left part separated at right value in pos.
     *
     * @param pos - The horizontal position to split the rectangle.
     */
    truncateRight(pos: number): Rect {
        // assert(pos <= this._right && pos >= this._left, `Expect new top to be within rectangle`);

        return new Rect(
            this._left,
            this._bottom,
            Math.max(Math.min(pos, this._right), this._left),
            this._top
        );
    }

    /**
     * Return a new rectangle covering the bottom x% of the current rectangle.
     *
     * @param percent - The fraction of the rectangle.
     */
    relativeBottom(percent: number): Rect {
        return this.relativeRect(0.0, 0.0, 1.0, percent);
    }

    /**
     * Return a new rectangle covering the top part separated at bottom value in pos.
     *
     * @param pos - The vertical position to split the rectangle.
     */
    truncateBottom(pos: number): Rect {
        // assert(pos <= this._top && pos >= this._bottom, `Expect new top to be within rectangle`);

        return new Rect(
            this._left,
            Math.max(Math.min(pos, this._top), this._bottom),
            this._right,
            this._top
        );
    }

    applyOffset(x: number, y: number): void {
        this._left += x;
        this._right += x;
        this._top += y;
        this._bottom += y;
    }

    /**
     * Return a new rectangle identified by normalized rectangle applied of the current rectangle.
     *
     * @param position - The normalized position within the current rectangle.
     * @param extent - The normalized extent within the current rectangle.
     * @param orientation - An optional orientation that is passed to the new rectangle.
     */
    relativeRect(posX: number, posY: number, extX: number, extY: number,
        orientation?: Rect.Orientation): Rect {

        // Disable assertions for now
        // assert(posX >= 0.0 && posX <= 1.0, `Expect posX to be in [0, 1]`);
        // assert(posY >= 0.0 && posY <= 1.0, `Expect posY to be in [0, 1]`);
        // assert(extX >= 0.0 && extX <= 1.0, `Expect extX to be in [0, 1]`);
        // assert(extY >= 0.0 && extY <= 1.0, `Expect extY to be in [0, 1]`);
        // assert(posX + extX <= 1.0, `Final width must not exceed given width`);
        // assert(posY + extY <= 1.0, `Final height must not exceed given height`);

        const newLeft = this._left + posX * this.width;
        const newBottom = this._bottom + posY * this.height;
        const newRight = Math.min(newLeft + extX * this.width, this._right);
        const newTop = Math.min(newBottom + extY * this.height, this._top);

        return new Rect(newLeft, newBottom, newRight, newTop, orientation);
    }

    /**
     * Compute a margin that approximates the target absolute margin, taking a minimum relative area
     * and thus, a relative margin into account. The computed margin will be equal for all four sides
     * of the rectangle.
     * @param absoluteMargin - The target absolute margin.
     * @param minRelativeArea - Minimum relative area that must remain after applying the margin return
     * by this function.
     * @param relativeMargin - The relative margin that is used if the absolute margin cannot be
     * applied without falling under the minimum relative area.
     */
    equalizedMargin(absoluteMargin: number, minRelativeArea: number, relativeMargin: number): number {
        if (this.area <= 0.0) {
            return 0.0;
        }

        let result = absoluteMargin;

        const marginArea = 2 * this.width * absoluteMargin
            + 2 * this.height * absoluteMargin
            - 4 * absoluteMargin * absoluteMargin;

        if (marginArea < 0 || marginArea / this.area >= minRelativeArea
            || this.shorterSide < 2 * absoluteMargin) {

            // let equalizedRelativeMargin = this.equalizedRelativeMargin(relativeMargin);
            // if (equalizedRelativeMargin > absoluteMargin) {

            // console.warn('With the given relative margin of', relativeMargin,
            //     ', the equalized relative margin of', equalizedRelativeMargin,
            //     'is GREATER than the absolute margin of', absoluteMargin,
            //     ', the latter being already too large.');

            /* calculate margin that would fit */
            let targetMargin;
            const targetMinAbsoluteArea = this.area * minRelativeArea * 0.99;
            const p2 = 0.25 * (this.width + this.height);
            const q = 0.25 * targetMinAbsoluteArea;
            const radicand = p2 * p2 - q;

            if (radicand <= 0) {
                targetMargin = p2;
            } else {
                const sqrt = Math.sqrt(radicand);
                const targetMargin1 = p2 + sqrt;
                const targetMargin2 = p2 - sqrt;
                targetMargin = Math.min(targetMargin1, targetMargin2);
                /* targetMargin should not be below zero... but you never know */
                targetMargin = targetMargin < 0 ? 0.0 : targetMargin;
            }

            // } // end if

            // assert(targetMargin < result,
            //     `expected ${targetMargin} to be smaller than ${result}`);

            result = Math.min(targetMargin, result);
        }

        return result;
    }

    /**
     *
     * @param relativeMargin The relative rect area that should be occupied by the margin.
     */
    equalizedRelativeMargin(relativeMargin: number): number {
        if (this.area <= 0.0) {
            return 0.0;
        }

        const targetArea = this.area * (1.0 - relativeMargin);
        const ratio = this.width / this.height;
        const a = Math.sqrt(targetArea * ratio);
        const b = Math.sqrt(targetArea / ratio);

        const dArea = this.area - targetArea;

        const p = -(a + b) * 0.5;
        const q = dArea * 0.25;
        const D = p * p * 0.25 - q;
        const sqrtD = D < 0.0 ? 0.0 : Math.sqrt(D);

        const d1 = -p * 0.5 + sqrtD;
        const d2 = -p * 0.5 - sqrtD;

        return d1 < 0 || d2 < 0 ? Math.max(d1, d2) : Math.min(d1, d2);
    }

    /**
     * Applies an absolute margin and returns the new rectangle.
     *
     * @param padding - The absolute padding in rectangle coordinates.
     */
    padded(padding: number): Rect {
        // assert(this.width >= 2 * padding, `Padding exceeds width of rectangle`);
        // assert(this.height >= 2 * padding, `Padding exceeds height of rectangle`);
        if (this.width < 2 * padding || this.height < 2 * padding) {
            return new Rect(this.left, this.bottom, this.left, this.bottom);
        }

        return new Rect(this.left + padding, this.bottom + padding,
            this.right - padding, this.top - padding);
    }

    /**
     * Applies an absolute margin and returns the new rectangle
     * if it doesn't get smaller than minArea percent of the original size.
     *
     * @param padding - The absolute padding in rectangle coordinates.
     * @param minArea - The percentage of the minimum remaining area.
     */
    paddedWithMinArea(padding: number, minArea: number): Rect {
        if (padding <= 0.0) {
            return this.padded(padding);
        }

        const marginSpace = 2 * this.width * padding
            + 2 * this.height * padding
            - 4 * padding * padding;

        const targetPercentage = 1.0 - marginSpace / this.area;

        if (targetPercentage >= minArea && this.shorterSide > 4.0 * padding) {
            return this.padded(padding);
        }

        return this.padded(this.shorterSide / 4.0)
            .relativePadded(Math.max(0.0, 1.0 - padding / (4.0 * this.shorterSide)));
    }

    /**
     * Applies relative margin and returns the new rectangle.
     *
     * @param padding - The relative padding in percentage.
     */
    relativePadded(padding: number): Rect {
        const halfPadding = padding / 2.0;
        return this.relativeRect(halfPadding, halfPadding, 1.0 - padding, 1.0 - padding);
    }

    /**
     * Interpret the current rectangle in relation to the source rectangle and apply the normalized
     * coordinates to the target rectangle.
     * @param source - The source rectangle.
     * @param target - The target rectangle.
     */
    map(source: Rect, target: Rect): Rect {
        const newLeft = (this.left - source.left) / source.width * target.width + target.left;
        const newRight = target.right - (source.right - this.right) / source.width * target.width;
        const newTop = target.top - (source.top - this.top) / source.height * target.height;
        const newBottom = (this.bottom - source.bottom) / source.height * target.height + target.bottom;

        return new Rect(newLeft, newBottom, newRight, newTop);
    }

    /**
     * Extend the current rectangle to fully include the target rectangle.
     *
     * @param target - The rectangle to include into the current rectangle.
     */
    enclose(target: Rect): void {
        const left = Math.min(this.left, target.left);
        const top = Math.max(this.top, target.top);
        const right = Math.max(this.right, target.right);
        const bottom = Math.min(this.bottom, target.bottom);

        this._left = left;
        this._right = right;
        this._top = top;
        this._bottom = bottom;
    }

    /**
     * Tests two rectangles for intersection.
     *
     * @return true if they intersect.
     */
    intersects(other: Rect): boolean {
        if (other.left + Number.EPSILON >= this.right) {
            return false;
        }
        if (other.right <= this.left + Number.EPSILON) {
            return false;
        }
        if (other.top <= this.bottom + Number.EPSILON) {
            return false;
        }
        if (other.bottom + Number.EPSILON >= this.top) {
            return false;
        }

        return true;
    }

    /**
     * Tests if a rectangle is completely comprised by this.
     *
     * @return true if is comprised by this.
     */
    comprises(other: Rect): boolean {
        return this.left - Number.EPSILON <= other.left + Number.EPSILON &&
            this.right + Number.EPSILON >= other.right - Number.EPSILON &&
            this.bottom - Number.EPSILON <= other.bottom + Number.EPSILON &&
            this.top + Number.EPSILON >= other.top - Number.EPSILON;
    }

    /**
     * @return the aspect ratio of the rectangle.
     */
    get aspectRatio(): number {
        return this.width / this.height;
    }

    /**
     * Move the rectangle so that its center is aligned with the given point
     *
     * @param targetCenter - the coordinate of the target center
     *
     * @return the offset
     */
    centerAround(targetCenter: [number, number]): void {
        const center = this.center;
        const offset = [targetCenter[0] - center[0], targetCenter[1] - center[1]];

        this.applyOffset(offset[0], offset[1]);
    }
}


export namespace Rect {

    /**
     * Rectangle orientation. Used to identify reversed rectangles for strip-inverted layouting.
     */
    export enum Orientation { CD, AC, BA, DB, DC, CA, AB, BD }

}
