
/* spellchecker: disable */

import { Position3DLabel, Projected3DLabel } from 'webgl-operate';

import { Configuration } from './configuration';
import { Rect } from './rect';
import { Topology } from './topology';

/* spellchecker: enable */

/* @todo deprecated - remove this completely. */

export class IntermediateResults {
    topology = new Topology();

    accessorySpaces: Array<Rect> | undefined;
    labelRects: Array<Rect> | undefined;
    labelPaddingSpaces: Array<number> | undefined;

    /**
     * Bottom-up accumulated attribute values.
     */
    aggregatedWeights: Configuration.AttributeBuffer | undefined;
    aggregatedHeights: Configuration.AttributeBuffer | undefined;
    aggregatedColors: Configuration.AttributeBuffer | undefined;

    /**
     * webgl-operate's labels.
     */
    leafLabels: Array<Projected3DLabel> | undefined;
    innerNodeLabels: Array<Position3DLabel> | undefined;

}
