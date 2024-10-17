
/* spellchecker: disable */

import { gl_matrix_extensions, vec4 } from 'webgl-operate';

import { Node } from '../node';
import { Topology } from '../topology';

/* spellchecker: enable */


export class NodeIndices {

    /**
     * Creates an unsigned 8-bit integer buffer that, for every inner node, denotes the topology index
     * (probably as a result from the linearization) for rendering.  It is intended for reverse mapping
     * and is relevant if, e.g., ID spaces of inner nodes and leaf nodes overlap or a single leaf node
     * is rendered multiple times.
     * @param topology - Tree-structure used to iterate over all inner nodes.
     */
    static innerNodes(topology: Topology): Uint8Array {
        const buffer = new Uint8Array(4 * topology.numberOfInnerNodes);

        topology.forEachInnerNode((node: Node) => {
            const index = node.index;

            const encodedIndex = vec4.create();
            gl_matrix_extensions.encode_uint32_to_rgba8(encodedIndex, node.index);

            buffer[4 * index + 0] = encodedIndex[0];
            buffer[4 * index + 1] = encodedIndex[1];
            buffer[4 * index + 2] = encodedIndex[2];
            buffer[4 * index + 3] = encodedIndex[3];
        });

        return buffer;
    }

    /**
     * Creates an unsigned 8-bit integer buffer that, for every leaf node, denotes the topology index
     * (probably as a result from the linearization) for rendering.  It is intended for reverse mapping
     * and is relevant if, e.g., ID spaces of inner nodes and leaf nodes overlap or a single leaf node
     * is rendered multiple times.
     * @param topology - Tree-structure used to iterate over all inner nodes.
     */
    static leafNodes(topology: Topology): Uint8Array {
        const buffer = new Uint8Array(4 * topology.numberOfLeafNodes);
        const offset = topology.numberOfInnerNodes;

        topology.forEachLeafNode((node: Node) => {
            const index = node.index - offset;

            const encodedIndex = vec4.create();
            gl_matrix_extensions.encode_uint32_to_rgba8(encodedIndex, node.index);

            buffer[4 * index + 0] = encodedIndex[0];
            buffer[4 * index + 1] = encodedIndex[1];
            buffer[4 * index + 2] = encodedIndex[2];
            buffer[4 * index + 3] = encodedIndex[3];
        });

        return buffer;
    }


}
