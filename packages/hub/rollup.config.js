/* eslint-disable node/no-unsupported-features/es-syntax */

import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import babel from '@rollup/plugin-babel';
import json from '@rollup/plugin-json';
import replace from '@rollup/plugin-replace';
import graph from 'rollup-plugin-graph';
import nativePlugin from 'rollup-plugin-natives';
import path from 'path';

export default {
  input: 'bin/hub.cjs',
  output: {
    dir: 'dist',
    format: 'cjs',
    sourcemap: true,
    exports: 'default',
  },
  external: ['config', 'readable-stream', 'parse-asn1', 'discord.js', 'glob'],
  onwarn(warning, rollupWarn) {
    console.log(warning);
  },
  plugins: [
    replace({
      // the dependency "formidable" includes code for hijacking require that it
      // doesn't need that generates build warnings. This silences them.
      'require = GENTLY.hijack(require)': 'true',

      // these are optional dependencies.
      "require('electron')": "(function(){ var e = new Error(); e.code='MODULE_NOT_FOUND'; throw e })",
      "require('ffmpeg-static')": "(function(){ var e = new Error(); e.code='MODULE_NOT_FOUND'; throw e })",

      // it's hard to actually use the delimters option correctly due to
      // https://github.com/rollup/plugins/issues/904 we don't want the default
      // because our patterns don't end with word characters, so the trailing
      // /\b/ won't match. But we can't actually keep the default leading
      // delimter due to the bug.
      delimiters: ['', ''],
    }),
    replace({
      "require('./native')": "(function(){ var e = new Error(); e.code='MODULE_NOT_FOUND'; throw e })",
      delimiters: ['', ''],
      include: [path.relative(process.cwd(), require.resolve('pg/lib/index.js'))],
    }),
    replace({
      delimiters: ['', ''],
    }),
    //customPatches(),
    nodeResolve({ preferBuiltins: true, extensions: ['.mjs', '.js', '.json', '.node', '.ts'] }),
    commonjs({
      //dynamicRequireTargets: ['./config/*.cjs', '../../node_modules/split2/node_modules/readable-stream/lib/*.js'],
    }),
    babel({
      plugins: ['@babel/plugin-transform-typescript', ['@babel/plugin-proposal-decorators', { legacy: true }]],
      babelHelpers: 'bundled',
      extensions: ['.ts'],
    }),
    // graph(),
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
      if (/pg\/lib\/index/.test(requester)) {
        console.log(
          `${requester} ${requester?.endsWith('node_modules/pg/lib/index.js')} ${importee} ${/^\0?\.\/native/.test(
            importee
          )}`
        );
      }
      if (requester?.endsWith('node_modules/pg/lib/index.js') && /^\0?\.\/native/.test(importee)) {
        return runtimeFailure(importee);
      }

      // if (['pg-native', 'electron', 'ffmpeg-static'].includes(importee)) {
      //   return runtimeFailure(importee);
      // }
      return null;
    },
    load(id) {
      return id.startsWith(`\0custom_patches_runtime_failure`) ? runtimeFailureCode(id) : null;
    },
  };
}
