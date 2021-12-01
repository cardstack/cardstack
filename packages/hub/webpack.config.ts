// eslint-disable-next-line @typescript-eslint/no-require-imports,@typescript-eslint/no-var-requires
const { SourceMapDevToolPlugin } = require('webpack');
const CopyPlugin = require('copy-webpack-plugin');
const path = require('path');

module.exports = {
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',

  // disabling the default sourcemap plugin in favor of customizing our own
  // below
  devtool: false,

  plugins: [
    // customize the sourcemap configuration so that sourcemaps point back to the
    // original sources.
    new SourceMapDevToolPlugin({
      filename: '[name].js.map',
      noSources: true,
      moduleFilenameTemplate: '[absolute-resource-path]',
    }),

    // graphile-worker contains standalone sql files that it expects to be able
    // to read at runtime. We copy them into our dist so that they're easier to
    // get into our Docker image.
    new CopyPlugin({
      patterns: [
        {
          from: path.dirname(require.resolve('graphile-worker/sql/000001.sql')),
          to: 'sql',
        },
      ],
    }),
  ],

  entry: {
    hub: './cli.ts',
    tests: './node-tests/entrypoint.ts',
  },

  target: 'node14',

  node: {
    global: false,
    __dirname: true,
    __filename: true,
  },

  optimization: {
    // leave process.env.NODE_ENV alone, so that it gets the proper behavior at
    // runtime
    nodeEnv: false,
  },

  resolve: {
    alias: {
      // this library has an ES module implementation that webpack will discover
      // by default, but the package that consumes this package expects to get
      // the CJS implementation.
      'web-streams-polyfill': 'web-streams-polyfill/dist/polyfill.js',
    },

    // the only thing we added here beyond the defaults is typescript. It needs
    // to come after JS because some libraries publish both and we don't want to
    // be typechecking the libraries (that rarely works).
    extensions: ['.js', '.ts', '.json', '.wasm'],
  },
  externals: {
    // these are all optional dependencies that are supposed to be tried (and
    // failed) at runtime. We need them here so that webpack doesn't make them
    // build-time failures instead.
    'pg-native': 'commonjs pg-native',
    'ffmpeg-static': 'commonjs ffmpeg-static',
    electron: 'commonjs electron',
    'zlib-sync': 'commonjs zlib-sync',
    erlpack: 'commonjs erlpack',
  },

  module: {
    // this is the place in the "config" package that does all the dynamic
    // loading of config files. Thankfully that's all it does (it doesn't have
    // any dependencies) so we can just not parse it.
    noParse: /config\/parser\.js$/,

    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.node$/,
        loader: 'node-loader',
      },
    ],
  },
  ignoreWarnings: [
    {
      // yargs and yargs-parser can dynamically load your command files, but we
      // don't use that feature
      module: /node_modules\/yargs(-parser)?\/build\/index.cjs$/,
      message:
        /(require function is used in a way in which dependencies cannot be statically extracted)|(the request of a dependency is an expression)/,
    },
    {
      // sane can load a dynamically provided custom Watcher class but we don't
      // use that feature
      module: /node_modules\/sane\/index.js$/,
      message: /the request of a dependency is an expression/,
    },
  ],
};
