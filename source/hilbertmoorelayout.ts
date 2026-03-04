
/* spellchecker: disable */

// import { auxiliaries } from 'webgl-operate';
// const assert = auxiliaries.assert;

import { Configuration } from './configuration';
import { LayoutCallbacks } from './layout';
import { Node } from './node';
import { Rect } from './rect';
import { Topology } from './topology';

/* spellchecker: enable */


// ############################ 1 elem  ########################

class DoNothing {
    static readonly PARTS: number = 1;

    static dissect(weights: Array<number>, rect: Rect): Array<Rect> {
        if (weights.length !== DoNothing.PARTS) {
            throw new Error(`Expected ${DoNothing.PARTS} weights, got ${weights.length}`);
        }

        return [rect];
    }
};

// ############################ 2 elems ########################

class SnakeM2 {
    static readonly PARTS: number = 2;

    static dissect(weights: Array<number>, rect: Rect): Array<Rect> {
        if (weights.length !== SnakeM2.PARTS) {
            throw new Error(`Expected ${SnakeM2.PARTS} weights, got ${weights.length}`);
        }

        const [left, right] = rect.horizontalSplit(weights[0] / (weights[0] + weights[1]));

        left.rotate(Rect.Rotation.R090);
        // left.setCurveDirection(Rect.CurveOrientation.CW);
        right.rotate(Rect.Rotation.R270);
        // right.setCurveDirection(Rect.CurveOrientation.CW);

        return [left, right];
    }
};

class SnakeH2 {
    static readonly PARTS: number = 2;

    static dissect(weights: number[], rect: Rect): Rect[] {
        if (weights.length !== SnakeH2.PARTS) {
            throw new Error(`Expected ${SnakeH2.PARTS} weights, got ${weights.length}`);
        }

        const ratio = weights[0] / (weights[0] + weights[1]);
        const [left, right] = rect.horizontalSplit(ratio);

        // left.rotate(Rect.Rotation.R000);
        // left.setCurveDirection(Rect.CurveOrientation.CW);
        // right.rotate(Rect.Rotation.R000);
        // right.setCurveDirection(Rect.CurveOrientation.CW);

        return [left, right];
    }
}

// ############################ 3 elems ########################

// hilbert CD, CD, CD
// no moore
class Snake3 {
    static readonly PARTS = 3;

    static dissect(weights: number[], rect: Rect): Rect[] {
        if (weights.length !== Snake3.PARTS) {
            throw new Error(`Expected ${Snake3.PARTS} weights, got ${weights.length}`);
        }

        const [left, temp] = rect.horizontalSplit(weights[0] / (weights[0] + weights[1] + weights[2]));
        const [mid, right] = temp.horizontalSplit(weights[1] / (weights[1] + weights[2]));

        // left.rotate(Rect.Rotation.R000);
        // left.setCurveDirection(Rect.CurveOrientation.CW);
        // mid.rotate(Rect.Rotation.R000);
        // mid.setCurveDirection(Rect.CurveOrientation.CW);
        // right.rotate(Rect.Rotation.R000);
        // right.setCurveDirection(Rect.CurveOrientation.CW);

        return [left, mid, right];
    }
}

// no hilbert
// moore DB, AC, AC
class Most13 {
    static readonly PARTS = 3;

    static dissect(weights: number[], rect: Rect): Rect[] {
        if (weights.length !== Most13.PARTS) {
            throw new Error(`Expected ${Most13.PARTS} weights, got ${weights.length}`);
        }

        const total = weights[0] + weights[1] + weights[2];
        const [left, temp] = rect.horizontalSplit(weights[0] / total);

        const rightTotal = weights[1] + weights[2];
        const [bottomRight, topRight] =
            temp.verticalSplit(weights[2] / rightTotal);

        left.rotate(Rect.Rotation.R090);
        // left.setCurveDirection(Rect.CurveOrientation.CW);
        topRight.rotate(Rect.Rotation.R270);
        // topRight.setCurveDirection(Rect.CurveOrientation.CW);
        bottomRight.rotate(Rect.Rotation.R270);
        // bottomRight.setCurveDirection(Rect.CurveOrientation.CW);

        return [left, topRight, bottomRight];
    }
}

// hilbert CA, CD, BD
// no moore
class Most23 {
    static readonly PARTS = 3;

    static dissect(weights: number[], rect: Rect): Rect[] {
        if (weights.length !== Most23.PARTS) {
            throw new Error(`Expected ${Most23.PARTS} weights, got ${weights.length}`);
        }

        const total = weights[0] + weights[1] + weights[2];
        const [temp, top] =
            rect.verticalSplit((weights[0] + weights[2]) / total);

        const bottomTotal = weights[0] + weights[2];
        const [bottomLeft, bottomRight] =
            temp.horizontalSplit(weights[0] / bottomTotal);

        bottomLeft.rotate(Rect.Rotation.R270);
        bottomLeft.setCurveDirection(Rect.CurveOrientation.CCW);
        // top.rotate(Rect.Rotation.R000);
        // top.setCurveDirection(Rect.CurveOrientation.CW);
        bottomRight.rotate(Rect.Rotation.R090);
        bottomRight.setCurveDirection(Rect.CurveOrientation.CCW);

        return [bottomLeft, top, bottomRight];
    }
}

// no hilbert
// moore DB, DB, AC
class Most33 {
    static readonly PARTS = 3;

    static dissect(weights: number[], rect: Rect): Rect[] {
        if (weights.length !== Most33.PARTS) {
            throw new Error(`Expected ${Most33.PARTS} weights, got ${weights.length}`);
        }

        const total = weights[0] + weights[1] + weights[2];
        const [temp, right] =
            rect.horizontalSplit((weights[0] + weights[1]) / total);

        const leftTotal = weights[0] + weights[1];
        const [bottomLeft, topLeft] =
            temp.verticalSplit(weights[0] / leftTotal);

        bottomLeft.rotate(Rect.Rotation.R090);
        // bottomLeft.setCurveDirection(Rect.CurveOrientation.CW);
        topLeft.rotate(Rect.Rotation.R090);
        // topLeft.setCurveDirection(Rect.CurveOrientation.CW);
        right.rotate(Rect.Rotation.R270);
        // right.setCurveDirection(Rect.CurveOrientation.CW);

        return [bottomLeft, topLeft, right];
    }
}

// ############################ 4 elems ########################

// hilbert CD, CD, CD, CD
// moore ?
class Snake4 {
    static readonly PARTS = 4;

    static dissect(weights: number[], rect: Rect): Rect[] {
        if (weights.length !== Snake4.PARTS) {
            throw new Error(`Expected ${Snake4.PARTS} weights, got ${weights.length}`);
        }

        const leftSum = weights[0] + weights[1];
        const rightSum = weights[2] + weights[3];

        const [tempLeft, tempRight] =
            rect.horizontalSplit(leftSum / (leftSum + rightSum));

        const result: Rect[] = new Array(4);

        [result[0], result[1]] =
            tempLeft.horizontalSplit(weights[0] / leftSum);

        [result[2], result[3]] =
            tempRight.horizontalSplit(weights[2] / rightSum);

        // result[0].rotate(Rect.Rotation.R000);
        // result[0].setCurveDirection(Rect.CurveOrientation.CW);
        // result[1].rotate(Rect.Rotation.R000);
        // result[1].setCurveDirection(Rect.CurveOrientation.CW);
        // result[2].rotate(Rect.Rotation.R000);
        // result[2].setCurveDirection(Rect.CurveOrientation.CW);
        // result[3].rotate(Rect.Rotation.R000);
        // result[3].setCurveDirection(Rect.CurveOrientation.CW);

        return result;
    }
}

// hilbert ?
// moore DB, AC, AC, AC
class Most14 {
    static readonly PARTS = 4;

    static dissect(weights: number[], rect: Rect): Rect[] {
        if (weights.length !== Most14.PARTS) {
            throw new Error(`Expected ${Most14.PARTS} weights, got ${weights.length}`);
        }

        const result: Rect[] = new Array(4);
        const temps: Rect[] = new Array(2);

        const leftSum = weights[0] + weights[1];
        const rightSum = weights[2] + weights[3];

        [result[0], temps[0]] =
            rect.horizontalSplit(weights[0] / (leftSum + rightSum));

        [temps[1], result[1]] =
            temps[0].verticalSplit(
                (weights[2] + weights[3]) / (weights[1] + weights[2] + weights[3])
            );

        [result[3], result[2]] =
            temps[1].verticalSplit(weights[3] / (weights[2] + weights[3]));

        result[0].rotate(Rect.Rotation.R090);
        // result[0].setCurveDirection(Rect.CurveOrientation.CW);
        result[1].rotate(Rect.Rotation.R270);
        // result[1].setCurveDirection(Rect.CurveOrientation.CW);
        result[2].rotate(Rect.Rotation.R270);
        // result[2].setCurveDirection(Rect.CurveOrientation.CW);
        result[3].rotate(Rect.Rotation.R270);
        // result[3].setCurveDirection(Rect.CurveOrientation.CW);

        return result;
    }
}


// hilbert CA, CD, BD, BD
// moore ?
class Most24 {
    static readonly PARTS = 4;

    static dissect(weights: number[], rect: Rect): Rect[] {
        if (weights.length !== Most24.PARTS) {
            throw new Error(`Expected ${Most24.PARTS} weights, got ${weights.length}`);
        }

        const result: Rect[] = new Array(4);
        const temps: Rect[] = new Array(2);

        const leftSum = weights[0] + weights[1];
        const rightSum = weights[2] + weights[3];

        [temps[0], result[1]] =
            rect.verticalSplit(
                (weights[0] + weights[2] + weights[3]) / (leftSum + rightSum)
            );

        [result[0], temps[1]] =
            temps[0].horizontalSplit(
                weights[0] / (weights[0] + weights[2] + weights[3])
            );

        [result[3], result[2]] =
            temps[1].verticalSplit(weights[3] / (weights[2] + weights[3]));

        result[0].rotate(Rect.Rotation.R270);
        result[0].setCurveDirection(Rect.CurveOrientation.CCW);
        // result[1].rotate(Rect.Rotation.R000);
        // result[1].setCurveDirection(Rect.CurveOrientation.CW);
        result[2].rotate(Rect.Rotation.R090);
        result[2].setCurveDirection(Rect.CurveOrientation.CCW);
        result[3].rotate(Rect.Rotation.R090);
        result[3].setCurveDirection(Rect.CurveOrientation.CCW);

        return result;
    }
}

// hilbert CA, CA, CD, BD
// moore ?
class Most34 {
    static readonly PARTS = 4;

    static dissect(weights: number[], rect: Rect): Rect[] {
        if (weights.length !== Most34.PARTS) {
            throw new Error(`Expected ${Most34.PARTS} weights, got ${weights.length}`);
        }

        const result: Rect[] = new Array(4);
        const temps: Rect[] = new Array(2);

        const leftSum = weights[0] + weights[1];
        const rightSum = weights[2] + weights[3];

        [temps[0], result[2]] =
            rect.verticalSplit(
                (weights[0] + weights[1] + weights[3]) / (leftSum + rightSum)
            );

        [temps[1], result[3]] =
            temps[0].horizontalSplit(
                (weights[0] + weights[1]) / (weights[0] + weights[1] + weights[3])
            );

        [result[0], result[1]] =
            temps[1].verticalSplit(weights[0] / (weights[0] + weights[1]));

        result[0].rotate(Rect.Rotation.R270);
        result[0].setCurveDirection(Rect.CurveOrientation.CCW);
        result[1].rotate(Rect.Rotation.R270);
        result[1].setCurveDirection(Rect.CurveOrientation.CCW);
        // result[2].rotate(Rect.Rotation.R000);
        // result[2].setCurveDirection(Rect.CurveOrientation.CW);
        result[3].rotate(Rect.Rotation.R090);
        result[3].setCurveDirection(Rect.CurveOrientation.CCW);

        return result;
    }
}

// hilbert ?
// moore DB, DB, DB, AC
class Most44 {
    static readonly PARTS = 4;

    static dissect(weights: number[], rect: Rect): Rect[] {
        if (weights.length !== Most44.PARTS) {
            throw new Error(`Expected ${Most44.PARTS} weights, got ${weights.length}`);
        }

        const result: Rect[] = new Array(4);
        const temps: Rect[] = new Array(2);

        const leftSum = weights[0] + weights[1];
        const rightSum = weights[2] + weights[3];

        [temps[0], result[3]] =
            rect.horizontalSplit(
                (weights[0] + weights[1] + weights[2]) / (leftSum + rightSum)
            );

        [temps[1], result[2]] =
            temps[0].verticalSplit(
                (weights[0] + weights[1]) / (weights[0] + weights[1] + weights[2])
            );

        [result[0], result[1]] =
            temps[1].verticalSplit(weights[0] / (weights[0] + weights[1]));

        result[0].rotate(Rect.Rotation.R090);
        // result[0].setCurveDirection(Rect.CurveOrientation.CW);
        result[1].rotate(Rect.Rotation.R090);
        // result[1].setCurveDirection(Rect.CurveOrientation.CW);
        result[2].rotate(Rect.Rotation.R090);
        // result[2].setCurveDirection(Rect.CurveOrientation.CW);
        result[3].rotate(Rect.Rotation.R270);
        // result[3].setCurveDirection(Rect.CurveOrientation.CW);

        return result;
    }
}

// hilbert CA, CD, CD, BD
// moore ?
class Horizontal4 {
    static readonly PARTS = 4;

    static dissect(weights: number[], rect: Rect): Rect[] {
        if (weights.length !== Horizontal4.PARTS) {
            throw new Error(`Expected ${Horizontal4.PARTS} weights, got ${weights.length}`);
        }

        const result: Rect[] = new Array(4);
        const temps: Rect[] = new Array(2);

        const topSum = weights[1] + weights[2];
        const bottomSum = weights[0] + weights[3];

        [temps[0], temps[1]] =
            rect.verticalSplit(bottomSum / (bottomSum + topSum));

        [result[0], result[3]] =
            temps[0].horizontalSplit(weights[0] / bottomSum);

        [result[1], result[2]] =
            temps[1].horizontalSplit(weights[1] / topSum);

        result[0].rotate(Rect.Rotation.R270);
        result[0].setCurveDirection(Rect.CurveOrientation.CCW);
        // result[1].rotate(Rect.Rotation.R000);
        // result[1].setCurveDirection(Rect.CurveOrientation.CW);
        // result[2].rotate(Rect.Rotation.R000);
        // result[2].setCurveDirection(Rect.CurveOrientation.CW);
        result[3].rotate(Rect.Rotation.R090);
        result[3].setCurveDirection(Rect.CurveOrientation.CCW);

        return result;
    }
}

// hilbert ?
// moore DB, AC, DB, AC
class Vertical4 {
    static readonly PARTS = 4;

    static dissect(weights: number[], rect: Rect): Rect[] {
        if (weights.length !== Vertical4.PARTS) {
            throw new Error(`Expected ${Vertical4.PARTS} weights, got ${weights.length}`);
        }

        const result: Rect[] = new Array(4);
        const temps: Rect[] = new Array(2);

        const leftSum = weights[0] + weights[1];
        const rightSum = weights[2] + weights[3];

        [temps[0], temps[1]] =
            rect.horizontalSplit(leftSum / (leftSum + rightSum));

        [result[0], result[1]] =
            temps[0].verticalSplit(weights[0] / leftSum);

        [result[3], result[2]] =
            temps[1].verticalSplit(weights[3] / rightSum);

        result[0].rotate(Rect.Rotation.R090);
        // result[0].setCurveDirection(Rect.CurveOrientation.CW);
        result[1].rotate(Rect.Rotation.R090);
        // result[1].setCurveDirection(Rect.CurveOrientation.CW);
        result[2].rotate(Rect.Rotation.R270);
        // result[2].setCurveDirection(Rect.CurveOrientation.CW);
        result[3].rotate(Rect.Rotation.R270);
        // result[3].setCurveDirection(Rect.CurveOrientation.CW);

        return result;
    }
}

function avgAspectRatio(rects: Rect[]): number {
    if (rects.length === 0) {
        return Number.POSITIVE_INFINITY;
    }

    let sum = 0;

    for (const rect of rects) {
        const shorter = rect.shorterSide;
        const longer = rect.longerSide;
        const ratio = shorter > 0 ? longer / shorter : Number.POSITIVE_INFINITY;
        if (!Number.isFinite(ratio) || ratio <= 0) {
            return Number.POSITIVE_INFINITY;
        }
        sum += ratio;
    }

    if (!Number.isFinite(sum) || sum <= 0) {
        return Number.POSITIVE_INFINITY;
    }

    return sum / rects.length;
}

class Dissector {
    /**
     * Picks the layout whose average aspect ratio is closest to targetAR
     * @param weights Array of weights
     * @param rect Base rectangle
     * @param targetAR Desired aspect ratio
     * @param patterns Array of pattern classes (each must have PARTS and dissect method)
     */
    static dissectWithBestAR(
        weights: number[],
        rect: Rect,
        targetAR: number,
        patterns: Array<{ PARTS: number; dissect: (weights: number[], rect: Rect) => Rect[] }>
    ): Rect[] {
        if (patterns.length === 0) {
            throw new Error("At least one pattern must be provided");
        }

        let bestLayout: Rect[] | null = null;
        let bestDiff = Infinity;

        for (const pattern of patterns) {
            if (weights.length !== pattern.PARTS) {
                throw new Error(
                    `Expected ${pattern.PARTS} weights for pattern, got ${weights.length}`
                );
            }

            let layout: Rect[];
            try {
                layout = pattern.dissect(weights, rect);
            } catch (_e) {
                continue;
            }
            const diff = Math.abs(avgAspectRatio(layout) - targetAR);

            if (Number.isFinite(diff) && diff < bestDiff) {
                bestDiff = diff;
                bestLayout = layout;
            }
        }

        if (!bestLayout) {
            bestLayout = patterns[0].dissect(weights, rect);
        }

        return bestLayout;
    }
}


enum CurveType {
    None,
    Hilbert,
    Moore
};

enum DistributionAlgorithm {
    Greedy,
    MinMax,
    MinVariance,
}

// define Dissector 1-4

const DissectorPatterns = {
    1: {
        [CurveType.None]: [DoNothing],
        [CurveType.Hilbert]: [DoNothing],
        [CurveType.Moore]: [DoNothing],
    },
    2: {
        [CurveType.None]: [SnakeH2, SnakeM2],
        [CurveType.Hilbert]: [SnakeH2],
        [CurveType.Moore]: [SnakeM2],
    },
    3: {
        [CurveType.None]: [Snake3, Most13, Most23, Most33],
        [CurveType.Hilbert]: [Snake3, Most23],
        [CurveType.Moore]: [Most13, Most33],
    },
    4: {
        [CurveType.None]: [Snake4, Most14, Most24, Most34, Most44, Horizontal4, Vertical4],
        [CurveType.Hilbert]: [Snake4, Most24, Most34, Horizontal4],
        [CurveType.Moore]: [Most14, Most44, Vertical4],
    },
};


function layoutItems(
    weights: number[],
    rect: Rect,
    targetAR: number,
    orientation: CurveType
): Rect[] {
    if (weights.length < 1 || weights.length > 4) {
        throw new Error("weights array must have 1 to 4 elements");
    }

    switch (weights.length) {
        case 1:
            return Dissector.dissectWithBestAR(weights, rect, targetAR, DissectorPatterns[1][orientation]);
        case 2:
            return Dissector.dissectWithBestAR(weights, rect, targetAR, DissectorPatterns[2][orientation]);
        case 3:
            return Dissector.dissectWithBestAR(weights, rect, targetAR, DissectorPatterns[3][orientation]);
        case 4:
            return Dissector.dissectWithBestAR(weights, rect, targetAR, DissectorPatterns[4][orientation]);
        default:
            // This should never happen due to the first check
            throw new Error("Invalid number of weights");
    }
}

function buildPrefixSums(weights: Configuration.AttributeBuffer): number[] {
    const prefixSums = new Array<number>(weights.length + 1);
    prefixSums[0] = 0.0;

    for (let i = 0; i < weights.length; ++i) {
        prefixSums[i + 1] = prefixSums[i] + weights[i];
    }

    return prefixSums;
}

function sumRangeFromPrefix(prefixSums: number[], first: number, last: number): number {
    return prefixSums[last] - prefixSums[first];
}

function upperBound(values: number[], value: number, begin: number, end: number): number {
    let low = begin;
    let high = end;

    while (low < high) {
        const mid = low + Math.floor((high - low) * 0.5);
        if (values[mid] <= value) {
            low = mid + 1;
        } else {
            high = mid;
        }
    }

    return low;
}

function partitionGreedy(
    range: { first: number; last: number },
    weights: Configuration.AttributeBuffer
): { first: number; last: number }[] {
    const size = range.last - range.first;

    if (size <= 1) {
        return [range];
    }

    if (size <= 4) {
        const groups: { first: number; last: number }[] = [];
        for (let i = range.first; i < range.last; ++i) {
            groups.push({ first: i, last: i + 1 });
        }
        return groups;
    }

    let total = 0.0;
    for (let i = range.first; i < range.last; ++i) {
        total += weights[i];
    }
    const optimal = total / 4.0;

    let last = 0;
    let sum = weights[range.first + 0];
    const cuts: { first: number; last: number }[] = [];

    for (let current = 1; current < size && cuts.length < 3; ++current) {
        if (size - current === 4 - cuts.length - 1) {
            cuts.push({
                first: range.first + last,
                last: range.first + current,
            });
            last = current;
            continue;
        }

        const weight = weights[range.first + current];
        if (Math.abs(sum - optimal) > Math.abs(sum + weight - optimal)) {
            sum += weight;
        } else {
            sum = weight;
            cuts.push({
                first: range.first + last,
                last: range.first + current,
            });
            last = current;
        }
    }

    cuts.push({ first: range.first + last, last: range.last });

    return cuts;
}

function partitionMinMax(
    range: { first: number; last: number },
    weights: Configuration.AttributeBuffer,
    prefixSums: number[]
): { first: number; last: number }[] {
    const size = range.last - range.first;

    if (size <= 1) {
        return [range];
    }

    if (size <= 4) {
        const groups: { first: number; last: number }[] = [];
        for (let i = range.first; i < range.last; ++i) {
            groups.push({ first: i, last: i + 1 });
        }
        return groups;
    }

    const numberOfCuts = 4;
    const threshold = 1.0;

    const localPrefix = new Array<number>(size);
    let runningSum = 0.0;
    for (let i = 0; i < size; ++i) {
        runningSum += weights[range.first + i];
        localPrefix[i] = runningSum;
    }

    const total = localPrefix[localPrefix.length - 1];
    let cuts: { first: number; last: number }[] = [];

    const evalCuts = (partLimit: number): boolean => {
        cuts = [];
        let currentBegin = 0;

        for (let i = 0; i < numberOfCuts && currentBegin < localPrefix.length; ++i) {
            const base = currentBegin > 0 ? localPrefix[currentBegin - 1] : 0.0;
            let currentEnd = upperBound(
                localPrefix, partLimit + base, currentBegin, localPrefix.length);

            // Avoid empty partitions when a single weight exceeds partLimit.
            if (currentEnd <= currentBegin) {
                currentEnd = currentBegin + 1;
            }

            cuts.push({
                first: range.first + currentBegin,
                last: range.first + currentEnd,
            });
            currentBegin = currentEnd;
        }

        return currentBegin === localPrefix.length;
    };

    let low = total / numberOfCuts - threshold;
    let high = total;
    let bestCuts: { first: number; last: number }[] = [];

    if (!evalCuts(high)) {
        return partitionGreedy(range, weights);
    }
    bestCuts = cuts.map((cut) => ({ ...cut }));

    while (high - low > threshold) {
        const mid = (high + low) * 0.5;

        if (evalCuts(mid)) {
            high = mid;
            bestCuts = cuts.map((cut) => ({ ...cut }));
        } else {
            low = mid;
        }
    }

    return bestCuts;
}

function partitionVariance(
    range: { first: number; last: number },
    weights: Configuration.AttributeBuffer,
    prefixSums: number[]
): { first: number; last: number }[] {
    const size = range.last - range.first;
    if (size <= 1) {
        return [range];
    }

    if (size <= 4) {
        const groups: { first: number; last: number }[] = [];
        for (let i = range.first; i < range.last; ++i) {
            groups.push({ first: i, last: i + 1 });
        }
        return groups;
    }

    const n = size;
    const prefix = new Array<number>(n + 1);
    prefix[0] = 0.0;
    for (let i = 0; i < n; ++i) {
        prefix[i + 1] = prefix[i] + weights[range.first + i];
    }

    const mean = prefix[n] / 4.0;
    const diff = (begin: number, cut: number, end: number): number => {
        return Math.abs(prefix[cut] - (prefix[end] + prefix[begin]) * 0.5);
    };

    let best = Number.POSITIVE_INFINITY;
    let cuts: { first: number; last: number }[] = [range];

    for (let left = 1, middle = 2, right = 3; middle < n - 1; ++middle) {
        if (left >= middle) {
            left = middle - 1;
        }
        while (left + 1 < middle && diff(0, left + 1, middle) < diff(0, left, middle)) {
            left += 1;
        }

        if (right <= middle) {
            right = middle + 1;
        }
        while (right + 1 < n && diff(middle, right + 1, n) < diff(middle, right, n)) {
            right += 1;
        }

        if (!(0 < left && left < middle && middle < right && right < n)) {
            continue;
        }

        const s0 = prefix[left] - prefix[0] - mean;
        const s1 = prefix[middle] - prefix[left] - mean;
        const s2 = prefix[right] - prefix[middle] - mean;
        const s3 = prefix[n] - prefix[right] - mean;
        const current = s0 * s0 + s1 * s1 + s2 * s2 + s3 * s3;

        if (current < best) {
            best = current;
            cuts = [
                { first: range.first, last: range.first + left },
                { first: range.first + left, last: range.first + middle },
                { first: range.first + middle, last: range.first + right },
                { first: range.first + right, last: range.last },
            ];
        }
    }

    return cuts.length === 4 ? cuts : partitionMinMax(range, weights, prefixSums);
}


function layoutRecursively(
    rect: Rect,
    weights: Configuration.AttributeBuffer,
    prefixSums: number[],
    layout: Rect[],
    range: { first: number; last: number },
    useMoore: boolean,
    alg: DistributionAlgorithm,
    useOrientation: boolean,
    targetAR: number
) {
    const size = range.last - range.first;
    if (size <= 0) throw new Error("Range must have positive size");

    // Base case: only one element
    if (size === 1) {
        layout[range.first] = rect;
        return;
    }

    // Small sizes ≤ 4 → use layoutItems
    if (size <= 4) {
        let intermediateWeights = Array.from(weights.slice(range.first, range.last));

        if (rect.curveDirection() === Rect.CurveOrientation.CCW) {
            intermediateWeights.reverse();
        }

        const orientation = useMoore ? CurveType.Moore : CurveType.Hilbert;
        let rectangles = layoutItems(intermediateWeights, rect, targetAR, orientation);

        // Not suggested. considered a bug but kept for demonstration
        if (!useOrientation) {
            rectangles = rectangles.map(
                r => new Rect(r.left, r.bottom, r.right, r.top)
            );
        }

        if (rect.curveDirection() === Rect.CurveOrientation.CCW) {
            rectangles.reverse();
        }

        for (let i = 0; i < size; i++) {
            layout[range.first + i] = rectangles[i];
        }

        return;
    }

    // size > 4 → partition into quadrants
    let quadrants: { first: number; last: number }[];
    if (alg === DistributionAlgorithm.Greedy) quadrants = partitionGreedy(range, weights);
    else if (alg === DistributionAlgorithm.MinMax) quadrants = partitionMinMax(range, weights, prefixSums);
    else quadrants = partitionVariance(range, weights, prefixSums);

    // compute total weight per quadrant
    const quadrantWeights: number[] =
        quadrants.map(q => sumRangeFromPrefix(prefixSums, q.first, q.last));

    if (rect.curveDirection() === Rect.CurveOrientation.CCW) {
        quadrantWeights.reverse();
    }

    const orientation = useMoore ? CurveType.Moore : CurveType.Hilbert;
    let rectangles = layoutItems(quadrantWeights, rect, targetAR, orientation);

    // Not suggested. considered a bug but kept for demonstration
    if (!useOrientation) {
        rectangles = rectangles.map(
            r => new Rect(r.left, r.bottom, r.right, r.top)
        );
    }

    if (rect.curveDirection() === Rect.CurveOrientation.CCW) {
        rectangles.reverse();
    }

    // Recurse into each quadrant
    for (let i = 0; i < quadrants.length; i++) {
        layoutRecursively(
            rectangles[i],
            weights,
            prefixSums,
            layout,
            quadrants[i],
            false, // useMoore only applies to top-level call
            alg,
            useOrientation,
            targetAR
        );
    }
}

function weightsToLayoutIndexSpace(
    tree: Topology,
    weights: Configuration.AttributeBuffer
): number[] {
    const weightsByLayout = new Array<number>(tree.numberOfNodes);

    for (let layoutIndex = 0; layoutIndex < tree.numberOfNodes; ++layoutIndex) {
        const renderIndex = tree.layoutToRenderIndexMap[layoutIndex];
        weightsByLayout[layoutIndex] = weights[renderIndex];
    }

    return weightsByLayout;
}


export class HilbertLayout {
    static compute(tree: Topology, weights: Configuration.AttributeBuffer, aspectRatio: number,
        result: Array<Rect>, layoutCallbacks: LayoutCallbacks, accessorySpace: Array<Rect>,
        labelRects: Array<Rect>, labelPaddingSpaces: Array<number>): void {

        result[tree.root.index] = new Rect(0, 0, aspectRatio, 1);
        result[tree.root.index].centerAround([0.5, 0.5]);
        const weightsByLayout = weightsToLayoutIndexSpace(tree, weights);
        const prefixSums = buildPrefixSums(weightsByLayout);

        tree.forEachInnerNode((parent: Node) => {
            // Resize parent space for children
            let layoutRect = layoutCallbacks.accessoryPaddingCallback(
                result[parent.index], parent, tree, result, accessorySpace);
            layoutRect = layoutCallbacks.parentPaddingCallback(
                layoutRect, parent, tree, result, labelRects, labelPaddingSpaces);
            const intermediateRect = layoutCallbacks.siblingMarginBeforeCallback(
                layoutRect, parent, tree, result, labelRects, labelPaddingSpaces);

            // Single-level layout of all children
            HilbertLayout.layoutSingleLevel(parent, intermediateRect, tree,
                weightsByLayout, prefixSums, result, DistributionAlgorithm.MinVariance, true, 1.0);

            // end

            tree.childrenDo(parent, (sibling: Node) => {
                result[sibling.index] = layoutCallbacks.siblingMarginAfterCallback(
                    result[sibling.index], intermediateRect, layoutRect, sibling);
            });
        });
    }

    static layoutSingleLevel(
        parent: Node,
        rect: Rect,
        tree: Topology,
        weightsByLayout: number[],
        prefixSums: number[],
        layout: Rect[],
        alg: DistributionAlgorithm,
        useOrientation: boolean,
        targetAR: number
    ) {
        const range = tree.childrenAsLayoutRange(parent);
        const layoutRects = new Array<Rect>(tree.numberOfNodes);

        layoutRecursively(rect, weightsByLayout, prefixSums,
            layoutRects, range, false, alg, useOrientation, targetAR);

        for (let layoutIndex = range.first; layoutIndex < range.last; ++layoutIndex) {
            const renderIndex = tree.layoutToRenderIndexMap[layoutIndex];
            layout[renderIndex] = layoutRects[layoutIndex];
        }
    }
}

export class MooreLayout {
    static compute(tree: Topology, weights: Configuration.AttributeBuffer, aspectRatio: number,
        result: Array<Rect>, layoutCallbacks: LayoutCallbacks, accessorySpace: Array<Rect>,
        labelRects: Array<Rect>, labelPaddingSpaces: Array<number>): void {

        result[tree.root.index] = new Rect(0, 0, aspectRatio, 1);
        result[tree.root.index].centerAround([0.5, 0.5]);
        const weightsByLayout = weightsToLayoutIndexSpace(tree, weights);
        const prefixSums = buildPrefixSums(weightsByLayout);

        tree.forEachInnerNode((parent: Node) => {
            // Resize parent space for children
            let layoutRect = layoutCallbacks.accessoryPaddingCallback(
                result[parent.index], parent, tree, result, accessorySpace);
            layoutRect = layoutCallbacks.parentPaddingCallback(
                layoutRect, parent, tree, result, labelRects, labelPaddingSpaces);
            const intermediateRect = layoutCallbacks.siblingMarginBeforeCallback(
                layoutRect, parent, tree, result, labelRects, labelPaddingSpaces);

            // Single-level layout of all children
            MooreLayout.layoutSingleLevel(parent, intermediateRect, tree,
                weightsByLayout, prefixSums, result, DistributionAlgorithm.MinVariance, true, 1.0);
            // end

            tree.childrenDo(parent, (sibling: Node) => {
                result[sibling.index] = layoutCallbacks.siblingMarginAfterCallback(
                    result[sibling.index], intermediateRect, layoutRect, sibling);
            });
        });
    }

    static layoutSingleLevel(
        parent: Node,
        rect: Rect,
        tree: Topology,
        weightsByLayout: number[],
        prefixSums: number[],
        layout: Rect[],
        alg: DistributionAlgorithm,
        useOrientation: boolean,
        targetAR: number
    ) {
        const range = tree.childrenAsLayoutRange(parent);
        const layoutRects = new Array<Rect>(tree.numberOfNodes);

        layoutRecursively(rect, weightsByLayout, prefixSums,
            layoutRects, range, true, alg, useOrientation, targetAR);

        for (let layoutIndex = range.first; layoutIndex < range.last; ++layoutIndex) {
            const renderIndex = tree.layoutToRenderIndexMap[layoutIndex];
            layout[renderIndex] = layoutRects[layoutIndex];
        }
    }
}
