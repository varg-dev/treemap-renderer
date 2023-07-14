
import { resolve } from 'path';
import git from 'git-rev-sync';

import { defineConfig, UserConfigExport } from 'vite';
// import { visualizer } from 'rollup-plugin-visualizer';

import pugPlugin from "vite-plugin-pug";

const root = resolve(__dirname, 'source');
const outDir = resolve(__dirname, 'dist');

const pug_options = { localImports: true }
const pug_locals = { name: "VARG dev Treemap Renderer" }

export default defineConfig(({ mode }) => {

    const config: UserConfigExport = {
        root,
        plugins: [pugPlugin(pug_options, pug_locals)], // visualizer()
        build: {
            outDir,
            lib: {
                entry: resolve(root, 'index.ts'),
                name: 'varg-dev-treemap-renderer',
                formats: ['cjs', 'umd', 'es'],
                // fileName: (format: ModuleFormat): string => format === 'umd' ? 'index.js' : `varg-dev-treemap-renderer.${format}.js`
            },
            sourcemap: 'hidden',
            // rollupOptions: {
            //     external: ['rxjs'],
            //     output: {
            //         globals: {
            //             rxjs: 'rxjs'
            //         }
            //     }
            // }
        },
        define: {
            __GIT_COMMIT__: JSON.stringify(git.short(__dirname)),
            __GIT_BRANCH__: JSON.stringify(git.branch(__dirname)),
            __LIB_NAME__: JSON.stringify(process.env.npm_package_name),
            __LIB_VERSION__: JSON.stringify(process.env.npm_package_version),
        },
    };

    // switch (command) {

    //     case 'serve':
    //         break;

    //     case 'build':
    //     default:
    //         break;
    // }

    switch (mode) {

        case 'development':
            config.build.outDir = outDir;
            break;

        case 'production':
        default:
            config.build.emptyOutDir = true;
            // config.define.__DISABLE_ASSERTIONS__ = JSON.stringify(true);
            // config.define.__LOG_VERBOSITY_THRESHOLD__ = JSON.stringify(2);
            break;
    }

    console.log(config);
    return config;
});
