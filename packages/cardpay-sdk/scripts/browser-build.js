const esbuild = require('esbuild');
const { NodeModulesPolyfillPlugin } = require('@esbuild-plugins/node-modules-polyfill');
const { NodeGlobalsPolyfillPlugin } = require('@esbuild-plugins/node-globals-polyfill');

esbuild
  .build({
    entryPoints: ['index.ts'],
    bundle: true,
    minify: true,
    sourcemap: true,
    platform: 'browser',
    target: ['es2020'],
    outfile: 'dist/browser.js',
    format: 'esm',
    plugins: [
      NodeGlobalsPolyfillPlugin({
        buffer: true,
      }),
      NodeModulesPolyfillPlugin(),
    ],
  })
  .then(console.log('build succesful'))
  .catch((e) => console.error('build failed with error:', e));
