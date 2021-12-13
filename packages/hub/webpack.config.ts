/* eslint-disable @typescript-eslint/no-require-imports,@typescript-eslint/no-var-requires */
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

    // place the db migrations into the dist folder so that node-pg-migrate can
    // find them
    new CopyPlugin({
      patterns: [
        {
          // we are @cardstack/hub, so there is no need to declare ourselves as a dep
          // eslint-disable-next-line node/no-extraneous-require
          from: path.join(path.dirname(require.resolve('@cardstack/hub/package.json')), 'db', 'migrations', '*.js'),
        },
      ],
    }),

    // copy image assets that the hub hosts into dist
    new CopyPlugin({
      patterns: [
        {
          from: path.join(
            // we are @cardstack/hub, so there is no need to declare ourselves as a dep
            // eslint-disable-next-line node/no-extraneous-require
            path.dirname(require.resolve('@cardstack/hub/package.json')),
            'services',
            'discord-bots',
            'hub-bot',
            'assets',
            '**',
            '*.*'
          ),
        },
      ],
    }),

    // copy over pkgs necessary for node-pg-migrate to work. these will be added
    // to the docker image's file system
    ...[
      'node-pg-migrate',
      'pg',
      'pg-connection-string',
      'pg-format',
      'pg-int8',
      'pg-pool',
      'pg-protocol',
      'pg-types',
      'pgpass',
      'postgres-array',
      'postgres-bytea',
      'postgres-date',
      'postgres-interval',
      'buffer-writer',
      'packet-reader',
      'xtend',
      'split2',
      'readable-stream',
      'inherits',
      'string_decoder',
      'util-deprecate',
      'lodash',
      'fs-extra',
      'graceful-fs',
      'jsonfile',
      'universalify',
    ].map(
      (pkg) =>
        new CopyPlugin({
          patterns: [
            {
              from: path.dirname(require.resolve(`${pkg}/package.json`)),
              to: pkg,
            },
          ],
        })
    ),
  ],

  entry: {
    hub: './cli.ts',
    tests: './node-tests/entrypoint.ts',
    'bot-tests': './bot-tests/entrypoint.ts',
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

      // corde needs this to run bot-tests successfully, though we do not fully
      // understand why.
      'node-fetch': 'node-fetch/lib/index',
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

    // corde wants to insert itself at runtime, as it drives the bot tests. We
    // don't want to compile it in.
    corde: 'commonjs corde',

    // node-pg-migrate has very specific logic for how it determines the path of
    // the migration files which rely on a relative path calculation from
    // __dirname
    'node-pg-migrate': 'commonjs node-pg-migrate',
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
    {
      // for voice support that we don't use
      module: /node_modules\/prism-media\/src\/util\/loader\.js$/,
      message: /the request of a dependency is an expression/,
    },
    {
      // we statically register tasks with the worker
      module: /node_modules\/graphile-worker\/dist\/(module|getTasks)\.js$/,
      message: /the request of a dependency is an expression/,
    },
    {
      // for graphile-worker's dynamic tasks
      module: /node_modules\/import-fresh\/index\.js$/,
      message: /the request of a dependency is an expression/,
    },
    {
      //
      module: /node_modules\/import-fresh\/index\.js$/,
      message: /the request of a dependency is an expression/,
    },
    {
      // for formidable's testing which hijacks the require function
      module: /node_modules\/formidable\/lib\/(querystring_parser|json_parser|incoming_form|file)\.js$/,
      message: /require function is used in a way in which dependencies cannot be statically extracted/,
    },
    {
      // for voice support that we don't use
      module: /node_modules\/discord\.js\/src\/client\/voice\/util\/Secretbox\.js$/,
      message: /the request of a dependency is an expression/,
    },
    {
      module: /node_modules\/@babel\/core\/lib\/config\/files\/(configuration|plugins)\.js/,
      message: /require function is used in a way in which dependencies cannot be statically extracted/,
    },
    {
      module: /node_modules\/@babel\/core\/lib\/config\/files\/(import|module-types)\.js/,
      message: /the request of a dependency is an expression/,
    },
    {
      module: /node_modules\/any-promise\/register\.js/,
      message: /the request of a dependency is an expression/,
    },
    {
      module: /node_modules\/browserslist\/node\.js/,
      message: /the request of a dependency is an expression/,
    },
    {
      module: /node_modules\/browserslist\/node\.js/,
      message: /require function is used in a way in which dependencies cannot be statically extracted/,
    },
    {
      module: /node_modules\/config\/lib\/config\.js/,
      message: /the request of a dependency is an expression/,
    },
    {
      module: /node_modules\/express\/lib\/view\.js/,
      message: /the request of a dependency is an expression/,
    },
    {
      // this require is wrapped in a try catch and will import a local pkg if the fast-crc32c is not available
      module: /node_modules\/hash-stream-validation\/index\.js/,
      message: /Can't resolve 'fast-crc32c'/,
    },
  ],
};
