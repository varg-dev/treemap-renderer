
/* spellchecker: disable */

import { Geometry } from '../geometry';
import { Node } from '../node';
import { Topology } from '../topology';

/* spellchecker: enable */


export class NodeEmphases {

    /**
     * Creates an unsigned 8-bit integer buffer that, for every inner node, denotes the emphasis state
     * required for rendering. This state is specified per node, i.e., per quad or cuboid instance to
     * be drawn. Note that highlighting takes precedence over outlining, and outlining overrides
     * default color mapping.
     * @param topology - Tree-structure used to iterate over all inner nodes.
     * @param outlinedNodes - Set of node identifiers, referencing nodes for outlining.
     * @param highlightedNodes - Set of node identifiers, referencing all nodes for highlighting.
     */
    static innerNodes(topology: Topology,
        outlinedNodes: Set<number> | undefined,
        highlightedNodes: Set<number> | undefined): Uint8Array {

        const buffer = new Uint8Array(topology.numberOfInnerNodes);
        topology.forEachInnerNode((node: Node) => {
            if (highlightedNodes && highlightedNodes.has(node.id)) {
                buffer[node.index] = Geometry.Emphasis.Highlight;
            } else if (outlinedNodes && outlinedNodes.has(node.id)) {
                buffer[node.index] = Geometry.Emphasis.Outline;
            } else {
                buffer[node.index] = Geometry.Emphasis.None;
            }
        });
        return buffer;
    }

    /**
     * Creates an unsigned 8-bit integer buffer that, for every leaf node, denotes the emphasis state
     * required for rendering. This state is specified per node, i.e., per quad or cuboid instance to
     * be drawn. Note that highlighting takes precedence over outlining, and outlining overrides
     * default color mapping.
     * @param topology - Tree-structure used to iterate over all leaf nodes.
     * @param outlinedNodes - Set of node identifiers, referencing nodes for outlining.
     * @param highlightedNodes - Set of node identifiers, referencing nodes for highlighting.
     */
    static leafNodes(topology: Topology,
        outlinedNodes: Set<number> | undefined,
        highlightedNodes: Set<number> | undefined): Uint8Array {

        const buffer = new Uint8Array(topology.numberOfLeafNodes);
        topology.forEachLeafNode((node: Node) => {
            const index = node.index - topology.numberOfInnerNodes;
            if (highlightedNodes && highlightedNodes.has(node.id)) {
                buffer[index] = Geometry.Emphasis.Highlight;
            } else if (outlinedNodes && outlinedNodes.has(node.id)) {
                buffer[index] = Geometry.Emphasis.Outline;
            } else {
                buffer[index] = Geometry.Emphasis.None;
            }
        });
        return buffer;
    }

}
