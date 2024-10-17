
/* spellchecker: disable */

import { auxiliaries, gl_matrix_extensions, tuples, vec3 } from 'webgl-operate';
import {
    Camera,
    ChangeLookup,
    Context,
    Framebuffer,
    Initializable,
    Program,
    Shader,
} from 'webgl-operate';

import { CuboidGeometry } from './cuboidgeometry';
import { MultiRenderTarget } from './multirendertarget';
import { Topology } from './topology';

import CUBOID_VERT_SOURCE from './shaders/cuboid.vert';
import CUBOID_FRAG_SOURCE from './shaders/cuboid.frag';

/* spellchecker: enable */


/**
 * This pass renders cuboids by rendering faces with the same orientation at the same time. Because of
 * this, only one instanced draw call per face orientation is necessary. The face rendering order is
 * optimized to minimize fill rate and faces which can not be seen due to camera orientation are culled
 * before rendering.
 */
export class CuboidRenderPass extends Initializable {

    /**
     * All cuboid render stages share the same geometry template per context. This template can be
     * created and/or accessed using getOrCreateTemplateVBO.
     */
    protected static GEOMETRY_BY_CONTEXT = new Map<Context, CuboidGeometry>();

    /**
     * Since the object handle is garbage collected, but not the actual references WebGL object, this
     * is used to track all references to this classes geometry templates for correct deallocation.
     */
    protected static REFCOUNT_BY_GEOMETRY = new Map<CuboidGeometry, number>();

    public static OUTLINE_WIDTH_DEFAULT = 0.8;
    public static EMPHASIS_OUTLINE_WIDTH_DEFAULT = 1.6;


    /**
     * Used to avoid compiler optimization that is removing the context.standardDerivatives call in
     * order to activate the function. @todo patch this in webgl-operate #102
     */
    private _standardDerivatives: any = undefined;


    /**
     * Reference to the shared geometry template used for draw.
     */
    protected _geometry: CuboidGeometry;

    /**
     * Alterable auxiliary object for tracking changes on render pass inputs and lazy updates.
     */
    protected readonly _altered = Object.assign(new ChangeLookup(), {
        any: true, camera: true, geometry: true,
        colorTable: true, colorTableLength: true,
        emphases: true,
        heightScale: true,
        outlineWidth: true, emphasisOutlineWidth: true,
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

    /** @see {@link colorTable} */
    protected _colorTable: Float32Array;


    /**
     * Tree topology to extract leaf node indices
     */
    protected _topology: Topology;

    /** @see {@link heightScale} */
    protected _heightScale: number;

    /** @see {@link outlineWidth} */
    protected _outlineWidth = CuboidRenderPass.OUTLINE_WIDTH_DEFAULT;

    /** @see {@link emphasisOutlineWidth} */
    protected _emphasisOutlineWidth = CuboidRenderPass.EMPHASIS_OUTLINE_WIDTH_DEFAULT;

    /** @see {@link attachment} */
    protected _attachment: MultiRenderTarget.Attachment = MultiRenderTarget.Attachment.Undefined;


    /**
     * The actual sequence of face types that is drawn.
     */
    protected _faceSequence = new Array<CuboidRenderPass.Face>();
    /**
     * per face data: front face, normal, lambert (todo, lambert will be moved to deferred shading)
     * -> lambert is a static, face-based, fake intensity attenuation for static 'illumination' without
     * an actual light.
     */
    protected _faceData = new Map<CuboidRenderPass.Face, tuples.GLfloat4>();

    protected _drawRestricted: boolean;

    /** @see {@link emphasisOutlineWidth} */
    protected _depthMask: boolean;

    protected _program: Program;
    protected _uAttachment: WebGLUniformLocation | undefined;
    protected _uViewProjection: WebGLUniformLocation | undefined;
    protected _uNdcOffset: WebGLUniformLocation | undefined;
    protected _uColorTable: WebGLUniformLocation | undefined;

    protected _uFace: WebGLUniformLocation | undefined;
    protected _uNormalAndLambert: WebGLUniformLocation | undefined;
    protected _uHeightScale: WebGLUniformLocation | undefined;
    protected _uOutlineWidth: WebGLUniformLocation | undefined;
    protected _uEmphasisOutlineWidth: WebGLUniformLocation | undefined;

    /**
     * Checks whether or not cuboid geometry was created for the current context and returns it. If no
     * geometry was created yet, it is created on the fly, and expected to be initialized within the
     * initialization call.
     * @param context - Wrapped gl context for vertex buffer look-up (one pre context).
     */
    protected static referenceGeometry(context: Context): CuboidGeometry {
        let geometry: CuboidGeometry;
        if (CuboidRenderPass.GEOMETRY_BY_CONTEXT.has(context)) {
            geometry = CuboidRenderPass.GEOMETRY_BY_CONTEXT.get(context)!;
        } else {
            geometry = new CuboidGeometry(context, 'CuboidGeometry');
            geometry.initialize();

            CuboidRenderPass.GEOMETRY_BY_CONTEXT.set(context, geometry);
            CuboidRenderPass.REFCOUNT_BY_GEOMETRY.set(geometry, 0);
        }
        const referenceCount = CuboidRenderPass.REFCOUNT_BY_GEOMETRY.get(geometry)! + 1;
        CuboidRenderPass.REFCOUNT_BY_GEOMETRY.set(geometry, referenceCount);
        return geometry;
    }

    /**
     * Unreferences the geometry. This decrements the reference count per context. If the reference
     * count reaches zero, the geometry is deleted.
     * @param context - Wrapped gl context for vertex buffer look-up (one pre context).
     */
    protected static unreferenceGeometry(context: Context): void {
        if (!CuboidRenderPass.GEOMETRY_BY_CONTEXT.has(context)) {
            return;
        }
        const geometry = CuboidRenderPass.GEOMETRY_BY_CONTEXT.get(context)!;
        const referenceCount = CuboidRenderPass.REFCOUNT_BY_GEOMETRY.get(geometry)! - 1;
        CuboidRenderPass.REFCOUNT_BY_GEOMETRY.set(geometry, referenceCount);

        if (referenceCount > 0) {
            return;
        }
        geometry.uninitialize();
        CuboidRenderPass.GEOMETRY_BY_CONTEXT.delete(context);
        CuboidRenderPass.REFCOUNT_BY_GEOMETRY.delete(geometry);
    }


    /**
     *
     * @param context -
     */
    constructor(context: Context) {
        super();
        this._context = context;

        this._drawRestricted = !this._context.isWebGL2 && !this._context.supportsDrawBuffers;

        this._program = new Program(context, 'CuboidRenderProgram');
        this._geometry = CuboidRenderPass.referenceGeometry(context);
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
        this._program.attribute('a_areaScale', this._geometry.areaScaleLocation);
        this._program.attribute('a_color', this._geometry.colorLocation);
        this._program.attribute('a_emphasis', this._geometry.emphasisLocation);
        this._program.attribute('a_heights', this._geometry.heightLocation);
        this._program.attribute('a_texCoord', this._geometry.texCoordLocation);

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
        this._uFace = this._program.uniform('u_face');
        this._uNormalAndLambert = this._program.uniform('u_normalAndLambert');
        this._uHeightScale = this._program.uniform('u_heightScale');
        this._uOutlineWidth = this._program.uniform('u_outlineWidth');
        this._uEmphasisOutlineWidth = this._program.uniform('u_emphasisOutlineWidth');
    }


    @Initializable.assert_initialized()
    protected optimizeFaceSequence(): void {
        const eye = this._camera.eye;
        const center = this._camera.center;

        let sequence = new Array<[CuboidRenderPass.Face, number]>();

        const view = vec3.create();
        vec3.sub(view, eye, center);
        vec3.normalize(view, view);

        /**
         * This is a two stage test: first, the camera position is used to discard faces whose front
         * faces cannot be seen. This can easily be determined by comparing the camera position to the
         * bounding box of all cuboids. Currently, [-1,+1] is set for x and z, and y = 0 layer is used
         * for masking top and bottom faces (a cuboid might have a height of 0). Second, the angle
         * between the view direction of the camera and the face normal is used to prioritize a non
         * masked face over another.
         */
        if (eye[1] > 0.0) {
            sequence.push([CuboidRenderPass.Face.Top,
            Math.abs(vec3.dot(vec3.fromValues(0.0, +1.0, 0.0), view))]);
        } /* For now, bottom faces are not scheduled for rendering. */

        if (eye[2] > -1.0) {
            sequence.push([CuboidRenderPass.Face.Front,
            Math.abs(vec3.dot(vec3.fromValues(0.0, 0.0, +1.0), view))]);
        }
        if (eye[2] < +1.0) {
            sequence.push([CuboidRenderPass.Face.Back,
            Math.abs(vec3.dot(vec3.fromValues(0.0, 0.0, -1.0), view))]);
        }
        if (eye[0] > -1.0) {
            sequence.push([CuboidRenderPass.Face.Left,
            Math.abs(vec3.dot(vec3.fromValues(+1.0, 0.0, 0.0), view))]);
        }
        if (eye[0] < +1.0) {
            sequence.push([CuboidRenderPass.Face.Right,
            Math.abs(vec3.dot(vec3.fromValues(-1.0, 0.0, 0.0), view))]);
        }
        sequence = sequence.sort((face0, face1) => face1[1] - face0[1]);

        this._faceSequence = sequence.map((tuple) => tuple[0]);
    }


    @Initializable.initialize()
    initialize(): boolean {
        const gl = this._context.gl;

        /* Note that storing the extension has no use except preventing the compiler to remove the
        context call. */
        if (this._context.isWebGL1 && this._standardDerivatives === undefined) {
            this._context.enable(['OES_standard_derivatives']);
            this._standardDerivatives = this._context.standardDerivatives;
        }

        const vert = new Shader(this._context, gl.VERTEX_SHADER, 'cuboid.vert');
        vert.initialize(CUBOID_VERT_SOURCE, false);
        const frag = new Shader(this._context, gl.FRAGMENT_SHADER, 'cuboid.frag');
        frag.initialize(CUBOID_FRAG_SOURCE, false);

        this._program.initialize([vert, frag], false);


        /** @todo expose lambert to API. */
        this._faceData.set(CuboidRenderPass.Face.Top, [0.0, 1.0, 0.0, 1.00]);
        this._faceData.set(CuboidRenderPass.Face.Bottom, [0.0, -1.0, 0.0, 0.68]);
        this._faceData.set(CuboidRenderPass.Face.Front, [0.0, 0.0, 1.0, 0.88]);
        this._faceData.set(CuboidRenderPass.Face.Back, [0.0, 0.0, -1.0, 0.88]);
        this._faceData.set(CuboidRenderPass.Face.Left, [1.0, 0.0, 0.0, 0.84]);
        this._faceData.set(CuboidRenderPass.Face.Right, [-1.0, 0.0, 0.0, 0.84]);

        return true;
    }

    @Initializable.uninitialize()
    uninitialize(): void {
        CuboidRenderPass.unreferenceGeometry(this._context);
        this._program.uninitialize();

        this._uAttachment = undefined;
        this._uViewProjection = undefined;
        this._uNdcOffset = undefined;
        this._uColorTable = undefined;
        this._uFace = undefined;
        this._uNormalAndLambert = undefined;
        this._uHeightScale = undefined;
        this._uOutlineWidth = undefined;
        this._uEmphasisOutlineWidth = undefined;
    }


    @Initializable.assert_initialized()
    update(): void {
        const gl = this._context.gl;

        let relinked = false;

        if (!this._program.initialized || !this._program.linked || this._altered.colorTableLength) {
            this.relink();
            if (!this._program.linked) {
                return;
            }

            relinked = true;
        }
        this._program.bind();

        if (relinked || this._altered.camera || this._camera.altered) {
            gl.uniformMatrix4fv(this._uViewProjection, false, this._camera.viewProjection);
            this.optimizeFaceSequence();
        }
        if (relinked || this._colorTable) {
            gl.uniform4fv(this._uColorTable, this._colorTable);
        }
        if (this._altered.geometry && this._geometry.valid) {
            this._geometry.update();
        }
        if (relinked || this._altered.heightScale) {
            gl.uniform1f(this._uHeightScale, this._heightScale / 255.0);
        }
        if (relinked || this._altered.outlineWidth) {
            gl.uniform1f(this._uOutlineWidth, this._outlineWidth);
        }
        if (relinked || this._altered.emphasisOutlineWidth) {
            const devicePxRatio = window.devicePixelRatio;
            gl.uniform1f(this._uEmphasisOutlineWidth, this._emphasisOutlineWidth * devicePxRatio);
        }

        this._altered.reset();
    }

    @Initializable.assert_initialized()
    frame(): void {
        auxiliaries.assert(this._target && this._target.valid, `valid target expected`);

        if (this._colorTable === undefined || this._geometry.valid === undefined) {
            return;
        }

        const gl = this._context.gl;

        const size = this._target.size;
        gl.viewport(0, 0, size[0], size[1]);

        gl.enable(gl.CULL_FACE);
        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.STENCIL_TEST);

        gl.stencilFunc(gl.ALWAYS, 2, 0xff);
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

        for (const face of this._faceSequence) {
            gl.uniform1i(this._uFace, face);
            gl.uniform4fv(this._uNormalAndLambert, this._faceData.get(face));

            /* Face enum starts on 1 and four vertices are required per face, thus, (face - 1) * 4 is
            used as index. */

            /**
             * Fix for Mac OS drawArraysInstanced issue (only on integrated graphics, e.g.,
             * Intel 615 HD). drawArrays offset is applied to all attribute buffers as well ...
             * thus, instead of starting at an offset vertex, the vertex buffer itself is
             * shifted and instancing always starts at index 0.
             */
            const macOsOffset = (face as GLint - 1) * CuboidGeometry.BYTES_PER_VERTEX * 4;

            this._topology.sliceRangeDo(this._topology.depth - 1, (start: number, end: number) => {
                const offset = start - this._topology.numberOfInnerNodes;
                const count = end - start + 1;

                this._geometry.draw(offset, macOsOffset, count);
            });
        }

        // this._target.unbind();

        /* Every stage is expected to bind its own vao when drawing, unbinding is not necessary. */
        // this._geometry.unbind();
        /* Every stage is expected to bind its own program when drawing, unbinding is not necessary. */
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
     * Set `colorTableLength` status to altered. We use this function insteaf of making the
     * altered-property public.
     */
    colorTableLengthAltered(): void {
        this._altered.alter('colorTableLength');
    }

    /**
     * Sets the framebuffer the cuboids are rendered to.
     * @param target - Framebuffer to render into.
     */
    set target(target: Framebuffer) {
        this.assertInitialized();
        this._target = target;
    }

    set topology(topology: Topology) {
        this._topology = topology;
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
     * The camera eye and center are used to derive a better face sequence. The face sequence is a list
     * of face indices that are to be drawn. Note that this renderer renders stacked cuboids by
     * rendering all axis-aligned faces with the same orientation in a single draw call (per cuboid).
     * The sequence is used to (1) mask faces that, based on the current camera, are not required to be
     * rendered at all, and (2) prioritize the faces in an attempt to reduce the fill-rate/fragment
     * operations by favoring faces-orientation with respect to the camera.
     */
    set camera(camera: Camera) {
        this.assertInitialized();
        if (this._camera === camera) {
            return;
        }
        this._camera = camera;
        this._altered.alter('camera');
    }

    set layoutData(data: Float32Array) {
        this.assertInitialized();
        this._geometry.layout = data;
        this._altered.alter('geometry');
    }

    set ids(data: Uint8Array) {
        this.assertInitialized();
        this._geometry.ids = data;
        this._altered.alter('geometry');
    }

    set areaScales(data: Uint8Array) {
        this.assertInitialized();
        this._geometry.areaScales = data;

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

    set heights(data: Uint8Array) {
        this.assertInitialized();
        this._geometry.heights = data;
        this._altered.alter('geometry');
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
     * Height scale applied to height computation within shader.
     */
    set heightScale(scale: number | undefined) {
        this.assertInitialized();
        if (this._heightScale === scale) {
            return;
        }
        this._heightScale = scale === undefined ? 0.0 : gl_matrix_extensions.clamp(scale, 0.0, 1.0);
        this._altered.alter('heightScale');
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


export namespace CuboidRenderPass {

    export enum Face { Top = 1, Bottom = 2, Front = 3, Back = 4, Left = 5, Right = 6 }

}
