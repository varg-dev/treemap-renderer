
/* spellchecker: disable */

import { Node } from './node';
import { Topology } from './topology';

/* spellchecker: enable */


export class NodeColors {

    /**
     * Creates an unsigned 8-bit integer buffer that, for every inner node, encodes the color index
     * used for color lookup during rendering. Since required colors are encoded within a single color
     * lookup table, every computed index will be offset by the given color lookup offset. Note that,
     * for now, the color mapping of inner nodes is limited to a simple color alteration based on the
     * inner node's depth and the given number of colors.
     * @param topology - Tree-structure used to iterate over all inner nodes.
     * @param colorLookupOffset - Offset applied to every color index computed.
     * @param colorCount - Number of colors, used to alter color indices based on a node's depth.
     */
    static innerNodes(topology: Topology,
        colorLookupOffset: number,
        colorCount: number): Uint8Array {

        const buffer = new Uint8Array(topology.numberOfInnerNodes);
        topology.forEachInnerNode((node: Node) => {
            buffer[node.index] = colorLookupOffset + (node.depth % colorCount);
        });
        return buffer;
    }


    /** @todo move color index stuff here ... */

}
