import { describe, expect, it } from 'vitest';

import { GeometryCreation } from '../source/geometrycreation';
import { Rect } from '../source/rect';
import { createMinimalGeometryConfiguration, createStarTopology } from './helpers';

describe('GeometryCreation', () => {
    it('maps colors to valid index range', () => {
        expect(GeometryCreation.getColorIndex(0.0, 5, [0, 1])).toBe(0);
        expect(GeometryCreation.getColorIndex(1.0, 5, [0, 1])).toBe(4);
    });

    it('creates leaf layout buffer', () => {
        const tree = createStarTopology(2);
        const layout = new Array<Rect>(tree.numberOfNodes);
        layout[0] = new Rect(0, 0, 1, 1);
        layout[1] = new Rect(0, 0, 0.5, 1);
        layout[2] = new Rect(0.5, 0, 1, 1);

        const buffer = GeometryCreation.createLeafLayoutBuffer(
            tree,
            layout,
            createMinimalGeometryConfiguration()
        );

        expect(buffer.length).toBe(8);
        expect(buffer[2]).toBeCloseTo(1.0, 6);
    });
});
