
/* spellchecker: disable */

import { gl_matrix_extensions } from 'webgl-operate';

import { Topology } from './topology';

/* spellchecker: enable */


/**
 * This namespace covers various ideas for the computation/derivation/retrieval/estimation of specific
 * configuration parameters. This is the place where magic numbers coexists and prosper without fear of
 * removal or missing rationale.
 */
export namespace ConfigurationAids {

    /**
     * Makes an 'educated guess' for a height factor based on a tree's topology.
     * @param tree - Topology to base approach on, e.g., using the number of nodes.
     * @param approach - Approach to be applied for estimation.
     * @returns - A height scale that can be used to adjust the height mapping of all nodes based on
     * the topology.
     */
    export function heightScale(tree: Topology,
        approach: HeightScaleApproach = HeightScaleApproach.SomethingInverseSqrt): number {

        switch (approach) {
            default:
            case HeightScaleApproach.SomethingInverseSqrt:
                return gl_matrix_extensions.clamp(
                    100.0 / Math.sqrt(tree.numberOfNodes) + 0.0125, 0.0625, 0.3333);
        }
    }

    /**
     * Approaches for height factor estimation based on a given topology.
     */
    export enum HeightScaleApproach {
        SomethingInverseSqrt = 'SomethingInverseSqrt',
    }

    /**
     * Makes an 'educated guess' for a parent margin based on a tree's topology.
     * @param tree - Topology to base approach on, e.g., using the number of nodes.
     * @param approach - Approach to be applied for estimation.
     * @returns - A margin that can be used to adjust the parent margin.
     */
    export function parentMargin(tree: Topology,
        approach: MarginApproach = MarginApproach.SomethingLog10): number {

        switch (approach) {
            default:
            case MarginApproach.SomethingLog10:
                return 0.04 + (1.0 - Math.log10(tree.numberOfNodes + 1) / 6.0) * 0.12;
        }
    }

    /**
     * Makes an 'educated guess' for a sibling margin based on a tree's topology.
     * @param tree - Topology to base approach on, e.g., using the number of nodes.
     * @param approach - Approach to be applied for estimation.
     * @returns - A margin that can be used to adjust the sibling margin.
     */
    export function siblingMargin(tree: Topology,
        approach: MarginApproach = MarginApproach.SomethingLog10): number {

        switch (approach) {
            default:
            case MarginApproach.SomethingLog10:
                return 0.01 + (1.0 - Math.log10(tree.numberOfNodes + 1) / 6.0) * 0.12;
        }
    }

    /**
     * Approaches for margin estimation based on a given topology.
     */
    export enum MarginApproach {
        SomethingLog10 = 'SomethingLog10',
    }

}
