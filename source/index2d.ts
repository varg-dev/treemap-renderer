
/**
 * This is a 2D-iterator for nested arrays.
 */
export class Index2D {
    public outer: number;
    public inner: number;

    constructor() {
        this.outer = 0;
        this.inner = 0;
    }

    /**
     * Advances the inner index by one. Overflows will set the inner index back and advance the outer
     * one.
     * @param container - the container over which to iterate
     */
    next(container: any[][]): void {
        ++this.inner;
        if (this.inner === container[this.outer].length) {
            ++this.outer;
            this.inner = 0;
        }
    }

    /**
     * Whether the index has reached the end of the container.
     * @param container - the container over which to iterate
     */
    end(container: any[][]): boolean {
        return this.outer === container.length;
    }

    /**
     * Returns the element at the current index.
     * @param container - the container over which to iterate
     */
    element(container: any[][]): any {
        return container[this.outer][this.inner];
    }
}
