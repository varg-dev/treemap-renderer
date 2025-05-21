
/* spellchecker: disable */

import * as gloperate from 'webgl-operate';

import log = gloperate.auxiliaries.log;
import LogLevel = gloperate.auxiliaries.LogLevel;

import { parse } from 'papaparse';

import { Configuration, Topology, NodeSort } from '../../source/treemap-renderer';

/* spellchecker: enable */


export class CSVHeader {
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


export class CSVData {
    protected static readonly FAILED = (url: string, request: XMLHttpRequest) =>
        `fetching '${url}' failed (${request.status}): ${request.statusText}`;

    protected static initializeHeader(header: CSVHeader): void {
        header.csv_delimiter = ';';
        header.path_column = 'name';
    }

    protected static parseHeader(lines: Array<string>, header: CSVHeader): void {
        while (lines.length >= 1 && lines[0].startsWith('#')) {
            const line = lines.shift()!.substring(1).trim();

            const [key, value] = line.split('=').map((s: string) => s.trim());

            if (key == 'delimiter') {
                header.csv_delimiter = value || ';';
            } else if (key == 'paths') {
                header.path_column = value || 'name';
            } else if (key == 'weights') {
                header.weight_column = value || '';
            } else if (key == 'heights') {
                header.height_column = value || '';
            } else if (key == 'colors') {
                header.color_column = value || '';
            } else if (key == 'labels') {
                header.label_column = value || '';
            } else if (key == 'heightScale') {
                header.height_scale = Number.parseFloat(value || '0.1') || 0.1;
            } else {
                log(LogLevel.Warning, `Unparsed header`, key, '=', value);
            }
        }
    }

    protected static parsePapaparseResult(result: any, header: CSVHeader, config: Configuration): void {
        const collect_string_column = (result: any, name: string): Array<string> => {
            if (result.meta.fields.indexOf(name) < 0) {
                const column = new Array<string>(result.data.length);
                return column;
            }

            const column = (result.data as Array<string>).map((row: any) => {
                return row[name] ? row[name] : "";
            });

            return column;
        };

        const collect_column = (result: any, name: string) => {
            if (result.meta.fields.indexOf(name) < 0) {
                const column = new Array(result.data.length);
                column.fill(-1);
                return column;
            }

            const column = result.data.map((row: any) => {
                return row[name] ? parseFloat(row[name]) : -1.0;
            });

            return column;
        };

        const has_labels_column = (name: string) => result.meta.fields.indexOf(name) >= 0;

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
        weights.push(0);
        heights.push(0);
        colors.push(0);

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
                    weights.push(leafWeights[partIndex]);
                    heights.push(leafHeights[partIndex]);
                    colors.push(leafColors[partIndex]);
                } else {
                    // Is inner node
                    weights.push(0);
                    heights.push(0);
                    colors.push(0);
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

    static async loadAsync(file: File): Promise<Configuration> {
        const data = await file.text();

        const header = new CSVHeader();

        CSVData.initializeHeader(header);

        const lines = data.split('\n');

        CSVData.parseHeader(lines, header);

        const payload = lines.join('\n');

        return this.loadAsyncHeader(payload, header);
    }

    static loadAsyncHeader(data: string, header: CSVHeader): Promise<Configuration> {
        return new Promise<Configuration>((resolve, reject) => {
            const config = new Configuration();

            parse(data, {
                error: (error: any) => reject(error),
                complete: (result) => {
                    CSVData.parsePapaparseResult(result, header, config);

                    resolve(config);
                },
                delimiter: header.csv_delimiter,
                quoteChar: '"',
                escapeChar: '"',
                header: true,
                comments: '#',
                skipEmptyLines: true
            });
        });
    }

}
