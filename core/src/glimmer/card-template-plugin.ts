import * as syntax from '@glimmer/syntax';
import type {
  PathExpression,
  ElementNode,
  BlockStatement,
  Statement,
  Node,
} from '@glimmer/syntax/dist/types/lib/v1/api';
import { CompiledCard, ComponentInfo, Field, Fields } from '../interfaces';
import { singularize } from 'inflection';
import { capitalize, cloneDeep } from 'lodash';
import { inlineTemplateForField } from './inline-field-plugin';

const MODEL = '@model';
const MODEL_PREFIX = `${MODEL}.`;
const FIELDS = '@fields';
// const FIELDS_PREFIX = `${FIELDS}.`;

type ImportAndChooseName = (
  desiredName: string,
  moduleSpecifier: string,
  importedName: string
) => string;

export interface Options {
  fields: CompiledCard['fields'];
  usedFields: ComponentInfo['usedFields'];
  importAndChooseName: ImportAndChooseName;
}

interface State {
  insidePluralFieldIterator:
    | {
        field: Field;
        blockProgramUsage: string;
      }
    | undefined;
  insideFieldsIterator:
    | {
        nodes: Map<unknown, { name: string; field: Field }>;
        nameVar: string | undefined;
        componentVar: string | undefined;
      }
    | undefined;
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
  return function transform(
    env: syntax.ASTPluginEnvironment
  ): syntax.ASTPlugin {
    let { fields, importAndChooseName, usedFields } = options;
    let state: State = {
      insidePluralFieldIterator: undefined,
      insideFieldsIterator: undefined,
    };

    const inferField = inferFromFields(fields);

    return {
      name: 'card-glimmer-plugin',
      visitor: {
        ElementNode(node, path): Statement[] | undefined {
          if (node.tag === FIELDS) {
            throw new Error('Invalid use of @fields API');
          }

          if (
            state.insidePluralFieldIterator &&
            node.tag === state.insidePluralFieldIterator.blockProgramUsage
          ) {
            let { blockProgramUsage, field } = state.insidePluralFieldIterator;

            return rewriteElementNode({
              field,
              usedFields,
              importAndChooseName,
              modelArgument: blockProgramUsage,
              forceSingular: true,
            });
          }

          let field: Field | undefined;

          if (state.insideFieldsIterator) {
            if (node.tag === state.insideFieldsIterator.componentVar) {
              let { name } = enclosingField(path, state.insideFieldsIterator);
              field = fields[name];
            }
          }

          if (!field) {
            field = inferField(node);
          }

          if (!field) {
            return;
          }

          return rewriteElementNode({
            field,
            usedFields,
            importAndChooseName,
            modelArgument: field.name,
            prefix: MODEL_PREFIX,
          });
        },

        PathExpression(node, path) {
          if (state.insideFieldsIterator) {
            if (node.original === state.insideFieldsIterator.nameVar) {
              return env.syntax.builders.string(
                enclosingField(path, state.insideFieldsIterator).name
              );
            }
          }

          if (node.original === FIELDS) {
            throw new Error('Invalid use of @fields API');
          }

          return undefined;
        },

        BlockStatement: {
          enter(node) {
            if (isFieldsIterator(node)) {
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

            let field = inferField(node);

            if (!field) {
              return;
            }

            state.insidePluralFieldIterator = {
              field,
              blockProgramUsage: node.program.blockParams[0],
            };
            return undefined;
          },
          exit(/*node , path*/) {
            state.insidePluralFieldIterator = undefined;
          },
        },
      },
    };
  };
}

function isFieldsIterator(node: BlockStatement): boolean {
  let [firstArg] = node.params;

  return firstArg?.type === 'PathExpression' && firstArg.original === '@fields';
}

function inferFromFields(fields: Fields) {
  return function (
    node: PathExpression | ElementNode | BlockStatement | undefined
  ) {
    if (!node) {
      return;
    }

    if (node.type === 'ElementNode') {
      return fields[node.tag.slice(MODEL_PREFIX.length)];
    }

    let exp: PathExpression | undefined;

    if (node.type === 'PathExpression') {
      exp = node;
    } else if (node.type === 'BlockStatement') {
      let [param] = node.params;
      // ie: {{#each @model.items as...
      if (param.type === 'PathExpression') {
        exp = param;
      }
      // ie: {{#each (helper @model.items) as...
      if (
        param.type === 'SubExpression' &&
        param.params[0].type === 'PathExpression'
      ) {
        exp = param.params[0];
      }
    }

    if (!exp) {
      return;
    }

    if (exp.head.type === 'AtHead' && exp.head.name === '@model') {
      // For now, assuming we're only going one level deep
      return fields[exp.tail[0]];
    }

    return;
  };
}

function rewriteElementNode(options: {
  field: Field;
  modelArgument: string;
  importAndChooseName: Options['importAndChooseName'];
  usedFields: Options['usedFields'];
  forceSingular?: boolean;
  prefix?: string;
}): Statement[] {
  let { field, forceSingular, modelArgument, prefix } = options;
  let { inlineHBS } = field.card.embedded;

  options.usedFields.push(field.name);

  if (!forceSingular && field.type === 'containsMany') {
    if (inlineHBS) {
      return process(expandContainsManyShorthand(modelArgument));
    } else {
      return process(
        expandContainsManyShorthand(
          modelArgument,
          rewriteFieldToComponent(
            options.importAndChooseName,
            field,
            modelArgument
          )
        )
      );
    }
  } else {
    if (inlineHBS) {
      return inlineTemplateForField(inlineHBS, modelArgument, prefix);
    } else {
      return process(
        rewriteFieldToComponent(
          options.importAndChooseName,
          field,
          modelArgument,
          prefix
        )
      );
    }
  }
}

function expandContainsManyShorthand(
  fieldName: string,
  itemTemplate?: string
): string {
  let eachParam = `${MODEL_PREFIX}${fieldName}`;
  let singularFieldName = singularize(fieldName);

  if (itemTemplate) {
    // TODO: This might be too aggressive...
    itemTemplate = itemTemplate.replace(fieldName, singularFieldName);
  } else {
    itemTemplate = `{{${singularFieldName}}}`;
  }

  return `{{#each ${eachParam} as |${singularFieldName}|}}${itemTemplate}{{/each}}`;
}

// <@model.createdAt /> -> <DateField @model={{@model.createdAt}} />
function rewriteFieldToComponent(
  importAndChooseName: ImportAndChooseName,
  field: Field,
  modelArgument: string,
  prefix?: string
): string {
  let componentName = importAndChooseName(
    capitalize(field.name),
    field.card.embedded.moduleName,
    'default'
  );

  if (prefix) {
    modelArgument = prefix + modelArgument;
  }

  return `<${componentName} @model={{${modelArgument}}} />`;
}

function process(template: string) {
  return syntax.preprocess(template).body;
}

function enclosingField(
  path: syntax.WalkerPath<Node>,
  inside: NonNullable<State['insideFieldsIterator']>
) {
  let cursor: syntax.WalkerPath<Node> | null = path;
  while (cursor) {
    let entry = inside.nodes.get(cursor.node);
    if (entry) {
      return entry;
    }
    cursor = cursor.parent;
  }
  throw new Error(`bug: couldn't figure out which iteration we were in`);
}
