
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

import { ScreenAlignedQuadGeometry } from './screenalignedquadgeometry';

import SAQ_VERT_SOURCE from './shaders/screenalignedquad.vert';
import SAQ_FRAG_SOURCE from './shaders/screenalignedquad.frag';

/* spellchecker: enable */

/**
 * This renders screen-aligned 2D quads by specifying the position of the lower left corner
 * (origin) in 3D and the 2D extent. One of the three corners will stay 'pointy', while the others will
 * be round. The round corners will be shaped in the fragment shader.
 */
export class ScreenAlignedQuadRenderPass extends Initializable {

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

    /** @see {@link depthMask} */
    protected _depthMask: boolean;

    protected _program: Program;

    protected _uViewProjection: WebGLUniformLocation | undefined;
    protected _uNdcOffset: WebGLUniformLocation | undefined;
    protected _uAspectRatio: WebGLUniformLocation | undefined;

    protected _geometry: ScreenAlignedQuadGeometry;

    constructor(context: Context) {
        super();
        this._context = context;

        this._program = new Program(context, 'ScreenAlignedQuadRenderProgram');
        this._geometry = new ScreenAlignedQuadGeometry(this._context, 'ScreenAlignedQuad');
    }

    @Initializable.assert_initialized()
    protected relink(): void {

        for (const shader of this._program.shaders) {
            shader.compile();
        }

        this._program.attribute('a_vertex', this._geometry.vertexLocation);
        this._program.attribute('a_origin', this._geometry.originLocation);
        this._program.attribute('a_extent', this._geometry.extentLocation);
        this._program.attribute('a_offset', this._geometry.offsetLocation);
        this._program.attribute('a_pointyCorner', this._geometry.pointyCornerLocation);

        this._program.link();
        if (!this._program.linked) {
            return;
        }

        this._uViewProjection = this._program.uniform('u_viewProjection');
        this._uNdcOffset = this._program.uniform('u_ndcOffset');
        this._uAspectRatio = this._program.uniform('u_aspectRatio');
    }

    @Initializable.initialize()
    initialize(): boolean {
        const gl = this._context.gl;

        const vert = new Shader(this._context, gl.VERTEX_SHADER, 'screenalignedquad.vert');
        vert.initialize(SAQ_VERT_SOURCE, false);
        const frag = new Shader(this._context, gl.FRAGMENT_SHADER, 'screenalignedquad.frag');
        frag.initialize(SAQ_FRAG_SOURCE, false);

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
        this._uAspectRatio = undefined;
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
            gl.uniform1f(this._uAspectRatio, 1.0 / this._camera.aspect);
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
     * Sets the framebuffer the quads are rendered to.
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
     * Sets the camera, from where the view projection matrix and the aspect ratio will be retrieved.
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
     * Sets/updates the geometry data for this pass.
     * @param origins - the world position of the lower left corner of each quad
     * @param extents - the extents of the quads in NDC
     * @param offsets - the offsets of the quads' position in NDC
     * @param pointyCorners - the pointy corners of the quads
     */
    updateData(origins: Float32Array, extents: Float32Array, offsets: Float32Array,
        pointyCorners: Uint8Array): void {

        this._geometry.updateData(origins, extents, offsets, pointyCorners);
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

