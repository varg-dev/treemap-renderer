import { describe, expect, it } from 'vitest';

import { Rect } from '../source/rect';

describe('Rect', () => {
    it('computes dimensions and area', () => {
        const rect = new Rect(1, 2, 4, 6);
        expect(rect.width).toBe(3);
        expect(rect.height).toBe(4);
        expect(rect.area).toBe(12);
        expect(rect.isValid()).toBe(true);
    });

    it('supports split operations', () => {
        const rect = new Rect(0, 0, 1, 1);
        const [left, right] = rect.horizontalSplit(0.25);

        expect(left.width).toBeCloseTo(0.25, 6);
        expect(right.width).toBeCloseTo(0.75, 6);
        expect(left.height).toBeCloseTo(1.0, 6);
        expect(right.height).toBeCloseTo(1.0, 6);
    });
});
