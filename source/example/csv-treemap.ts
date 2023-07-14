

/* spellchecker: disable */

import * as gloperate from 'webgl-operate';

/*
import {
    Configuration,
    Navigation,
    Renderer,
    CSVData,
    Visualization,
    initialize
} from '@varg-dev/treemap-webgl';
*/

import { Example } from './example';

/* spellchecker: enable */


// tslint:disable:max-classes-per-file

export class CsvTreemapExample extends Example {

    validate(element: HTMLCanvasElement | string): boolean {
        return this.initialize(element);
    }

    preview(element: HTMLCanvasElement | string): boolean {
        return this.initialize(element);
    }

    feature(element: HTMLCanvasElement | string): boolean {

        const success = this.initialize(element);

        // export variables

        (window as any)['gloperate'] = gloperate;

        const dataElement = window.document.getElementById('csv-data')! as HTMLTextAreaElement;
        const hashElement = window.document.getElementById('data-hash')! as HTMLPreElement;
        const reloadElement = window.document.getElementById('reload')! as HTMLButtonElement;

        if (dataElement !== undefined) {
            const searchParams = new URLSearchParams(window.location.search);
            const data = searchParams.get('data');

            if (data) {
                console.log("Load from", data);
                dataElement.value = atob(data);
                // TODO: refactor to use Buffer.from(data, 'base64')
            }

            dataElement.oninput = (event) => {
                // const testdata = dataElement.value;
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

        super.expose();

        return true;
    }

    uninitialize(): void {
    }

}
