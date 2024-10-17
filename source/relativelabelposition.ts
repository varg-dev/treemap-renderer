
/* spellchecker: disable */

import { auxiliaries, gl_matrix_extensions, vec2 } from 'webgl-operate';
const assert = auxiliaries.assert;
const v2 = gl_matrix_extensions.v2;

/* spellchecker: enable */


export namespace RelativeLabelPosition {
    export enum Type {
        UpperRight = 'upper-right',
        UpperLeft = 'upper-left',
        LowerRight = 'lower-right',
        LowerLeft = 'lower-left',
        Hidden = 'hidden',
    }

    export function labelOrigin(position: Type, origin: vec2, extent: vec2): vec2 {
        switch (position) {
            case Type.UpperRight:
                return origin;
            case Type.UpperLeft:
                return vec2.sub(v2(), origin, [extent[0], 0.0]);
            case Type.LowerLeft:
                return vec2.sub(v2(), origin, extent);
            case Type.LowerRight:
                return vec2.sub(v2(), origin, [0.0, extent[1]]);
            case Type.Hidden:
                return origin;
            default:
                assert(false, 'No valid type for relative label position, given' + position);
        }
        return vec2.create();
    }

    export function isVisible(position: Type): boolean {
        return position !== Type.Hidden;
    }

    export function relativeLabelPosition(offset: vec2, extent: vec2): Type {
        const midpointOffset = vec2.add(v2(), offset, [extent[0] / 2.0, extent[1] / 2.0]);

        if (midpointOffset[0] > 0 && midpointOffset[1] > 0) {
            return Type.UpperRight;
        }
        if (midpointOffset[0] < 0 && midpointOffset[1] > 0) {
            return Type.UpperLeft;
        }
        if (midpointOffset[0] < 0 && midpointOffset[1] < 0) {
            return Type.LowerLeft;
        }
        if (midpointOffset[0] > 0 && midpointOffset[1] < 0) {
            return Type.LowerRight;
        }

        assert(false,
            `midpointOffset is ${midpointOffset}, given offset ${offset} and extent ${extent}`);
        return Type.Hidden;
    }
}
