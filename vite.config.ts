
import { resolve } from 'path';
import git from 'git-rev-sync';

import { defineConfig, UserConfigExport } from 'vite';
// import { visualizer } from 'rollup-plugin-visualizer';

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
 * 3 modes are considered:
 * - Development: don't emit anything, serve website and library in dev mode. (development, vite dev)
 * - Lib Prod: Emit library build as cjs, umd, and es. (production, vite build)
 * - Website Prod: Emit website with library as dependency. (website, vite build --mode=website)
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

    switch (mode) {

        case 'development':
            config.build = {
                outDir,
                lib: {
                    entry: resolve(source, 'treemap-renderer.ts'),
                    name: 'treemap-renderer',
                    formats: ['cjs', 'umd', 'es'],
                },
                sourcemap: 'hidden',
            };
            break;

        case 'website':
            config.base = '/treemap-renderer/';
            pug_locals.base = config.base;
            config.build = {
                outDir: websiteDir,
                sourcemap: 'hidden',
                rollupOptions: {
                    input: {
                        main: resolve(__dirname, 'index.html'),
                        explicit: resolve(__dirname, 'examples/csv-with-explicit-inner-nodes/index.html'),
                        grouping: resolve(__dirname, 'examples/csv-with-grouping/index.html'),
                        implicit: resolve(__dirname, 'examples/csv-with-implicit-inner-nodes/index.html'),
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
                // emptyOutDir: true,
                lib: {
                    entry: resolve(source, 'treemap-renderer.ts'),
                    name: 'treemap-renderer',
                    formats: ['cjs', 'umd', 'es'],
                },
                sourcemap: 'hidden',
            };
            config.define!.__DISABLE_ASSERTIONS__ = JSON.stringify(true);
            config.define!.__LOG_VERBOSITY_THRESHOLD__ = JSON.stringify(2);
            break;

    }

    config.plugins = [pugPlugin(pug_options, pug_locals), glsl()]; // visualizer()

    return config;
});
