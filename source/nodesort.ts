
/* spellchecker: disable */

import { AttributeBuffer } from './attributebuffer';
import { Configuration } from './configuration';
import { Node } from './node';
import { Topology } from './topology';

/* spellchecker: enable */


export class NodeSort {


    private static readonly ASCENDING_COMPARATOR: NodeSort.Comparator =
        (a: [Node, number], b: [Node, number]) => a[1] - b[1]

    private static readonly DESCENDING_COMPARATOR: NodeSort.Comparator =
        (a: [Node, number], b: [Node, number]) => b[1] - a[1]


    private static byValue(parent: Node, children: Array<[Node, number]>,
        comparator: NodeSort.Comparator): void {

        // Empty or one-element arrays are trivially sorted.
        if (children.length < 2) {
            return;
        }

        // Sort intermediate buffer.
        children.sort(comparator);

        // Apply sort-order to actual nodes.
        for (let i = 0; i < children.length - 1; ++i) {
            children[i][0].nextSibling = children[i + 1][0].index;
        }
        // Fix last-node reference.
        children[children.length - 1][0].nextSibling = Node.INVALID_INDEX;
        // Fix first child of parent reference
        parent.firstChild = children[0][0].index;
    }

    private static byValues(tree: Topology, parent: Node, values: Configuration.AttributeBuffer,
        comparator: NodeSort.Comparator): void {
        const nodes = new Array<[Node, number]>();

        let current: Node = tree.node(parent.firstChild)!;
        do {
            nodes.push([current, values[current.index] as number]);
            current = tree.node(current.nextSibling)!;
        } while (current !== undefined);

        NodeSort.byValue(parent, nodes, comparator);
    }

    private static byIdentifier(tree: Topology, parent: Node, comparator: NodeSort.Comparator): void {
        const nodes = new Array<[Node, number]>();

        let current: Node = tree.node(parent.firstChild)!;
        while (current !== undefined) {
            nodes.push([current, current.id]);
            current = tree.node(current.nextSibling)!;
        }
        NodeSort.byValue(parent, nodes, comparator);
    }

    private static restoreOriginalSortOrder(tree: Topology, parent: Node): void {
        parent.firstChild = parent.initialFirstChild;
        for (let current = tree.node(parent.initialFirstChild);
            current !== undefined; current = tree.node(current.initialNextSibling)) {
            current.nextSibling = current.initialNextSibling;
        }
    }


    static sortNodes(tree: Topology, normalization: AttributeBuffer.Normalization,
        buffer: undefined | Configuration.AttributeBuffer, config: Configuration): boolean {

        const sort = config.layout.sort;
        if (sort === undefined || sort.algorithm === NodeSort.Algorithm.Keep) {
            tree.forEachInnerNode((parent: Node) => NodeSort.restoreOriginalSortOrder(tree, parent));
            return true;
        }

        let comparator: NodeSort.Comparator;
        switch (sort.algorithm) {
            case NodeSort.Algorithm.Ascending:
                comparator = NodeSort.ASCENDING_COMPARATOR;
                break;
            case NodeSort.Algorithm.Descending:
            default:
                comparator = NodeSort.DESCENDING_COMPARATOR;
                break;
        }

        switch (sort.key) {
            case NodeSort.Key.Weight:
                const values = AttributeBuffer.create(tree, normalization, config.layout.weight, config);

                if (values) {
                    tree.forEachInnerNode((parent: Node) => NodeSort.byValues(tree, parent,
                        values, comparator));
                }

                break;
            case NodeSort.Key.Identity:
                tree.forEachInnerNode((parent: Node) => NodeSort.byIdentifier(tree, parent,
                    comparator));
                break;
            default:
                if (buffer !== undefined) {
                    tree.forEachInnerNode((parent: Node) => NodeSort.byValues(tree, parent,
                        buffer, comparator));
                }
        }
        return true;
    }

}

export namespace NodeSort {

    export enum Algorithm {
        Keep = 'keep',
        Ascending = 'ascending',
        Descending = 'descending',
    }

    export enum Key {
        Identity = 'identity',
        Weight = 'weight',
    }

    export interface Comparator {
        (a: [Node, number], b: [Node, number]): number;
    }

}
