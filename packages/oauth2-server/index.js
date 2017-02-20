module.exports = function() {
  return async function(ctx, next) {
    if (ctx.path === '/auth') {
      ctx.body = {
        auth: true
      };
    } else {
      await next();
    }
  };
};
