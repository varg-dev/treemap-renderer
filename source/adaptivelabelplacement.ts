
/* spellchecker: disable */

import { auxiliaries, gl_matrix_extensions, vec2, vec4 } from 'webgl-operate';
const assert = auxiliaries.assert;
const v2 = gl_matrix_extensions.v2;

import { Camera, Label, Projected3DLabel } from 'webgl-operate';

import { Index2D } from './index2d';
import { LabelArea } from './labelarea';
import { LabelManagement } from './labelmanagement';
import { RelativeLabelPosition } from './relativelabelposition';

/* spellchecker: enable */


/**
 * A penalty function evaluates the given placement settings (overlapping area, overlap count, the
 * relative position type and the priority). The returned value is expected to be lower for prefered
 * placement settings, and higher for placements considered unfavourable.
 */
export interface PenaltyFunction {
    (overlapCount: number, overlapArea: number, position: RelativeLabelPosition.Type, priority: number)
        : number;
}

/**
 * An interface to indicate what kind of change results from a adaptive placement algorithm. This can be
 * used to react accordingly.
 */
export interface PlacementChanged {
    visibility: boolean;
    positioning: boolean;
}

/**
 * This namespace can be extended with more penalty functions, allowing fine-tuning for different
 * use cases.
 */
export namespace PenaltyFunction {
    /**
     * This penalty function is used to evaluate possible placements for leaf labels on a treemap.
     * @param _overlapCount - ignored in this implementation
     * @param overlapArea - the size of the overlapping area
     * @param position - the relative position type (e.g., lower left)
     * @param priority - the priority of the current label, considered for hiding the label.
     */
    export let leafLabelsTreemap: PenaltyFunction =
        (_overlapCount: number, overlapArea: number, position: RelativeLabelPosition.Type,
            priority: number) => {

            let positionPenalty = 0;
            switch (position) {
                case RelativeLabelPosition.Type.UpperRight:
                    positionPenalty = 0 * priority;
                    break;
                case RelativeLabelPosition.Type.LowerRight:
                    positionPenalty = 1 * priority;
                    break;
                case RelativeLabelPosition.Type.UpperLeft:
                    positionPenalty = 1 * priority;
                    break;
                case RelativeLabelPosition.Type.LowerLeft:
                    positionPenalty = 3 * priority;
                    break;
                case RelativeLabelPosition.Type.Hidden:
                    positionPenalty = 60 * priority; // only avoid hiding labels when really necessary
                    break;
                default:
                    assert(false, `No valid relative position type, given ${position}`);
            }
            return 15.0 * overlapArea + 0.3 * positionPenalty;
        };
}

interface LabelCollision {
    index: number;
    position: number;
    overlapArea: number;
}

/** Stores relevant attributes for a possible label placement adaptation. */
export interface LabelPlacement {
    offset: vec2;
    alignment: Label.Alignment;
    lineAnchor: Label.LineAnchor;
    display: boolean;
}

/** Wrapper for a Projected3DLabel and other attributes for point-based label placement. */
export interface LeafLabel {
    label: Projected3DLabel;
    pointLocation: vec2; // reference point in NDC
    priority: number;
    placement: LabelPlacement;
}

/**
 * This offers algorithms for a point-based adaptive label placement based on openll/ll-opengl. It
 * adapts alignment, line anchor and visibility to avoid overlapping.
 */
export class AdaptiveLabelPlacement {

    /**
     * Returns the extent in normalized screen space for leaf labels (wrapping Projected3DLabel)
     * @param leafLabel - a leaf label for which the extent is returned.
     */
    protected static getNDCExtentForLeafLabel(leafLabel: LeafLabel, camera: Camera): vec2 {
        assert(camera.width !== 0 && camera.height !== 0,
            `camera viewport is invalid: ${camera.width} ${camera.height}`);

        const width = leafLabel.label.extent[0] / camera.width;
        const height = leafLabel.label.extent[1] / camera.height;

        return vec2.fromValues(width, height);
    }

    /**
     * Creates a LabelPlacement object for the given params
     * @param labelArea - the label area with relative label position
     * @param pointLocation - the reference point of the label in NDC
     */
    protected static placementFor(labelArea: LabelArea, pointLocation: vec2): LabelPlacement {
        const position = vec2.sub(v2(), labelArea.origin, pointLocation);
        let visible = true;
        let align = Label.Alignment.Left;
        let anchor = Label.LineAnchor.Bottom;

        switch (labelArea.position) {
            case RelativeLabelPosition.Type.UpperRight:
                // initial values apply
                break;
            case RelativeLabelPosition.Type.LowerRight:
                anchor = Label.LineAnchor.Top;
                break;
            case RelativeLabelPosition.Type.UpperLeft:
                align = Label.Alignment.Right;
                break;
            case RelativeLabelPosition.Type.LowerLeft:
                anchor = Label.LineAnchor.Top;
                align = Label.Alignment.Right;
                break;
            case RelativeLabelPosition.Type.Hidden:
                visible = false;
                break;
            default:
                assert(false, 'No valid type for relative label position, given' + position);
        }

        return {
            offset: position,
            alignment: align,
            lineAnchor: anchor,
            display: visible,
        };
    }

    /**
     * Computes a graph in which all overlaps between all possible label positions are stored. The graph
     * is returned as an adjacency matrix for quick lookup of all overlapping labels of a given placed
     * label.
     * @param labelAreas - all possible label areas that should be considered for this graph
     * @param relativePadding - applied to every label to calculate their padded overlapping area
     */
    protected static createCollisionGraph(labelAreas: LabelArea[][], relativePadding?: vec2)
        : LabelCollision[][][] {

        if (!relativePadding) {
            relativePadding = vec2.fromValues(1.0, 1.0);
        }

        const collisionGraph: LabelCollision[][][] = [];

        // Note: IE does not support Array.fill()
        for (let i = 0; i < labelAreas.length; i++) {
            collisionGraph.push([]);
            for (const _ of labelAreas[i]) {
                collisionGraph[i].push([]);
            }
        }

        const index1 = new Index2D();
        for (; !index1.end(labelAreas); index1.next(labelAreas)) {
            const collisionElement = index1.element(collisionGraph);
            const label1 = index1.element(labelAreas);
            const index2 = new Index2D();

            for (; !index2.end(labelAreas); index2.next(labelAreas)) {
                if (index1.outer === index2.outer) {
                    continue;
                }

                const label2 = index2.element(labelAreas);
                if (label1.paddedOverlaps(label2, relativePadding)) {
                    const area = label1.paddedOverlapArea(label2, relativePadding);

                    collisionElement.push({
                        index: index2.outer,
                        position: index2.inner,
                        overlapArea: area,
                    });

                    const l = index1.element(collisionGraph).length;
                    assert(l > 0, `Size expected to be greater than zero, given ${l.length}`);
                }
            }
        }
        return collisionGraph;
    }


    /**
     * Generates LabelArea objects for all possible label placements.
     * @param labels - all labels that should be considered
     * @param positions - all relative label positions that should be considered
     */
    protected static computeLabelAreas(labels: LeafLabel[], positions: RelativeLabelPosition.Type[],
        camera: Camera): LabelArea[][] {

        const result: LabelArea[][] = [];
        for (const leafLabel of labels) {
            result.push([]);
            const extent = this.getNDCExtentForLeafLabel(leafLabel, camera);

            for (const position of positions) {
                const origin = RelativeLabelPosition.labelOrigin(position,
                    leafLabel.pointLocation, extent);

                result[result.length - 1].push(new LabelArea(origin, extent, position));
            }
        }
        return result;
    }


    /**
     * Returns random int in range[0,max)
     * @param max - maximum int value, not included in range
     */
    protected static getRandomInt(max: number): number {
        return Math.floor(Math.random() * Math.floor(max));
    }

    /** Returns a random index in the range [0, size) which is different from the parameter except */
    protected static randomIndexExcept(except: number, size: number): number {
        const randomNumber = this.getRandomInt(size - 1);
        if (randomNumber === except) {
            return size - 1;
        }
        return randomNumber;
    }

    /**
     * Generates random starting areas.
     * @param labelAreas - label areas for which starting areas should be generated.
     */
    protected static randomStartLabelAreas(labelAreas: LabelArea[][]): number[] {
        const result: number[] = [];

        for (const singleLabelAreas of labelAreas) {
            result.push(this.getRandomInt(singleLabelAreas.length));
        }
        return result;
    }

    protected static computePenalty(labelArea: LabelArea, collisions: LabelCollision[],
        priority: number, penaltyFunction: PenaltyFunction, chosenLabels: number[]): number {

        if (labelArea.extent[0] === 0 || labelArea.extent[1] === 0) {
            // extent is still zero, i.e., label has not been typeset yet.
            return 0;
        }

        let overlapArea = 0.0;
        let overlapCount = 0;
        for (const collision of collisions) {
            if (chosenLabels[collision.index] !== collision.position) {
                continue;
            }
            overlapArea += collision.overlapArea;
            ++overlapCount;
        }
        overlapArea /= labelArea.area();
        return penaltyFunction(overlapCount, overlapArea, labelArea.position, priority);
    }

    /**
     * Algorithm for label placement avoiding overlaps, based on
     * https://www.eecs.harvard.edu/shieber/Biblio/Papers/tog-final.pdf
     * @param labels - the labels which should be considered for placement - non-sparse!
     * @param penaltyFunction - used to calculate measure how adequate a placement is
     * @param relativePadding - applied to every label to calculate their padded area
     */
    protected static simulatedAnnealing(labels: LeafLabel[], penaltyFunction: PenaltyFunction,
        relativePadding: vec2, camera: Camera): void {

        const positions: RelativeLabelPosition.Type[] = [
            RelativeLabelPosition.Type.UpperRight, RelativeLabelPosition.Type.UpperLeft,
            RelativeLabelPosition.Type.LowerLeft, RelativeLabelPosition.Type.LowerRight,
            RelativeLabelPosition.Type.Hidden];

        const labelAreas: LabelArea[][] = this.computeLabelAreas(labels, positions, camera);
        const chosenLabels: number[] = this.randomStartLabelAreas(labelAreas);
        const collisionGraph = this.createCollisionGraph(labelAreas, relativePadding);


        // annealing schedule parameters (taken from original paper)
        const startingTemperature = 0.91023922662;
        const maxTemperatureChanges = 50;
        const temperatureDecreaseFactor = 0.9;
        const maxChangesAtTemperature = 5 * labels.length;
        const maxStepsAtTemperature = 20 * labels.length;

        let temperature = startingTemperature;
        let temperatureChanges = 0;
        let changesAtTemperature = 0;
        let stepsAtTemperature = 0;

        while (true) {
            // generate a random change
            const labelIndex = this.getRandomInt(labels.length);
            const oldPosition = chosenLabels[labelIndex];
            const newPosition = this.randomIndexExcept(oldPosition, labelAreas[labelIndex].length);

            const oldPenalty = this.computePenalty(
                labelAreas[labelIndex][oldPosition],
                collisionGraph[labelIndex][oldPosition],
                labels[labelIndex].priority, penaltyFunction, chosenLabels);

            const newPenalty = this.computePenalty(
                labelAreas[labelIndex][newPosition],
                collisionGraph[labelIndex][newPosition],
                labels[labelIndex].priority, penaltyFunction, chosenLabels);

            const improvement = oldPenalty - newPenalty;

            // change is accepted, either (1) if it is an improvement or (2) according to a probability
            // computed from the temperature and how much worse it is
            const chance = Math.exp(improvement / temperature);
            // clamp to a valid value for our simple-implemented bernoulli distribution
            const clampedChance = Math.max(0.0, Math.min(chance, 1.0));
            // bernoulli_distribution: return true for "clampedChance" propability
            // return false for "1-clampedChance" propability
            const doAnyway = Math.random() < clampedChance ? true : false;

            if (improvement > 0 || doAnyway) {
                chosenLabels[labelIndex] = newPosition;
                ++changesAtTemperature;
            }

            // advance annealing schedule
            ++stepsAtTemperature;
            if (changesAtTemperature > maxChangesAtTemperature
                || stepsAtTemperature > maxStepsAtTemperature) {
                // converged
                if (changesAtTemperature === 0 || temperatureChanges === maxTemperatureChanges) {
                    break;
                }

                temperature *= temperatureDecreaseFactor;
                changesAtTemperature = 0;
                stepsAtTemperature = 0;
                ++temperatureChanges;
            }
        }

        for (let i = 0; i < labels.length; ++i) {
            labels[i].placement =
                this.placementFor(labelAreas[i][chosenLabels[i]], labels[i].pointLocation);
        }
    }

    /**
     * Greedy algorithm for label placement avoiding overlaps.
     * @param labels - the labels which should be considered for placement
     * @param penaltyFunction - used to calculate measure how adequate a placement is
     * @param relativePadding - applied to every label to calculate their padded area
     * @param camera - the current camera
     */
    protected static greedy(labels: LeafLabel[], penaltyFunction: PenaltyFunction,
        relativePadding: vec2, camera: Camera): void {

        const labelAreas: LabelArea[] = [];
        const relPositions: RelativeLabelPosition.Type[] = [
            RelativeLabelPosition.Type.UpperRight, RelativeLabelPosition.Type.UpperLeft,
            RelativeLabelPosition.Type.LowerLeft, RelativeLabelPosition.Type.LowerRight,
            RelativeLabelPosition.Type.Hidden];

        for (const leafLabel of labels) {
            const extent = this.getNDCExtentForLeafLabel(leafLabel, camera);
            let bestPenalty = Number.POSITIVE_INFINITY;

            let bestLabelArea =
                new LabelArea(vec2.create(), vec2.create(), RelativeLabelPosition.Type.LowerLeft);

            // find best position for new label
            for (const relPos of relPositions) {
                const origin = RelativeLabelPosition.labelOrigin(relPos, leafLabel.pointLocation,
                    extent);
                const newLabelArea = new LabelArea(origin, extent, relPos);
                let overlapArea = 0.0;
                let overlapCount = 0;

                for (const other of labelAreas) {
                    overlapArea += newLabelArea.paddedOverlapArea(other, relativePadding);
                    overlapCount += newLabelArea.paddedOverlaps(other, relativePadding) ? 1 : 0;
                }

                overlapArea /= newLabelArea.area();

                const penalty = penaltyFunction(overlapCount, overlapArea, relPos, leafLabel.priority);
                if (penalty < bestPenalty) {
                    bestPenalty = penalty;
                    bestLabelArea = newLabelArea;
                }
            }

            leafLabel.placement = this.placementFor(bestLabelArea, leafLabel.pointLocation);
            labelAreas.push(bestLabelArea);
        }
    }

    /**
     * Wraps all Projected3DLabels into LeafLabels, setting priority, position in screen space and other
     * placement-related attributes.
     * @param labels - all labels that should be wrapped
     * @param camera - the current camera to calculate the labels' positions in screen space.
     */
    protected static prepareLeafLabels(labels: Projected3DLabel[], camera: Camera): LeafLabel[] {
        const leafLabels: LeafLabel[] = [];

        labels.forEach((leafLabel, index) => {
            if (!leafLabel) {
                return;
            }

            const anchor = vec4.fromValues(
                leafLabel.position[0], leafLabel.position[1], leafLabel.position[2], 1);
            vec4.transformMat4(anchor, anchor, camera.viewProjection);

            // perspective transformation: homogeneous coordiates to get actual screen position
            const w = anchor[3];
            const screenPosition = vec2.fromValues(anchor[0] / w, anchor[1] / w);

            // As priority, we choose the height of the label position, since the height of the code
            // unit (that is labeled) maps to a metric value: the higher, the more important.
            // The algorithm expects a priority in range [1, 10]. Since the height tends to be in
            // range [0, 1], we transform.
            leafLabels.push({
                label: leafLabel,
                pointLocation: screenPosition,
                priority: (leafLabel.position[1] * 9.0 + 1.0) + 10*(index+1)/(labels.length),
                placement: {
                    offset: vec2.create(),
                    alignment: leafLabel.alignment,
                    lineAnchor: leafLabel.lineAnchor,
                    display: true,
                },
            });
        });

        return leafLabels;
    }

    /**
     * Applies new placement to the original labels, which are wrapped in leaf labels by reference, so
     * no copying is required. Note: placement.offset is ignored for now.
     * @param leafLabels - leaf labels with adapted placements
     * @returns an object to indicate if visibility and/or positioning has changes.
     */
    protected static applyNewPlacements(leafLabels: LeafLabel[]): PlacementChanged {
        let visibilityChanged = false;
        let positioningChanged = false;
        for (const leafLabel of leafLabels) {

            // detect changes in alignment and line anchor
            const alignmentChanged = leafLabel.label.alignment !== leafLabel.placement.alignment;
            const lineAnchorChanged = leafLabel.label.lineAnchor !== leafLabel.placement.lineAnchor;

            // all those values are only updated when they are actually different from the current value
            leafLabel.label.alignment = leafLabel.placement.alignment;
            leafLabel.label.lineAnchor = leafLabel.placement.lineAnchor;
            const alpha = leafLabel.placement.display ? LabelManagement.leafLabelColor[3] : 0.0;
            leafLabel.label.color.fromRGB(
                leafLabel.label.color.r, leafLabel.label.color.g, leafLabel.label.color.b, alpha);

            visibilityChanged = visibilityChanged ? true : leafLabel.label.color.altered;
            positioningChanged = positioningChanged ? true : alignmentChanged || lineAnchorChanged;

        }
        return { visibility: visibilityChanged, positioning: positioningChanged };
    }

    /**
     * This is the greedy version of {@link adaptPositionToPreventOverlapSimulatedAnnealing}.
     * @param labels - all labels that should be considered
     * @param camera - the current camera to detect overlapping in screen space
     * @returns an object to indicate if visibility and/or positioning has changes.
     */
    public static adaptPositionToPreventOverlapGreedy(labels: Projected3DLabel[], camera: Camera)
        : PlacementChanged {

        const leafLabels = this.prepareLeafLabels(labels, camera);

        // The greedy algorithm is order-dependent: First come, first serve, so sort by priority. This
        // is only feasible because usually we don't have so many leaf labels (around 3 - 9).
        leafLabels.sort((a: LeafLabel, b: LeafLabel) => b.priority - a.priority);

        const relativePadding = vec2.fromValues(1.0, 1.0);
        this.greedy(leafLabels, PenaltyFunction.leafLabelsTreemap, relativePadding, camera);

        return this.applyNewPlacements(leafLabels);
    }

    /**
     * Adapts alignment and line anchor of leaf labels to avoid overlaps. In some rare cases, it hides a
     * label by setting its color's alpha to zero. NOTE: it is assumed that the labels' direction is
     * horizontal, i.e. [1, 0].
     * This uses the approach "simulated annealing", based on
     * https://www.eecs.harvard.edu/shieber/Biblio/Papers/tog-final.pdf
     * @param labels - all labels that should be considered
     * @param camera - the current camera to detect overlapping in screen space
     * @returns an object to indicate if visibility and/or positioning has changes.
     */
    public static adaptPositionToPreventOverlapSimulatedAnnealing(labels: Projected3DLabel[],
        camera: Camera): PlacementChanged {

        const leafLabels = this.prepareLeafLabels(labels, camera);

        const relativePadding = vec2.fromValues(1.0, 1.0);
        this.simulatedAnnealing(leafLabels, PenaltyFunction.leafLabelsTreemap, relativePadding, camera);

        return this.applyNewPlacements(leafLabels);
    }
}
