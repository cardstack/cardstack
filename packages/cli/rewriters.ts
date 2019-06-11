import recast from "recast";

const embroiderSnippet = `
(function(){
  const Webpack = require('@embroider/webpack').Webpack;
  return require("@embroider/compat").compatBuild(app, Webpack, {
    staticAddonTestSupportTrees: true,
    staticAddonTrees: true,
    staticHelpers: true,
    staticComponents: true,
    packageRules: [
      {
        package: "@cardstack/routing",
        addonModules: {
          "routes/cardstack/common.js": {
            dependsOnComponents: ["<HeadLayout/>"],
          },
        },
      },
      {
        package: "ember-elsewhere",
        components: {
          "<ToElsewhere/>": {
            acceptsComponentArguments: ["send"],
          },
          "<FromElsewhere/>": {
            yieldsSafeComponents: [true],
          },
        },
      },
      {
        package: "liquid-fire",
        components: {
          "{{liquid-bind}}": {
            yieldsArguments: ["value"],
          },
        },
      },
    ],
  });
})();
`;

const embroiderAST = recast.parse(embroiderSnippet).program.body[0];

export function rewriteEmberCLIBuild(source: string) {
  let ast = recast.parse(source);
  recast.visit(ast, {
    visitCallExpression(path) {
      if (
        path.node.callee.type === "MemberExpression" &&
        path.node.callee.object.type === "Identifier" &&
        path.node.callee.object.name === "app" &&
        path.node.callee.property.type === "Identifier" &&
        path.node.callee.property.name === 'toTree'
      ) {
        path.replace(embroiderAST);
      }
      return false;
    },
  });
  return recast.print(ast).code;
}
