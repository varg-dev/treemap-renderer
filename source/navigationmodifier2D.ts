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

        const targetScale = (this._camera as any as Camera2D).scale + (scale * AbstractNavigationModifier.SCALE_FACTOR);

        console.log(this.initialPoints[0].world);
        //TODO: zoom to targeted point by shifting eye to mouse intersection
        if(targetScale > this._maxScale!) {
            (this._camera as any as Camera2D).scale = this._maxScale!;
        } else if(targetScale < this._minScale!) {
            (this._camera as any as Camera2D).scale = this._minScale!;
        } else {
            (this._camera as any as Camera2D).scale = targetScale;
        }
        //TODO find a way to either invalidate projection, view projection and view projection inverse matrices or find a way to update them
        //TODO calculate the new world-position of the mouse
        //TODO calculate difference between mouse positions
        //TODO add difference to center (and move eye respectively)
        /*
        this._camera.center = [targetCenter[0] * targetScale, 0.0, targetCenter[2] * targetScale];
        this._camera.eye = [this._camera.center[0], this._camera.eye[1], this._camera.center[2]];
        */

    }

    protected initiateScaleConstraints(override: boolean): void {
        /**
         * TODO not sure about the override parameter
         * TODO How to get good constraints?
         */

        this._minScale = 0.01;
        this._maxScale = 10.0;

    }

}