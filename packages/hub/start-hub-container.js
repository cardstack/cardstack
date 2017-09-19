module.exports = function() {
  return function noop(_req, _res, next) {
    return next();
  };
};
