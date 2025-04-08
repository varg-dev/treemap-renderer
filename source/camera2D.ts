
/* spellchecker: disable */

import { mat4, vec3 } from 'webgl-operate';
import { m4 } from 'webgl-operate/lib/gl-matrix-extensions';

import { DEG2RAD, RAD2DEG} from 'webgl-operate/lib/auxiliaries';

import { AbstractCamera } from './abstractcamera';

/* spellchecker: enable */

/**
 * Virtual 3D camera specified by eye, center, up, fovy, near, far, and a viewport size. It provides access to cached
 * view, projection, and view projection matrices. Cached by means of whenever one of the attributes change, all
 * matrices are invalidated and recalculated only once and only when requested. Please note that eye denotes the
 * position in a virtual 3D scene and center denotes the position which is being looked at.
 */
export class Camera2D extends AbstractCamera {

    /**
     * Constructor setting up the camera's eye, center and up vectors.
     * @param eye - The viewpoint of the virtual camera
     * @param center - The look-at point in the scene
     * @param up - The up-vector of the virtual camera
     */
    constructor(eye?: vec3, center?: vec3, up?: vec3) {
        super(eye, center, up);
    }

    /**
     * Vertical field of view in degree.
     */
    get fovy(): GLfloat {
        return this._fovy;
    }

    /**
     * Sets the vertical field-of-view in degrees. Invalidates the projection.
     */
    set fovy(fovy: GLfloat) {
        if (this._fovy === fovy) {
            return;
        }
        this._fovy = fovy;
        this.invalidate(false, true);
    }

    /**
     * Sets the horizontal field-of-view in degrees. Invalidates the projection.
     * Note that internally, this will be translated to the corresponding the vertical field.
     */
    set fovx(fovx: GLfloat) {
        const horizontalAngle = fovx * DEG2RAD;
        const verticalAngle = 2.0 * Math.atan(Math.tan(horizontalAngle / 2.0) * (1.0 / this.aspect));

        const fovy = verticalAngle * RAD2DEG;
        if (this._fovy === fovy) {
            return;
        }
        this._fovy = fovy;
        this.invalidate(false, true);
    }

    /**
     * With this function the view of a physical camera can be emulated. The width and focal length of
     * a lens are used to generate the correct field of view.
     * Blender camera presets can be imported by using the camera setting 'HorizontalFit' and using the
     * width and focal length values in this function.
     * See: https://www.scantips.com/lights/fieldofviewmath.html
     * @param sensorWidth - Width of the sensor in mm
     * @param focalLength - Focal length of the lens in mm
     */
    fovFromLens(sensorWidth: number, focalLength: number): void {
        const horizontalAngle = 2.0 * Math.atan(sensorWidth / (2.0 * focalLength));
        this.fovx = horizontalAngle * RAD2DEG;
    }

    /**
     * Either returns the cached view matrix or derives the current one after invalidation and caches it.
     */
    get view(): mat4 {
        if (this._view) { // return cached value
            return this._view;
        }
        this._view = mat4.lookAt(m4(), this._eye, this._center, this._up);
        return this._view;
    }

    /**
     * Either returns the inverse cached view matrix or derives the current one after invalidation and caches it.
     */
    get viewInverse(): mat4 | undefined {
        if (this._viewInverse !== undefined) { // return cached value
            return this._viewInverse;
        }
        this._viewInverse = mat4.invert(m4(), this.view);
        return this._viewInverse;
    }

    /**
     * Either returns the cached projection matrix or derives the current one after invalidation and caches it.
     */
    get projection(): mat4 {
        if (this._projection) { // return cached value
            return this._projection;
        }
        this._projection = mat4.perspective();
        return this._projection;
    }

    /**
     * Either returns the cached inverse projection matrix or derives the current one after invalidation and caches it.
     */
    get projectionInverse(): mat4 | undefined {
        if (this._projectionInverse !== undefined) { // return cached value
            return this._projectionInverse;
        }
        this._projectionInverse = mat4.invert(m4(), this.projection);
        return this._projectionInverse;
    }

    /**
     * Returns the view projection matrix based on view and projection. This is also cached (since matrix
     * multiplication is involved).
     */
    get viewProjection(): mat4 {
        if (this._viewProjection) { // return cached value
            return this._viewProjection;
        }
        this._viewProjection = mat4.multiply(m4(), this.projection, this.view);
        this._viewProjection = mat4.multiply(m4(), this.postViewProjection, this._viewProjection);
        return this._viewProjection;
    }

    /**
     * Returns the inverse view projection matrix based on view and projection. This is also cached (since matrix
     * multiplication is involved).
     */
    get viewProjectionInverse(): mat4 | undefined {
        if (this._viewProjectionInverse !== undefined) { // return cached value
            return this._viewProjectionInverse;
        }
        this._viewProjectionInverse = mat4.invert(m4(), this.viewProjection);
        return this._viewProjectionInverse;
    }

    /**
     * Returns the matrix which contains the operations that are applied to the viewProjection matrix.
     * For now this is only used by the TiledRenderer to adjust the NDC-coordinates to the tile.
     */
    get postViewProjection(): mat4 {
        if (this._postViewProjection) {
            return this._postViewProjection;
        } else {
            return mat4.identity(m4());
        }
    }

    /**
     * Sets the matrix which contains the operations that are applied to the viewProjection matrix.
     * For now this is only used by the TiledRenderer to adjust the NDC-coordinates to the tile.
     */
    set postViewProjection(matrix: mat4) {
        this._postViewProjection = matrix;
        this.invalidate(false, false, true);
    }
}
