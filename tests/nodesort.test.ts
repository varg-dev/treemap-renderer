import { describe, expect, it } from 'vitest';

import { Configuration } from '../source/configuration';
import { NodeSort } from '../source/nodesort';
import { Topology } from '../source/topology';
import { collectChildren } from './helpers';

describe('NodeSort', () => {
    it('sorts root children by identity ascending', () => {
        const tree = new Topology();
        tree.initialize(
            Topology.InputFormat.Interleaved,
            Topology.InputSemantics.ParentIdId,
            [0, 30, 0, 10, 0, 20]
        );

        const configuration = new Configuration();
        configuration.layout = {
            algorithm: 'strip',
            weight: 'buffer:weights',
            sort: {
                algorithm: NodeSort.Algorithm.Ascending,
                key: NodeSort.Key.Identity,
            },
        };

        const ok = NodeSort.sortNodes(tree, [], undefined, configuration);

        expect(ok).toBe(true);
        const ids = collectChildren(tree, tree.root).map((n) => n.id);
        expect(ids).toEqual([10, 20, 30]);
    });
});
