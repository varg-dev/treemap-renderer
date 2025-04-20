import {AbstractNavigationModifier} from "./abstractnavigationmodifier";
import {Camera2D} from "./camera2D";
import {auxiliaries, gl_matrix_extensions, vec2} from 'webgl-operate';


const v2 = gl_matrix_extensions.v2;
const sign = gl_matrix_extensions.sign;

const assert = auxiliaries.assert;


export class Navigationmodifier2D extends AbstractNavigationModifier {
    protected static readonly SCALE_FACTOR = 0.004;
    protected static readonly SCALE_STEP_FACTOR = 16.0;

    rotate(): void {}

    scale(step?: number): void {
        this.assert_valid();
        assert(this._minScale !== undefined && this._maxScale !== undefined,
            `valid scale constraints expected`);
        let scale: number;
        if (undefined === step) {
            const currentScreenPos = this.currentPoints[0].screen;
            const initialScreenPos = this.initialPoints[0].screen;
            if (!initialScreenPos || !currentScreenPos) {
                return;
            }
            const magnitude = vec2.subtract(v2(), initialScreenPos, currentScreenPos);
            scale = magnitude[1] / window.devicePixelRatio;

        } else {
            scale = -sign(step) * AbstractNavigationModifier.SCALE_STEP_FACTOR;
        }
        scale = /*clamp(*/scale * AbstractNavigationModifier.SCALE_FACTOR/*, this._minScale!, this._maxScale!)*/;


        //TODO: Revisit constraints and protections
        //TODO: zoom to targeted point by shifting eye to mouse intersection
        (this._camera as any as Camera2D).scale = (this._camera as any as Camera2D).scale + scale;
    }

}