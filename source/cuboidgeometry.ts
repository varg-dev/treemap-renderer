
/* spellchecker: disable */

import { Buffer, Context, Geometry, Initializable } from 'webgl-operate';

/* spellchecker: enable */


export class CuboidGeometry extends Geometry {

    /**
     * All cuboid geometries share the same interleaved vertices/texture-coordinates buffer and
     * should be created only once per context. This template can be created and/or accessed using
     * referenceTemplateVBO.
     */
    protected static VERTICES_BY_CONTEXT = new Map<Context, Buffer>();

    /**
     * Since the object handle is garbage collected, but not the actual references WebGL object, this
     * is used to track all references to this classes template buffer for correct deallocation.
     */
    protected static REFCOUNT_BY_TEMPLATE = new Map<Buffer, number>();


    /**
     * Interleaved data comprises vertices (x, y, and z component) and texture coordinates (s and t).
     * The array is mainly used to encode face orientation directly instead of applying it in the
     * vertex shader. (First idea was to use a single face and transform it in the vertex shader using
     * the face id, increases workload per vertex though).
     */
    protected static readonly DATA = new Float32Array([
        0, 0, 0, 0, 0, /**/ 0, 0, 1, 0, 1, /**/ 1, 0, 0, 1, 0, /**/ 1, 0, 1, 1, 1, // top face
        0, 0, 0, 0, 0, /**/ 1, 0, 0, 1, 0, /**/ 0, 0, 1, 0, 1, /**/ 1, 0, 1, 1, 1, // bottom face
        0, 0, 1, 0, 0, /**/ 1, 0, 1, 1, 0, /**/ 0, 1, 1, 0, 1, /**/ 1, 1, 1, 1, 1, // front face
        0, 0, 0, 0, 0, /**/ 0, 1, 0, 0, 1, /**/ 1, 0, 0, 1, 0, /**/ 1, 1, 0, 1, 1, // back face
        1, 0, 0, 0, 0, /**/ 1, 1, 0, 0, 1, /**/ 1, 0, 1, 1, 0, /**/ 1, 1, 1, 1, 1, // left face
        0, 0, 0, 0, 0, /**/ 0, 0, 1, 1, 0, /**/ 0, 1, 0, 0, 1, /**/ 0, 1, 1, 1, 1, // right face
    ]);

    public static readonly BYTES_PER_VERTEX = CuboidGeometry.DATA.length / 6;

    /**
     * Handle to the single cuboid template of the context this geometry is used on.
     * @see {@link referenceTemplateVBO}
     */
    protected _vertices: Buffer;


    /**
     * The layout buffer for the cuboid geometry.
     */
    protected _layout: Buffer;

    /**
     * The ID buffer for the cuboid geometry.
     */
    protected _ids: Buffer;

    /**
     * The emphases buffer for the cuboid geometry.
     */
    protected _emphases: Buffer;

    protected _areaScales: Buffer;

    /**
     * Colors for the cuboid geometry.
     */
    protected _colors: Buffer;

    /**
     * Heights for the cuboid geometry.
     */
    protected _heights: Buffer;


    protected _vertexLocation: GLuint;
    protected _texCoordLocation: GLuint;

    protected _layoutLocation: GLuint;
    protected _idLocation: GLuint;
    protected _emphasisLocation: GLuint;

    protected _areaScaleLocation: GLuint;
    protected _colorLocation: GLuint;
    protected _heightLocation: GLuint;

    /**
     * Checks whether or not cuboid geometry template was created for the current context and returns
     * it. If no template was created yet, it is created on the fly, and expected to be initialized
     * within the initialization call.
     * @param context - Wrapped gl context for vertex buffer look-up (one pre context).
     */
    protected static referenceVerticesVBO(context: Context): Buffer {
        let vertices: Buffer;
        if (CuboidGeometry.VERTICES_BY_CONTEXT.has(context)) {
            vertices = CuboidGeometry.VERTICES_BY_CONTEXT.get(context)!;
        } else {
            vertices = new Buffer(context, 'CuboidVertexVBO');
            CuboidGeometry.VERTICES_BY_CONTEXT.set(context, vertices);
            CuboidGeometry.REFCOUNT_BY_TEMPLATE.set(vertices, 0);
        }
        const referenceCount = CuboidGeometry.REFCOUNT_BY_TEMPLATE.get(vertices)! + 1;
        CuboidGeometry.REFCOUNT_BY_TEMPLATE.set(vertices, referenceCount);
        return vertices;
    }

    /**
     * Unreferences the geometry. This decrements the reference count per context. If the reference
     * count reaches zero, the geometry is deleted.
     * @param context - Wrapped gl context for vertex buffer look-up (one pre context).
     */
    protected static unreferenceTemplateVBO(context: Context): void {
        if (!CuboidGeometry.VERTICES_BY_CONTEXT.has(context)) {
            return;
        }
        const template = CuboidGeometry.VERTICES_BY_CONTEXT.get(context)!;
        const referenceCount = CuboidGeometry.REFCOUNT_BY_TEMPLATE.get(template)! - 1;
        CuboidGeometry.REFCOUNT_BY_TEMPLATE.set(template, referenceCount);

        if (referenceCount > 0) {
            return;
        }
        template.uninitialize();
        CuboidGeometry.VERTICES_BY_CONTEXT.delete(context);
        CuboidGeometry.REFCOUNT_BY_TEMPLATE.delete(template);
    }


    /**
     * Object constructor, requires a context and an identifier.
     * @param context - Valid context to create the object for.
     * @param identifier - Meaningful name for identification of this instance.
     */
    constructor(context: Context, identifier?: string) {
        super(context, identifier);

        identifier = identifier !== undefined && identifier !== `` ? identifier : 'CuboidGeometry';

        this._vertices = CuboidGeometry.referenceVerticesVBO(context);
        this._buffers.push(this._vertices);

        this._layout = new Buffer(context, `${identifier}LayoutVBO`);
        this._buffers.push(this._layout);

        this._ids = new Buffer(context, `${identifier}IdVBO`);
        this._buffers.push(this._ids);

        this._emphases = new Buffer(context, `${identifier}EmphasisVBO`);
        this._buffers.push(this._emphases);

        this._areaScales = new Buffer(context, `${identifier}AreaScaleVBO`);
        this._buffers.push(this._areaScales);

        this._colors = new Buffer(context, `${identifier}ColorVBO`);
        this._buffers.push(this._colors);

        this._heights = new Buffer(context, `${identifier}HeightVBO`);
        this._buffers.push(this._heights);
    }


    /**
     * Binds the vertex buffer object (VBO) to an attribute binding point of a given, pre-defined index.
     */
    protected bindBuffers(_indices: Array<GLuint>): void {
        const gl = this.context.gl;
        const gl2facade = this.context.gl2facade;

        /* Please note the implicit bind in attribEnable. */
        this._vertices.attribEnable(this._vertexLocation,
            3, gl.FLOAT, false, 20, 0, true, false);
        gl2facade.vertexAttribDivisor(this._vertexLocation, 0);

        this._vertices.attribEnable(this._texCoordLocation,
            2, gl.FLOAT, false, 20, 12, true, false);
        gl2facade.vertexAttribDivisor(this._texCoordLocation, 0);

        this._layout.attribEnable(this._layoutLocation,
            4, gl.FLOAT, false, 0, 0, true, false);
        gl2facade.vertexAttribDivisor(this._layoutLocation, 1);

        this._ids.attribEnable(this._idLocation,
            4, gl.UNSIGNED_BYTE, false, 0, 0, true, false);
        gl2facade.vertexAttribDivisor(this._idLocation, 1);

        this._emphases.attribEnable(this._emphasisLocation,
            1, gl.UNSIGNED_BYTE, false, 0, 0, true, false);
        gl2facade.vertexAttribDivisor(this._emphasisLocation, 1);

        this._areaScales.attribEnable(this._areaScaleLocation,
            1, gl.UNSIGNED_BYTE, false, 0, 0, true, false);
        gl2facade.vertexAttribDivisor(this._areaScaleLocation, 1);

        this._colors.attribEnable(this._colorLocation,
            1, gl.UNSIGNED_BYTE, false, 0, 0, true, false);
        gl2facade.vertexAttribDivisor(this._colorLocation, 1);

        this._heights.attribEnable(this._heightLocation,
            2, gl.UNSIGNED_BYTE, false, 0, 0, true, false);
        gl2facade.vertexAttribDivisor(this._heightLocation, 1);
    }

    /**
     * Unbinds the vertex buffer object (VBO) and disables the binding point.
     */
    protected unbindBuffers(_indices: Array<GLuint>): void {
        /* Please note the implicit unbind in attribEnable is skipped. */
        this._vertices.attribDisable(this._vertexLocation, false, false);
        this._vertices.attribDisable(this._texCoordLocation, false, false);

        this._layout.attribDisable(this._layoutLocation, false, false);
        this._ids.attribDisable(this._idLocation, false, false);
        this._emphases.attribDisable(this._emphasisLocation, false, false);

        this._areaScales.attribDisable(this._areaScaleLocation, false, false);
        this._colors.attribDisable(this._colorLocation, false, false);
        this._heights.attribDisable(this._heightLocation, false, false);
    }


    /**
     * Creates the vertex buffer object (VBO) and creates and initializes the buffer's data store.
     * @param vertexLocation - Attribute binding point for vertices.
     * @param texCoordLocation - Attribute binding point for texture coordinates.
     * @param layoutLocation - Attribute binding point for layout data.
     * @param idLocation - Attribute binding point for id data.
     * @param emphasisLocation - Attribute binding point for emphasis data.
     * @param colorLocation - Attribute binding point for color data.
     * @param heightLocation - Attribute binding point for height data.
     */
    initialize(
        vertexLocation: GLuint = 0,
        texCoordLocation: GLuint = 1,
        layoutLocation: GLuint = 2,
        idLocation: GLuint = 3,
        emphasisLocation: GLuint = 4,
        areaScaleLocation: GLuint = 5,
        colorLocation: GLuint = 6,
        heightLocation: GLuint = 7): boolean {

        this._vertexLocation = vertexLocation;
        this._texCoordLocation = texCoordLocation;

        this._idLocation = idLocation;
        this._layoutLocation = layoutLocation;
        this._emphasisLocation = emphasisLocation;

        this._areaScaleLocation = areaScaleLocation;
        this._colorLocation = colorLocation;
        this._heightLocation = heightLocation;

        const gl = this.context.gl;
        const valid = super.initialize([
            gl.ARRAY_BUFFER, gl.ARRAY_BUFFER, gl.ARRAY_BUFFER,
            gl.ARRAY_BUFFER, gl.ARRAY_BUFFER, gl.ARRAY_BUFFER,
            gl.ARRAY_BUFFER, gl.ARRAY_BUFFER]);

        this._vertices.data(CuboidGeometry.DATA, gl.STATIC_DRAW);

        return valid && this._vertices.valid;
    }

    /**
     * Specializes the base class uninitialization by invoking uninitialize on each buffer explicitly.
     * The base class then uninitializes the vertex array.
     */
    uninitialize(): void {
        CuboidGeometry.unreferenceTemplateVBO(this.context);

        this._layout.uninitialize();
        this._ids.uninitialize();
        this._emphases.uninitialize();

        this._areaScales.uninitialize();
        this._colors.uninitialize();
        this._heights.uninitialize();

        super.uninitialize();
    }

    /**
     * Intended to be used in frame preparation to avoid unnecessary buffer rebinds.
     */
    update(): void {
        this.bind();
    }

    /**
     * Specifies/invokes the draw of this screen-aligned triangle.
     */
    @Initializable.assert_initialized()
    draw(offset: GLint = 0, macOsOffset: GLint = 0, count: GLint = 0): void {
        const gl = this.context.gl;
        const gl2facade = this.context.gl2facade;

        /** @todo only do this when mac os is detected (or probably any iDevice) */
        this._vertices.attribEnable(this._vertexLocation,
            3, gl.FLOAT, false, 20, macOsOffset, true, false);
        this._vertices.attribEnable(this._texCoordLocation,
            2, gl.FLOAT, false, 20, 12 + macOsOffset, true, false);

        this._ids.attribEnable(this._idLocation,
            4, gl.UNSIGNED_BYTE, false, 4, offset * 4, true, false);
        this._layout.attribEnable(this._layoutLocation,
            4, gl.FLOAT, false, 16, offset * 16, true, false);
        this._emphases.attribEnable(this._emphasisLocation,
            1, gl.UNSIGNED_BYTE, false, 1, offset * 1, true, false);

        this._areaScales.attribEnable(this._areaScaleLocation,
            1, gl.UNSIGNED_BYTE, false, 1, offset * 1, true, false);
        this._colors.attribEnable(this._colorLocation,
            1, gl.UNSIGNED_BYTE, false, 1, offset * 1, true, false);
        this._heights.attribEnable(this._heightLocation,
            2, gl.UNSIGNED_BYTE, false, 2, offset * 2, true, false);

        gl2facade.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);
    }

    set layout(data: Float32Array) {
        const gl = this.context.gl;

        this._layout.data(data, gl.STATIC_DRAW);
        // this._vertexArray.invalidate();
    }

    set ids(data: Uint8Array) {
        const gl = this.context.gl;

        this._ids.data(data, gl.STATIC_DRAW);
        // this._vertexArray.invalidate();
    }

    set areaScales(data: Uint8Array) {
        const gl = this.context.gl;

        this._areaScales.data(data, gl.STATIC_DRAW);
        // this._vertexArray.invalidate();
    }

    set colors(data: Uint8Array) {
        const gl = this.context.gl;

        this._colors.data(data, gl.STATIC_DRAW);
        // this._vertexArray.invalidate();
    }

    set emphases(data: Uint8Array) {
        const gl = this.context.gl;

        this._emphases.data(data, gl.STATIC_DRAW);
        // this._vertexArray.invalidate();
    }

    set heights(data: Uint8Array) {
        const gl = this.context.gl;

        this._heights.data(data, gl.STATIC_DRAW);
        // this._vertexArray.invalidate();
    }

    get valid(): boolean {
        const validLayout = this._layout && this._layout.valid;
        const validId = this._ids && this._ids.valid;
        const validAreaScales = this._areaScales && this._areaScales.valid;
        const validColor = this._colors && this._colors.valid;
        const validEmphasis = this._emphases && this._emphases.valid;
        const validHeight = this._heights && this._heights.valid;
        return this.initialized && this._vertices.valid && validLayout && validId &&
            validAreaScales && validColor && validEmphasis && validHeight;
    }

    /**
     * Attribute location to that this geometry's vertices are bound to.
     */
    get vertexLocation(): GLint {
        return this._vertexLocation;
    }

    /**
     * Attribute location to that this geometry's texture coordinates are bound to.
     */
    get texCoordLocation(): GLint {
        return this._texCoordLocation;
    }

    /**
     * Attribute location to that this geometry's layout data is bound to.
     */
    get layoutLocation(): GLint {
        return this._layoutLocation;
    }

    /**
     * Attribute location to that this geometry's id data is bound to.
     */
    get idLocation(): GLint {
        return this._idLocation;
    }

    /**
     * Attribute location to that this geometry's emphases data is bound to.
     */
    get emphasisLocation(): GLint {
        return this._emphasisLocation;
    }

    /**
     * Attribute location to that this geometry's area scale data is bound to.
     */
    get areaScaleLocation(): GLint {
        return this._areaScaleLocation;
    }

    /**
     * Attribute location to that this geometry's color data is bound to.
     */
    get colorLocation(): GLint {
        return this._colorLocation;
    }

    /**
     * Attribute location to that this geometry's height data is bound to.
     */
    get heightLocation(): GLint {
        return this._heightLocation;
    }

}

