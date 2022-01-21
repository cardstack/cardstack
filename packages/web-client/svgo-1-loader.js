'use strict';

const Svgo = require('svgo');
const loaderUtils = require('loader-utils');

/**
 * SVGO Loader that works with webpack 5 + svgo 1.
 */
module.exports = function (source) {
  this.cacheable(true);
  const callback = this.async();

  const options = loaderUtils.getOptions(this);

  const svgo = new Svgo({ ...options });
  svgo.optimize(source, { path: this.resourcePath }).then(
    function (result) {
      callback(null, result.data);
      return;
    },
    function (error) {
      if (error instanceof Error) {
        callback(error);
        return;
      }
      callback(new Error(error));
      return;
    }
  );
};
