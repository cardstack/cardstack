import * as syntax from '@glimmer/syntax';
// @ts-ignore
// import ETC from 'ember-source/dist/ember-template-compiler';
import { CompiledCard, ComponentInfo, Field } from '../interfaces';
import { singularize } from 'inflection';
import { cloneDeep } from 'lodash';

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
  field: Field;
  blockProgramUsage: string;
}
interface State {
  insidePluralField: RewriteFieldOptions | undefined;
  insideFieldsIterator:
    | {
        nodes: Map<unknown, { name: string; field: Field }>;
        nameVar: string | undefined;
        componentVar: string | undefined;
      }
    | undefined;
}

export function cardTransformPlugin(options: Options): syntax.ASTPluginBuilder {
  return function transform(
    env: syntax.ASTPluginEnvironment
  ): syntax.ASTPlugin {
    let { fields, importAndChooseName, usedFields } = options;
    let state: State = {
      insidePluralField: undefined,
      insideFieldsIterator: undefined,
    };

    return {
      name: 'card-glimmer-plugin',
      visitor: {
        ElementNode(node, path) {
          let { insidePluralField: inBlock } = state;

          if (inBlock && node.tag === inBlock.blockProgramUsage) {
            let { blockProgramUsage, field } = inBlock;
            let { inlineHBS } = field.card.embedded;

            usedFields.push(field.name);

            if (inlineHBS) {
              return inlineTemplateForField(inlineHBS, blockProgramUsage);
            }

            return process(
              rewriteFieldToComponent(
                importAndChooseName,
                field,
                inBlock.blockProgramUsage
              )
            );
          }

          let field: Field | undefined;

          if (state.insideFieldsIterator) {
            if (node.tag === state.insideFieldsIterator.componentVar) {
              field =
                fields[enclosingField(path, state.insideFieldsIterator).name];
            }
          }

          if (!field) {
            field = getFieldFromExpression(fields, node.tag);
          }

          if (!field) {
            return;
          }

          usedFields.push(field.name);

          let { inlineHBS } = field.card.embedded;
          if (inlineHBS) {
            if (field.type === 'containsMany') {
              return process(expandContainsManyShorthand(field.name, node));
            } else {
              return inlineTemplateForField(inlineHBS, field.name, PREFIX);
            }
          } else {
            let fieldTemplate = '';

            if (field.type === 'containsMany') {
              fieldTemplate = expandContainsManyShorthand(
                field.name,
                node,
                rewriteFieldToComponent(importAndChooseName, field, field.name)
              );
            } else {
              fieldTemplate = rewriteFieldToComponent(
                importAndChooseName,
                field,
                `@model.${field.name}`
              );
            }

            return process(fieldTemplate);
          }
        },

        PathExpression(node, path) {
          if (state.insideFieldsIterator) {
            if (node.original === state.insideFieldsIterator.nameVar) {
              return env.syntax.builders.string(
                enclosingField(path, state.insideFieldsIterator).name
              );
            }
          }
          return undefined;
        },

        BlockStatement: {
          enter(node) {
            let [firstArg] = node.params;
            if (
              firstArg?.type === 'PathExpression' &&
              firstArg.original === '@fields'
            ) {
              state.insideFieldsIterator = {
                nodes: new Map(),
                nameVar: node.program.blockParams[0],
                componentVar: node.program.blockParams[1],
              };
              let output: any[] = [];
              for (let [name, field] of Object.entries(fields)) {
                let copied = cloneDeep(node.program.body);
                for (let node of copied) {
                  state.insideFieldsIterator.nodes.set(node, {
                    name,
                    field,
                  });
                }
                output = output.concat(copied);
              }
              return output;
            }

            let field = getFieldFromBlockParam(fields, node);

            if (!field) {
              return;
            }

            state.insidePluralField = {
              field,
              blockProgramUsage: node.program.blockParams[0],
            };
            return undefined;
          },
          exit(/*node, path*/) {
            state.insidePluralField = undefined;
          },
        },
      },
    };
  };
}

function getFieldFromExpression(
  fields: CompiledCard['fields'],
  usage: string
): Field | undefined {
  let fieldName = usage.slice(PREFIX.length);

  return fields[fieldName];
}

function getFieldFromBlockParam(
  fields: CompiledCard['fields'],
  node: syntax.ASTv1.BlockStatement
): Field | undefined {
  let [param] = node.params;
  let usage = '';

  // ie: {{#each @model.items as...
  if (param.type === 'PathExpression') {
    usage = param.original;
  }
  // ie: {{#each (helper @model.items) as...
  if (
    param.type === 'SubExpression' &&
    param.params[0].type === 'PathExpression'
  ) {
    usage = param.params[0].original;
  }

  if (!usage || !usage.startsWith(PREFIX)) {
    return;
  }

  return getFieldFromExpression(fields, usage);
}

function expandContainsManyShorthand(
  fieldName: string,
  node: syntax.ASTv1.ElementNode,
  itemTemplate?: string
): string {
  let singularFieldName = singularize(fieldName);

  if (itemTemplate) {
    // TODO: This might be too aggressive...
    itemTemplate = itemTemplate.replace(fieldName, singularFieldName);
  } else {
    itemTemplate = `{{${singularFieldName}}}`;
  }

  return `{{#each ${node.tag} as |${singularFieldName}|}}${itemTemplate}{{/each}}`;
}

// <@model.createdAt /> -> <DateField @model={{@model.createdAt}} />
function rewriteFieldToComponent(
  importAndChooseName: ImportAndChooseName,
  field: Field,
  modelArgument: string
): string {
  let componentName = importAndChooseName(
    capitalize(field.name),
    field.card.embedded.moduleName,
    'default'
  );

  return `<${componentName} @model={{${modelArgument}}} />`;
}

function inlineTemplateForField(
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

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function enclosingField(
  path: syntax.WalkerPath<syntax.ASTv1.Node>,
  inside: NonNullable<State['insideFieldsIterator']>
) {
  let cursor: syntax.WalkerPath<syntax.ASTv1.Node> | null = path;
  while (cursor) {
    let entry = inside.nodes.get(cursor.node);
    if (entry) {
      return entry;
    }
    cursor = cursor.parent;
  }
  throw new Error(`bug: couldn't figure out which iteration we were in`);
}
