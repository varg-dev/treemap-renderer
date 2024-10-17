
/* spellchecker: disable */

import { Color } from 'webgl-operate';

/* spellchecker: enable */


/* @todo - this is deprecated, switch to webgl-operate color scale. */
export class ColorTable {

    protected _emphasis: Float32Array;
    protected _auxiliary: Float32Array;
    protected _inner: Float32Array;
    protected _leaf: Float32Array;


    constructor(emphasis: Color, auxiliary: Array<Color>, inner: Array<Color>, leaf: Array<Color>) {

        this._emphasis = emphasis.rgbaF32;

        this._auxiliary = new Float32Array(auxiliary.length * 4);
        for (let i = 0; i < auxiliary.length; ++i) {
            this._auxiliary.set(auxiliary[i].rgbaF32, i * 4);
        }

        this._inner = new Float32Array(inner.length * 4);
        for (let i = 0; i < inner.length; ++i) {
            this._inner.set(inner[i].rgbaF32, i * 4);
        }

        this._leaf = new Float32Array(leaf.length * 4);
        for (let i = 0; i < leaf.length; ++i) {
            this._leaf.set(leaf[i].rgbaF32, i * 4);
        }
    }

    get innerNodeColorOffset(): number {
        return this.auxiliaryColorCount;
    }

    get innerNodeColorCount(): number {
        return this._inner.length / 4;
    }

    get leafColorOffset(): number {
        return this.innerNodeColorOffset + this.innerNodeColorCount;
    }

    get leafColorCount(): number {
        return this._leaf.length / 4;
    }

    get auxiliaryColorOffset(): number {
        return 0;
    }

    get auxiliaryColorCount(): number {
        return this._auxiliary.length / 4 + 1;
    }

    get selectionColorIndex(): number {
        return 0;
    }

    get bits(): Float32Array {
        const colorBits = new Float32Array(
            (this.auxiliaryColorCount + this.innerNodeColorCount + this.leafColorCount) * 4);

        colorBits.set(this._emphasis, 0);
        colorBits.set(this._auxiliary, 4);
        colorBits.set(this._inner, this.innerNodeColorOffset * 4);
        colorBits.set(this._leaf, this.leafColorOffset * 4);

        return colorBits;
    }

    get length(): number {
        return this.auxiliaryColorCount + this.leafColorCount + this.innerNodeColorCount;
    }
}
