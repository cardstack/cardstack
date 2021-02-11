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
  return function transform(/* env: ASTPluginEnvironment */): ASTPlugin {
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
                  ast: [rewriteLocals({ this: fieldName })],
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

function rewriteLocals(remapping: { this: string }): ASTPluginBuilder {
  let rewritten = new Set<unknown>();
  return function transform(env: ASTPluginEnvironment): ASTPlugin {
    return {
      name: 'card-glimmer-plugin-rewrite-locals',
      visitor: {
        PathExpression(node) {
          if (node.head.type === 'ThisHead' && !rewritten.has(node)) {
            let result = env.syntax.builders.path(
              `this.${[remapping.this, ...node.tail].join('.')}`
            );
            rewritten.add(result);
            return result;
          }
          return undefined;
        },
      },
    };
  };
}
