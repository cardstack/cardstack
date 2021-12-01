// eslint-disable-next-line @typescript-eslint/no-require-imports,@typescript-eslint/no-var-requires
const { SourceMapDevToolPlugin } = require('webpack');

module.exports = {
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  devtool: false,
  plugins: [
    new SourceMapDevToolPlugin({
      filename: '[name].js.map',
      noSources: true,
      moduleFilenameTemplate: '[absolute-resource-path]',
    }),
  ],
  entry: {
    hub: './cli.ts',
    tests: './node-tests/entrypoint.ts',
  },
  output: {},
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
  },
  module: {
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
};
