

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

import { Example } from '../example';

/* spellchecker: enable */


// tslint:disable:max-classes-per-file

export class DirectConfigTreemapExample extends Example {

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

        const dataElement = window.document.getElementById('csv-data')! as HTMLTextAreaElement;
        const hashElement = window.document.getElementById('data-hash')! as HTMLPreElement;
        const reloadElement = window.document.getElementById('reload')! as HTMLButtonElement;
        const configElement = window.document.getElementById('config-display')! as HTMLPreElement;

        const success = this.initialize(element);

        const renderer = this._visualization.renderer as Renderer;
        const canvas = this._canvas as gloperate.Canvas;
        const visualization = this._visualization;

        const loadConfig = (configString: string) => {
            let configData = {};

            try {
                console.log("Parse JSON");
                configData = JSON.parse(configString);
            } catch (error) {
                console.log(error);

                return;
            }

            const oldConfig = visualization.configuration;

            try {
                console.log("Derive new Config");
                const config = new Configuration();

                if (oldConfig !== undefined) {
                    config.topology = oldConfig.topology;
                    config.layout = oldConfig.layout;
                    config.buffers = oldConfig.buffers;
                    config.bufferViews = oldConfig.bufferViews;
                    config.colors = oldConfig.colors;
                    config.geometry = oldConfig.geometry;
                    config.labels = oldConfig.labels;
                }

                config.topology = (configData as Configuration).topology || {};
                config.layout = (configData as Configuration).layout || {};
                config.buffers = (configData as Configuration).buffers || [];
                config.bufferViews = (configData as Configuration).bufferViews || [];
                config.colors = (configData as Configuration).colors || [];
                config.geometry = (configData as Configuration).geometry || {};
                config.labels = (configData as Configuration).labels || {};

                console.log("Apply new Config");
                visualization.configuration = config;
                visualization.update();
                renderer.invalidate();
                console.log("Applied new Config");

                if (configElement) {
                    configElement.textContent = JSON.stringify(config.toJSON(), null, 2);
                }
            }
            catch (error) {
                console.log("Error with new Config");

                if (oldConfig === undefined) {
                    return;
                }

                console.log("Apply rescue Config");

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

                console.log("Applied rescue Config");
            }
        };

        // export variables

        (window as any)['gloperate'] = gloperate;

        (window as any)['canvas'] = canvas;
        (window as any)['context'] = canvas.context;
        (window as any)['controller'] = canvas.controller;

        (window as any)['visualization'] = visualization;
        (window as any)['renderer'] = renderer;

        if (dataElement) {
            const searchParams = new URLSearchParams(window.location.search);
            const data = searchParams.get('data');

            if (data) {
                log(LogLevel.Debug, "Load from", data);
                dataElement.value = atob(data);
                // TODO: refactor to use Buffer.from(data, 'base64')
            }

            dataElement.oninput = (event) => {
                const testdata = dataElement.value;

                loadConfig(testdata);

                if (hashElement) {
                    hashElement.textContent = this.obtainUrl(btoa(testdata));
                }
            };
            dataElement.oninput({} as Event); // initial load
        }

        if (reloadElement && hashElement) {
            reloadElement.onclick = (event) => {
                if (hashElement.textContent && hashElement.textContent !== "") {
                    window.location.href = hashElement.textContent! as string;
                }
            };
        }

        return success && dataElement !== undefined && dataElement !== null;
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