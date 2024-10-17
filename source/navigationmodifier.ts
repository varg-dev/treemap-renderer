
/* spellchecker: disable */

import { auxiliaries, gl_matrix_extensions, mat4, ray_math, vec2, vec3 } from 'webgl-operate';
import {
    Camera,
    CameraModifier,
} from 'webgl-operate';

/* spellchecker: enable */


const v2 = gl_matrix_extensions.v2;
const v3 = gl_matrix_extensions.v3;
const sign = gl_matrix_extensions.sign;
const clamp = gl_matrix_extensions.clamp;
const clamp3 = gl_matrix_extensions.clamp3;

const DEG2RAD = auxiliaries.DEG2RAD;
const assert = auxiliaries.assert;

export interface CoordsAccess {
    (x: GLint, y: GLint, zInNDC?: number,
        viewProjectionInverse?: mat4): vec3 | undefined;
}

/* tslint:disable:max-classes-per-file */

/**
 * Support class to represent a vertex in different reference spaces.
 */
class Vertex {
    screen: vec2 | undefined = vec2.create();
    world: vec3 | undefined = vec3.create();
}


export class NavigationModifier extends CameraModifier {

    protected static readonly HALF_SQUARE_LENGTH = 2.0;
    protected static readonly SCALE_FACTOR = 0.004;
    protected static readonly SCALE_STEP_FACTOR = 16.0;
    protected static readonly ROTATE_FACTOR = 0.002;

    /** @todo make the maxDistanceToSquare configurable */
    protected static readonly MAX_DISTANCE_TO_SQUARE = 4.0;
    protected static readonly MIN_NEAR_PLANE_FACTOR = 4.0;

    protected _camera: Camera;

    protected _coordsAccess: CoordsAccess;

    /**
     * Tuple for initial (initiate) two screen space and world space position pairs.
     */
    protected initialPoints = [new Vertex(), new Vertex()];
    /**
     * Tuple for current (update) two screen space and world space position pairs.
     */
    protected currentPoints = [new Vertex(), new Vertex()];

    protected initialEye = vec3.create();
    protected initialCenter = vec3.create();
    protected initialViewProjectionInverse = mat4.create();

    protected _override: boolean;

    protected _maxNegativeTranslate: vec3 | undefined;
    protected _maxPositiveTranslate: vec3 | undefined;

    // protected _minYAboveSceneGeometry: number;
    protected _minScale: number | undefined;
    protected _maxScale: number | undefined;

    protected _xAxisScreenSpace = vec3.create();

    protected _maxAngles: [number | undefined, number] = [+Math.PI * 0.6666 - Math.PI, (90.0 - 30.0) * DEG2RAD - Math.PI];
    protected _minAngles: [number | undefined, number] = [-Math.PI * 0.6666 - Math.PI, -Math.PI + 1.0 * DEG2RAD];

    /**
     * Reference plane in hesse normal form. This is used for coordinate retrieval after initiation.
     * Value sequence: location, unit normal, distance from origin to plane.
     */
    protected referencePlane: [vec3, vec3, number] = [vec3.create(), vec3.create(), 0.0];

    get valid(): boolean {
        return undefined !== this.initialPoints[0].world;
    }

    set camera(camera: Camera) {
        this._camera = camera;
    }

    needStart(): boolean {
        return this._maxAngles === undefined || this._minAngles === undefined;
    }

    set coordsAccess(coordsAccess: CoordsAccess) {
        this._coordsAccess = coordsAccess;
    }

    protected static rayY0SquareIntersection(ray0: vec3, ray1: vec3): vec3 | undefined {
        const intersection = ray_math.rayPlaneIntersection(ray0, ray1);
        if (undefined === intersection) {
            return undefined;
        }

        const i2 = vec2.fromValues(intersection[0], intersection[2]);
        const withinSquare = ray_math.isPointWithinSquare(i2, NavigationModifier.HALF_SQUARE_LENGTH);

        return withinSquare ? intersection : undefined;
    }

    protected assert_valid(): void {
        // assert(this.valid, `${this} expected to be valid`);
    }

    protected invalidate(): void {
        this.initialPoints[0].world = undefined;
        this.currentPoints[0].world = undefined;
        this.initialPoints[1].world = undefined;
        this.currentPoints[1].world = undefined;
    }

    /**
     * Compute TRANSLATION CONSTRAINTS: the camera's center is restricted to y = 0 and to be within the
     * square. The maximum allowed translation distance for x and z-axis is given by the distance of the
     * camera's center to the square edges for each of the axes.
     * @param override - If true, minimal translate constraints are used. Preferred constraints are
     * applied otherwise.
     */
    protected initiateTranslateConstraints(override: boolean): void {
        if (override) {
            this._maxNegativeTranslate = undefined;
            this._maxPositiveTranslate = undefined;
            return;
        }

        const lowerLeft = vec3.fromValues(-1.0, 0.0, -1.0);
        const upperRight = vec3.fromValues(+1.0, 0.0, +1.0);

        this._maxNegativeTranslate = vec3.sub(v3(), lowerLeft, this.initialCenter);
        this._maxPositiveTranslate = vec3.sub(v3(), upperRight, this.initialCenter);
    }

    /**
     * Compute SCALE CONSTRAINTS: (1) the camera's eye is expected to reside above a plane at scene
     * height (including as safety offset accounting for the camera's z-near value). (2) the maximum
     * distance between the camera's eye and the center is limited by a preset value. (3) This
     * constraint is enforced within scale.
     * @param override - If true, minimal scale constraints are used. Preferred constraints are applied
     * otherwise.
     */
    protected initiateScaleConstraints(override: boolean): void {
        const centerToEye = vec3.sub(v3(), this.initialEye, this.initialCenter);
        /* Valid scale constraints are expected for scaling, skip only when no subsequent scales are
        expected. */

        /**
         * Compute the minimal allowed scale (for the distance from camera eye to initial point 0) for
         * enforcement of scale constraints: the camera's eye must be above scene height.
         */
        const lInverse = 1.0 / vec3.length(centerToEye);
        if (override) {
            this._minScale = this._camera.near * lInverse - 1.0;
            this._maxScale = this._camera.far * lInverse - 1.0;
            return;
        }

        const intersection = ray_math.rayPlaneIntersection(this.initialEye, this.initialCenter
            , [0.0, 0.0, 0.0], [0.0, 1.0, 0.0]);
        if (!intersection) {
            return;
        }

        this._minScale = this._camera.near * NavigationModifier.MIN_NEAR_PLANE_FACTOR * lInverse - 1.0;

        /**
         * Compute the maximal allowed scale (for the distance from camera eye to initial point 0) for
         * enforcement of scale constraints: the camera's eye must be a certain distance away from the
         * camera's center.
         */
        this._maxScale = NavigationModifier.MAX_DISTANCE_TO_SQUARE * lInverse - 1.0;
    }

    /**
     * Compute ROTATE CONSTRAINTS: (1) y-axis rotation is limited to a small range, always keeping the
     * front of the square in 'forward facing'. This decreases chance of unintended orientation and
     * miscommunication of the depicted geometry. (2) the x-axis rotation stop near the bottom (cannot
     * move eye below y = 0), further more an additional angular offset is used to make square
     * translation feasible (full front view does not expose square are to pan on). x-axis rotation also
     * stops right before reaching the up-vector.
     * @param override - If true, minimal rotate constraints are used. Preferred constraints are applied
     * otherwise.
     */
    protected initiateRotateConstraints(override: boolean): void {
        const centerToEyeRay = vec3.normalize(v3(),
            vec3.sub(v3(), this.initialEye, this.initialCenter));
        this._xAxisScreenSpace = vec3.cross(v3(), [0.0, 1.0, 0.0], centerToEyeRay);

        const yAngle = Math.acos(vec3.dot(centerToEyeRay, [0.0, 1.0, 0.0]));

        /** @todo refine horizontal rotation constraints */

        this._maxAngles = [undefined, (90.0 - 0.01) * DEG2RAD - yAngle];
        this._minAngles = [undefined, -yAngle + 0.01 * DEG2RAD];

        if (override) {
            return;
        }

        const centerToEyeRay2 = vec2.normalize(v2(), [centerToEyeRay[0], centerToEyeRay[2]]);
        let xAngle = Math.asin(vec2.dot(centerToEyeRay2, [1.0, 0.0]));
        if (centerToEyeRay2[1] < 0.0) {
            xAngle = sign(xAngle) * Math.PI - xAngle;
        }

        /** @todo move magic numbers to interaction configuration or static member... */
        this._maxAngles = [+Math.PI * 0.6666 - xAngle, (90.0 - 30.0) * DEG2RAD - yAngle];
        this._minAngles = [-Math.PI * 0.6666 - xAngle, -yAngle + 1.0 * DEG2RAD];
    }

    /**
     * Derive 3D coordinates in world (intersections with scene geometry or square), save required
     * camera properties as initial/reference for applying transformations later (@see apply), and
     * create the reference plane for intersection computations in subsequent updates (@see update). The
     * two positions might not be order independent: The first position (pos0) is used as primary
     * reference, the second position (pos1) as secondary reference. For a valid transformation at least
     * a primary position is required.
     * @param pos0 - 2D position in view/canvas space for initial contact point retrieval (primary)
     * @param pos1 - 2D position in view/canvas space for initial contact point retrieval (secondary)
     * @param constraints - Flags for initialization of various constraints [translate, scale, rotate].
     * This is intended to reduce the amount of computations when targeting specific transformations.
     * @param override - Whether or not the constraints should restrictive or minimal (override).
     */
    initiate(pos0: vec2, pos1?: vec2
        , constraints: boolean[] = [false, false, false], override: boolean = false): boolean {
        this._override = override;

        const viewProjectionInverse = this._camera.viewProjectionInverse;
        if (!viewProjectionInverse) {
            return false;
        }
        mat4.copy(this.initialViewProjectionInverse, viewProjectionInverse);
        vec3.copy(this.initialEye, this._camera.eye);
        vec3.copy(this.initialCenter, this._camera.center);

        vec2.copy(this.initialPoints[0].screen!, pos0);
        this.initialPoints[0].world = this.coordsAt(pos0, false);
        if (undefined === this.initialPoints[0].world) {
            this.invalidate();
            return false;
        }
        this.initialPoints[1].screen = undefined === pos1 ? undefined : vec2.copy(v2(), pos1);
        this.initialPoints[1].world = this.coordsAt(pos1!, false);

        // Derive reference plane for upcoming coordinate retrieval.
        this.referencePlane[0] = this.initialPoints[0].world!;
        this.referencePlane[1] = vec3.fromValues(0.0, 1.0, 0.0);
        this.referencePlane[2] = vec3.length(this.initialPoints[0].world!);

        /**
         * @todo implement the plane computation given two points
         */

        /* The camera's center is expected to be constrained to the ground plane y = 0. */
        assert(this.initialCenter[1] === 0.0,
            `camera center is expected to be on y = 0 (ground plane)`);

        // this._minYAboveSceneGeometry = NavigationModifier.MIN_NEAR_PLANE_FACTOR * this._camera.near;

        if (constraints[0]) {
            this.initiateTranslateConstraints(override);
        }
        if (constraints[1]) {
            this.initiateScaleConstraints(override);
        }
        if (constraints[2]) {
            this.initiateRotateConstraints(override);
        }

        return true;
    }

    /**
     *
     * @param pos0 - 2D position in view/canvas space for subsequent contact point retrieval
     * @param pos1 - 2D position in view/canvas space for subsequent contact point retrieval
     *
     * @return True if the update resulted in valid current positions.
     */
    update_positions(pos0: vec2, pos1?: vec2): boolean {
        this.assert_valid();

        /* Subsequent intersections always hit the reference plane (except when override). */
        this.currentPoints[0].world = this.coordsAt(pos0);
        if (this._override && undefined === this.currentPoints[0].world) {
            this.invalidate();
            return false;
        }
        vec2.copy(this.currentPoints[0].screen!, pos0);

        if (undefined === pos1) {
            return true;
        }

        this.currentPoints[1].world = this.coordsAt(pos1);
        if (this._override && undefined === this.currentPoints[1].world) {
            this.invalidate();
            return false;
        }
        this.currentPoints[1].screen = undefined === pos1 ? undefined : vec2.copy(v2(), pos1);

        return true;
    }

    /**
     * Creates a transform for translating the camera eye and center by the difference between the
     * initial intersection point with the scene and subsequent intersections with the initial reference
     * plane. This results in a constrained panning with the user holding the initial contact point
     * within the scene in hand.
     */
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
            scale = -sign(step) * NavigationModifier.SCALE_STEP_FACTOR;
        }
        scale = clamp(scale * NavigationModifier.SCALE_FACTOR, this._minScale!, this._maxScale!);

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
        vec2.scale(magnitudes, magnitudes, window.devicePixelRatio * NavigationModifier.ROTATE_FACTOR);

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

    /**
     * Computes a world space position based on view space position. Note that if no geometry is hit,
     * i.e., the far plane is hit, a position on a square y = 0 in [-2,-2] to [+2,+2] is returned. If
     * this is not hit as well, undefined is returned.
     * @param pos - Position in view space (canvas space).
     * @returns The world space position represented at the view/canvas space position pos. If pos is
     * undefined, undefined is returned.
     */
    coordsAt(pos: vec2, reference: boolean = true): vec3 | undefined {
        if (pos === undefined) {
            return undefined;
        }

        const viewProjectionInverse = reference ?
            this.initialViewProjectionInverse : this._camera.viewProjectionInverse;

        if (reference) {
            assert(undefined !== this.referencePlane[0] && undefined !== this.referencePlane[1]
                , `valid reference plane expected for reference coordinate retrieval`);

            const ln = this._coordsAccess(pos[0], pos[1], 0.0, viewProjectionInverse!);
            const lf = this._coordsAccess(pos[0], pos[1], 1.0, viewProjectionInverse!);

            return ray_math.rayPlaneIntersection(ln!, lf!,
                this.referencePlane[0], this.referencePlane[1]);
        }

        // Intersection with scene geometry (depth buffer look-up):
        const intersection = this._coordsAccess(pos[0], pos[1], undefined, viewProjectionInverse!);
        if (undefined !== intersection) {
            return intersection;
        }

        // Intersection with square y = 0 in [-2,-2] to [+2,+2]:
        const ln = this._coordsAccess(pos[0], pos[1], 0.0, viewProjectionInverse!);
        const lf = this._coordsAccess(pos[0], pos[1], 1.0, viewProjectionInverse!);

        return NavigationModifier.rayY0SquareIntersection(ln!, lf!);
    }

    update(): void { }
}
