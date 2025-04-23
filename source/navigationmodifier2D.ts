import {AbstractNavigationModifier} from "./abstractnavigationmodifier";
import {Camera2D} from "./camera2D";
import {auxiliaries, gl_matrix_extensions, ray_math, vec2, vec3} from 'webgl-operate';

const v2 = gl_matrix_extensions.v2;
const v3 = gl_matrix_extensions.v3;
const sign = gl_matrix_extensions.sign;
const clamp3 = gl_matrix_extensions.clamp3;

const assert = auxiliaries.assert;

export class Navigationmodifier2D extends AbstractNavigationModifier {
    protected static readonly SCALE_FACTOR = 0.004;
    protected static readonly SCALE_STEP_FACTOR = 16.0;

    translate(): void {
        this.assert_valid();

        const initialWorldPos = this.initialPoints[0].world;
        const currentWorldPos = this.currentPoints[0].world;
        if (!initialWorldPos || !currentWorldPos) {
            return;
        }
        const translate = vec3.subtract(v3(), initialWorldPos, currentWorldPos);
        /* Enforce center within square constraints (bound translate vector to max negative and positive
        translation). */
        if (this._maxNegativeTranslate && this._maxPositiveTranslate) {
            clamp3(translate, translate, this._maxNegativeTranslate, this._maxPositiveTranslate);
        }

        // apply translation to the camera's center and eye
        this._camera.eye = vec3.add(v3(), this.initialEye, translate);
        const center = vec3.add(v3(), this.initialCenter, translate);
        // enforce camera y = 0 by computing eye-center ray intersection with ground plane (y = 0)
        const intersection = ray_math.rayPlaneIntersection(this._camera.eye, center);
        if (!intersection) {
            return;
        }
        this._camera.center = intersection;
    }

    /**
     * Rotation is not supported and not implemented by the 2D camera navigation.
     */
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

    /**
     * @todo these constraints are just magic numbers at the moment. Evaluate if they can be chosen dynamically, and if that is required.
     */
    protected initiateScaleConstraints(override: boolean): void {

        this._minScale = 0.01;
        this._maxScale = 10.0;

    }

}