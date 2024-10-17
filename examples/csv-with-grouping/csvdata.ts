
/* spellchecker: disable */

import * as gloperate from 'webgl-operate';

import log = gloperate.auxiliaries.log;
import LogLevel = gloperate.auxiliaries.LogLevel;

import { parse } from 'papaparse';

import { Configuration, Topology, NodeSort } from '../../source/treemap-renderer';
import { LabelPaddingSide } from '../../source/labelmanagement';
import { isNumberObject } from 'util/types';

/* spellchecker: enable */


class CSVHeader {
    public groupings: string[];
    public weight_column: string;
    public height_column: string;
    public color_column: string;
    public label_column: string;
}

class Edge {
    public parentIndex;
    public index;
};


export class CSVData {
    protected static readonly CSV_FIELD_DELIMITER = ';';

    protected static readonly FAILED = (url: string, request: XMLHttpRequest) =>
        `fetching '${url}' failed (${request.status}): ${request.statusText}`;

    protected static initializeHeader(header: CSVHeader): void {
        header.groupings = [];
    }

    protected static initializeConfig(config: Configuration): void {
        config.colors = [
            { identifier: 'emphasis', colorspace: 'hex', value: '#00b0ff' },
            { identifier: 'auxiliary', colorspace: 'hex', values: ['#00aa5e', '#71237c'] },
            { identifier: 'inner', colorspace: 'hex', values: ['#e8eaee', '#eef0f4'] },
            { identifier: 'leaf', preset: 'inferno', steps: 7 },
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
            heightScale: 0.5,
        };

        config.labels = {
            innerNodeLayerRange: [0, 2],
            numTopInnerNodes: 50,
            numTopWeightNodes: 50,
            numTopHeightNodes: 50,
            numTopColorNodes: 50,
        };
    }

    protected static parseHeader(lines: Array<string>, header: CSVHeader): void {
        while (lines.length >= 1 && lines[0].startsWith('#')) {
            const line = lines.shift()!.substring(1).trim();

            const [key, value] = line.split('=').map((s: string) => s.trim());

            if (key == 'groupings') {
                header.groupings = value.split('/');
            } else if (key == 'weights') {
                header.weight_column = value;
            } else if (key == 'heights') {
                header.height_column = value;
            } else if (key == 'colors') {
                header.color_column = value;
            } else if (key == 'labels') {
                header.label_column = value;
            } else {
                log(LogLevel.Warning, `Unparsed header`, key, '=', value);
            }
        }
    }

    protected static parsePapaparseResult(result: any, header: CSVHeader, config: Configuration): void {
        const collect_column = (result: any, name: string) => {
            if (result.meta.fields.indexOf(name) < 0) {
                const column = new Array(result.data.length);
                return column;
            }

            const column = result.data.map((row: any) => {
                return row[name] ? parseFloat(row[name]) : -1.0;
            });

            return column;
        };

        const has_labels_column = (name: string) => result.meta.fields.indexOf(name) >= 0;

        const collect_labels_column = (result: any, name: string) => {
            if (result.meta.fields.indexOf(name) < 0) {
                const column = new Array<string>(result.data.length);
                return column;
            }

            const column = result.data.map((row: any) => {
                return row[name] ? row[name] : "";
            });

            return column;
        };

        // parse weights

        const weights = collect_column(result, header.weight_column);

        // parse heights

        const heights = collect_column(result, header.height_column);

        // parse colors

        const colors = collect_column(result, header.color_column);

        // parse labels

        const labels = collect_labels_column(result, header.label_column);

        // Load topology

        const createParentNode = (index: number, parentIndex: number): Edge => {
            return { parentIndex, index } as Edge;
        };

        const gatherParentKey = (groupings: string[], index: number, row: any[]): string => {
            const values = ['', ''];
            for (let i = 0; i < index; ++i) {
                values[i + 1] = row[groupings[i]] || '-';
            }

            return values.join('/');
        }

        const edges = new Array<Configuration.NodeIdentifier>();
        const names = new Map<number, string>();

        const parentNodes = {};
        let currentIndex = -1;

        // Create root
        parentNodes['/'] = createParentNode(currentIndex, -1);
        currentIndex += 1;

        const groupings = header.groupings;

        // Create inner nodes
        groupings.forEach((value, index) => {
            result.data.forEach((row: any[]) => {
                const parentParentKey = gatherParentKey(groupings, index, row);
                const parentKey = gatherParentKey(groupings, index + 1, row);

                if (!(parentParentKey in parentNodes)) {
                    log(LogLevel.Warning, parentParentKey, 'not in', parentNodes);
                    return;
                }

                if (!(parentKey in parentNodes)) {
                    parentNodes[parentKey] = createParentNode(currentIndex, parentNodes[parentParentKey].index);
                    edges.push(parentNodes[parentKey].parentIndex);
                    edges.push(currentIndex);
                    names.set(currentIndex, row[groupings[index]]);
                    currentIndex += 1;
                }
            });
        });

        const numberOfInnerNodes = currentIndex + 1;

        // Add leaf nodes
        result.data.forEach((row: any[]) => {
            const parentKey = gatherParentKey(groupings, groupings.length, row);

            if (!(parentKey in parentNodes)) {
                log(LogLevel.Warning, parentKey, 'not in', parentNodes);
                return;
            }

            edges.push(parentNodes[parentKey].index);
            edges.push(currentIndex);
            currentIndex += 1;
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
                data: (new Array(numberOfInnerNodes)).fill(0.0).concat(weights),
                linearization: 'topology',
            },
            {
                identifier: 'source-heights',
                type: 'numbers',
                data: (new Array(numberOfInnerNodes)).fill(0.0).concat(heights),
                linearization: 'topology',
            },
            {
                identifier: 'source-colors',
                type: 'numbers',
                data: (new Array(numberOfInnerNodes)).fill(0.0).concat(colors),
                linearization: 'topology',
            }
        ];

        config.bufferViews = [
            {
                identifier: 'weights',
                source: 'buffer:source-weights',
                transformations: [
                    { type: 'fill-invalid', value: 0.0, invalidValue: -1.0 },
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

        if (has_labels_column(header.label_column)) {
            for (let i = 0; i < labels.length; ++i) {
                names.set(i + numberOfInnerNodes - 1, labels[i]);
            }
        }

        config.labels.names = names;

        config.altered.alter('any');
    }

    static loadAsync(data: string): Promise<Configuration> {
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

            CSVData.initializeConfig(config);

            parse(data, {
                error: (error: any) => reject(error),
                complete: (result) => {
                    CSVData.parsePapaparseResult(result, header, config);

                    resolve(config);
                },
                delimiter: CSVData.CSV_FIELD_DELIMITER,
                quoteChar: '"',
                escapeChar: '"',
                header: true,
                comments: '#',
                skipEmptyLines: true
            });
        });
    }

}
