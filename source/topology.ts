
/* spellchecker: disable */

import { auxiliaries } from 'webgl-operate';
const assert = auxiliaries.assert;

import { Linearization, RangeCallback } from './linearization';
import { Node } from './node';

/* spellchecker: enable */


export class Topology {

    /**
     * The currently used linearization, containing all depth slices.
     */
    private _linearization: Linearization = new Linearization();

    /**
     * The vector of nodes that are currently part of the tree.
     */
    private _nodes: Array<Node> = new Array<Node>();

    /**
     * The map of inner node IDs to node indices for reverse lookup. Please note that inner nodes and
     * leaf nodes might have overlapping ID ranges, thus, the reverse lookup must be split.
     */
    private _innerNodeIndicesById = new Map<number, number>();

    /**
     * The map of leaf node IDs to node indices for reverse lookup. Please note that inner nodes and
     * leaf nodes might have overlapping ID ranges, thus, the reverse lookup must be split.
     */
    private _leafNodeIndicesById = new Map<number, number>();

    /**
     * A map from initial edge list indices to their renormalized node indices
     * (by depth-first-leaf-separate approach).
     */
    private _edgeIndexToTopologyIndexMap = new Array<number>();

    /**
     * A map from renormalized node indices (by depth-first-leaf-separate approach) to their initial
     * edge list indices.
     */
    private _topologyIndexToEdgeIndexMap = new Array<number>();


    private fromInterleavedEdgesIdById(edges: Array<number>): void {
        assert(edges.length % 2 === 0,
            `expected length of interleaved edges list to be a multiple of 2`);

        const nodes = new Array<Node>();

        const innerNodesById = new Map<number, Node>();
        const nodesByDepth = new Array<Array<Node>>();

        /* Create root node. */

        nodes.push(new Node(edges[0], 0));

        innerNodesById.set(nodes[0].id, nodes[0]);
        nodesByDepth.push(new Array<Node>());
        nodesByDepth[0].push(nodes[0]);

        /* Process interleaved edges. */

        let parent: Node = nodes[0];

        for (let i = 0; i < edges.length; i += 2) {
            const edge0: [number, number] = [edges[i + 0], edges[i + 1]];
            const edge1: [number, number] = i + 2 < edges.length ? /* lookahead. */
                [edges[i + 2], edges[i + 3]] : [Node.INVALID_ID, Node.INVALID_ID];

            if (parent.lastChild !== Node.INVALID_INDEX) {
                const sibling = nodes[parent.lastChild];

                assert(sibling.nextSibling === Node.INVALID_INDEX,
                    `expected next sibling to be unset for last child of a node`);

                sibling.initialNextSibling = nodes.length;
                sibling.nextSibling = nodes.length;
            }

            /* Create new node. Please note that the node appends itself to the parent. */
            const node = new Node(edge0[1], nodes.length, parent);

            nodes.push(node);

            while (nodesByDepth.length <= node.depth) { // one element missing
                nodesByDepth.push(new Array<Node>());
            }
            nodesByDepth[node.depth].push(node);

            /* Crucial: the following assumes that the interleaved edges array always declares the
            children of a parent immediately after that parent was first mentioned as a child itself.
            As a consequence, if a node id of a parent is referenced as a child somewhere else another
            (probably leaf) node is created ... */

            // TODO: separate topology creation in implicit inner nodes and explicit inner nodes

            /** TEST */
            innerNodesById.set(node.id, node);
            /** TEST END */

            // Test for last edge to omit next parent detection
            if (edge1[0] === Node.INVALID_ID && edge1[1] === Node.INVALID_ID) {
                continue;
            }

            if (edge1[0] === edge0[1]) {

                /* If the subsequent edge has the current child node as parent, mark and use this node
                as parent node. */

                /*
                assert(innerNodesById.has(node.id) === false, `expected unique ids for inner nodes, ` +
                    `given ${edge0[1]} of ${edge0[0]} (next parent of ${edge1[1]})`);
                */

                // innerNodesById.set(node.id, node);
                parent = node;

            } else if (edge1[0] !== edge0[0]) {
                /* && edge1[0] !== edge0[1] | given by previous if */

                /* If the subsequent edge has a parent that is neither this edges child node nor this
                edges parent node, gather the parent for next iterations node creation ahead. */

                assert(innerNodesById.has(edge1[0]), `expected next parent to be already created, ` +
                    `given ${edge1[0]}`);

                parent = innerNodesById.get(edge1[0])!;
            }
        }

        this.fromNodes(nodes, nodesByDepth);
    }


    private fromInterleavedEdgesIndexById(edges: Array<number>): void {
        assert(edges.length % 2 === 0,
            `expected length of interleaved edges list to be a multiple of 2`);

        const nodes = new Array<Node>();
        const nodesByDepth = new Array<Array<Node>>();

        let i = 0;

        /* Create root node. */

        nodes.push(new Node(0, 0));
        nodesByDepth.push(new Array<Node>());
        nodesByDepth[0].push(nodes[0]);

        if (edges[0] === -1) { // skip root node from edges
            i += 2;
        }

        /* Process interleaved edges. */

        for (; i < edges.length; i += 2) {
            const edge: [number, number] = [edges[i + 0], edges[i + 1]];

            let parent: Node | undefined = undefined;
            if (edge[0] < nodes.length && edges[0] === -1) { // fix root issue (until datasets are fixed)
                // TODO: remove this hack
                parent = nodes[edge[0]];
            } else {
                assert(edge[0] < nodes.length, `expected parent to be processed before child`);

                parent = nodes[edge[0] < 0 ? 0 : edge[0] + 1];
            }


            if (parent.lastChild !== Node.INVALID_INDEX) {
                const sibling = nodes[parent.lastChild];

                assert(sibling.nextSibling === Node.INVALID_INDEX,
                    `expected next sibling to be unset for last child of a node`);

                sibling.initialNextSibling = nodes.length;
                sibling.nextSibling = nodes.length;
            }

            /* Create new node. Please note that the node appends itself to the parent. */
            const node = new Node(edge[1], nodes.length, parent);

            nodes.push(node);

            if (nodesByDepth.length === node.depth) { // one element missing
                nodesByDepth.push(new Array<Node>());
            }
            nodesByDepth[node.depth].push(node);
        }

        this.fromNodes(nodes, nodesByDepth);
    }


    private fromNodes(newNodes: Array<Node>, nodesByDepth: Array<Array<Node>>): void {
        this._linearization.clear();

        this._innerNodeIndicesById.clear();
        this._leafNodeIndicesById.clear();
        this._edgeIndexToTopologyIndexMap.length = newNodes.length;
        this._topologyIndexToEdgeIndexMap.length = newNodes.length;
        this._edgeIndexToTopologyIndexMap.fill(-1);
        this._topologyIndexToEdgeIndexMap.fill(-1);

        const leafNodes = new Array<Node>();
        const filteredNodesByDepth = new Array<Array<Node>>();

        for (const depthSlice of nodesByDepth) {
            const filteredNodes = depthSlice.filter((value: Node) => value.isLeaf);
            for (const node of filteredNodes) {
                leafNodes.push(node);
            }
            const filteredSlice = depthSlice.filter((value: Node) => !value.isLeaf);
            if (filteredSlice.length > 0) {
                filteredNodesByDepth.push(filteredSlice);
            }
        }

        filteredNodesByDepth.push(leafNodes);

        for (const depthSlice of filteredNodesByDepth) {
            this._linearization.addSliceByLength(depthSlice.length);
        }

        const newIndices = new Map<number, number>();
        this._nodes.length = newNodes.length;

        newIndices.set(-1, -1);

        let index = 0;
        for (const nodes of filteredNodesByDepth) {
            for (const node of nodes) {
                this._nodes[index] = node;
                (node.isLeaf ? this._leafNodeIndicesById : this._innerNodeIndicesById)
                    .set(node.id, index);

                newIndices.set(node.index, index);
                this._edgeIndexToTopologyIndexMap[node.index] = index;
                this._topologyIndexToEdgeIndexMap[index] = node.index;
                ++index;
            }
        }

        // Fix indices
        for (const node of this._nodes) {
            node.index = newIndices.get(node.index) as number;
            node.parent = newIndices.get(node.parent) as number;
            node.initialNextSibling = newIndices.get(node.initialNextSibling) as number;
            node.initialFirstChild = newIndices.get(node.initialFirstChild) as number;
            node.nextSibling = node.initialNextSibling;
            node.firstChild = node.initialFirstChild;
        }
    }

    /**
     * Iterate over all nodes in a depth slice (the leaves are placed in the last depth slice) and call
     * the callback on each node.
     * @param index - The index of the depth slice.
     * @param callback - The callback.
     */
    public sliceDo(index: number, callback: Topology.NodeCallback): void {
        const innerCallback = (start: number, end: number) => {
            for (let i = start; i <= end; ++i) {
                callback(this._nodes[i]);
            }
        };

        this.sliceRangeDo(index, innerCallback);
    }

    /**
     * Iterate over all nodes in a depth slice (the leaves are placed in the last depth slice) and call
     * the callback on the node range identified by index.
     * @param index - The index of the depth slice.
     * @param callback - The callback.
     */
    public sliceRangeDo(index: number, callback: RangeCallback): void {
        this._linearization.sliceDo(index, callback);
    }


    initialize(format: Topology.InputFormat, semantics: Topology.InputSemantics, edges: Array<number> | Array<[number, number]>): boolean {

        switch (semantics) {
            case Topology.InputSemantics.ParentIdId:
                switch (format) {
                    case Topology.InputFormat.Tupled:
                        this.fromInterleavedEdgesIdById(([] as number[]).concat(...edges));
                        break;
                    case Topology.InputFormat.Interleaved:
                    default:
                        assert(edges.length % 2 === 0,
                            `Interleaved edges expect to be a multiple of two ids.`);
                        this.fromInterleavedEdgesIdById(edges as number[]);
                        break;
                }
                break;
            case Topology.InputSemantics.ParentIndexId:
                switch (format) {
                    case Topology.InputFormat.Tupled:
                        this.fromInterleavedEdgesIndexById(([] as number[]).concat(...edges));
                        break;
                    case Topology.InputFormat.Interleaved:
                    default:
                        assert(edges.length % 2 === 0,
                            `Interleaved edges expect to be a multiple of two ids.`);
                        this.fromInterleavedEdgesIndexById(edges as number[]);
                        break;
                }
                break;
        }

        return true;
    }


    /**
     * Provides access to a node by a node index.
     * @param index - The index for lookup.
     */
    node(index: number): Node | undefined {
        if (this._nodes.length <= index) {
            return undefined;
        }
        return this._nodes[index];
    }

    /**
     * Provides access to an inner node index by a node's ID.
     * @param id - The id for lookup.
     */
    innerNodeIndexById(id: number): number | undefined {
        return this._innerNodeIndicesById.get(id);
    }

    /**
     * Provides access to a leaf node index by a node's ID.
     * @param id - The id for lookup.
     */
    leafNodeIndexById(id: number): number | undefined {
        return this._leafNodeIndicesById.get(id);
    }

    /**
     * Provides access to an inner node by a node's ID.
     * @param id - The id for lookup.
     */
    innerNodeById(id: number): Node | undefined {
        const index = this.innerNodeIndexById(id);
        if (index === undefined) {
            return undefined;
        }
        return this.node(index);
    }

    /**
     * Provides access to a leaf node by a node's ID.
     * @param id - The id for lookup.
     */
    leafNodeById(id: number): Node | undefined {
        const index = this.leafNodeIndexById(id);
        if (index === undefined) {
            return undefined;
        }
        return this.node(index);
    }


    /**
     * Iterate over and invoke the callback on every inner node (breadth-first, beginning from root).
     * @param callback - The callback to be invoked on every inner node.
     */
    forEachInnerNode(callback: Topology.NodeCallback): void {
        for (let i = 0; i < this.depth - 1; ++i) {
            this.sliceDo(i, callback);
        }
    }

    /**
     * Iterate over all parents (breadth-first, beginning from root) and call the callback on each
     * parent to maxDepth; maxDepth is clamped to be greater than 0 and excluding the leaf
     * layer
     * @param maxDepth - The deeptest depth layer of inner nodes to consider (0 for root only),
     * @param callback - The callback.
     */
    parentsDoUntilDepth(maxDepth: number, callback: Topology.NodeCallback): void {
        const end = Math.min(Math.max(maxDepth, 0), this.depth - 1);

        for (let i = 0; i < end; ++i) {
            this.sliceDo(i, callback);
        }
    }

    /**
     * Iterate over all leaves and call the callback on each.
     * @param callback - The callback.
     */
    forEachLeafNode(callback: Topology.NodeCallback): void {
        this.sliceDo(this.depth - 1, callback);
    }

    /**
     * Iterate over all nodes (starting with parents, breadth-first, beginning from root and the leaves
     * at last) and call the callback on each node.
     * @param callback - The callback.
     */
    nodesDo(callback: Topology.NodeCallback): void {
        this.forEachInnerNode(callback);
        this.forEachLeafNode(callback);
    }

    /**
     * Iterate over all nodes in reverse order (starting with the leaves, and the parents towards the
     * root) and call the callback on each node.
     * @param callback - The callback.
     */
    reverseNodesDo(callback: Topology.NodeCallback): void {
        this.forEachLeafNode(callback);
        this.reverseParentsDo(callback);
    }

    /**
     * Iterate over all nodes in depth-first order and call the callback on each node.
     * @param callback - The callback.
     */
    depthFirstDo(callback: Topology.NodeCallback): void {
        const recursion = (node: Node) => {
            callback(node);
            this.childrenDo(node, recursion);
        };
        callback(this.root);
    }

    /**
     * Iterate over all children in the current order
     *
     * @param callback - The callback.
     */
    childrenDo(parent: Node, callback: Topology.NodeCallback): void {
        assert(parent !== undefined, `Parent is expected to be valid.`);

        if (parent.firstChild === Node.INVALID_INDEX) {
            return;
        }
        this.siblingsDo(this.node(parent.firstChild)!, callback);
    }

    /**
     * Iterate over all right siblings in the original order
     * @param callback - The callback.
     */
    siblingsDo(node: Node, callback: Topology.NodeCallback): void {

        let currentSibling = node;
        callback(currentSibling);
        while (currentSibling.nextSibling !== Node.INVALID_INDEX) {
            currentSibling = this.node(currentSibling.nextSibling)!;
            callback(currentSibling);
        }
    }

    /**
     * Iterate over all right siblings in the original order
     * @param callback - The callback.
     */
    siblingsRangeDo(first: Node, last: Node | undefined, callback: Topology.NodeCallback): void {
        if (last === undefined) {
            return this.siblingsDo(first, callback);
        }

        for (let current = first; current !== undefined && current !== last;
            current = this.node(current.nextSibling)!) {
            callback(current);
        }
    }

    /**
     * Iterate over all parents in reverse order (breadth-first, beginning at lowest depth slice) and
     * call the callback on each parent.
     * @param callback - The callback.
     */
    reverseParentsDo(callback: Topology.NodeCallback): void {
        for (let i = this.depth - 2; i >= 0; --i) {
            this.sliceDo(i, callback);
        }
    }


    /**
     * Get linearization containing depth-slices for the topology
     */
    get linearization(): Linearization {
        return this._linearization;
    }

    /**
     * Return the number of nodes.
     */
    get numberOfNodes(): number {
        return this._linearization.numberOfNodes;
    }

    /**
     * Return the number of parents.
     */
    get numberOfInnerNodes(): number {
        return this._linearization.numberOfInnerNodes;
    }

    /**
     * Return the number of leaves.
     */
    get numberOfLeafNodes(): number {
        return this._linearization.numberOfLeafNodes;
    }

    /**
     * Return the maximum depth of the tree.
     */
    get depth(): number {
        return this._linearization.length;
    }

    /**
     * Accessor for the root node.
     */
    get root(): Node {
        return this._nodes[0];
    }

    /**
     * Accessor for the vector of nodes.
     */
    get nodes(): Array<Node> {
        return this._nodes;
    }

    /**
     * Get edge index to topology index map.
     *
     * This is useful to, for example, map from the originally passed edge list to the new position
     * in this topology.
     */
    get edgeIndexToTopologyIndexMap() {
        return this._edgeIndexToTopologyIndexMap;
    }

    /**
     * Get topology index to edge index map.
     *
     * This is useful to, for example, perform a lookup from a node of this topology in the originally
     * passed edge list or associated attribute buffers (when using topology='topology').
     */
    get topologyIndexToEdgeIndexMap() {
        return this._topologyIndexToEdgeIndexMap;
    }
}

export namespace Topology {

    /**
     * Interface of a callback that can be used for iteration over the tree or individual depth slices.
     */
    export interface RangeCallback { (start: number, end: number): void; }
    export interface NodeCallback { (node: Node): void; }

    export enum InputFormat {
        Interleaved = 'interleaved',
        Tupled = 'tupled',
    }

    export enum InputSemantics {
        ParentIdId = 'parent-id-id',
        ParentIndexId = 'parent-index-id',
    }

    export enum IterationDirection {
        TopDown = 'top-down',
        BottomUp = 'bottom-up',
        DepthFirst = 'depth-first',
        Leaves = 'leaves',
    }

}
