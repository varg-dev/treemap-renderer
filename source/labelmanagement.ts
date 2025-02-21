
/* spellchecker: disable */

import { auxiliaries, Label, Position3DLabel, Projected3DLabel, Text } from 'webgl-operate';
const assert = auxiliaries.assert;
const log = auxiliaries.log;
const LogLevel = auxiliaries.LogLevel;

import { Configuration } from './configuration';
import { Node } from './node';
import { Rect } from './rect';
import { Topology } from './topology';

/* spellchecker: enable */

const FONT_SIZE_SCREEN = 20;

/** This enum describes on which side of the padding (of an inner node) the label should be placed.
 * see LabelManagement.createInnerNodeLabel()
 */
export enum LabelPaddingSide {
    Bottom,
    Top,
    Left,
    Right,
}

interface LabelCandidate {
    nodeId: number | undefined;
    value: number;
}

function updateTopNodes(topNodes: LabelCandidate[], value: number, nodeId: number): void {
    if (topNodes.length > 0 && topNodes[topNodes.length - 1].value < value) {
        topNodes[topNodes.length - 1] = { nodeId, value };
        topNodes.sort((a: LabelCandidate, b: LabelCandidate) => b.value - a.value);
    }
}

function addNodeIDsToCandidates(candidates: Set<number>, labelCandidates: Array<LabelCandidate>): void {
    labelCandidates.filter((candidate) => candidate.nodeId !== undefined && candidate.nodeId != Node.INVALID_INDEX).map((candidate) => {
        candidates.add(candidate.nodeId!);
    });
}

/**
 * Creates Labels, calculates initial positions, and every other algorithms regarding labeling in
 * treemap.
 */
export class LabelManagement {

    /**
     * Creates a webgl-operate label at the given 3D position. This label will be rendered at a fixed
     * size and direction, so that it appears to be in 2D space.
     * @param name - the string that will be depicted by the label
     * @param anchorPosition - a position in 3D space that is used as anchor position for label
     */
    protected static createLeafLabel(name: string, anchorPosition: [number, number, number])
        : Projected3DLabel {

        // this is soo hacky that we add white space in front and back! We do this instead of
        // calculating a horizontal padding in screen size, and instead of manually updating the label
        // position with every camera update. Follow this issue to see when we can replace this hack:
        // https://github.com/cginternals/webgl-operate/issues/177
        const label = new Projected3DLabel(new Text('  ' + name + '  '), Label.Type.Dynamic);

        label.color.fromF32(...LabelManagement.leafLabelColor);

        label.lineAnchor = Label.LineAnchor.Bottom;

        label.fontSize = FONT_SIZE_SCREEN * window.devicePixelRatio;

        assert(anchorPosition.length === 3,
            `Expected a 3D position for leaf label anchor, got ${anchorPosition}`);

        label.position = anchorPosition;

        return label;
    }

    /**
     * Creates a webgl-operate label on an inner node's padding. See LabelPaddingSide to decide on
     * which side of the node's rect the label is placed.
     * @param name - the string that will be depicted by the label
     * @param labelRect  - the rectangle of the inner node, including padding
     * @param labelHeight - the height of the label, e.g., the padding size
     * @returns a 3D label
     */
    protected static createInnerNodeLabel(name: string, labelRect: Rect, labelHeight: number):
        Position3DLabel {

        const label: Position3DLabel = new Position3DLabel(new Text(name), Label.Type.Static);

        label.color.fromF32(...LabelManagement.innerLabelColor);

        /** If alignment changes, adapt the calculations below! */
        label.alignment = Label.Alignment.Center;
        label.lineAnchor = Label.LineAnchor.Bottom;

        /** @todo input variable for label position on inner node: left, right, bottom, top.
         * For now, it is implemented as bottom.
         */
        const whichSide: LabelPaddingSide = LabelPaddingSide.Bottom;
        let x = 0.0;
        const y = 0.0;
        let z = 0.0;

        /** treemap: [0,1], labels: [-1,1], so we scale: values * 2 - 1
         * @todo get that scaling automatically from where this scaling is set --> maintainability!
         */

        /* because of the scaling from [0,1] to [-1,1], you will find several
         * (obvious or implicit) * 2 in the next code lines */
        label.fontSize = labelHeight * 2;
        label.elide = Label.Elide.Middle;

        /**
         * @todo remove the 'as LabelPaddingSide'; for now it is needed because whichSide is constant and
         * the compiler complains about `type 'LabelPaddingSide.bottom' is not comparable to type
         * 'LabelPaddingSide.top'`.
         */
        switch (whichSide as LabelPaddingSide) {
            case LabelPaddingSide.Bottom:
                x = labelRect.left + labelRect.right - 1;
                z = (labelRect.bottom - labelHeight) * 2 - 1;

                label.lineWidth = labelRect.width * 2;
                label.direction = [1.0, 0.0, 0.0];
                label.up = [0.0, 0.0, -1.0];
                break;
            case LabelPaddingSide.Top:
                x = labelRect.left + labelRect.right - 1;
                z = (labelRect.top + labelHeight) * 2 - 1;

                label.lineWidth = labelRect.width * 2;
                label.direction = [-1.0, 0.0, 0.0];
                label.up = [0.0, 0.0, 1.0];
                break;
            case LabelPaddingSide.Left:
                x = (labelRect.left - labelHeight) * 2 - 1;
                z = labelRect.top + labelRect.bottom - 1;

                label.lineWidth = labelRect.height * 2;
                label.direction = [0.0, 0.0, 1.0];
                label.up = [1.0, 0.0, 0.0];
                break;
            case LabelPaddingSide.Right:
                x = (labelRect.right + labelHeight) * 2 - 1;
                z = labelRect.top + labelRect.bottom - 1;

                label.lineWidth = labelRect.height * 2;
                label.direction = [0.0, 0.0, -1.0];
                label.up = [-1.0, 0.0, 0.0];
                break;
            default:
                label.fontSize = 0;
                log(LogLevel.Warning,
                    `${whichSide} is not a valid value of LabelPaddingSide, skip label '${name}'`);
        }

        label.position = [x, y, -z];
        return label;
    }

    /**
     * Creates a webgl-operate label on an inner node's accessory space.
     * @param name - the string that will be depicted by the label
     * @param accessorySpace - the space on which the label will beplaced.
     * @returns a 3D label
     */
    protected static createInnerNodeLabelOnAccessory(name: string, accessorySpace: Rect):
        Position3DLabel {

        const label: Position3DLabel = new Position3DLabel(new Text(name), Label.Type.Static);

        label.color.fromF32(...LabelManagement.innerLabelColor);

        /** If alignment changes, adapt the calculations below! */
        label.alignment = Label.Alignment.Center;
        label.lineAnchor = Label.LineAnchor.Bottom;

        /** treemap: [0,1], labels: [-1,1], so we scale: values * 2 - 1
         * @todo get that scaling automatically from where this scaling is set?
         */

        /* because of the scaling from [0,1] to [-1,1], you will find several
         * (obvious or implicit) * 2 in the next code lines */

        const x = accessorySpace.left + accessorySpace.right - 1;
        const y = 0.0;
        const z = accessorySpace.bottom * 2 - 1;

        label.fontSize = accessorySpace.height * 2;
        label.elide = Label.Elide.Middle;
        label.lineWidth = accessorySpace.width * 2;

        label.position = [x, y, -z];
        label.direction = [1.0, 0.0, 0.0];
        label.up = [0.0, 0.0, -1.0];
        return label;
    }

    /**
     *
     * @param tree - the treemap topology containing nodes
     * @param names - a map of node names (strings) by node ID
     * @param labelCandidates - ids of nodes that are label candidates
     * @param heightScale - the scale factor used for the leaf node heights
     * @param leafLayout - layout of leaf nodes
     * @param topHeightBuffer - buffer containing the heights of the leaf nodes
     */
    static fillLeafLabelArray(tree: Topology, names: Map<number, string>, labelCandidates: Set<number>,
        heightScale: number, leafLayout: Float32Array, topHeightBuffer: Uint8Array)
        : Projected3DLabel[] {

        const labels = new Array<Projected3DLabel>(tree.numberOfInnerNodes);

        labelCandidates.forEach((id: number) => {
            const node = tree.leafNodeById(id);

            const name = names.get(id);
            if (node === undefined || name === undefined || name.length === 0) {
                return;
            }

            /** Linearization of the array: all inner nodes, then all leaf nodes, so transform the
             * node.index used in [<allInnerNodes>, <allLeafNodes>] to be used in leafLayout, which only
             * contains the leaf nodes.
             */
            const transformedIndex = node.index - tree.numberOfInnerNodes;

            /** leaflayout is flat array, containing [posX, posY, width, length] of node area. */
            const layoutIndex = transformedIndex * 4;
            const posX = leafLayout[layoutIndex + 0];
            const posY = leafLayout[layoutIndex + 1];
            const width = leafLayout[layoutIndex + 2];
            const length = leafLayout[layoutIndex + 3];

            /** topHeightBuffer is flat array, containing the heights of two layers
             * [height1, height2]. The second one is the higher one.
             * @todo if someday we decide to support more layers, this code needs to be adapted to
             * choose the index of the highest one.
             */
            const heightIndex = transformedIndex * 2;
            const height = topHeightBuffer[heightIndex + 1];

            if (width > 0.0 && length > 0.0) {

                /* label position is top center of leaf node */
                const x = posX + width * 0.5;
                const y = height * heightScale / 255.0;
                const z = posY + length * 0.5;

                /** @todo labels is a sparse array.
                 * Contra: large array.
                 * Pro: index identifies label -> easier accessible when updating a subset of labels
                 */
                labels[node.index] = LabelManagement.createLeafLabel(name, [x, y, z]);
            }
        });

        return labels;
    }

    /**
     * Creates labels on inner nodes' accessory spaces for every label candidate.
     * @param tree - the treemap topology containing nodes
     * @param names - a map of node names (strings) by node ID
     * @param labelCandidates - ids of nodes that are label candidates
     * @param accessorySpaces - the spaces where the inner labels can be placed; by node.index
     * @returns an array of 3D labels
     */
    static fillInnerNodeLabelArrayOnAccessory(tree: Topology, names: Map<number, string>,
        labelCandidates: Set<number>, accessorySpaces: Rect[]): Position3DLabel[] {

        const labels = new Array<Position3DLabel>(tree.numberOfInnerNodes);

        labelCandidates.forEach((id: number) => {
            const node = tree.innerNodeById(id);

            if (node !== undefined && accessorySpaces[node.index] !== undefined
                && accessorySpaces[node.index].area > 0) {

                const name = names.get(id);

                if (name === undefined || name.length === 0) {
                    return;
                }

                /** @todo labels is a sparse array.
                 * Contra: large array.
                 * Pro: index identifies label --> easier accessible when updating a subset of labels?
                 */
                labels[node.index] = LabelManagement.createInnerNodeLabelOnAccessory(name,
                    accessorySpaces[node.index]);

            }
        });

        return labels;
    }

    /**
     * Creates labels on inner nodes' paddings for every label candidate.
     * @param tree - the treemap topology containing nodes
     * @param names - a map of node names (strings) by node ID
     * @param labelCandidates - ids of nodes that are label candidates
     * @param labelRects - the rectangle of the inner nodes, including padding; by node.index
     * @param labelPaddingSpaces - the padding spaces of the inner nodes; by node.index
     * @returns an array of 3D labels
     */
    static fillInnerNodeLabelArray(tree: Topology, names: Map<number, string>,
        labelCandidates: Set<number>, labelRects: Rect[], labelPaddingSpaces: number[])
        : Position3DLabel[] {

        const labels = new Array<Position3DLabel>(tree.numberOfInnerNodes);

        labelCandidates.forEach((id: number) => {
            const node = tree.innerNodeById(id);

            if (node !== undefined && labelRects[node.index] !== undefined) {
                const name = names.get(id);

                if (name === undefined || name.length === 0) {
                    return;
                }

                /** @todo labels is a sparse array.
                 * Contra: large array.
                 * Pro: index identifies label --> easier accessible when updating a subset of labels?
                 */

                if (!node.isLeaf && labelRects[node.index].area > 0) {
                    labels[node.index] = LabelManagement.createInnerNodeLabel(name,
                        labelRects[node.index], labelPaddingSpaces[node.index]);
                }
            }
        });

        return labels;
    }

    /**
     * Creates a selection of label candidates, taking the top nodes (by their weights, heights,
     * colors, ...) into account
     * @param tree - the treemap topology containing nodes
     * @param aggregatedWeights - aggregated weights by node index
     * @param aggregatedHeights - aggregated heights by node index
     * @param aggregatedColors - aggregated colors by node index
     * @param additionallyLabelSet - node IDs for nodes that should always be labeled (for inner nodes,
     *  only within depth range)
     * @param innerNodeLabelDepthRange - only nodes within depth range will be labeled
     * @param numTopInnerNodes - max number of inner nodes for labeling (sorted by aggregated weight)
     * @param numTopWeightNodes - max number of leaf nodes for labeling (sorted by aggregated weight)
     * @param numTopHeightNodes - max number of leaf nodes for labeling (sorted by aggregated height)
     * @param numTopColorNodes - max number of leaf nodes for labeling (sorted by aggregated color)
     * @returns label candidates
     */
    static createLabelSelection(tree: Topology, aggregatedWeights: Configuration.AttributeBuffer,
        aggregatedHeights: Configuration.AttributeBuffer,
        aggregatedColors: Configuration.AttributeBuffer,
        additionallyLabelSet: Set<number>,
        innerNodeLabelDepthRange: [number, number], numTopInnerNodes: number,
        numTopWeightNodes: number, numTopHeightNodes: number, numTopColorNodes: number): Set<number> {

        const candidates = new Set<number>();

        // gather top N values (with node ID) by visual variable
        const topInnerNodeWeights = new Array<LabelCandidate>(numTopInnerNodes);
        const topWeights = new Array<LabelCandidate>(numTopWeightNodes);
        const topHeights = new Array<LabelCandidate>(numTopHeightNodes);
        const topColors = new Array<LabelCandidate>(numTopColorNodes);
        const topAdditionalCandidates = new Array<LabelCandidate>(1);
        topInnerNodeWeights.fill({ nodeId: undefined, value: -1 });
        topWeights.fill({ nodeId: undefined, value: -1 });
        topHeights.fill({ nodeId: undefined, value: -1 });
        topColors.fill({ nodeId: undefined, value: -1 });
        topAdditionalCandidates.fill({ nodeId: undefined, value: -1 });

        // label inner nodes
        tree.parentsDoUntilDepth(innerNodeLabelDepthRange[1], (node: Node) => {
            if (node.depth < innerNodeLabelDepthRange[0]) {
                return;
            }

            updateTopNodes(topInnerNodeWeights, aggregatedWeights[node.index], node.id);
        });

        // label leaf nodes
        tree.forEachLeafNode((node: Node) => {
            /**
             * node.id can be undefined when there is only one node (therefore, no edges, see),
             * which then turns out to be Root and Leaf at the same time.
             */
            if (node.id === undefined) {
                return;
            }

            updateTopNodes(topWeights, aggregatedWeights[node.index], node.id);
            updateTopNodes(topHeights, aggregatedHeights[node.index], node.id);
            updateTopNodes(topColors, aggregatedColors[node.index], node.id);
        });

        addNodeIDsToCandidates(candidates, topInnerNodeWeights);
        addNodeIDsToCandidates(candidates, topWeights);
        addNodeIDsToCandidates(candidates, topHeights);
        addNodeIDsToCandidates(candidates, topColors);

        const set_iter = additionallyLabelSet.entries();
        for (const entry of set_iter) {
            candidates.add(entry[1]);
        }

        return candidates;
    }

    /**
     *
     * @param tree - the treemap topology containing nodes
     * @param names - a map of node names (strings) by node ID
     * @param heightScale - the scale factor used for the leaf node heights
     * @param leafLayout - layout of leaf nodes
     * @param topHeightBuffer - buffer containing the heights of the leaf nodes
     */
    static fillLeafLabelArrayByExplicitNames(tree: Topology, namesMap: Map<number, string>, heightScale: number,
        leafLayout: Float32Array, topHeightBuffer: Uint8Array): Projected3DLabel[] {

        const nodeIdsToLabel = new Set<number>();
        namesMap.forEach((value: string, key: number) => {
            nodeIdsToLabel.add(key);
        });

        return LabelManagement.fillLeafLabelArray(tree, namesMap, nodeIdsToLabel, heightScale,
            leafLayout, topHeightBuffer);
    }


    /**
     * Creates inner node labels on accessory spaces by names (instead of candidates).
     * @param tree - the treemap topology containing nodes
     * @param names - a map of node names (strings) by node ID
     * @param accessorySpaces - the spaces where the inner labels can be placed; by node.index
     * @returns an array of 3D labels
     */
    static fillInnerNodeLabelArrayOnAccessoryByExplicitNames(tree: Topology, namesMap: Map<number, string>,
        accessorySpaces: Rect[]): Position3DLabel[] {

        const nodeIdsToLabel = new Set<number>();
        namesMap.forEach((value: string, key: number) => {
            nodeIdsToLabel.add(key);
        });

        return LabelManagement.fillInnerNodeLabelArrayOnAccessory(tree, namesMap,
            nodeIdsToLabel, accessorySpaces!);
    }
}

export namespace LabelManagement {
    export const leafLabelColor: [number, number, number, number] = [0.0, 0.0, 0.0, 0.80];
    export const innerLabelColor: [number, number, number, number] = [0.0, 0.0, 0.0, 0.54];
}
