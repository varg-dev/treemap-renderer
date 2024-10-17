

/**
 * Representation of one tree node in a linearized tree.
 */
export class Node {

    static readonly INVALID_ID: number = -1;
    static readonly INVALID_INDEX: number = -1;

    static readonly INVALID_DEPTH: number = -1;
    static readonly INVALID_HEIGHT: number = -1;

    protected _lastChild = Node.INVALID_INDEX;


    /**
     * Index in the linearization (0 is root).
     */
    index = Node.INVALID_INDEX;

    /**
     * Identifier assigned by the user.
     */
    id = Node.INVALID_ID;

    /**
     * Length of the parent-chain until the root (0 if root).
     */
    depth = Node.INVALID_DEPTH;

    /**
     * Index of the immediate parent. Invalid index (-1) if root.
     */
    parent = Node.INVALID_INDEX;

    /**
     * Index of the first child. Invalid index (-1) if leaf.
     */
    firstChild = Node.INVALID_INDEX;

    /**
     * Initial index of the first child intended for restoration of the initial order.
     */

    initialFirstChild = Node.INVALID_INDEX;
    /**
     * Index of the subsequent sibling. Invalid index (-1) if last sibling.
     */
    nextSibling = Node.INVALID_INDEX;

    /**
     * Initial index of the subsequent sibling intended for restoration of the initial order.
     */
    initialNextSibling = Node.INVALID_INDEX;


    /**
     * Constructor of a node for simplified node setup.
     * @param id - This nodes ID.
     * @param index - This nodes Index.
     * @param parent - The parent node for retrieving this node's depth and parent index.
     */
    constructor(id: number, index: number, parent?: Node) {
        this.id = id;
        this.index = index;

        if (parent !== undefined) {
            this.depth = parent.depth + 1;
            this.parent = parent.index;

            if (parent.initialFirstChild === Node.INVALID_INDEX) {
                parent.initialFirstChild = index;
                parent.firstChild = index;
            }
            parent._lastChild = index;

        } else {
            this.depth = 0;
        }
    }

    /**
     * Read-only access to this nodes last child. This is a convenience accessor intended to speed up
     * topology creation (e.g., @see {@link topology.fromInterleavedEdgesIdById}).
     */
    get lastChild(): number {
        return this._lastChild;
    }

    /**
     * Whether or not this node is a leaf node.
     */
    get isLeaf(): boolean {
        return this.firstChild === Node.INVALID_INDEX;
    }

    /**
     * Whether or not this node is a root node.
     */
    get isRoot(): boolean {
        return this.parent === Node.INVALID_INDEX;
    }

}
