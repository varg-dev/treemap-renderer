
// https://tc39.github.io/ecma262/#sec-array.prototype.find
// Source: MDN
if (!Array.prototype.find) {
    Object.defineProperty(Array.prototype, 'find', {
        value(predicate: any): undefined | any {
            // 1. Let O be ? ToObject(this value).
            if (this === null) {
                throw new TypeError('"this" is null or not defined');
            }

            const o = Object(this);

            // 2. Let len be ? ToLength(? Get(O, "length")).
            const len = o.length >>> 0;

            // 3. If IsCallable(predicate) is false, throw a TypeError exception.
            if (typeof predicate !== 'function') {
                throw new TypeError('predicate must be a function');
            }

            // 4. If thisArg was supplied, let T be thisArg; else let T be undefined.
            const thisArg = arguments[1];

            // 5. Let k be 0.
            let k = 0;

            // 6. Repeat, while k < len
            while (k < len) {
                // a. Let Pk be ! ToString(k).
                // b. Let kValue be ? Get(O, Pk).
                // c. Let testResult be ToBoolean(? Call(predicate, T, « kValue, k, O »)).
                // d. If testResult is true, return kValue.
                const kValue = o[k];
                if (predicate.call(thisArg, kValue, k, o)) {
                    return kValue;
                }
                // e. Increase k by 1.
                k++;
            }

            // 7. Return undefined.
            return undefined;
        },
        configurable: true,
        writable: true,
    });
}

// Production steps of ECMA-262, Edition 5, 15.4.4.18
// Reference: http://es5.github.io/#x15.4.4.18
// Source: MDN
if (!Array.prototype.forEach) {
    // tslint:disable-next-line:space-before-function-paren
    Array.prototype.forEach = function (callback /*, thisArg*/): void {

        let T;
        let k;

        if (this === null) {
            throw new TypeError('this is null or not defined');
        }

        // 1. Let O be the result of calling toObject() passing the
        // |this| value as the argument.
        const O = Object(this);

        // 2. Let lenValue be the result of calling the Get() internal
        // method of O with the argument "length".
        // 3. Let len be toUint32(lenValue).
        const len = O.length >>> 0;

        // 4. If isCallable(callback) is false, throw a TypeError exception.
        // See: http://es5.github.com/#x9.11
        if (typeof callback !== 'function') {
            throw new TypeError(callback + ' is not a function');
        }

        // 5. If thisArg was supplied, let T be thisArg; else let
        // T be undefined.
        if (arguments.length > 1) {
            T = arguments[1];
        }

        // 6. Let k be 0.
        k = 0;

        // 7. Repeat while k < len.
        while (k < len) {

            let kValue;

            // a. Let Pk be ToString(k).
            //    This is implicit for LHS operands of the in operator.
            // b. Let kPresent be the result of calling the HasProperty
            //    internal method of O with argument Pk.
            //    This step can be combined with c.
            // c. If kPresent is true, then
            if (k in O) {

                // i. Let kValue be the result of calling the Get internal
                // method of O with argument Pk.
                kValue = O[k];

                // ii. Call the Call internal method of callback with T as
                // the this value and argument list containing kValue, k, and O.
                callback.call(T, kValue, k, O);
            }
            // d. Increase k by 1.
            k++;
        }
        // 8. return undefined.
    };
}

// Source: MDN
if (!Array.prototype.fill) {
    Object.defineProperty(Array.prototype, 'fill', {
        value(value: any): void {

            // Steps 1-2.
            if (this === null) {
                throw new TypeError('this is null or not defined');
            }

            const O = Object(this);

            // Steps 3-5.
            const len = O.length >>> 0;

            // Steps 6-7.
            const start = arguments[1];
            const relativeStart = start >> 0;

            // Step 8.
            let k = relativeStart < 0 ?
                Math.max(len + relativeStart, 0) :
                Math.min(relativeStart, len);

            // Steps 9-10.
            const end = arguments[2];
            const relativeEnd = end === undefined ?
                len : end >> 0;

            // Step 11.
            const final = relativeEnd < 0 ?
                Math.max(len + relativeEnd, 0) :
                Math.min(relativeEnd, len);

            // Step 12.
            while (k < final) {
                O[k] = value;
                k++;
            }

            // Step 13.
            return O;
        },
    });
}


// https://tc39.github.io/ecma262/#sec-%typedarray%.prototype.fill
// Source: MDN
if (!Uint8Array.prototype.fill) {
    (Uint8Array.prototype as any).fill = Array.prototype.fill;
}

// https://tc39.github.io/ecma262/#sec-%typedarray%.prototype.fill
// Source: MDN
if (!Float32Array.prototype.fill) {
    (Float32Array.prototype.fill as any) = Array.prototype.fill;
}

// tslint:disable-next-line:max-line-length
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypedArray/slice#Polyfill
[Float32Array, Uint8Array, Int8Array, Uint32Array, Int32Array].forEach((arrayType) => {
    if (!arrayType.prototype.slice) {
        Object.defineProperty(arrayType.prototype, 'slice', { value: Array.prototype.slice });
    }
    if (!arrayType.prototype.filter) {
        Object.defineProperty(arrayType.prototype, 'filter', { value: Array.prototype.filter });
    }
    if (!arrayType.prototype.map) {
        Object.defineProperty(arrayType.prototype, 'map', { value: Array.prototype.map });
    }
    if (!arrayType.prototype.indexOf) {
        Object.defineProperty(arrayType.prototype, 'indexOf', { value: Array.prototype.indexOf });
    }
});
