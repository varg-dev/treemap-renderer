
/* spellchecker: disable */

import { auxiliaries, tuples } from 'webgl-operate';

import {
    Camera,
    ChangeLookup,
    Context,
    Framebuffer,
    Initializable,
    Program,
    Shader,
} from 'webgl-operate';

import { PointGeometry } from './pointgeometry';

import POINT_VERT_SOURCE from './shaders/point.vert';
import POINT_FRAG_SOURCE from './shaders/point.frag';

/* spellchecker: enable */

/**
 * This class renders points at specified 3D positions. However, they will be drawn without
 * depth-testing, so they appear to be drawn as an overlay. All points use the same point size.
 */
export class PointRenderPass extends Initializable {

    /**
     * Alterable auxiliary object for tracking changes on render pass inputs and lazy updates.
     */
    protected readonly _altered = Object.assign(new ChangeLookup(), {
        any: false, camera: false, geometry: false,
    });

    /**
     * Read-only access to the objects context, used to get context information and WebGL API access.
     */
    protected _context: Context;

    /** @see {@link target} */
    protected _target: Framebuffer;

    /** @see {@link camera} */
    protected _camera: Camera;

    /** @see {@link ndcOffset} */
    protected _ndcOffset: tuples.GLfloat2;

    /** @see {@link pointSize} */
    protected _pointSize: number;

    /** @see {@link depthMask} */
    protected _depthMask: boolean;

    protected _program: Program;

    protected _uViewProjection: WebGLUniformLocation | undefined;
    protected _uNdcOffset: WebGLUniformLocation | undefined;
    protected _uPointSize: WebGLUniformLocation | undefined;

    protected _geometry: PointGeometry;

    constructor(context: Context) {
        super();
        this._context = context;

        this._program = new Program(context, 'PointRenderProgram');
        this._geometry = new PointGeometry(this._context, 'Point');
    }

    @Initializable.assert_initialized()
    protected relink(): void {

        for (const shader of this._program.shaders) {
            shader.compile();
        }

        this._program.attribute('a_vertex', this._geometry.vertexLocation);
        this._program.attribute('a_color', this._geometry.colorLocation);

        this._program.link();
        if (!this._program.linked) {
            return;
        }

        this._uViewProjection = this._program.uniform('u_viewProjection');
        this._uNdcOffset = this._program.uniform('u_ndcOffset');
        this._uPointSize = this._program.uniform('u_pointSize');
    }

    @Initializable.initialize()
    initialize(): boolean {
        const gl = this._context.gl;

        const vert = new Shader(this._context, gl.VERTEX_SHADER, 'point.vert');
        vert.initialize(POINT_VERT_SOURCE, false);
        const frag = new Shader(this._context, gl.FRAGMENT_SHADER, 'point.frag');
        frag.initialize(POINT_FRAG_SOURCE, false);

        this._program.initialize([frag, vert], false);

        this._geometry.initialize();

        return true;
    }

    @Initializable.uninitialize()
    uninitialize(): void {
        this._geometry.uninitialize();
        this._program.uninitialize();

        this._uViewProjection = undefined;
        this._uNdcOffset = undefined;
        this._uPointSize = undefined;
    }


    @Initializable.assert_initialized()
    update(): void {
        const gl = this._context.gl;

        if (!this._program.initialized || !this._program.linked) {
            this.relink();
            if (!this._program.linked) {
                return;
            }
        }
        this._program.bind();

        if (this._altered.camera || this._camera.altered) {
            gl.uniformMatrix4fv(this._uViewProjection, false, this._camera.viewProjection);
        }
        if (this._altered.geometry && this._geometry.valid) {
            this._geometry.update();
        }

        this._altered.reset();
    }

    @Initializable.assert_initialized()
    frame(): void {
        auxiliaries.assert(this._target && this._target.valid, `valid target expected`);

        const gl = this._context.gl;

        const size = this._target.size;
        gl.viewport(0, 0, size[0], size[1]);

        gl.disable(gl.DEPTH_TEST);
        gl.enable(gl.BLEND);
        /* Note that WebGL supports separate blend by default. */
        gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

        if (this._depthMask === false) {
            gl.depthFunc(gl.LEQUAL);
            gl.depthMask(false);
        }

        this._program.bind();

        gl.uniform2fv(this._uNdcOffset, this._ndcOffset);
        gl.uniform1f(this._uPointSize, this._pointSize * window.devicePixelRatio);

        this._geometry.bind();
        /* Controlling renderer is expected to bind the appropriate target, thus, unbinding is not
        necessary. */
        this._target.bind();

        if (this._geometry.valid) {
            this._geometry.draw();
        }

        // this._target.unbind();

        /* Every stage is expected to bind its own vao when drawing geometry, unbinding unnecessary. */
        // this._geometry.unbind();
        /* Every stage is expected to bind its own vao when drawing geometry, unbinding unnecessary. */
        // this._program.unbind();

        if (this._depthMask === false) {
            gl.depthFunc(gl.LESS);
            gl.depthMask(true);
        }

        gl.disable(gl.BLEND);
    }

    /**
     * Sets the framebuffer the points are rendered to.
     * @param target - Framebuffer to render into.
     */
    set target(target: Framebuffer) {
        this.assertInitialized();
        this._target = target;
    }

    /**
     * The NDC offset is used for vertex displacement within subpixel space for anti-aliasing over
     * multiple intermediate frames (multi-frame sampling).
     * @param offset - Subpixel offset used for vertex displacement (multi-frame anti-aliasing).
     */
    set ndcOffset(offset: tuples.GLfloat2) {
        this.assertInitialized();
        this._ndcOffset = offset;
    }

    /**
     * Sets the point size in pixel.
     */
    set pointSize(pointSize: number) {
        this._pointSize = pointSize;
    }

    /**
     * Sets the camera, from where the view projection matrix will be retrieved.
     */
    set camera(camera: Camera) {
        this.assertInitialized();
        if (this._camera === camera) {
            return;
        }
        this._camera = camera;
        this._altered.alter('camera');
    }

    /**
     * Set/update the 3D-positions of the points.
     */
    set positions(data: Float32Array) {
        this._geometry.vertices = data;
        this._altered.alter('geometry');
    }

    /**
     * Set/update the RGBA-colors of the points.
     */
    set colors(data: Float32Array) {
        this.assertInitialized();
        this._geometry.colors = data;
        this._altered.alter('geometry');
    }

    /**
     * Specifies whether or not to write or read-only the depth attachment. This can be used, e.g., when
     * multiple rendering passes are required and depth buffer can be kept (similar to z-pass).
     */
    set depthMask(flag: GLboolean) {
        this._depthMask = flag;
    }

}

