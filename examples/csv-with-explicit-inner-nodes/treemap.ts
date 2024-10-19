

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

import { Example } from '../example';

/* spellchecker: enable */


// tslint:disable:max-classes-per-file

export class ExplicitInnerNodesTreemapExample extends Example {

    protected obtainUrl(hash: string): string {
        return window.location.origin + window.location.pathname + "?data=" + hash;
    }

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

        const loadConfig = (config: Configuration) => {
            const oldConfig = visualization.configuration;

            try {
                visualization.configuration = config;
                renderer.invalidate();
            }
            catch (error) {
                visualization.configuration = oldConfig;
                renderer.invalidate();
            }
        };

        // export variables

        (window as any)['gloperate'] = gloperate;

        (window as any)['canvas'] = canvas;
        (window as any)['context'] = canvas.context;
        (window as any)['controller'] = canvas.controller;

        (window as any)['visualization'] = visualization;
        (window as any)['renderer'] = renderer;


        const dataElement = window.document.getElementById('csv-data')! as HTMLTextAreaElement;
        const hashElement = window.document.getElementById('data-hash')! as HTMLPreElement;
        const reloadElement = window.document.getElementById('reload')! as HTMLButtonElement;

        if (dataElement !== undefined) {
            const searchParams = new URLSearchParams(window.location.search);
            const data = searchParams.get('data');

            if (data) {
                log(LogLevel.Debug, "Load from", data);
                dataElement.value = atob(data);
                // TODO: refactor to use Buffer.from(data, 'base64')
            }

            dataElement.oninput = (event) => {
                const testdata = dataElement.value;

                CSVData.loadAsync(testdata)
                    .then((config: Configuration) => {
                        loadConfig(config);

                        if (hashElement !== undefined) {
                            hashElement.textContent = this.obtainUrl(btoa(testdata));
                        }
                    });
            };
            dataElement.oninput({} as Event); // initial load
        }

        if (reloadElement !== undefined && hashElement !== undefined) {
            reloadElement.onclick = (event) => {
                if (hashElement.textContent !== undefined && hashElement.textContent !== "") {
                    window.location.href = hashElement.textContent! as string;
                }
            };
        }

        return success && dataElement !== undefined;
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