
/* spellchecker: disable */

import { viewer, Canvas, Color, Wizard } from 'webgl-operate';

/* spellchecker: enable */

/**
 * This wraps the canvas initialization of webgl-operate and provides various default settings
 * specifically for the treemap use case. This should fail (@todo) if the minimal requirements for
 * fallback renderer are not met.
 * @param element - Canvas element or element id {string} to be used for querying the canvas element.
 * @param attributes - Overrides the internal default attributes @see{Context.DEFAULT_ATTRIBUTES}.
 */
export function initialize(
    element: HTMLCanvasElement | string, attributes?: WebGLContextAttributes,
    clearColor: Color = new Color().fromHex('fafafa')): Canvas {

    /**
     * @hack to resolve a Blocker (BUG-2909, BUG-3126) for now:
     * force client to disable WEBGL_draw_buffers to avoid Webgl Context Lost on
     * Mac+Chrome.
     * The proper fix should be handled in webgl-operate (feature detection for WEBGL_draw_buffers).
     */
    const htmlElement = element instanceof HTMLCanvasElement ? element :
        document.getElementById(element) as HTMLCanvasElement;
    // https://stackoverflow.com/a/48182999
    const isChrome = !!(window as any)['chrome'] &&
        (!!(window as any)['chrome']['webstore'] || !!(window as any)['chrome']['runtime']);

    if (navigator.appVersion.indexOf('Mac') !== -1 && isChrome) {
        htmlElement.dataset.msqrdP = 'no-WEBGL_draw_buffers';
        console.warn('detected Chrome on MacOS, disabling WEBGL_draw_buffers');
    }

    const canvas = new Canvas(htmlElement, attributes ? attributes : {
        alpha: false, antialias: false, depth: false, failIfMajorPerformanceCaveat: false,
        premultipliedAlpha: false, preserveDrawingBuffer: false, stencil: false,
    });

    const blocker = new viewer.EventBlocker(canvas.element);
    blocker.block('contextmenu');

    canvas.clearColor = clearColor;
    canvas.framePrecision = Wizard.Precision.byte;

    // The larger number is used since it introduces less noticeable change on interaction.
    canvas.controller.multiFrameNumber = 64; /* This triggers goldenset64 to be used. */

    // Workaround: Avoid a black screen being shown until the rendering pipeline is running
    canvas.context.gl.clearColor(clearColor.r, clearColor.g, clearColor.b, clearColor.a);
    canvas.context.gl.clear(canvas.context.gl.COLOR_BUFFER_BIT);

    return canvas;
}
