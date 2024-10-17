
interface Base64ArrayBuffer {
    decode(base64: string): ArrayBuffer;
}
/* tslint:disable-next-line:no-var-requires */
import * as Base64ArrayBuffer from 'base64-arraybuffer';
// const Base64ArrayBuffer = require('base64-arraybuffer') as Base64ArrayBuffer;


namespace base64 {

    export function decode(base64: string): ArrayBuffer {
        return Base64ArrayBuffer.decode(base64);
    }

}

export default base64;
