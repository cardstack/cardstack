import * as syntax from '@glimmer/syntax';

export function inlineTemplateForField(
  inlineHBS: string,
  fieldName: string,
  prefix?: string
): syntax.ASTv1.Statement[] {
  return syntax.preprocess(inlineHBS, {
    plugins: {
      ast: [rewriteLocals({ this: fieldName, prefix })],
    },
  }).body;
}

function rewriteLocals(remapping: {
  this: string;
  prefix?: string;
}): syntax.ASTPluginBuilder {
  let rewritten = new Set<unknown>();

  return function transform(
    env: syntax.ASTPluginEnvironment
  ): syntax.ASTPlugin {
    return {
      name: 'card-glimmer-plugin-rewrite-locals',
      visitor: {
        PathExpression(node) {
          if (node.head.type === 'AtHead' && !rewritten.has(node)) {
            let prefix = remapping.prefix ?? '';
            let result = env.syntax.builders.path(
              `${prefix}${[remapping.this, ...node.tail].join('.')}`
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
