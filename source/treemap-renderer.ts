
/**
 * If true, assertions immediately return on invocation (variable can be set via webpack define plugin).
 */
declare var DISABLE_ASSERTIONS: boolean;

/**
 * If defined, logs of equal or higher verbosity level are skipped (variable can be set via webpack
 * define plugin).
 */
declare var LOG_VERBOSITY_THRESHOLD: number; // -1 disables all logs


import * as webgl_operate from 'webgl-operate';

/* Override webgl-operate defaults for logging verbosity and assertion. The typeof code is required in
order to keep the tests running (webpack is not used for testing). */
if (typeof LOG_VERBOSITY_THRESHOLD !== 'undefined') {
    webgl_operate.auxiliaries.logVerbosity(LOG_VERBOSITY_THRESHOLD);
}
if (typeof DISABLE_ASSERTIONS !== 'undefined') {
    webgl_operate.auxiliaries.assertions(!DISABLE_ASSERTIONS);
}

export import gloperate = webgl_operate;


/* spellchecker: disable */

export { Configuration } from './configuration';
export { ConfigurationAids } from './configurationaids';
export { Renderer } from './renderer';
export { Visualization } from './visualization';

export { Topology } from './topology';
export { AttributeBuffer } from './attributebuffer';
export { Layout } from './layout';
export { GeometryCreation } from './geometrycreation';

export { NodeSort } from './nodesort';

export { Navigation } from './navigation';

export * from './initialize';
