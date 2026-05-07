

/* spellchecker: disable */

import * as gloperate from 'webgl-operate';

import log = gloperate.auxiliaries.log;
import LogLevel = gloperate.auxiliaries.LogLevel;

import {
    Configuration,
    Layout,
    Renderer,
    Visualization,
    initialize
} from '../../source/treemap-renderer';

import colorbrewer_JSON from '../../source/data/colorbrewer.json';
import smithwalt_JSON from '../../source/data/smithwalt.json';

import { CSVData } from './csvdata';
import { CBDData } from './cbddata';

import { Example } from '../example';

/* spellchecker: enable */


// tslint:disable:max-classes-per-file

const COLOR_SCHEMES = [
    ...colorbrewer_JSON,
    ...smithwalt_JSON
].map((preset: { identifier: string }) => preset.identifier).sort();


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

        const fileUpload = document.getElementById('fileUpload') as HTMLInputElement;
        const loadFile = document.getElementById('loadFile') as HTMLInputElement;
        const colorScheme = document.getElementById('colorScheme') as HTMLSelectElement;
        const layoutAlgorithm = document.getElementById('layoutAlgorithm') as HTMLSelectElement;
        const labelsEnabled = document.getElementById('labelsEnabled') as HTMLInputElement;

        let currentConfig: Configuration | undefined;
        let loadedLabels: Configuration.Labels | undefined;

        const leafColorScheme = (config: Configuration): string => {
            const leafColor = config.colors.find((color) => color.identifier === 'leaf');
            return leafColor !== undefined && Configuration.isColorPreset(leafColor) ?
                leafColor.preset : '';
        };

        const populateColorSchemes = (selectedScheme: string): void => {
            const schemes = COLOR_SCHEMES.includes(selectedScheme) || selectedScheme.length === 0 ?
                COLOR_SCHEMES : [...COLOR_SCHEMES, selectedScheme].sort();

            colorScheme.replaceChildren(...schemes.map((scheme: string) => {
                const option = document.createElement('option');
                option.value = scheme;
                option.text = scheme;
                return option;
            }));
        };

        const clearLabels = (): void => {
            renderer.updateLabels([], []);
            renderer.updatePoints([]);
            renderer.updateLeafLabelBackgrounds([]);
            renderer.invalidate();
        };

        const controlsEnabled = (enabled: boolean): void => {
            colorScheme.disabled = !enabled;
            layoutAlgorithm.disabled = !enabled;
            labelsEnabled.disabled = !enabled;
        };

        const syncControls = (config: Configuration): void => {
            const selectedScheme = leafColorScheme(config);

            populateColorSchemes(selectedScheme);
            colorScheme.value = selectedScheme;
            layoutAlgorithm.value = config.layout.algorithm as string;
            labelsEnabled.checked = config.labels !== undefined && config.labels.names !== undefined;
            controlsEnabled(true);
        };

        const loadConfig = (config: Configuration): boolean => {
            const oldConfig = visualization.configuration;

            try {
                visualization.configuration = config;
                visualization.update();
                renderer.invalidate();
                return true;
            }
            catch (error) {
                console.log(error);

                if (oldConfig === undefined) {
                    return false;
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

                return false;
            }
        };

        const applyConfigChange = (): void => {
            if (currentConfig === undefined) {
                return;
            }

            currentConfig.altered.alter('any');
            loadConfig(currentConfig);

            if (!labelsEnabled.checked) {
                clearLabels();
            }
        };

        colorScheme.onchange = () => {
            if (currentConfig === undefined) {
                return;
            }

            currentConfig.colors = currentConfig.colors.map((color) => {
                if (color.identifier === 'leaf' && Configuration.isColorPreset(color)) {
                    return { ...color, preset: colorScheme.value };
                }

                return color;
            });

            applyConfigChange();
        };

        layoutAlgorithm.onchange = () => {
            if (currentConfig === undefined) {
                return;
            }

            currentConfig.layout = {
                ...currentConfig.layout,
                algorithm: layoutAlgorithm.value as Layout.LayoutAlgorithm,
            };

            applyConfigChange();
        };

        labelsEnabled.onchange = () => {
            if (currentConfig === undefined) {
                return;
            }

            currentConfig.labels = labelsEnabled.checked && loadedLabels !== undefined ?
                loadedLabels : {};

            applyConfigChange();
        };

        const loadCsv = async () => {
            const fileList = fileUpload.files;
            if (fileList === null) return;
            const file = fileList[0];
            if (file === undefined) return;

            if (true) {
                // Papaparse Interface
                CSVData.loadAsync(file)
                    .then((config: Configuration) => {
                        if (loadConfig(config)) {
                            currentConfig = config;
                            loadedLabels = config.labels;
                            syncControls(config);
                        }
                    });
            } else {
                // CBD-Parser Interface
                CBDData.loadAsync(file)
                    .then((config: Configuration) => {
                        if (loadConfig(config)) {
                            currentConfig = config;
                            loadedLabels = config.labels;
                            syncControls(config);
                        }
                    });
            }
        };

        populateColorSchemes('');
        controlsEnabled(false);

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
