import { describe, expect, it } from 'vitest';

import { Configuration } from '../source/configuration';

describe('Configuration', () => {
    it('serializes typed buffer data to plain JSON array', () => {
        const cfg = new Configuration();
        const data = new Float32Array([1, 2, 3]);

        expect(cfg.bufferDataToJSON(data)).toEqual([1, 2, 3]);
    });

    it('detects linearization mapping', () => {
        expect(Configuration.isLinearizationMapping({ type: 'index-mapping', mapping: [0, 1] })).toBe(true);
        expect(Configuration.isLinearizationMapping('topology')).toBe(false);
    });

    it('accepts a valid topology and marks topology as altered', () => {
        const cfg = new Configuration();
        const topology = {
            edges: [
                [-1, 0],
                [0, 1],
            ],
        };

        cfg.topology = topology;

        expect(cfg.topology).toEqual(topology);
        expect(cfg.altered.topology).toBe(true);
        expect(cfg.altered.any).toBe(true);
    });

    it('initializes layout, geometry, and labels to specification defaults', () => {
        const cfg = new Configuration();

        expect(cfg.layout.algorithm).toBe('strip');
        expect(cfg.layout.weight).toBe('buffer:weights');
        expect(cfg.layout.aspectRatio).toBe(1.0);
        expect(cfg.geometry.parentLayer).toEqual({});
        expect(cfg.geometry.leafLayer).toEqual({});
        expect(cfg.labels).toEqual({});
    });

    it('accepts valid buffers and keeps binary-array shape in JSON export', () => {
        const cfg = new Configuration();
        const buffers = [
            {
                identifier: 'weights',
                type: 'float32',
                data: new Float32Array([1, 2, 3]),
            },
        ];

        cfg.buffers = buffers;
        expect(cfg.buffers).toEqual(buffers);
        expect(cfg.buffersToJSON()).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    identifier: 'weights',
                    type: 'float32',
                    data: [1, 2, 3],
                }),
            ]));

        expect(cfg.buffersToJSON()).toHaveLength(1);
        expect(cfg.buffersToJSON()[0]).toEqual(
            expect.objectContaining({
                identifier: 'weights',
                type: 'float32',
                data: [1, 2, 3],
            }));
    });

    it('normalizes label names from object map to Map on setter', () => {
        const cfg = new Configuration();
        const labels = {
            names: {
                0: 'root',
                1: 'leaf',
            },
            innerNodeLayerRange: [0, 1],
            numTopInnerNodes: 2,
        };

        cfg.labels = labels;

        expect(cfg.labels.names).toBeInstanceOf(Map);
        expect(cfg.labels.names?.get(0)).toBe('root');
        expect(cfg.labels.names?.get(1)).toBe('leaf');
        expect(cfg.labelsToJSON()).toEqual({
            names: {
                0: 'root',
                1: 'leaf',
            },
            innerNodeLayerRange: [0, 1],
            numTopInnerNodes: 2,
        });
    });

    it('rejects invalid section values with meaningful errors', () => {
        const cfg = new Configuration();

        cfg.topology = {
            edges: [[-1, 0]],
        };

        cfg.buffers = [
            {
                identifier: 'weights',
                type: 'float32',
                data: [1, 2, 3],
            },
        ];

        cfg.layout = {
            algorithm: 'strip',
            weight: 'buffer:weights',
        };

        expect(() => {
            cfg.topology = {
                topology: 'broken',
            } as Configuration.Topology;
        }).toThrowError(`Configuration validation failed for 'topology'.`);

        expect(() => {
            cfg.layout = {
                algorithm: 'invalid-layout',
                weight: 'buffer:weights',
            } as Configuration.Layout;
        }).toThrowError(`Configuration validation failed for 'layout'.`);

        expect(() => {
            cfg.bufferViews = [
                {
                    identifier: 10,
                    source: 'buffer:weights',
                } as unknown as Configuration.BufferViews,
            ];
        }).toThrowError(`Configuration validation failed for 'bufferViews'.`);

        expect(() => {
            cfg.labels = {
                names: 10 as unknown as Record<number, string>,
            } as unknown as Configuration.Labels;
        }).toThrowError(`Configuration validation failed for 'labels'.`);
    });

    it('keeps previous valid configuration when a setter throws', () => {
        const cfg = new Configuration();
        const validTopology = {
            edges: [[-1, 0]],
        };
        const invalidTopology = {
            edges: 'invalid-topology-shape',
        } as unknown as Configuration.Topology;

        cfg.topology = validTopology;
        expect(() => {
            cfg.topology = invalidTopology;
        }).toThrow();

        expect(cfg.topology).toEqual(validTopology);
    });

    it('defers dependent reference checks to consolidated validation', () => {
        const cfg = new Configuration();

        expect(() => {
            cfg.bufferViews = [
                {
                    identifier: 'view',
                    source: 12,
                },
            ];
        }).toThrowError(`Configuration validation failed for 'bufferViews'.`);

        cfg.layout = {
            algorithm: 'strip',
            weight: 'buffer:weights',
        };

        cfg.bufferViews = [
            {
                identifier: 'view-with-late-ref',
                source: 'buffer:weights',
                transformations: [
                    { type: 'propagate-up', operation: 'sum' },
                ],
            } as Configuration.BufferView,
        ];

        cfg.geometry = {
            parentLayer: {
                colorMap: 'color:palette',
            },
            leafLayer: {
                colors: 'buffer:heights',
            },
        } as Configuration.Geometry;

        cfg.labels = {
            names: 'buffer:weights',
        } as unknown as Configuration.Labels;

        expect(() => {
            cfg.validateReferences();
        }).toThrowError(`Configuration validation failed for 'layout': unknown buffer reference 'buffer:weights'.`);

        cfg.buffers = [
            {
                identifier: 'weights',
                type: 'float32',
                data: [1, 2, 3],
            },
            {
                identifier: 'heights',
                type: 'float32',
                data: [1, 2, 3],
            },
        ];

        cfg.colors = [
            {
                identifier: 'palette',
                colorspace: 'rgb',
                value: [0.25, 0.5, 0.75, 1.0],
            },
        ];

        expect(() => {
            cfg.validateReferences();
        }).not.toThrow();
    });

    it('rejects invalid color array payloads early', () => {
        expect(() => {
            const cfg = new Configuration();

            cfg.colors = [
                {
                    identifier: 'bad',
                    colorspace: 'hsl',
                    value: [1, 2, 3, 4, 5, 6],
                },
            ];
        }).toThrowError(`Configuration validation failed for 'colors'.`);
    });

    it('rejects unresolved transform references when validated', () => {
        const cfg = new Configuration();

        cfg.layout = {
            algorithm: 'strip',
            weight: 'buffer:weights',
        };

        cfg.bufferViews = [
            {
                identifier: 'view-with-unknown-transform-ref',
                source: 'buffer:weights',
                transformations: [
                    {
                        type: 'transform',
                        operation: 'add',
                        buffer: 'buffer:missing',
                        parameter: 1.0,
                    },
                ],
            } as Configuration.BufferView,
        ];

        cfg.geometry = {
            parentLayer: {
                colorMap: 'color:missing',
            },
            leafLayer: {
                colors: 'buffer:weights',
            },
        } as Configuration.Geometry;

        cfg.labels = {
            names: 'buffer:weights',
        } as unknown as Configuration.Labels;

        cfg.buffers = [
            {
                identifier: 'weights',
                type: 'float32',
                data: [1, 2, 3],
            },
        ];

        expect(() => {
            cfg.validateReferences();
        }).toThrowError(`Configuration validation failed for 'bufferViews': unknown buffer reference 'buffer:missing'.`);
    });

    it('rejects malformed labels names when provided as object', () => {
        const cfg = new Configuration();

        expect(() => {
            cfg.labels = {
                names: {
                    0: 12,
                },
            } as unknown as Configuration.Labels;
        }).toThrowError(`Configuration validation failed for 'labels'.`);
    });
});
