/* eslint-disable node/no-unsupported-features/es-syntax */

import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import babel from '@rollup/plugin-babel';
import json from '@rollup/plugin-json';
import replace from '@rollup/plugin-replace';
//import graph from 'rollup-plugin-graph';
import nativePlugin from 'rollup-plugin-natives';

export default {
  input: 'bin/hub.cjs',
  output: {
    dir: 'dist',
    format: 'cjs',
    sourcemap: true,
    exports: 'default',
  },
  external: ['config', 'pg-native'],
  plugins: [
    replace({
      // the dependency "formidable" includes code for hijacking require that it
      // doesn't need that generates build warnings. This silences them.
      'require = GENTLY.hijack(require)': 'true',
      delimiters: ['', ''],
    }),
    //customPatches(),
    nodeResolve({ preferBuiltins: true, extensions: ['.mjs', '.js', '.json', '.node', '.ts'] }),
    commonjs({
      ignore: ['pg-native', 'electron', 'ffmpeg-static'],
      dynamicRequireTargets: ['./config/*.cjs', '../../node_modules/split2/node_modules/readable-stream/lib/*.js'],
    }),
    babel({
      plugins: ['@babel/plugin-transform-typescript', ['@babel/plugin-proposal-decorators', { legacy: true }]],
      babelHelpers: 'bundled',
      extensions: ['.ts'],
    }),
    //graph(),
    json(),

    // TODO: this is unused so far, if it remains so we should remove it
    nativePlugin({
      copyTo: 'dist/libs',
      destDir: './libs',
    }),
  ],
};

function customPatches() {
  function runtimeFailure(importee) {
    return `\0custom_patches_runtime_failure?i=${importee}`;
  }
  function runtimeFailureCode(name) {
    return `
    let err = new Error("${name} does not exist and we did not expect it to actually get used");
    err.code = 'MODULE_NOT_FOUND';
    throw err;
    export default {};
  `;
  }

  return {
    name: 'custom-patches',
    resolveId(importee, requester) {
      if (requester?.endsWith('node_modules/pg/lib/index.js') && /\0?\.\/native/.test(importee)) {
        return runtimeFailure(importee);
      }

      if (['pg-native', 'electron', 'ffmpeg-static'].includes(importee)) {
        return runtimeFailure(importee);
      }
      return null;
    },
    load(id) {
      return id.startsWith(`\0custom_patches_runtime_failure`) ? runtimeFailureCode(id) : null;
    },
  };
}
