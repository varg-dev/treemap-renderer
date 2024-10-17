
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

        const rootWeight = weights[tree.root.index];

        tree.nodesDo((leaf: Node) => {
            const weight = weights[leaf.index];
            const edgeLength = Math.sqrt(weight / rootWeight);
            result[leaf.index] = new Rect(0.0, 0.0, edgeLength * aspectRatio, edgeLength);
        });

        const offsets = new Array<vec2>();
        offsets[tree.root.index] = [0.0, 0.0];

        tree.reverseParentsDo((parent: Node) => {
            let currentOffsetX = 0.0;
            let currentOffsetY = 0.0;

            let parentX = currentOffsetX;
            let parentY = currentOffsetY;

            let direction: CodeCityLayout.Direction = CodeCityLayout.Direction.Y;

            tree.childrenDo(parent, (current: Node) => {
                const rect = result[current.index] =
                    layoutCallbacks.siblingMarginAfterCallback(result[current.index],
                        result[parent.index], result[parent.index], current);

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

                offsets[current.index] = [currentOffsetX, currentOffsetY];

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

            const parentRect = layoutCallbacks.parentPaddingCallback(
                new Rect(0.0, 0.0, parentX, parentY), parent, tree, result, labelRects,
                labelPaddingSpaces);
            result[parent.index] = layoutCallbacks.accessoryPaddingCallback(
                parentRect, parent, tree, result, accessorySpace);
        });

        tree.nodesDo((parent: Node) => {
            const layout = result[parent.index];
            const offset = offsets[parent.index];

            layout.applyOffset(offset[0], offset[1]);

            // not required, as the preceding lines manipulate the object in the result array.
            // result[parent.index] = layout;

            tree.childrenDo(parent, (current: Node) => {

                const childOffset = offsets[current.index];
                childOffset[0] += offset[0];
                childOffset[1] += offset[1];

                // not required, as the preceding lines manipulate the object in the result array.
                // offsets[current.index] = childOffset;
            });
        });

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
