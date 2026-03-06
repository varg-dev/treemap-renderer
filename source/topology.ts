
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
     * Secondary linearization used by layout processing.
     * This stores a straightforward breadth-first order including leaves in depth slices.
     */
    private _layoutLinearization: Linearization = new Linearization();

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

    /**
     * Maps render index -> layout index.
     */
    private _renderToLayoutIndexMap = new Array<number>();

    /**
     * Maps layout index -> render index.
     */
    private _layoutToRenderIndexMap = new Array<number>();


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

            innerNodesById.set(node.id, node);

            // Test for last edge to omit next parent detection
            if (edge1[0] === Node.INVALID_ID && edge1[1] === Node.INVALID_ID) {
                continue;
            }

            if (edge1[0] === edge0[1]) {

                /* If the subsequent edge has the current child node as parent, mark and use this node
                as parent node. */

                parent = node;

            } else if (edge1[0] !== edge0[0]) {
                /* && edge1[0] !== edge0[1] | given by previous if */

                /* If the subsequent edge has a parent that is neither this edges child node nor this
                edges parent node, gather the parent for next iterations node creation ahead. */
                /* Missing branch by design: this parser does not implement deferred parent resolution.
                Parent ids must already be known at this point (pre-order input contract). */

                assert(innerNodesById.has(edge1[0]), `expected next parent to be already created, ` +
                    `given ${edge1[0]}`);

                parent = innerNodesById.get(edge1[0])!;
            }
        }

        this.fromNodes(nodes, nodesByDepth);
    }


    /**
     * Processes interleaved parent/child *index* pairs where parent indices are topology indices rather
     * than explicit node ids. This path is reached from `initialize(Topology.InputSemantics.ParentIndexId, ...)`
     * for both tupled/interleaved encodings.
     *
     * Example in practice: an input `[ -1, 0, 0, 1, 0, 2 ]` denotes root->A and root->B, with children
     * given as indices. The method must normalize these indices to internal node indices before
     * reconstructing sibling/parent links. If this path mis-handles that normalization, the hierarchy can be
     * built with incorrect parent attachments and downstream geometry/label updates become inconsistent.
     */
    private fromInterleavedEdgesIndexById(edges: Array<number>): void {
        assert(edges.length % 2 === 0,
            `expected length of interleaved edges list to be a multiple of 2`);

        const nodes = new Array<Node>();
        const nodesByDepth = new Array<Array<Node>>();

        const hasRootSentinel = edges[0] === Node.INVALID_ID;
        const topologyParentOffset = hasRootSentinel ? 0 : 1;
        let i = 0;

        /* Create root node. */

        nodes.push(new Node(0, 0));
        nodesByDepth.push(new Array<Node>());
        nodesByDepth[0].push(nodes[0]);

        if (hasRootSentinel) { // skip root edge from input tuples when present
            i += 2;
        }

        /* Process interleaved edges. */

        for (; i < edges.length; i += 2) {
            const edge: [number, number] = [edges[i + 0], edges[i + 1]];

            // Missing branch by design: out-of-order parent indices are not buffered/replayed here.
            const parentIndex = edge[0] < 0 ? 0 : edge[0] + topologyParentOffset;
            assert(parentIndex < nodes.length, `expected parent to be processed before child`);

            const parent: Node | undefined = nodes[parentIndex];


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


    private bfsDepthSlices(nodes: Array<Node>): Array<Array<Node>> {
        if (nodes.length === 0) {
            return [];
        }

        const slices: Array<Array<Node>> = [];
        let current: Array<Node> = [nodes[0]];

        while (current.length > 0) {
            slices.push(current);
            const next: Array<Node> = [];

            for (const parent of current) {
                for (let childIndex = parent.firstChild; childIndex !== Node.INVALID_INDEX;
                    childIndex = nodes[childIndex].nextSibling) {
                    next.push(nodes[childIndex]);
                }
            }

            current = next;
        }

        return slices;
    }

    private fromNodes(newNodes: Array<Node>, _nodesByDepth: Array<Array<Node>>): void {
        this._linearization.clear();
        this._layoutLinearization.clear();

        this._innerNodeIndicesById.clear();
        this._leafNodeIndicesById.clear();
        this._edgeIndexToTopologyIndexMap.length = newNodes.length;
        this._topologyIndexToEdgeIndexMap.length = newNodes.length;
        this._renderToLayoutIndexMap.length = newNodes.length;
        this._layoutToRenderIndexMap.length = newNodes.length;
        this._edgeIndexToTopologyIndexMap.fill(-1);
        this._topologyIndexToEdgeIndexMap.fill(-1);
        this._renderToLayoutIndexMap.fill(-1);
        this._layoutToRenderIndexMap.fill(-1);

        const layoutSlices = this.bfsDepthSlices(newNodes);
        const renderInnerSlices = new Array<Array<Node>>();
        const renderLeafBucket = new Array<Node>();

        for (const depthSlice of layoutSlices) {
            const inner = depthSlice.filter((value: Node) => !value.isLeaf);
            const leaves = depthSlice.filter((value: Node) => value.isLeaf);

            if (inner.length > 0) {
                renderInnerSlices.push(inner);
            }
            renderLeafBucket.push(...leaves);
        }

        const renderSlices = [...renderInnerSlices, renderLeafBucket];
        for (const depthSlice of renderSlices) {
            this._linearization.addSliceByLength(depthSlice.length);
        }

        for (const depthSlice of layoutSlices) {
            this._layoutLinearization.addSliceByLength(depthSlice.length);
        }

        const renderIndices = new Map<number, number>();
        const layoutIndices = new Map<number, number>();
        this._nodes.length = newNodes.length;

        renderIndices.set(-1, -1);
        layoutIndices.set(-1, -1);

        let layoutIndex = 0;
        for (const depthSlice of layoutSlices) {
            for (const node of depthSlice) {
                layoutIndices.set(node.index, layoutIndex);
                ++layoutIndex;
            }
        }

        let renderIndex = 0;
        for (const nodes of renderSlices) {
            for (const node of nodes) {
                this._nodes[renderIndex] = node;
                (node.isLeaf ? this._leafNodeIndicesById : this._innerNodeIndicesById)
                    .set(node.id, renderIndex);

                renderIndices.set(node.index, renderIndex);
                this._edgeIndexToTopologyIndexMap[node.index] = renderIndex;
                this._topologyIndexToEdgeIndexMap[renderIndex] = node.index;
                ++renderIndex;
            }
        }

        for (let oldIndex = 0; oldIndex < newNodes.length; ++oldIndex) {
            const newRenderIndex = renderIndices.get(oldIndex) as number;
            const newLayoutIndex = layoutIndices.get(oldIndex) as number;

            this._renderToLayoutIndexMap[newRenderIndex] = newLayoutIndex;
            this._layoutToRenderIndexMap[newLayoutIndex] = newRenderIndex;
        }

        // Fix indices
        for (const node of this._nodes) {
            node.layoutIndex = layoutIndices.get(node.index) as number;
            node.index = renderIndices.get(node.index) as number;
            node.parent = renderIndices.get(node.parent) as number;
            node.initialNextSibling = renderIndices.get(node.initialNextSibling) as number;
            node.initialFirstChild = renderIndices.get(node.initialFirstChild) as number;
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
        recursion(this.root);
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
     * Return the contiguous sibling span in render index space as half-open interval [first, last).
     * This span can include unrelated nodes if children are non-adjacent in render space.
     */
    childrenAsRenderRange(parent: Node): { first: number; last: number } {
        assert(parent !== undefined, `Parent is expected to be valid.`);

        if (parent.firstChild === Node.INVALID_INDEX) {
            return { first: 0, last: 0 };
        }

        const first = parent.firstChild;
        let lastNode = this.node(first)!;

        while (lastNode.nextSibling !== Node.INVALID_INDEX) {
            lastNode = this.node(lastNode.nextSibling)!;
        }

        return { first, last: lastNode.index + 1 };
    }

    /**
     * Return the contiguous sibling range in layout index space as half-open interval [first, last).
     */
    childrenAsLayoutRange(parent: Node): { first: number; last: number } {
        assert(parent !== undefined, `Parent is expected to be valid.`);

        if (parent.firstChild === Node.INVALID_INDEX) {
            return { first: 0, last: 0 };
        }

        let first = Node.INVALID_INDEX;
        let previous = Node.INVALID_INDEX;
        let count = 0;

        this.childrenDo(parent, (child: Node) => {
            const current = this._renderToLayoutIndexMap[child.index];

            if (first === Node.INVALID_INDEX) {
                first = current;
            } else if (current !== previous + 1) {
                throw new Error('Expected children to form a contiguous range in layout space');
            }

            previous = current;
            ++count;
        });

        return { first, last: first + count };
    }

    /**
     * Return the contiguous sibling range in layout index space as half-open interval [first, last).
     */
    childrenAsRange(parent: Node): { first: number; last: number } {
        return this.childrenAsLayoutRange(parent);
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
            this.sliceRangeDo(i, (start: number, end: number) => {
                for (let current = end; current >= start; --current) {
                    callback(this._nodes[current]);
                }
            });
        }
    }


    /**
     * Get linearization containing depth-slices for the topology
     */
    get linearization(): Linearization {
        return this._linearization;
    }

    /**
     * Get layout-oriented linearization containing strict breadth-first depth slices.
     */
    get layoutLinearization(): Linearization {
        return this._layoutLinearization;
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

    /**
     * Get render-index to layout-index map.
     */
    get renderToLayoutIndexMap() {
        return this._renderToLayoutIndexMap;
    }

    /**
     * Get layout-index to render-index map.
     */
    get layoutToRenderIndexMap() {
        return this._layoutToRenderIndexMap;
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
