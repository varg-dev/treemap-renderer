import {AbstractNavigationModifier} from "./abstractnavigationmodifier";
import {Camera2D} from "./camera2D";
import {auxiliaries, gl_matrix_extensions, vec2, vec3} from 'webgl-operate';

const v2 = gl_matrix_extensions.v2;
const v3 = gl_matrix_extensions.v3;
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
        if(this.initialPoints[0].world === undefined) {
            return;
        }

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

        const initialWorldPos = this.initialPoints[0].world;
        const targetScale = (this._camera as any as Camera2D).scale + (scale * AbstractNavigationModifier.SCALE_FACTOR);

        if(targetScale > this._maxScale!) {
            (this._camera as any as Camera2D).scale = this._maxScale!;
        } else if(targetScale < this._minScale!) {
            (this._camera as any as Camera2D).scale = this._minScale!;
        } else {
            (this._camera as any as Camera2D).scale = targetScale;
        }

        // reference must be false, otherwise the outdated initial viewProjectionInverse will be used
        const scaledWorldPos = this.coordsAt(this.initialPoints[0].screen, false);
        const deltaWorldPos = vec3.mul(v3(), vec3.sub(v3(), initialWorldPos, scaledWorldPos), [1.0, 0.0, 1.0]);

        this._camera.center = vec3.add(v3(), this.initialCenter, deltaWorldPos);
        this._camera.eye = [this._camera.center[0], this._camera.eye[1], this._camera.center[2]];
    }

    protected initiateScaleConstraints(override: boolean): void {
        /**
         *TODO
         *  - not sure about the override parameter
         *  - How to get good constraints?
         *  - Crashes when zooming far away from the treemap. Why? How to stop that?
         */

        this._minScale = 0.01;
        this._maxScale = 10.0;

    }

}