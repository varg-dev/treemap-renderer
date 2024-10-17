
/* spellchecker: disable */

import { Buffer, Context, Geometry, Initializable } from 'webgl-operate';
import { auxiliaries } from 'webgl-operate';
const assert = auxiliaries.assert;

/* spellchecker: enable */

/**
 * Geometry to render screen-aligned 2D quads by specifying the position of the lower left corner
 * (origin) and the 2D extent. One of the three corners will stay 'pointy', while the others will be
 * round.
 */
export class ScreenAlignedQuadGeometry extends Geometry {

    /**
     * These 2D vertices are equal for all quads, used for instanced rendering. Their actual position
     * will be changed in the vertex shader, based on position attributes (origin, extent).
     * 2-------4
     * |  \    |
     * |    \  |
     * 1-------3
     */
    protected static readonly VERTICES = new Float32Array(
        [0.0, 0.0, 0.0, 1.0, 1.0, 0.0, 1.0, 1.0]);

    /**
     * Handle to the quad template this geometry is based on.
     */
    protected _vertices: Buffer;

    protected _origins: Buffer;
    protected _extents: Buffer;
    protected _offsets: Buffer;
    protected _pointyCorners: Buffer;

    /** Number of quads to draw */
    protected _count: number;

    protected _vertexLocation: GLuint;
    protected _originLocation: GLuint;
    protected _extentLocation: GLuint;
    protected _offsetLocation: GLuint;
    protected _pointyCornerLocation: GLuint;

    /**
     * Object constructor, requires a context and an identifier.
     * @param context - Valid context to create the object for.
     * @param identifier - Meaningful name for identification of this instance.
     */
    constructor(context: Context, identifier?: string) {
        super(context, identifier);

        assert(context.isWebGL2 || context.supportsInstancedArrays,
            `expected extension 'ANGLE_instanced_arrays' to be supported`);

        identifier = identifier !== undefined && identifier !== `` ?
            identifier : 'ScreenAlignedQuadGeometry';

        this._vertices = new Buffer(context, `${identifier}VertexVBO`);
        this._buffers.push(this._vertices);

        this._origins = new Buffer(context, `${identifier}OriginVBO`);
        this._buffers.push(this._origins);

        this._extents = new Buffer(context, `${identifier}ExtentVBO`);
        this._buffers.push(this._extents);

        this._offsets = new Buffer(context, `${identifier}OffsetVBO`);
        this._buffers.push(this._offsets);

        this._pointyCorners = new Buffer(context, `${identifier}PointyCornerVBO`);
        this._buffers.push(this._pointyCorners);
    }


    /**
     * Binds the vertex buffer object (VBO) to an attribute binding point of a given, pre-defined index.
     */
    protected bindBuffers(_indices: Array<GLuint>): void {
        const gl = this.context.gl;
        const gl2facade = this.context.gl2facade;

        /* Please note the implicit bind in attribEnable. */

        this._vertices.attribEnable(this._vertexLocation, 2, gl.FLOAT, false, 8, 0, true, false);
        gl2facade.vertexAttribDivisor(this._vertexLocation, 0);

        this._origins.attribEnable(this._originLocation, 3, gl.FLOAT, false, 12, 0, true, false);
        gl2facade.vertexAttribDivisor(this._originLocation, 1);

        this._extents.attribEnable(this._extentLocation, 2, gl.FLOAT, false, 8, 0, true, false);
        gl2facade.vertexAttribDivisor(this._extentLocation, 1);

        this._offsets.attribEnable(this._offsetLocation, 2, gl.FLOAT, false, 8, 0, true, false);
        gl2facade.vertexAttribDivisor(this._offsetLocation, 1);

        this._pointyCorners.attribEnable(this._pointyCornerLocation, 1, gl.UNSIGNED_BYTE, false, 1, 0,
            true, false);
        gl2facade.vertexAttribDivisor(this._pointyCornerLocation, 1);

    }

    /**
     * Unbinds the vertex buffer object (VBO) and disables the binding point.
     */
    protected unbindBuffers(_indices: Array<GLuint>): void {
        /* Please note the implicit unbind in attribEnable is skipped. */
        this._vertices.attribDisable(this._vertexLocation, false, false);
        this._origins.attribDisable(this._originLocation, false, false);
        this._extents.attribDisable(this._extentLocation, false, false);
        this._offsets.attribDisable(this._offsetLocation, false, false);
        this._pointyCorners.attribDisable(this._pointyCornerLocation, false, false);
    }

    /**
     * Creates the vertex buffer object (VBO) and creates and initializes the buffer's data store.
     * @param vertexLocation - Attribute binding point for vertices.
     * @param originLocation - Attribute binding point for the origins (position of ll corner).
     * @param extentLocation - Attribute binding point for extent data.
     * @param offsetLocation - Attribute binding point for offset data.
     * @param pointyCornerLocation - Attribute binding point for pointy corner data.
     */
    initialize(
        vertexLocation: GLuint = 0,
        originLocation: GLuint = 1,
        extentLocation: GLuint = 2,
        offsetLocation: GLuint = 3,
        pointyCornerLocation: GLuint = 4): boolean {

        this._vertexLocation = vertexLocation;
        this._originLocation = originLocation;
        this._extentLocation = extentLocation;
        this._offsetLocation = offsetLocation;
        this._pointyCornerLocation = pointyCornerLocation;

        const gl = this.context.gl;
        const valid = super.initialize(
            [gl.ARRAY_BUFFER, gl.ARRAY_BUFFER, gl.ARRAY_BUFFER, gl.ARRAY_BUFFER, gl.ARRAY_BUFFER]);

        this._vertices.data(ScreenAlignedQuadGeometry.VERTICES, gl.STATIC_DRAW);

        return valid && this._vertices.valid;
    }

    /**
     * Set (or update) the positions, extents, offsets and pointy corner location of the quads.
     * @param origins - world coordinates of the lower left corner of every quad
     * @param extents - NDC extents
     * @param offsets - NDC offset on origin
     * @param pointyCorners - numbers which indicates the position of the pointy corner
     */
    updateData(origins: Float32Array, extents: Float32Array, offsets: Float32Array,
        pointyCorners: Uint8Array): void {

        this.bind();
        this._count = origins.length / 3.0;

        this._origins.data(origins, this.context.gl.STATIC_DRAW);
        this._extents.data(extents, this.context.gl.STATIC_DRAW);
        this._offsets.data(offsets, this.context.gl.STATIC_DRAW);
        this._pointyCorners.data(pointyCorners, this.context.gl.STATIC_DRAW);
    }

    /**
     * Intended to be used in frame preparation to avoid unnecessary buffer rebinds.
     */
    update(): void {
        this.bind();
    }

    /**
     * Specifies/invokes the draw of the quads.
     */
    @Initializable.assert_initialized()
    draw(offset: GLint = 0): void {

        if (!this._count) {
            return;
        }

        const gl = this.context.gl;
        const gl2facade = this.context.gl2facade;

        this._vertices.attribEnable(this._vertexLocation,
            2, gl.FLOAT, false, 8, 0, true, false);

        this._origins.attribEnable(this._originLocation,
            3, gl.FLOAT, false, 12, offset * 12, true, false);

        this._extents.attribEnable(this._extentLocation,
            2, gl.FLOAT, false, 8, offset * 8, true, false);

        this._offsets.attribEnable(this._offsetLocation,
            2, gl.FLOAT, false, 8, offset * 8, true, false);

        this._pointyCorners.attribEnable(this._pointyCornerLocation,
            1, gl.UNSIGNED_BYTE, false, 1, offset * 1, true, false);

        gl2facade.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this._count);
    }

    get valid(): boolean {
        return this.initialized && this._vertices.valid && this._origins && this._origins.valid
            && this._offsets && this._offsets.valid && this._extents && this._extents.valid
            && this._pointyCorners && this._pointyCorners.valid;
    }

    /**
     * Attribute location to that this geometry's vertices are bound to.
     */
    get vertexLocation(): GLint {
        return this._vertexLocation;
    }

    /**
     * Attribute location to that this geometry's origins are bound to.
     */
    get originLocation(): GLint {
        return this._originLocation;
    }

    /**
     * Attribute location to that this geometry's extents are bound to.
     */
    get extentLocation(): GLint {
        return this._extentLocation;
    }

    /**
     * Attribute location to that this geometry's offsets are bound to.
     */
    get offsetLocation(): GLint {
        return this._offsetLocation;
    }

    /**
     * Attribute location to that this geometry's pointy corner data is bound to.
     */
    get pointyCornerLocation(): GLuint {
        return this._pointyCornerLocation;
    }

}
