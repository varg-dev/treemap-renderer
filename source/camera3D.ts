
/* spellchecker: disable */
import { auxiliaries, gl_matrix_extensions, mat4 } from 'webgl-operate';

import { AbstractCamera } from './abstractcamera';
/* spellchecker: enable */

const m4 = gl_matrix_extensions.m4;

/**
 * A 3D camera using a perspective projection to display a 3D treemap.
 * @see AbstractCamera
 */
export class Camera3D extends AbstractCamera {

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
        this._projection = mat4.perspective(m4(), this.fovy * auxiliaries.DEG2RAD, this.aspect, this.near, this.far);
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
