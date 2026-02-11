
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

    // TODO: merge with above
    pos: { x: number; y: number };
    extent: { x: number; y: number };
    private _rotation: number = Rect.Rotation.R000;
    private _curve: number = Rect.CurveOrientation.CW;

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

    constructor();
    constructor(rotation: number, curve: number);
    constructor(left: number, bottom: number, width: number, height: number);
    constructor(left: number, bottom: number, width: number, height: number, rotation: number, curve: number);
    constructor(pos: { x: number; y: number }, extent: { x: number; y: number });
    constructor(pos: { x: number; y: number }, extent: { x: number; y: number }, rotation: number, curve: number);
    constructor(...args: any[]) {
        if (args.length === 0) {
            this.pos = { x: 0, y: 0 };
            this.extent = { x: 0, y: 0 };
        } else if (args.length === 2 && typeof args[0] === 'number' && typeof args[1] === 'number') {
            this.pos = { x: 0, y: 0 };
            this.extent = { x: 0, y: 0 };
            this.m_rotation = args[0];
            this.m_curve = args[1];
        } else if (args.length === 4) {
            const [l, b, w, h] = args;
            this.pos = { x: l, y: b };
            this.extent = { x: w, y: h };
        } else if (args.length === 6) {
            const [l, b, w, h, rot, curve] = args;
            this.pos = { x: l, y: b };
            this.extent = { x: w, y: h };
            this.m_rotation = rot;
            this.m_curve = curve;
        } else if (args.length === 2 && 'x' in args[0] && 'y' in args[0]) {
            this.pos = { ...args[0] };
            this.extent = { ...args[1] };
        } else if (args.length === 4 && 'x' in args[0] && 'y' in args[0]) {
            this.pos = { ...args[0] };
            this.extent = { ...args[1] };
            this.m_rotation = args[2];
            this.m_curve = args[3];
        } else {
            throw new Error("Invalid constructor arguments");
        }
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


    // ------------------ Getters ------------------
    left(): number { return this.pos.x; }
    bottom(): number { return this.pos.y; }
    right(): number { return this.pos.x + this.extent.x; }
    top(): number { return this.pos.y + this.extent.y; }
    width(): number { return this.extent.x; }
    height(): number { return this.extent.y; }
    center(): { x: number, y: number } {
        return { x: this.pos.x + this.extent.x / 2, y: this.pos.y + this.extent.y / 2 };
    }
    topLeft(): { x: number, y: number } { return { x: this.pos.x, y: this.top() }; }
    topRight(): { x: number, y: number } { return { x: this.right(), y: this.top() }; }
    bottomLeft(): { x: number, y: number } { return { ...this.pos }; }
    bottomRight(): { x: number, y: number } { return { x: this.right(), y: this.pos.y }; }
    topCenter(): { x: number, y: number } { return { x: this.pos.x + this.extent.x / 2, y: this.top() }; }
    bottomCenter(): { x: number, y: number } { return { x: this.pos.x + this.extent.x / 2, y: this.pos.y }; }
    leftCenter(): { x: number, y: number } { return { x: this.pos.x, y: this.pos.y + this.extent.y / 2 }; }
    rightCenter(): { x: number, y: number } { return { x: this.right(), y: this.pos.y + this.extent.y / 2 }; }

    isValid(): boolean { return !isNaN(this.pos.x) && !isNaN(this.pos.y) && !isNaN(this.extent.x) && !isNaN(this.extent.y); }
    isEmpty(): boolean { return this.extent.x === 0 || this.extent.y === 0; }
    isHorizontal(): boolean { return this.extent.x > this.extent.y; }
    isVertical(): boolean { return !this.isHorizontal(); }

    longerSide(): number { return Math.max(this.extent.x, this.extent.y); }
    shorterSide(): number { return Math.min(this.extent.x, this.extent.y); }
    aspectRatio(): number { return this.shorterSide() > 0 ? this.longerSide() / this.shorterSide() : 0; }
    area(): number { return this.extent.x * this.extent.y; }

    rotation(): number { return this.m_rotation; }
    curveDirection(): number { return this.m_curve; }
    setCurveDirection(dir: number) { this.m_curve = (this.m_curve + dir) % 2; }

    contains(other: Rect): boolean {
        return this.left() <= other.left() &&
            this.right() >= other.right() &&
            this.top() >= other.top() &&
            this.bottom() <= other.bottom();
    }

    intersects(other: Rect): boolean {
        return !(other.left() > this.right() ||
            other.right() < this.left() ||
            other.top() < this.bottom() ||
            other.bottom() > this.top());
    }

    merged(other: Rect): Rect {
        const left = Math.min(this.left(), other.left());
        const bottom = Math.min(this.bottom(), other.bottom());
        const right = Math.max(this.right(), other.right());
        const top = Math.max(this.top(), other.top());
        return new Rect(left, bottom, right - left, top - bottom, this.m_rotation, this.m_curve);
    }

    intersection(other: Rect): Rect {
        const iLeft = Math.max(this.left(), other.left());
        const iBottom = Math.max(this.bottom(), other.bottom());
        const iTop = Math.min(this.top(), other.top());
        const iRight = Math.min(this.right(), other.right());
        return new Rect(iLeft, iBottom, Math.max(iRight - iLeft, 0), Math.max(iTop - iBottom, 0));
    }

    // ------------------ Padding ------------------
    padded(padding: number): Rect {
        return new Rect(
            this.pos.x + padding,
            this.pos.y + padding,
            Math.max(this.extent.x - 2 * padding, 0),
            Math.max(this.extent.y - 2 * padding, 0),
            this.m_rotation,
            this.m_curve
        );
    }

    paddedLTRB(top: number, right: number, bottom: number, left: number): Rect {
        return new Rect(
            this.pos.x + left,
            this.pos.y + bottom,
            Math.max(this.extent.x - left - right, 0),
            Math.max(this.extent.y - top - bottom, 0),
            this.m_rotation,
            this.m_curve
        );
    }

    // ------------------ Relative Rect ------------------
    relativeRect(position: { x: number, y: number }, extent: { x: number, y: number }): Rect {
        const p = { x: Math.min(position.x, 1), y: Math.min(position.y, 1) };
        const e = { x: Math.min(extent.x, Math.max(1 - p.x, 0)), y: Math.min(extent.y, Math.max(1 - p.y, 0)) };
        return new Rect(
            { x: this.pos.x + this.extent.x * p.x, y: this.pos.y + this.extent.y * p.y },
            { x: this.extent.x * e.x, y: this.extent.y * e.y },
            this.m_rotation,
            this.m_curve
        );
    }

    relativePadded(padding: number): Rect {
        const half = padding / 2;
        return this.relativeRect({ x: half, y: half }, { x: 1 - padding, y: 1 - padding });
    }

    // ------------------ Rotation ------------------
    rotate(r: number) {
        this.m_rotation = (this.m_rotation + r) % 4;
    }

    // ------------------ Splitting ------------------
    private horizontalSplitImpl(xCut: number): [Rect, Rect] {
        return [
            new Rect(this.pos.x, this.pos.y, this.extent.x * xCut, this.extent.y, this.m_rotation, this.m_curve),
            new Rect(this.pos.x + this.extent.x * xCut, this.pos.y, this.extent.x * (1 - xCut), this.extent.y, this.m_rotation, this.m_curve)
        ];
    }

    private verticalSplitImpl(yCut: number): [Rect, Rect] {
        return [
            new Rect(this.pos.x, this.pos.y, this.extent.x, this.extent.y * yCut, this.m_rotation, this.m_curve),
            new Rect(this.pos.x, this.pos.y + this.extent.y * yCut, this.extent.x, this.extent.y * (1 - yCut), this.m_rotation, this.m_curve)
        ];
    }

    horizontalSplit(xCut: number): [Rect, Rect] {
        switch (this.m_rotation) {
            case Rect.Rotation.R000: return this.horizontalSplitImpl(xCut);
            case Rect.Rotation.R090: return this.verticalSplitImpl(xCut);
            case Rect.Rotation.R180: {
                const [l, r] = this.horizontalSplitImpl(1 - xCut);
                return [r, l];
            }
            case Rect.Rotation.R270: {
                const [b, t] = this.verticalSplitImpl(1 - xCut);
                return [t, b];
            }
        }
        throw new Error("Invalid rotation");
    }

    verticalSplit(yCut: number): [Rect, Rect] {
        switch (this.m_rotation) {
            case Rect.Rotation.R000: return this.verticalSplitImpl(yCut);
            case Rect.Rotation.R090: {
                const [l, r] = this.horizontalSplitImpl(1 - yCut);
                return [r, l];
            }
            case Rect.Rotation.R180: {
                const [b, t] = this.verticalSplitImpl(1 - yCut);
                return [t, b];
            }
            case Rect.Rotation.R270: return this.horizontalSplitImpl(yCut);
        }
        throw new Error("Invalid rotation");
    }
}


export namespace Rect {

    /**
     * Rectangle orientation. Used to identify reversed rectangles for strip-inverted layouting.
     */
    export enum Orientation { CD, AC, BA, DB, DC, CA, AB, BD }

    // Rotation in CCW direction
    export enum Rotation {
        R000,
        R090,
        R180,
        R270
    }

    export enum CurveOrientation {
        CW,
        CCW
    }
}
