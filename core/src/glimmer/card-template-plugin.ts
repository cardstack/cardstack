import * as syntax from '@glimmer/syntax';
// @ts-ignore
// import ETC from 'ember-source/dist/ember-template-compiler';
// const { preprocess: parse } = ETC._GlimmerSyntax
import { CompiledCard, ComponentInfo } from '../interfaces';

const PREFIX = '@model.';

export interface Options {
  fields: CompiledCard['fields'];
  usedFields: ComponentInfo['usedFields'];
  importAndChooseName: (
    desiredName: string,
    moduleSpecifier: string,
    importedName: string
  ) => string;
}

export default function glimmerCardTemplateTransform(
  source: string,
  options: Options
) {
  return syntax.print(
    syntax.preprocess(source, {
      mode: 'codemod',
      plugins: {
        ast: [cardTransformPlugin(options)],
      },
    })
  );
}

export function cardTransformPlugin(options: Options): syntax.ASTPluginBuilder {
  return function transform(/* env: ASTPluginEnvironment */): syntax.ASTPlugin {
    let { fields, importAndChooseName, usedFields } = options;
    return {
      name: 'card-glimmer-plugin',
      visitor: {
        ElementNode(node) {
          if (node.tag.startsWith(PREFIX)) {
            let fieldName = node.tag.slice(PREFIX.length);
            let field = fields[fieldName];
            if (!field) {
              return;
            }

            usedFields.push(fieldName);

            let { inlineHBS } = field.card.embedded;
            if (inlineHBS) {
              let ast = syntax.preprocess(inlineHBS, {
                plugins: {
                  ast: [rewriteLocals({ this: fieldName })],
                },
              });
              return ast.body;
            } else {
              let componentName = importAndChooseName(
                capitalize(field.localName),
                field.card.embedded.moduleName,
                'default'
              );
              let template = `<${componentName} @model={{${node.tag}}} />`;
              return syntax.preprocess(template).body;
            }
          }
          return undefined;
        },
      },
    };
  };
}

/**
 *
 */
function rewriteLocals(remapping: { this: string }): syntax.ASTPluginBuilder {
  let rewritten = new Set<unknown>();
  return function transform(
    env: syntax.ASTPluginEnvironment
  ): syntax.ASTPlugin {
    return {
      name: 'card-glimmer-plugin-rewrite-locals',
      visitor: {
        PathExpression(node) {
          if (node.head.type === 'AtHead' && !rewritten.has(node)) {
            let result = env.syntax.builders.path(
              `${PREFIX}${[remapping.this, ...node.tail].join('.')}`
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

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
