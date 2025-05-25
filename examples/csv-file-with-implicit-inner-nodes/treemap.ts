

/* spellchecker: disable */

import * as gloperate from 'webgl-operate';

import log = gloperate.auxiliaries.log;
import LogLevel = gloperate.auxiliaries.LogLevel;

import {
    Configuration,
    Renderer,
    Visualization,
    initialize
} from '../../source/treemap-renderer';

import { CSVData } from './csvdata';
import { CBDData } from './cbddata';

import { Example } from '../example';

/* spellchecker: enable */


// tslint:disable:max-classes-per-file

export class ImplicitInnerNodesTreemapFromCSVExample extends Example {

    get canvas(): gloperate.Canvas {
        return this._canvas;
    }

    get visualization(): Visualization {
        return this._visualization;
    }

    get renderer(): Renderer {
        return this._renderer;
    }

    private _canvas: gloperate.Canvas;
    private _visualization: Visualization;
    private _renderer: Renderer;


    validate(element: HTMLCanvasElement | string): boolean {
        return this.initialize(element);
        // return false;
    }

    preview(element: HTMLCanvasElement | string): boolean {
        return this.initialize(element);
        // return false;
    }

    feature(element: HTMLCanvasElement | string): boolean {

        const success = this.initialize(element);

        const renderer = this._visualization.renderer as Renderer;
        const canvas = this._canvas as gloperate.Canvas;
        const visualization = this._visualization;

        const fullscreenTarget = canvas.element;

        window.document.getElementById('fullscreen')!.onclick = () => {
            gloperate.viewer.Fullscreen.toggle(fullscreenTarget);
        };

        const loadConfig = (config: Configuration) => {
            const oldConfig = visualization.configuration;

            try {
                visualization.configuration = config;
                visualization.update();
                renderer.invalidate();
            }
            catch (error) {
                console.log(error);

                if (oldConfig === undefined) {
                    return;
                }

                const rescueConfig = new Configuration();

                rescueConfig.topology = oldConfig.topology;
                rescueConfig.layout = oldConfig.layout;
                rescueConfig.buffers = oldConfig.buffers;
                rescueConfig.bufferViews = oldConfig.bufferViews;
                rescueConfig.colors = oldConfig.colors;
                rescueConfig.geometry = oldConfig.geometry;
                rescueConfig.labels = oldConfig.labels;

                visualization.configuration = rescueConfig;
                visualization.update();
                renderer.invalidate();
            }
        };

        const fileUpload = document.getElementById('fileUpload') as HTMLInputElement;
        const loadFile = document.getElementById('loadFile') as HTMLInputElement;

        const loadCsv = async () => {
            const fileList = fileUpload.files;
            if (fileList === null) return;
            const file = fileList[0];
            if (file === undefined) return;

            if (true) {
                // Papaparse Interface
                CSVData.loadAsync(file)
                    .then((config: Configuration) => loadConfig(config));
            } else {
                // CBD-Parser Interface
                CBDData.loadAsync(file)
                    .then((config: Configuration) => loadConfig(config));
            }
        };

        loadFile.onclick = async () => loadCsv();

        // export variables

        (window as any)['gloperate'] = gloperate;

        (window as any)['canvas'] = canvas;
        (window as any)['context'] = canvas.context;
        (window as any)['controller'] = canvas.controller;

        (window as any)['visualization'] = visualization;
        (window as any)['renderer'] = renderer;

        return success;
    }


    initialize(element: HTMLCanvasElement | string): boolean {

        this._canvas = initialize(element);

        this._visualization = new Visualization();
        const renderer: Renderer = this._visualization.renderer as Renderer;
        this._canvas.renderer = renderer;

        super.expose();

        return true;
    }

    uninitialize(): void {
        this._canvas.dispose();
        (this._renderer as gloperate.Renderer).uninitialize();
    }
}
