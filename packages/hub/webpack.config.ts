module.exports = {
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  entry: {
    hub: './cli.ts',
    tests: './node-tests/entrypoint.ts',
  },
  output: {},
  target: 'node14',
  node: {
    __dirname: false,
  },
  resolve: {
    alias: {
      'web-streams-polyfill': 'web-streams-polyfill/dist/polyfill.js',
    },
    extensions: ['.mjs', '.cjs', '.js', '.ts', '.json', '.wasm'],
  },
  externals: {
    // these are all optional dependencies that are supposed to be tried (and
    // failed) at runtime.
    'pg-native': 'commonjs pg-native',
    'ffmpeg-static': 'commonjs ffmpeg-static',
    electron: 'commonjs electron',

    // todo
    config: 'commonjs config',
    'graphile-worker': 'commonjs graphile-worker',
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      // {
      //   test: /\.ts$/,
      //   exclude: /node_modules/,
      //   use: {
      //     loader: 'babel-loader',
      //     options: {
      //       plugins: [
      //         [
      //           '@babel/plugin-transform-typescript',
      //           {
      //             optimizeConstEnums: true,
      //           },
      //         ],
      //         [
      //           '@babel/plugin-proposal-decorators',
      //           {
      //             legacy: true,
      //           },
      //         ],
      //         '@babel/plugin-proposal-class-properties',
      //       ],
      //     },
      //   },
      // },
      {
        test: /\.node$/,
        loader: 'node-loader',
      },
    ],
  },
};
