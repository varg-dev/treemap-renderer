
/* spellchecker: disable */

import { auxiliaries } from 'webgl-operate';
import {
    Context,
    DefaultFramebuffer,
    Framebuffer,
    Initializable,
    ReadbackPass,
    Renderbuffer,
    Texture2D,
} from 'webgl-operate';
/* spellchecker: enable */


const assert = auxiliaries.assert;

/**
 * The multi-render target is intended to provide a simplified interface for a single framebuffer object
 * that supports most of our rendering and compatibility requirements. On latest hardware, only a single
 * framebuffer with multiple draw attachments would be sufficient. However, several browsers and devices
 * do not support draw_attachments or specific texture formats. This class helps to provide a single
 * interface while handling all possible configurations.
 */
export class MultiRenderTarget extends Initializable {

    protected _context: Context;

    /** @see {@link defaultFBO} */
    protected _defaultFBO: DefaultFramebuffer;
    /** @see {@link primaryFBO} */
    protected _primaryFBO: Framebuffer;
    /** @see {@link secondaryFBO} */
    protected _secondaryFBO: Framebuffer;

    /** @see {@link colorRenderTexture} */
    protected _colorRenderTexture: Texture2D;

    /** @see {@link idRenderTexture} */
    protected _idRenderTexture: Texture2D;
    /**
     * Fallback FBO for webgl1 with no draw buffer support, undefined if unused.
     * @see {@link idFBO}
     */
    protected _idFBO: Framebuffer | undefined;

    protected _depthStencilRenderTexture: Texture2D;
    /**
     * Fallback FBO for webgl1 with no draw buffer nor depth texture support, undefined if unused.
     */
    protected _depthStencilRenderbuffer: Renderbuffer | undefined;
    /** @see {@link depthFBO} */
    protected _depthFBO: Framebuffer | undefined;

    /**
     * Denotes if FBOs are limited to a single color attachment (webgl1 with no draw buffer support).
     */
    protected _drawRestricted: boolean;


    constructor(context: Context) {
        super();
        this._context = context;
    }


    /**
     * Initialize for rendering with minimal specs. This is only ANGLE_instanced_arrays and
     * OES_standard_derivatives supported on a WebGL 1 context. There is no further fallback to this
     * rendering branch. This branch can be invoked via GET parameter `msqrd_h=1w1000`.
     * @param width - Width in pixel to initialize the render textures and buffers to.
     * @param height - Height in pixel to initialize the render textures and buffers to.
     */
    protected initializeES2_basic(width: GLsizei, height: GLsizei): void {
        const gl = this._context.gl;
        const gl2facade = this._context.gl2facade;

        this._drawRestricted = true;

        this._colorRenderTexture.initialize(width, height, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE);
        this._idRenderTexture.initialize(width, height, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE);
        this._depthStencilRenderTexture.initialize(width, height, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE);
        this._depthStencilRenderbuffer!.initialize(width, height, gl.DEPTH_STENCIL);

        this._depthFBO = new Framebuffer(this._context, 'DepthFBO');
        this._idFBO = new Framebuffer(this._context, 'IdFBO');

        this._primaryFBO.initialize([[gl2facade.COLOR_ATTACHMENT0, this._colorRenderTexture]
            , [gl.DEPTH_STENCIL_ATTACHMENT, this._depthStencilRenderbuffer]]);

        this._secondaryFBO.initialize([[gl2facade.COLOR_ATTACHMENT0, this._colorRenderTexture]
            , [gl.DEPTH_STENCIL_ATTACHMENT, this._depthStencilRenderbuffer]]);

        this._idFBO.initialize([[gl2facade.COLOR_ATTACHMENT0, this._idRenderTexture]
            , [gl.DEPTH_STENCIL_ATTACHMENT, this._depthStencilRenderbuffer]]);
        this._idFBO.clearColor([1.0, 1.0, 1.0, 1.0], 0);

        this._depthFBO.initialize([[gl2facade.COLOR_ATTACHMENT0, this._depthStencilRenderTexture]
            , [gl.DEPTH_STENCIL_ATTACHMENT, this._depthStencilRenderbuffer]]);
        this._depthFBO.clearColor([1.0, 1.0, 1.0, 1.0], 0);

    }

    /**
     * Initialize for rendering with WebGL 2 like specs on a WebGL 1 context. In addition to the basic
     * rendering branch, this takes advantage of WEBGL_depth_texture and WEBGL_draw_buffers. This branch
     * can be invoked via GET parameter `msqrd_h=1w1006`.
     * @param width - Width in pixel to initialize the render textures and buffers to.
     * @param height - Height in pixel to initialize the render textures and buffers to.
     */
    protected initializeES2_extensions(width: GLsizei, height: GLsizei): void {
        const gl = this._context.gl;
        const gl2facade = this._context.gl2facade;

        this._drawRestricted = false;

        if (this._context.isWebGL1) {
            assert(this._context.supportsDrawBuffers, `expected WEBGL_draw_buffers to be supported`);
            assert(this._context.supportsDepthTexture, `expected WEBGL_depth_texture to be supported`);
        }

        this._colorRenderTexture.initialize(width, height, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE);
        this._idRenderTexture.initialize(width, height, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE);
        this._depthStencilRenderTexture.initialize(width, height,
            gl.DEPTH_STENCIL, gl.DEPTH_STENCIL, this._context.depthTexture.UNSIGNED_INT_24_8_WEBGL);
        this._depthStencilRenderbuffer!.initialize(width, height, gl.DEPTH_STENCIL);

        /* Note: this should match the MultiRenderTarget attachment enum values, except depth. */
        this._primaryFBO.initialize([
            [gl2facade.COLOR_ATTACHMENT0, this._colorRenderTexture],
            [gl2facade.COLOR_ATTACHMENT1, this._idRenderTexture],
            [gl.DEPTH_STENCIL_ATTACHMENT, this._depthStencilRenderTexture]]);

        this._primaryFBO.clearColor([1.0, 1.0, 1.0, 1.0], 1);

        this._secondaryFBO.initialize([
            [gl2facade.COLOR_ATTACHMENT0, this._colorRenderTexture],
            [gl.DEPTH_STENCIL_ATTACHMENT, this._depthStencilRenderbuffer]]);


        /* Specify Id FBO just for readback. */

        this._idFBO = new Framebuffer(this._context, 'IdFBO');
        this._idFBO.initialize([[gl2facade.COLOR_ATTACHMENT0, this._idRenderTexture]]);
    }

    /**
     * Initialize for rendering with WebGL 2. This is similar to rendering with WebGL 1 and all relevant
     * extensions. Please note that all utilized extensions are supported by default, not via extension.
     * This branch can be invoked via GET parameter `msqrd_h=200000`.
     * @param width - Width in pixel to initialize the render textures and buffers to.
     * @param height - Height in pixel to initialize the render textures and buffers to.
     */
    protected initializeES3(width: GLsizei, height: GLsizei): void {
        const gl = this._context.gl;
        const gl2facade = this._context.gl2facade;

        this._drawRestricted = false;

        assert(this._context.isWebGL2, `expected a webgl2 context`);

        this._colorRenderTexture.initialize(width, height, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE);
        this._idRenderTexture.initialize(width, height, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE);
        this._depthStencilRenderTexture.initialize(width, height,
            gl.DEPTH24_STENCIL8, gl.DEPTH_STENCIL, gl.UNSIGNED_INT_24_8);
        this._depthStencilRenderbuffer!.initialize(width, height, gl.DEPTH24_STENCIL8);

        /* Note: this should match the MultiRenderTarget attachment enum values, except depth. */
        this._primaryFBO.initialize([
            [gl2facade.COLOR_ATTACHMENT0, this._colorRenderTexture],
            [gl2facade.COLOR_ATTACHMENT1, this._idRenderTexture],
            [gl.DEPTH_STENCIL_ATTACHMENT, this._depthStencilRenderTexture]]);

        this._primaryFBO.clearColor([1.0, 1.0, 1.0, 1.0], 1);

        this._secondaryFBO.initialize([
            [gl2facade.COLOR_ATTACHMENT0, this._colorRenderTexture],
            [gl.DEPTH_STENCIL_ATTACHMENT, this._depthStencilRenderbuffer]]);
    }

    @Initializable.initialize()
    initialize(): boolean {
        this._defaultFBO = new DefaultFramebuffer(this._context, 'DefaultFBO');
        this._defaultFBO.initialize();


        this._colorRenderTexture = new Texture2D(this._context, 'ColorRenderTexture');
        this._idRenderTexture = new Texture2D(this._context, 'IdRenderTexture');
        this._depthStencilRenderTexture = new Texture2D(this._context, 'DepthStencilRenderTexture');
        this._depthStencilRenderbuffer = new Renderbuffer(this._context, 'DepthStencilRenderbuffer');

        this._primaryFBO = new Framebuffer(this._context, 'PrimaryFBO');
        this._secondaryFBO = new Framebuffer(this._context, 'SecondaryFBO');


        /* Context specific initialization. */

        const width = this._defaultFBO.width;
        const height = this._defaultFBO.height;

        if (this._context.isWebGL2) {
            this.initializeES3(width, height);
        } else if (
            this._context.supportsDepthTexture &&
            this._context.supportsDrawBuffers &&
            // note: MAX_DRAW_BUFFERS_WEBGL is only available as part of webgl1 drawbuffers extension,
            // follow https://github.com/cginternals/webgl-operate/issues/201 for details
            this._context.gl.getParameter(this._context.drawBuffers.MAX_DRAW_BUFFERS_WEBGL) >= 2) {
            this.initializeES2_extensions(width, height);
        } else {
            this.initializeES2_basic(width, height);
        }


        /* Setup clear. */

        /* Setup background clear color probably provided by some config. */
        this._primaryFBO.clearColor([0.0, 0.0, 0.0, 1.0], 0);
        this._secondaryFBO.clearColor([0.0, 0.0, 0.0, 1.0], 0);

        /* Set the clear depth to the biggest value that can be encoded:
          -> float24x1_from_uint8x3([255,255, 255]) = 0.9999999403953552
        This results in a depth readback of [255, 255, 255]. If clearing with depth = 1.0 though,
        instead of [256, 0, 0] the readback returns [255, 0, 0] probably due to some clamping... */
        this._primaryFBO.clearDepth(ReadbackPass.maxClearDepth());
        this._primaryFBO.clearStencil(0);

        this._secondaryFBO.clearDepth(ReadbackPass.maxClearDepth());
        this._secondaryFBO.clearStencil(0);

        /* Assert validity of created frame buffers. */

        assert(this._primaryFBO.valid,
            `${this._primaryFBO.identifier} expected to be valid for rendering`);
        assert(this._secondaryFBO.valid,
            `${this._secondaryFBO.identifier} expected to be valid for rendering`);

        assert(this._idFBO === undefined || this._idFBO.valid,
            `${this._idFBO ? this._idFBO.identifier : ''} expected to be valid for rendering`);

        assert(this._depthFBO === undefined || this._depthFBO.valid,
            `${this._depthFBO ? this._depthFBO.identifier : ''} expected to be valid for rendering`);

        return true;
    }

    @Initializable.uninitialize()
    uninitialize(): void {

        this._defaultFBO.uninitialize();
        this._primaryFBO.uninitialize();

        if (this._idFBO) {
            this._idFBO.uninitialize();
        }
        if (this._depthFBO) {
            this._depthFBO.uninitialize();
        }
        if (this._depthStencilRenderbuffer) {
            this._depthStencilRenderbuffer.uninitialize();
        }

        this._colorRenderTexture.uninitialize();
        this._idRenderTexture.uninitialize();
        this._depthStencilRenderTexture.uninitialize();
    }

    /**
     * Setup background clear color probably provided by some config.
     * @param color
     */
    setClearColor(color: [number, number, number, number]): void {
        this._primaryFBO.clearColor(color, 0);
        this._secondaryFBO.clearColor(color, 0);
    }

    /**
     * Resizes all active framebuffers, e.g., primary, secondary, and if used, id and depth.
     * @param width - Target width for resize.
     * @param height - Target height for resize.
     */
    resize(width: number, height: number): void {
        this._primaryFBO.resize(width, height);
        this._secondaryFBO!.resize(width, height);

        if (this._idFBO) {
            this._idFBO!.resize(width, height);
        }
        if (this._depthFBO) {
            this._depthFBO!.resize(width, height);
        }
    }

    /**
     * Allows to query whether or not to invoke a specific render pass, e.g., for the ID framebuffer.
     */
    get drawRestricted(): boolean {
        return this._drawRestricted;
    }

    /**
     * The primary framebuffer which is probably used for the first intermediate frame. It provides the
     * full configuration for rendering all attachments within one pass (if DRAW_BUFFERS is supported).
     */
    get primaryFBO(): Framebuffer {
        return this._primaryFBO;
    }

    /**
     * The secondary framebuffer is similar to the primary framebuffer, except that it does not have an
     * ID attachment. The renderer requires ID information for interaction purposes and the first frame
     * is sufficient for this. Furthermore, accumulating ID semantics does not yield valid IDs...
     */
    get secondaryFBO(): Framebuffer {
        return this._secondaryFBO;
    }

    /**
     * Convenience getter for the default framebuffer, e.g., for blit.
     */
    get defaultFBO(): Framebuffer {
        return this._defaultFBO;
    }

    /**
     * Specific framebuffer configured with a Depth Texture or Render Target used for rendering the
     * depth data. If this is not used, undefined will be returned.
     */
    get depthFBO(): Framebuffer | undefined {
        return this._drawRestricted ? this._depthFBO : undefined;
    }


    /**
     * Specific framebuffer configured with a ID texture attachment and the shared depth-stencil
     * attachment. If this is not used, undefined will be returned.
     */
    get idFBO(): Framebuffer | undefined {
        return this._drawRestricted ? this._idFBO : undefined;
    }

    get readBackIdFBO(): Framebuffer | undefined {
        return this._idFBO;
    }

    /**
     * Color texture that is used as attachment for primary and secondary framebuffers.
     */
    get colorRenderTexture(): Texture2D {
        return this._colorRenderTexture;
    }

    /**
     * ID texture that is used as attachment for primary framebuffers.
     */
    get idRenderTexture(): Texture2D {
        return this._idRenderTexture;
    }

}


export namespace MultiRenderTarget {

    /**
     * The targeted attachment index of the color, index, and depth textures used when attached to
     * primary or secondary FBO (only useful when DRAW_BUFFERS is supported).
     */
    export enum Attachment { Undefined = -1, Color = 0, Id = 1, Depth = 2 }

}
