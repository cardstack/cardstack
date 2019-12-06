const { preprocess, print } = require('@glimmer/syntax');
const Plugin = require('../lib/transform');

module.exports = function processTemplate(template, opts = {}) {
  let newAst = preprocess(
    template,
    Object.assign(
      {},
      {
        plugins: {
          ast: [
            function(env) {
              return {
                name: 'plugin-under-test',
                visitors: {
                  Program: function(node) {
                    let plugin = new Plugin(env);
                    plugin.syntax = env.syntax;
                    return plugin.transform(node);
                  },
                },
              };
            },
          ],
        },
      },
      opts
    )
  );
  return print(newAst);
};
