/* spellchecker: disable */

// import { auxiliaries } from 'webgl-operate';
// const assert = auxiliaries.assert;

/* spellchecker: enable */


/**
 * Axis-aligned Rectangle representation.
 */
export class Rect {

    /**
     * The four coordinates of an axis-aligned rectangle.
     */
    protected _left: number;
    protected _right: number;
    protected _top: number;
    protected _bottom: number;

    private _rotation: number = Rect.Rotation.R000;
    private _curve: number = Rect.CurveOrientation.CW;

    /**
     * Derive enum orientation from canonical frame state.
     */
    private static orientationFromFrame(rotation: number, curve: number): Rect.Orientation {
        return (curve * 4 + rotation) as Rect.Orientation;
    }

    /**
     * Derive canonical frame state from enum orientation.
     */
    private static frameFromOrientation(orientation: Rect.Orientation | undefined):
        { rotation: number; curve: number } | undefined {
        if (orientation === undefined) {
            return undefined;
        }

        const value = orientation as number;
        return {
            rotation: value % 4,
            curve: Math.floor(value / 4),
        };
    }

    /**
     * Create a clone of the rectangle.
     *
     * @param rect - The rectangle to clone.
     */
    static clone(rect: Rect): Rect {
        const clone = new Rect(rect.left, rect.bottom, rect.right, rect.top, rect.orientation);
        clone._rotation = rect._rotation;
        clone._curve = rect._curve;
        return clone;
    }

    /**
     * Constructor.
     *
     * @param left - Left coordinate.
     * @param bottom - Bottom coordinate.
     * @param right - Right coordinate.
     * @param top - Top coordinate.
     * @param orientation - Optional orientation.
     */
    constructor(left: number, bottom: number, right: number, top: number,
        orientation?: Rect.Orientation) {
        this._left = left;
        this._right = Math.max(right, left);
        this._bottom = bottom;
        this._top = Math.max(top, bottom);
        if (orientation !== undefined) {
            this.orientation = orientation;
        }
    }

    private inheritMeta(target: Rect): Rect {
        target._rotation = this._rotation;
        target._curve = this._curve;
        return target;
    }

    /**
     * Return the area of the spanned rectangle.
     */
    get area(): number {
        return this.width * this.height;
    }

    /**
     * Return the center coordinates.
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
        return this._curve === Rect.CurveOrientation.CCW;
    }

    /**
     * Compatibility accessor exposing frame state as orientation enum.
     */
    get orientation(): Rect.Orientation {
        return Rect.orientationFromFrame(this._rotation, this._curve);
    }

    set orientation(orientation: Rect.Orientation) {
        const frame = Rect.frameFromOrientation(orientation);
        if (frame === undefined) {
            return;
        }

        this._rotation = frame.rotation;
        this._curve = frame.curve;
    }

    /**
     * Return the top value of the rectangle.
     */
    get top(): number {
        return this._top;
    }

    set top(v: number) {
        this._top = Math.max(v, this._bottom);
    }

    /**
     * Return the left value of the rectangle.
     */
    get left(): number {
        return this._left;
    }

    set left(v: number) {
        this._left = Math.min(v, this._right);
    }

    /**
     * Return the right value of the rectangle.
     */
    get right(): number {
        return this._right;
    }

    set right(v: number) {
        this._right = Math.max(v, this._left);
    }

    /**
     * Return the bottom value of the rectangle.
     */
    get bottom(): number {
        return this._bottom;
    }

    set bottom(v: number) {
        this._bottom = Math.min(v, this._top);
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

    isValid(): boolean {
        return !isNaN(this._left) && !isNaN(this._bottom) && !isNaN(this._right) && !isNaN(this._top);
    }

    isEmpty(): boolean {
        return this.width === 0 || this.height === 0;
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
        return this.inheritMeta(new Rect(
            this._left,
            this._bottom,
            this._right,
            Math.max(Math.min(pos, this._top), this._bottom)
        ));
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
        return this.inheritMeta(new Rect(
            Math.min(Math.max(this._left, pos), this._right),
            this._bottom,
            this._right,
            this._top));
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
        return this.inheritMeta(new Rect(
            this._left,
            this._bottom,
            Math.max(Math.min(pos, this._right), this._left),
            this._top
        ));
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
        return this.inheritMeta(new Rect(
            this._left,
            Math.max(Math.min(pos, this._top), this._bottom),
            this._right,
            this._top
        ));
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
     * @param posX - Normalized x position.
     * @param posY - Normalized y position.
     * @param extX - Normalized x extent.
     * @param extY - Normalized y extent.
     * @param orientation - Optional orientation that is passed to the new rectangle.
     */
    relativeRect(posX: number, posY: number, extX: number, extY: number,
        orientation?: Rect.Orientation): Rect;

    /**
     * Return a new rectangle identified by normalized position/extent vectors.
     *
     * @param position - Normalized position.
     * @param extent - Normalized extent.
     */
    relativeRect(position: { x: number; y: number }, extent: { x: number; y: number }): Rect;

    relativeRect(
        arg0: number | { x: number; y: number },
        arg1: number | { x: number; y: number },
        arg2?: number,
        arg3?: number,
        orientation?: Rect.Orientation): Rect {

        let posX: number;
        let posY: number;
        let extX: number;
        let extY: number;

        if (typeof arg0 === 'number' && typeof arg1 === 'number'
            && typeof arg2 === 'number' && typeof arg3 === 'number') {
            posX = arg0;
            posY = arg1;
            extX = arg2;
            extY = arg3;
        } else if (typeof arg0 === 'object' && typeof arg1 === 'object') {
            posX = arg0.x;
            posY = arg0.y;
            extX = arg1.x;
            extY = arg1.y;
        } else {
            throw new Error('Invalid relativeRect arguments');
        }

        const newLeft = this._left + posX * this.width;
        const newBottom = this._bottom + posY * this.height;
        const newRight = Math.min(newLeft + extX * this.width, this._right);
        const newTop = Math.min(newBottom + extY * this.height, this._top);

        const rect = new Rect(newLeft, newBottom, newRight, newTop);
        if (orientation !== undefined) {
            rect.orientation = orientation;
            return rect;
        }

        return this.inheritMeta(rect);
    }

    /**
     * Compute a margin that approximates the target absolute margin, taking a minimum relative area
     * and thus, a relative margin into account. The computed margin will be equal for all four sides
     * of the rectangle.
     * @param absoluteMargin - The target absolute margin.
     * @param minRelativeArea - Minimum relative area that must remain after applying the margin.
     * @param relativeMargin - Relative margin fallback if absolute margin is too large.
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

            const targetMinAbsoluteArea = this.area * minRelativeArea * 0.99;
            const p2 = 0.25 * (this.width + this.height);
            const q = 0.25 * targetMinAbsoluteArea;
            const radicand = p2 * p2 - q;

            let targetMargin: number;
            if (radicand <= 0) {
                targetMargin = p2;
            } else {
                const sqrt = Math.sqrt(radicand);
                const targetMargin1 = p2 + sqrt;
                const targetMargin2 = p2 - sqrt;
                targetMargin = Math.min(targetMargin1, targetMargin2);
                targetMargin = targetMargin < 0 ? 0.0 : targetMargin;
            }

            result = Math.min(targetMargin, result);
        }

        return result;
    }

    /**
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
        if (this.width < 2 * padding || this.height < 2 * padding) {
            return this.inheritMeta(new Rect(this.left, this.bottom, this.left, this.bottom, this.orientation));
        }

        return this.inheritMeta(new Rect(this.left + padding, this.bottom + padding,
            this.right - padding, this.top - padding, this.orientation));
    }

    /**
     * Applies absolute paddings and returns the new rectangle.
     */
    paddedLTRB(top: number, right: number, bottom: number, left: number): Rect {
        return this.inheritMeta(new Rect(
            this.left + left,
            this.bottom + bottom,
            Math.max(this.right - right, this.left + left),
            Math.max(this.top - top, this.bottom + bottom),
            this.orientation));
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

        return this.inheritMeta(new Rect(newLeft, newBottom, newRight, newTop, this.orientation));
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

    contains(other: Rect): boolean {
        return this.left <= other.left &&
            this.right >= other.right &&
            this.top >= other.top &&
            this.bottom <= other.bottom;
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

    merged(other: Rect): Rect {
        const left = Math.min(this.left, other.left);
        const bottom = Math.min(this.bottom, other.bottom);
        const right = Math.max(this.right, other.right);
        const top = Math.max(this.top, other.top);
        return this.inheritMeta(new Rect(left, bottom, right, top, this.orientation));
    }

    intersection(other: Rect): Rect {
        const iLeft = Math.max(this.left, other.left);
        const iBottom = Math.max(this.bottom, other.bottom);
        const iTop = Math.min(this.top, other.top);
        const iRight = Math.min(this.right, other.right);
        return this.inheritMeta(new Rect(iLeft, iBottom, Math.max(iRight, iLeft), Math.max(iTop, iBottom), this.orientation));
    }

    topLeft(): { x: number; y: number } {
        return { x: this.left, y: this.top };
    }

    topRight(): { x: number; y: number } {
        return { x: this.right, y: this.top };
    }

    bottomLeft(): { x: number; y: number } {
        return { x: this.left, y: this.bottom };
    }

    bottomRight(): { x: number; y: number } {
        return { x: this.right, y: this.bottom };
    }

    topCenter(): { x: number; y: number } {
        return { x: this.left + this.width / 2, y: this.top };
    }

    bottomCenter(): { x: number; y: number } {
        return { x: this.left + this.width / 2, y: this.bottom };
    }

    leftCenter(): { x: number; y: number } {
        return { x: this.left, y: this.bottom + this.height / 2 };
    }

    rightCenter(): { x: number; y: number } {
        return { x: this.right, y: this.bottom + this.height / 2 };
    }

    /**
     * @return the aspect ratio of the rectangle.
     */
    get aspectRatio(): number {
        return this.width / this.height;
    }

    /**
     * Move the rectangle so that its center is aligned with the given point.
     *
     * @param targetCenter - the coordinate of the target center.
     */
    centerAround(targetCenter: [number, number]): void {
        const center = this.center;
        const offset = [targetCenter[0] - center[0], targetCenter[1] - center[1]];

        this.applyOffset(offset[0], offset[1]);
    }

    rotation(): number {
        return this._rotation;
    }

    curveDirection(): number {
        return this._curve;
    }

    setCurveDirection(dir: number): void {
        this._curve = (this._curve + dir) % 2;
        if (this._curve < 0) {
            this._curve += 2;
        }
    }

    rotate(r: number): void {
        this._rotation = (this._rotation + r) % 4;
        if (this._rotation < 0) {
            this._rotation += 4;
        }
    }

    private horizontalSplitImpl(xCut: number): [Rect, Rect] {
        const clampedCut = Math.max(0, Math.min(xCut, 1));
        const split = this.left + this.width * clampedCut;

        const left = this.inheritMeta(new Rect(this.left, this.bottom, split, this.top, this.orientation));
        const right = this.inheritMeta(new Rect(split, this.bottom, this.right, this.top, this.orientation));

        return [left, right];
    }

    private verticalSplitImpl(yCut: number): [Rect, Rect] {
        const clampedCut = Math.max(0, Math.min(yCut, 1));
        const split = this.bottom + this.height * clampedCut;

        const bottom = this.inheritMeta(new Rect(this.left, this.bottom, this.right, split, this.orientation));
        const top = this.inheritMeta(new Rect(this.left, split, this.right, this.top, this.orientation));

        return [bottom, top];
    }

    horizontalSplit(xCut: number): [Rect, Rect] {
        switch (this._rotation) {
            case Rect.Rotation.R000:
                return this.horizontalSplitImpl(xCut);
            case Rect.Rotation.R090:
                return this.verticalSplitImpl(xCut);
            case Rect.Rotation.R180: {
                const [l, r] = this.horizontalSplitImpl(1 - xCut);
                return [r, l];
            }
            case Rect.Rotation.R270: {
                const [b, t] = this.verticalSplitImpl(1 - xCut);
                return [t, b];
            }
            default:
                throw new Error('Invalid rotation');
        }
    }

    verticalSplit(yCut: number): [Rect, Rect] {
        switch (this._rotation) {
            case Rect.Rotation.R000:
                return this.verticalSplitImpl(yCut);
            case Rect.Rotation.R090: {
                const [l, r] = this.horizontalSplitImpl(1 - yCut);
                return [r, l];
            }
            case Rect.Rotation.R180: {
                const [b, t] = this.verticalSplitImpl(1 - yCut);
                return [t, b];
            }
            case Rect.Rotation.R270:
                return this.horizontalSplitImpl(yCut);
            default:
                throw new Error('Invalid rotation');
        }
    }
}


export namespace Rect {

    /**
     * Rectangle orientation. Used to identify reversed rectangles for strip-inverted layouting.
     */
    export enum Orientation { CD, AC, BA, DB, DC, CA, AB, BD }

    // Rotation in CCW direction.
    export enum Rotation {
        R000,
        R090,
        R180,
        R270,
    }

    export enum CurveOrientation {
        CW,
        CCW,
    }
}
