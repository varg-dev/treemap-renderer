
/* spellchecker: disable */

import { Configuration } from './configuration';
import { DirectionalRow } from './directionalrow';
import { LayoutCallbacks } from './layout';
import { Node } from './node';
import { Rect } from './rect';
import { Topology } from './topology';

/* spellchecker: enable */


export class SnakeLayout {
    static compute(tree: Topology, weights: Configuration.AttributeBuffer, aspectRatio: number,
        result: Array<Rect>, layoutCallbacks: LayoutCallbacks, accessorySpace: Array<Rect>,
        labelRects: Array<Rect>, labelPaddingSpaces: Array<number>): void {

        result[tree.root.index] = new Rect(0, 0, aspectRatio, 1);
        result[tree.root.index].centerAround([0.5, 0.5]);

        tree.forEachInnerNode((parent: Node) => {
            // Resize parent space for children
            let layoutRect = layoutCallbacks.accessoryPaddingCallback(
                result[parent.index], parent, tree, result, accessorySpace);
            layoutRect = layoutCallbacks.parentPaddingCallback(
                layoutRect, parent, tree, result, labelRects, labelPaddingSpaces);
            const intermediateRect = layoutCallbacks.siblingMarginBeforeCallback(
                layoutRect, parent, tree, result, labelRects, labelPaddingSpaces);

            const parentReversed = intermediateRect.isReversed;
            const reverse = parentReversed;

            const currentRow = new DirectionalRow(tree, weights, intermediateRect,
                weights[parent.index], intermediateRect.isVertical, reverse, parentReversed);

            tree.childrenDo(parent, (current: Node) => {
                const weight = weights[current.index];

                if (currentRow.increasesAverageAspectRatio(weight)) {
                    currentRow.layoutNodes(result);
                    currentRow.next(intermediateRect.isVertical);
                }

                currentRow.insert(current, weight);
            });

            currentRow.layoutNodes(result);

            tree.childrenDo(parent, (sibling: Node) => {
                result[sibling.index] = layoutCallbacks.siblingMarginAfterCallback(
                    result[sibling.index], intermediateRect, layoutRect, sibling);
            });
        });
    }
}
