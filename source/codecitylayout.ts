
/* spellchecker: disable */

import { Configuration } from './configuration';
import { LayoutCallbacks } from './layout';
import { Node } from './node';
import { Rect } from './rect';
import { Topology } from './topology';

/* spellchecker: enable */


type vec2 = [number, number];


export class CodeCityLayout {
    static compute(tree: Topology, weights: Configuration.AttributeBuffer, aspectRatio: number,
        result: Array<Rect>, layoutCallbacks: LayoutCallbacks, accessorySpace: Array<Rect>,
        labelRects: Array<Rect>, labelPaddingSpaces: Array<number>): void {

        const localOffsets = new Array<vec2>();
        // Code City packs bottom-up in parent-local coordinates and converts to global layout
        // coordinates only after every subtree has a stable local extent.
        CodeCityLayout.computeLocalLayouts(
            tree, weights, aspectRatio, result, localOffsets, layoutCallbacks, accessorySpace,
            labelRects, labelPaddingSpaces);
        CodeCityLayout.globalizeLayouts(tree, result, localOffsets, accessorySpace, labelRects);
        CodeCityLayout.normalizeLayouts(tree, result, accessorySpace, labelRects);
    }

    private static computeLocalLayouts(tree: Topology, weights: Configuration.AttributeBuffer,
        aspectRatio: number, result: Array<Rect>, localOffsets: Array<vec2>,
        layoutCallbacks: LayoutCallbacks, accessorySpace: Array<Rect>, labelRects: Array<Rect>,
        labelPaddingSpaces: Array<number>): void {

        const rootWeight = weights[tree.root.index];
        tree.nodesDo((leaf: Node) => {
            const weight = weights[leaf.index];
            const edgeLength = Math.sqrt(weight / rootWeight);
            result[leaf.index] = new Rect(0.0, 0.0, edgeLength * aspectRatio, edgeLength);
        });

        localOffsets[tree.root.index] = [0.0, 0.0];

        tree.reverseParentsDo((parent: Node) => {
            let currentOffsetX = 0.0;
            let currentOffsetY = 0.0;

            let parentX = currentOffsetX;
            let parentY = currentOffsetY;

            let direction: CodeCityLayout.Direction = CodeCityLayout.Direction.Y;

            tree.childrenDo(parent, (current: Node) => {
                const rect = layoutCallbacks.siblingMarginBeforeCallback(
                    result[current.index], current, tree, result, labelRects, labelPaddingSpaces);

                switch (direction) {
                    case CodeCityLayout.Direction.X:
                        if (currentOffsetX + rect.width >= parentX) {
                            currentOffsetX = parentX;
                            currentOffsetY = 0.0;
                            direction = CodeCityLayout.Direction.Y;
                        }
                        break;

                    default:
                    case CodeCityLayout.Direction.Y:
                        if (currentOffsetY + rect.height >= parentY) {
                            currentOffsetX = 0.0;
                            currentOffsetY = parentY;
                            direction = CodeCityLayout.Direction.X;
                        }
                        break;
                }

                localOffsets[current.index] = [
                    currentOffsetX - rect.left,
                    currentOffsetY - rect.bottom,
                ];

                switch (direction) {
                    case CodeCityLayout.Direction.X:
                        currentOffsetX += rect.width;

                        parentX = Math.max(parentX, currentOffsetX);
                        parentY = Math.max(parentY, Math.max(currentOffsetY + rect.height,
                            rect.top));
                        break;

                    default:
                    case CodeCityLayout.Direction.Y:
                        currentOffsetY += rect.height;

                        parentX = Math.max(parentX, Math.max(currentOffsetX + rect.width,
                            rect.right));
                        parentY = Math.max(parentY, currentOffsetY);
                        break;
                }
            });

            const contentRect = new Rect(0.0, 0.0, parentX, parentY);
            const paddingLayout = layoutCallbacks.parentPaddingExpansionCallback!(
                contentRect, parent, tree, result, labelRects, labelPaddingSpaces);
            const accessoryLayout = layoutCallbacks.accessoryPaddingExpansionCallback!(
                paddingLayout, parent, tree, result, accessorySpace);

            result[parent.index] = accessoryLayout;
        });
    }

    private static globalizeLayouts(tree: Topology, result: Array<Rect>,
        localOffsets: Array<vec2>, accessorySpace: Array<Rect>, labelRects: Array<Rect>): void {

        const globalOffsets = new Array<vec2>();
        globalOffsets[tree.root.index] = [0.0, 0.0];
        tree.nodesDo((parent: Node) => {
            if (!parent.isRoot) {
                const parentOffset = globalOffsets[parent.parent];
                const localOffset = localOffsets[parent.index];
                globalOffsets[parent.index] = [
                    parentOffset[0] + localOffset[0],
                    parentOffset[1] + localOffset[1],
                ];
            }

            const offset = globalOffsets[parent.index];
            const layout = result[parent.index];
            layout.applyOffset(offset[0], offset[1]);

            if (accessorySpace[parent.index] !== undefined) {
                accessorySpace[parent.index].applyOffset(offset[0], offset[1]);
            }

            if (labelRects[parent.index] !== undefined) {
                labelRects[parent.index].applyOffset(offset[0], offset[1]);
            }
        });
    }

    private static normalizeLayouts(tree: Topology, result: Array<Rect>,
        accessorySpace: Array<Rect>, labelRects: Array<Rect>): void {
        const rootLayout = result[tree.root.index];
        const normalizedLayout = new Rect(0, 0, rootLayout.aspectRatio, 1);
        normalizedLayout.centerAround([0.5, 0.5]);

        // // Assertions
        // if (auxiliaries.assertions()) {
        //     tree.nodesDo((node: Node) => {
        //         const layout = result[node.index];

        //         assert(rootLayout.comprises(layout), `Layout should not exceed root layout`);

        //         if (!node.isRoot) {
        //             // assert(result[node.parent].comprises(layout),
        //             // `Layout should not exceed parent layout`);
        //         }
        //     });
        // }

        // Map root as last node as its layout is used for mapping
        tree.reverseNodesDo((node: Node) => {
            result[node.index] = result[node.index].map(rootLayout, normalizedLayout);

            if (accessorySpace[node.index] !== undefined) {
                accessorySpace[node.index] =
                    accessorySpace[node.index].map(rootLayout, normalizedLayout);
            }

            if (labelRects[node.index] !== undefined) {
                labelRects[node.index] = labelRects[node.index].map(rootLayout, normalizedLayout);
            }
        });

        // Assertions
        // // tslint:disable-next-line:
        // if (auxiliaries.assertions()) {
        //     tree.nodesDo((node: Node) => {
        //         assert(normalizedLayout.comprises(result[node.index]),
        //             `Layout should not exceed normalized layout`);
        //         assert(result[0].comprises(result[node.index]),
        //             `Layout should not exceed root layout`);

        //         if (!node.isRoot) {
        //             // assert(result[node.parent].comprises(result[node.index]),
        //             // `Layout should not exceed parent layout`);
        //         }
        //     });
        // }
    }

}


export namespace CodeCityLayout {
    /**
     * Internally used direction for code city layouting.
     */
    export enum Direction {
        X,
        Y,
    }
}
