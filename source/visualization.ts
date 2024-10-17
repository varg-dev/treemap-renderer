
/* spellchecker: disable */

import { auxiliaries, tuples } from 'webgl-operate';
import { Color, ColorScale } from 'webgl-operate';

const assert = auxiliaries.assert;

import {
    Renderer as AbstractRenderer,
} from 'webgl-operate';

import { NodeColors } from './geometry/nodecolors';
import { NodeEmphases } from './geometry/nodeemphases';
import { NodeIndices } from './geometry/nodeindices';

import { AdaptiveLabelPlacement } from './adaptivelabelplacement';
import { AttributeBuffer } from './attributebuffer';
import { BufferResolver } from './bufferresolver';
import { ColorTable } from './colortable';
import { Configuration } from './configuration';
import { ConfigurationAids } from './configurationaids';
import { Geometry } from './geometry';
import { GeometryCreation } from './geometrycreation';
import { IntermediateResults } from './intermediateresults';
import { LabelManagement } from './labelmanagement';
import { Layout } from './layout';
import { NodeSort } from './nodesort';
import { Rect } from './rect';
import { Renderer } from './renderer';
import { Topology } from './topology';

import colorbrewer_JSON from './data/colorbrewer.json';
import smithwalt_JSON from './data/smithwalt.json';

const ColorPresets = [
    ...colorbrewer_JSON,
    ...smithwalt_JSON
]


/* spellchecker: enable */


/**
 * @todo DL - cleanup this messy class - it comprises the most essential controlling and is barley
 * readable and hard to maintain in its current state. Review and refactor this asap!
 */
export class Visualization {

    /**
     * Cached variables for lazy update of geometry - @todo DL - review this.
     */
    private _intermediaries = new IntermediateResults();

    /**
     * Intermediate cache value for the currently set normalization scheme for buffer resolve
     */
    private _normalization: AttributeBuffer.Normalization;

    /**
     * True when the labels are changed by the visualization. This does not include updates on already
     * existing labels, e.g., positioning.
     */
    private _labelsChanged = false;

    /** @see {@link configuration} */
    protected _configuration: Configuration | undefined;

    // TODO: this seems like it should be recreated once the topology is reassigned.
    // The instance doesn't change but gets reinitialized upon config topology changes.
    protected _bufferResolver: BufferResolver = new BufferResolver(this._intermediaries.topology);

    /** @see {@link geometry} */
    protected _geometry: Geometry = new Geometry();

    /** @see {@link renderer} */
    protected _renderer: Renderer;

    /** @todo - refine this later */
    protected _colorLUT: ColorTable;

    constructor() {
        this._renderer = new Renderer(this);

        this._renderer.geometry = this._geometry;
    }

    /**
     * Apply the given color mapping to all inner nodes. This creates (1) an emphasis buffer to capture
     * every node's emphasis state for rendering, as well as (2) a color index buffer that is used for
     * color lookup during rendering.
     * @param config - Treemap configuration used to derive alterations and the actual color mapping.
     */
    protected applyInnerNodeColorMapping(config: Configuration): void {
        const geometryConfig = config.geometry;
        const altered = config.altered.geometry;

        assert(this._geometry.innerNodeColors !== undefined || altered.any,
            `expected any alteration when inner-node color mapping is yet to be defined`);

        /* @todo: also update when color table has changed (e.g., number of colors changed). */
        if (!altered.any && !config.altered.topology) {
            return;
        }

        assert(this._geometry !== undefined && this._geometry.colorTable !== undefined,
            `expected color lookup-table to be specified (cached)`);

        const topology = this._intermediaries.topology;

        if (config.altered.topology || altered.emphasis.any) {
            this._geometry.innerNodeEmphases = NodeEmphases.innerNodes(topology,
                geometryConfig.emphasis ? new Set(geometryConfig.emphasis.outline) : undefined,
                geometryConfig.emphasis ? new Set(geometryConfig.emphasis.highlight) : undefined);
        }

        if (config.altered.topology) {
            this._geometry.innerNodeColors = NodeColors.innerNodes(topology,
                this._colorLUT.innerNodeColorOffset,
                this._colorLUT.innerNodeColorCount);
        }
    }


    protected applyLeafNodeColorMapping(config: Configuration): void {
        const geometryConfig = config.geometry;
        const altered = config.altered.geometry;

        /* @todo: also update when color table has changed (e.g., number of colors changed). */
        if (!altered.any && !config.altered.topology) {
            return;
        }

        assert(this._geometry !== undefined && this._geometry.colorTable !== undefined,
            `expected color lookup-table to be specified (cached)`);


        const hasLeafLayer = geometryConfig.leafLayer !== undefined;

        /* If not explicitly configured, create data for a flat, default layer using the first color
        index. */
        if (!hasLeafLayer) {
            this._geometry.leafNodeColors = GeometryCreation.defaultLeafNodeColors(
                this._intermediaries.topology, this._colorLUT.leafColorOffset);

            return;
        }

        /* Create emphases buffer for all leaf nodes of all layers. */
        if (config.altered.topology || altered.emphasis.any) {
            this._geometry.leafNodeEmphases = NodeEmphases.leafNodes(
                this._intermediaries.topology,
                geometryConfig.emphasis ? new Set(geometryConfig.emphasis.outline) : undefined,
                geometryConfig.emphasis ? new Set(geometryConfig.emphasis.highlight) : undefined);
        }

        /* Skip color mapping if nothing has changed and colors were previously mapped. */
        if (!altered.colors) {
            return;
        }

        /* Acually start mapping attribute values to color indices. */
        const colors = this._bufferResolver.resolve(geometryConfig.leafLayer!.colors!, config,
            this._normalization, this._bufferResolver.constBufferCallback(0.0))!;

        this._intermediaries.aggregatedColors = colors;

        /* Deduce the domain of the attribute mapped to color. */
        const range: [number, number] = AttributeBuffer.range(colors)!;
        // i === 0 ? AttributeBuffer.range(colors[i])! : [0, 1];
        const colorCount = this._colorLUT.leafColorCount;
        // i === 0 ? colorTable.leafColorCount : colorTable.deltaColorCount;
        const colorOffset = this._colorLUT.leafColorOffset;
        // i === 0 ? colorTable.leafColorOffset : colorTable.deltaColorOffset;

        this._geometry.leafNodeColors = GeometryCreation.createLeafNodeColors(
            this._intermediaries.topology, colors, colorOffset, colorCount, range);

        this._geometry.altered.alter('leafNodeColors');
    }


    /**
     * Creates nested layout. Can transform it to cascaded layout (see config).
     * @param tree - The underlying topology.
     * @param weights - The array of weights.
     * @param configuration - Configuration as source of layout algorithm and settings.
     * @param accessorySpaces - out - the spaces where the inner labels can be placed; by node.index
     * @param labelRects - out - the rectangle of the inner nodes, including padding; by node.index
     * @param labelPaddingSpaces - out - the padding spaces of the inner nodes; by node.index
     */
    protected createLayout(tree: Topology, weights: Configuration.AttributeBuffer,
        configuration: Configuration, accessorySpaces: Rect[], labelRects: Rect[],
        labelPaddingSpaces: number[]): Rect[] {

        const layout = Layout.createLayout(tree, weights, configuration.layout, accessorySpaces,
            labelRects, labelPaddingSpaces);

        return layout;
    }

    /**
     * Update the labels to recent changes in geometry, camera settings, amount of labels, etc. This
     * triggers adaptive label placement and updates label backgrounds and label reference points.
     */
    protected updateLabels(): void {
        const innerNodeLabels = this._intermediaries.innerNodeLabels;
        const leafLabels = this._intermediaries.leafLabels;

        if (this._geometry === undefined || !this._geometry.valid
            || leafLabels === undefined || innerNodeLabels === undefined) {
            return;
        }

        let labelBackgroundsNeedsUpdate = false;

        // Update general labels
        if (this._labelsChanged) {
            // this usually happens when new labels are created, e.g., after font face is loaded or
            // after the visualization is updated due to new data set
            this._renderer.updateLabels(innerNodeLabels, leafLabels);
            this._renderer.updatePoints(leafLabels);
            labelBackgroundsNeedsUpdate = true;
        }

        // Update leaf node labels
        if (this._renderer.camera.altered || this._labelsChanged) {
            const labelsAdapted = AdaptiveLabelPlacement.adaptPositionToPreventOverlapGreedy(
                leafLabels, this._renderer.camera);

            if (labelsAdapted.visibility || labelsAdapted.positioning) {
                this._renderer.updateLeafLabelBackgrounds(leafLabels);
                // Although the labels' alignments and colors are already adapted, we need to trigger an
                // update to make sure that the applied adaptations are rendered without delay. (The
                // delay might happen on initial adapted position).
                this._renderer.updateLeafLabelPass();
            } else if (this._renderer.frameSizeAltered()) {
                // We don't want to react on any camera change, but only on the altered frame size. The
                // leaf labels adapt themselves to frame size changes, but their backgrounds wouldn't.
                this._renderer.updateLeafLabelBackgrounds(leafLabels);
            } else if (labelBackgroundsNeedsUpdate) {
                this._renderer.updateLeafLabelBackgrounds(leafLabels);
            }

            if (labelsAdapted.visibility) {
                // this way, every point with a hidden label will be hidden, too, as the points use the
                // the label's color (which is set with alpha=0 to hide it)
                this._renderer.updatePoints(leafLabels);
            }
        }

        if (this._labelsChanged) {
            this._labelsChanged = false;
        }
    }

    /**
     * @todo DL - cleanup this messy function - it comprises the most essential controlling and is
     * barley readable and hard to maintain in its current state. Review and refactor this asap!
     */
    update(): boolean {

        if (this._configuration === undefined || this._configuration.topology === undefined) {
            if (this._geometry.initialized) {
                this._geometry.uninitialize();
            }
            return true;
        }

        const config = this._configuration;
        const altered = config.altered;

        // Early out if nothing has changed
        if (!altered.any) {
            // Should not be required as nothing has changed
            // config.altered.reset();

            return false;
        }

        assert(config.topology !== undefined, `Valid topology expected`);

        // let t = this.logPipelinePart();

        let orderInvalid = altered.layout.sort;

        //
        // Tree
        //

        const tree = this._intermediaries.topology;

        let layout: Array<Rect> | undefined = undefined;

        if (altered.topology) {
            tree.initialize(config.topology.format as Topology.InputFormat,
                config.topology.semantics as Topology.InputSemantics,
                config.topology.edges);

            // Invalidate intermediaries
            this._intermediaries.aggregatedWeights = undefined;
            this._intermediaries.aggregatedHeights = undefined;
            this._intermediaries.aggregatedColors = undefined;
            this._intermediaries.accessorySpaces = undefined;
            this._intermediaries.labelRects = undefined;
            this._intermediaries.labelPaddingSpaces = undefined;
            layout = undefined;

            if (this._geometry.initialized) {
                this._geometry.uninitialize();
            }
            this._geometry.initialize(tree);

            orderInvalid = true;
        }

        this._normalization = AttributeBuffer.createNormalization(tree, config);

        //
        // Weights
        //

        let weightBuffer = this._intermediaries.aggregatedWeights;
        if (weightBuffer === undefined || altered.layout.weight) {

            weightBuffer = this._intermediaries.aggregatedWeights =
                this._bufferResolver.resolve(config.layout.weight, config, this._normalization)!;

            /* Invalidate intermediaries. */
            layout = undefined;
            orderInvalid = true;
        }

        //
        // Order
        //

        if (orderInvalid) {
            NodeSort.sortNodes(tree, this._normalization, weightBuffer, config);

            // Invalidate intermediaries
            layout = undefined;
        }

        //
        // Layout
        //

        let accessorySpaces = this._intermediaries.accessorySpaces;
        let labelRects = this._intermediaries.labelRects;
        let labelPaddingSpaces = this._intermediaries.labelPaddingSpaces;

        if (layout === undefined || altered.layout.any) {

            accessorySpaces = this._intermediaries.accessorySpaces =
                new Array<Rect>(tree.numberOfInnerNodes);
            labelRects = this._intermediaries.labelRects =
                new Array<Rect>(tree.numberOfInnerNodes);
            labelPaddingSpaces = this._intermediaries.labelPaddingSpaces =
                new Array<number>(tree.numberOfInnerNodes);

            layout = this.createLayout(tree, weightBuffer, config,
                accessorySpaces, labelRects, labelPaddingSpaces);

            this._geometry.innerNodeLayouts = undefined;
            this._geometry.leafNodeLayouts = undefined;
        }

        //
        // Base Geometry
        //

        if (this._geometry.innerNodeIndices === undefined) {
            this._geometry.innerNodeIndices = NodeIndices.innerNodes(tree);
        }

        if (this._geometry.leafNodeIndices === undefined) {
            this._geometry.leafNodeIndices = NodeIndices.leafNodes(tree);
        }

        if (this._geometry.innerNodeLayouts === undefined) {
            this._geometry.innerNodeLayouts = GeometryCreation.createParentLayoutBuffer(tree, layout,
                this._configuration.geometry);
        }

        if (this._geometry.leafNodeLayouts === undefined) {
            this._geometry.leafNodeLayouts = GeometryCreation.createLeafLayoutBuffer(tree, layout,
                this._configuration.geometry);
        }

        /** REFINED GEOMETRY CREATION BEGIN - @todo Refine above! */

        /* Area Scales */

        if (this._geometry.leafNodeAreaScales === undefined) {
            const areaScales = this._bufferResolver.resolve(this._configuration.geometry.leafLayer.areaScale!, config,
                this._normalization, this._bufferResolver.constBufferCallback(1.0))!;

            this._geometry.leafNodeAreaScales = GeometryCreation.createLeafAreaScalesBuffer(tree, areaScales);
        }

        /* Color Table */

        /* @todo the following code needs to be refined and moved... */

        const colorFromSpace = (
            value: tuples.GLclampf3 | tuples.GLclampf4 | tuples.GLclampf5 | string,
            space: Color.Space | string): Color => {

            switch (space) {

                case Color.Space.CMYK:
                    {
                        const v = (value as Array<number>).fill(1.0, value.length, 5);
                        return new Color().fromCMYK(v[0], v[1], v[2], v[3], v[4]);
                    }
                    break;

                case Color.Space.LAB:
                    {
                        const v = (value as Array<number>).fill(1.0, value.length, 4);
                        return new Color().fromLAB(v[0], v[1], v[2], v[3]);
                    }
                    break;

                case Color.Space.HSL:
                    {
                        const v = (value as Array<number>).fill(1.0, value.length, 4);
                        return new Color().fromHSL(v[0], v[1], v[2], v[3]);
                    }
                    break;

                case 'hex':
                    return new Color().fromHex(value as string);
                    break;

                default:
                case Color.Space.RGB:
                    {
                        const v = (value as Array<number>).fill(1.0, value.length, 4);
                        return new Color().fromRGB(v[0], v[1], v[2], v[3]);
                    }
                    break;
            }
        };


        const colorsFromSpace = (
            values: Array<tuples.GLclampf3 | tuples.GLclampf4 | tuples.GLclampf5 | string>,
            space: Color.Space | string): Array<Color> => {

            const colors = new Array<Color>(values.length);
            for (let i = 0; i < colors.length; ++i) {
                colors[i] = colorFromSpace(values[i], space);
            }
            return colors;
        };


        const resolve = (colors: Configuration.Colors | undefined,
            identifier: Configuration.ColorIdentifier | undefined,
            fallback: Color | Array<Color>): Color | Array<Color> => {

            if (colors === undefined || identifier === undefined) {
                return fallback;
            }

            const color = colors.find((i) => i.identifier === identifier.split(':')[1]);
            if (color === undefined) {
                return fallback;
            }

            if (Configuration.isColorArray(color)) {
                return color.value !== undefined ? colorFromSpace(color.value, color.colorspace)
                    : colorsFromSpace(color.values!, color.colorspace);
            } else if (Configuration.isColorPreset(color)) {
                const preset = ColorPresets.find((preset) => preset.identifier == color.preset);

                if (!preset) {
                    return fallback;
                }

                // 3 may be a wrong assumption for some color presets
                const colors = color.steps
                    ? (preset.colors.find((colors) => colors.length === color.steps! * 3) || preset.colors[0])
                    : preset.colors[0];

                const colorscale = ColorScale.fromArray(colors!, preset.format as ColorScale.ArrayType, colors!.length / 3, undefined);

                return colorscale.colors;
            } else {
                return fallback;
            }
        };

        if (config.altered.colors) {
            const emphasisColor = resolve(config.colors, config.geometry.emphasis ?
                config.geometry.emphasis.color : undefined, new Color());

            const auxiliaryColor = resolve(config.colors, config.geometry.auxiliary, new Color());

            const innerColor = resolve(config.colors, config.geometry.parentLayer.colorMap,
                [new Color(), new Color()]);

            const leafColor = resolve(config.colors, config.geometry.leafLayer!.colorMap,
                [new Color(), new Color()]);

            this._colorLUT = new ColorTable(emphasisColor as Color, auxiliaryColor as Array<Color>,
                innerColor as Array<Color>, leafColor as Array<Color>);

            if (!this._geometry.colorTable
                || this._geometry.colorTable.length !== this._colorLUT.bits.length) {
                this._geometry.altered.alter('colorTableLength');
                this._renderer.invalidate();
            }

            this._geometry.colorTable = this._colorLUT.bits;
        }

        /* Color Mapping */

        this.applyInnerNodeColorMapping(config);
        this.applyLeafNodeColorMapping(config);

        /** REFINED GEOMETRY CREATION END - @todo Refine below! */


        //
        // Heights
        //

        let heightScale = this._geometry.heightScale;
        if (heightScale === undefined || altered.geometry.heightScale) {
            const heightScaleConf = config.geometry.heightScale;
            if (heightScaleConf !== undefined &&
                heightScaleConf in ConfigurationAids.HeightScaleApproach) {
                heightScale = this._geometry.heightScale = ConfigurationAids.heightScale(tree,
                    heightScaleConf as ConfigurationAids.HeightScaleApproach);
            } else if (heightScaleConf !== undefined) {
                heightScale = this._geometry.heightScale = heightScaleConf as number;
            } else {
                heightScale = this._geometry.heightScale = ConfigurationAids.heightScale(tree,
                    ConfigurationAids.HeightScaleApproach.SomethingInverseSqrt);
            }
            this._geometry.altered.alter('heightScale');
        }

        if (config.altered.geometry.outlineWidth) {
            this._geometry.outlineWidth = config.geometry.outlineWidth;
            this._geometry.altered.alter('outlineWidth');
        }

        if (config.geometry.emphasis && config.altered.geometry.emphasis.outlineWidth) {
            this._geometry.emphasisOutlineWidth = config.geometry.emphasis!.outlineWidth;
            this._geometry.altered.alter('emphasisOutlineWidth');
        }

        this._geometry.showRoot = config.geometry.parentLayer.showRoot!;

        /** @todo refine and move this to height buffer creation, similar to color buffer creation  */
        let heights = undefined;
        if (config.geometry.leafLayer !== undefined) {
            if (altered.geometry.heights || altered.buffers || altered.bufferViews || heights === undefined) {

                const leafLayer = config.geometry.leafLayer;

                heights = this._bufferResolver.resolve(leafLayer.height !== undefined ?
                    leafLayer.height : '', config, this._normalization,
                    this._bufferResolver.constBufferCallback())!;

                this._intermediaries.aggregatedHeights = heights;

                const heightValues = GeometryCreation.createLayerHeightBuffer(tree, heights,
                    undefined, this._configuration.geometry);

                this._geometry.leafNodeHeights = heightValues;

                this._geometry.altered.alter('leafNodeHeights');
            }

        } else { // No leaf layer
            heights = undefined;

            this._geometry.leafNodeHeights = GeometryCreation.createEmptyLayerHeightBuffer(tree);
        }


        //
        // Label Creation
        //

        if ((this._intermediaries.leafLabels === undefined
            || this._intermediaries.innerNodeLabels === undefined || config.altered.labels)
            && config.labels !== undefined) {

            if (config.labels.names !== undefined) { // labeling by explicit names
                let names: Map<number, string> = new Map<number, string>();
                if (typeof config.labels.names === "string") {
                    const namesList = AttributeBuffer.create(tree, this._normalization, config.labels.names,
                        config) as any as Array<string>;

                    Object.keys(namesList).forEach((key: string) => {
                        const id = parseInt(key, 10);
                        names.set(id, namesList[id] as string);
                    });
                } else {
                    names = config.labels.names as Map<number, string>;
                }

                if (names !== undefined && this._intermediaries.aggregatedHeights &&
                    this._intermediaries.aggregatedWeights && this._intermediaries.aggregatedColors) {
                    const nodeIdsToLabel = LabelManagement.createLabelSelection(tree, this._intermediaries.aggregatedWeights,
                        this._intermediaries.aggregatedHeights, this._intermediaries.aggregatedColors, new Set<number>(),
                        config.labels.innerNodeLayerRange!, config.labels.numTopInnerNodes!,
                        config.labels.numTopWeightNodes!, config.labels.numTopHeightNodes!, config.labels.numTopColorNodes!)

                    this._intermediaries.leafLabels =
                        LabelManagement.fillLeafLabelArray(tree, names, nodeIdsToLabel,
                            this._geometry.heightScale!, this._geometry.leafNodeLayouts!,
                            this._geometry.leafNodeHeights!);

                    this._intermediaries.innerNodeLabels =
                        LabelManagement.fillInnerNodeLabelArrayOnAccessory(tree, names, nodeIdsToLabel,
                            this._intermediaries.accessorySpaces!);

                    this._labelsChanged = true;

                    this._renderer.invalidate();
                }
            }
        }

        /* Done - reset alteration tracking. */

        config.altered.reset();

        return true;
    }

    prepare(): void {
        this.updateLabels();
    }

    /** @todo comment! */
    get renderer(): AbstractRenderer {
        return this._renderer;
    }

    /** @todo comment! */
    get configuration(): Configuration | undefined {
        return this._configuration;
    }

    /** @todo comment! */
    set configuration(configuration: Configuration | undefined) {
        this._configuration = configuration;
    }
}
