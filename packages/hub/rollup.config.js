/* eslint-disable node/no-unsupported-features/es-syntax */

import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import babel from '@rollup/plugin-babel';
import json from '@rollup/plugin-json';
import replace from '@rollup/plugin-replace';
import path from 'path';

export default {
  input: 'bin/hub.cjs',
  output: {
    dir: 'dist',
    format: 'cjs',
    sourcemap: true,
    exports: 'default',
  },
  external: [
    // these are here because they contain cycles *and* actually try to invoke
    // each other during module evaluation, such that they actually fail if you
    // convert them to ES modules.
    'readable-stream',
    'parse-asn1',
    'discord.js',
    'glob',

    // this one tries to load some sql relative to its own source at runtime
    'graphile-worker',

    // this one does a dynamic require() of an absolute path that's not
    // compatible with @rollup/plugin-commonjs
    'config',
  ],
  plugins: [
    replace({
      // these are optional dependencies of our dependencies. We don't want
      // rollup to try to process them eagerly.
      "require('electron')": "(function(){ var e = new Error(); e.code='MODULE_NOT_FOUND'; throw e })",
      "require('ffmpeg-static')": "(function(){ var e = new Error(); e.code='MODULE_NOT_FOUND'; throw e })",

      // it's hard to actually use the delimters option correctly due to
      // https://github.com/rollup/plugins/issues/904 we don't want the default
      // because our patterns don't end with word characters, so the trailing
      // /\b/ won't match. But we can't actually keep the default leading
      // delimter due to the bug.
      delimiters: ['', ''],
      preventAssignment: true,
    }),
    replace({
      // pg expects this module to fail to load if the optional pg-native
      // implementation is not present. We don't want it rolled up to the top
      // level because that would escape the try/catch
      "require('./native')": "(function(){ var e = new Error(); e.code='MODULE_NOT_FOUND'; throw e })",
      delimiters: ['', ''],
      include: [path.relative(process.cwd(), require.resolve('pg/lib/index.js'))],
      preventAssignment: true,
    }),
    nodeResolve({ preferBuiltins: true, extensions: ['.mjs', '.js', '.json', '.node', '.ts'] }),
    commonjs(),
    babel({
      plugins: ['@babel/plugin-transform-typescript', ['@babel/plugin-proposal-decorators', { legacy: true }]],
      babelHelpers: 'bundled',
      extensions: ['.ts'],
    }),
    json(),
  ],
  onwarn(warning, rollupWarn) {
    if (
      ['EVAL', 'THIS_IS_UNDEFINED', 'ILLEGAL_NAMESPACE_REASSIGNMENT'].includes(warning.code) &&
      /\/node_modules\//.test(warning.loc.file)
    ) {
      // these warnings aren't fatal and they're talking about problems in
      // third-party code that we don't control
    } else if (warning.code === 'CIRCULAR_DEPENDENCY') {
      // Circular dependencies are intentionally allowed by the ES module spec.
      // https://github.com/rollup/rollup/issues/2271
    } else {
      rollupWarn(warning);
    }
  },
};
