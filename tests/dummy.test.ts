import { describe, expect, it } from 'vitest';

import { Rect } from '../source/rect';

describe('dummy smoke test', () => {
    it('constructs a valid rectangle', () => {
        const rect = new Rect(0, 0, 2, 1);

        expect(rect.width).toBe(2);
        expect(rect.height).toBe(1);
        expect(rect.isValid()).toBe(true);
    });
});
