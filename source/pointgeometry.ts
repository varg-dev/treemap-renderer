
/* spellchecker: disable */

import { Buffer, Context, Geometry, Initializable } from 'webgl-operate';

/* spellchecker: enable */


export class PointGeometry extends Geometry {

    protected _vertices: Buffer;
    protected _colors: Buffer;

    /** Number of points to draw */
    protected _count: number;
    protected _vertexLocation: GLuint;
    protected _colorLocation: GLuint;

    /**
     * Object constructor, requires a context and an identifier.
     * @param context - Valid context to create the object for.
     * @param identifier - Meaningful name for identification of this instance.
     */
    constructor(context: Context, identifier?: string) {
        super(context, identifier);

        identifier = identifier !== undefined && identifier !== `` ? identifier : 'PointGeometry';

        this._vertices = new Buffer(context, `${identifier}VertexVBO`);
        this._buffers.push(this._vertices);

        this._colors = new Buffer(context, `${identifier}ColorVBO`);
        this._buffers.push(this._colors);
    }


    /**
     * Binds the vertex buffer object (VBO) to an attribute binding point of a given, pre-defined index.
     */
    protected bindBuffers(_indices: GLuint[]): void {
        const gl = this.context.gl;
        const gl2facade = this.context.gl2facade;

        /* Please note the implicit bind in attribEnable. */
        this._vertices.attribEnable(this._vertexLocation, 3, gl.FLOAT, false, 0, 0, true, false);
        gl2facade.vertexAttribDivisor(this._vertexLocation, 0);

        this._colors.attribEnable(this._colorLocation, 4, gl.FLOAT, false, 0, 0, true, false);
        gl2facade.vertexAttribDivisor(this._colorLocation, 0);
    }

    /**
     * Unbinds the vertex buffer object (VBO) and disables the binding point.
     */
    protected unbindBuffers(_indices: GLuint[]): void {
        /* Please note the implicit unbind in attribEnable is skipped. */
        this._vertices.attribDisable(this._vertexLocation, false, false);
        this._colors.attribDisable(this._colorLocation, false, false);
    }

    /**
     * Creates the vertex buffer object (VBO) and creates and initializes the buffer's data store.
     * @param vertexLocation - Attribute binding point for vertices.
     * @param colorLocation - Attribute binding point for color data.
     */
    initialize(
        vertexLocation: GLuint = 0,
        colorLocation: GLuint = 1): boolean {

        this._vertexLocation = vertexLocation;
        this._colorLocation = colorLocation;

        const gl = this.context.gl;
        const valid = super.initialize([gl.ARRAY_BUFFER, gl.ARRAY_BUFFER]);

        return valid && this._vertices.valid;
    }

    /**
     * Intended to be used in frame preparation to avoid unnecessary buffer rebinds.
     */
    update(): void {
        this.bind();
    }

    /**
     * Specifies/invokes the draw of the points.
     */
    @Initializable.assert_initialized()
    draw(offset: GLint = 0): void {

        if (!this._count) {
            return;
        }

        const gl = this.context.gl;
        this._vertices.attribEnable(this._vertexLocation,
            3, gl.FLOAT, false, 0, offset * 4, true, false);
        this._colors.attribEnable(this._colorLocation,
            4, gl.FLOAT, false, 0, offset * 4, true, false);

        gl.drawArrays(gl.POINTS, 0, this._count);
    }

    /**
     * Sets/updates the vec3-positions of the points to draw.
     */
    set vertices(data: Float32Array) {
        this._count = data.length / 3.0;

        this._vertices.data(data, this.context.gl.STATIC_DRAW);
    }

    /**
     * Sets/updates the RGBA-colors of the points to draw.
     */
    set colors(data: Float32Array) {
        this._colors.data(data, this.context.gl.STATIC_DRAW);
    }

    get valid(): boolean {
        return this.initialized && this._vertices.valid && this._colors && this._colors.valid;
    }

    /**
     * Attribute location to that this geometry's vertices are bound to.
     */
    get vertexLocation(): GLint {
        return this._vertexLocation;
    }

    /**
     * Attribute location to that this geometry's color data is bound to.
     */
    get colorLocation(): GLint {
        return this._colorLocation;
    }

}
