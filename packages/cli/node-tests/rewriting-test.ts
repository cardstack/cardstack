import { rewriteEmberCLIBuild } from "../rewriters";

describe("cli app rewriting", function() {
  it("can rewrite ember-cli-build.js", function() {
    let output = rewriteEmberCLIBuild(`
    const EmberApp = require('ember-cli/lib/broccoli/ember-app');
    module.exports = function(defaults) {
      let app = new EmberApp(defaults, {});
      return app.toTree();
    };
    `);
    expect(output).to.match(/const EmberApp.*module\.exports = function\(defaults\) {.*packageRules.*}/s);
  });
});
