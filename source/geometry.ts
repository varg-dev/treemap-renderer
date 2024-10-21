
/* spellchecker: disable */

import { ChangeLookup, Initializable } from 'webgl-operate';

import { Topology } from './topology';

/* spellchecker: enable */

/**
 * This is (will be) the single interchange format that is passed from visualization to renderer.
 * Instead of using a simple structure with public members, this implements alteration detection using
 * getter/setter on private members. Even though this is already done on configuration side (@see
 * {@link Configuration}) it is important to (re)track alterations specifically for the generated
 * geometry since (1) a configuration change might impose multiple or partial geometry changes (no
 * direct one-to-one mapping) and (2) the alteration states should be available for the renderer.
 * The object is designed as initializable in order to allow creation of a single object that is
 * assigned to a renderer and then can be updated without changing the actual underlying object.
 */
export class Geometry extends Initializable {

    /**
     * Alterable auxiliary object for tracking changes on renderer input and lazy updates.
     */
    private readonly _altered = Object.assign(new ChangeLookup(), {
        any: false,

        colorTableLength: false,
        colorTable: false,

        innerNodeIndices: false,
        innerNodeLayouts: false,
        innerNodeEmphases: false,
        innerNodeColors: false,

        leafNodeIndices: false,
        leafNodeLayouts: false,
        leafNodeEmphases: false,

        leafNodeAreaScales: false,
        leafNodeColors: false,
        leafNodeHeights: false,

        outlineWidth: false,
        emphasisOutlineWidth: false,

        heightScale: false,

        labels: false,
    });


    /** @see{@link topology} */
    private _topology: Topology | undefined;


    /**
     * @see{@link innerNodeIndices} and @see{@link NodeIndices.innerNodes}
     */
    private _innerNodeIndices: Uint8Array | undefined;

    /**
     * @see{@link innerNodeLayouts} and @see{@link NodeLayouts.innerNodes}
     */
    private _innerNodeLayouts: Float32Array | undefined;

    /**
     * @see{@link innerNodeEmphases} and @see{@link NodeEmphases.innerNodes}
     */
    private _innerNodeEmphases: Uint8Array | undefined;

    /** @see{@link innerNodeColors} and @see{@link NodeColors.innerNodes} */
    private _innerNodeColors: Uint8Array | undefined;


    /** @see{@link leafNodeIndices} and @see{@link NodeIndices.leafNodes} */
    private _leafNodeIndices: Uint8Array | undefined;

    /** @see{@link leafNodeLayouts} and @see{@link NodeLayouts.leafNodes} */
    private _leafNodeLayouts: Float32Array | undefined;

    /** @see{@link leafNodeEmphases} and @see{@link NodeEmphases.leafNodes} */
    private _leafNodeEmphases: Uint8Array | undefined;

    /**
     * Array of leaf node area scales @see{@link GeometryCreation.createLeafNodeAreaScales}
     */
    private _leafNodeAreaScales: Uint8Array | undefined;

    /**
     * Array of leaf node colors @see{@link GeometryCreation.createLeafNodeColors}
     */
    private _leafNodeColors: Uint8Array | undefined;

    /**
     * Array of leaf node heights @see{@link GeometryCreation.createLeafNodeHeights}
     */
    private _leafNodeHeights: Uint8Array | undefined;

    /** @see {@link heightScale} */
    private _heightScale: number | undefined;

    /** @see {@link outlineWidth} */
    private _outlineWidth: number | undefined;

    /** @see {@link emphasisOutlineWidth} */
    private _emphasisOutlineWidth: number | undefined;

    /** @see {@link showRoot} */
    private _showRoot: boolean;

    /** @todo - continue refinement - alteration tracking */

    /** @see {@link colorTable} */
    private _colorTable: Float32Array | undefined;

    /** @todo - end refinement */


    @Initializable.initialize()
    initialize(topology: Topology): boolean {
        this._topology = topology;
        this._altered.alter('any');

        return this._topology.numberOfInnerNodes > 0 || this._topology.numberOfLeafNodes > 0;
    }

    @Initializable.uninitialize()
    uninitialize(): void {
        this._topology = undefined;

        this._colorTable = undefined;

        this._leafNodeAreaScales = undefined;
        this._leafNodeColors = undefined;
        this._leafNodeHeights = undefined;

        this._innerNodeIndices = undefined;
        this._innerNodeLayouts = undefined;
        this._innerNodeEmphases = undefined;
        this._innerNodeColors = undefined;

        this._leafNodeIndices = undefined;
        this._leafNodeLayouts = undefined;
        this._leafNodeEmphases = undefined;

        this._showRoot = true;
    }


    /**
     * Accessor for the altered object. The caller is responsible to reset the altered-status.
     */
    get altered(): any {
        return this._altered;
    }


    /**
     * The geometries underlying topology. This can only be changed via initialization.
     */
    get topology(): Topology {
        this.assertInitialized();
        return this._topology!;
    }


    set innerNodeIndices(indices: Uint8Array | undefined) {
        this.assertInitialized();
        this._innerNodeIndices = indices;
        this._altered.alter('innerNodeIndices');
    }
    get innerNodeIndices(): Uint8Array | undefined {
        return this._innerNodeIndices;
    }

    set innerNodeLayouts(layouts: Float32Array | undefined) {
        this.assertInitialized();
        this._innerNodeLayouts = layouts;
        this._altered.alter('innerNodeLayouts');
    }
    get innerNodeLayouts(): Float32Array | undefined {
        return this._innerNodeLayouts;
    }

    set innerNodeEmphases(emphases: Uint8Array | undefined) {
        this.assertInitialized();
        this._innerNodeEmphases = emphases;
        this._altered.alter('innerNodeEmphases');
    }
    get innerNodeEmphases(): Uint8Array | undefined {
        return this._innerNodeEmphases;
    }

    set innerNodeColors(colors: Uint8Array | undefined) {
        this.assertInitialized();
        this._innerNodeColors = colors;
        this._altered.alter('innerNodeColors');
    }
    get innerNodeColors(): Uint8Array | undefined {
        return this._innerNodeColors;
    }


    set leafNodeIndices(indices: Uint8Array | undefined) {
        this.assertInitialized();
        this._leafNodeIndices = indices;
        this._altered.alter('leafNodeIndices');
    }
    get leafNodeIndices(): Uint8Array | undefined {
        return this._leafNodeIndices;
    }

    set leafNodeLayouts(layouts: Float32Array | undefined) {
        this.assertInitialized();
        this._leafNodeLayouts = layouts;
        this._altered.alter('leafNodeLayouts');
    }
    get leafNodeLayouts(): Float32Array | undefined {
        return this._leafNodeLayouts;
    }

    set leafNodeEmphases(emphases: Uint8Array | undefined) {
        this.assertInitialized();
        this._leafNodeEmphases = emphases;
        this._altered.alter('leafNodeEmphases');
    }
    get leafNodeEmphases(): Uint8Array | undefined {
        return this._leafNodeEmphases;
    }

    get leafNodeAreaScales(): Uint8Array | undefined {
        return this._leafNodeAreaScales;
    }

    set leafNodeAreaScales(leafNodeAreaScales: Uint8Array | undefined) {
        this.assertInitialized();
        this._leafNodeAreaScales = leafNodeAreaScales;
        this._altered.alter('leafNodeAreaScales');
    }

    get leafNodeColors(): Uint8Array | undefined {
        return this._leafNodeColors;
    }

    set leafNodeColors(leafNodeColors: Uint8Array | undefined) {
        this.assertInitialized();
        this._leafNodeColors = leafNodeColors;
        this._altered.alter('leafNodeColors');
    }

    set colorTable(colorTable: Float32Array | undefined) {
        this.assertInitialized();
        this._colorTable = colorTable;
        this._altered.alter('colorTable');
    }
    get colorTable(): Float32Array | undefined {
        return this._colorTable;
    }

    get leafNodeHeights(): Uint8Array | undefined {
        return this._leafNodeHeights;
    }

    set leafNodeHeights(leafNodeHeights: Uint8Array | undefined) {
        this.assertInitialized();
        this._leafNodeHeights = leafNodeHeights;
        this._altered.alter('leafNodeHeights');
    }


    /**
     * Read-only access to the number of inner nodes.
     */
    get innerNodeCount(): number {
        this.assertInitialized();
        return this._topology!.numberOfInnerNodes;
    }

    /**
     * Read-only access to the number of leaf nodes.
     */
    get leafNodeCount(): number {
        this.assertInitialized();
        return this._topology!.numberOfLeafNodes;
    }


    set heightScale(scale: number | undefined) {
        this.assertInitialized();
        this._heightScale = scale;
        this._altered.alter('heightScale');
    }
    get heightScale(): number | undefined {
        return this._heightScale;
    }


    set outlineWidth(width: number | undefined) {
        this.assertInitialized();
        this._outlineWidth = width;
        this._altered.alter('outlineWidth');
    }
    get outlineWidth(): number | undefined {
        return this._outlineWidth;
    }


    set emphasisOutlineWidth(width: number | undefined) {
        this.assertInitialized();
        this._emphasisOutlineWidth = width;
        this._altered.alter('emphasisOutlineWidth');
    }
    get emphasisOutlineWidth(): number | undefined {
        return this._emphasisOutlineWidth;
    }

    set showRoot(show: boolean) {
        this.assertInitialized();
        this._showRoot = show ? true : false;
        this._altered.alter('any');
    }
    get showRoot(): boolean {
        return this._showRoot;
    }


    /**
     * @todo this should indicated if everything is setup rather than just being initialized ...
     */
    get valid(): boolean {
        return this.initialized;
    }

}

export namespace Geometry {

    /**
     * The emphasis draw mode indicates for both, inner nodes and leaf nodes their emphasis state. This
     * state is used during geometry creation @see{@link createInnerNodeEmphasis} and
     * @see{@link createLeafNodeEmphasis} and is passed through as vertex attribute for for cuboid and
     * quad drawing (evaluated within the respective shaders). For now, the mapping directly correlates
     * to the cuboid and quad drawing capabilities.
     */
    export enum Emphasis {
        None = 0, /* Default color mapping is applied, no emphasis. */
        Outline = 1, /* Node is outlined per face with the specified emphasis-outline color. */
        Highlight = 2, /* Node is fully colored with the specified emphasis-highlight color. */
    }

}
