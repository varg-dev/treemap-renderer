import { describe, expect, it } from 'vitest';

import { Configuration } from '../source/configuration';

describe('Configuration', () => {
    it('serializes typed buffer data to plain JSON array', () => {
        const cfg = new Configuration();
        const data = new Float32Array([1, 2, 3]);

        expect(cfg.bufferDataToJSON(data)).toEqual([1, 2, 3]);
    });

    it('detects linearization mapping shape', () => {
        expect(Configuration.isLinearizationMapping({ type: 'index-mapping', mapping: [0, 1] })).toBe(true);
        expect(Configuration.isLinearizationMapping('topology')).toBe(false);
    });
});
