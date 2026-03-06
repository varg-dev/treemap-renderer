import { describe, expect, it } from 'vitest';

import { BufferResolver } from '../source/bufferresolver';
import { Configuration } from '../source/configuration';
import { createStarTopology } from './helpers';

describe('BufferResolver', () => {
    it('creates constant fallback buffers', () => {
        const tree = createStarTopology(2);
        const resolver = new BufferResolver(tree);

        const callback = resolver.constBufferCallback(7.0);
        const buffer = callback();

        expect(buffer.length).toBe(tree.numberOfNodes);
        expect(Array.from(buffer)).toEqual([7, 7, 7]);
    });

    it('uses fallback callback when identifier is missing', () => {
        const tree = createStarTopology(2);
        const resolver = new BufferResolver(tree);
        const cfg = new Configuration();

        const resolved = resolver.resolve('', cfg, [], resolver.constBufferCallback(3.0));

        expect(resolved).toBeDefined();
        expect(Array.from(resolved as Float32Array)).toEqual([3, 3, 3]);
    });

    it('uses fallback callback when identifier resolves to missing buffer', () => {
        const tree = createStarTopology(2);
        const resolver = new BufferResolver(tree);
        const cfg = new Configuration();

        const resolved = resolver.resolve('buffer:missing', cfg, [], resolver.constBufferCallback(2.0));

        expect(Array.from(resolved as Float32Array)).toEqual([2, 2, 2]);
    });

    it('throws when identifier is invalid and no fallback callback is given', () => {
        const tree = createStarTopology(2);
        const resolver = new BufferResolver(tree);
        const cfg = new Configuration();

        expect(() => {
            resolver.resolve('buffer:missing', cfg, []);
        }).toThrowError(`Unable to resolve buffer 'buffer:missing'.`);
    });
});
