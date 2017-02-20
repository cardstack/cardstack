module.exports = function() {
  return async (ctx) => {
    ctx.body = {
      data: [
        {
          id: 0,
          type: 'fields',
          attributes: {
            name: 'string'
          }
        }
      ]
    };
  };
};
