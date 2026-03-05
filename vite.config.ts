
import { resolve } from 'path';
import git from 'git-rev-sync';

import { defineConfig, UserConfigExport } from 'vite';

import pugPlugin from 'vite-plugin-pug';
import glsl from 'vite-plugin-glsl';

const root = resolve(__dirname, '.');
const source = resolve(__dirname, 'source');
const outDir = resolve(__dirname, 'dist');
const websiteDir = resolve(__dirname, 'website');

const pug_options = { localImports: true }
const pug_locals = {
    name: "VARG Treemap Renderer",
    base: '/'
}

let commit = '';
try {
    commit = git.short(__dirname);
} catch {
    // nothing
}

let branch = '';
try {
    branch = git.branch(__dirname);
} catch {
    // nothing
}

/**
 * 4 modes are considered:
 * - Development: don't emit anything, serve website and library in dev mode. (development, vite dev)
 * - Fast: local iteration build (no minify, no d.ts, no sourcemaps). (fast, vite build --mode=fast)
 * - Production: standard lib build as cjs + es. (production, vite build)
 * - Release: lib build as cjs + umd + es. (release, vite build --mode=release)
 * - Website: static website build. (website, vite build --mode=website)
 */
export default defineConfig(({ mode }) => {

    const config: UserConfigExport = {
        root,
        define: {
            __GIT_COMMIT__: JSON.stringify(commit),
            __GIT_BRANCH__: JSON.stringify(branch),
            __LIB_NAME__: JSON.stringify(process.env.npm_package_name),
            __LIB_VERSION__: JSON.stringify(process.env.npm_package_version),
        },
        assetsInclude: ['**/*.fnt'],
    };

    const libExternal = ['webgl-operate', 'rxjs'];
    const umdGlobals = {
        'webgl-operate': 'webgl_operate',
        rxjs: 'rxjs',
    };

    switch (mode) {

        case 'development':
            config.build = {
                outDir,
                lib: {
                    entry: resolve(source, 'treemap-renderer.ts'),
                    name: 'treemap-renderer',
                    formats: ['cjs', 'es'],
                },
                sourcemap: false,
                rollupOptions: {
                    external: libExternal,
                },
            };
            break;

        case 'fast':
            config.build = {
                outDir,
                lib: {
                    entry: resolve(source, 'treemap-renderer.ts'),
                    name: 'treemap-renderer',
                    formats: ['cjs', 'es'],
                },
                minify: false,
                sourcemap: false,
                rollupOptions: {
                    external: libExternal,
                },
            };
            config.define!.__DISABLE_ASSERTIONS__ = JSON.stringify(true);
            config.define!.__LOG_VERBOSITY_THRESHOLD__ = JSON.stringify(2);
            break;

        case 'release':
            config.build = {
                outDir,
                lib: {
                    entry: resolve(source, 'treemap-renderer.ts'),
                    name: 'treemap-renderer',
                    formats: ['cjs', 'umd', 'es'],
                },
                sourcemap: false,
                rollupOptions: {
                    external: libExternal,
                    output: {
                        globals: umdGlobals,
                    }
                },
            };
            config.define!.__DISABLE_ASSERTIONS__ = JSON.stringify(true);
            config.define!.__LOG_VERBOSITY_THRESHOLD__ = JSON.stringify(2);
            break;

        case 'website':
            config.base = '/treemap-renderer/';
            pug_locals.base = config.base;
            config.build = {
                outDir: websiteDir,
                sourcemap: false,
                rollupOptions: {
                    input: {
                        main: resolve(__dirname, 'index.html'),
                        file: resolve(__dirname, 'examples/csv-file-with-implicit-inner-nodes/index.html'),
                        explicit: resolve(__dirname, 'examples/csv-with-explicit-inner-nodes/index.html'),
                        twodimensional: resolve(__dirname, 'examples/2D-view-csv-with-explicit-inner-nodes/index.html'),
                        nominal: resolve(__dirname, 'examples/nominal-data-csv-with-explicit-inner-nodes/index.html'),
                        grouping: resolve(__dirname, 'examples/csv-with-grouping/index.html'),
                        implicit: resolve(__dirname, 'examples/csv-with-implicit-inner-nodes/index.html'),
                        diverging: resolve(__dirname, 'examples/diverging-data-csv-with-explicit-inner-nodes/index.html'),
                        direct: resolve(__dirname, 'examples/direct-config/index.html'),

                    },
                    output: {
                        inlineDynamicImports: false,
                    }
                }
            };
            break;

        case 'production':
        default:
            config.build = {
                outDir,
                lib: {
                    entry: resolve(source, 'treemap-renderer.ts'),
                    name: 'treemap-renderer',
                    formats: ['cjs', 'es'],
                },
                sourcemap: false,
                rollupOptions: {
                    external: libExternal,
                },
            };
            config.define!.__DISABLE_ASSERTIONS__ = JSON.stringify(true);
            config.define!.__LOG_VERBOSITY_THRESHOLD__ = JSON.stringify(2);
            break;

    }

    config.plugins = [pugPlugin(pug_options, pug_locals), glsl()];

    return config;
});
