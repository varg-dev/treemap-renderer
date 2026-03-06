
/* spellchecker: disable */


import { AttributeBuffer } from './attributebuffer';
import { AttributeTransformations } from './attributetransformations';
import { Configuration } from './configuration';
import { Topology } from './topology';

/* spellchecker: enable */

interface BufferCreationCallback { (): Configuration.AttributeBuffer; }

export class BufferResolver {

    protected _topology: Topology;

    constructor(topology: Topology) {
        this._topology = topology;
    }

    /**
     * Resolves the buffer data, given a buffer reference (either buffer or buffer-view identifier).
     * @param identifier - Buffer or buffer-view identifier that is to be resolved.
     * @param config - Configuration as source of various buffers.
     * @param defaultBufferCallback - Fallback buffer implementation used if the targeted buffer could
     * not be resolved.
     */
    resolve(identifier: string, config: Configuration, normalization: AttributeTransformations.Normalization,
        defaultBufferCallback?: BufferCreationCallback): Configuration.AttributeBuffer | undefined {

        if (defaultBufferCallback && (identifier === undefined || identifier === '')) {
            return defaultBufferCallback();
        }

        const buffer = AttributeBuffer.create(this._topology, normalization, identifier, config);

        if (defaultBufferCallback && buffer === undefined) {
            return defaultBufferCallback();
        }
        if (buffer === undefined) {
            throw new Error(`Unable to resolve buffer '${identifier}'.`);
        }
        return buffer;
    }

    /**
     * Creates a callback that can be used to fill an attribute buffer with a constant value.
     * @param value - Default value that is to be filled in for all nodes.
     */
    constBufferCallback(value: number = 0.0): BufferCreationCallback {
        return () => {
            const buffer = new Float32Array(this._topology.numberOfNodes);
            buffer.fill(value);
            return buffer;
        };
    }

}
