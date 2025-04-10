/* spellchecker: disable */

// import { throws } from 'assert';
import {
    AbstractKernel,
    AccumulatePass,
    AntiAliasingKernel,
    auxiliaries,
    BlitPass,
    Camera,
    Context,
    EventProvider,
    FontFace,
    Framebuffer,
    Invalidate,
    Label,
    LabelRenderPass,
    mat4,
    NdcFillingTriangle,
    Position3DLabel,
    Projected3DLabel,
    ReadbackPass,
    Renderer as AbstractRenderer,
    vec3
} from 'webgl-operate';

import {AbstractCamera} from './abstractcamera';

import {CuboidRenderPass} from './cuboidrenderpass';
import {Geometry} from './geometry';
import {MultiRenderTarget} from './multirendertarget';
import {CoordsAccess, IdAccess, Navigation} from './navigation';
import {PointRenderPass} from './pointrenderpass';
import {QuadRenderPass} from './quadrenderpass';
import {ScreenAlignedQuadRenderPass} from './screenalignedquadrenderpass';
import {Visualization, VisualizationType} from './visualization';

import ROBOTO_FONT from './assets/roboto.fnt';
import ROBOTO_DT from './assets/roboto.png';
import {Camera2D} from "./camera2D";
import log = auxiliaries.log;
import LogLevel = auxiliaries.LogLevel;
import {Camera3D} from "./camera3D";

const assert = auxiliaries.assert;

const POINT_SIZE = 3.5;

/* spellchecker: enable */

/**
 * Remarks with respect to Stencil and Depth tests of render passes:
 *
 * - draw order is highly important and structured explicitly in order to reduce fragment processing as
 * much as possible. The order is (1) cuboids (cuboids itself have also special optimization for
 * reducing fragment operations even further @see {@link CuboidRenderPass}), (2) quads (quads are drawn
 * top down and utilize stenciling in order to avoid z-fighting, no z-offsets or other hacks required),
 * (3) inner node labels, and, finally, (4) leaf node labels.
 *
 * - stenciling is used as follows: stencil is cleared to '0', then for every fragment showing a cuboid,
 * stencil is set to '2'. If, and only if, stencil is '0' then quad is drawn and stencil set to '1'
 * (this itself fixes z-fighting on quads). The inner node labels are drawn, if, and only if stencil is
 * '1' with depth test GL_ALWAYS (this can be assumed since stencil is only 1 for quads which already
 * passed depth test) and depth mask enabled (no depth is written).
 */
export class Renderer extends AbstractRenderer implements CoordsAccess, IdAccess {


    get geometry(): Geometry {
        return this._geometry;
    }

    set geometry(geometry: Geometry) {
        this._geometry = geometry;
    }

    /**
     * Provides access to the navigation.
     */
    get navigation(): Navigation {
        return this._navigation;
    }

    /**
     * Provide access to the camera object.
     */
    get camera(): AbstractCamera {
        return this._camera;
    }

    /**
     * The anti-aliasing kernel is scaled by this. This might be useful for testing.
     */
    set ndcOffsetScale(scale: number) {
        if (this._ndcOffsetScale === scale) {
            return;
        }
        this._ndcOffsetScale = scale;
        this.invalidate();
    }

    /**
     * Access to the scale applied to the anti-aliasing kernel.
     */
    get ndcOffsetScale(): number {
        return this._ndcOffsetScale;
    }

    protected static readonly CAMERA_NEAR_DEFAULT = 0.01;
    protected static readonly CAMERA_FAR_DEFAULT = 10.00;


    /**
     * This kernel is used for anti-aliasing in case of multi-frame rendering.
     */
    protected _ndcOffsetKernel: AntiAliasingKernel;

    /** @see {@link ndcOffsetScale} */
    protected _ndcOffsetScale = 1.0;

    /**
     * Multi-render target encapsulating most of the rendering branching (webgl2 and various fallbacks)
     * by means of the complete framebuffer configuration. This instance is used for directing specific
     * targets to rendering passes and decide rendering branching based on the availability of specific
     * fbos, e.g., if depthFBO is specified, depth textures are probably not supported and require an
     * additional rendering pass.
     */
    protected _multiRenderTarget: MultiRenderTarget;

    /**
     * Bidirectional connection (renderer <-> visualization) in order to trigger an update when
     * rendering updates.
     */
    protected _visualization: Visualization;

    /**
     * The actual treemap geometry. Note that, by design, the renderer is supposed to rely solely on
     * the geometry and not use the treemap configuration object at all! The data flow is strictly
     * intended as follows: APP -> config -> VISUALIZATION -> geometry -> RENDERER -> image ...
     */
    protected _geometry: Geometry;

    /**
     * Instance of a virtual camera that can be access via getter (@see {@link camera}) and is modified
     * by this renderers navigation.
     */
    protected _camera: AbstractCamera;

    /**
     * Navigation to used to pass event provider to and modify the virtual camera.
     */
    protected _navigation: Navigation;

    /**
     * A quad render pass is used for rendering inner nodes.
     */
    protected _innerPass: QuadRenderPass;

    /**
     * Cuboid render pass that is used for rendering leaf node layers.
     */
    protected _leafPass: CuboidRenderPass;

    /**
     * A label render pass is used for rendering 2D and 3D labels.
     */
    protected _innerLabelPass: LabelRenderPass;
    protected _leafLabelPass: LabelRenderPass;

    /**
     * A point render pass, used to visualize the labels' anchor or reference points.
     */
    protected _pointPass: PointRenderPass;

    /**
     * A screen aligned quad pass which is used to visualize the leaf labels' backgrounds.
     */
    protected _labelBackgroundPass: ScreenAlignedQuadRenderPass;

    /**
     * The font face used for the labels. Since every label is able to have a different font face, but
     * we use only one, we store it here once it is loaded, so that we can apply that font face to
     * labels that might get added later.
     */
    protected _fontFace: FontFace | undefined;

    /**
     * This triangle will be shared over all viewport filling processing passes (blit, accumulate, ...).
     */
    protected _ndcTriangle: NdcFillingTriangle;

    /**
     * The accumulation pass is used to blend intermediate frames into a single multi-frame.
     */
    protected _accumulationPass: AccumulatePass;

    /**
     * The blit pass is used for copying/swapping the accumulation result.
     * @see {@link blitTarget}
     */
    protected _blitPass: BlitPass;

    /** @see {@link blitTarget} */
    protected _blitTarget: number | undefined;

    /**
     * A pass specialized on reading single pixels at specific coordinates from any type of FBO
     * (including all fallback implementations). This is used for id, depth, and world space position
     * retrieval. This is essential in order to (1) provide advanced navigation and (2) create and emit
     * node based events @see {@link navigation}.
     */
    protected _readbackPass: ReadbackPass;


    /**
     * Asserts (and returns) whether or not the minimum context requirements are fulfilled. For now this
     * comprises the availability of either WebGL 2 (without further extensions) or:
     * - ANGLE_instanced_arrays
     * - OES_standard_derivatives
     * The following extensions are optional and not queried for:
     * - WEBGL_depth_texture (optional, not minimum)
     * - WEBGL_draw_buffers (optional, not minimum)
     *
     * @param context - Context to verify minimum rendering requirements on.
     */
    protected static verifyMinimumContextRequirements(context: Context): boolean {
        context.enable(['ANGLE_instanced_arrays', 'OES_standard_derivatives']);
        return true; /* Throws if one of the mandatory extensions is not supported. */
    }


    constructor(visualization: Visualization) {
        super();
        this._visualization = visualization;
    }

    /**
     * Invokes rendering pass on all inner nodes. In order to reduce fill, this should be called after
     * rendering all leaf nodes.
     * @param target - Framebuffer to render into.
     * @param attachment - Specific attachment to pass to the quad renderer.
     * @param depthMask - Whether or not to keep the depth buffer. If false, depth is read only.
     */
    private renderInnerNodes(target: Framebuffer, attachment: MultiRenderTarget.Attachment,
        depthMask: boolean): void {

        if (!this._geometry.valid) {
            return;
        }
        this._innerPass.target = target;
        this._innerPass.attachment = attachment;
        this._innerPass.depthMask = depthMask;
        this._innerPass.frame();
    }

    /**
     * Invokes a rendering pass on all leaf node layers. The rendering starts with the upper layers
     * (since camera is most likely looking from above) in order to fill up the depth buffer as fast as
     * possible to reduce fill.
     * @param target - Framebuffer to render into.
     * @param attachment - Specific attachment to pass to the cuboid renderers.
     * @param depthMask - Whether or not to keep the depth buffer. If false, depth is read only.
     */
    private renderLeafNodes(target: Framebuffer, attachment: MultiRenderTarget.Attachment,
        depthMask: boolean): void {

        if (!this._geometry.valid) {
            return;
        }

        if (this._geometry.leafNodeHeights) {
            this._leafPass.target = target;
            this._leafPass.attachment = attachment;
            this._leafPass.depthMask = depthMask;
            this._leafPass.frame();
        }
    }

    /**
     * Invokes rendering pass on all leaf label backgrounds (screen aligned quads).
     * @param target - Framebuffer to render into.
     * @param depthMask - Whether or not to keep the depth buffer. If false, depth is read only.
     */
    private renderLeafLabelBackgrounds(target: Framebuffer, depthMask: boolean): void {
        this._labelBackgroundPass.target = target;
        this._labelBackgroundPass.depthMask = depthMask;
        this._labelBackgroundPass.frame();
    }

    /**
     * Invokes rendering pass on all points.
     * @param target - Framebuffer to render into.
     * @param depthMask - Whether or not to keep the depth buffer. If false, depth is read only.
     */
    private renderPoints(target: Framebuffer, depthMask: boolean): void {
        this._pointPass.target = target;
        this._pointPass.depthMask = depthMask;
        this._pointPass.frame();
    }

    /**
     * Invokes a rendering pass on all inner node labels.
     * @param target - Framebuffer to render into.
     * @param attachment - Specific attachment to pass to the label renderer.
     */
    private renderInnerLabels(target: Framebuffer, attachment: MultiRenderTarget.Attachment,
        depthMask: boolean): void {
        if (!this._geometry.valid) {
            return;
        }

        this._innerLabelPass.target = target;
        this._innerLabelPass.depthMask = depthMask;

        const gl = this._context.gl;
        gl.enable(gl.STENCIL_TEST);
        gl.enable(gl.DEPTH_TEST);

        gl.stencilFunc(gl.EQUAL, 1, 0xff);
        gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);

        this._innerLabelPass.frame();
        gl.disable(gl.STENCIL_TEST);
    }

    /**
     * Invokes a rendering pass on all leaf labels.
     * @param target - Framebuffer to render into.
     * @param attachment - Specific attachment to pass to the label renderer.
     */
    private renderLeafLabels(target: Framebuffer, attachment: MultiRenderTarget.Attachment,
        depthMask: boolean): void {
        if (!this._geometry.valid) {
            return;
        }

        this._leafLabelPass.target = target;
        this._leafLabelPass.depthMask = depthMask;

        this._leafLabelPass.frame();
    }

    /**
     * Create and configure a multi-render target for managing all those different FBO setups. The
     * target also encodes the various rendering branches by either providing separate FBOs or not,
     * e.g., if a depthFBO is specified, the context probably does not support depth textures, and if
     * an IdFBO is specified, rendering is probably restricted to a single color attachment.
     * @param context - The context to initialize the multi-render target for.
     */
    protected initializeMultiRenderTarget(context: Context): void {
        this.assertUninitialized();

        this._multiRenderTarget = new MultiRenderTarget(context);
        this._multiRenderTarget.initialize();
        this._multiRenderTarget.primaryFBO.clearStencil(0);
        this._multiRenderTarget.secondaryFBO.clearStencil(0);
    }

    /**
     * Create and configure the cuboid render passes for rendering leaf nodes.
     * @param context - The context to initialize the cuboid render passes for.
     */
    protected initializeLeafPasses(context: Context): void {
        this._leafPass = new CuboidRenderPass(context);

        this._leafPass.initialize();
        this._leafPass.camera = this._camera;
    }

    /**
     * Create and configure the quad render pass for rendering inner nodes.
     * @param context - The context to initialize the quad render pass for.
     */
    protected initializeInnerPass(context: Context): void {
        this.assertUninitialized();

        this._innerPass = new QuadRenderPass(context);
        this._innerPass.initialize();
        this._innerPass.camera = this._camera;
    }

    /**
     * Create and configure the point render pass for rendering reference points for leaf labels.
     * @param context - The context to initialize the quad render pass for.
     */
    protected initializePointPass(context: Context): void {
        this._pointPass = new PointRenderPass(context);
        this._pointPass.initialize();
        this._pointPass.camera = this.camera;
        this._pointPass.pointSize = POINT_SIZE; // device pixel ratio will be applied in point pass
    }

    /**
     * Create and configure this leaf label background render pass for rendering screen-aligned quads
     * for leaf labels.
     * @param context - The context to initialize the this render pass for.
     */
    protected initializeLeafLabelBackgroundPass(context: Context): void {
        this._labelBackgroundPass = new ScreenAlignedQuadRenderPass(context);
        this._labelBackgroundPass.initialize();
        this._labelBackgroundPass.camera = this.camera;
    }

    /**
     * Create and configure the label render passes for rendering labels on leaves and on inner nodes.
     * @param context - The context to initialize the label render pass for.
     */
    protected initializeLabelPasses(context: Context): void {
        this.assertUninitialized();

        this._innerLabelPass = new LabelRenderPass(context);
        this._innerLabelPass.initialize();
        //TODO this is highly illegal
        this._innerLabelPass.camera = this.camera as any as Camera;
        this._innerLabelPass.target = this._multiRenderTarget.defaultFBO;

        /**
         * This works, as (1) stencil is limited to 1 (only when quads are present) and (2) all inner
         * node labels are supposed to be placed on the y = 0 layer. Thus no depth test required.
         * Note: renderInnerLabels() sets the depthMask.
         */
        this._innerLabelPass.depthFunc = context.gl.ALWAYS;
        this._innerLabelPass.aaStepScale = 0.3;
        this._innerLabelPass.aaSampling = LabelRenderPass.Sampling.Grid3x3;

        this._leafLabelPass = new LabelRenderPass(context);
        this._leafLabelPass.initialize();
        //TODO this is highly illegal
        this._leafLabelPass.camera = this.camera as any as Camera;
        this._leafLabelPass.target = this._multiRenderTarget.defaultFBO;

        this._leafLabelPass.aaStepScale = 0.3;
        this._leafLabelPass.aaSampling = LabelRenderPass.Sampling.Grid3x3;

        /**
         * Leaf labels should not be occluded.
         * Depth test is enabled by default in LabelRenderPass, so we set this DepthFunc to ALWAYS.
         * Set DepthFunc to LEQUAL for depth-based occluding.
         * Note: renderLeafLabels() sets the depthMask.
         */
        this._leafLabelPass.depthFunc = context.gl.ALWAYS;

        FontFace.fromFiles(ROBOTO_FONT, new Map<number, string>([[0, ROBOTO_DT]]), context)
            .then((fontFace) => {
                for (const label of this._innerLabelPass.labels) {
                    label.fontFace = fontFace;
                }
                for (const label of this._leafLabelPass.labels) {
                    label.fontFace = fontFace;
                }
                this._fontFace = fontFace;

                this._innerLabelPass.update(true);
                this._leafLabelPass.update(true);

                if (this._visualization.configuration) {
                    this._visualization.configuration.altered.alter('geometry');
                    this._visualization.configuration.altered.alter('labels');
                } else {
                    /* It is possible that the new labels will not be visible until new frame is
                     * triggered by, e.g., moving mouse over treemap */
                }

                this.invalidate();
            })
            .catch((reason) => auxiliaries.log(auxiliaries.LogLevel.Error, reason));
    }

    /**
     * Creates and configures the accumulation rendering pass that is used for blending intermediate
     * frames into a single multi-frame.
     * @param context - The context to initialize the accumulation pass for.
     */
    protected initializeAccumulationPass(context: Context): void {
        this.assertUninitialized();
        assert(this._multiRenderTarget.initialized,
            `expected multi-render target to be initialized`);
        assert(this._ndcTriangle !== undefined,
            `expected NDC triangle to be defined`);

        this._accumulationPass = new AccumulatePass(context);
        this._accumulationPass.initialize(this._ndcTriangle);
        this._accumulationPass.precision = this._framePrecision;
        this._accumulationPass.texture = this._multiRenderTarget.colorRenderTexture;
    }

    /**
     * Creates and configures the blit rendering pass that is used for copying/swapping either the
     * accumulation result.
     * @param context - The context to initialize the blit pass for.
     */
    protected initializeBlitPass(context: Context): void {
        this.assertUninitialized();
        assert(this._multiRenderTarget.initialized,
            `expected multi-render target to be initialized`);
        assert(this._ndcTriangle !== undefined,
            `expected NDC triangle to be defined`);

        const gl = this._context.gl;
        const gl2facade = this._context.gl2facade;

        this._blitPass = new BlitPass(context);
        this._blitPass.initialize(this._ndcTriangle);
        this._blitPass.readBuffer = gl2facade.COLOR_ATTACHMENT0;
        this._blitPass.drawBuffer = gl.BACK;
        this._blitPass.target = this._multiRenderTarget.defaultFBO;
    }

    /**
     * Creates and configures the readback rendering pass that is used for resolving screen coordinates
     * to either node IDs, fragment depths, or world space coordinates.
     * @param context - The context to initialize the readback pass for.
     */
    protected initializeReadbackPass(context: Context): void {
        this.assertUninitialized();
        assert(this._multiRenderTarget.initialized,
            `expected multi-render target to be initialized`);
        assert(this._ndcTriangle !== undefined,
            `expected NDC triangle to be defined`);

        this._readbackPass = new ReadbackPass(context);
        this._readbackPass.initialize(this._ndcTriangle
            , this._multiRenderTarget.depthFBO !== undefined);
        this._readbackPass.cache = true;

        const gl = this._context.gl;
        const gl2facade = this._context.gl2facade;

        if (this._multiRenderTarget.depthFBO) {
            this._readbackPass.depthFBO = this._multiRenderTarget.depthFBO;
            this._readbackPass.depthAttachment = gl2facade.COLOR_ATTACHMENT0;
        } else {
            this._readbackPass.depthFBO = this._multiRenderTarget.primaryFBO;
            this._readbackPass.depthAttachment = gl.DEPTH_STENCIL_ATTACHMENT;
        }

        if (this._multiRenderTarget.readBackIdFBO) {
            this._readbackPass.idFBO = this._multiRenderTarget.readBackIdFBO!;
            this._readbackPass.idAttachment = gl2facade.COLOR_ATTACHMENT0;
        } else {
            this._readbackPass.idFBO = this._multiRenderTarget.primaryFBO;
            this._readbackPass.idAttachment = gl2facade.COLOR_ATTACHMENT1;
        }
    }


    /**
     * Creates and configures the virtual camera for navigation as well as the cuboid and quad
     * rendering passes.
     */
    protected initializeCamera(): void {
        this.assertUninitialized();

        /** @todo: take eye, center, and up from configuration */

        console.log(this._visualization);
        if (this._visualization.visualizationType == VisualizationType.VISUALIZATION_2D) {
            this._camera = new Camera2D();
            this._camera.eye = vec3.fromValues(0, 5.0, 0.2);
            this._camera.center = vec3.fromValues(0.0, 0.0, 0.2);
            this._camera.up = vec3.fromValues(0.0, 0.0, -1.0);
        } else {
            this._camera = new Camera3D();
            this._camera.eye = vec3.fromValues(0, 1.5, 2.2);
            this._camera.center = vec3.fromValues(0.0, 0.0, 0.2);
            this._camera.up = vec3.fromValues(0.0, 1.0, 0.0);
        }

        this._camera.near = Renderer.CAMERA_NEAR_DEFAULT;
        this._camera.far = Renderer.CAMERA_FAR_DEFAULT;

        this._camera.fovy = 2.0 * AbstractCamera.calculateFovY(20.0, 60.0) * auxiliaries.RAD2DEG;
    }

    /**
     *
     * @param callback - Invalidation callback to pass to the navigation for invoking rendering update.
     * @param mouseEventProvider - Event provider to pass to the navigation for mouse events.
     * @param touchEventProvider - Event provider to pass to the navigation for touch events.
     */
    protected initializeNavigation(callback: Invalidate, eventProvider: EventProvider): void {
        this.assertUninitialized();

        this._navigation = new Navigation(callback, eventProvider, this._visualization.visualizationType);
        this._navigation.camera = this._camera;

        this._navigation.idAccess = this;
        this._navigation.coordsAccess = this;
    }

    /**
     * Implementation of the actual initialization, invoked by the super class during initialization.
     * @param context - Context passed to all objects that require/use WebGL.
     * @param callback - Invalidation callback that can shall be used by the navigation
     * @param mouseEventProvider - Mouse event provider for navigation purposes.
     * @param touchEventProvider - Touch event provider for navigation purposes.
     */
    protected onInitialize(context: Context, callback: Invalidate, eventProvider: EventProvider): boolean {

        if (!Renderer.verifyMinimumContextRequirements(context)) {
            return false;
        }

        this._ndcOffsetKernel = new AntiAliasingKernel(this._multiFrameNumber);
        this._ndcOffsetKernel.sort(AbstractKernel.SortApproach.BySquaredLength);

        /* Use a shared ndc triangle for bli, accumulation, and other post processing. */
        this._ndcTriangle = new NdcFillingTriangle(context, 'NdcTriangle');
        this._ndcTriangle.initialize(0);

        this.initializeMultiRenderTarget(context);

        this.initializeAccumulationPass(context);
        this.initializeBlitPass(context);
        this.initializeReadbackPass(context);

        this.initializeCamera();
        this.initializeNavigation(callback, eventProvider);

        this.initializeInnerPass(context);
        this.initializeLeafPasses(context);
        this.initializePointPass(context);
        this.initializeLeafLabelBackgroundPass(context);
        this.initializeLabelPasses(context);

        return true;
    }

    protected onUninitialize(): void {
        this._ndcTriangle.uninitialize();
        this._multiRenderTarget.uninitialize();

        this._accumulationPass.uninitialize();
        this._blitPass.uninitialize();
        this._readbackPass.uninitialize();

        this._innerPass.uninitialize();
        // TODO: their geometry is referenced; uninitialization throws error "expected to be initialized
        // in order to uninitialize". This might become an issue on context lost / restored
        // this._leafPass.uninitialize();
        this._pointPass.uninitialize();
        this._innerLabelPass.uninitialize();
        this._leafLabelPass.uninitialize();
        this._labelBackgroundPass.uninitialize();
    }

    protected onDiscarded(): void {
    }

    /**
     * Checks, whether or not a new multi-frame should be drawn (only if any relevant input has
     * changed). This can happen due to camera modifications (updating navigation), visualization
     * changes that might change any geometry or rendering configuration, or anything else that is
     * tracked using the alteration tracker. Note that even when this returns false, meaning no new
     * multi-frame needs to be rendered, a rendering can be forced by the controller.
     * @returns True when a new multi-frame should be rendered (because it will probably differ from
     * the previous), else otherwise.
     */
    protected onUpdate(): boolean {
        this._navigation.update();

        let changed = false;
        try {
            changed = this._visualization.update();
        } catch (error) {
            log(LogLevel.Error, error);
        }

        let labelsChanged = false;
        for (const label of this._innerLabelPass.labels) {
            if (label.altered || label.color.altered) {
                labelsChanged = true;
                break;
            }
        }
        for (const label of this._leafLabelPass.labels) {
            if (label.altered || label.color.altered) {
                labelsChanged = true;
                break;
            }
        }

        return changed || labelsChanged || this._altered.any || this._camera.altered;
    }

    /**
     * This is called when rendering of a new multi-frame is invoked (updated returned true or is
     * forced). This routine configures everything related to the full multi-frame (everything that
     * does not change in between intermediate frames). This covers creating appropriate number of
     * cuboid rendering passes, and reacting to any geometry change appropriately by handling or
     * forwarding the altered data/settings.
     */
    protected onPrepare(): void {

        /* @todo refine this lazy checking - this is not how it should be. Instead, a specific task
        should be invoked for every specific alteration. If the topology changes it should cause the
        all specific parts of the geometry to have changed ... so more refined alteration tracking on
        configuration, geometry, and visualization is key. */

        /* Check for topology changes. */
        if (this._geometry.altered.any && this._geometry.valid) {

            this._innerPass.ids = this._geometry.innerNodeIndices!;
            this._innerPass.layout = this._geometry.innerNodeLayouts!;
            this._innerPass.colors = this._geometry.innerNodeColors!;
            this._innerPass.emphases = this._geometry.innerNodeEmphases!;
            this._innerPass.colorTable = this._geometry.colorTable!;
            this._innerPass.topology = this._geometry.topology;
            this._innerPass.showRoot = this._geometry.showRoot;

            this._leafPass.ids = this._geometry.leafNodeIndices!;
            this._leafPass.layoutData = this._geometry.leafNodeLayouts!;
            this._leafPass.areaScales = this._geometry.leafNodeAreaScales!;
            this._leafPass.colors = this._geometry.leafNodeColors!;
            this._leafPass.emphases = this._geometry.leafNodeEmphases!;
            this._leafPass.heights = this._geometry.leafNodeHeights!;
            this._leafPass.colorTable = this._geometry.colorTable!;
            this._leafPass.topology = this._geometry.topology;
        }

        if (this._geometry.altered.colorTableLength) {

            this._leafPass.colorTableLengthAltered();
        }

        if (this._geometry.altered.outlineWidth) {
            this._innerPass.outlineWidth = this._geometry.outlineWidth!;
            this._leafPass.outlineWidth = this._geometry.outlineWidth!;
        }

        if (this._geometry.altered.emphasisOutlineWidth) {
            this._innerPass.emphasisOutlineWidth = this._geometry.emphasisOutlineWidth!;
            this._leafPass.emphasisOutlineWidth = this._geometry.emphasisOutlineWidth!;
        }


        if (this._geometry.altered.heightScale) {
            this._leafPass.heightScale = this._geometry.heightScale!;
        }

        if (this._altered.frameSize) {
            this._multiRenderTarget.resize(this._frameSize[0], this._frameSize[1]);
            this._camera.viewport = [this._frameSize[0], this._frameSize[1]];

            /** trigger rendering of 2D labels for immediate re-positioning based on new frame size */
            this.invalidate();

        }
        if (this._altered.canvasSize) {
            this._camera.aspect = this._canvasSize[0] / this._canvasSize[1];
            this._readbackPass.coordinateReferenceSize = this._canvasSize;
        }

        if (this._altered.multiFrameNumber) {
            this._ndcOffsetKernel.width = this._multiFrameNumber;
            this._ndcOffsetKernel.sort(AbstractKernel.SortApproach.BySquaredLength);
        }
        if (this._altered.framePrecision) {
            this._accumulationPass.precision = this._framePrecision;
        }

        if (this._altered.clearColor) {
            this._multiRenderTarget.setClearColor(this._clearColor);
        }

        this._innerPass.update();
        this._leafPass.update();

        this._pointPass.update();
        this._labelBackgroundPass.update();

        this._innerLabelPass.update();
        this._leafLabelPass.update();

        this._accumulationPass.update();
        this._readbackPass.frame();

        /** @todo this should be removed with new labeling (labeling will be applied in renderer). */
        this._visualization.prepare();

        /* Reset alteration status of camera, geometry, and this renderer. */
        this._camera.altered = false;
        this._geometry.altered.reset();
        this._altered.reset();
    }

    /**
     * This implements the actual rendering of an intermediate frame, i.e., a single sample of a
     * multi-frame sampling.
     * @param frameNumber - The number of the current intermediate frame (first handled differently).
     */
    protected onFrame(frameNumber: number): void {
        const gl = this._context.gl;
        const gl2facade = this._context.gl2facade;

        /* Gather anti-aliasing offset for anti-aliasing via accumulation (multi-frame-rendering). */
        const ndcOffset = this._ndcOffsetKernel.get(frameNumber) as [number, number];
        ndcOffset[0] = this._ndcOffsetScale * 2.0 * ndcOffset[0] / this._frameSize[0];
        ndcOffset[1] = this._ndcOffsetScale * 2.0 * ndcOffset[1] / this._frameSize[1];

        this._leafPass.ndcOffset = ndcOffset;
        this._innerPass.ndcOffset = ndcOffset;
        this._innerLabelPass.ndcOffset = ndcOffset;
        this._leafLabelPass.ndcOffset = ndcOffset;
        this._pointPass.ndcOffset = ndcOffset;
        this._labelBackgroundPass.ndcOffset = ndcOffset;

        const isFirstFrame = frameNumber === 0;
        const mrt = this._multiRenderTarget;

        /* Define and clear current render target. */
        const target = isFirstFrame ? mrt.primaryFBO : mrt.secondaryFBO;
        target.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT, true, false);

        /** @todo investigate z-pass benefits */
        /** @todo probably bind targets here, not in specialized renderers */

        gl.viewport(0, 0, this._camera.viewport[0], this._camera.viewport[1]);
        gl.depthFunc(gl.LESS);

        const atch = MultiRenderTarget.Attachment;

        // Configure the draw buffers for both color and id rendering
        if (!mrt.drawRestricted) {
            gl2facade.drawBuffers!([gl2facade.COLOR_ATTACHMENT0, gl2facade.COLOR_ATTACHMENT1]);
        }

        this.renderLeafNodes(target, mrt.drawRestricted ? atch.Color : atch.Undefined, true);
        this.renderInnerNodes(target, mrt.drawRestricted ? atch.Color : atch.Undefined, true);

        // Configure the draw buffers for color rendering only
        if (!mrt.drawRestricted) {
            gl2facade.drawBuffers!([gl2facade.COLOR_ATTACHMENT0, gl.NONE]);
        }

        this.renderInnerLabels(target, mrt.drawRestricted ? atch.Color : atch.Undefined, false);
        this.renderLeafLabelBackgrounds(target, false);
        this.renderLeafLabels(target, mrt.drawRestricted ? atch.Color : atch.Undefined, false);
        this.renderPoints(target, false);

        if (!mrt.drawRestricted) {
            gl2facade.drawBuffers!([gl2facade.COLOR_ATTACHMENT0, gl2facade.COLOR_ATTACHMENT1]);
        }

        if (isFirstFrame && mrt.idFBO) {
            mrt.idFBO.clear(gl.COLOR_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
            this.renderLeafNodes(mrt.idFBO, atch.Id, false);
            this.renderInnerNodes(mrt.idFBO, atch.Id, false);
        }
        if (isFirstFrame && mrt.depthFBO) {
            mrt.depthFBO.clear(gl.COLOR_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
            /* The attachment 2 is referencing the draw mode rather than the actual attachment index */
            this.renderLeafNodes(mrt.depthFBO, atch.Depth, false);
            this.renderInnerNodes(mrt.depthFBO, atch.Depth, false);
        }

        this._accumulationPass.frame(frameNumber);
    }

    protected onSwap(): void {
        /* Avoid blitting before everything is initialized. */
        if (!this._accumulationPass.initialized || !this._accumulationPass.framebuffer?.initialized
            || !this._blitPass.initialized) {

            return;
        }
        const blit = this._blitPass;

        blit.framebuffer = this._accumulationPass.framebuffer!;
        blit.readBuffer = this._context.gl2facade.COLOR_ATTACHMENT0;
        blit.frame();
    }

    /**
     * Sets/updates the given labels on the given label render pass.
     * @see updateLabels()
     * @param labels - an array of labels which should be rendered
     * @param labelPass - the label render pass which should render the given labels
     */
    protected updateLabelsForPass(labels: Label[], labelPass: LabelRenderPass): void {
        const nonSparseLabels: Label[] = [];

        for (const label of labels) {
            if (label === undefined) {
                continue;
            }
            /** We cannot know if the labels are set before or after the fontFace is loaded. Setting an
             * undefined fontFace is valid; when the fontFace is loaded, all labels get updated with the
             * new fontFace.
             */
            label.fontFace = this._fontFace;
            nonSparseLabels.push(label);
        }

        labelPass.labels = nonSparseLabels;
        labelPass.update();
    }

    /**
     * Sets/updates the labels and updates the label render passes.
     * @see updateLabelsForPass()
     * @param innerNodeLabels - all labels placed on inner nodes
     * @param leafLabels - all labels placed on leaf nodes
     */
    updateLabels(innerNodeLabels: Position3DLabel[], leafLabels: Projected3DLabel[]): void {
        this.updateLabelsForPass(innerNodeLabels, this._innerLabelPass);
        this.updateLabelsForPass(leafLabels, this._leafLabelPass);
    }

    /**
     * Manually trigger an update on the leaf label pass. This can be used if the current leaf labels
     * have been changed (alignment, lineAnchor, color, ...), but no labels were added nor removed.
     */
    updateLeafLabelPass(): void {
        this._leafLabelPass.update();
    }

    /**
     * Sets/updates the quads that are drawn as the leaf labels' backgrounds.
     * @param leafLabels - all leaf labels
     */
    updateLeafLabelBackgrounds(leafLabels: Array<Projected3DLabel>): void {
        const origins = [];
        const extents = [];
        const offsets = [];
        const pointyCorners = [];

        let maxExtentY = 0;

        // two loops, first round: get maximum vertical extent. This is needed so all extent have the
        // same height - because the label's vertical extent depends on the label's text and thus can be
        // different for each label, which looks weird for the label's backgrounds.
        for (const label of leafLabels) {
            if (!label || label.color.a === 0) {
                // don't draw backgrounds for undefined or invisible label
                continue;
            }

            // I have no idea why we have to multiply by 2 to make it work... maybe label.extent is
            // somehow wrong? (tested for different devicePixelRatios here, it's always the same)
            const extentY = (2.0 * label.extent[1]) / this._frameSize[1];
            maxExtentY = Math.max(maxExtentY, extentY);
        }

        // two loops, second round: now that we have maximum vertical extent, set all extents and
        // calculate the offsets accordingly.
        for (const label of leafLabels) {
            if (!label || label.color.a === 0) {
                // don't draw backgrounds for undefined or invisible label
                continue;
            }

            origins.push(label.position[0], label.position[1], label.position[2]);

            // the quad will be placed at a reference point. Horizontally, it will be placed at the
            // point's border; vertically, it will be placed at the point's center. Therefore we need to
            // adjust the offset and the extent.
            const horiPixelPadding = POINT_SIZE * 0.5;
            const topPixelPadding = POINT_SIZE * 0.5;

            // I have no idea why we have to multiply by 2 to make it work... maybe label.extent is
            // somehow wrong? (tested for different devicePixelRatios here, it's always the same)
            const extentX = (2.0 * label.extent[0] + horiPixelPadding) / this._frameSize[0];
            extents.push(extentX, maxExtentY);

            // offset is in NDC, while position is not
            const horiNDCPadding = horiPixelPadding / this._frameSize[1];
            const offsetX = label.alignment === Label.Alignment.Right ?
                -horiNDCPadding - extentX : horiNDCPadding;

            const verticalNDCPadding = topPixelPadding / this._frameSize[1];
            const offsetY = label.lineAnchor === Label.LineAnchor.Top ?
                verticalNDCPadding - maxExtentY : -verticalNDCPadding;

            offsets.push(offsetX, offsetY);

            // pointy corner number as 1: ll, 2: ul, 3: lr, 4: ur
            // (there is only one pointy corner, the other corners are round)
            let pointyCorner = 0;
            if (label.alignment === Label.Alignment.Left) {
                if (label.lineAnchor === Label.LineAnchor.Bottom) {
                    // ll
                    pointyCorner = 1;
                } else if (label.lineAnchor === Label.LineAnchor.Top) {
                    // ul
                    pointyCorner = 2;
                }
            } else if (label.alignment === Label.Alignment.Right) {
                if (label.lineAnchor === Label.LineAnchor.Bottom) {
                    // lr
                    pointyCorner = 3;
                } else if (label.lineAnchor === Label.LineAnchor.Top) {
                    // ur
                    pointyCorner = 4;
                }
            }
            pointyCorners.push(pointyCorner);
        }

        this._labelBackgroundPass.updateData(
            new Float32Array(origins),
            new Float32Array(extents),
            new Float32Array(offsets),
            new Uint8Array(pointyCorners),
        );
    }

    /**
     * Sets/updates the positions for points that are drawn at the leaf labels' positions as reference.
     * The point color is the label's color.
     * @param leafLabels - all leaf labels
     */
    updatePoints(leafLabels: Projected3DLabel[]): void {
        const positions = [];
        const colors = [];
        for (const label of leafLabels) {
            if (!label) {
                continue;
            }
            positions.push(label.position[0], label.position[1], label.position[2]);
            colors.push(label.color.r, label.color.g, label.color.b, label.color.a);
        }
        this._pointPass.positions = new Float32Array(positions);
        this._pointPass.colors = new Float32Array(colors);
    }

    /**
     * Expose alteration status of the frame size. It is currently used on the visualization to adapt
     * some geometry (label backgrounds).
     */
    frameSizeAltered(): boolean {
        return this._altered.frameSize;
    }

    /**
     * Convenience function, so that a client using the treemap-lib does not need to import vec3 to set
     * the camera's position.
     */
    setCameraEye(eyeX: number, eyeY: number, eyeZ: number): void {
        this._camera.eye = vec3.fromValues(eyeX, eyeY, eyeZ);
    }

    /** Expose protected invalidation of super class. */
    invalidate(): void {
        if (!this.initialized) {
            return;
        }
        super.invalidate(true);
    }


    /**
     * Look up a fragments coordinates by unprojecting the depth using the camera.
     * @param x - Horizontal coordinate for the upper left corner of the viewport origin.
     * @param y - Vertical coordinate for the upper left corner of the viewport origin.
     * @param zInNDC - optional depth parameter (e.g., from previous query).
     * @returns - 3D coordinate reprojected from NDC/depth to world space.
     */
    coordsAt = (x: GLint, y: GLint, zInNDC?: number, viewProjectionInverse?: mat4)
        : vec3 | undefined => {
        const coords = this._readbackPass.coordsAt(x, y, zInNDC, viewProjectionInverse === undefined ?
            this._camera.viewProjectionInverse! : viewProjectionInverse);
        return coords;
    }


    /**
     * Look up an object id at a specific fragment.
     * @param x - Horizontal coordinate for the upper left corner of the viewport origin.
     * @param y - Vertical coordinate for the upper left corner of the viewport origin.
     * @returns - ID encoded of an object rendered/visible at given position.
     */
    idAt = (x: GLint, y: GLint): GLsizei | undefined => {
        if (!this._geometry.initialized) {
            return undefined;
        }

        const index = this._readbackPass.idAt(x, y);
        if (index === undefined || index === 0) {
            return undefined;
        }
        const node = this._geometry.topology.node(index);
        return node === undefined ? undefined : node.id as GLsizei;
    }

}
