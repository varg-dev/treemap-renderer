
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

import { CuboidRenderPass } from './cuboidrenderpass';
import { MultiRenderTarget } from './multirendertarget';
import { QuadGeometry } from './quadgeometry';
import { Topology } from './topology';

import QUAD_VERT_SOURCE from './shaders/quad.vert';
import QUAD_FRAG_SOURCE from './shaders/quad.frag';

/* spellchecker: enable */


export class QuadRenderPass extends Initializable {

    private _standardDerivatives: any = undefined;


    /**
     * Alterable auxiliary object for tracking changes on render pass inputs and lazy updates.
     */
    protected readonly _altered = Object.assign(new ChangeLookup(), {
        any: false, camera: false, geometry: false,
        colorTable: false, emphases: false,
        outlineWidth: true, emphasisOutlineWidth: true,
    });


    /**
     * Tree topology to extract leaf node indices
     */
    protected _topology: Topology;

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

    /** @see {@link colorTable} */
    protected _colorTable: Float32Array | undefined;

    protected _showRoot = false;

    /** @see {@link outlineWidth} */
    protected _outlineWidth = CuboidRenderPass.OUTLINE_WIDTH_DEFAULT;

    /** @see {@link emphasisOutlineWidth} */
    protected _emphasisOutlineWidth = CuboidRenderPass.EMPHASIS_OUTLINE_WIDTH_DEFAULT;


    /** @see {@link attachment} */
    protected _attachment: MultiRenderTarget.Attachment = MultiRenderTarget.Attachment.Undefined;


    protected _drawRestricted: boolean;

    /** @see {@link depthMask} */
    protected _depthMask: boolean;


    protected _program: Program;

    protected _uAttachment: WebGLUniformLocation | undefined;
    protected _uViewProjection: WebGLUniformLocation | undefined;
    protected _uNdcOffset: WebGLUniformLocation | undefined;
    protected _uColorTable: WebGLUniformLocation | undefined;

    protected _uOutlineWidth: WebGLUniformLocation | undefined;
    protected _uEmphasisOutlineWidth: WebGLUniformLocation | undefined;

    protected _geometry: QuadGeometry;


    constructor(context: Context) {
        super();
        this._context = context;

        this._program = new Program(context, 'QuadRenderProgram');
        this._geometry = new QuadGeometry(this._context, 'Quad');
    }

    @Initializable.assert_initialized()
    protected relink(): void {
        if (this._colorTable === undefined) {
            return;
        }

        for (const shader of this._program.shaders) {
            shader.replace('$ColorTableLength', String(this._colorTable.length / 4));
        }

        this._program.attribute('a_vertex', this._geometry.vertexLocation);
        this._program.attribute('a_layout', this._geometry.layoutLocation);
        this._program.attribute('a_id', this._geometry.idLocation);
        this._program.attribute('a_color', this._geometry.colorLocation);
        this._program.attribute('a_emphasis', this._geometry.emphasisLocation);

        for (const shader of this._program.shaders) {
            shader.compile();
        }

        this._program.link();
        if (!this._program.linked) {
            return;
        }

        if (this._drawRestricted) {
            this._uAttachment = this._program.uniform('u_attachment');
        }

        this._uViewProjection = this._program.uniform('u_viewProjection');
        this._uNdcOffset = this._program.uniform('u_ndcOffset');
        this._uColorTable = this._program.uniform('u_colorTable');
        this._uOutlineWidth = this._program.uniform('u_outlineWidth');
        this._uEmphasisOutlineWidth = this._program.uniform('u_emphasisOutlineWidth');
    }


    @Initializable.initialize()
    initialize(): boolean {
        const gl = this._context.gl;

        this._drawRestricted = !this._context.isWebGL2 && !this._context.supportsDrawBuffers;

        /* Note that storing the extension has no use except preventing the compiler to remove the
        context call. */
        if (this._context.isWebGL1 && this._standardDerivatives === undefined) {
            this._context.enable(['OES_standard_derivatives']);
            this._standardDerivatives = this._context.standardDerivatives;
        }

        const vert = new Shader(this._context, gl.VERTEX_SHADER, 'quad.vert');
        vert.initialize(QUAD_VERT_SOURCE, false);
        const frag = new Shader(this._context, gl.FRAGMENT_SHADER, 'quad.frag');
        frag.initialize(QUAD_FRAG_SOURCE, false);

        this._program.initialize([frag, vert], false);

        this._geometry.initialize();

        return true;
    }

    @Initializable.uninitialize()
    uninitialize(): void {
        this._geometry.uninitialize();
        this._program.uninitialize();

        this._uAttachment = undefined;
        this._uViewProjection = undefined;
        this._uNdcOffset = undefined;
        this._uColorTable = undefined;
        this._uOutlineWidth = undefined;
        this._uEmphasisOutlineWidth = undefined;
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
        if (this._colorTable) {
            gl.uniform4fv(this._uColorTable, this._colorTable);
        }
        if (this._altered.geometry && this._geometry.valid) {
            this._geometry.update();
        }
        if (this._altered.outlineWidth) {
            gl.uniform1f(this._uOutlineWidth, this._outlineWidth);
        }

        /** @todo do this only if target size, device pixel ratio or one affected config changes */
        if (this._target && this._target.valid) {
            gl.uniform1f(this._uEmphasisOutlineWidth,
                this._emphasisOutlineWidth * window.devicePixelRatio);
        }

        this._altered.reset();
    }

    @Initializable.assert_initialized()
    frame(): void {
        auxiliaries.assert(this._target && this._target.valid, `valid target expected`);
        if (this._colorTable === undefined) {
            return;
        }

        const gl = this._context.gl;

        const size = this._target.size;
        gl.viewport(0, 0, size[0], size[1]);

        gl.enable(gl.CULL_FACE);
        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.STENCIL_TEST);

        gl.stencilFunc(gl.GREATER, 1, 0xff);
        gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);

        /**
         * If rendering is restricted to any attachment > 0 the depth attachment or actual depth buffer
         * is used as is and no depth is written to the buffer.
         */
        if (this._depthMask === false) {
            gl.depthFunc(gl.LEQUAL);
            gl.depthMask(false);
        }

        this._program.bind();

        if (this._drawRestricted) {
            gl.uniform1i(this._uAttachment, this._attachment);
        }
        gl.uniform2fv(this._uNdcOffset, this._ndcOffset);

        this._geometry.bind();
        /* Controlling renderer is expected to bind the appropriate target, thus, unbinding is not
        necessary. */
        this._target.bind();

        if (this._geometry.valid) {
            const slices = this._topology.linearization.slices;

            const lastSlice = this._showRoot === false ? 1 : 0;
            for (let i = slices.length - 2; i >= lastSlice; --i) {
                const offset = slices[i][0];
                const count = slices[i][1] - slices[i][0] + 1;
                this._geometry.draw(offset, count);
            }
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

        gl.disable(gl.STENCIL_TEST);
        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.CULL_FACE);
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

    set camera(camera: Camera) {
        this.assertInitialized();
        if (this._camera === camera) {
            return;
        }
        this._camera = camera;
        this._altered.alter('camera');
    }

    set layout(data: Float32Array) {
        this.assertInitialized();
        this._geometry.layout = data;
        this._altered.alter('geometry');
    }

    set ids(data: Uint8Array) {
        this.assertInitialized();
        this._geometry.ids = data;
        this._altered.alter('geometry');
    }

    set colors(data: Uint8Array) {
        this.assertInitialized();
        this._geometry.colors = data;
        this._altered.alter('geometry');
    }

    set emphases(data: Uint8Array) {
        this.assertInitialized();
        this._geometry.emphases = data;
        this._altered.alter('emphases');

    }

    set showRoot(show: boolean) {
        this._showRoot = show;
    }

    set topology(topology: Topology) {
        this._topology = topology;
    }

    set colorTable(table: Float32Array) {
        this.assertInitialized();
        this._colorTable = table;
        this._altered.alter('colorTable');
    }

    /**
     * Width of the outlines of cuboids in native pixel (not scaled by device pixel ration).
     */
    set outlineWidth(width: number | undefined) {
        this.assertInitialized();
        if (this._outlineWidth === width) {
            return;
        }
        this._outlineWidth = width === undefined ?
            CuboidRenderPass.OUTLINE_WIDTH_DEFAULT : Math.max(0.0, width);
        this._altered.alter('outlineWidth');
    }

    /**
     * Specifies the width of the outlines of cuboids when emphasized in device-independent pixel.
     */
    set emphasisOutlineWidth(width: number | undefined) {
        this.assertInitialized();
        if (this._emphasisOutlineWidth === width) {
            return;
        }
        this._emphasisOutlineWidth = width === undefined ?
            CuboidRenderPass.EMPHASIS_OUTLINE_WIDTH_DEFAULT : Math.max(0.0, width);
        this._altered.alter('emphasisOutlineWidth');
    }

    /**
     * Sets the attachment which should be rendered to when multiple render targets are not available.
     */
    set attachment(attachment: MultiRenderTarget.Attachment) {
        auxiliaries.logIf(attachment !== MultiRenderTarget.Attachment.Undefined && !this._drawRestricted
            , auxiliaries.LogLevel.Debug, `expected WEBGL_draw_buffers to be unsupported`);
        this._attachment = attachment;
    }

    /**
     * Specifies whether or not to write or read-only the depth attachment. This can be used, e.g., when
     * multiple rendering passes are required and depth buffer can be kept (similar to z-pass).
     */
    set depthMask(flag: GLboolean) {
        this._depthMask = flag;
    }

}

