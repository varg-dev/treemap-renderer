
/* spellchecker: disable */

import * as gloperate from 'webgl-operate';

import log = gloperate.auxiliaries.log;
import LogLevel = gloperate.auxiliaries.LogLevel;

import { CSV, Column, NumberColumn, StringColumn } from '@hpicgs/cbd-parser';

import { Configuration, Topology, NodeSort } from '../../source/treemap-renderer';
import { delimiter } from 'path';

/* spellchecker: enable */


export class CBDHeader {
    public csv_delimiter: string;
    public path_column: string;
    public weight_column: string;
    public height_column: string;
    public color_column: string;
    public label_column: string;
    public height_scale: number;
};

class Edge {
    public parentIndex: number;
    public index: number;
};

class CBDHeaderParser {
    protected _header: CBDHeader;
    protected _loader: CSV;
    protected _headerParsed = false;
    protected _intermediateChunk = '';

    public constructor(header: CBDHeader, loader: CSV) {
        this._header = header;
        this._loader = loader;
    }

    // do nothing on start
    public start(): void { }

    // do nothing on end
    public flush(): void { }

    public transform: TransformerTransformCallback<string, string> = async (chunk, controller) => {

        if (this._headerParsed) {
            controller.enqueue(chunk);

            return;
        }

        this._intermediateChunk += chunk;

        // Contains newline => let's parse the header line
        let lastNewline = -1;
        let nextNewline = this._intermediateChunk.indexOf('\n', lastNewline + 1);
        while (nextNewline != -1 && this._intermediateChunk[lastNewline + 1] == '#') {
            const line = this._intermediateChunk.substring(lastNewline + 2, nextNewline).trim();

            const [key, value] = line.split('=').map((s: string) => s.trim());

            if (key == 'delimiter') {
                this._header.csv_delimiter = value || ';';
                this._loader._options!.delimiter = this._header.csv_delimiter;
            } else if (key == 'paths') {
                this._header.path_column = value || 'name';
            } else if (key == 'weights') {
                this._header.weight_column = value || '';
            } else if (key == 'heights') {
                this._header.height_column = value || '';
            } else if (key == 'colors') {
                this._header.color_column = value || '';
            } else if (key == 'labels') {
                this._header.label_column = value || '';
            } else if (key == 'heightScale') {
                this._header.height_scale = Number.parseFloat(value || '0.1') || 0.1;
            } else {
                log(LogLevel.Warning, `Unparsed header`, key, '=', value);
            }

            lastNewline = nextNewline;
            nextNewline = this._intermediateChunk.indexOf('\n', lastNewline + 1);
        }

        if (lastNewline > 0) {
            this._intermediateChunk = this._intermediateChunk.substring(lastNewline + 1);
        }

        // Next line doesn't start with # => parsing headers finished
        if (!this._intermediateChunk.startsWith('#')) {
            controller.enqueue(this._intermediateChunk);

            this._intermediateChunk = '';
            this._headerParsed = true;
        }
    };
}

export class CBDData {
    protected static initializeHeader(header: CBDHeader): void {
        header.csv_delimiter = ';';
        header.path_column = 'name';
    }

    protected static parseResult(result: Array<Column>, header: CBDHeader, config: Configuration): void {

        const collect_string_column = (result: Array<Column>, name: string): Array<string> => {


            let column_index = result.findIndex((column) => column.name == name);
            if (column_index < 0) {
                const column = new Array<string>(result[0].length);
                return column;
            }

            return result[column_index].chunks.map(chunk => chunk._data).flat();
        };

        const collect_column = (result: Array<Column>, name: string) => {
            let column_index = result.findIndex((column) => column.name == name);
            if (column_index < 0) {
                const column = new Float32Array(result[0].length);
                column.fill(-1);
                return column;
            }

            const float32Flatten = (chunks) => {
                const flattened = new Float32Array(result[0].length);

                //insert each chunk into the new float32array
                let currentFrame = 0
                chunks.forEach((chunk) => {
                    flattened.set(chunk, currentFrame)
                    currentFrame += chunk.length;
                });
                return flattened;
            }

            return float32Flatten(result[column_index].chunks.map(chunk => chunk.view));
        };

        const has_labels_column = (name: string) => result.findIndex((column) => column.name == name && column.type == 'string') >= 0;

        // parse edges

        const paths = collect_string_column(result, header.path_column);

        for (let i = 0; i < paths.length; ++i) {
            paths[i] = paths[i].replace("./", "");
        }
        const pathParts = paths.map((value: string) => value.split('/'));

        // parse weights

        const leafWeights = collect_column(result, header.weight_column);

        // parse heights

        const leafHeights = collect_column(result, header.height_column);

        // parse colors

        const leafColors = collect_column(result, header.color_column);

        // parse labels

        const labels = has_labels_column(header.label_column) ?
            collect_string_column(result, header.label_column) :
            pathParts.map((parts: string[]) => parts.at(-1));

        // Load topology

        const createNode = (index: number, parentIndex: number): Edge => {
            return { parentIndex, index } as Edge;
        };

        const gatherParentKey = (parts: string[], index: number): string => {
            return "/" + parts.slice(0, index).join('/');
        }

        const edges = new Array<Configuration.NodeIdentifier>();
        const names = new Map<number, string>();
        const weights = new Array<number>();
        const heights = new Array<number>();
        const colors = new Array<number>();

        const nodes = {};
        let currentIndex = -1;

        // Create root
        nodes['/'] = createNode(currentIndex, -1);
        currentIndex += 1;
        weights.push(0.0);
        heights.push(0.0);
        colors.push(0.0);

        // Create inner nodes and leaf nodes
        pathParts.forEach((parts: Array<string>, partIndex: number) => {
            parts.forEach((value: string, index: number) => {
                const parentKey = gatherParentKey(parts, index);
                const key = gatherParentKey(parts, index + 1);

                if (!(parentKey in nodes)) {
                    log(LogLevel.Warning, parentKey, 'not in', nodes);
                    return;
                }

                if (key in nodes) {
                    // Inner node already created
                    return;
                }

                nodes[key] = createNode(currentIndex, nodes[parentKey].index);
                edges.push(nodes[key].parentIndex);
                edges.push(currentIndex);
                names.set(currentIndex, value);
                currentIndex += 1;

                if (index == parts.length - 1) {
                    // Is leaf node
                    weights.push(leafWeights[partIndex] || 0.0);
                    heights.push(leafHeights[partIndex] || 0.0);
                    colors.push(leafColors[partIndex] || 0.0);
                } else {
                    // Is inner node
                    weights.push(0.0);
                    heights.push(0.0);
                    colors.push(0.0);
                }
            });
        });

        config.topology = {
            edges: edges,
            semantics: Topology.InputSemantics.ParentIdId,
            format: Topology.InputFormat.Interleaved,
        };

        config.buffers = [
            {
                identifier: 'source-weights',
                type: 'numbers',
                data: weights,
                linearization: 'topology',
            },
            {
                identifier: 'source-heights',
                type: 'numbers',
                data: heights,
                linearization: 'topology',
            },
            {
                identifier: 'source-colors',
                type: 'numbers',
                data: colors,
                linearization: 'topology',
            }
        ];

        config.bufferViews = [
            {
                identifier: 'weights',
                source: 'buffer:source-weights',
                transformations: [
                    { type: 'fill-invalid', value: 1.0, invalidValue: -1.0 },
                    { type: 'propagate-up', operation: 'sum' }
                ],
            },
            {
                identifier: 'heights-normalized',
                source: 'buffer:source-heights',
                transformations: [
                    { type: 'fill-invalid', value: 0.0, invalidValue: -1.0 },
                    { type: 'normalize', operation: 'zero-to-max' }
                ],
            },
            {
                identifier: 'colors-normalized',
                source: 'buffer:source-colors',
                transformations: [
                    { type: 'fill-invalid', value: 0.0, invalidValue: -1.0 },
                    { type: 'normalize', operation: 'zero-to-max' }
                ],
            }
        ];

        config.colors = [
            { identifier: 'emphasis', colorspace: 'hex', value: '#00b0ff' },
            { identifier: 'auxiliary', colorspace: 'hex', values: ['#00aa5e', '#71237c'] },
            { identifier: 'inner', colorspace: 'hex', values: ['#e8eaee', '#eef0f4'] },
            { identifier: 'leaf', preset: 'Greens', steps: 7 },
        ];

        config.layout = {
            algorithm: 'snake',
            weight: 'bufferView:weights',
            sort: {
                key: 'bufferView:weights',
                algorithm: NodeSort.Algorithm.Keep
            },
            parentPadding: { type: 'relative', value: 0.05 },
            siblingMargin: { type: 'relative', value: 0.05 },
            accessoryPadding: {
                type: 'absolute',
                direction: 'bottom',
                value: [0.0, 0.02, 0.01, 0.0],
                relativeAreaThreshold: 0.4, targetAspectRatio: 8.0,
            },
        };

        config.geometry = {
            parentLayer: { showRoot: false },
            leafLayer: {
                colorMap: 'color:leaf',
                height: 'bufferView:heights-normalized',
                colors: 'bufferView:colors-normalized',
            },
            emphasis: { outline: new Array<number>(), highlight: new Array<number>() },
            heightScale: header.height_scale,
        };

        config.labels = {
            innerNodeLayerRange: [1, 2],
            numTopInnerNodes: 50,
            numTopWeightNodes: 50,
            numTopHeightNodes: 50,
            numTopColorNodes: 50,
            names: names,
        };

        config.altered.alter('any');
    }

    static loadAsync(file: File): Promise<Configuration> {
        const header = new CBDHeader();

        const loader = new CSV({ delimiter: ';' });

        CBDData.initializeHeader(header);

        const payload = file.stream()
            .pipeThrough(new TextDecoderStream())
            .pipeThrough(new TransformStream(new CBDHeaderParser(header, loader)))
            .pipeThrough(new TextEncoderStream());

        loader.addDataSource('file', payload);

        return new Promise<Configuration>(async (resolve, reject) => {
            const config = new Configuration();

            const start = Date.now();
            console.log('Start parsing:', start);

            const detectedColumns = await loader.open('file');

            const { columns, statistics } = await loader.load({
                columns: detectedColumns,
                /*
                onInit: () => {
                    console.log('received columns', detectedColumns);
                    console.log(`detected ${detectedColumns!.length} columns:\n` +
                        detectedColumns!.map(({ name, type }) => `${name}: ${type}`).join('\n')
                    );
                },*/
                /*
                onUpdate: (progress) => console.log(`received new data. progress: ${progress}`),
                */
            });

            const parsed_csv = Date.now();
            console.log('End CSV parsing:', parsed_csv, parsed_csv - start);

            console.log(columns);

            CBDData.parseResult(columns, header, config);

            const parsed_config = Date.now();
            console.log('End Config parsing:', parsed_config, parsed_config - parsed_csv);

            console.log('Full runtime:', parsed_config - start);

            resolve(config);
        });
    }

}
