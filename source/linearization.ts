
/**
 * A callback gets two arguments forming the range of the current depth slice.
 * The range is including start and end: [start, end].
 */
export interface RangeCallback { (start: number, end: number): void; }

/**
 * The linearization database of a linearized tree. A tree is linearized using breadth-first traversal,
 * excluding the leaf-nodes. All nodes sharing one depth in the tree are placed adjacently with
 * ascending depth (root is index 0). The leaves are placed at the end of the linearization, regardless
 * of their depth.
 *
 * To initialize the depth-slices, the following interface can be used:
 *
 * ```
 * linearization.clear();
 * // start root slice at 0
 * linearization.startSlice(0);
 * // start first real slice at 1, implies endSlice(0), ending the former slice [0, 0]
 * linearization.nextSlice(1);
 * // start next slice at 4, implies endSlice(3), ending the former slice [1, 3]
 * linearization.nextSlice(4);
 * // start leaf slice at 10, implies endSlice(9), ending former slice [4, 9]
 * linearization.nextSlice(10);
 * // end leaf slice with [10,25]
 * linearization.endSlice(25);
 * // resulting slices structure is [ [0, 0], [1, 3], [4, 9], [10, 25]]
 * ```
 */
export class Linearization {

    /** @see {@link slices} */
    private _slices: Array<[number, number]> = [];

    /**
     * Clears the depth slices; basically invalidating the object.
     */
    clear(): void {
        this._slices = [];
    }

    /**
     * Accessor to a slice of a specific depth.
     * @param index - The index of the depth slice (depth).
     * @return - The range of the depth slice, undefined if the index is not in the valid range.
     */
    slice(index: number): [number, number] | undefined {
        if (index < 0 || index >= this._slices.length) {
            return undefined;
        }
        return this._slices[index];
    }

    /**s
     * Starts a new depth slice. This assumes that the previous slice is completed (ended correctly).
     * @param index - The index of the first node in the new depth slice.
     */
    startSlice(index: number): void {
        this._slices.push([index, index]);
    }

    /**
     * Update the end index of the current depth slice.
     * @param index - The index of the last node in the current depth slice.
     */
    endSlice(index: number): void {
        this._slices[this._slices.length - 1][1] = index;
    }

    /**
     * Start a new depth slice at the given index. The last slice is ended at the index before.
     * @param index - The index of the first node in the new depth slice.
     */
    nextSlice(index: number): void {
        this.endSlice(index - 1);
        this.startSlice(index);
    }

    /**
     * Add a new depth slice at once using a start and end index. This assumes that the previous slice
     * is complete (ended correctly).
     * @param start - The index of the first node in the new depth slice.
     * @param end - The index of the last node in the new depth slice.
     */
    addSliceByRange(start: number, end: number): void {
        this._slices.push([start, end]);
    }

    /**
     * Add a new depth slice at once using the given length (e.g., node count). This assumes that the
     * former slice is complete (ended correctly).
     * @param length - The number of nodes within the new depth slice.
     */
    addSliceByLength(length: number): void {
        if (this.length === 0) {
            this._slices.push([0, length - 1]);
            return;
        }
        const lastIndex = this._slices[this._slices.length - 1][1];
        this._slices.push([lastIndex + 1, lastIndex + length]);
    }


    /**
     * Invokes a callback with the depth slice identified by the given index. The callback is not
     * invoked if the index is not valid.
     * @param index - The index of the depth slice to invoke the callback for.
     * @param callback - The callback that is to be invoked for the slice.
     */
    sliceDo(index: number, callback: RangeCallback): void {
        if (index < 0 || index >= this._slices.length) {
            return;
        }
        const range = this._slices[index];
        callback(range[0], range[1]);
    }

    /**
     * Invokes a callback for each depth slice including the root and leaves slices. The order is from
     * depth 0 to the leaves slice.
     * @param callback - The callback that is to be invoked per slice.
     */
    slicesDo(callback: RangeCallback): void {
        for (const range of this._slices) {
            callback(range[0], range[1]);
        }
    }


    /**
     * The depth slices including the root [0, 0] and leaves [l_n, l_m].
     */
    get slices(): Array<[number, number]> {
        return this._slices;
    }

    /**
     * Number of inner nodes (parents) of the underlying tree.
     */
    get numberOfInnerNodes(): number {
        return this._slices[this._slices.length - 1][0];
    }

    /**
     * Number of leaf nodes of the underlying tree.
     */
    get numberOfLeafNodes(): number {
        return this.numberOfNodes - this.numberOfInnerNodes;
    }

    /**
     * Number of nodes of the underlying tree.
     */
    get numberOfNodes(): number {
        return this._slices[this._slices.length - 1][1] + 1;
    }

    /**
     * Number of depth slices. This is equal to the depth of the tree.
     */
    get length(): number {
        return this._slices.length;
    }

}
