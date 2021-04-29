import * as syntax from '@glimmer/syntax';
// @ts-ignore
// import ETC from 'ember-source/dist/ember-template-compiler';
import { CompiledCard, ComponentInfo, Field } from '../interfaces';
import { singularize } from 'inflection';

const PREFIX = '@model.';

export type ImportAndChooseName = (
  desiredName: string,
  moduleSpecifier: string,
  importedName: string
) => string;

export interface Options {
  fields: CompiledCard['fields'];
  usedFields: ComponentInfo['usedFields'];
  importAndChooseName: ImportAndChooseName;
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

interface RewriteFieldOptions {
  fieldName: string;
  field: Field;
  localName: string;
}
interface State {
  insideBlockStatement?: RewriteFieldOptions;
}

export function cardTransformPlugin(options: Options): syntax.ASTPluginBuilder {
  return function transform(/*env: syntax.ASTPluginEnvironment*/): syntax.ASTPlugin {
    let { fields, importAndChooseName, usedFields } = options;
    let state: State = {
      insideBlockStatement: undefined,
    };

    return {
      name: 'card-glimmer-plugin',
      visitor: {
        ElementNode(node) {
          if (
            state.insideBlockStatement &&
            node.tag === state.insideBlockStatement.localName
          ) {
            usedFields.push(state.insideBlockStatement.fieldName);
            let { inlineHBS } = state.insideBlockStatement.field.card.embedded;
            if (inlineHBS) {
              return inlineCardTemplateForField(
                inlineHBS,
                state.insideBlockStatement.localName
              );
            } else {
              return process(
                rewriteFieldInvocation(
                  importAndChooseName,
                  state.insideBlockStatement.field,
                  node.tag
                )
              );
            }
          } else if (node.tag.startsWith(PREFIX)) {
            let fieldName = node.tag.slice(PREFIX.length);
            let field = fields[fieldName];
            if (!field) {
              return;
            }

            usedFields.push(fieldName);

            let { inlineHBS } = field.card.embedded;
            if (inlineHBS) {
              if (field.type === 'containsMany') {
                return process(expandContainsManyShorthand(fieldName, node));
              } else {
                return inlineCardTemplateForField(inlineHBS, fieldName, PREFIX);
              }
            } else {
              let fieldTemplate = rewriteFieldInvocation(
                importAndChooseName,
                field,
                fieldName
              );

              if (field.type === 'containsMany') {
                fieldTemplate = expandContainsManyShorthand(
                  fieldName,
                  node,
                  fieldTemplate
                );
              }

              return process(fieldTemplate);
            }
          } else {
            return undefined;
          }
        },

        BlockStatement: {
          enter(node /*, path*/) {
            // NOTE: For now, we only support directly looping. You cannot yet
            // pass your containsMany field through a helper first
            if (node.params[0].type !== 'PathExpression') {
              return;
            }

            // TODO: Need to manage state, ie: in a blockStatement
            let loopParam = node.params[0].original;

            if (loopParam.startsWith(PREFIX)) {
              let fieldName = loopParam.slice(PREFIX.length);
              let field = fields[fieldName];

              if (!field) {
                return;
              }

              let [blockParam] = node.program.blockParams;
              state.insideBlockStatement = {
                fieldName,
                field,
                localName: blockParam,
              };
            }
          },
          exit(/*node, path*/) {
            state.insideBlockStatement = undefined;
          },
        },
      },
    };
  };
}

function expandContainsManyShorthand(
  fieldName: string,
  node: syntax.ASTv1.ElementNode,
  itemTemplate?: string
): string {
  let singularFieldName = singularize(fieldName);

  if (itemTemplate) {
    itemTemplate = itemTemplate.replace(fieldName, singularFieldName);
  } else {
    itemTemplate = `{{${singularFieldName}}}`;
  }

  return `{{#each ${node.tag} as |${singularFieldName}|}}${itemTemplate}{{/each}}`;
}

function rewriteFieldInvocation(
  importAndChooseName: ImportAndChooseName,
  field: Field,
  modelArgument: string
): string {
  let componentName = importAndChooseName(
    capitalize(field.localName),
    field.card.embedded.moduleName,
    'default'
  );

  return `<${componentName} @model={{${modelArgument}}} />`;
}

function inlineCardTemplateForField(
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

function process(template: string) {
  return syntax.preprocess(template).body;
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
