
import { resolve } from 'path';
import git from 'git-rev-sync';

import { defineConfig, UserConfigExport } from 'vite';
// import { visualizer } from 'rollup-plugin-visualizer';

import pugPlugin from 'vite-plugin-pug';
import glsl from 'vite-plugin-glsl';

const root = resolve(__dirname, '.');
const source = resolve(__dirname, 'source');
const outDir = resolve(__dirname, 'dist');

const pug_options = { localImports: true }
const pug_locals = { name: "VARG Treemap Renderer" }

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

export default defineConfig(({ mode }) => {

    const config: UserConfigExport = {
        root,
        plugins: [pugPlugin(pug_options, pug_locals), glsl()], // visualizer()
        build: {
            outDir,
            lib: {
                entry: resolve(source, 'treemap-renderer.ts'),
                name: 'treemap-renderer',
                formats: ['cjs', 'umd', 'es'],
            },
            sourcemap: 'hidden',
            // rollupOptions: {
            //     external: ['rxjs'],
            //     output: {
            //         globals: {
            //             rxjs: 'rxjs'
            //         }
            //     }
            // input: {
            //     main: resolve(__dirname, 'examples/index.html'),
            // },
            // },
            // commonjsOptions: { include: [/webgl-operate/, /papaparse/] },
        },
        define: {
            __GIT_COMMIT__: JSON.stringify(commit),
            __GIT_BRANCH__: JSON.stringify(branch),
            __LIB_NAME__: JSON.stringify(process.env.npm_package_name),
            __LIB_VERSION__: JSON.stringify(process.env.npm_package_version),
        },
        assetsInclude: ['**/*.fnt'],
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
            config.build!.outDir = outDir;
            break;

        case 'production':
        default:
            config.build!.emptyOutDir = true;
            config.define!.__DISABLE_ASSERTIONS__ = JSON.stringify(true);
            config.define!.__LOG_VERBOSITY_THRESHOLD__ = JSON.stringify(2);
            break;
    }

    return config;
});
