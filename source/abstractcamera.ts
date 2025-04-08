import { mat4, vec3 } from 'webgl-operate';
import { duplicate2, GLsizei2 } from 'webgl-operate/lib/tuples';
import { log, LogLevel } from 'webgl-operate/lib/auxiliaries';

export abstract class AbstractCamera {
    private static readonly DEFAULT_EYE: vec3 = vec3.fromValues(0.0, 0.0, 1.0);
    private static readonly DEFAULT_CENTER: vec3 = vec3.fromValues(0.0, 0.0, 0.0);
    private static readonly DEFAULT_UP: vec3 = vec3.fromValues(0.0, 1.0, 0.0);

    private static readonly DEFAULT_FOVY = 45.0;

    private static readonly DEFAULT_NEAR = 2.0;
    private static readonly DEFAULT_FAR = 8.0;


    /** @see {@link eye} */
    protected _eye: vec3;

    /** @see {@link center} */
    protected _center: vec3;

    /** @see {@link up} */
    protected _up: vec3;

    /** @see {@link fovy} */
    protected _fovy = AbstractCamera.DEFAULT_FOVY;

    /** @see {@link near} */
    protected _near = AbstractCamera.DEFAULT_NEAR;

    /** @see {@link far} */
    protected _far = AbstractCamera.DEFAULT_FAR;

    /** @see {@link viewport} */
    protected _viewport: GLsizei2 = [1, 1];

    /** @see {@link aspect} */
    protected _aspect: GLfloat = 1.0;

    /** @see {@link view} */
    protected _view: mat4 | undefined;
    /** @see {@link viewInverse} */
    protected _viewInverse: mat4 | undefined;

    /** @see {@link projection} */
    protected _projection: mat4 | undefined;
    /** @see {@link projectionInverse} */
    protected _projectionInverse: mat4 | undefined;

    /** @see {@link viewProjection} */
    protected _viewProjection: mat4 | undefined;
    /** @see {@link viewProjectionInverse} */
    protected _viewProjectionInverse: mat4 | undefined;


    /** @see {@link postViewProjection} */
    protected _postViewProjection: mat4 | undefined;

    /** @see {@link altered} */
    protected _altered = false;

    /**
     * Constructor setting up the camera's eye, center and up vectors.
     * @param eye - The viewpoint of the virtual camera
     * @param center - The look-at point in the scene
     * @param up - The up-vector of the virtual camera
     */
    constructor(eye?: vec3, center?: vec3, up?: vec3) {
        this._eye = eye ? vec3.clone(eye) : vec3.clone(AbstractCamera.DEFAULT_EYE);
        this._center = center ? vec3.clone(center) : vec3.clone(AbstractCamera.DEFAULT_CENTER);
        this._up = up ? vec3.clone(up) : vec3.clone(AbstractCamera.DEFAULT_UP);
    }

    /**
     * Invalidates derived matrices, i.e., view, projection, and view-projection. The view should be invalidated on
     * eye, center, and up changes. The projection should be invalidated on fovy, viewport, near, and far changes.
     * The view projection invalidates whenever either one or both view and projection are to be invalidated.
     */
    protected invalidate(invalidateView: boolean, invalidateProjection: boolean,
                         invalidateOnlyViewProjection: boolean = false): void {
        if (invalidateView) {
            this._view = undefined;
            this._viewInverse = undefined;
        }
        if (invalidateProjection) {
            this._projection = undefined;
            this._projectionInverse = undefined;
        }
        if (invalidateView || invalidateProjection || invalidateOnlyViewProjection) {
            this._viewProjection = undefined;
            this._viewProjectionInverse = undefined;
        }
        this._altered = true;
    }

    /**
     * Computes a vertical field of view angle based on the display height and distance to eye. Since both parameters
     * are highly dependent of the device, this function can only be used to derive a rough estimate for a reasonable
     * field of view. Note that both parameters should be passed using the same unit, e.g., inch or centimeters.
     * @param elementDisplayHeight - Height of an element on the display.
     * @param eyeToDisplayDistance - Distance from the users eye to that element.
     * @returns - Vertical field of view angle in radian.
     */
    static calculateFovY(elementDisplayHeight: number, eyeToDisplayDistance: number): number {
        return Math.atan(elementDisplayHeight * 0.5 / eyeToDisplayDistance) * 2.0;
    }

    /**
     * Position of the virtual camera in a virtual 3D scene, the point of view.
     */
    get eye(): vec3 {
        return this._eye;
    }

    /**
     * Sets the eye. Invalidates the view.
     */
    set eye(eye: vec3) {
        if (vec3.equals(this._eye, eye)) {
            return;
        }
        this._eye = vec3.clone(eye);
        this.invalidate(true, false);
    }

    /**
     * Look-at point into a virtual 3D scene.
     */
    get center(): vec3 {
        return this._center;
    }

    /**
     * Sets the center. Invalidates the view.
     */
    set center(center: vec3) {
        if (vec3.equals(this._center, center)) {
            return;
        }
        this._center = vec3.clone(center);
        this.invalidate(true, false);
    }

    /**
     * Up-vector of the virtual camera.
     */
    get up(): vec3 {
        return this._up;
    }

    /**
     * Sets the up vector. Invalidates the view.
     */
    set up(up: vec3) {
        if (vec3.equals(this._up, up)) {
            return;
        }
        this._up = vec3.clone(up);
        this.invalidate(true, false);
    }

    abstract fovFromLens(sensorWidth: number, focalLength: number): void;

    abstract get fovy(): GLfloat;
    abstract set fovy(fovy: GLfloat);

    abstract get fovx(): GLfloat;
    abstract set fovx(fovy: GLfloat);

    /**
     * Distance of near-plane in view coordinates.
     */
    get near(): GLfloat {
        return this._near;
    }

    /**
     * Sets the distance to the near clipping plane. Invalidates the projection.
     */
    set near(near: GLfloat) {
        if (this._near === near) {
            return;
        }
        if (near >= this._far) {
            log(LogLevel.Warning, `near expected to be smaller than far (${this._far}), given ${near}`);
        }
        this._near = near;
        this.invalidate(false, true);
    }

    /**
     * Distance of far-plane in view coordinates.
     */
    get far(): GLfloat {
        return this._far;
    }

    /**
     * Sets the distance to the far clipping plane. Invalidates the projection.
     */
    set far(far: GLfloat) {
        if (this._far === far) {
            return;
        }
        if (this._near >= far) {
            log(LogLevel.Warning, `far expected to be greater than near (${this._near}), given ${far}`);
        }
        this._far = far;
        this.invalidate(false, true);
    }

    /**
     * Sets the viewport size. Invalidates the projection.
     */
    set viewport(size: GLsizei2) {
        if (this._viewport[0] === size[0] && this._viewport[1] === size[1]) {
            return;
        }
        this._viewport = duplicate2<GLsizei>(size);
        this.invalidate(false, true);
    }

    /**
     * The size of the target viewport used to determine the aspect ratio for subsequent perspective matrix projection
     * computation.
     */
    get viewport(): GLsizei2 {
        return this._viewport;
    }

    /**
     * Access to the viewport width.
     */
    get width(): GLsizei {
        return this._viewport[0];
    }

    /**
     * Access to the viewport height.
     */
    get height(): GLsizei {
        return this._viewport[1];
    }

    /**
     * Sets the aspect ratio (width over height). However, this is not derived from viewport to allow for
     * differentiation between viewport size and scale.
     */
    set aspect(aspect: GLfloat) {
        if (this._aspect === aspect) {
            return;
        }
        this._aspect = aspect;
    }

    /**
     * Computes the ratio of width over height (set explicitly for differentiation between viewport size and scale).
     */
    get aspect(): GLfloat {
        return this._aspect;
    }

    abstract get view(): mat4;
    abstract get viewInverse(): mat4 | undefined;

    abstract get projection(): mat4;
    abstract get projectionInverse(): mat4 | undefined;

    abstract get viewProjection(): mat4;
    abstract get viewProjectionInverse(): mat4 | undefined;

    abstract get postViewProjection(): mat4;
    abstract set postViewProjection(matrix: mat4);

    /**
     * Whether or not any other public property has changed. Please note that the alteration status is detached from
     * caching state of lazily computed properties.
     */
    get altered(): boolean {
        return this._altered;
    }

    /**
     * Intended for resetting alteration status.
     */
    set altered(status: boolean) {
        this._altered = status;
    }

}