import {
  ASTPlugin,
  ASTPluginBuilder,
  ASTPluginEnvironment,
  preprocess as parse,
} from '@glimmer/syntax';
import { CompiledCard } from './interfaces';

export default function cardTransform(options: {
  fields: CompiledCard['fields'];
}): ASTPluginBuilder {
  return function transform(env: ASTPluginEnvironment): ASTPlugin {
    return {
      name: 'card-glimmer-plugin',
      visitor: {
        ElementNode(node) {
          if (node.tag.startsWith('this.')) {
            let fieldName = node.tag.slice('this.'.length);
            let field = options.fields[fieldName];
            if (field) {
              let embeddedTemplate = field.card.templateSources.embedded;
              let ast = parse(embeddedTemplate, {
                plugins: {
                  ast: [rewriteLocals({ this: node.tag })],
                },
              });
              return ast.body;
            }
          }
          return undefined;
        },
      },
    };
  };
}

function rewriteLocals(remapping: {
  [oldpath: string]: string;
}): ASTPluginBuilder {
  return function transform(env: ASTPluginEnvironment): ASTPlugin {
    return {
      name: 'card-glimmer-plugin-rewrite-locals',
      visitor: {
        PathExpression(node) {
          let newPath = remapping[node.original];
          if (newPath) {
            return env.syntax.builders.path(newPath);
          }
          return undefined;
        },
      },
    };
  };
}
