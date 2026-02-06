
/* spellchecker: disable */

// import { auxiliaries } from 'webgl-operate';
// const assert = auxiliaries.assert;

/* spellchecker: enable */
export class HMRect {

    pos: { x: number; y: number };
    extent: { x: number; y: number };
    private m_rotation: number = HMRect.Rotation.R000;
    private m_curve: number = HMRect.CurveOrientation.CW;

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

    contains(other: HMRect): boolean {
        return this.left() <= other.left() &&
            this.right() >= other.right() &&
            this.top() >= other.top() &&
            this.bottom() <= other.bottom();
    }

    intersects(other: HMRect): boolean {
        return !(other.left() > this.right() ||
            other.right() < this.left() ||
            other.top() < this.bottom() ||
            other.bottom() > this.top());
    }

    merged(other: HMRect): HMRect {
        const left = Math.min(this.left(), other.left());
        const bottom = Math.min(this.bottom(), other.bottom());
        const right = Math.max(this.right(), other.right());
        const top = Math.max(this.top(), other.top());
        return new HMRect(left, bottom, right - left, top - bottom, this.m_rotation, this.m_curve);
    }

    intersection(other: HMRect): HMRect {
        const iLeft = Math.max(this.left(), other.left());
        const iBottom = Math.max(this.bottom(), other.bottom());
        const iTop = Math.min(this.top(), other.top());
        const iRight = Math.min(this.right(), other.right());
        return new HMRect(iLeft, iBottom, Math.max(iRight - iLeft, 0), Math.max(iTop - iBottom, 0));
    }

    // ------------------ Padding ------------------
    padded(padding: number): HMRect {
        return new HMRect(
            this.pos.x + padding,
            this.pos.y + padding,
            Math.max(this.extent.x - 2 * padding, 0),
            Math.max(this.extent.y - 2 * padding, 0),
            this.m_rotation,
            this.m_curve
        );
    }

    paddedLTRB(top: number, right: number, bottom: number, left: number): HMRect {
        return new HMRect(
            this.pos.x + left,
            this.pos.y + bottom,
            Math.max(this.extent.x - left - right, 0),
            Math.max(this.extent.y - top - bottom, 0),
            this.m_rotation,
            this.m_curve
        );
    }

    // ------------------ Relative Rect ------------------
    relativeRect(position: { x: number, y: number }, extent: { x: number, y: number }): HMRect {
        const p = { x: Math.min(position.x, 1), y: Math.min(position.y, 1) };
        const e = { x: Math.min(extent.x, Math.max(1 - p.x, 0)), y: Math.min(extent.y, Math.max(1 - p.y, 0)) };
        return new HMRect(
            { x: this.pos.x + this.extent.x * p.x, y: this.pos.y + this.extent.y * p.y },
            { x: this.extent.x * e.x, y: this.extent.y * e.y },
            this.m_rotation,
            this.m_curve
        );
    }

    relativePadded(padding: number): HMRect {
        const half = padding / 2;
        return this.relativeRect({ x: half, y: half }, { x: 1 - padding, y: 1 - padding });
    }

    // ------------------ Rotation ------------------
    rotate(r: number) {
        this.m_rotation = (this.m_rotation + r) % 4;
    }

    // ------------------ Splitting ------------------
    private horizontalSplitImpl(xCut: number): [HMRect, HMRect] {
        return [
            new HMRect(this.pos.x, this.pos.y, this.extent.x * xCut, this.extent.y, this.m_rotation, this.m_curve),
            new HMRect(this.pos.x + this.extent.x * xCut, this.pos.y, this.extent.x * (1 - xCut), this.extent.y, this.m_rotation, this.m_curve)
        ];
    }

    private verticalSplitImpl(yCut: number): [HMRect, HMRect] {
        return [
            new HMRect(this.pos.x, this.pos.y, this.extent.x, this.extent.y * yCut, this.m_rotation, this.m_curve),
            new HMRect(this.pos.x, this.pos.y + this.extent.y * yCut, this.extent.x, this.extent.y * (1 - yCut), this.m_rotation, this.m_curve)
        ];
    }

    horizontalSplit(xCut: number): [HMRect, HMRect] {
        switch (this.m_rotation) {
            case HMRect.Rotation.R000: return this.horizontalSplitImpl(xCut);
            case HMRect.Rotation.R090: return this.verticalSplitImpl(xCut);
            case HMRect.Rotation.R180: {
                const [l, r] = this.horizontalSplitImpl(1 - xCut);
                return [r, l];
            }
            case HMRect.Rotation.R270: {
                const [b, t] = this.verticalSplitImpl(1 - xCut);
                return [t, b];
            }
        }
        throw new Error("Invalid rotation");
    }

    verticalSplit(yCut: number): [HMRect, HMRect] {
        switch (this.m_rotation) {
            case HMRect.Rotation.R000: return this.verticalSplitImpl(yCut);
            case HMRect.Rotation.R090: {
                const [l, r] = this.horizontalSplitImpl(1 - yCut);
                return [r, l];
            }
            case HMRect.Rotation.R180: {
                const [b, t] = this.verticalSplitImpl(1 - yCut);
                return [t, b];
            }
            case HMRect.Rotation.R270: return this.horizontalSplitImpl(yCut);
        }
        throw new Error("Invalid rotation");
    }
}
