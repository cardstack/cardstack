import * as syntax from '@glimmer/syntax';
// @ts-ignore
// import ETC from 'ember-source/dist/ember-template-compiler';
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
              if (field.type === 'containsMany') {
                return expandAndInclineContainsManyField(inlineHBS, fieldName);
              }

              return inlineCardTemplateForContainsField(
                inlineHBS,
                fieldName,
                PREFIX
              );
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
        BlockStatement(node) {
          // TODO: How do I make this type happy?
          let loopParam = node.params[0].original;

          if (loopParam.startsWith(PREFIX)) {
            let fieldName = loopParam.slice(PREFIX.length);
            let field = fields[fieldName];
            if (!field) {
              return;
            }
            usedFields.push(fieldName);

            let { body } = node.program;
            let [blockParam] = node.program.blockParams;
            let { inlineHBS } = field.card.embedded;

            // TODO: This is likely too shallow of a check. How do you search the whole body?
            let elementNode = body.find(
              (e) => e.type == 'ElementNode' && e.tag === blockParam
            );
            if (!elementNode) {
              throw Error(
                `A Component template's Loop does not include usage of Block param: ${blockParam}`
              );
            }

            let index = body.indexOf(elementNode);
            if (inlineHBS) {
              let template = inlineCardTemplateForContainsField(
                inlineHBS,
                elementNode.tag
              );
              body[index] = template[0];
              return node;
            } else {
              return undefined;
            }
          }
        },
      },
    };
  };
}

function expandAndInclineContainsManyField(
  inlineHBS: string,
  fieldName: string
): syntax.ASTv1.Statement[] {
  throw new Error('Function not implemented.');
}

function inlineCardTemplateForContainsField(
  inlineHBS: string,
  fieldName: string,
  prefix?: string
) {
  let ast = syntax.preprocess(inlineHBS, {
    plugins: {
      ast: [rewriteLocals({ this: fieldName, prefix })],
    },
  });
  return ast.body;
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
            let result = env.syntax.builders.path(
              `${remapping.prefix ?? ''}${[remapping.this, ...node.tail].join(
                '.'
              )}`
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
