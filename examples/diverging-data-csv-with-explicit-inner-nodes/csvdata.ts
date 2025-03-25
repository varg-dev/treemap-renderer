
/* spellchecker: disable */

import * as gloperate from 'webgl-operate';

import log = gloperate.auxiliaries.log;
import LogLevel = gloperate.auxiliaries.LogLevel;

import { parse } from 'papaparse';

import { Configuration, Topology, NodeSort } from '../../source/treemap-renderer';

/* spellchecker: enable */


export class CSVHeader {
    public csv_delimiter: string;
    public id_column: string;
    public parent_column: string;
    public weight_column: string;
    public height_column: string;
    public color_column: string;
    public label_column: string;
}


export class CSVData {
    protected static readonly FAILED = (url: string, request: XMLHttpRequest) =>
        `fetching '${url}' failed (${request.status}): ${request.statusText}`;

    protected static initializeHeader(header: CSVHeader): void {
        header.csv_delimiter = ';';
        header.id_column = 'ids';
        header.parent_column = 'parents';
    }

    protected static parseHeader(lines: Array<string>, header: CSVHeader): void {
        while (lines.length >= 1 && lines[0].startsWith('#')) {
            const line = lines.shift()!.substring(1).trim();

            const [key, value] = line.split('=').map((s: string) => s.trim());

            if (key == 'delimiter') {
                header.csv_delimiter = value || ';';
            } else if (key == 'ids') {
                header.id_column = value || 'ids';
            } else if (key == 'parents') {
                header.parent_column = value || 'parents';
            } else if (key == 'weights') {
                header.weight_column = value || '';
            } else if (key == 'heights') {
                header.height_column = value || '';
            } else if (key == 'colors') {
                header.color_column = value || '';
            } else if (key == 'labels') {
                header.label_column = value || '';
            } else {
                log(LogLevel.Warning, `Unparsed header`, key, '=', value);
            }
        }
    }

    protected static parsePapaparseResult(result: any, header: CSVHeader, config: Configuration): void {
        const collect_id_column = (result: any, name: string) => {
            if (result.meta.fields.indexOf(name) < 0) {
                const column = new Uint32Array(result.data.length);
                return column;
            }

            const column = result.data.map((row: any) => {
                return row[name] ? row[name] : 0;
            });

            return Uint32Array.from(column);
        };

        const collect_column = (result: any, name: string) => {
            if (result.meta.fields.indexOf(name) < 0) {
                const column = new Float32Array(result.data.length);
                return column;
            }

            const column = result.data.map((row: any) => {
                return row[name] ? row[name] : -1.0;
            });

            return Float32Array.from([0].concat(column));
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

        // parse edges

        const ids = collect_id_column(result, header.id_column);
        const parents = collect_id_column(result, header.parent_column);

        // parse weights

        const weights = collect_column(result, header.weight_column);

        // parse heights

        const heights = collect_column(result, header.height_column);

        // parse colors

        const colors = collect_column(result, header.color_column);

        // parse labels

        const labels = collect_labels_column(result, header.label_column);

        // Load topology

        const edges = new Array<Configuration.NodeIdentifier>();

        for (let i = 0; i < ids.length; i++) {
            const id = ids[i];
            const parentId = parents[i];

            // assert parentId == 0

            edges.push(parentId);
            edges.push(id);
        }

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
                    { type: 'normalize', operation: 'diverging', neutralElement: 0.5 }
                ],
            }
        ];

        if (has_labels_column(header.label_column)) {
            const names = new Map<number, string>();

            for (let i = 0; i < labels.length; ++i) {
                names.set(ids[i], labels[i]);
            }

            config.labels = {
                innerNodeLayerRange: [1, 2],
                numTopInnerNodes: 50,
                numTopWeightNodes: 50,
                numTopHeightNodes: 50,
                numTopColorNodes: 50,
                names: names
            };
        }

        config.colors = [
            { identifier: 'emphasis', colorspace: 'hex', value: '#00b0ff' },
            { identifier: 'auxiliary', colorspace: 'hex', values: ['#00aa5e', '#71237c'] },
            { identifier: 'inner', colorspace: 'hex', values: ['#e8eaee', '#eef0f4'] },
            { identifier: 'leaf', preset: 'BrBG', steps: 7 },
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
                colorsNormalized: true
            },
            emphasis: { outline: new Array<number>(), highlight: new Array<number>() },
            heightScale: 0.5,
        };

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
