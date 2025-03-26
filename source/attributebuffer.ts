
/* spellchecker: disable */

import { auxiliaries } from 'webgl-operate';
const assert = auxiliaries.assert;
const log = auxiliaries.log;
const LogLevel = auxiliaries.LogLevel;

import { AttributeTransformations } from './attributetransformations';
import { Configuration } from './configuration';
import { Topology } from './topology';
import { Node } from "./node";

/* spellchecker: enable */


/* @todo - make this an actual class comprising some laze getter, i.e,. min, max, avg, etc.. */

export namespace AttributeBuffer {

    /**
     * Internal data type of buffers that are passed in the configuration.
     */
    export enum DataType {
        String = 'string', // Array<string>
        Numbers = 'numbers', // Array<number>
        Uint8 = 'uint8', // Uint8Array
        Int8 = 'int8', // Int8Array
        Uint16 = 'uint16', // Uint16Array
        Int16 = 'int16', // Int16Array
        Uint32 = 'uint32', // Uint32Array
        Int32 = 'int32', // Int32Array
        Float32 = 'float32', // Float32Array
        Float64 = 'float64', // Float64Array
    }

    /**
     * The encoding of buffers passed in the configuration.
     */
    export enum Encoding {
        /* A string that is base64-encoded. After decoding, the data type is specified as DataType. */
        // Base64 = 'base64',
        /* The data is directly encoded as array of DataType. */
        Native = 'native',
    }

    /**
     * The order of values within a buffer.
     */
    export enum Linearization {
        Topology = 'topology', // The same order as the originally passed topology through the edge list
        Identity = 'identity', // Encoded as tuples of identity (number) and value
        //                        (currently unsupported)
    }

    export enum LinearizationMapping {
        IdMapping = 'id-mapping',       // Provide an array that maps from ids (position in the array)
        //                                 to the index in the buffer
        IndexMapping = 'index-mapping', // Provide an array that maps from the topology index (position
        //                                 in the array) to the index in the buffer
    }

    export type Normalization = AttributeTransformations.Normalization;

    export function createNormalization(tree: Topology, config: Configuration):
        AttributeTransformations.Normalization {
        // return AttributeTransformations.normalization_backup(tree, config);
        return tree.edgeIndexToTopologyIndexMap;
    }

    /**
     * Create a value buffer from a named buffer configuration and an associated topology.
     * @param tree - The underlying topology for the buffer.
     * @param identifier - The name of the buffer (with ':'-separated type encoding).
     * @param configuration - The whole treemap configuration for target buffer and dependent buffer
     * lookup.
     * Currently supported types are 'buffer' and 'bufferView'.
     */
    export function create(
        tree: Topology, normalization: Array<number>, identifier: string, configuration: Configuration):
        Configuration.AttributeBuffer | undefined {

        // Extract buffer type
        const colonIndex = identifier.indexOf(':');

        if (colonIndex === undefined || colonIndex < 0) {
            // Buffer type not found
            log(LogLevel.Error, `Buffer type not recognized.`);
            return undefined;
        }

        // Distinguish between creation of source buffer (raw data) and buffer views (transformations)
        switch (identifier.substr(0, colonIndex)) {
            case 'buffer':
                return AttributeBuffer.createSourceBuffer(
                    normalization, identifier.substr(colonIndex + 1), configuration);
            case 'bufferView':
                return AttributeBuffer.createView(tree,
                    normalization, identifier.substr(colonIndex + 1), configuration);
            default:
                log(LogLevel.Error, `Buffer type not recognized.`);
                break;
        }

        return undefined;
    }

    /**
     * Retrieve domain (2-tuple of the buffer's minimum and maximum values) of given buffer.
     * @param buffer - Buffer to find the minimum and maximum values in.
     */
    export function range(buffer: Configuration.AttributeBuffer): [number, number] | undefined {
        if (buffer.length === 0) {
            return undefined;
        }
        return Array.prototype.reduce.apply(buffer, [(accum: [number, number], value: number) =>
            [Math.min(value, accum[0]), Math.max(value, accum[1])], [Infinity, -Infinity]]);
    }

    /**
     * Retrieve domain (2-tuple of the buffer's minimum and maximum values) of given buffer.
     * @param buffer - Buffer to find the minimum and maximum values in.
     * @param tree
     */
    export function leafRange(buffer: Configuration.AttributeBuffer, tree: Topology): [number, number] | undefined {
        if (buffer.length === 0) {
            return undefined;
        }

        let accum: [number, number] = [Infinity, -Infinity];
        tree.forEachLeafNode((node : Node) => {
            const value = buffer[node.index];
            accum = [Math.min(value, accum[0]), Math.max(value, accum[1])];
        });
        return accum;
    }


    /**
     * Create a value buffer from a named buffer configuration and an associated topology.
     *
     * @param tree - The underlying topology for the buffer
     * @param identifier - The name of the source buffer (not type encoded)
     * @param configuration - The whole treemap configuration for target buffer lookup
     */
    export function createSourceBuffer(
        normalization: Array<number>, identifier: string, configuration: Configuration):
        Configuration.AttributeBuffer | undefined {

        // Select buffer configuration
        const bufferConfig = configuration.buffers.find((buffer: Configuration.Buffer) => {
            return buffer.identifier === identifier;
        });

        /* Only supported encoding is currently native, so this is basically a check if a valid
        configuration is found. */
        if (!bufferConfig || bufferConfig.encoding !== AttributeBuffer.Encoding.Native) {
            return undefined;
        }

        assert(bufferConfig.linearization !== AttributeBuffer.Linearization.Identity,
            `Expect linearization to be of type topology or mapping. Identity is currently unsupported`);

        // Use additionally provided id-mapping or index-mapping to map from foreign topology
        if (Configuration.isLinearizationMapping(bufferConfig.linearization)) {
            return AttributeTransformations.renormalize_using_intermediate_linearization(
                bufferConfig.data as Configuration.AttributeBuffer,
                bufferConfig.linearization as Configuration.LinearizationMapping, normalization);
        }

        // Besides Identity Linearization, only topology is currently supported
        assert(bufferConfig.linearization === AttributeBuffer.Linearization.Topology,
            `Expect linearization to be of type topology or identity.`);

        // Reorder value buffer to represent breadth-first leaf-bucket order of values
        return AttributeTransformations.renormalize(
            bufferConfig.data as Configuration.AttributeBuffer, normalization);
    }

    /**
     * Create a buffer view from a named buffer view configuration and an associated topology.
     * @param tree - The underlying topology for the buffer.
     * @param identifier - The name of the buffer view (not type encoded).
     * @param configuration - The whole treemap configuration for target buffer and dependent buffer
     * lookup.
     */
    export function createView(
        tree: Topology, normalization: Array<number>, identifier: string, configuration: Configuration):
        Configuration.AttributeBuffer | undefined {

        // Select buffer view configuration
        const viewConfig = configuration.bufferViews.find(
            (bufferView: Configuration.BufferView) => bufferView.identifier === identifier);

        // Validation check
        if (viewConfig === undefined) {
            return undefined;
        }

        // Create underlying buffer (may be either source buffer or buffer view)
        const source = AttributeBuffer.create(tree, normalization, viewConfig.source, configuration);

        // Validation check
        if (source === undefined) {
            return undefined;
        }

        // Check for transformations
        if (viewConfig.transformations === undefined || viewConfig.transformations.length === 0) {
            return source;
        }

        // Apply transformations
        return AttributeTransformations.applyTransformations(tree, normalization, source,
            viewConfig.transformations, configuration);
    }

}
