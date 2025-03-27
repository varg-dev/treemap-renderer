
/* spellchecker: disable */

import { ChangeLookup, Color, properties, tuples } from 'webgl-operate';

import { AttributeBuffer } from './attributebuffer';
import { ConfigurationAids } from './configurationaids';
import { Layout } from './layout';
import { Node } from './node';
import { NodeSort } from './nodesort';
import { Topology as TreeTopology } from './topology';

import TREEMAP_SCHEMA_JSON from './data/treemap.schema.json';
import BUFFER_REFERENCE_SCHEMA_JSON from './data/bufferreference.schema.json';
import COLOR_REFERENCE_SCHEMA_JSON from './data/colorreference.schema.json';
import COLOR_SCHEMA_SCHEMA_JSON from './data/colorscheme.schema.json';

/* spellchecker: enable */


/**
 * This structure is provides the full API for configuring all treemap relevant data. The treemap
 * visualization expects a configuration reference and will react on changes in a lazy fashion. A
 * configuration can be created (1) empty and setup manually, (2) using the named constructor for test
 * data, or (3) using the named constructor for binary data.
 *
 * Any configuration instance allows for alteration lookups for lazy processing. Only changes that
 * where detected and flagged as altered are guaranteed to be processed at run-time. `Update` can be
 * invoked in order to trigger a deep alteration detection. Furthermore, every instance must be fully
 * compliant to the JSONSchema specified in `treemap.schema.json`. Any violation will either invalidate
 * the configuration, or, in case one of the various setters are used, be ignored.
 */
export class Configuration {

    /**
     * Main configuration schema.
     */
    private static readonly TREEMAP_SCHEMA: any = TREEMAP_SCHEMA_JSON;

    /* cspell:disable-next-line */
    private static readonly BUFFER_REFERENCE_SCHEMA: any = BUFFER_REFERENCE_SCHEMA_JSON;

    /* cspell:disable-next-line */
    private static readonly COLOR_REFERENCE_SCHEMA: any = COLOR_REFERENCE_SCHEMA_JSON;

    /* cspell:disable-next-line */
    private static readonly COLOR_SCHEMA_SCHEMA: any = COLOR_SCHEMA_SCHEMA_JSON; // @todo remove this when new color config is done


    /**
     * Alterable auxiliary object for tracking changes on renderer input and lazy updates.
     */
    protected readonly _altered = Object.assign(new ChangeLookup(), {
        /* @todo - lots of todo's! - should be processed asap! - if not this will be contagious for the
         API design and especially its implementation - not using lazy, partial updates, etc... - also
         review all other settings, e.g., the buffer view transformations seem organized randomly ... */
        any: false,
        topology: false,

        /* @todo the following properties alteration trackers are currently not used. These should be
        used as soon as possible in order to make partial updates as fast as possible ... */
        buffers: false,
        bufferViews: false,

        colors: false,

        layout: {
            any: false,
            weight: false,
            sort: false,
            algorithm: false,
            siblingMargin: false,
            parentPadding: false,
            accessoryPadding: false,
            // parameters: false,
        },
        geometry: {
            any: false,

            aggregation: false,

            outlineWidth: false,
            emphasis: { any: false, outline: false, highlight: false, outlineWidth: false },

            areaScale: false,

            heights: false,

            heightScale: false,

            colors: false,
            /* @todo the following properties alteration trackers are currently not used. These should
            be used as soon as possible in order to make partial updates as fast as possible ... */
            parentLayer: false,
            leafLayer: false,
        },
        labels: false,
    });

    /** @see {@link topology} */
    protected _topology: Configuration.Topology;

    /** @see {@link layout} */
    protected _layout: Configuration.Layout;

    /** @see {@link buffers} */
    protected _buffers: Configuration.Buffers = [];

    /** @see {@link bufferViews} */
    protected _bufferViews: Configuration.BufferViews = [];

    /** @see {@link colors} */
    protected _colors: Configuration.Colors = [];

    /** @see {@link geometry} */
    protected _geometry: Configuration.Geometry;

    /** @see {@link labels} */
    protected _labels: Configuration.Labels;


    /**
     * Accessor for the altered object. The caller is responsible to reset the altered-status.
     */
    get altered(): ChangeLookup {
        return this._altered;
    }

    /**
     * Specifies the topology for a treemap, i.e., a tree. A tree is a specialization of hierarchy, an
     * arborescence: single-root, single-parent, and no connection between siblings. If the topology is
     * set, the alteration status changes and will be available to further processing. Please refer to
     * @see {@link Configuration.Topology} for encoding examples.
     */
    set topology(topology: Configuration.Topology) {
        const schema = Configuration.TREEMAP_SCHEMA.properties.topology;
        /* Skip validation on this interleaved or tupled array due to crazy performance impact. This
        seems to be an issue within the jsonschema package (not webgl-operate). */
        if (!properties.validate(topology, schema, [])) {
            return;
        }
        properties.complement(topology, schema);
        properties.compare(topology, this._topology, this._altered, 'topology');
        this._topology = topology;
    }

    get topology(): Configuration.Topology {
        return this._topology;
    }


    set buffers(buffers: Configuration.Buffers) {
        const schema = Configuration.TREEMAP_SCHEMA.properties.buffers;
        if (!properties.validate(buffers, schema, [])) {
            return;
        }
        properties.complement(buffers, schema);
        properties.compare(buffers, this._buffers, this._altered, 'buffers');
        this._buffers = buffers;
    }

    get buffers(): Configuration.Buffers {
        return this._buffers;
    }


    set bufferViews(bufferViews: Configuration.BufferViews) {
        const schema = Configuration.TREEMAP_SCHEMA.properties.bufferViews;
        if (!properties.validate(bufferViews, schema,
            [[Configuration.BUFFER_REFERENCE_SCHEMA, '/BufferReference']])) {
            return;
        }
        properties.complement(bufferViews, schema);
        properties.compare(bufferViews, this._bufferViews, this._altered, 'bufferViews');
        this._bufferViews = bufferViews;
    }

    get bufferViews(): Configuration.BufferViews {
        return this._bufferViews;
    }


    set colors(colors: Configuration.Colors) {
        const schema = Configuration.TREEMAP_SCHEMA.properties.colors;
        if (!properties.validate(colors, schema,
            [[Configuration.COLOR_REFERENCE_SCHEMA, '/ColorReference']])) {
            return;
        }
        properties.complement(colors, schema);
        properties.compare(colors, this._colors, this._altered, 'colors');
        this._colors = colors;
    }

    get colors(): Configuration.Colors {
        return this._colors;
    }


    set layout(layout: Configuration.Layout) {
        const schema = Configuration.TREEMAP_SCHEMA.properties.layout;
        if (!properties.validate(layout, schema,
            [[Configuration.BUFFER_REFERENCE_SCHEMA, '/BufferReference']])) {
            return;
        }
        properties.complement(layout, schema);
        properties.compare(layout, this._layout, this._altered, 'layout');
        this._layout = layout;
    }

    get layout(): Configuration.Layout {
        return this._layout;
    }


    set geometry(geometry: Configuration.Geometry) {
        const schema = Configuration.TREEMAP_SCHEMA.properties.geometry;
        if (!properties.validate(geometry, schema, [
            [Configuration.BUFFER_REFERENCE_SCHEMA, '/BufferReference'],
            [Configuration.COLOR_REFERENCE_SCHEMA, '/ColorReference'],
            [Configuration.COLOR_SCHEMA_SCHEMA, '/ColorScheme']])) {
            return;
        }
        properties.complement(geometry, schema);
        properties.compare(geometry, this._geometry, this._altered, 'geometry');
        this._geometry = geometry;
    }

    get geometry(): Configuration.Geometry {
        return this._geometry;
    }

    set labels(labels: Configuration.Labels) {
        const schema = Configuration.TREEMAP_SCHEMA.properties.labels;
        if (!properties.validate(labels, schema,
            [[Configuration.BUFFER_REFERENCE_SCHEMA, '/BufferReference']])) {
            return;
        }
        properties.complement(labels, schema);
        properties.compare(labels, this._labels, this._altered, 'labels');

        if ('names' in labels && typeof labels.names == "object" && !(labels.names instanceof Map)) {
            labels.names = new Map<number, string>(
                Object.entries(labels.names).map(
                    (entry) => [Number.parseFloat(entry[0]), entry[1] as string]
                )
            );
        }

        this._labels = labels;
    }

    get labels(): Configuration.Labels {
        return this._labels;
    }

    public labelsToJSON(): object {
        const labels = Object.assign({}, this._labels);

        if (labels.names && typeof labels.names !== "string") {
            (labels.names as object) = Object.fromEntries(this._labels.names as Map<number, string>);
        }

        // Needed ?
        // if (labels.additionallyLabelSet && typeof labels.additionallyLabelSet !== "string") {
        //     (labels.additionallyLabelSet as Array<number>) = Array.from((this._labels.additionallyLabelSet as Set<number>).values());
        // }

        return labels;
    }

    public toJSON(): object {
        return {
            'topology': this.topology,
            'buffers': this.buffers,
            'bufferViews': this.bufferViews,
            'colors': this.colors,
            'layout': this.layout,
            'geometry': this.geometry,
            'labels': this.labelsToJSON()
        };
    }

}

export namespace Configuration {

    /**
     * Node identifier intended to be an unsigned integer.
     */
    export type NodeIdentifier = number;

    /**
     * Buffer identifier intended to be unique...
     */
    export type BufferIdentifier = string;

    /**
     * Color identifier intended to be unique...
     */
    export type ColorIdentifier = string;

    /**
     * Basic tree-topology consisting of interleaved or tupled edges.
     * ```
     * tupled: [[0, 1], [1, 2], [1, 3], [1, 4], [0, 5]];
     * interleaved: [0, 1, 1, 2, 1, 3, 1, 4, 0, 5];
     * ```
     */
    export interface Topology {
        edges: Array<NodeIdentifier> | Array<[NodeIdentifier, NodeIdentifier]>;
        format?: TreeTopology.InputFormat | string;
        semantics?: TreeTopology.InputSemantics | string;
    }

    export type AttributeBuffer = Array<number> | Int8Array | Uint8Array | Int16Array | Uint16Array
        | Uint32Array | Int32Array | Float32Array | Float64Array;

    export interface LinearizationMapping {
        type: AttributeBuffer.LinearizationMapping | string;
        mapping: Array<number>;
    };

    export function isLinearizationMapping(object: any): object is LinearizationMapping {
        if (typeof object === "string" || object instanceof String || object in AttributeBuffer.Linearization) {
            return false;
        }

        return 'type' in object
            && object.type in AttributeBuffer.LinearizationMapping
            && 'mapping' in object;
    }

    export interface Buffer {
        identifier: string;
        type: AttributeBuffer.DataType | string;
        encoding?: AttributeBuffer.Encoding | string;
        data: string | AttributeBuffer;
        linearization?: AttributeBuffer.Linearization | string | LinearizationMapping;
    }

    export interface TransformationCallback {
        (value: number, node: Node, tree: TreeTopology): number;
    }

    export interface Transformation {
        type: string;
        operation?: string | TransformationCallback;
        value?: number;
        buffer?: BufferIdentifier;
        invalidValue?: number;
        min?: number;
        max?: number;
        range?: [number, number];
        parameter?: number;
        sourceRange?: [number, number];
        targetRange?: [number, number];
        neutralElement?: number;
    }

    export interface BufferView {
        identifier: string;
        source: string;
        transformations?: Array<Transformation>;
    }

    export type Buffers = Array<Buffer>;

    export type BufferViews = Array<BufferView>;

    export interface ColorArray {
        identifier: string;
        colorspace: Color.Space | string;
        value?: tuples.GLclampf3 | tuples.GLclampf4 | tuples.GLclampf5 | string;
        values?: Array<tuples.GLclampf3 | tuples.GLclampf4 | tuples.GLclampf5 | string>;
    }

    export interface ColorPreset {
        identifier: string;
        preset: string;
        steps?: number;
    }

    export type Colors = Array<ColorArray | ColorPreset>;

    export function isColorArray(object: any): object is ColorArray {
        if (typeof object !== "object") {
            return false;
        }

        return 'identifier' in object
            && 'colorspace' in object;
    }

    export function isColorPreset(object: any): object is ColorPreset {
        if (typeof object !== "object") {
            return false;
        }

        return 'identifier' in object
            && 'preset' in object;
    }

    export interface Layout {
        algorithm: Layout.LayoutAlgorithm | string;
        weight: BufferIdentifier;
        aspectRatio?: number;
        sort?: {
            key?: NodeSort.Key | BufferIdentifier;
            algorithm: NodeSort.Algorithm | string;
        };
        siblingMargin?: {
            type: Layout.SiblingMarginType | string;
            value: number | BufferIdentifier;
        };
        parentPadding?: {
            type: Layout.ParentPaddingType | string;
            value: number | BufferIdentifier | Array<number>;
        };
        /* @todo - this should named auxiliary instead of accessory (matches its use better). */
        accessoryPadding?: {
            type?: Layout.AccessoryPaddingType | string;
            direction?: Layout.AccessoryPaddingDirection | string;
            value: number | Array<number>;
            relativeAreaThreshold?: number | Array<number>;
            targetAspectRatio?: number;
        };
    }

    export interface Geometry {

        parentLayer: {
            colorMap?: ColorIdentifier,
            showRoot?: boolean;
        };

        leafLayer: {
            colorMap?: ColorIdentifier,
            areaScale?: BufferIdentifier;
            height?: BufferIdentifier;
            colors?: BufferIdentifier;
            colorsNormalized?: boolean;
        };

        /* @todo - should be removed soon, need more flexible visual variable mapping concept... */
        auxiliary?: ColorIdentifier;

        /* Enables to put an emphasis on specific inner nodes as well as leaf nodes. */
        emphasis?: {
            /* Nodes that are to be outlined (additional contour). */
            outline: Array<NodeIdentifier>, /* @todo support BufferIdentifier */
            /* Nodes for emphasis (overrides outlining and color mapping, complete fill). */
            highlight: Array<NodeIdentifier>, /* @todo support BufferIdentifier */
            /* Width of the outline in device-independent pixel. */
            color?: ColorIdentifier,
            /* Width of the outline in device-independent pixel. */
            outlineWidth?: number,
        };

        /* Factor applied to all cuboid heights (either number or approach). */
        heightScale?: ConfigurationAids.HeightScaleApproach | number;

        /* Width of the outline in native pixel. */
        outlineWidth?: number;

    }

    export interface Labels {
        names?: BufferIdentifier | Map<number, string>;
        innerNodeLayerRange?: [number, number];
        numTopInnerNodes?: number;
        numTopWeightNodes?: number;
        numTopHeightNodes?: number;
        numTopColorNodes?: number;
        additionallyLabelSet?: BufferIdentifier | Set<number>;
    }

}
