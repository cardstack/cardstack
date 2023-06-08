const esbuild = require('esbuild');
const { NodeModulesPolyfillPlugin } = require('@esbuild-plugins/node-modules-polyfill');
const { NodeGlobalsPolyfillPlugin } = require('@esbuild-plugins/node-globals-polyfill');

console.log('esbuild: beginning build for browser');
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
      //here are all the polyfills https://github.com/remorses/esbuild-plugins/blob/master/node-modules-polyfill/src/polyfills.ts
      //it relies on these rollup-plugin-node-polyfills https://github.com/ionic-team/rollup-plugin-node-polyfills
    ],
  })
  .then(console.log('esbuild: build for browser succesful'))
  .catch((e) => console.error('esbuild: build for browser failed with error:', e));
