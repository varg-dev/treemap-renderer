
/* spellchecker: disable */
import { gl_matrix_extensions, mat4, vec3 } from 'webgl-operate';

import { AbstractCamera } from './abstractcamera';

/* spellchecker: enable */

const m4 = gl_matrix_extensions.m4;

/**
 * A 3D camera using an orthographic projection to display the treemap from above in a 2D style.
 * @see AbstractCamera
 */
export class Camera2D extends AbstractCamera {

    /**
     * Factor for scaling the view frustum.
     */
    private _scale: number;

    /**
     * Constructor for setting up the camera.
     * @see AbstractCamera.constructor
     * @param scale - the factor that is applied to the view frustum size
     */
    constructor(eye?: vec3, center?: vec3, up?: vec3, scale = 1.0) {
        super(eye, center, up);
        this._scale = scale;
    }

    set scale(scale: number) {
        if (this._scale === scale) {
            return;
        }
        this._scale = scale;
        this.invalidate(false, true);
    }

    get scale(): number {
        return this._scale;
    }

    get view(): mat4 {
        if (this._view) { // return cached value
            return this._view;
        }
        this._view = mat4.lookAt(m4(), this._eye, this._center, this._up);
        return this._view;
    }

    get viewInverse(): mat4 | undefined {
        if (this._viewInverse !== undefined) { // return cached value
            return this._viewInverse;
        }
        this._viewInverse = mat4.invert(m4(), this.view);
        return this._viewInverse;
    }


    get projection(): mat4 {
        if (this._projection) { // return cached value
            return this._projection;
        }
        this._projection = mat4.ortho(m4(), -this._aspect * this._scale, this._aspect * this._scale, -this._scale, this._scale, this.near, this.far)
        return this._projection;
    }

    get projectionInverse(): mat4 | undefined {
        if (this._projectionInverse !== undefined) { // return cached value
            return this._projectionInverse;
        }
        this._projectionInverse = mat4.invert(m4(), this.projection);
        return this._projectionInverse;
    }

    get viewProjection(): mat4 {
        if (this._viewProjection) { // return cached value
            return this._viewProjection;
        }
        this._viewProjection = mat4.multiply(m4(), this.projection, this.view);
        this._viewProjection = mat4.multiply(m4(), this.postViewProjection, this._viewProjection);
        return this._viewProjection;
    }

    get viewProjectionInverse(): mat4 | undefined {
        if (this._viewProjectionInverse !== undefined) { // return cached value
            return this._viewProjectionInverse;
        }
        this._viewProjectionInverse = mat4.invert(m4(), this.viewProjection);
        return this._viewProjectionInverse;
    }

    get postViewProjection(): mat4 {
        if (this._postViewProjection) {
            return this._postViewProjection;
        } else {
            return mat4.identity(m4());
        }
    }

    set postViewProjection(matrix: mat4) {
        this._postViewProjection = matrix;
        this.invalidate(false, false, true);
    }
}
