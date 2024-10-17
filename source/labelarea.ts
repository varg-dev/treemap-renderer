
/* spellchecker: disable */

import { gl_matrix_extensions, vec2 } from 'webgl-operate';
const v2 = gl_matrix_extensions.v2;

import { RelativeLabelPosition } from './relativelabelposition';


/* spellchecker: enable */

/**
 * This class represents a label area in screen space which can be used to calculate overlapping.
 */
export class LabelArea {

    constructor(public origin: vec2, public extent: vec2, public position: RelativeLabelPosition.Type) {
    }

    protected areBothPositionsHidden(otherPosition: RelativeLabelPosition.Type): boolean {
        return this.position === RelativeLabelPosition.Type.Hidden
            || otherPosition === RelativeLabelPosition.Type.Hidden;
    }

    /**
     *
     * @param other
     */
    public overlaps(other: LabelArea): boolean {

        if (this.areBothPositionsHidden(other.position)) {
            return false;
        }

        const upperRight = vec2.add(v2(), this.origin, this.extent);
        const otherUpperRight = vec2.add(v2(), other.origin, other.extent);

        return this.origin[0] < otherUpperRight[0]
            && upperRight[0] > other.origin[0]
            && this.origin[1] < otherUpperRight[1]
            && upperRight[1] > other.origin[1];
    }

    /**
     *
     * @param other
     * @param relativePadding
     */
    public paddedOverlaps(other: LabelArea, relativePadding: vec2): boolean {

        if (this.areBothPositionsHidden(other.position)) {
            return false;
        }

        const relPadding1 = vec2.fromValues(relativePadding[0] + 1.0, relativePadding[1] + 1.0);
        const aLowerLeft = vec2.sub(v2(), this.origin, vec2.mul(v2(), this.extent, relativePadding));
        const bLowerLeft = vec2.sub(v2(), other.origin, vec2.mul(v2(), other.extent, relativePadding));
        const aUpperRight = vec2.add(v2(), this.origin, vec2.mul(v2(), this.extent, relPadding1));
        const bUpperRight = vec2.add(v2(), other.origin, vec2.mul(v2(), other.extent, relPadding1));

        return aLowerLeft[0] < bUpperRight[0]
            && aUpperRight[0] > bLowerLeft[0]
            && aLowerLeft[1] < bUpperRight[1]
            && aUpperRight[1] > bLowerLeft[1];
    }

    /**
     *
     * @param other
     */
    public overlapArea(other: LabelArea): number {

        if (this.areBothPositionsHidden(other.position)) {
            return 0.0;
        }

        const lowerLeft = vec2.max(v2(), this.origin, other.origin);

        const upperRight = vec2.min(v2(),
            vec2.add(v2(), this.origin, this.extent),
            vec2.add(v2(), other.origin, other.extent));

        return Math.max(0.0,
            upperRight[0] - lowerLeft[0]) * Math.max(0.0, upperRight[1] - lowerLeft[1]);
    }

    /**
     *
     * @param other
     * @param relativePadding
     */
    public paddedOverlapArea(other: LabelArea, relativePadding: vec2): number {

        if (this.areBothPositionsHidden(other.position)) {
            return 0.0;
        }

        const lowerLeft = vec2.max(v2(),
            vec2.sub(v2(), this.origin, vec2.mul(v2(), this.extent, relativePadding)),
            vec2.sub(v2(), other.origin, vec2.mul(v2(), other.extent, relativePadding)));

        const relPadding1 = vec2.fromValues(relativePadding[0] + 1.0, relativePadding[1] + 1.0);

        const upperRight = vec2.min(v2(),
            vec2.add(v2(), this.origin, vec2.mul(v2(), this.extent, relPadding1)),
            vec2.add(v2(), other.origin, vec2.mul(v2(), other.extent, relPadding1)));

        return Math.max(0.0,
            upperRight[0] - lowerLeft[0]) * Math.max(0.0, upperRight[1] - lowerLeft[1]);
    }

    /**
     * calculates the area of this labelarea
     */
    public area(): number {
        return this.extent[0] * this.extent[1];
    }
}
