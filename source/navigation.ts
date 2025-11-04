/* spellchecker: disable */

import {Observable, ReplaySubject} from 'rxjs';

import {
    auxiliaries,
    Camera,
    EventHandler,
    EventProvider,
    gl_matrix_extensions,
    Invalidate,
    mat4,
    MouseEventProvider,
    PointerEventProvider,
    vec2,
    vec3
} from 'webgl-operate';

import {AbstractCamera} from './abstractcamera';
import {VisualizationType} from "./visualization";
import {AbstractNavigationModifier} from "./abstractnavigationmodifier";
import {Navigationmodifier2D} from "./navigationmodifier2D";
import {Navigationmodifier3D} from "./navigationmodifier3D";

const assert = auxiliaries.assert;
const v2 = gl_matrix_extensions.v2;

/* spellchecker: enable */


export interface CoordsAccess {
    coordsAt(x: GLint, y: GLint, zInNDC?: number, viewProjectionInverse?: mat4): vec3 | undefined;
}
export interface IdAccess {
    idAt(x: GLint, y: GLint): GLsizei | undefined;
}


export class Navigation {

    protected _invalidate: Invalidate;

    /** @see {@link camera} */
    protected _camera: AbstractCamera;

    /**
     * Identifies the active camera modifier.
     */
    protected _mode: Navigation.Mode | undefined;

    /**
     * Used to track mouse movement during mouse-up and mouse-down events for more accurate click
     * detection.
     */
    protected _mouseMovedSinceDown = false;
    // protected _touchMovedSinceStart = false;

    /**
     * @todo - Deprecated modifier is used for now.
     */

    protected _cameraModifier : AbstractNavigationModifier;

    /**
     * Even handler used to forward/map events to specific camera modifiers.
     */
    protected _eventHandler: EventHandler;

    protected _visualizationType: VisualizationType;

    protected _touchSupported: boolean;

    protected _coordsAccess: CoordsAccess | undefined;
    protected _idAccess: IdAccess | undefined;

    protected _lastNode: GLsizei | undefined;
    protected _nodeEnterSubject = new ReplaySubject<Navigation.NodeEvent>(1);
    protected _nodeMoveSubject = new ReplaySubject<Navigation.NodeEvent>(1);
    protected _nodeLeaveSubject = new ReplaySubject<Navigation.NodeEvent>(1);
    protected _nodeSelectSubject = new ReplaySubject<Navigation.NodeEvent>(1);

    protected _navigationStartSubject = new ReplaySubject<void>(1);


    constructor(invalidate: Invalidate, eventProvider: EventProvider, visualizationType: VisualizationType) {
        this._invalidate = invalidate;

        this._visualizationType = visualizationType;
        switch (this._visualizationType) {
            case VisualizationType.VISUALIZATION_2D:
                this._cameraModifier = new Navigationmodifier2D();
                break;
            case VisualizationType.VISUALIZATION_3D:
            default:
                this._cameraModifier = new Navigationmodifier3D();
                break;
        }

        const event = 'ontouchstart';
        this._touchSupported = (document.documentElement && event in document.documentElement)
            || event in document.body;

        eventProvider.mouseEventProvider.preventDefault(MouseEventProvider.Type.Wheel, MouseEventProvider.Type.Click);
        eventProvider.pointerEventProvider.preventDefault(
            PointerEventProvider.Type.Down,
            PointerEventProvider.Type.Move,
            PointerEventProvider.Type.Up);

        /* Create event handler that listens to mouse events. */
        this._eventHandler = new EventHandler(invalidate, eventProvider);

        /* Listen to mouse events. */
        this._eventHandler.pushMouseDownHandler(
            (latests: Array<MouseEvent>, previous: Array<MouseEvent>) =>
                this.onMouseDown(latests, previous));
        this._eventHandler.pushMouseUpHandler(
            (latests: Array<MouseEvent>, previous: Array<MouseEvent>) =>
                this.onMouseUp(latests, previous));
        this._eventHandler.pushMouseMoveHandler(
            (latests: Array<MouseEvent>, previous: Array<MouseEvent>) =>
                this.onMouseMove(latests, previous));
        this._eventHandler.pushMouseWheelHandler(
            (latests: Array<MouseEvent>, previous: Array<MouseEvent>) =>
                this.onMouseWheel(latests, previous));

        this._eventHandler.pushClickHandler(
            (latests: Array<MouseEvent>, previous: Array<MouseEvent>) =>
                this.onClick(latests, previous));

        /* Listen to touch events if possible. */
        if (this._touchSupported) {
            this._eventHandler.pushTouchStartHandler(
                (latests: Array<TouchEvent>, previous: Array<TouchEvent>) =>
                    this.onTouchStart(latests, previous));
            this._eventHandler.pushTouchEndHandler(
                (latests: Array<TouchEvent>, previous: Array<TouchEvent>) =>
                    this.onTouchEnd(latests, previous));
            this._eventHandler.pushTouchMoveHandler(
                (latests: Array<TouchEvent>, previous: Array<TouchEvent>) =>
                    this.onTouchMove(latests, previous));
            this._eventHandler.pushTouchCancelHandler(
                (latests: Array<TouchEvent>, previous: Array<TouchEvent>) =>
                    this.onTouchCancel(latests, previous));
        }
    }

    /**
     * Resolves the event to camera modifier mapping by returning the responsible camera modifier.
     * @param event - Event to retrieve navigation mode for.
     */
    protected mode(event: MouseEvent | TouchEvent | KeyboardEvent): Navigation.Mode | undefined {

        const isMouseDownOrMove = event.type === 'mousedown' || event.type === 'mousemove';
        const isWheel = event.type === 'wheel';

        if (isMouseDownOrMove && this.isPrimaryButtonDown(event as MouseEvent)) {
            return Navigation.Mode.Rotate;
        }
        if (isMouseDownOrMove && this.isSecondaryButtonDown(event as MouseEvent)) {
            return Navigation.Mode.Pan;
        }
        if (isMouseDownOrMove && this.isAuxiliaryButtonDown(event as MouseEvent)) {
            return Navigation.Mode.Zoom;
        }
        if (isWheel) {
            return Navigation.Mode.ZoomStep;
        }
        if (this._touchSupported && event instanceof TouchEvent && event.touches.length === 1) {
            return Navigation.Mode.Pan;
        }

        return undefined;
    }

    protected rotate(event: MouseEvent | TouchEvent, start: boolean): void {
        const point = vec2.fromValues((event as MouseEvent).clientX, (event as MouseEvent).clientY);

        if (start || this._cameraModifier.needStart()) {
            this._cameraModifier.initiate(point, undefined, [false, false, true], event.shiftKey);
        } else {
            this._cameraModifier.update_positions(point);
            this._cameraModifier.rotate();
        }
    }

    protected pan(event: MouseEvent | TouchEvent, start: boolean): void {
        const point = this._eventHandler.offsets(event)[0];

        if (start || this._cameraModifier.needStart()) {
            this._cameraModifier.initiate(point, undefined, [true, false, false], event.shiftKey);
        } else {
            this._cameraModifier.update_positions(point);
            this._cameraModifier.translate();
        }
    }

    protected zoom(event: MouseEvent | TouchEvent, start: boolean): void {
        const point = this._eventHandler.offsets(event)[0];

        if (start || this._cameraModifier.needStart()) {
            this._cameraModifier.initiate(point, undefined, [false, true, false], event.shiftKey);
        } else {
            this._cameraModifier.update_positions(point);
            this._cameraModifier.scale();
        }
    }

    /**
     * Create node related events, i.e., entering, leaving, or moving the mouse over a specific node.
     * @param event - Mouse our touch event that invoked the node interaction.
     */
    protected emitNodeMovementEvents(event: MouseEvent | TouchEvent): void {
        if (this._idAccess === undefined) {
            return;
        }

        // emit coordinates in device independent pixels, but use physical pixels for id lookup
        const point = this._eventHandler.offsets(event, false)[0]; // don't normalize!
        const normalizedPoint = vec2.scale(v2(), point, window.devicePixelRatio);

        const node = this._idAccess.idAt(normalizedPoint[0], normalizedPoint[1]);

        if (this._lastNode === node && node !== undefined) {
            this._nodeMoveSubject.next({ node, point });
        }
        if (this._lastNode !== node && this._lastNode !== undefined) {
            this._nodeLeaveSubject.next({ node: this._lastNode, point });
        }
        if (this._lastNode !== node && node !== undefined) {
            this._nodeEnterSubject.next({ node, point });
        }
        this._lastNode = node;
    }


    protected emitNodeClick(event: MouseEvent | TouchEvent): void {
        if (this._idAccess === undefined) {
            return;
        }

        // emit coordinates in device independant pixels, but use physical pixels for id lookup
        const point = this._eventHandler.offsets(event, false)[0];  // don't normalize!
        const normalizedPoint = vec2.scale(v2(), point, window.devicePixelRatio);

        const node = this._idAccess.idAt(normalizedPoint[0], normalizedPoint[1]);
        if (node !== undefined) {
            this._nodeSelectSubject.next({ node, point });
        }
    }

    protected applyZoomStep(event: WheelEvent): void {
        const point = this._eventHandler.offsets(event)[0];
        this._cameraModifier.initiate(point, undefined, [false, true, false], event.shiftKey);

        event.preventDefault();

        this._cameraModifier.scale(event.deltaY);
    }


    protected onMouseDown(latests: Array<MouseEvent>, previous: Array<MouseEvent>): void {
        this._mouseMovedSinceDown = false;
    }

    protected onMouseUp(latests: Array<MouseEvent>, previous: Array<MouseEvent>): void {
    }

    protected onMouseMove(latests: Array<MouseEvent>, previous: Array<MouseEvent>): void {
        const event: MouseEvent = latests[latests.length - 1];
        this._mouseMovedSinceDown = true;

        const modeWasUndefined = (this._mode === undefined);
        this._mode = this.mode(event);

        switch (this._mode) {
            case Navigation.Mode.Rotate:
                this.rotate(event, modeWasUndefined);
                if (modeWasUndefined) {
                    this._navigationStartSubject.next();
                }
                return;
            case Navigation.Mode.Pan:
                this.pan(event, modeWasUndefined);
                if (modeWasUndefined) {
                    this._navigationStartSubject.next();
                }
                return;
            case Navigation.Mode.Zoom:
                this.zoom(event, modeWasUndefined);
                if (modeWasUndefined) {
                    this._navigationStartSubject.next();
                }
                return;
            default:
                this.emitNodeMovementEvents(event);
                break;
        }
    }


    protected onClick(latests: Array<MouseEvent>, previous: Array<MouseEvent>): void {
        const event: MouseEvent = latests[latests.length - 1];

        switch (this._mode) {
            case Navigation.Mode.Rotate:
            case Navigation.Mode.Pan:
            case Navigation.Mode.Zoom:
                return;
            default:
                this.emitNodeClick(event);
                break;
        }
    }

    protected onMouseWheel(latests: Array<MouseEvent>, previous: Array<MouseEvent>): void {
        const event = latests[latests.length - 1] as WheelEvent;

        this._mode = this.mode(event);
        switch (this._mode) {
            case Navigation.Mode.ZoomStep:
                this.applyZoomStep(event);
                this._navigationStartSubject.next();
                break;
            default:
                break;
        }
    }

    protected onTouchStart(latests: Array<TouchEvent>, previous: Array<TouchEvent>): void {
        const event: TouchEvent = latests[latests.length - 1];

        this._mode = this.mode(event);
        if (this._mode === Navigation.Mode.Pan) {
            this.pan(event, true);
            return;
        }

        assert(this._mode === undefined,
            `Interactions other than pan are not implemented for touch events.`);
    }

    protected onTouchMove(latests: Array<TouchEvent>, previous: Array<TouchEvent>): void {
        const event: TouchEvent = latests[latests.length - 1];

        const modeWasUndefined = (this._mode === undefined);
        this._mode = this.mode(event);

        if (this._mode === Navigation.Mode.Pan) {
            this.pan(event, modeWasUndefined);
            return;
        }

        assert(this._mode === undefined,
            `Interactions other than pan are not implemented for touch events.`);
    }

    protected onTouchEnd(latests: Array<TouchEvent>, previous: Array<TouchEvent>): void { }

    protected onTouchCancel(latests: Array<TouchEvent>, previous: Array<TouchEvent>): void { }

    /**
     * Returns whether or not the primary mouse button (usually left) is currently pressed.
     *
     * @param event Mouse event to check the primary button status of.
     */
    protected isPrimaryButtonDown(event: MouseEvent): boolean {
        const which = event.buttons === undefined ? event.which : event.buttons;
        return which === 1;
    }

    /**
     * Returns whether or not the secondary mouse button (usually right) is currently pressed.
     *
     * @param event Mouse event to check the secondary button status of.
     */
    protected isSecondaryButtonDown(event: MouseEvent): boolean {
        if (event.buttons === undefined) {
            return event.which === 3;
        }
        return event.buttons === 2;
    }

    /**
     * Returns whether or not the auxiliary mouse button (usually middle or mouse wheel button) is
     * currently pressed.
     * @param event - Mouse event to check the auxiliary button status of.
     */
    protected isAuxiliaryButtonDown(event: MouseEvent): boolean {
        if (event.buttons === undefined) {
            return event.which === 2;
        }
        return event.buttons === 4;
    }

    /**
     * Update should invoke navigation specific event processing. When using, e.g., an event handler,
     * the event handlers update method should be called in order to have navigation specific event
     * processing invoked.
     */
    update(): void {
        this._eventHandler.update();
    }

    /**
     * The camera that is to be modified in response to various events.
     */
    set camera(camera: AbstractCamera) {
        this._camera = camera;
        //TODO this should be fixed by implementing the 2D Camera on the webgl-operate side
        this._cameraModifier.camera = camera as any as Camera;
    }


    set coordsAccess(callback: CoordsAccess) {
        this._coordsAccess = callback;
        this._cameraModifier.coordsAccess = this._coordsAccess.coordsAt;
    }

    set idAccess(callback: IdAccess) {
        this._idAccess = callback;
    }


    /**
     * Observable that can be used to subscribe to node-enter events.
     */
    get nodeEnter$(): Observable<Navigation.NodeEvent> {
        return this._nodeEnterSubject.asObservable();
    }

    /**
     * Observable that can be used to subscribe to node-enter events.
     */
    get nodeMove$(): Observable<Navigation.NodeEvent> {
        return this._nodeMoveSubject.asObservable();
    }

    /**
     * Observable that can be used to subscribe to node-leave events.
     */
    get nodeLeave$(): Observable<Navigation.NodeEvent> {
        return this._nodeLeaveSubject.asObservable();
    }

    /**
     * Observable that can be used to subscribe to node-select events (aka click).
     */
    get nodeSelect$(): Observable<Navigation.NodeEvent> {
        return this._nodeSelectSubject.asObservable();
    }

    /**
     * Observable that fires when navigation starts. @todo - but what is it used for?
     */
    get navigationStart$(): Observable<void> {
        return this._navigationStartSubject.asObservable();
    }

}


export namespace Navigation {

    export interface NodeEvent {
        /** the database ID of the node */
        node: number;
        point: vec2;
    }


    /**
     * Navigation modes used for identification of the current navigation intend, which is derived based
     * on the event types or gestures, regardless of the active navigation metaphor and its constraints.
     */
    export enum Mode {
        Move,
        Pan,
        Rotate,
        Zoom,
        ZoomStep,
    }

}
