import {AbstractNavigationModifier} from "./abstractnavigationmodifier";
import {auxiliaries, gl_matrix_extensions, mat4, ray_math, vec2, vec3} from 'webgl-operate';


const v2 = gl_matrix_extensions.v2;
const v3 = gl_matrix_extensions.v3;
const sign = gl_matrix_extensions.sign;
const clamp = gl_matrix_extensions.clamp;
const clamp3 = gl_matrix_extensions.clamp3;

const assert = auxiliaries.assert;

export class Navigationmodifier3D extends AbstractNavigationModifier {

    /**
     * Scales the distance between the y = 0 constrained camera center and the camera's eye.
     * @param step - If undefined, the distance of initial and current position is used, else the step
     * value's sign is used for zoom direction (-1 for increase, +1 for decrease in distance).
     */
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
        scale = clamp(scale * AbstractNavigationModifier.SCALE_FACTOR, this._minScale!, this._maxScale!);

        const initialWorldPos = this.initialPoints[0].world;
        if (!initialWorldPos) {
            return;
        }
        const pointToEye = vec3.sub(v3(), this.initialEye, initialWorldPos);
        const pointToCenter = vec3.sub(v3(), this.initialCenter, initialWorldPos);

        /* Apply scale to the point to camera's center and eye respectively. */
        const eye = vec3.add(v3(), this.initialEye, vec3.scale(v3(), pointToEye, scale));
        const direction = vec3.add(v3(), this.initialCenter, vec3.scale(v3(), pointToCenter, scale));
        /* Enforce camera y = 0 by computing eye-center ray intersection with ground plane (y = 0). */
        const center = ray_math.rayPlaneIntersection(this._camera.eye, direction);

        if (!center) {
            return;
        }

        /**
         * Enforce scale constraint (3). Since this is metaphor implements a scale to point technique,
         * scaling implicitly translates the camera's center. The center, again, is restricted to be
         * within the square. For it an additional set of minimum and minimum allowed scale is
         * pre-computed. All three constraints result in a lower and upper scale bound.
         */
        this._camera.center = this._override ?
            center : clamp3(v3(), center, [-1.0, 0.0, -1.0], [+1.0, 0.0, +1.0]);
        this._camera.eye = vec3.add(v3(), eye, vec3.sub(v3(), this._camera.center, center));
    }

    /**
     * Rotate the camera at the center. The horizontal delta of the initial and current screen position
     * is used for rotation around the y-axis. The vertical delta is used for rotation around the x-Axis
     * (oriented towards the screen/camera).
     */
    rotate(): void {
        this.assert_valid();

        const currentScreenPos = this.currentPoints[0].screen;
        const initialScreenPos = this.initialPoints[0].screen;
        if (!initialScreenPos || !currentScreenPos) {
            return;
        }

        const magnitudes = vec2.subtract(v2(), initialScreenPos, currentScreenPos);
        vec2.scale(magnitudes, magnitudes, window.devicePixelRatio * AbstractNavigationModifier.ROTATE_FACTOR);

        if (this._minAngles[1] && this._maxAngles[1]) {
            magnitudes[1] = clamp(magnitudes[1], this._minAngles[1], this._maxAngles[1]);
        }

        const center = this._override ? this.initialCenter : clamp3(v3(), this.initialCenter
            , [-1.0, 0.0, -1.0], [+1.0, 0.0, +1.0]);

        const T = mat4.translate(mat4.create(), mat4.create(), center);
        mat4.rotateY(T, T, magnitudes[0]);
        mat4.rotate(T, T, magnitudes[1], this._xAxisScreenSpace);
        mat4.translate(T, T, vec3.negate(v3(), center));

        this._camera.center = center;
        const eye: vec3 | undefined = vec3.transformMat4(v3(), this.initialEye, T);

        if (!eye) {
            return;
        }

        this._camera.eye = eye;
    }

}