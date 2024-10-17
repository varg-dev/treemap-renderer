
/* spellchecker: disable */

import { Node } from './node';
import { Rect } from './rect';
import { Topology } from './topology';

import { Configuration } from './configuration';

/* spellchecker: enable */


interface GetColorIndex { (colorValue: number): number; }


export class GeometryCreation {

    static getColorIndex(colorValue: number, colorCount: number, range: [number, number]): number {
        const epsilon = 0.0001; // for including the upper boundary in the range
        const value = (colorValue - range[0]) / (range[1] - range[0]);
        const index = Math.min(colorCount - 1, Math.floor(Math.max(0, colorCount * value - epsilon)));

        return index;
    }

    static getColorIndexInverted(
        colorValue: number, colorCount: number, range: [number, number]): number {

        return colorCount - 1 - this.getColorIndex(colorValue, colorCount, range);
    }

    static getColorIndexComputation(colorCount: number, range: [number, number]): GetColorIndex {
        return (colorValue: number) => this.getColorIndex(colorValue, colorCount, range);
    }

    static insertLayoutIntoBuffer(buffer: Float32Array, index: number, rect: Rect): void {
        const bufferIndex = 4 * index;

        buffer[bufferIndex + 0] = -1.0 + 2.0 * rect.left;
        buffer[bufferIndex + 1] = 1.0 - 2.0 * rect.bottom - 2.0 * rect.height;
        buffer[bufferIndex + 2] = 2.0 * rect.width;
        buffer[bufferIndex + 3] = 2.0 * rect.height;
    }

    static createLeafLayoutBuffer(
        tree: Topology, layout: Array<Rect>, configuration: Configuration.Geometry): Float32Array {

        const buffer = new Float32Array(4 * tree.numberOfLeafNodes);
        const numberOfParents = tree.numberOfInnerNodes;

        tree.forEachLeafNode((leaf: Node) => {
            const leafIndex = leaf.index - numberOfParents;
            const rect = layout[leaf.index];

            GeometryCreation.insertLayoutIntoBuffer(buffer, leafIndex, rect);
        });

        return buffer;
    }

    static createLayerHeightBuffer(
        tree: Topology, heights: Configuration.AttributeBuffer,
        previousHeightBuffer: Uint8Array | undefined,
        configuration: Configuration.Geometry): Uint8Array {

        const buffer = new Uint8Array(2 * tree.numberOfLeafNodes);
        const numberOfParents = tree.numberOfInnerNodes;

        let assertionError = false;
        tree.forEachLeafNode((leaf: Node) => {
            const leafIndex = leaf.index - numberOfParents;

            const bottom = previousHeightBuffer !== undefined ?
                Math.max(previousHeightBuffer[2 * leafIndex + 1], 0.0) : 0.0;

            const height = Math.max(heights[leaf.index], 0.0);


            let top = bottom + height * 255;

            // 8-bit is too imprecise for small deltas (they get lost) -> use Math.ceil as workaround
            // (prevents clamping down when assigning to Uint8Array)
            if (bottom > 0 && height > 0) {
                top = Math.ceil(top);
            }

            // do a 'soft assert' because this already broke the map in production (black canvas)
            if (top > 255.0) {
                assertionError = true;
                top = 255.0;
            }

            buffer[2 * leafIndex + 0] = bottom;
            buffer[2 * leafIndex + 1] = top;
        });

        if (assertionError) {
            console.error(`Height value overflow`);
        }

        return buffer;
    }

    static createEmptyLayerHeightBuffer(tree: Topology): Uint8Array {
        const buffer = new Uint8Array(2 * tree.numberOfLeafNodes);
        return buffer;
    }

    static createLeafAreaScalesBuffer(topology: Topology,
        scaleValues: Configuration.AttributeBuffer): Uint8Array {

        const buffer = new Uint8Array(topology.numberOfLeafNodes);
        const numberOfParents = topology.numberOfInnerNodes;

        topology.forEachLeafNode((leaf: Node) => {
            const leafIndex = leaf.index - numberOfParents;
            const value = Math.min(scaleValues[leaf.index] * 255.0, 255.0);

            buffer[leafIndex] = value;
        });

        return buffer;
    }

    static createDefaultLeafAreaScalesBuffer(tree: Topology, value: number = 1.0): Uint8Array {
        const buffer = new Uint8Array(tree.numberOfLeafNodes);
        buffer.fill(value * 255);
        return buffer;
    }


    static createParentLayoutBuffer(
        tree: Topology, layout: Array<Rect>, configuration: Configuration.Geometry): Float32Array {

        const buffer = new Float32Array(4 * tree.numberOfInnerNodes);

        tree.forEachInnerNode((parent: Node) => {
            const parentIndex = parent.index;
            const rect = layout[parent.index];

            GeometryCreation.insertLayoutIntoBuffer(buffer, parentIndex, rect);
        });

        return buffer;
    }


    /**
     * Creates an 8-bit uint buffer that, for every leaf node, encodes the default color index.
     * @param topology - Tree-structure used to iterate over all inner nodes.
     * @param colorIndex - Default color index used to fill the buffer with.
     */
    static defaultLeafNodeColors(topology: Topology, colorIndex: number): Uint8Array {
        const buffer = new Uint8Array(topology.numberOfLeafNodes);
        buffer.fill(colorIndex);
        return buffer;
    }


    static createLeafNodeColors(topology: Topology, colorValues: Configuration.AttributeBuffer,
        colorTableOffset: number, colorCount: number, range: [number, number]): Uint8Array {

        const buffer = new Uint8Array(topology.numberOfLeafNodes);
        const numberOfParents = topology.numberOfInnerNodes;

        const getColorIndex = this.getColorIndexComputation(colorCount, range);

        topology.forEachLeafNode((leaf: Node) => {
            const leafIndex = leaf.index - numberOfParents;
            const colorValue = colorValues[leaf.index];

            buffer[leafIndex] = (colorTableOffset + getColorIndex(colorValue)) + 32.0;
        });

        return buffer;
    }


    static createLeafNodeHeights(/* ... */): Uint8Array {
        /** @todo move and refine createLayerHeightBuffer code here ... */
        return new Uint8Array(0);
    }

    static createLeafNodeAreaScales(/* ... */): Uint8Array {
        /** @todo move and refine createLayerAreaScalesBuffer code here ... */
        return new Uint8Array(0);
    }

}
