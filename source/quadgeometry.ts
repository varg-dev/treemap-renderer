
/* spellchecker: disable */

import { Buffer, Context, Geometry, Initializable } from 'webgl-operate';

/* spellchecker: enable */


export class QuadGeometry extends Geometry {

    /**
     * 1 ───── 3
     * │  \    │
     * │    \  │
     * 0 ───── 2
     */
    protected static readonly DATA = new Float32Array(
        [0.0, 0.0, 0.0, +1.0, +1.0, 0.0, +1.0, +1.0]);

    protected _vertices: Buffer;
    protected _layout: Buffer;
    protected _ids: Buffer;
    protected _colors: Buffer;
    protected _emphases: Buffer;

    protected _vertexLocation: GLuint;
    protected _layoutLocation: GLuint;
    protected _idLocation: GLuint;
    protected _emphasisLocation: GLuint;
    protected _colorLocation: GLuint;


    /**
     * Object constructor, requires a context and an identifier.
     * @param context - Valid context to create the object for.
     * @param identifier - Meaningful name for identification of this instance.
     */
    constructor(context: Context, identifier?: string) {
        super(context, identifier);

        identifier = identifier !== undefined && identifier !== `` ? identifier : 'QuadGeometry';

        this._vertices = new Buffer(context, identifier + 'VertexVBO');
        this._buffers.push(this._vertices);

        this._layout = new Buffer(context, identifier + 'LayoutVBO');
        this._buffers.push(this._layout);

        this._ids = new Buffer(context, identifier + 'IdVBO');
        this._buffers.push(this._ids);

        this._emphases = new Buffer(context, identifier + 'EmphasisVBO');
        this._buffers.push(this._emphases);

        this._colors = new Buffer(context, identifier + 'ColorVBO');
        this._buffers.push(this._colors);
    }


    /**
     * Binds the vertex buffer object (VBO) to an attribute binding point of a given, pre-defined index.
     */
    protected bindBuffers(_indices: Array<GLuint>): void {
        const gl = this.context.gl;
        const gl2facade = this.context.gl2facade;

        /* Please note the implicit bind in attribEnable. */
        this._vertices.attribEnable(this._vertexLocation,
            2, gl.FLOAT, false, 0, 0, true, false);
        gl2facade.vertexAttribDivisor(this._vertexLocation, 0);

        this._layout.attribEnable(this._layoutLocation,
            4, gl.FLOAT, false, 0, 0, true, false);
        gl2facade.vertexAttribDivisor(this._layoutLocation, 1);
        this._ids.attribEnable(this._idLocation,
            4, gl.UNSIGNED_BYTE, false, 0, 0, true, false);
        gl2facade.vertexAttribDivisor(this._idLocation, 1);
        this._emphases.attribEnable(this._emphasisLocation,
            1, gl.UNSIGNED_BYTE, false, 0, 0, true, false);
        gl2facade.vertexAttribDivisor(this._emphasisLocation, 1);

        this._colors.attribEnable(this._colorLocation,
            1, gl.UNSIGNED_BYTE, false, 0, 0, true, false);
        gl2facade.vertexAttribDivisor(this._colorLocation, 1);
    }

    /**
     * Unbinds the vertex buffer object (VBO) and disables the binding point.
     */
    protected unbindBuffers(_indices: Array<GLuint>): void {
        /* Please note the implicit unbind in attribEnable is skipped. */
        this._vertices.attribDisable(this.vertexLocation, false, false);

        this._layout.attribDisable(this._layoutLocation, false, false);
        this._ids.attribDisable(this._idLocation, false, false);
        this._emphases.attribDisable(this._emphasisLocation, false, false);

        this._colors.attribDisable(this._colorLocation, false, false);
    }


    /**
     * Creates the vertex buffer object (VBO) and creates and initializes the buffer's data store.
     * @param vertexLocation - Attribute binding point for vertices.
     * @param layoutLocation - Attribute binding point for layout data.
     * @param idLocation - Attribute binding point for id data.
     * @param emphasisLocation - Attribute binding point for emphasis data.
     * @param colorLocation - Attribute binding point for color data.
     */
    initialize(
        vertexLocation: GLuint = 0,
        layoutLocation: GLuint = 2,
        idLocation: GLuint = 3,
        emphasisLocation: GLuint = 4,
        colorLocation: GLuint = 5): boolean {

        this._vertexLocation = vertexLocation;
        this._idLocation = idLocation;
        this._layoutLocation = layoutLocation;
        this._colorLocation = colorLocation;
        this._emphasisLocation = emphasisLocation;

        const gl = this.context.gl;
        const valid = super.initialize(
            [gl.ARRAY_BUFFER, gl.ARRAY_BUFFER, gl.ARRAY_BUFFER, gl.ARRAY_BUFFER, gl.ARRAY_BUFFER]);

        this._vertices.data(QuadGeometry.DATA, gl.STATIC_DRAW);

        return valid && this._vertices.valid;
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
    draw(offset: GLint = 0, count: GLint = 0): void {
        const gl = this.context.gl;
        const gl2facade = this.context.gl2facade;

        /** @todo only do this when mac os is detected (or probably any iDevice) */
        this._ids.attribEnable(this._idLocation,
            4, gl.UNSIGNED_BYTE, false, 4, offset * 4, true, false);
        this._layout.attribEnable(this._layoutLocation,
            4, gl.FLOAT, false, 16, offset * 16, true, false);
        this._colors.attribEnable(this._colorLocation,
            1, gl.UNSIGNED_BYTE, false, 1, offset * 1, true, false);
        this._emphases.attribEnable(this._emphasisLocation,
            1, gl.UNSIGNED_BYTE, false, 1, offset * 1, true, false);

        gl2facade.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);
    }

    set layout(data: Float32Array) {
        this._layout.data(data, this.context.gl.STATIC_DRAW);
        // this._vertexArray.invalidate();
    }

    set ids(data: Uint8Array) {
        this._ids.data(data, this.context.gl.STATIC_DRAW);
        // this._vertexArray.invalidate();
    }

    set colors(data: Uint8Array) {
        this._colors.data(data, this.context.gl.STATIC_DRAW);
        // this._vertexArray.invalidate();
    }

    set emphases(data: Uint8Array) {
        this._emphases.data(data, this.context.gl.STATIC_DRAW);
        // this._vertexArray.invalidate();
    }

    get valid(): boolean {
        const validLayout = this._layout && this._layout.valid;
        const validId = this._ids && this._ids.valid;
        const validColor = this._colors && this._colors.valid;
        const validEmphasis = this._emphases && this._emphases.valid;
        return this.initialized
            && this._vertices.valid && validLayout && validId && validColor && validEmphasis;
    }


    /**
     * Attribute location to that this geometry's vertices are bound to.
     */
    get vertexLocation(): GLint {
        return this._vertexLocation;
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
     * Attribute location to that this geometry's color data is bound to.
     */
    get colorLocation(): GLint {
        return this._colorLocation;
    }

}
