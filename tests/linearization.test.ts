import { describe, expect, it } from 'vitest';

import { Linearization } from '../source/linearization';

describe('Linearization', () => {
    it('adds slices by length', () => {
        const l = new Linearization();
        l.addSliceByLength(1);
        l.addSliceByLength(2);
        l.addSliceByLength(3);

        expect(l.slice(0)).toEqual([0, 0]);
        expect(l.slice(1)).toEqual([1, 2]);
        expect(l.slice(2)).toEqual([3, 5]);
        expect(l.numberOfNodes).toBe(6);
        expect(l.length).toBe(3);
    });
});
