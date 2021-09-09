// This is used for building our test suite for use in the browser.

const path = require('path');

module.exports = {
  mode: 'development',
  entry: {
    tests: './tests/browser-main.ts',
  },
  devtool: 'inline-source-map',
  devServer: {
    contentBase: './tests',
  },
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.ts$/i,
        use: ['babel-loader'],
      },
    ],
  },
  output: {
    filename: 'dist/[name].js',
    path: path.resolve(__dirname, 'tests'),
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
};
