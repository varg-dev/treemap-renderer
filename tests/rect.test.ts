import { describe, expect, it } from 'vitest';

import { Rect } from '../source/rect';

function expectRect(rect: Rect, left: number, bottom: number, right: number, top: number): void {
    expect(rect.left).toBeCloseTo(left, 6);
    expect(rect.bottom).toBeCloseTo(bottom, 6);
    expect(rect.right).toBeCloseTo(right, 6);
    expect(rect.top).toBeCloseTo(top, 6);
}

describe('Rect', () => {
    it('computes dimensions and basic properties', () => {
        const rect = new Rect(1, 2, 4, 6);
        expect(rect.width).toBe(3);
        expect(rect.height).toBe(4);
        expect(rect.area).toBe(12);
        expect(rect.center).toEqual([2.5, 4]);
        expect(rect.shorterSide).toBe(3);
        expect(rect.longerSide).toBe(4);
        expect(rect.isHorizontal).toBe(false);
        expect(rect.isVertical).toBe(true);
        expect(rect.aspectRatio).toBeCloseTo(0.75, 6);
        expect(rect.isValid()).toBe(true);
        expect(rect.isEmpty()).toBe(false);
    });

    it('clamps constructor extents to valid ranges', () => {
        const rect = new Rect(5, 4, 3, 2);
        expectRect(rect, 5, 4, 5, 4);
        expect(rect.isEmpty()).toBe(true);
    });

    it('clones including orientation metadata', () => {
        const rect = new Rect(0, 0, 2, 1);
        rect.rotate(Rect.Rotation.R090);
        rect.setCurveDirection(Rect.CurveOrientation.CCW);

        const clone = Rect.clone(rect);
        expect(clone).not.toBe(rect);
        expectRect(clone, 0, 0, 2, 1);
        expect(clone.rotation()).toBe(rect.rotation());
        expect(clone.curveDirection()).toBe(rect.curveDirection());
        expect(clone.orientation).toBe(rect.orientation);
    });

    it('supports orientation getter/setter and isReversed', () => {
        const rect = new Rect(0, 0, 1, 1);
        rect.orientation = Rect.Orientation.DC;
        expect(rect.rotation()).toBe(Rect.Rotation.R000);
        expect(rect.curveDirection()).toBe(Rect.CurveOrientation.CCW);
        expect(rect.isReversed).toBe(true);

        rect.orientation = Rect.Orientation.BA;
        expect(rect.rotation()).toBe(Rect.Rotation.R180);
        expect(rect.curveDirection()).toBe(Rect.CurveOrientation.CW);
        expect(rect.isReversed).toBe(false);
    });

    it('keeps coordinate setter invariants', () => {
        const leftClamp = new Rect(0, 0, 2, 2);
        leftClamp.left = 5;
        expect(leftClamp.left).toBe(2);

        const rightClamp = new Rect(0, 0, 2, 2);
        rightClamp.right = -1;
        expect(rightClamp.right).toBe(0);

        const topClamp = new Rect(0, 0, 2, 2);
        topClamp.top = -3;
        expect(topClamp.top).toBe(0);

        const bottomClamp = new Rect(0, 0, 2, 2);
        bottomClamp.bottom = 3;
        expect(bottomClamp.bottom).toBe(2);
    });

    it('creates relative and truncated rectangles on all four sides', () => {
        const rect = new Rect(0, 0, 10, 20);
        expectRect(rect.relativeTop(0.25), 0, 15, 10, 20);
        expectRect(rect.relativeBottom(0.25), 0, 0, 10, 5);
        expectRect(rect.relativeLeft(0.2), 0, 0, 2, 20);
        expectRect(rect.relativeRight(0.2), 8, 0, 10, 20);

        expectRect(rect.truncateTop(12), 0, 0, 10, 12);
        expectRect(rect.truncateBottom(12), 0, 12, 10, 20);
        expectRect(rect.truncateLeft(4), 4, 0, 10, 20);
        expectRect(rect.truncateRight(4), 0, 0, 4, 20);
    });

    it('supports offsets and center alignment', () => {
        const rect = new Rect(0, 0, 2, 2);
        rect.applyOffset(1, -1);
        expectRect(rect, 1, -1, 3, 1);

        rect.centerAround([0, 0]);
        expectRect(rect, -1, -1, 1, 1);
    });

    it('supports relativeRect overloads and invalid arguments', () => {
        const rect = new Rect(0, 0, 10, 10);
        rect.rotate(Rect.Rotation.R090);

        const numeric = rect.relativeRect(0.1, 0.2, 0.3, 0.4);
        expectRect(numeric, 1, 2, 4, 6);
        expect(numeric.rotation()).toBe(Rect.Rotation.R090);

        const withOrientation = rect.relativeRect(0.1, 0.2, 0.3, 0.4, Rect.Orientation.CD);
        expectRect(withOrientation, 1, 2, 4, 6);
        expect(withOrientation.rotation()).toBe(Rect.Rotation.R000);

        const objectOverload = rect.relativeRect({ x: 0.5, y: 0.5 }, { x: 0.25, y: 0.25 });
        expectRect(objectOverload, 5, 5, 7.5, 7.5);

        const unsafeRelativeRect = rect.relativeRect as unknown as (...args: unknown[]) => Rect;
        expect(() => unsafeRelativeRect(0.1, { x: 0.2 }, 0.3)).toThrowError('Invalid relativeRect arguments');
    });

    it('computes equalized margins', () => {
        const rect = new Rect(0, 0, 10, 10);
        expect(rect.equalizedMargin(1, 0.5, 0.2)).toBeCloseTo(1, 6);

        const fallback = new Rect(0, 0, 2, 2).equalizedMargin(2, 0.5, 0.2);
        expect(fallback).toBeGreaterThanOrEqual(0);
        expect(fallback).toBeLessThanOrEqual(2);

        const equalizedRelative = rect.equalizedRelativeMargin(0.25);
        expect(Number.isFinite(equalizedRelative)).toBe(true);
        expect(equalizedRelative).toBeGreaterThan(0);

        const empty = new Rect(0, 0, 0, 0);
        expect(empty.equalizedMargin(1, 0.5, 0.2)).toBe(0);
        expect(empty.equalizedRelativeMargin(0.25)).toBe(0);
    });

    it('supports all padding variants', () => {
        const rect = new Rect(0, 0, 10, 10);
        expectRect(rect.padded(1), 1, 1, 9, 9);
        expectRect(rect.paddedLTRB(1, 2, 3, 4), 4, 3, 8, 9);
        expectRect(rect.relativePadded(0.2), 1, 1, 9, 9);
        expectRect(rect.paddedWithMinArea(0, 0.5), 0, 0, 10, 10);

        const collapsed = rect.padded(6);
        expectRect(collapsed, 0, 0, 0, 0);

        const fallback = new Rect(0, 0, 4, 4).paddedWithMinArea(2, 0.9);
        expect(fallback.isValid()).toBe(true);
        expect(fallback.width).toBeGreaterThanOrEqual(0);
        expect(fallback.height).toBeGreaterThanOrEqual(0);
    });

    it('maps from source to target coordinate spaces', () => {
        const source = new Rect(0, 0, 10, 10);
        const target = new Rect(0, 0, 100, 50);
        const sub = new Rect(2, 2, 8, 6);

        const mapped = sub.map(source, target);
        expectRect(mapped, 20, 10, 80, 30);
    });

    it('supports enclosure, containment, intersection and union operations', () => {
        const a = new Rect(1, 1, 3, 3);
        const b = new Rect(0, 0, 4, 4);
        const c = new Rect(3, 3, 5, 5);

        expect(b.contains(a)).toBe(true);
        expect(a.contains(b)).toBe(false);
        expect(a.intersects(b)).toBe(true);
        expect(a.intersects(c)).toBe(false);
        expect(b.comprises(a)).toBe(true);

        const merged = a.merged(c);
        expectRect(merged, 1, 1, 5, 5);

        const intersection = b.intersection(new Rect(2, 1, 5, 6));
        expectRect(intersection, 2, 1, 4, 4);

        const encloseTarget = new Rect(2, 2, 3, 3);
        encloseTarget.enclose(new Rect(0, 1, 4, 5));
        expectRect(encloseTarget, 0, 1, 4, 5);
    });

    it('returns all corner and center helper coordinates', () => {
        const rect = new Rect(0, 0, 4, 2);
        expect(rect.topLeft()).toEqual({ x: 0, y: 2 });
        expect(rect.topRight()).toEqual({ x: 4, y: 2 });
        expect(rect.bottomLeft()).toEqual({ x: 0, y: 0 });
        expect(rect.bottomRight()).toEqual({ x: 4, y: 0 });
        expect(rect.topCenter()).toEqual({ x: 2, y: 2 });
        expect(rect.bottomCenter()).toEqual({ x: 2, y: 0 });
        expect(rect.leftCenter()).toEqual({ x: 0, y: 1 });
        expect(rect.rightCenter()).toEqual({ x: 4, y: 1 });
    });

    it('supports rotation and curve direction updates with wrapping', () => {
        const rect = new Rect(0, 0, 1, 1);
        expect(rect.rotation()).toBe(Rect.Rotation.R000);
        expect(rect.curveDirection()).toBe(Rect.CurveOrientation.CW);

        rect.rotate(Rect.Rotation.R270);
        expect(rect.rotation()).toBe(Rect.Rotation.R270);
        rect.rotate(2);
        expect(rect.rotation()).toBe(Rect.Rotation.R090);

        rect.setCurveDirection(Rect.CurveOrientation.CCW);
        expect(rect.curveDirection()).toBe(Rect.CurveOrientation.CCW);
        rect.setCurveDirection(Rect.CurveOrientation.CCW);
        expect(rect.curveDirection()).toBe(Rect.CurveOrientation.CW);
        rect.setCurveDirection(-1);
        expect(rect.curveDirection()).toBe(Rect.CurveOrientation.CCW);
    });

    it('supports horizontalSplit across all rotations', () => {
        const base = new Rect(0, 0, 2, 1);

        const r0 = Rect.clone(base);
        const [h0] = r0.horizontalSplit(0.25);
        expectRect(h0, 0, 0, 0.5, 1);

        const r90 = Rect.clone(base);
        r90.rotate(Rect.Rotation.R090);
        const [h90] = r90.horizontalSplit(0.25);
        expectRect(h90, 0, 0, 2, 0.25);

        const r180 = Rect.clone(base);
        r180.rotate(Rect.Rotation.R180);
        const [h180] = r180.horizontalSplit(0.25);
        expectRect(h180, 1.5, 0, 2, 1);

        const r270 = Rect.clone(base);
        r270.rotate(Rect.Rotation.R270);
        const [h270] = r270.horizontalSplit(0.25);
        expectRect(h270, 0, 0.75, 2, 1);
    });

    it('supports verticalSplit across all rotations and cut clamping', () => {
        const base = new Rect(0, 0, 2, 1);

        const r0 = Rect.clone(base);
        const [v0] = r0.verticalSplit(0.25);
        expectRect(v0, 0, 0, 2, 0.25);

        const r90 = Rect.clone(base);
        r90.rotate(Rect.Rotation.R090);
        const [v90] = r90.verticalSplit(0.25);
        expectRect(v90, 1.5, 0, 2, 1);

        const r180 = Rect.clone(base);
        r180.rotate(Rect.Rotation.R180);
        const [v180] = r180.verticalSplit(0.25);
        expectRect(v180, 0, 0.75, 2, 1);

        const r270 = Rect.clone(base);
        r270.rotate(Rect.Rotation.R270);
        const [v270] = r270.verticalSplit(0.25);
        expectRect(v270, 0, 0, 0.5, 1);

        const [clampedLow, clampedHigh] = base.horizontalSplit(-0.5);
        expectRect(clampedLow, 0, 0, 0, 1);
        expectRect(clampedHigh, 0, 0, 2, 1);
    });
});
