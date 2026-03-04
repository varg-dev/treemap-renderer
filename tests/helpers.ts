import { LayoutCallbacks } from '../source/layout';
import { Node } from '../source/node';
import { Rect } from '../source/rect';
import { Topology } from '../source/topology';

export function createStarTopology(children: number): Topology {
    const edges: number[] = [];
    for (let i = 1; i <= children; ++i) {
        edges.push(0, i);
    }

    const tree = new Topology();
    tree.initialize(Topology.InputFormat.Interleaved, Topology.InputSemantics.ParentIdId, edges);
    return tree;
}

export function collectChildren(tree: Topology, parent: Node): Node[] {
    const result: Node[] = [];
    tree.childrenDo(parent, (child) => result.push(child));
    return result;
}

export const noOpLayoutCallbacks: LayoutCallbacks = {
    parentPaddingCallback: (rect: Rect) => rect,
    siblingMarginBeforeCallback: (rect: Rect) => rect,
    siblingMarginAfterCallback: (rect: Rect) => rect,
    accessoryPaddingCallback: (rect: Rect) => rect,
};
